import * as THREE from 'three';

interface MeshOpts {
  cast?: boolean;
  receive?: boolean;
}

const M = (color: number, roughness = 0.85, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => ({
  color,
  roughness,
  metalness,
  ...extra,
});

/** Materiais nomeados do bairro (paleta quente de fim de tarde). */
const MATERIALS = {
  concrete: M(0xb5b0a6, 0.9),
  concreteDark: M(0x7d7a75, 0.9),
  plaster: M(0xf1ece2),
  plasterWarm: M(0xe6d2b0),
  plasterTerra: M(0xc98a62),
  plasterCool: M(0xdadde1),
  slate: M(0x30363b, 0.7),
  charcoal: M(0x22272b, 0.6, 0.15),
  brick: M(0x9e4f37, 0.95),
  roofTile: M(0xa8452d, 0.8),
  thatch: M(0x8a6d3b, 1),
  wood: M(0xa0703f, 0.6),
  woodDark: M(0x5b3d28, 0.6),
  frame: M(0x1b2024, 0.5, 0.3),
  glass: M(0x9cc3dd, 0.05, 0.2, { transparent: true, opacity: 0.22, depthWrite: false }),
  glassDark: M(0x243444, 0.08, 0.6),
  glassWarm: M(0xf3c78a, 0.5, 0, { emissive: 0xffb45a, emissiveIntensity: 0.85 }),
  white: M(0xfaf8f4, 0.7),
  brass: M(0xc9a15b, 0.3, 1),
  asphalt: M(0x33363b, 0.95),
  sidewalk: M(0xc9c2b4, 0.95),
  curb: M(0xa39c8f, 0.95),
  grass: M(0x77a05a, 1),
  grassDark: M(0x557f43, 1),
  leaf: M(0x3f7a4a, 0.85),
  leafLight: M(0x6a9c4c, 0.85),
  leafWarm: M(0xa0a548, 0.85),
  trunk: M(0x5e4632, 0.9),
  water: M(0x2b5b6b, 0.15, 0.2),
  pool: M(0x6fe0d0, 0.2, 0, { emissive: 0x2ec4b6, emissiveIntensity: 0.55 }),
  lampPost: M(0x2a2f33, 0.5, 0.4),
  lampGlow: M(0xfff1cf, 0.5, 0, { emissive: 0xffd68a, emissiveIntensity: 2.2 }),
  carRed: M(0xa12d2d, 0.3, 0.6),
  carBlue: M(0x25476b, 0.3, 0.6),
  carWhite: M(0xe9e9e6, 0.3, 0.5),
  carGray: M(0x646a70, 0.3, 0.6),
  tyre: M(0x101214, 0.8),
  flower: M(0xd8577a, 0.8),
  flowerY: M(0xe6b840, 0.8),
  hill: M(0x8a9a78, 1),
  hillFar: M(0xa7b3a6, 1),
  sign: M(0x1f3b33, 0.5),
  paintBlue: M(0xb9cbd8),
  paintSage: M(0xc4d0b8),
  paintYellow: M(0xf0dfa8),
  paintPink: M(0xe8c6bd),
  paintBrick: M(0xb06a52, 0.95),
  paintGrey: M(0xc9ccd0),
  roofGrey: M(0x59606a, 0.8),
  mail: M(0x2f6f9b, 0.5, 0.3),
  stripe: M(0xf4f1ea, 0.9),
} as const;

export type MatName = keyof typeof MATERIALS;

/**
 * Fábrica de geometrias/materiais compartilhados. Tudo passa por `track()`,
 * então `disposeAll()` libera a GPU de uma vez.
 */
export class Kit {
  private geos = new Map<string, THREE.BufferGeometry>();
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private tracked: { dispose(): void }[] = [];

  track<T extends { dispose(): void }>(o: T): T {
    this.tracked.push(o);
    return o;
  }

  /** Material nomeado (criado uma vez). */
  m(name: MatName): THREE.MeshStandardMaterial {
    let mat = this.mats.get(name);
    if (!mat) {
      mat = this.track(new THREE.MeshStandardMaterial(MATERIALS[name]));
      this.mats.set(name, mat);
    }
    return mat;
  }

  private geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let g = this.geos.get(key) as T | undefined;
    if (!g) {
      g = make();
      this.geos.set(key, g);
      this.track(g);
    }
    return g;
  }

  box(w: number, h: number, d: number) {
    return this.geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  cyl(rt: number, rb: number, h: number, seg = 16) {
    return this.geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  }
  sphere(r: number, ws = 14, hs = 10) {
    return this.geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  }
  plane(w: number, h: number) {
    return this.geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
  }
  circle(r: number, seg = 32) {
    return this.geo(`o${r},${seg}`, () => new THREE.CircleGeometry(r, seg));
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, { cast = true, receive = true }: MeshOpts = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  /** Caixa posicionada pelo centro. */
  b(w: number, h: number, d: number, mat: MatName | THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, opts?: MeshOpts) {
    return this.mesh(this.box(w, h, d), typeof mat === 'string' ? this.m(mat) : mat, x, y, z, parent, opts);
  }

  group(parent: THREE.Object3D, x = 0, y = 0, z = 0, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  }

  canvasTexture(w: number, h: number) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas, ctx, tex };
  }

  disposeAll() {
    this.tracked.forEach((o) => o.dispose());
    this.tracked = [];
    this.geos.clear();
    this.mats.clear();
  }
}
