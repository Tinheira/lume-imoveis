import * as THREE from 'three';
import gsap from 'gsap';

export interface PanoOptions {
  interactive: boolean;
  autoRotate: boolean;
  /** limite de pixel ratio */
  maxDpr: number;
  /** ms sem interação até começar a girar sozinho (padrão 3500) */
  autoDelay?: number;
  /** roda do mouse aproxima/afasta (padrão true); false deixa a roda para navegação */
  wheelZoom?: boolean;
  reducedMotion: boolean;
}

/** Textura em 4096 px apenas onde a GPU e o aparelho aguentam; senão 2048 px. */
export function pickResolution(renderer?: THREE.WebGLRenderer): 6144 | 4096 | 2048 {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const max = renderer?.capabilities.maxTextureSize ?? 4096;
  if (coarse) return 2048;
  return max >= 8192 ? 6144 : max >= 4096 ? 4096 : 2048;
}

/**
 * Visualizador de panorama 360° (imagem equiretangular): arrastar, zoom por roda/pinça,
 * rotação automática e transição suave entre cômodos.
 */
export class PanoView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
  private geometry = new THREE.SphereGeometry(500, 64, 40);
  private spheres: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
  private front = 0;
  private loader = new THREE.TextureLoader();

  private lon = 0;
  private lat = 0;
  private velLon = 0;
  private velLat = 0;
  private fov = 75;
  private autoRotate: boolean;
  private idleSince = 0;
  private dragging = false;
  private running = false;
  private visible = true;
  private raf = 0;
  private last = 0;
  private cleanup: (() => void)[] = [];
  private token = 0;
  private alive = true;
  private walking = false;
  /** direção "em frente" do cômodo atual (0–1 na imagem) */
  private roomU = 0.5;
  private tmp = new THREE.Vector3();
  /** chamado quando o usuário interage (arrasta/zoom) */
  onInteract?: () => void;
  /** chamado a cada frame, depois de renderizar (usado para posicionar as setas) */
  onFrame?: () => void;

  constructor(private host: HTMLElement, private opts: PanoOptions) {
    this.autoRotate = opts.autoRotate;
    this.geometry.scale(-1, 1, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.prepend(this.renderer.domElement);

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.renderOrder = i;
      mesh.visible = false;
      this.scene.add(mesh);
      this.spheres.push(mesh);
    }

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.sync();
    });
    io.observe(host);
    const onVis = () => this.sync();
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    });
    if (opts.interactive) this.bindControls();
    this.resize();
    this.sync();
  }

  /** Converte a posição horizontal 0–1 da imagem em longitude da câmera. */
  static uToLon(u: number) {
    return (u - 0.5) * 360 + 90;
  }

  /**
   * Carrega e exibe o panorama. Resolve quando a textura está na tela.
   * `onProgress` recebe 0–1 (aproximado pelo download).
   */
  private loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise<THREE.Texture>((resolve, reject) =>
      this.loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          tex.generateMipmaps = false;
          tex.minFilter = THREE.LinearFilter;
          resolve(tex);
        },
        undefined,
        reject,
      ),
    );
  }

  get walkingNow() {
    return this.walking;
  }

  /** Posição em pixels de uma direção do panorama (longitude/latitude em graus). */
  project(lon: number, lat: number): { x: number; y: number; visible: boolean; front: boolean } {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const th = THREE.MathUtils.degToRad(lon);
    const v = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    const front = this.camera.getWorldDirection(this.tmp).dot(v) > 0.05;
    v.multiplyScalar(400).project(this.camera);
    const behind = v.z > 1;
    return {
      x: (v.x * 0.5 + 0.5) * this.host.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.host.clientHeight,
      visible: front && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
      front: front && !behind,
    };
  }

  /** longitude "em frente" do cômodo atual */
  get forwardLon() {
    return PanoView.uToLon(this.roomU);
  }

  /**
   * CAMINHADA entre cômodos, sem corte seco:
   * 1) o olhar gira até a direção de seguir; 2) a câmera "avança" (zoom para dentro);
   * 3) já em movimento, dissolve para o próximo cômodo, orientado para a mesma direção;
   * 4) a vista se abre ao chegar.
   * `dir` = 1 segue em frente; -1 volta (gira 180° e caminha para trás no percurso).
   */
  async walkTo(url: string, nextU: number, dir: 1 | -1, onSlowLoad?: () => void): Promise<void> {
    if (this.opts.reducedMotion) return this.show(url, nextU, { instant: true });
    const tk = ++this.token;
    this.walking = true;
    this.velLon = this.velLat = 0;
    const texP = this.loadTexture(url);
    const cur = this.spheres[this.front];
    const next = this.spheres[1 - this.front];
    const heading = PanoView.uToLon(this.roomU) + (dir < 0 ? 180 : 0);
    const cam = { lon: this.lon, lat: this.lat, fov: this.fov };
    const apply = () => {
      if (!this.alive) return;
      this.lon = cam.lon;
      this.lat = cam.lat;
      this.setFov(cam.fov);
    };
    const go = (target: gsap.core.Tween | undefined) => new Promise<void>((res) => target?.eventCallback('onComplete', res) ?? res());
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // 1) girar até a direção de caminhada
    const delta = ((heading - cam.lon + 540) % 360) - 180;
    await go(gsap.to(cam, { lon: cam.lon + delta, lat: -2, duration: Math.abs(delta) > 4 ? 0.8 : 0.2, ease: 'power2.inOut', onUpdate: apply }));
    if (tk !== this.token) return;

    // 2) avançar
    const dolly = go(gsap.to(cam, { fov: 42, duration: 1.7, ease: 'power2.in', onUpdate: apply }));
    await wait(950);
    let tex: THREE.Texture;
    const slow = setTimeout(() => onSlowLoad?.(), 450);
    try {
      tex = await texP;
    } catch (e) {
      clearTimeout(slow);
      this.walking = false;
      throw e;
    }
    clearTimeout(slow);
    if (tk !== this.token) {
      tex.dispose();
      return;
    }

    // 3) dissolver para o próximo cômodo, já orientado para a direção da caminhada
    next.material.map?.dispose();
    next.material.map = tex;
    next.material.needsUpdate = true;
    next.visible = true;
    next.material.opacity = 0;
    const nextLon = PanoView.uToLon(nextU);
    next.rotation.y = THREE.MathUtils.degToRad(nextLon - cam.lon);
    this.front = 1 - this.front;
    const fade = { t: 0 };
    await Promise.all([
      dolly,
      go(
        gsap.to(fade, {
          t: 1,
          duration: 0.8,
          ease: 'power1.inOut',
          onUpdate: () => {
            next.material.opacity = fade.t;
            cur.material.opacity = 1 - Math.min(1, fade.t * 1.3);
          },
        }),
      ),
    ]);
    if (tk !== this.token) return;
    cur.visible = false;
    cur.material.opacity = 0;
    // mesma imagem, agora no sistema de coordenadas do novo cômodo
    next.rotation.y = 0;
    cam.lon = nextLon;
    this.lon = nextLon;
    this.roomU = nextU;

    // 4) abrir a vista ao chegar
    await go(gsap.to(cam, { fov: 75, lat: 0, duration: 1.5, ease: 'power2.out', onUpdate: apply }));
    this.walking = false;
    this.idleSince = performance.now();
  }

  async show(url: string, u: number, { instant = false }: { instant?: boolean } = {}): Promise<void> {
    const tk = ++this.token;
    this.walking = false;
    this.roomU = u;
    const tex = await this.loadTexture(url);
    if (tk !== this.token) {
      tex.dispose();
      return;
    }
    const next = this.spheres[1 - this.front];
    const prev = this.spheres[this.front];
    next.material.map?.dispose();
    next.material.map = tex;
    next.material.needsUpdate = true;
    next.visible = true;
    next.rotation.y = 0;
    this.front = 1 - this.front;

    const targetLon = PanoView.uToLon(u);
    const still = instant || this.opts.reducedMotion || !prev.visible;
    this.velLon = this.velLat = 0;
    if (still) {
      next.material.opacity = 1;
      prev.visible = false;
      prev.material.opacity = 0;
      this.lon = targetLon;
      this.lat = 0;
      this.setFov(75);
      return;
    }
    // travelling: o olhar gira para o novo cômodo enquanto o zoom "entra" na cena
    this.lon = targetLon - 25;
    this.lat = 0;
    this.setFov(88);
    next.material.opacity = 0;
    prev.material.opacity = 1;
    await new Promise<void>((resolve) => {
      const s = { t: 0, lon: this.lon };
      gsap.to(s, {
        t: 1,
        lon: targetLon,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => {
          next.material.opacity = s.t;
          prev.material.opacity = 1 - Math.min(1, s.t * 1.4);
          this.lon = s.lon;
          this.setFov(88 - 13 * s.t);
        },
        onComplete: () => {
          prev.visible = false;
          prev.material.opacity = 0;
          resolve();
        },
      });
    });
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.idleSince = performance.now();
  }
  get isAutoRotating() {
    return this.autoRotate;
  }

  zoom(delta: number) {
    this.setFov(this.fov + delta);
  }

  /** gira o olhar (graus) — usado pelo teclado */
  turn(dLon: number, dLat = 0) {
    this.lon += dLon;
    this.lat = THREE.MathUtils.clamp(this.lat + dLat, -85, 85);
    this.touch();
  }

  private setFov(v: number) {
    this.fov = THREE.MathUtils.clamp(v, 35, 95);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  private touch() {
    this.idleSince = performance.now();
    this.onInteract?.();
  }

  private bindControls() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      if (this.walking) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragging = true;
      this.velLon = this.velLat = 0;
      el.style.cursor = 'grabbing';
      this.touch();
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.setFov(this.fov * (pinch / d));
        pinch = d;
        return;
      }
      const k = this.fov / this.host.clientHeight;
      this.lon -= dx * k;
      this.lat = THREE.MathUtils.clamp(this.lat + dy * k, -85, 85);
      this.velLon = -dx * k * 60;
      this.velLat = dy * k * 60;
      this.touch();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      if (!pointers.size) {
        this.dragging = false;
        el.style.cursor = 'grab';
      }
    };
    const wheel = (e: WheelEvent) => {
      // pinça no trackpad chega como wheel com ctrlKey: sempre é zoom
      if (this.opts.wheelZoom === false && !e.ctrlKey) return;
      e.preventDefault();
      this.setFov(this.fov + e.deltaY * 0.04);
      this.touch();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    this.cleanup.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    });
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private sync() {
    const on = this.visible && !document.hidden;
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

    if (!this.dragging) {
      // inércia depois de soltar
      this.lon += this.velLon * dt;
      this.lat = THREE.MathUtils.clamp(this.lat + this.velLat * dt, -85, 85);
      const damp = Math.pow(0.02, dt);
      this.velLon *= damp;
      this.velLat *= damp;
      if (this.autoRotate && !this.walking && !this.opts.reducedMotion && now - this.idleSince > (this.opts.autoDelay ?? 3500)) {
        this.lon += 4 * dt;
        this.lat *= 1 - Math.min(1, dt * 0.8);
      }
    }
    const phi = THREE.MathUtils.degToRad(90 - this.lat);
    const theta = THREE.MathUtils.degToRad(this.lon);
    this.camera.lookAt(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta),
    );
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  };

  dispose() {
    this.alive = false;
    this.token++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    this.spheres.forEach((s) => {
      s.material.map?.dispose();
      s.material.dispose();
    });
    this.geometry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
