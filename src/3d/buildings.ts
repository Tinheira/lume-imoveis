import * as THREE from 'three';
import type { Kit } from './kit';

/**
 * Cada construção é modelada com a fachada no plano z = 0 virada para +z (a rua),
 * ocupando z < 0 para dentro do terreno. A porta fica em x = 0.
 */
export interface Built {
  /** folhas da porta (pivôs) para a animação de entrada */
  doors: { left: THREE.Object3D; right: THREE.Object3D };
  /** altura útil para enquadrar a câmera */
  height: number;
  /** funções chamadas a cada frame (animações leves) */
  tick: ((t: number) => void)[];
}

type Parent = THREE.Object3D;

function door(kit: Kit, parent: Parent, mat: 'wood' | 'glassDark' | 'charcoal' = 'wood', w = 1.9, h = 2.5, z = 0.06) {
  const half = w / 2;
  const leaf = (side: -1 | 1) => {
    const pivot = kit.group(parent, side * half, 0, z);
    const dir = -side;
    const panel = kit.group(pivot);
    kit.b(half - 0.04, h, 0.07, mat, dir * (half / 2), h / 2, 0, panel);
    kit.b(0.05, 0.9, 0.05, 'brass', dir * (half - 0.2), h / 2, 0.06, panel);
    return pivot;
  };
  // vão escuro atrás da porta
  kit.b(w, h, 0.05, 'glassWarm', 0, h / 2, -0.04, parent, { cast: false });
  return { left: leaf(-1), right: leaf(1) };
}

/** Painel morno atrás do vidro: dá a impressão de uma casa iluminada por dentro. */
function glow(kit: Kit, parent: Parent, w: number, h: number, x: number, y: number, z: number) {
  kit.b(w, h, 0.05, 'glassWarm', x, y, z, parent, { cast: false, receive: false });
}

function windowGrid(kit: Kit, parent: Parent, cols: number, rows: number, x0: number, y0: number, dx: number, dy: number, z: number, w = 1.5, h = 1.5) {
  const frameGeo = kit.box(w + 0.14, h + 0.14, 0.08);
  const glassGeo = kit.box(w, h, 0.06);
  const frames = new THREE.InstancedMesh(frameGeo, kit.m('plaster'), cols * rows);
  const glass = new THREE.InstancedMesh(glassGeo, kit.m('glassDark'), cols * rows);
  const o = new THREE.Object3D();
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      o.position.set(x0 + c * dx, y0 + r * dy, z);
      o.updateMatrix();
      frames.setMatrixAt(n, o.matrix);
      o.position.z = z + 0.03;
      o.updateMatrix();
      glass.setMatrixAt(n, o.matrix);
      n++;
    }
  }
  frames.castShadow = true;
  parent.add(frames, glass);
}

function tree(kit: Kit, parent: Parent, x: number, z: number, s = 1, warm = false) {
  const g = kit.group(parent, x, 0, z);
  g.scale.setScalar(s);
  kit.mesh(kit.cyl(0.13, 0.2, 2.6, 8), kit.m('trunk'), 0, 1.3, 0, g);
  const crown = kit.mesh(kit.sphere(1.5, 12, 9), kit.m(warm ? 'leafWarm' : 'leaf'), 0, 3.5, 0, g, { receive: false });
  crown.scale.y = 1.15;
  kit.mesh(kit.sphere(1.05, 10, 8), kit.m('leafLight'), 0.7, 4.2, 0.3, g, { receive: false });
  return g;
}

function palm(kit: Kit, parent: Parent, x: number, z: number, h = 6) {
  const g = kit.group(parent, x, 0, z);
  const trunk = kit.mesh(kit.cyl(0.14, 0.24, h, 8), kit.m('trunk'), 0, h / 2, 0, g);
  trunk.rotation.z = 0.06;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const frond = kit.mesh(kit.box(0.35, 0.05, 3.1), kit.m(i % 2 ? 'leaf' : 'leafLight'), Math.cos(a) * 1.35, h + 0.05, Math.sin(a) * 1.35, g, { receive: false });
    frond.rotation.set(0, -a + Math.PI / 2, 0);
    frond.rotateX(-0.35);
  }
  return g;
}

function path(kit: Kit, parent: Parent, from: number, to: number, w = 1.4) {
  const n = Math.ceil((to - from) / 0.9);
  for (let i = 0; i < n; i++) kit.b(w, 0.05, 0.6, 'sidewalk', 0, 0.03, from + i * 0.9 + 0.3, parent, { cast: false });
}

function hedge(kit: Kit, parent: Parent, x: number, z: number, w: number, d = 0.7, h = 0.9) {
  kit.b(w, h, d, 'leaf', x, h / 2, z, parent, { receive: false });
}

// ─────────────────────────────────────────────────────────────
// 1. Casa contemporânea (concreto, vidro e espelho d'água)
// ─────────────────────────────────────────────────────────────
export function buildContemporanea(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(12, 3.4, 9, 'concrete', 0, 1.7, -4.5, g);
  glow(kit, g, 9.6, 2.8, 0, 1.55, -1.2);
  glow(kit, g, 6.4, 2.1, 1.5, 4.85, -1.0);
  // fachada envidraçada com montantes
  for (const sx of [-1, 1]) {
    kit.b(4.1, 2.9, 0.06, 'glass', sx * 3.0, 1.55, 0.03, g, { cast: false, receive: false });
    for (const x of [1.0, 2.05, 3.1, 4.15, 5.0]) kit.b(0.07, 2.9, 0.12, 'frame', sx * x, 1.55, 0.05, g);
  }
  kit.b(10.4, 0.1, 0.14, 'frame', 0, 3.02, 0.05, g);
  kit.b(10.4, 0.1, 0.14, 'frame', 0, 0.1, 0.05, g);
  for (const sx of [-1, 1]) kit.b(0.8, 3.4, 0.3, 'concreteDark', sx * 5.7, 1.7, 0.05, g);
  // volume superior em balanço com ripado de madeira
  kit.b(9, 3, 8.5, 'concrete', 1.5, 4.9, -3.0, g);
  kit.b(6.6, 2.2, 0.06, 'glass', 1.5, 4.85, 1.28, g, { cast: false, receive: false });
  for (let i = 0; i < 12; i++) kit.b(0.12, 2.7, 0.12, 'wood', -1.6 + i * 0.36, 4.85, 1.36, g);
  kit.b(9.4, 0.25, 9, 'white', 1.5, 6.5, -3.0, g);
  kit.b(3.4, 0.2, 3, 'concreteDark', -4.2, 3.55, 1.6, g); // marquise
  // espelho d'água com vitórias-régias
  kit.b(5.2, 0.06, 3.2, 'water', -3.6, 0.03, 3.4, g, { cast: false });
  for (const [x, z] of [[-5.2, 3.0], [-4, 4.1], [-2.6, 3.4], [-3.4, 2.6]]) {
    kit.mesh(kit.circle(0.32, 14), kit.m('leaf'), x, 0.075, z, g, { cast: false }).rotation.x = -Math.PI / 2;
    kit.mesh(kit.sphere(0.11, 8, 6), kit.m('flower'), x + 0.05, 0.11, z, g, { cast: false });
  }
  path(kit, g, 0.6, 5.5);
  tree(kit, g, 6.6, 3.2, 1.05);
  tree(kit, g, -7.2, 1.5, 0.9);
  hedge(kit, g, 4.2, 4.9, 4);
  return { doors: door(kit, g, 'glassDark', 1.9, 2.6), height: 7, tick };
}

// ─────────────────────────────────────────────────────────────
// 2. Villa com telhado de palha e piscina
// ─────────────────────────────────────────────────────────────
export function buildVilla(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(12, 3.1, 8.5, 'plasterWarm', 0, 1.55, -4.25, g);
  glow(kit, g, 10.2, 2.4, 0, 1.4, -1.0);
  kit.b(10.4, 2.5, 0.06, 'glass', 0, 1.4, 0.03, g, { cast: false, receive: false });
  for (let i = -5; i <= 5; i++) kit.b(0.06, 2.5, 0.1, 'woodDark', i * 0.95, 1.4, 0.06, g);
  kit.b(10.6, 0.1, 0.12, 'woodDark', 0, 2.68, 0.06, g);
  // telhado de palha em pirâmide
  const roof = kit.mesh(new THREE.ConeGeometry(10.6, 4.4, 4), kit.m('thatch'), 0, 5.2, -3.6, g, { receive: false });
  kit.track(roof.geometry);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.16, 1, 0.9);
  // varanda, colunas e deck
  kit.b(13, 0.16, 3.2, 'wood', 0, 0.08, 1.7, g);
  for (const x of [-5.6, -2.0, 2.0, 5.6]) kit.mesh(kit.cyl(0.12, 0.12, 3.1, 10), kit.m('woodDark'), x, 1.55, 2.6, g);
  kit.b(13.4, 0.18, 0.2, 'woodDark', 0, 3.1, 2.6, g);
  // piscina com borda
  kit.b(9.6, 0.4, 3.4, 'white', 0, 0.2, 4.1, g);
  kit.b(9.0, 0.06, 2.8, 'pool', 0, 0.41, 4.1, g, { cast: false });
  palm(kit, g, -7.5, 2.4, 6.2);
  palm(kit, g, 7.6, 1.6, 5.4);
  palm(kit, g, -8.6, -3.2, 7);
  tree(kit, g, 8.4, 4.6, 0.85);
  return { doors: door(kit, g, 'wood', 1.9, 2.4, 0.08), height: 6, tick };
}

// ─────────────────────────────────────────────────────────────
// 3. Torre com vista panorâmica
// ─────────────────────────────────────────────────────────────
export function buildTorreVista(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(10, 25, 9, 'plasterCool', 0, 12.5, -4.5, g);
  windowGrid(kit, g, 4, 9, -3.6, 6.3, 2.4, 2.4, 0.02, 1.5, 1.6);
  for (let r = 0; r < 9; r += 2) kit.b(9.8, 0.16, 1.3, 'white', 0, 5.2 + r * 2.4, 0.65, g);
  kit.b(0.5, 25, 0.3, 'concreteDark', -5, 12.5, 0.1, g);
  kit.b(0.5, 25, 0.3, 'concreteDark', 5, 12.5, 0.1, g);
  // térreo envidraçado com marquise
  glow(kit, g, 8.8, 3.6, 0, 1.9, -1.2);
  kit.b(9, 3.8, 0.06, 'glass', 0, 1.9, 0.05, g, { cast: false, receive: false });
  for (const x of [-4, -2, 0, 2, 4]) kit.b(0.08, 3.8, 0.12, 'frame', x, 1.9, 0.06, g);
  kit.b(6.5, 0.22, 3.4, 'charcoal', 0, 4.1, 1.7, g);
  kit.b(10.4, 0.5, 9.4, 'white', 0, 25.2, -4.5, g);
  kit.b(3, 0.9, 3, 'concreteDark', 2, 25.9, -5, g);
  hedge(kit, g, -3.6, 3.4, 3.4);
  hedge(kit, g, 3.6, 3.4, 3.4);
  tree(kit, g, -7.5, 3.5, 1);
  tree(kit, g, 7.5, 3.5, 1);
  return { doors: door(kit, g, 'glassDark', 2.2, 2.7, 0.08), height: 25, tick };
}

// ─────────────────────────────────────────────────────────────
// 4. Residencial verde (varandas com jardins)
// ─────────────────────────────────────────────────────────────
export function buildVerde(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(12, 17, 9, 'concrete', 0, 8.5, -4.5, g);
  const floors = 5;
  for (let f = 0; f < floors; f++) {
    const y = 4.6 + f * 2.7;
    kit.b(9.6, 2.1, 0.06, 'glassDark', 0, y + 0.1, 0.03, g);
    for (const x of [-3.2, 0, 3.2]) kit.b(0.1, 2.1, 0.1, 'frame', x, y + 0.1, 0.06, g);
    // varanda jardim
    kit.b(11.4, 0.22, 1.5, 'concreteDark', 0, y - 1.15, 0.75, g);
    kit.b(11.4, 0.55, 0.14, 'leaf', 0, y - 0.8, 1.45, g, { receive: false });
    for (let i = 0; i < 9; i++) {
      const bush = kit.mesh(kit.sphere(0.34, 8, 6), kit.m(i % 3 === 0 ? 'leafLight' : 'leaf'), -5 + i * 1.25, y - 0.5, 1.4, g, { receive: false });
      bush.scale.y = 1.2;
      if ((i + f) % 4 === 0) kit.mesh(kit.sphere(0.13, 6, 5), kit.m('flower'), -5 + i * 1.25, y - 0.1, 1.5, g, { cast: false });
    }
    if (f % 2 === 0) for (let i = 0; i < 5; i++) kit.b(0.16, 0.9 + (i % 2) * 0.5, 0.16, 'leafLight', -4.6 + i * 2.3, y - 1.5, 1.5, g, { receive: false });
  }
  kit.b(11.6, 0.6, 9.4, 'white', 0, 17.3, -4.5, g);
  kit.b(3.6, 3.2, 0.1, 'wood', -4.2, 1.6, 0.06, g);
  glow(kit, g, 4.8, 3.2, 2.2, 1.7, -1.0);
  kit.b(5, 3.4, 0.06, 'glass', 2.2, 1.7, 0.05, g, { cast: false, receive: false });
  kit.b(6.4, 0.2, 2.6, 'charcoal', 0, 3.6, 1.3, g);
  hedge(kit, g, -3, 4.2, 5);
  tree(kit, g, 7.4, 3.6, 1.1, true);
  tree(kit, g, -7.4, 3.2, 1);
  return { doors: door(kit, g, 'wood', 1.9, 2.5, 0.09), height: 17, tick };
}

// ─────────────────────────────────────────────────────────────
// 5. Torre central (duas lâminas com lobby de vidro)
// ─────────────────────────────────────────────────────────────
export function buildTorreCentral(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(9, 28, 9, 'slate', -2.6, 14, -4.5, g);
  kit.b(7.4, 18, 7.4, 'charcoal', 4.7, 9, -3.5, g);
  const fins = new THREE.InstancedMesh(kit.box(9.2, 0.14, 0.5), kit.m('white'), 12 + 8);
  const o = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < 12; i++) {
    o.position.set(-2.6, 5.4 + i * 2.1, 0.2);
    o.updateMatrix();
    fins.setMatrixAt(n++, o.matrix);
  }
  for (let i = 0; i < 8; i++) {
    o.position.set(4.7, 4.4 + i * 2.0, 0.28);
    o.scale.set(0.8, 1, 1);
    o.updateMatrix();
    fins.setMatrixAt(n++, o.matrix);
    o.scale.set(1, 1, 1);
  }
  parentAdd(g, fins);
  windowGrid(kit, g, 4, 11, -4.2, 5.8, 1.7, 2.1, 0.02, 1.2, 1.3);
  // lobby de vidro em duplo pé-direito
  glow(kit, g, 14.8, 4.4, 0, 2.3, -1.4);
  kit.b(15, 4.6, 0.06, 'glass', 0, 2.3, 0.6, g, { cast: false, receive: false });
  for (let x = -7; x <= 7; x += 2.33) kit.b(0.09, 4.6, 0.14, 'frame', x, 2.3, 0.62, g);
  kit.b(9, 0.25, 4, 'charcoal', 0, 4.8, 2.4, g);
  kit.b(0.5, 4.8, 0.5, 'concreteDark', -4.2, 2.4, 3.9, g);
  kit.b(0.5, 4.8, 0.5, 'concreteDark', 4.2, 2.4, 3.9, g);
  for (const x of [-2.4, 2.4]) {
    const cone = kit.mesh(kit.cyl(0.05, 0.55, 3.2, 8), kit.m('leaf'), x, 1.6, 4.3, g, { receive: false });
    cone.scale.set(1, 1, 1);
  }
  tree(kit, g, -8.2, 3, 0.95);
  tree(kit, g, 8.2, 3.5, 1);
  return { doors: door(kit, g, 'glassDark', 2.4, 2.8, 0.66), height: 27, tick };
}

function parentAdd(parent: Parent, obj: THREE.Object3D) {
  parent.add(obj);
}

// ─────────────────────────────────────────────────────────────
// 6. Casa minimalista
// ─────────────────────────────────────────────────────────────
export function buildMinimalista(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(15, 3.2, 9, 'slate', 0, 1.6, -4.5, g);
  kit.b(16.6, 0.36, 11.4, 'white', 0, 3.4, -4.0, g);
  glow(kit, g, 10.4, 2.5, -1.8, 1.4, -1.0);
  kit.b(10.6, 2.6, 0.06, 'glass', -1.8, 1.4, 0.03, g, { cast: false, receive: false });
  for (const x of [-7, -4.4, -1.8, 0.8, 3.4]) kit.b(0.08, 2.7, 0.12, 'frame', x, 1.4, 0.06, g);
  kit.b(10.7, 0.1, 0.12, 'frame', -1.8, 2.72, 0.06, g);
  kit.b(3.2, 3.2, 0.1, 'wood', 5.9, 1.6, 0.06, g);
  // jardim seco e gramado
  kit.b(15, 0.05, 4.4, 'grassDark', 0, 0.03, 3.2, g, { cast: false });
  path(kit, g, 0.6, 5.5, 1.6);
  for (let i = 0; i < 6; i++) kit.b(1.1, 0.06, 0.5, 'concrete', -6 + i * 2.4, 0.06, 4.6, g, { cast: false });
  hedge(kit, g, -5.5, 4.9, 4.2, 0.6, 0.7);
  hedge(kit, g, 5.5, 4.9, 4.2, 0.6, 0.7);
  palm(kit, g, -8.6, 2.2, 5);
  tree(kit, g, 8.6, 3, 0.9);
  // luminárias de jardim
  for (const x of [-3.2, 3.2]) {
    kit.b(0.06, 0.6, 0.06, 'lampPost', x, 0.3, 4.0, g);
    kit.mesh(kit.sphere(0.13, 8, 6), kit.m('lampGlow'), x, 0.68, 4.0, g, { cast: false });
  }
  return { doors: door(kit, g, 'wood', 1.9, 2.5, 0.1), height: 4, tick };
}

// ─────────────────────────────────────────────────────────────
// 7. Sobrado com telhado de duas águas
// ─────────────────────────────────────────────────────────────
export function buildSobrado(kit: Kit, g: Parent): Built {
  const tick: Built['tick'] = [];
  kit.b(10, 6, 8, 'plaster', 0, 3, -4, g);
  const shape = new THREE.Shape();
  shape.moveTo(-5.6, 0);
  shape.lineTo(5.6, 0);
  shape.lineTo(0, 3.6);
  shape.closePath();
  const roofGeo = kit.track(new THREE.ExtrudeGeometry(shape, { depth: 8.8, bevelEnabled: false }));
  const roof = new THREE.Mesh(roofGeo, kit.m('roofTile'));
  roof.position.set(0, 6, -8.4);
  roof.castShadow = true;
  g.add(roof);
  kit.b(10.4, 0.25, 0.3, 'white', 0, 6.05, 0.3, g);
  kit.b(0.9, 2.6, 0.9, 'brick', 3.4, 7.6, -5, g);
  // janelas com venezianas
  for (const x of [-3, 3]) {
    kit.b(1.7, 1.7, 0.1, 'white', x, 4.4, 0.02, g);
    kit.b(1.4, 1.4, 0.08, 'glassDark', x, 4.4, 0.06, g);
    kit.b(0.7, 1.5, 0.06, 'woodDark', x - 1.2, 4.4, 0.1, g);
    kit.b(0.7, 1.5, 0.06, 'woodDark', x + 1.2, 4.4, 0.1, g);
  }
  kit.b(2.2, 1.4, 0.08, 'glassDark', 0, 4.5, 0.05, g);
  kit.b(3.2, 2.5, 0.1, 'concrete', -3.3, 1.25, 0.06, g); // garagem
  kit.b(3.6, 0.16, 1.5, 'woodDark', 0, 3.1, 0.75, g); // marquise
  kit.b(0.1, 3, 0.1, 'woodDark', -1.6, 1.5, 1.4, g);
  kit.b(0.1, 3, 0.1, 'woodDark', 1.6, 1.5, 1.4, g);
  // cerca de madeira
  const pickets = new THREE.InstancedMesh(kit.box(0.14, 1.0, 0.06), kit.m('white'), 44);
  const o = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    o.position.set(-6.3 + i * 0.29, 0.5, 5.0);
    o.updateMatrix();
    pickets.setMatrixAt(i, o.matrix);
  }
  pickets.castShadow = true;
  g.add(pickets);
  kit.b(13, 0.08, 0.08, 'white', 0, 0.75, 5.0, g);
  path(kit, g, 0.6, 5.0);
  for (const x of [-2.6, 2.6]) {
    kit.b(1.4, 0.4, 0.4, 'woodDark', x, 0.2, 1.1, g);
    for (let i = 0; i < 4; i++) kit.mesh(kit.sphere(0.14, 6, 5), kit.m(i % 2 ? 'flower' : 'flowerY'), x - 0.5 + i * 0.33, 0.5, 1.1, g, { cast: false });
  }
  tree(kit, g, -8, 2.5, 1.05, true);
  tree(kit, g, 8, 3, 0.95);
  return { doors: door(kit, g, 'wood', 1.6, 2.4, 0.09), height: 9, tick };
}

export const builders = [buildContemporanea, buildVilla, buildTorreVista, buildVerde, buildTorreCentral, buildMinimalista, buildSobrado];

// ─────────────────────────────────────────────────────────────
// Casas de preenchimento: dão vida e escala à rua
// ─────────────────────────────────────────────────────────────
type Paint = 'paintBlue' | 'paintSage' | 'paintYellow' | 'paintPink' | 'paintBrick' | 'paintGrey' | 'plaster' | 'plasterWarm';
const PAINTS: Paint[] = ['paintBlue', 'paintSage', 'paintYellow', 'paintPink', 'paintBrick', 'paintGrey', 'plaster', 'plasterWarm'];

function emptyDoors(kit: Kit, parent: Parent) {
  return { left: kit.group(parent), right: kit.group(parent) };
}

function mailbox(kit: Kit, parent: Parent, x: number, z: number) {
  kit.b(0.08, 1.0, 0.08, 'lampPost', x, 0.5, z, parent);
  kit.b(0.4, 0.28, 0.28, 'mail', x, 1.12, z, parent);
}

/** variant: 0 = casa de duas águas, 1 = caixa moderna, 2 = sobradinho, 3 = prédio baixo de tijolos. */
export function buildFiller(kit: Kit, g: Parent, variant: number, seed: number): Built {
  const tick: Built['tick'] = [];
  const paint = PAINTS[(seed * 3 + variant) % PAINTS.length];
  const v = variant % 4;
  if (v === 0) {
    kit.b(10.4, 3.4, 8.4, paint, 0, 1.7, -4.2, g);
    const shape = new THREE.Shape();
    shape.moveTo(-5.5, 0);
    shape.lineTo(5.5, 0);
    shape.lineTo(0, 2.6);
    shape.closePath();
    const roofGeo = kit.track(new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false }));
    const roof = new THREE.Mesh(roofGeo, kit.m(seed % 2 ? 'roofTile' : 'roofGrey'));
    roof.position.set(0, 3.4, -8.6);
    roof.castShadow = true;
    g.add(roof);
    for (const x of [-3.2, 3.2]) {
      kit.b(1.5, 1.4, 0.1, 'white', x, 1.9, 0.04, g);
      kit.b(1.25, 1.15, 0.08, 'glassDark', x, 1.9, 0.08, g);
    }
    kit.b(3.4, 2.4, 0.1, 'paintGrey', -3.4, 1.2, 0.06, g); // garagem
    kit.b(2.4, 0.16, 1.2, 'woodDark', 1.4, 2.7, 0.6, g);
    glow(kit, g, 1.6, 2.2, 1.4, 1.1, -0.06);
  } else if (v === 1) {
    kit.b(11, 3.2, 8, paint, 0, 1.6, -4, g);
    kit.b(7.5, 3, 7, 'concrete', 1.6, 4.7, -3.5, g);
    kit.b(11.4, 0.22, 8.4, 'white', 0, 3.3, -4, g);
    kit.b(7.9, 0.22, 7.4, 'white', 1.6, 6.3, -3.5, g);
    kit.b(6.4, 2, 0.06, 'glassDark', 1.6, 4.7, 0.05, g);
    glow(kit, g, 6, 1.9, 1.6, 4.7, -0.5);
    kit.b(4.6, 2.5, 0.06, 'glass', -2.6, 1.4, 0.04, g, { cast: false, receive: false });
    glow(kit, g, 4.4, 2.3, -2.6, 1.4, -0.8);
  } else if (v === 2) {
    kit.b(9.4, 5.6, 7.6, paint, 0, 2.8, -3.8, g);
    const shape = new THREE.Shape();
    shape.moveTo(-5.2, 0);
    shape.lineTo(5.2, 0);
    shape.lineTo(0, 3);
    shape.closePath();
    const roofGeo = kit.track(new THREE.ExtrudeGeometry(shape, { depth: 8.4, bevelEnabled: false }));
    const roof = new THREE.Mesh(roofGeo, kit.m('roofTile'));
    roof.position.set(0, 5.6, -8);
    roof.castShadow = true;
    g.add(roof);
    for (const x of [-2.8, 2.8]) for (const y of [1.9, 4.2]) {
      kit.b(1.4, 1.5, 0.1, 'white', x, y, 0.04, g);
      kit.b(1.15, 1.25, 0.08, 'glassDark', x, y, 0.08, g);
    }
    kit.b(0.5, 2.4, 0.8, 'brick', 3.6, 6.4, -4, g);
    glow(kit, g, 1.7, 2.2, 0, 1.1, -0.06);
  } else {
    kit.b(11.4, 9.2, 8.6, 'paintBrick', 0, 4.6, -4.3, g);
    windowGrid(kit, g, 4, 3, -3.9, 3.0, 2.6, 2.7, 0.02, 1.35, 1.5);
    kit.b(11.8, 0.4, 9, 'white', 0, 9.3, -4.3, g);
    kit.b(4, 0.2, 2.2, 'charcoal', 0, 3.0, 1.1, g);
    glow(kit, g, 2.2, 2.4, 0, 1.2, -0.06);
  }
  // fechamento comum: cerca, caminho, árvore e caixa de correio
  path(kit, g, 0.4, 5.3, 1.3);
  if (seed % 3 === 0) {
    const pickets = new THREE.InstancedMesh(kit.box(0.12, 0.9, 0.06), kit.m('white'), 40);
    const o = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      o.position.set(-5.8 + i * 0.3, 0.45, 5.2);
      o.updateMatrix();
      pickets.setMatrixAt(i, o.matrix);
    }
    g.add(pickets);
  } else {
    hedge(kit, g, -3.6, 5.0, 5.2, 0.6, 0.8);
    hedge(kit, g, 3.6, 5.0, 5.2, 0.6, 0.8);
  }
  tree(kit, g, seed % 2 ? 6.2 : -6.2, 3.0 + (seed % 3), 0.9 + (seed % 3) * 0.1, seed % 4 === 0);
  mailbox(kit, g, seed % 2 ? -1.6 : 1.6, 5.6);
  return { doors: emptyDoors(kit, g), height: v === 3 ? 9 : v === 2 ? 8 : 5, tick };
}
