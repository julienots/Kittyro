import * as THREE from 'three';
import { mb, ModelBuilder } from './Builder';
import type { DecorDef } from '../data/decor';
import { treeGeo } from './Nature';
import type { Season } from '../state/types';

/**
 * Decorations & furniture. Models are centred on their footprint (w × d tiles).
 * `glow` holds parts that light up at night (bulbs, flames, crystals).
 */
export interface PropModel {
  geo: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
}

function darker(c: number, f = 0.8): number {
  return (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
}

const W = 0xb07a4a;

function flowerHead(b: ModelBuilder, x: number, y: number, z: number, c: number, s = 1): void {
  for (let i = 0; i < 5; i++) b.sphere(0.05 * s, c, { pos: [x + Math.sin(i * 1.256) * 0.06 * s, y, z + Math.cos(i * 1.256) * 0.06 * s], scale: [1, 0.5, 1] }, 5);
  b.sphere(0.035 * s, 0xffe27a, { pos: [x, y + 0.01, z] }, 5);
}

export function propModel(def: DecorDef, season: Season = 'summer'): PropModel {
  const b = mb();
  const g = mb();
  const { c1, c2 } = def;
  const [w, d] = def.size;
  switch (def.model) {
    case 'path':
      b.rbox(0.96, 0.05, 0.96, c1, { pos: [0, 0.02, 0] }, 0.6);
      for (let i = 0; i < 3; i++) b.rbox(0.36, 0.03, 0.3, c2, { pos: [-0.22 + (i % 2) * 0.42, 0.045, -0.25 + i * 0.25] }, 0.6);
      break;
    case 'bush':
      b.ico(0.38, [c2, c1], { pos: [0, 0.35, 0] }, 1);
      b.ico(0.22, c1, { pos: [0.22, 0.25, 0.15] }, 1);
      break;
    case 'hedge':
      b.rbox(0.92, 0.7, 0.92, [c2, c1], { pos: [0, 0.35, 0] }, 0.35);
      break;
    case 'pine':
      return { geo: treeGeo('tree_pine', season).clone().scale(0.75, 0.75, 0.75), glow: null };
    case 'birch':
      return { geo: treeGeo('tree_birch', season).clone().scale(0.8, 0.8, 0.8), glow: null };
    case 'tree_round': {
      b.cyl(0.1, 0.14, 0.9, c1, { pos: [0, 0.45, 0] }, 7);
      b.ico(0.55, [darker(c2, 0.9), c2], { pos: [0, 1.25, 0] }, 1);
      b.ico(0.35, c2, { pos: [0.35, 1.05, 0.15] }, 1);
      for (let i = 0; i < 8; i++) b.sphere(0.06, 0xffffff, { pos: [Math.sin(i * 2.3) * 0.5, 1.1 + (i % 3) * 0.2, Math.cos(i * 2.3) * 0.5] }, 5);
      break;
    }
    case 'rocks':
      b.dodeca(0.28, [c2, c1], { pos: [-0.1, 0.18, 0], scale: [1.2, 0.8, 1] });
      b.dodeca(0.18, c1, { pos: [0.22, 0.12, 0.15] });
      b.sphere(0.1, 0x6aa84f, { pos: [-0.1, 0.36, 0], scale: [1.5, 0.4, 1] }, 6);
      break;
    case 'stump':
      b.cyl(0.25, 0.3, 0.42, c1, { pos: [0, 0.21, 0] }, 9);
      b.cyl(0.24, 0.24, 0.02, c2, { pos: [0, 0.42, 0] }, 9);
      b.torus(0.13, 0.012, darker(c2, 0.85), { pos: [0, 0.432, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'logs':
      for (let i = 0; i < 3; i++) {
        b.cyl(0.16, 0.16, 1.6, c1, { pos: [-0.17 + i * 0.34, 0.16, 0], rot: [0, 0, Math.PI / 2] }, 8);
        b.cyl(0.14, 0.14, 0.02, c2, { pos: [0.81, 0.16, -0.17 + i * 0.34], rot: [0, 0, Math.PI / 2] }, 8);
      }
      b.cyl(0.16, 0.16, 1.6, c1, { pos: [0, 0.44, 0], rot: [0, 0, Math.PI / 2] }, 8);
      break;
    case 'shroom_ring':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = Math.sin(a) * 0.75, z = Math.cos(a) * 0.75;
        b.cyl(0.04, 0.05, 0.16, c2, { pos: [x, 0.08, z] }, 6);
        b.sphere(0.1, c1, { pos: [x, 0.17, z], scale: [1, 0.6, 1] }, 7);
      }
      break;
    case 'mini_pond':
      b.cyl(0.8, 0.85, 0.06, 0xb0aaa0, { pos: [0, 0.03, 0] }, 14);
      b.cyl(0.7, 0.7, 0.03, c1, { pos: [0, 0.07, 0] }, 14);
      b.cyl(0.15, 0.15, 0.02, 0x5aa84a, { pos: [0.2, 0.09, 0.1] }, 8);
      b.sphere(0.07, c2, { pos: [0.2, 0.13, 0.1] }, 6);
      for (let i = 0; i < 10; i++) b.dodeca(0.12, i % 2 ? 0xb0aaa0 : 0x9a948a, { pos: [Math.sin(i * 0.63) * 0.82, 0.08, Math.cos(i * 0.63) * 0.82], scale: [1, 0.6, 1] });
      break;
    case 'pot_flowers':
      b.lathe([[0, 0], [0.16, 0], [0.2, 0.28], [0.22, 0.3], [0, 0.3]], c1, {}, 10);
      b.sphere(0.18, 0x5cb85c, { pos: [0, 0.34, 0], scale: [1, 0.5, 1] }, 8);
      flowerHead(b, 0.06, 0.42, 0.04, c2);
      flowerHead(b, -0.07, 0.4, -0.04, 0xffffff);
      break;
    case 'planter':
      b.box(1.6, 0.35, 0.5, c1, { pos: [0, 0.18, 0] });
      b.box(1.5, 0.05, 0.4, 0x6a4a32, { pos: [0, 0.36, 0] });
      for (let i = 0; i < 6; i++) flowerHead(b, -0.6 + i * 0.24, 0.48, (i % 2) * 0.1 - 0.05, [c2, 0xff6a8a, 0xffffff][i % 3]);
      break;
    case 'flowerbed':
      b.sphere(0.42, c2, { pos: [0, 0.05, 0], scale: [1, 0.3, 1] }, 9);
      for (let i = 0; i < 9; i++) flowerHead(b, Math.sin(i * 2.4) * 0.3, 0.18 + (i % 2) * 0.05, Math.cos(i * 2.4) * 0.3, c1, 1.1);
      break;
    case 'arch':
      for (const sx of [-0.85, 0.85]) b.box(0.1, 1.8, 0.1, c1, { pos: [sx, 0.9, 0] });
      b.torus(0.85, 0.05, c1, { pos: [0, 1.8, 0] }, Math.PI);
      for (let i = 0; i < 16; i++) {
        const a = (i / 15) * Math.PI;
        b.sphere(0.12, i % 2 ? 0x4f9a46 : c2, { pos: [Math.cos(a) * 0.85, 1.8 + Math.sin(a) * 0.85, 0.05] }, 6);
      }
      for (let i = 0; i < 6; i++) b.sphere(0.11, c2, { pos: [(i % 2 ? 0.85 : -0.85), 0.4 + i * 0.25, 0.06] }, 6);
      break;
    case 'sunflowers':
      for (let i = 0; i < 3; i++) {
        const x = -0.6 + i * 0.6;
        b.cyl(0.02, 0.025, 1.1, c2, { pos: [x, 0.55, 0] }, 5);
        for (let k = 0; k < 8; k++) b.sphere(0.07, c1, { pos: [x + Math.sin(k * 0.785) * 0.13, 1.15 + Math.cos(k * 0.785) * 0.13, 0.04], scale: [0.6, 0.6, 0.3] }, 5);
        b.cyl(0.09, 0.09, 0.04, 0x6a4a2a, { pos: [x, 1.15, 0.06], rot: [Math.PI / 2, 0, 0] }, 8);
      }
      break;
    case 'bench':
      b.box(1.7, 0.07, 0.45, c1, { pos: [0, 0.42, 0] });
      b.box(1.7, 0.35, 0.06, c1, { pos: [0, 0.65, -0.2], rot: [-0.15, 0, 0] });
      for (const sx of [-0.75, 0.75]) {
        b.box(0.07, 0.42, 0.45, c2, { pos: [sx, 0.21, 0] });
        b.box(0.07, 0.07, 0.4, c2, { pos: [sx, 0.55, 0.02] });
      }
      break;
    case 'picnic':
      b.box(1.6, 0.07, 0.9, c1, { pos: [0, 0.65, 0] });
      b.box(1.62, 0.02, 0.92, 0xffffff, { pos: [0, 0.69, 0] });
      for (let i = 0; i < 4; i++) b.box(0.4, 0.021, 0.92, c2, { pos: [-0.6 + i * 0.4, 0.7, 0] });
      for (const sz of [-0.7, 0.7]) b.box(1.6, 0.06, 0.3, c1, { pos: [0, 0.38, sz] });
      for (const sx of [-0.6, 0.6]) b.box(0.07, 0.7, 1.6, darker(c1), { pos: [sx, 0.35, 0], rot: [0, 0, 0] });
      b.rbox(0.3, 0.2, 0.22, 0xc8925a, { pos: [0.3, 0.8, 0] }, 0.3);
      break;
    case 'parasol':
      b.cyl(0.03, 0.03, 1.8, 0xeeeeee, { pos: [0, 0.9, 0] });
      for (let i = 0; i < 8; i++) b.cone(0.75, 0.4, i % 2 ? c1 : c2, { pos: [0, 1.85, 0], rot: [0, (i * Math.PI) / 4, 0] }, 2);
      b.cone(0.75, 0.38, c1, { pos: [0, 1.86, 0] }, 8);
      b.cyl(0.25, 0.3, 0.1, 0x8a8a8a, { pos: [0, 0.05, 0] }, 10);
      break;
    case 'hammock':
      for (const sx of [-1.3, 1.3]) {
        b.cyl(0.1, 0.12, 1.4, c1, { pos: [sx, 0.7, 0] }, 7);
        b.ico(0.45, [0x4f9e46, 0x7ccf5a], { pos: [sx, 1.6, 0] }, 1);
      }
      for (let i = 0; i < 9; i++) b.box(0.28, 0.04, 0.6, i % 2 ? c2 : 0xffffff, { pos: [-1.0 + i * 0.25, 0.65 - Math.sin((i / 8) * Math.PI) * 0.25, 0] });
      break;
    case 'chair':
      b.box(0.45, 0.06, 0.45, c1, { pos: [0, 0.42, 0] });
      b.box(0.45, 0.45, 0.06, c1, { pos: [0, 0.68, -0.2] });
      for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) b.box(0.05, 0.42, 0.05, darker(c1), { pos: [sx, 0.21, sz] });
      b.rbox(0.4, 0.06, 0.4, c2, { pos: [0, 0.47, 0] }, 0.5);
      break;
    case 'well':
      b.cyl(0.6, 0.65, 0.6, [darker(c1, 0.8), c1], { pos: [0, 0.3, 0] }, 12);
      b.cyl(0.5, 0.5, 0.05, 0x3a5a6a, { pos: [0, 0.55, 0] }, 12);
      for (const sx of [-0.55, 0.55]) b.box(0.08, 1.2, 0.08, W, { pos: [sx, 1.0, 0] });
      b.roof(1.4, 0.45, 0.9, c2, { pos: [0, 1.55, 0] }, 0.1);
      b.cyl(0.04, 0.04, 1.1, W, { pos: [0, 1.25, 0], rot: [0, 0, Math.PI / 2] });
      b.cyl(0.12, 0.1, 0.18, 0x8a8a9a, { pos: [0, 0.95, 0] }, 8);
      break;
    case 'mailbox':
      b.cyl(0.04, 0.04, 0.9, c2, { pos: [0, 0.45, 0] });
      b.rbox(0.3, 0.26, 0.45, c1, { pos: [0, 0.98, 0] }, 0.5);
      b.box(0.04, 0.2, 0.03, 0xffd03a, { pos: [0.17, 1.1, 0], rot: [0, 0, 0.3] });
      break;
    case 'birdhouse':
      b.cyl(0.04, 0.04, 1.2, c2, { pos: [0, 0.6, 0] });
      b.box(0.3, 0.32, 0.3, c1, { pos: [0, 1.32, 0] });
      b.roof(0.32, 0.18, 0.32, 0xc8463a, { pos: [0, 1.48, 0] }, 0.06);
      b.cyl(0.05, 0.05, 0.02, 0x2a2020, { pos: [0, 1.35, 0.16], rot: [Math.PI / 2, 0, 0] }, 8);
      break;
    case 'doghouse':
      b.box(0.75, 0.55, 0.7, c2, { pos: [0, 0.28, 0] });
      b.roof(0.75, 0.35, 0.7, c1, { pos: [0, 0.55, 0] }, 0.1);
      b.cyl(0.18, 0.18, 0.02, 0x2a2020, { pos: [0, 0.25, 0.36], rot: [Math.PI / 2, 0, 0] }, 10);
      b.box(0.36, 0.18, 0.02, 0x2a2020, { pos: [0, 0.12, 0.36] });
      break;
    case 'gazebo':
      b.cyl(1.4, 1.45, 0.15, 0xd8c8a8, { pos: [0, 0.08, 0] }, 8);
      for (let i = 0; i < 8; i++) b.cyl(0.05, 0.05, 1.7, c1, { pos: [Math.sin((i * Math.PI) / 4) * 1.25, 0.95, Math.cos((i * Math.PI) / 4) * 1.25] }, 6);
      b.cone(1.6, 0.9, c2, { pos: [0, 2.2, 0] }, 8);
      b.sphere(0.1, 0xffd03a, { pos: [0, 2.7, 0] });
      g.sphere(0.12, 0xfff0a0, { pos: [0, 1.65, 0] });
      break;
    case 'mini_windmill':
      b.cyl(0.18, 0.28, 1.0, c1, { pos: [0, 0.5, 0] }, 8);
      b.cone(0.3, 0.3, c2, { pos: [0, 1.15, 0] }, 8);
      for (let i = 0; i < 4; i++) b.box(0.08, 0.6, 0.02, 0xfff4e0, { pos: [Math.sin((i * Math.PI) / 2) * 0.3, 0.9 + Math.cos((i * Math.PI) / 2) * 0.3, 0.3], rot: [0, 0, -(i * Math.PI) / 2] });
      break;
    case 'fountain':
      b.cyl(0.85, 0.9, 0.35, [darker(c1), c1], { pos: [0, 0.17, 0] }, 14);
      b.cyl(0.75, 0.75, 0.04, c2, { pos: [0, 0.33, 0] }, 14);
      b.cyl(0.12, 0.18, 0.6, c1, { pos: [0, 0.6, 0] }, 8);
      b.cyl(0.35, 0.25, 0.12, c1, { pos: [0, 0.92, 0] }, 10);
      b.sphere(0.1, c2, { pos: [0, 1.08, 0], scale: [1, 1.8, 1] });
      break;
    case 'statue':
      b.box(0.55, 0.35, 0.55, c2, { pos: [0, 0.17, 0] });
      b.sphere(0.25, c1, { pos: [0, 0.6, 0], scale: [1, 0.9, 1.1] }, 10);
      b.sphere(0.17, c1, { pos: [0, 0.9, 0.08] }, 10);
      b.capsule(0.05, 0.22, c1, { pos: [-0.07, 1.15, 0.05] });
      b.capsule(0.05, 0.22, c1, { pos: [0.07, 1.15, 0.05] });
      break;
    case 'fence':
      for (const sx of [-0.42, 0.42]) b.box(0.09, 0.62, 0.09, c1, { pos: [sx, 0.31, 0] });
      b.cone(0.07, 0.1, c1, { pos: [-0.42, 0.67, 0] }, 4);
      b.cone(0.07, 0.1, c1, { pos: [0.42, 0.67, 0] }, 4);
      b.box(1.0, 0.07, 0.05, c2, { pos: [0, 0.45, 0] });
      b.box(1.0, 0.07, 0.05, c2, { pos: [0, 0.22, 0] });
      break;
    case 'wall_stone':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) b.rbox(0.48, 0.24, 0.4, k % 2 ? c1 : c2, { pos: [-0.26 + i * 0.26 + (k % 2) * 0.12, 0.12 + k * 0.24, 0], rot: [0, i * 0.2, 0] }, 0.4);
      b.sphere(0.12, 0x6aa84f, { pos: [0.2, 0.52, 0], scale: [1.6, 0.4, 1] }, 6);
      break;
    case 'gate':
      for (const sx of [-0.45, 0.45]) b.box(0.12, 0.8, 0.12, c2, { pos: [sx, 0.4, 0] });
      for (let i = 0; i < 4; i++) b.box(0.08, 0.5, 0.04, c1, { pos: [-0.27 + i * 0.18, 0.4, 0] });
      b.box(0.8, 0.06, 0.05, c1, { pos: [0, 0.55, 0] });
      b.box(0.8, 0.06, 0.05, c1, { pos: [0, 0.25, 0] });
      break;
    case 'haybale':
      b.cyl(0.38, 0.38, 0.75, [darker(c1, 0.9), c1], { pos: [0, 0.38, 0], rot: [0, 0, Math.PI / 2] }, 12);
      b.torus(0.38, 0.02, darker(c2, 0.8), { pos: [0.2, 0.38, 0], rot: [0, Math.PI / 2, 0] });
      b.torus(0.38, 0.02, darker(c2, 0.8), { pos: [-0.2, 0.38, 0], rot: [0, Math.PI / 2, 0] });
      break;
    case 'barrel':
      b.lathe([[0, 0], [0.28, 0], [0.33, 0.35], [0.28, 0.7], [0, 0.7]], c1, {}, 12);
      b.torus(0.31, 0.02, c2, { pos: [0, 0.18, 0], rot: [Math.PI / 2, 0, 0] });
      b.torus(0.31, 0.02, c2, { pos: [0, 0.52, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'crates':
      b.box(0.55, 0.45, 0.55, c1, { pos: [-0.1, 0.23, 0] });
      b.box(0.4, 0.35, 0.4, c1, { pos: [0.12, 0.63, 0.05], rot: [0, 0.4, 0] });
      b.box(0.57, 0.06, 0.57, c2, { pos: [-0.1, 0.23, 0] });
      b.sphere(0.08, 0xe85a5a, { pos: [0.1, 0.85, 0.05] });
      b.sphere(0.08, 0x8ad07a, { pos: [0.2, 0.84, -0.05] });
      break;
    case 'cart':
      b.box(1.4, 0.35, 0.8, c1, { pos: [0, 0.6, 0] });
      for (const sx of [-0.45, 0.45]) b.cyl(0.32, 0.32, 0.08, c2, { pos: [sx, 0.32, 0.45], rot: [Math.PI / 2, 0, 0] }, 10);
      b.cyl(0.03, 0.03, 1.0, W, { pos: [0.9, 0.55, 0], rot: [0, 0, 1.2] });
      for (let i = 0; i < 5; i++) b.sphere(0.13, [0xff8c1a, 0xe85a5a, 0xffd03a][i % 3], { pos: [-0.4 + i * 0.2, 0.85, (i % 2) * 0.2 - 0.1] }, 7);
      break;
    case 'scarecrow':
      b.cyl(0.04, 0.04, 1.5, W, { pos: [0, 0.75, 0] });
      b.cyl(0.03, 0.03, 1.0, W, { pos: [0, 1.05, 0], rot: [0, 0, Math.PI / 2] });
      b.sphere(0.25, c2, { pos: [0, 0.95, 0], scale: [1, 1.2, 0.7] }, 10);
      b.sphere(0.2, 0xf4e6c8, { pos: [0, 1.4, 0] }, 10);
      b.cyl(0.35, 0.35, 0.03, c1, { pos: [0, 1.55, 0] }, 12);
      b.cyl(0.15, 0.18, 0.18, c1, { pos: [0, 1.63, 0] }, 10);
      b.sphere(0.03, 0x2a1e1a, { pos: [-0.07, 1.43, 0.18] });
      b.sphere(0.03, 0x2a1e1a, { pos: [0.07, 1.43, 0.18] });
      for (const sx of [-0.5, 0.5]) b.cone(0.06, 0.15, c1, { pos: [sx, 1.05, 0], rot: [0, 0, sx > 0 ? -1.5 : 1.5] }, 5);
      break;
    case 'sign':
      b.cyl(0.04, 0.04, 0.9, c1, { pos: [0, 0.45, 0] });
      b.rbox(0.7, 0.4, 0.05, c2, { pos: [0, 0.85, 0] }, 0.3);
      b.box(0.55, 0.05, 0.06, darker(c1), { pos: [0, 0.9, 0] });
      b.box(0.4, 0.05, 0.06, darker(c1), { pos: [0, 0.8, 0] });
      break;
    case 'wheelbarrow':
      b.lathe([[0, 0], [0.3, 0.02], [0.38, 0.25]], c1, { pos: [0, 0.3, 0], scale: [1, 1, 1.4] }, 8);
      b.cyl(0.15, 0.15, 0.06, 0x3a3a3a, { pos: [0, 0.15, 0.5], rot: [0, 0, Math.PI / 2] }, 10);
      for (const sx of [-0.2, 0.2]) b.cyl(0.025, 0.025, 0.7, c2, { pos: [sx, 0.4, -0.45], rot: [1.2, 0, 0] });
      b.sphere(0.2, 0x6a4a32, { pos: [0, 0.48, 0], scale: [1.2, 0.4, 1.5] }, 8);
      break;
    case 'lamp_post':
      b.cyl(0.05, 0.08, 2.0, c1, { pos: [0, 1.0, 0] }, 8);
      b.cyl(0.18, 0.2, 0.12, c1, { pos: [0, 0.06, 0] }, 8);
      b.cone(0.22, 0.2, c1, { pos: [0, 2.32, 0] }, 6);
      g.cyl(0.13, 0.1, 0.26, c2, { pos: [0, 2.1, 0] }, 6);
      break;
    case 'lantern':
      b.cyl(0.04, 0.05, 1.4, c1, { pos: [0, 0.7, 0] }, 6);
      b.box(0.4, 0.04, 0.04, c1, { pos: [0.15, 1.38, 0] });
      b.box(0.18, 0.04, 0.18, 0x3a3a3a, { pos: [0.3, 1.25, 0] });
      b.box(0.18, 0.04, 0.18, 0x3a3a3a, { pos: [0.3, 1.0, 0] });
      g.box(0.13, 0.2, 0.13, c2, { pos: [0.3, 1.12, 0] });
      break;
    case 'string_lights':
      for (const sx of [-0.9, 0.9]) b.cyl(0.04, 0.04, 1.6, c1, { pos: [sx, 0.8, 0] }, 6);
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = -0.9 + t * 1.8, y = 1.55 - Math.sin(t * Math.PI) * 0.3;
        g.sphere(0.05, [0xfff0a0, 0xffb8d8, 0xa8e8ff][i % 3], { pos: [x, y - 0.06, 0] }, 6);
        b.box(0.2, 0.01, 0.01, 0x3a3a3a, { pos: [x, y, 0], rot: [0, 0, (t - 0.5) * -1.2] });
      }
      break;
    case 'torch':
      b.cyl(0.035, 0.045, 1.1, c1, { pos: [0, 0.55, 0] }, 6);
      b.cyl(0.08, 0.06, 0.15, 0x5a4a3a, { pos: [0, 1.12, 0] }, 6);
      g.cone(0.08, 0.22, c2, { pos: [0, 1.3, 0] }, 6);
      break;
    case 'crystal':
      b.dodeca(0.22, 0x8a8a98, { pos: [0, 0.12, 0], scale: [1, 0.6, 1] });
      for (let i = 0; i < 4; i++) g.cone(0.08, 0.5 + (i % 2) * 0.2, i % 2 ? c1 : c2, { pos: [Math.sin(i * 1.6) * 0.08, 0.35, Math.cos(i * 1.6) * 0.08], rot: [Math.cos(i * 1.6) * 0.3, 0, -Math.sin(i * 1.6) * 0.3] }, 6);
      break;
    case 'glow_shrooms':
      for (let i = 0; i < 4; i++) {
        const x = Math.sin(i * 1.7) * 0.2, z = Math.cos(i * 1.7) * 0.2, s = 0.7 + (i % 2) * 0.5;
        b.cyl(0.03 * s, 0.04 * s, 0.25 * s, c2, { pos: [x, 0.12 * s, z] }, 6);
        g.sphere(0.12 * s, c1, { pos: [x, 0.26 * s, z], scale: [1, 0.55, 1] }, 8);
      }
      break;
    case 'fairy_ring':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.sphere(0.07, [c1, c2][i % 2], { pos: [Math.sin(a) * 0.8, 0.08, Math.cos(a) * 0.8] }, 6);
        b.sphere(0.12, 0x6aa84f, { pos: [Math.sin(a + 0.3) * 0.8, 0.02, Math.cos(a + 0.3) * 0.8], scale: [1, 0.3, 1] }, 6);
      }
      g.sphere(0.06, 0xffffff, { pos: [0, 0.6, 0] }, 6);
      break;
    case 'moon_statue':
      b.box(0.5, 0.3, 0.5, 0xc8c0b8, { pos: [0, 0.15, 0] });
      b.cyl(0.12, 0.16, 0.6, c1, { pos: [0, 0.6, 0] }, 8);
      g.torus(0.25, 0.08, c2, { pos: [0, 1.15, 0], rot: [0, 0, 0.6] }, Math.PI * 1.3);
      break;
    case 'star_lantern':
      b.cyl(0.03, 0.04, 1.1, 0x5a4a3a, { pos: [0, 0.55, 0] });
      g.ico(0.2, c1, { pos: [0, 1.25, 0], scale: [1, 1, 0.4] }, 0);
      break;
    case 'beach_chair':
      for (let i = 0; i < 5; i++) b.box(0.6, 0.04, 0.3, i % 2 ? c1 : c2, { pos: [0, 0.32 + (i > 2 ? (i - 2) * 0.2 : 0), -0.6 + i * 0.3], rot: [i > 2 ? -0.7 : 0, 0, 0] });
      for (const sx of [-0.28, 0.28]) b.box(0.04, 0.3, 1.2, 0xffffff, { pos: [sx, 0.16, -0.1] });
      break;
    case 'sandcastle':
      b.cyl(0.4, 0.45, 0.25, c1, { pos: [0, 0.12, 0] }, 10);
      for (let i = 0; i < 4; i++) b.cyl(0.1, 0.12, 0.45, c1, { pos: [Math.sin(i * 1.57) * 0.3, 0.45, Math.cos(i * 1.57) * 0.3] }, 8);
      b.cyl(0.16, 0.18, 0.6, c1, { pos: [0, 0.55, 0] }, 8);
      b.box(0.01, 0.15, 0.15, c2, { pos: [0, 1.0, 0.07] });
      b.cyl(0.01, 0.01, 0.25, 0x8a5a3a, { pos: [0, 0.95, 0] });
      break;
    case 'surfboard':
      b.capsule(0.22, 1.1, c1, { pos: [0, 0.8, 0], rot: [0.15, 0, 0], scale: [1, 1, 0.15] });
      b.box(0.08, 1.2, 0.03, c2, { pos: [0, 0.8, 0.04], rot: [0.15, 0, 0] });
      b.dodeca(0.15, 0xe8d8a8, { pos: [0, 0.1, -0.1], scale: [1.4, 0.6, 1] });
      break;
    case 'palm':
      return { geo: treeGeo('tree_palm', season).clone().scale(0.75, 0.75, 0.75), glow: null };
    case 'shell_lamp':
      b.cyl(0.04, 0.06, 0.9, 0xd8c8a8, { pos: [0, 0.45, 0] }, 6);
      g.sphere(0.22, c1, { pos: [0, 1.0, 0], scale: [1, 0.7, 0.6] }, 10);
      for (let i = 0; i < 5; i++) b.box(0.015, 0.25, 0.02, darker(c1, 0.85), { pos: [-0.12 + i * 0.06, 1.0, 0.13], rot: [0, 0, (i - 2) * 0.25] });
      break;
    case 'snowman':
      b.sphere(0.35, 0xffffff, { pos: [0, 0.32, 0] }, 12);
      b.sphere(0.25, 0xffffff, { pos: [0, 0.78, 0] }, 12);
      b.sphere(0.18, 0xffffff, { pos: [0, 1.12, 0] }, 12);
      b.cone(0.04, 0.2, c2, { pos: [0, 1.12, 0.25], rot: [Math.PI / 2, 0, 0] }, 6);
      b.sphere(0.025, 0x2a2a2a, { pos: [-0.07, 1.18, 0.15] });
      b.sphere(0.025, 0x2a2a2a, { pos: [0.07, 1.18, 0.15] });
      b.torus(0.17, 0.05, 0xe85a5a, { pos: [0, 0.97, 0], rot: [Math.PI / 2, 0, 0] });
      b.cyl(0.14, 0.16, 0.2, 0x2a2a3a, { pos: [0, 1.36, 0] }, 10);
      for (let i = 0; i < 3; i++) b.sphere(0.03, 0x2a2a2a, { pos: [0, 0.65 + i * 0.12, 0.24] });
      break;
    case 'xmas_tree':
      b.cyl(0.08, 0.1, 0.3, 0x8a5a3a, { pos: [0, 0.15, 0] });
      for (let i = 0; i < 3; i++) b.cone(0.55 - i * 0.14, 0.65, c1, { pos: [0, 0.55 + i * 0.4, 0] }, 9);
      for (let i = 0; i < 12; i++) g.sphere(0.05, [0xff5a5a, 0xffd03a, 0x6ad8ff][i % 3], { pos: [Math.sin(i * 2.4) * (0.45 - (i / 12) * 0.3), 0.45 + (i / 12) * 1.0, Math.cos(i * 2.4) * (0.45 - (i / 12) * 0.3)] }, 6);
      g.ico(0.12, c2, { pos: [0, 1.65, 0] }, 0);
      break;
    case 'sled':
      b.box(0.5, 0.06, 1.0, c2, { pos: [0, 0.25, 0] });
      for (const sx of [-0.22, 0.22]) b.torus(0.15, 0.025, c1, { pos: [sx, 0.15, 0.45], rot: [0, Math.PI / 2, 0] }, Math.PI);
      for (const sx of [-0.22, 0.22]) b.box(0.04, 0.04, 1.0, c1, { pos: [sx, 0.03, 0] });
      break;
    case 'ice_sculpture':
      b.box(0.5, 0.2, 0.5, 0xd8e8f8, { pos: [0, 0.1, 0] });
      g.ico(0.3, c1, { pos: [0, 0.5, 0], scale: [1, 1.4, 0.8] }, 1);
      g.cone(0.1, 0.3, c2, { pos: [0, 0.95, 0] }, 6);
      break;
    case 'jack':
      for (let i = 0; i < 6; i++) b.sphere(0.2, c1, { pos: [Math.sin(i * 1.047) * 0.13, 0.22, Math.cos(i * 1.047) * 0.13], scale: [0.85, 1, 0.85] }, 8);
      b.cyl(0.03, 0.04, 0.12, 0x5a7a3a, { pos: [0, 0.48, 0] }, 5);
      g.cone(0.06, 0.08, c2, { pos: [-0.08, 0.27, 0.3], rot: [Math.PI / 2, 0, 0] }, 3);
      g.cone(0.06, 0.08, c2, { pos: [0.08, 0.27, 0.3], rot: [Math.PI / 2, 0, 0] }, 3);
      g.box(0.18, 0.04, 0.04, c2, { pos: [0, 0.14, 0.31] });
      break;
    case 'cauldron':
      b.lathe([[0, 0], [0.3, 0.05], [0.35, 0.3], [0.28, 0.45], [0.3, 0.48]], c1, { pos: [0, 0.1, 0] }, 12);
      for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.15, c1, { pos: [Math.sin(i * 2.1) * 0.22, 0.07, Math.cos(i * 2.1) * 0.22] });
      g.cyl(0.27, 0.27, 0.03, c2, { pos: [0, 0.52, 0] }, 12);
      break;
    case 'ghost':
      b.cyl(0.005, 0.005, 0.8, 0xdddddd, { pos: [0, 0.4, 0] });
      b.sphere(0.3, c1, { pos: [0, 1.0, 0], scale: [1, 1.2, 1] }, 12);
      b.sphere(0.05, c2, { pos: [-0.1, 1.05, 0.27] });
      b.sphere(0.05, c2, { pos: [0.1, 1.05, 0.27] });
      b.sphere(0.04, 0xff9aa8, { pos: [0, 0.92, 0.28] });
      b.box(0.15, 0.08, 0.15, 0x8a5a3a, { pos: [0, 0.04, 0] });
      break;
    case 'candles':
      for (let i = 0; i < 4; i++) {
        const h = 0.2 + (i % 3) * 0.12;
        b.cyl(0.05, 0.05, h, c1, { pos: [Math.sin(i * 1.6) * 0.15, h / 2, Math.cos(i * 1.6) * 0.15] }, 8);
        g.cone(0.025, 0.07, c2, { pos: [Math.sin(i * 1.6) * 0.15, h + 0.04, Math.cos(i * 1.6) * 0.15] }, 5);
      }
      break;
    case 'rainbow': {
      const cols = [0xff6a6a, 0xffb04a, 0xffe05a, 0x7ad87a, 0x6ab8ff, 0xb08ae8];
      cols.forEach((c, i) => b.torus(1.5 - i * 0.1, 0.05, c, { pos: [0, 0, 0] }, Math.PI));
      b.sphere(0.35, 0xffffff, { pos: [-1.3, 0.15, 0], scale: [1.3, 0.8, 0.8] }, 8);
      b.sphere(0.35, 0xffffff, { pos: [1.3, 0.15, 0], scale: [1.3, 0.8, 0.8] }, 8);
      break;
    }
    case 'balloons':
      b.box(0.15, 0.1, 0.15, 0x8a5a3a, { pos: [0, 0.05, 0] });
      for (let i = 0; i < 5; i++) {
        const x = Math.sin(i * 1.3) * 0.25, z = Math.cos(i * 1.3) * 0.2, y = 1.2 + (i % 3) * 0.2;
        b.cyl(0.004, 0.004, y, 0xdddddd, { pos: [x / 2, y / 2, z / 2], rot: [z * 0.3, 0, -x * 0.3] });
        b.sphere(0.16, [c1, c2, 0xffd03a, 0x8ad07a, 0xb08ae8][i], { pos: [x, y + 0.1, z], scale: [1, 1.15, 1] }, 10);
      }
      break;
    case 'flags':
      for (const sx of [-0.9, 0.9]) b.cyl(0.04, 0.04, 1.5, W, { pos: [sx, 0.75, 0] }, 6);
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7;
        b.cone(0.1, 0.22, [c1, c2, 0x6ad8ff, 0x8ad07a][i % 4], { pos: [-0.9 + t * 1.8, 1.32 - Math.sin(t * Math.PI) * 0.22, 0], rot: [0, 0, Math.PI] }, 3);
      }
      break;
    case 'pinwheel':
      b.cyl(0.025, 0.025, 1.0, 0xffffff, { pos: [0, 0.5, 0] });
      for (let i = 0; i < 4; i++) b.cone(0.14, 0.3, i % 2 ? c1 : c2, { pos: [Math.sin((i * Math.PI) / 2) * 0.14, 1.05 + Math.cos((i * Math.PI) / 2) * 0.14, 0.03], rot: [0, 0, -(i * Math.PI) / 2] }, 3);
      break;
    case 'candy_lamp':
      b.cyl(0.05, 0.05, 1.2, 0xffffff, { pos: [0, 0.6, 0] }, 8);
      for (let i = 0; i < 6; i++) b.torus(0.055, 0.012, c1, { pos: [0, 0.15 + i * 0.18, 0], rot: [Math.PI / 2 - 0.4, 0, 0] });
      g.sphere(0.2, c2, { pos: [0, 1.32, 0] }, 10);
      break;
    // ---------------- furniture ----------------
    case 'bed':
    case 'bunk':
    case 'bed_canopy': {
      const L = d * 0.95, Wd = w * 0.9;
      b.box(Wd, 0.3, L, c1, { pos: [0, 0.2, 0] });
      b.rbox(Wd - 0.08, 0.18, L - 0.1, 0xffffff, { pos: [0, 0.42, 0.02] }, 0.4);
      b.rbox(Wd - 0.04, 0.12, L * 0.6, c2, { pos: [0, 0.5, L * 0.18] }, 0.5);
      b.rbox(Wd * 0.4, 0.14, 0.35, 0xfff8f0, { pos: [-Wd * 0.22, 0.56, -L / 2 + 0.3] }, 0.6);
      if (w > 2.5) b.rbox(Wd * 0.4, 0.14, 0.35, 0xfff8f0, { pos: [Wd * 0.22, 0.56, -L / 2 + 0.3] }, 0.6);
      b.box(Wd + 0.1, 0.8, 0.1, c1, { pos: [0, 0.45, -L / 2] });
      if (def.model === 'bunk') {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, 1.7, 0.08, c1, { pos: [sx * Wd / 2, 0.85, sz * L / 2] });
        b.box(Wd, 0.2, L, c1, { pos: [0, 1.15, 0] });
        b.rbox(Wd - 0.08, 0.15, L - 0.1, 0x9ad87a, { pos: [0, 1.32, 0] }, 0.4);
      }
      if (def.model === 'bed_canopy') {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.04, 0.04, 2.0, c1, { pos: [sx * Wd / 2, 1.0, sz * L / 2] }, 6);
        b.box(Wd + 0.1, 0.06, L + 0.1, c2, { pos: [0, 2.0, 0] });
        for (const sx of [-1, 1]) b.box(0.03, 1.2, L * 0.4, c2, { pos: [sx * Wd / 2, 1.4, -L * 0.3] });
      }
      break;
    }
    case 'nightstand':
      b.rbox(0.6, 0.55, 0.5, c1, { pos: [0, 0.28, 0] }, 0.2);
      b.box(0.5, 0.18, 0.02, darker(c1), { pos: [0, 0.32, 0.26] });
      b.sphere(0.03, 0xffd03a, { pos: [0, 0.32, 0.28] });
      b.cyl(0.08, 0.1, 0.1, 0xe8e0d0, { pos: [0.12, 0.6, 0] }, 8);
      g.sphere(0.1, c2, { pos: [0.12, 0.74, 0], scale: [1, 0.8, 1] }, 8);
      break;
    case 'wardrobe':
      b.rbox(1.6, 1.9, 0.6, c1, { pos: [0, 0.95, 0] }, 0.15);
      b.box(0.02, 1.7, 0.02, c2, { pos: [0, 0.95, 0.31] });
      for (const sx of [-0.1, 0.1]) b.sphere(0.035, 0xffd03a, { pos: [sx, 1.0, 0.32] });
      b.box(1.7, 0.08, 0.66, c2, { pos: [0, 1.92, 0] });
      break;
    case 'bookshelf':
      b.box(1.6, 1.8, 0.45, c1, { pos: [0, 0.9, 0] });
      for (let r = 0; r < 4; r++) {
        b.box(1.5, 0.04, 0.4, darker(c1, 0.85), { pos: [0, 0.2 + r * 0.42, 0.03] });
        for (let i = 0; i < 9; i++) b.box(0.12, 0.3 + (i % 3) * 0.03, 0.3, [c2, 0x6a9ad8, 0x8ad07a, 0xffd03a, 0xb08ae8][(i + r) % 5], { pos: [-0.6 + i * 0.15, 0.37 + r * 0.42, 0.06], rot: [0, 0, i % 4 === 3 ? 0.2 : 0] });
      }
      break;
    case 'dresser':
      b.rbox(1.5, 0.85, 0.5, c1, { pos: [0, 0.43, 0] }, 0.15);
      for (let r = 0; r < 3; r++) for (const sx of [-0.36, 0.36]) {
        b.box(0.66, 0.22, 0.02, darker(c1, 0.93), { pos: [sx, 0.18 + r * 0.25, 0.26] });
        b.sphere(0.03, c2, { pos: [sx, 0.18 + r * 0.25, 0.28] });
      }
      break;
    case 'chest':
      b.rbox(0.8, 0.45, 0.5, c1, { pos: [0, 0.23, 0] }, 0.25);
      b.box(0.82, 0.06, 0.52, c2, { pos: [0, 0.38, 0] });
      b.sphere(0.07, 0xff6a8a, { pos: [0.2, 0.5, 0] });
      b.box(0.12, 0.15, 0.12, 0xffd03a, { pos: [-0.2, 0.5, 0] });
      break;
    case 'table_round':
      b.cyl(0.85, 0.85, 0.08, c1, { pos: [0, 0.72, 0] }, 16);
      b.cyl(0.88, 0.88, 0.03, c2, { pos: [0, 0.77, 0] }, 16);
      b.cyl(0.08, 0.1, 0.7, darker(c1), { pos: [0, 0.35, 0] }, 8);
      b.cyl(0.35, 0.4, 0.05, darker(c1), { pos: [0, 0.03, 0] }, 12);
      b.cyl(0.08, 0.06, 0.15, 0xffffff, { pos: [0.2, 0.86, 0.1] }, 8);
      g.sphere(0.04, 0xfff0a0, { pos: [0.2, 0.97, 0.1] });
      break;
    case 'table_long':
      b.box(2.7, 0.1, 1.6, c1, { pos: [0, 0.72, 0] });
      b.box(2.5, 0.02, 0.5, c2, { pos: [0, 0.78, 0] });
      for (const sx of [-1.2, 1.2]) for (const sz of [-0.65, 0.65]) b.box(0.1, 0.7, 0.1, darker(c1), { pos: [sx, 0.35, sz] });
      for (let i = 0; i < 3; i++) b.cyl(0.13, 0.1, 0.05, 0xffffff, { pos: [-0.8 + i * 0.8, 0.8, 0] }, 10);
      break;
    case 'desk':
      b.box(1.7, 0.08, 0.8, c1, { pos: [0, 0.74, 0] });
      b.box(0.5, 0.7, 0.75, c1, { pos: [0.55, 0.35, 0] });
      b.box(0.08, 0.7, 0.75, c1, { pos: [-0.8, 0.35, 0] });
      b.box(0.45, 0.04, 0.3, c2, { pos: [-0.2, 0.8, 0.1] });
      b.cyl(0.05, 0.05, 0.3, 0x3a3a3a, { pos: [-0.6, 0.93, -0.2] });
      g.cone(0.13, 0.12, 0xfff0c0, { pos: [-0.6, 1.1, -0.15] }, 8);
      break;
    case 'coffee_table':
      b.rbox(1.6, 0.08, 0.75, c1, { pos: [0, 0.4, 0] }, 0.3);
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.3, 0.3]) b.cyl(0.04, 0.04, 0.38, c2, { pos: [sx, 0.19, sz] }, 6);
      b.cyl(0.07, 0.05, 0.1, 0xffffff, { pos: [0.3, 0.49, 0] }, 8);
      break;
    case 'armchair':
      b.rbox(0.9, 0.4, 0.85, c1, { pos: [0, 0.3, 0] }, 0.4);
      b.rbox(0.9, 0.6, 0.25, c1, { pos: [0, 0.7, -0.32] }, 0.5);
      for (const sx of [-0.42, 0.42]) b.rbox(0.18, 0.3, 0.8, darker(c1, 0.92), { pos: [sx, 0.55, 0] }, 0.5);
      b.rbox(0.6, 0.12, 0.6, c2, { pos: [0, 0.54, 0.05] }, 0.5);
      break;
    case 'sofa':
      b.rbox(2.7, 0.4, 0.85, c1, { pos: [0, 0.3, 0] }, 0.4);
      b.rbox(2.7, 0.6, 0.25, c1, { pos: [0, 0.7, -0.32] }, 0.5);
      for (const sx of [-1.28, 1.28]) b.rbox(0.2, 0.32, 0.85, darker(c1, 0.92), { pos: [sx, 0.55, 0] }, 0.5);
      for (const sx of [-0.62, 0.62]) b.rbox(1.15, 0.12, 0.62, c2, { pos: [sx, 0.55, 0.05] }, 0.5);
      b.rbox(0.35, 0.3, 0.12, 0xffd03a, { pos: [-0.9, 0.75, -0.15], rot: [0.2, 0.3, 0.1] }, 0.6);
      break;
    case 'beanbag':
      b.sphere(0.45, c1, { pos: [0, 0.3, 0], scale: [1, 0.7, 1] }, 12);
      b.sphere(0.28, darker(c1, 0.92), { pos: [0, 0.45, -0.18], scale: [1.2, 0.8, 0.6] }, 10);
      break;
    case 'stove':
      b.rbox(0.9, 0.9, 0.7, c1, { pos: [0, 0.45, 0] }, 0.15);
      b.box(0.92, 0.04, 0.72, c2, { pos: [0, 0.9, 0] });
      for (const sx of [-0.2, 0.2]) for (const sz of [-0.15, 0.15]) b.cyl(0.11, 0.11, 0.02, 0x2a2a2a, { pos: [sx, 0.93, sz] }, 10);
      b.box(0.6, 0.4, 0.02, 0x3a3a3a, { pos: [0, 0.4, 0.36] });
      g.box(0.45, 0.2, 0.02, 0xffa03a, { pos: [0, 0.36, 0.37] });
      b.cyl(0.14, 0.12, 0.18, 0xe85a4a, { pos: [0.2, 1.03, 0.15] }, 10);
      break;
    case 'fridge':
      b.rbox(0.85, 1.8, 0.7, c1, { pos: [0, 0.9, 0] }, 0.2);
      b.box(0.86, 0.03, 0.72, darker(c1), { pos: [0, 1.15, 0] });
      for (const y of [0.7, 1.45]) b.box(0.05, 0.25, 0.05, c2, { pos: [0.33, y, 0.36] });
      b.sphere(0.05, 0xff6a8a, { pos: [-0.2, 1.4, 0.36] });
      break;
    case 'counter':
      b.box(0.95, 0.85, 0.7, c2, { pos: [0, 0.43, 0] });
      b.box(1.0, 0.07, 0.75, c1, { pos: [0, 0.89, 0] });
      b.box(0.8, 0.6, 0.02, darker(c2), { pos: [0, 0.42, 0.36] });
      b.cyl(0.1, 0.12, 0.12, 0xd8b07a, { pos: [-0.2, 0.98, 0] }, 8);
      b.sphere(0.08, 0xe85a4a, { pos: [0.2, 0.97, 0.1] });
      break;
    case 'sink':
      b.box(0.95, 0.85, 0.7, c1, { pos: [0, 0.43, 0] });
      b.box(1.0, 0.07, 0.75, 0xe8e8e8, { pos: [0, 0.89, 0] });
      b.box(0.55, 0.05, 0.45, c2, { pos: [0, 0.91, 0.03] });
      b.torus(0.12, 0.025, 0xb8c2cc, { pos: [0, 1.02, -0.25], rot: [0, Math.PI / 2, 0] }, Math.PI);
      break;
    case 'fireplace':
      b.box(1.8, 1.3, 0.5, c1, { pos: [0, 0.65, 0] });
      b.box(1.0, 0.7, 0.1, 0x2a2020, { pos: [0, 0.4, 0.22] });
      b.box(2.0, 0.1, 0.6, 0x8a5a3a, { pos: [0, 1.32, 0] });
      for (let i = 0; i < 3; i++) b.cyl(0.06, 0.06, 0.5, 0x8a5a3a, { pos: [0, 0.12, 0.2], rot: [0, i, Math.PI / 2] });
      g.cone(0.18, 0.4, c2, { pos: [-0.12, 0.35, 0.22] }, 6);
      g.cone(0.14, 0.3, 0xffd03a, { pos: [0.14, 0.3, 0.22] }, 6);
      break;
    case 'piano':
      b.box(1.6, 1.1, 0.6, c1, { pos: [0, 0.55, -0.1] });
      b.box(1.5, 0.08, 0.35, c1, { pos: [0, 0.72, 0.3] });
      b.box(1.4, 0.04, 0.25, c2, { pos: [0, 0.77, 0.32] });
      for (let i = 0; i < 9; i++) b.box(0.05, 0.03, 0.14, 0x1a1a1a, { pos: [-0.6 + i * 0.15, 0.8, 0.28] });
      for (const sx of [-0.65, 0.65]) b.box(0.08, 0.7, 0.08, c1, { pos: [sx, 0.35, 0.38] });
      break;
    case 'aquarium':
      b.box(1.6, 0.6, 0.5, 0x8a5a3a, { pos: [0, 0.3, 0] });
      g.box(1.5, 0.7, 0.45, c1, { pos: [0, 0.95, 0] });
      b.sphere(0.07, c2, { pos: [-0.3, 1.0, 0.1], scale: [1.4, 1, 0.5] });
      b.sphere(0.06, 0xffd03a, { pos: [0.3, 0.85, 0.05], scale: [1.4, 1, 0.5] });
      for (let i = 0; i < 4; i++) b.box(0.03, 0.3, 0.03, 0x3a8a4a, { pos: [-0.6 + i * 0.4, 0.75, -0.1], rot: [0, 0, 0.2] });
      break;
    case 'pet_bed':
      b.torus(0.32, 0.12, c1, { pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
      b.cyl(0.32, 0.32, 0.08, c2, { pos: [0, 0.06, 0] }, 12);
      break;
    case 'globe':
      b.cyl(0.15, 0.2, 0.1, c2, { pos: [0, 0.05, 0] }, 8);
      b.cyl(0.03, 0.03, 0.5, c2, { pos: [0, 0.3, 0] });
      b.sphere(0.25, c1, { pos: [0, 0.75, 0] }, 12);
      b.sphere(0.12, 0x6ac85a, { pos: [0.1, 0.82, 0.16], scale: [1.4, 1, 0.6] });
      b.torus(0.28, 0.015, c2, { pos: [0, 0.75, 0], rot: [0, 0.4, 0.3] });
      break;
    case 'radio':
      b.cyl(0.08, 0.08, 0.3, 0x8a5a3a, { pos: [0, 0.15, 0] });
      b.rbox(0.55, 0.38, 0.28, c1, { pos: [0, 0.5, 0] }, 0.5);
      b.cyl(0.11, 0.11, 0.02, c2, { pos: [-0.12, 0.5, 0.14], rot: [Math.PI / 2, 0, 0] }, 12);
      b.box(0.15, 0.08, 0.02, 0xfff0c0, { pos: [0.13, 0.55, 0.15] });
      break;
    case 'vase':
      b.lathe([[0, 0], [0.12, 0], [0.18, 0.15], [0.1, 0.35], [0.12, 0.42]], c1, {}, 10);
      for (let i = 0; i < 5; i++) {
        b.cyl(0.01, 0.01, 0.35, 0x4f9e46, { pos: [Math.sin(i * 1.3) * 0.05, 0.55, Math.cos(i * 1.3) * 0.05], rot: [Math.cos(i * 1.3) * 0.3, 0, Math.sin(i * 1.3) * 0.3] }, 4);
        flowerHead(b, Math.sin(i * 1.3) * 0.12, 0.74, Math.cos(i * 1.3) * 0.12, [c2, 0xffffff, 0xffd03a][i % 3], 0.9);
      }
      break;
    case 'teddy':
      b.sphere(0.28, c1, { pos: [0, 0.3, 0] }, 12);
      b.sphere(0.2, c1, { pos: [0, 0.68, 0.02] }, 12);
      for (const sx of [-0.14, 0.14]) b.sphere(0.07, c1, { pos: [sx, 0.85, 0] });
      b.sphere(0.09, c2, { pos: [0, 0.63, 0.18], scale: [1.2, 0.8, 0.6] });
      b.sphere(0.025, 0x2a1e1a, { pos: [-0.07, 0.72, 0.18] });
      b.sphere(0.025, 0x2a1e1a, { pos: [0.07, 0.72, 0.18] });
      b.sphere(0.1, c1, { pos: [-0.25, 0.35, 0.1] });
      b.sphere(0.1, c1, { pos: [0.25, 0.35, 0.1] });
      b.torus(0.12, 0.03, 0xe85a5a, { pos: [0, 0.52, 0.04], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'rug_round':
      b.cyl(Math.min(w, d) * 0.48, Math.min(w, d) * 0.48, 0.03, c1, { pos: [0, 0.015, 0] }, 20);
      b.torus(Math.min(w, d) * 0.38, 0.03, c2, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0] });
      b.cyl(Math.min(w, d) * 0.2, Math.min(w, d) * 0.2, 0.035, c2, { pos: [0, 0.02, 0] }, 14);
      break;
    case 'rug_square':
      b.box(w * 0.94, 0.03, d * 0.92, c1, { pos: [0, 0.015, 0] });
      b.box(w * 0.8, 0.035, d * 0.75, c2, { pos: [0, 0.02, 0] });
      b.box(w * 0.6, 0.04, d * 0.5, c1, { pos: [0, 0.022, 0] });
      break;
    case 'floor_lamp':
      b.cyl(0.18, 0.2, 0.05, c1, { pos: [0, 0.03, 0] }, 10);
      b.cyl(0.025, 0.025, 1.5, c1, { pos: [0, 0.78, 0] }, 6);
      g.cyl(0.15, 0.25, 0.3, c2, { pos: [0, 1.55, 0] }, 10);
      break;
    case 'shroom_lamp':
      b.cyl(0.08, 0.12, 0.4, 0xfff0e0, { pos: [0, 0.2, 0] }, 8);
      g.sphere(0.28, c1, { pos: [0, 0.45, 0], scale: [1, 0.6, 1] }, 12);
      for (let i = 0; i < 5; i++) b.sphere(0.045, 0xffffff, { pos: [Math.sin(i * 1.3) * 0.2, 0.56, Math.cos(i * 1.3) * 0.2] }, 5);
      break;
    case 'plant_tall':
      b.lathe([[0, 0], [0.18, 0], [0.22, 0.35], [0, 0.35]], c1, {}, 10);
      for (let i = 0; i < 7; i++) b.sphere(0.2, [c2, darker(c2, 0.85)][i % 2], { pos: [Math.sin(i * 0.9) * 0.15, 0.6 + i * 0.12, Math.cos(i * 0.9) * 0.15], rot: [Math.cos(i) * 0.6, i, Math.sin(i) * 0.6], scale: [1.3, 0.25, 0.6] }, 6);
      break;
    case 'plant_small':
      b.lathe([[0, 0], [0.12, 0], [0.14, 0.2], [0, 0.2]], c1, {}, 10);
      b.ico(0.16, [darker(c2), c2], { pos: [0, 0.32, 0] }, 1);
      break;
    case 'cactus':
      b.lathe([[0, 0], [0.16, 0], [0.18, 0.25], [0, 0.25]], c1, {}, 10);
      b.capsule(0.11, 0.35, c2, { pos: [0, 0.55, 0] });
      b.capsule(0.06, 0.15, c2, { pos: [0.14, 0.6, 0], rot: [0, 0, -0.4] });
      b.sphere(0.05, 0xff8ab8, { pos: [0, 0.82, 0] });
      break;
    case 'painting':
      b.box(0.8, 0.6, 0.05, c1, { pos: [0, 1.4, -0.45] });
      b.box(0.68, 0.48, 0.02, c2, { pos: [0, 1.4, -0.42] });
      b.sphere(0.1, 0xffffff, { pos: [0.15, 1.5, -0.41], scale: [1.5, 0.6, 0.2] });
      b.sphere(0.06, 0xffd03a, { pos: [-0.2, 1.55, -0.41], scale: [1, 1, 0.2] });
      break;
    case 'clock':
      b.cyl(0.25, 0.25, 0.06, c1, { pos: [0, 1.6, -0.45], rot: [Math.PI / 2, 0, 0] }, 16);
      b.cyl(0.21, 0.21, 0.02, c2, { pos: [0, 1.6, -0.41], rot: [Math.PI / 2, 0, 0] }, 16);
      b.box(0.02, 0.15, 0.01, 0x2a2a2a, { pos: [0, 1.66, -0.4] });
      b.box(0.1, 0.02, 0.01, 0x2a2a2a, { pos: [0.04, 1.6, -0.4] });
      break;
    case 'wall_shelf':
      b.box(0.9, 0.05, 0.25, c1, { pos: [0, 1.3, -0.38] });
      b.cyl(0.07, 0.06, 0.12, c2, { pos: [-0.25, 1.39, -0.38] }, 8);
      b.ico(0.08, 0x6ab85a, { pos: [-0.25, 1.5, -0.38] }, 0);
      b.box(0.12, 0.18, 0.12, 0xe85a5a, { pos: [0.1, 1.42, -0.38] });
      b.box(0.1, 0.15, 0.12, 0x6a9ad8, { pos: [0.24, 1.4, -0.38] });
      break;
    case 'window':
      b.box(0.85, 0.85, 0.06, c1, { pos: [0, 1.35, -0.46] });
      g.box(0.7, 0.7, 0.02, 0xc8e8ff, { pos: [0, 1.35, -0.43] });
      b.box(0.04, 0.7, 0.03, c1, { pos: [0, 1.35, -0.42] });
      b.box(0.7, 0.04, 0.03, c1, { pos: [0, 1.35, -0.42] });
      b.box(0.9, 0.14, 0.2, 0x8a5a3a, { pos: [0, 0.92, -0.38] });
      for (let i = 0; i < 4; i++) flowerHead(b, -0.3 + i * 0.2, 1.03, -0.36, [c2, 0xffd03a][i % 2]);
      break;
    case 'mirror':
      b.box(0.6, 1.0, 0.05, c1, { pos: [0, 1.3, -0.45] });
      g.box(0.48, 0.88, 0.02, c2, { pos: [0, 1.3, -0.42] });
      break;
    default:
      b.rbox(0.6, 0.6, 0.6, c1, { pos: [0, 0.3, 0] }, 0.3);
  }
  return { geo: b.build(), glow: g.parts.length ? g.build() : null };
}
