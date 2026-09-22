import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { buildFiller, builders, type Built } from './buildings';
import { Kit } from './kit';

export type Quality = 'high' | 'medium' | 'low';
const QUALITY: Record<Quality, { dpr: number; shadow: number; aa: boolean }> = {
  high: { dpr: 2, shadow: 2048, aa: true },
  medium: { dpr: 1.5, shadow: 1024, aa: true },
  low: { dpr: 1, shadow: 0, aa: false },
};

/** Distância entre terrenos ao longo da rua (eixo z) e recuo da fachada em relação ao eixo da rua. */
const LOT = 22;
const FACADE_X = 13;
const EYE = 1.7;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (t: number) => t * t * (3 - 2 * t);

export interface StreetOptions {
  count: number;
  quality: Quality;
  reducedMotion: boolean;
  onProgress: (p: number, label: string) => void;
}

interface Lot {
  side: -1 | 1;
  z: number;
  built: Built;
  root: THREE.Group;
}

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** imóvel mais em foco e o quanto (0–1) */
  focus: number;
  weight: number;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Uma rua de verdade: casas de preenchimento e os imóveis do catálogo dos dois lados. A câmera anda pela rua de
 * forma contínua (roda do mouse, toque ou teclado), com o olhar acompanhando o imóvel de cada trecho, e pode
 * "entrar" pela porta de qualquer imóvel. A UI só usa a API pública.
 */
export class StreetStage {
  onSound?: (n: 'door' | 'move') => void;
  onContextLost?: () => void;
  onInteract?: () => void;
  /** o imóvel em foco mudou (-1 = nenhum) */
  onFocus?: (i: number) => void;
  /** parou de andar; `i` é o imóvel diante da câmera (-1 = nenhum) */
  onSettle?: (i: number) => void;
  /** progresso da caminhada 0–1 (para o mini-mapa) */
  onWalk?: (t: number) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 1, 0.2, 700);
  private kit = new Kit();
  private sun!: THREE.DirectionalLight;
  private env?: THREE.Texture;
  private lots: Lot[] = [];
  private tick: ((t: number, dt: number) => void)[] = [];
  private quality: Quality;
  private still: boolean;

  private cam = { pos: v3(0, 16, 34), target: v3(0, 3, -70) };
  private look = { yaw: 0, pitch: 0 };
  private goal = { yaw: 0, pitch: 0 };
  private dragging = false;
  private moving: gsap.core.Tween | null = null;
  private fovPunch = 0;
  private exploring = false;

  // caminhada
  private walking = false;
  private s = 0;
  private sTarget = 0;
  private slide: gsap.core.Tween | null = null;
  private lastInput = 0;
  private settled = true;
  private focus = -1;
  private speed = 0;
  private stride = 0;

  private hotspotEls = new Map<string, HTMLElement>();
  private anchors: { id: string; pos: THREE.Vector3 }[] = [];
  private running = false;
  private visible = true;
  private raf = 0;
  private last = 0;
  private acc = { frames: 0, time: 0, slow: 0 };
  private cleanup: (() => void)[] = [];
  private tmp = new THREE.Vector3();

  private constructor(private host: HTMLElement, private opts: StreetOptions) {
    this.quality = opts.quality;
    this.still = opts.reducedMotion;
  }

  static async create(host: HTMLElement, opts: StreetOptions) {
    const s = new StreetStage(host, opts);
    await s.init();
    return s;
  }

  // ───────────────────────── criação ─────────────────────────

  private async init() {
    const { onProgress } = this.opts;
    const q = QUALITY[this.quality];
    onProgress(0.12, 'Preparando a rua…');
    this.renderer = new THREE.WebGLRenderer({ antialias: q.aa, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = q.shadow > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.setAttribute('aria-hidden', 'true');
    this.host.prepend(r.domElement);
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost?.();
    });

    this.buildAtmosphere();
    onProgress(0.25, 'Acendendo os postes…');
    await nextFrame();
    this.buildStreet();
    onProgress(0.4, 'Erguendo as casas…');
    await nextFrame();

    // linhas de terrenos: k = -1 … count (dois lados). Os imóveis do catálogo alternam de lado.
    const rows = this.opts.count + 2;
    let done = 0;
    for (let k = -1; k < rows - 1; k++) {
      for (const side of [-1, 1] as const) {
        const propIdx = k >= 0 && k < this.opts.count && (k % 2 === 0 ? -1 : 1) === side ? k : -1;
        this.buildLot(k, side, propIdx);
      }
      done++;
      onProgress(0.4 + (done / rows) * 0.5, 'Erguendo as casas…');
      if (k % 2) await nextFrame();
    }
    this.buildScenery();
    this.setCamera(this.overview());
    this.resize();
    this.observe();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    onProgress(1, 'Rua pronta.');
    this.setRunning(true);
  }

  private buildAtmosphere() {
    const { scene, kit } = this;
    const sky = kit.canvasTexture(4, 256);
    const grad = sky.ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7fa6c9');
    grad.addColorStop(0.45, '#cfd9d6');
    grad.addColorStop(0.75, '#f6dcb6');
    grad.addColorStop(1, '#f3c58e');
    sky.ctx.fillStyle = grad;
    sky.ctx.fillRect(0, 0, 4, 256);
    sky.tex.needsUpdate = true;
    scene.background = sky.tex;
    scene.fog = new THREE.FogExp2(0xf0d3ad, 0.0075);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.env;
    scene.environmentIntensity = 0.32;

    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xd9b98a, 0.85));
    const sun = new THREE.DirectionalLight(0xffdcaa, 3.1);
    const size = QUALITY[this.quality].shadow;
    const sh = sun.shadow;
    sh.camera.left = -46;
    sh.camera.right = 46;
    sh.camera.top = 46;
    sh.camera.bottom = -46;
    sh.camera.near = 5;
    sh.camera.far = 160;
    sh.bias = -0.0005;
    sh.normalBias = 0.05;
    if (size) sh.mapSize.set(size, size);
    sun.castShadow = size > 0;
    scene.add(sun, sun.target);
    this.sun = sun;
  }

  private buildStreet() {
    const { kit } = this;
    const root = kit.group(this.scene);
    const zEnd = -(this.opts.count + 2) * LOT - 60;
    const len = 140 - zEnd;
    const zMid = (140 + zEnd) / 2;
    kit.b(500, 0.2, len + 200, 'grass', 0, -0.11, zMid, root, { cast: false });
    kit.b(9.4, 0.12, len, 'asphalt', 0, 0.0, zMid, root, { cast: false });
    for (const s of [-1, 1]) {
      kit.b(0.28, 0.24, len, 'curb', s * 4.7, 0.06, zMid, root, { cast: false });
      kit.b(2.6, 0.14, len, 'sidewalk', s * 6.2, 0.05, zMid, root, { cast: false });
    }
    // faixa central tracejada
    const dashes = new THREE.InstancedMesh(kit.box(0.16, 0.02, 2.4), kit.m('white'), Math.ceil(len / 5));
    const o = new THREE.Object3D();
    for (let i = 0; i < dashes.count; i++) {
      o.position.set(0, 0.075, 138 - i * 5);
      o.updateMatrix();
      dashes.setMatrixAt(i, o.matrix);
    }
    root.add(dashes);
    // faixas de pedestre a cada 2 terrenos, entre as casas
    const stripes = new THREE.InstancedMesh(kit.box(0.5, 0.02, 3.2), kit.m('stripe'), 7 * Math.ceil((this.opts.count + 3) / 2));
    let n = 0;
    for (let k = 0; k < this.opts.count + 3; k += 2) {
      for (let i = -3; i <= 3; i++) {
        o.position.set(i * 1.25, 0.078, -k * LOT + LOT / 2);
        o.updateMatrix();
        stripes.setMatrixAt(n++, o.matrix);
      }
    }
    stripes.count = n;
    root.add(stripes);
    // postes e árvores de calçada, alternados
    for (let z = 60; z > zEnd + 40; z -= 11) {
      for (const s of [-1, 1] as const) {
        if (Math.round(z / 11 + (s > 0 ? 1 : 0)) % 2 === 0) {
          const p = kit.group(root, s * 5.6, 0, z);
          kit.mesh(kit.cyl(0.07, 0.1, 5.6, 8), kit.m('lampPost'), 0, 2.8, 0, p);
          kit.b(1.3, 0.08, 0.1, 'lampPost', -s * 0.6, 5.55, 0, p);
          kit.mesh(kit.sphere(0.2, 8, 6), kit.m('lampGlow'), -s * 1.2, 5.45, 0, p, { cast: false });
        } else {
          const t = kit.group(root, s * 6.9, 0, z);
          t.scale.setScalar(0.8);
          kit.mesh(kit.cyl(0.11, 0.17, 2.4, 8), kit.m('trunk'), 0, 1.2, 0, t);
          kit.mesh(kit.sphere(1.25, 10, 8), kit.m('leaf'), 0, 3.2, 0, t, { receive: false });
        }
      }
    }
    // carros estacionados junto ao meio-fio
    const carMats = ['carRed', 'carBlue', 'carWhite', 'carGray'] as const;
    for (let i = 0; i < 12; i++) {
      const z = 24 - i * 19 - (i % 3) * 4;
      this.addCar(root, i % 2 ? 3.3 : -3.3, z, i % 2 ? 0 : Math.PI, carMats[i % 4]);
    }
    // carros em movimento
    for (const [lane, speed, mat] of [[1.6, 5.5, 'carWhite'], [-1.6, -4.2, 'carBlue'], [1.6, 4.4, 'carGray']] as const) {
      const car = this.addCar(root, lane, 0, lane > 0 ? Math.PI : 0, mat);
      const span = 260;
      const phase = speed > 4.5 ? 0 : 90;
      this.tick.push((t) => {
        if (this.still) return;
        const p = (((t * speed + phase) % span) + span) % span;
        car.position.z = lane > 0 ? 100 - p : -160 + p;
      });
    }
  }

  private addCar(parent: THREE.Object3D, x: number, z: number, rotY: number, mat: 'carRed' | 'carBlue' | 'carWhite' | 'carGray') {
    const { kit } = this;
    const c = kit.group(parent, x, 0, z, rotY + Math.PI / 2);
    kit.b(4.3, 0.7, 1.8, mat, 0, 0.6, 0, c);
    kit.b(2.3, 0.6, 1.62, mat, -0.2, 1.2, 0, c);
    kit.b(2.1, 0.44, 1.64, 'glassDark', -0.2, 1.22, 0, c, { cast: false });
    for (const wx of [-1.35, 1.35]) for (const wz of [-0.9, 0.9]) kit.mesh(kit.cyl(0.34, 0.34, 0.25, 14), kit.m('tyre'), wx, 0.34, wz, c).rotation.x = Math.PI / 2;
    return c;
  }

  private buildLot(k: number, side: -1 | 1, propIdx: number) {
    const { kit } = this;
    const z = -k * LOT;
    const root = kit.group(this.scene, side * FACADE_X, 0, z, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    kit.b(26, 0.06, 40, 'grass', 0, 0.03, -14, root, { cast: false });
    const built = propIdx >= 0 ? builders[propIdx](kit, root) : buildFiller(kit, root, Math.abs(k * 2 + (side > 0 ? 1 : 0)) % 4, Math.abs(k * 7 + (side > 0 ? 3 : 0)));
    this.tick.push(...built.tick);
    if (propIdx >= 0) {
      this.lots[propIdx] = { side, z, built, root };
      const p = root.localToWorld(v3(0, Math.min(built.height, 6) * 0.6 + 2.2, 1.2));
      this.anchors[propIdx] = { id: String(propIdx), pos: p };
    }
  }

  private buildScenery() {
    const { kit } = this;
    const root = kit.group(this.scene);
    const zEnd = -(this.opts.count + 2) * LOT - 60;
    for (let i = 0; i < 16; i++) {
      const hill = kit.mesh(kit.sphere(1, 16, 10), kit.m(i % 2 ? 'hill' : 'hillFar'), (i - 8) * 46 + (i % 3) * 9, -2, zEnd - 40 - (i % 4) * 22, root, { cast: false, receive: false });
      hill.scale.set(48 + (i % 3) * 14, 16 + (i % 4) * 9, 34);
    }
    for (let i = 0; i < 46; i++) {
      const s = i % 2 ? 1 : -1;
      const x = s * (34 + ((i * 13) % 55));
      const z = 60 - ((i * 37) % (Math.abs(zEnd) + 100));
      const t = kit.group(root, x, 0, z);
      t.scale.setScalar(1.1 + (i % 5) * 0.2);
      kit.mesh(kit.cyl(0.14, 0.2, 2.6, 6), kit.m('trunk'), 0, 1.3, 0, t);
      kit.mesh(kit.sphere(1.7, 8, 6), kit.m(i % 3 ? 'leaf' : 'leafWarm'), 0, 3.6, 0, t, { receive: false });
    }
  }

  // ───────────────────────── caminhada ─────────────────────────

  private portrait() {
    return this.camera.aspect < 1;
  }
  private baseFov() {
    return this.portrait() ? 68 : 52;
  }

  /** Distância (m) atrás da fachada em que a câmera "para" para olhar o imóvel de frente. */
  private back(i: number) {
    return 7 + Math.min(this.lots[i].built.height, 27) * 0.35 + (this.portrait() ? 4 : 0);
  }
  /** Posição s (m ao longo da rua) em que o imóvel i fica bem enquadrado. */
  private stopS(i: number) {
    return i * LOT - this.back(i);
  }
  private get sMin() {
    return -LOT * 0.9;
  }
  private get sMax() {
    return (this.opts.count - 1) * LOT + LOT * 1.1;
  }

  /** Pose de "pedestre" em s: olha para frente e vira para cada imóvel por onde passa (mistura contínua). */
  private pose(s: number): Pose {
    const zc = -s;
    const forward = v3(0, EYE, zc - 22);
    const target = forward.clone();
    const pos = v3(0, EYE, zc);
    let sum = 0;
    let best = -1;
    let bestW = 0;
    const ws: number[] = [];
    for (let i = 0; i < this.lots.length; i++) {
      const d = zc - this.lots[i].z; // >0: ainda antes do imóvel
      const w = smooth(Math.max(0, 1 - Math.abs(d - this.back(i)) / 17));
      ws.push(w);
      sum += w;
      if (w > bestW) {
        bestW = w;
        best = i;
      }
    }
    const norm = Math.max(1, sum);
    for (let i = 0; i < this.lots.length; i++) {
      const w = ws[i] / norm;
      if (w <= 0.001) continue;
      const lot = this.lots[i];
      const h = Math.min(lot.built.height, 27);
      pos.x += -lot.side * 3.0 * w;
      pos.y += h * 0.07 * w;
      const door = v3(lot.side * 11, Math.min(h * 0.45, 11), lot.z - 1);
      target.addScaledVector(door.sub(forward), 0.94 * w);
    }
    return { pos, target, focus: best, weight: bestW };
  }

  private setCamera(v: { pos: THREE.Vector3; target: THREE.Vector3 }) {
    this.cam.pos.copy(v.pos);
    this.cam.target.copy(v.target);
  }

  private overview() {
    const shift = this.camera.aspect > 1.2 && !this.exploring ? 6 : 0;
    return { pos: v3(-2, 15, 36), target: v3(shift, 4, -78) };
  }

  private applyCamera(yaw: number, pitch: number) {
    const dir = this.tmp.copy(this.cam.target).sub(this.cam.pos);
    dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const right = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
    dir.applyAxisAngle(right, pitch);
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.pos.x + dir.x, this.cam.pos.y + dir.y, this.cam.pos.z + dir.z);
    this.camera.fov = this.baseFov() + this.fovPunch;
    this.camera.updateProjectionMatrix();
  }

  private flyTo(view: { pos: THREE.Vector3; target: THREE.Vector3 }, via: THREE.Vector3[] = [], minDur = 1.6): Promise<void> {
    this.moving?.kill();
    this.slide?.kill();
    this.goal.yaw = this.goal.pitch = 0;
    const startPos = this.cam.pos.clone();
    const startTarget = this.cam.target.clone();
    const curve = new THREE.CatmullRomCurve3([startPos, ...via, view.pos.clone()], false, 'centripetal');
    const duration = this.still ? 0.01 : Math.min(4.4, Math.max(minDur, 0.9 + curve.getLength() * 0.045));
    const p = { t: 0 };
    this.onSound?.('move');
    return new Promise((resolve) => {
      this.moving = gsap.to(p, {
        t: 1,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          curve.getPoint(p.t, this.cam.pos);
          this.cam.target.lerpVectors(startTarget, view.target, p.t);
          this.fovPunch = this.still ? 0 : Math.sin(p.t * Math.PI) * 4;
        },
        onComplete: () => {
          this.moving = null;
          this.fovPunch = 0;
          this.cam.pos.copy(view.pos);
          this.cam.target.copy(view.target);
          resolve();
        },
        onInterrupt: () => resolve(),
      });
    });
  }

  /** Atualiza a caminhada a cada frame: suaviza s, calcula a pose, balança os passos e detecta foco/parada. */
  private stepWalk(dt: number, now: number) {
    const prev = this.s;
    this.s += (this.sTarget - this.s) * (1 - Math.exp(-dt * 4.2));
    if (Math.abs(this.sTarget - this.s) < 0.002) this.s = this.sTarget;
    this.speed = (this.s - prev) / Math.max(dt, 0.001);
    const pose = this.pose(this.s);
    this.cam.pos.copy(pose.pos);
    this.cam.target.copy(pose.target);
    // passos: leve balanço vertical/lateral proporcional à velocidade
    if (!this.still) {
      const amp = Math.min(1, Math.abs(this.speed) / 6);
      this.stride += Math.abs(this.speed) * dt * 1.9;
      this.cam.pos.y += Math.sin(this.stride * 2) * 0.045 * amp;
      this.cam.pos.x += Math.sin(this.stride) * 0.05 * amp;
    }
    // foco
    const f = pose.weight > 0.42 ? pose.focus : -1;
    if (f !== this.focus) {
      this.focus = f;
      this.onFocus?.(f);
    }
    this.onWalk?.((this.s - this.sMin) / (this.sMax - this.sMin));
    // parada: alguns instantes sem mexer → "ímã" leva ao ponto ideal do imóvel e avisa a UI
    const idle = now - this.lastInput > 520 && Math.abs(this.speed) < 0.35 && !this.slide;
    if (idle && !this.settled) {
      const near = pose.weight > 0.28 ? pose.focus : -1;
      if (near >= 0 && Math.abs(this.s - this.stopS(near)) > 0.6) {
        this.glideTo(this.stopS(near), () => this.finishSettle());
      } else this.finishSettle();
    }
    if (Math.abs(this.speed) > 0.6 && this.settled) this.settled = false;
  }

  private finishSettle() {
    this.settled = true;
    this.onSettle?.(this.focus);
  }

  private glideTo(s: number, done?: () => void, slow = 1) {
    this.slide?.kill();
    const target = Math.max(this.sMin, Math.min(this.sMax, s));
    const dur = this.still ? 0.01 : Math.min(3.6, Math.max(0.9, (Math.abs(target - this.sTarget) / 18) * slow));
    const p = { v: this.sTarget };
    this.slide = gsap.to(p, {
      v: target,
      duration: dur,
      ease: 'power2.inOut',
      onUpdate: () => (this.sTarget = p.v),
      onComplete: () => {
        this.slide = null;
        this.sTarget = target;
        // deixa o suavizador alcançar
        setTimeout(() => done?.(), 250);
      },
    });
  }

  // ───────────────────────── loop ─────────────────────────

  private observe() {
    const io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.setRunning(this.visible && !document.hidden);
    });
    io.observe(this.host);
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.host);
    const onVis = () => this.setRunning(this.visible && !document.hidden);
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    });
    this.bindDrag();
  }

  private setRunning(on: boolean) {
    if (on === this.running) return;
    this.running = on;
    if (on) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    } else cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    this.watchPerformance(dt);
    for (const fn of this.tick) fn(t, dt);

    if (this.walking && !this.moving) this.stepWalk(dt, now);
    this.sun.target.position.copy(this.cam.target);
    this.sun.position.set(this.cam.target.x - 38, 34, this.cam.target.z + 30);

    // olhar livre volta suavemente para a frente enquanto se anda
    if (this.walking && !this.dragging) {
      this.goal.yaw *= 1 - Math.min(1, dt * 0.55);
      this.goal.pitch *= 1 - Math.min(1, dt * 0.8);
    }
    const k = Math.min(1, dt * 7);
    this.look.yaw += (this.goal.yaw - this.look.yaw) * k;
    this.look.pitch += (this.goal.pitch - this.look.pitch) * k;
    const sway = !this.exploring && !this.still && !this.moving ? Math.sin(t * 0.22) * 0.03 : 0;
    this.applyCamera(this.look.yaw + sway, this.look.pitch);
    this.projectHotspots();
    this.renderer.render(this.scene, this.camera);
  };

  private watchPerformance(dt: number) {
    const a = this.acc;
    a.frames++;
    a.time += dt;
    if (a.time < 2) return;
    const fps = a.frames / a.time;
    a.frames = 0;
    a.time = 0;
    a.slow = fps < 38 ? a.slow + 1 : 0;
    if (a.slow >= 2 && this.quality !== 'low') {
      a.slow = 0;
      this.quality = this.quality === 'high' ? 'medium' : 'low';
      const q = QUALITY[this.quality];
      if (!q.shadow) {
        this.renderer.shadowMap.enabled = false;
        this.sun.castShadow = false;
        this.scene.traverse((o) => {
          const mat = (o as THREE.Mesh).material;
          if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => (m.needsUpdate = true));
        });
      } else {
        this.sun.shadow.mapSize.set(q.shadow, q.shadow);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
      this.resize();
    }
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].dpr));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.fov = this.baseFov();
    this.camera.updateProjectionMatrix();
    if (!this.moving && !this.walking) this.setCamera(this.overview());
  }

  private bindDrag() {
    const el = this.renderer.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      this.dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const lim = this.exploring ? 0.9 : 0.22;
      this.goal.yaw = THREE.MathUtils.clamp(this.goal.yaw - (e.clientX - last.x) * 0.0035, -lim, lim);
      this.goal.pitch = THREE.MathUtils.clamp(this.goal.pitch - (e.clientY - last.y) * 0.0025, -0.3, 0.3);
      last = { x: e.clientX, y: e.clientY };
      this.onInteract?.();
    };
    const up = () => {
      last = null;
      this.dragging = false;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this.cleanup.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    });
  }

  private projectHotspots() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const [id, el] of this.hotspotEls) {
      const a = this.anchors[Number(id)];
      if (!a) continue;
      const v = this.tmp.copy(a.pos).project(this.camera);
      const dist = this.camera.position.distanceTo(a.pos);
      const off = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05 || (this.walking && dist > 75);
      el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px, 0)`;
      el.classList.toggle('is-offscreen', off);
      el.style.zIndex = String(Math.round((1 - v.z) * 1000));
    }
  }

  // ───────────────────────── API pública ─────────────────────────

  bindHotspots(els: Map<string, HTMLElement>) {
    this.hotspotEls = els;
  }
  get count() {
    return this.lots.length;
  }
  get index() {
    return this.focus;
  }
  setExploring(on: boolean) {
    this.exploring = on;
    if (!on) {
      this.walking = false;
      this.goal.yaw = this.goal.pitch = 0;
      this.slide?.kill();
      if (!this.moving) this.setCamera(this.overview());
    }
  }

  /** Começa a caminhada diante do imóvel `i`, voando da vista aérea até a calçada. */
  async startWalk(i = 0) {
    this.walking = false;
    this.s = this.sTarget = this.stopS(i);
    this.speed = 0;
    this.settled = true;
    this.focus = -1;
    const pose = this.pose(this.s);
    await this.flyTo(pose, [v3(0, 7, pose.pos.z + 30)], 2.4);
    this.walking = true;
    this.lastInput = performance.now();
    this.focus = pose.weight > 0.42 ? pose.focus : -1;
    this.onFocus?.(this.focus);
    this.finishSettle();
  }

  /** Anda `meters` ao longo da rua (positivo = adiante). Chamado pela roda, toque e teclado. */
  walkBy(meters: number) {
    if (!this.walking || this.moving) return;
    this.slide?.kill();
    this.slide = null;
    this.sTarget = Math.max(this.sMin, Math.min(this.sMax, this.sTarget + meters));
    this.lastInput = performance.now();
    this.settled = false;
    this.onInteract?.();
  }

  /** Vai caminhando até o imóvel `i` (chips, setas e etiquetas). */
  walkToProperty(i: number) {
    i = Math.max(0, Math.min(this.lots.length - 1, i));
    if (!this.walking || this.moving) return Promise.resolve();
    this.settled = false;
    this.lastInput = performance.now();
    return new Promise<void>((resolve) => this.glideTo(this.stopS(i), () => (this.finishSettle(), resolve()), 1.15));
  }

  /** Volta à vista geral da rua. */
  async overviewShot() {
    this.walking = false;
    this.slide?.kill();
    this.focus = -1;
    await this.flyTo(this.overview(), [], 2.4);
  }

  private doorOpen: { open: { v: number }; setDoor: () => void } | null = null;

  /** Atravessa a porta do imóvel `i`: aproxima, abre e entra. */
  async enterDoor(i: number) {
    const lot = this.lots[i];
    const s = lot.side;
    const doorX = s * FACADE_X;
    this.walking = false;
    this.slide?.kill();
    const open = { v: 0 };
    const setDoor = () => {
      lot.built.doors.left.rotation.y = open.v * 1.45;
      lot.built.doors.right.rotation.y = -open.v * 1.45;
    };
    this.onSound?.('door');
    await this.flyTo({ pos: v3(s * 8.4, EYE, lot.z), target: v3(doorX, 1.55, lot.z) }, [v3(-s * 0.5, 1.8, lot.z + 5)], 1.5);
    if (!this.still) gsap.to(open, { v: 1, duration: 1.1, ease: 'power2.out', onUpdate: setDoor });
    else {
      open.v = 1;
      setDoor();
    }
    await this.flyTo({ pos: v3(doorX - s * 1.2, 1.7, lot.z), target: v3(doorX - s * 6, 1.5, lot.z) }, [], 1.6);
    this.doorOpen = { open, setDoor };
  }

  /** Volta do interior para a calçada em frente ao imóvel, fecha a porta e retoma a caminhada. */
  async leaveDoor(i: number) {
    const d = this.doorOpen;
    this.doorOpen = null;
    if (d) gsap.to(d.open, { v: 0, duration: 1.3, delay: 0.6, ease: 'power2.inOut', onUpdate: d.setDoor });
    this.s = this.sTarget = this.stopS(i);
    const pose = this.pose(this.s);
    await this.flyTo(pose, [], 2.2);
    this.walking = true;
    this.focus = pose.weight > 0.42 ? pose.focus : i;
    this.speed = 0;
    this.lastInput = performance.now();
    this.onFocus?.(this.focus);
    this.finishSettle();
  }

  destroy() {
    this.setRunning(false);
    this.moving?.kill();
    this.slide?.kill();
    this.cleanup.forEach((fn) => fn());
    this.kit.disposeAll();
    this.env?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
