import * as THREE from 'three';
import { mb, ModelBuilder } from './Builder';
import { vcMat, outlineMat } from '../render/Materials';
import { blobShadowMat } from './Character';
import type { CreatureDef } from '../data/creatures';

/**
 * Toy-figurine animals: rounded bodies with tiny legs merged in, a separate head
 * and tail for expressive animation (pecking, wagging, sniffing...).
 */

export interface AnimalRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  tail: THREE.Group;
  eyes: THREE.Mesh | null;
  shadow: THREE.Mesh;
  height: number;
}

const EYE = 0x1e1614;

function eyes(b: ModelBuilder, x: number, y: number, z: number, r = 0.045): void {
  for (const sx of [-1, 1]) {
    b.sphere(r, EYE, { pos: [sx * x, y, z], scale: [1, 1.15, 0.6] }, 8);
    b.sphere(r * 0.38, 0xffffff, { pos: [sx * x + r * 0.3, y + r * 0.4, z + r * 0.45] }, 5);
  }
}
function blush(b: ModelBuilder, x: number, y: number, z: number, r = 0.04): void {
  for (const sx of [-1, 1]) b.sphere(r, 0xff9aa8, { pos: [sx * x, y, z], scale: [1.2, 0.7, 0.4] }, 6);
}
function legs4(b: ModelBuilder, w: number, d: number, h: number, r: number, color: number, y = 0): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(r, r * 0.9, h, color, { pos: [sx * w, y + h / 2, sz * d] }, 6);
}

function darker(c: number, f = 0.8): number {
  return (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
}

type Parts = { body: ModelBuilder; head: ModelBuilder; tail: ModelBuilder; headPos: [number, number, number]; tailPos: [number, number, number]; height: number };

function speciesParts(species: string, c: number): Parts {
  const body = mb(), head = mb(), tail = mb();
  const pink = 0xffb3c1;
  switch (species) {
    case 'chicken': {
      body.sphere(0.28, c, { pos: [0, 0.32, 0], scale: [1, 0.95, 1.1] }, 12);
      body.sphere(0.14, darker(c, 0.92), { pos: [-0.24, 0.34, -0.02], scale: [0.5, 1, 1.3] });
      body.sphere(0.14, darker(c, 0.92), { pos: [0.24, 0.34, -0.02], scale: [0.5, 1, 1.3] });
      body.cyl(0.025, 0.025, 0.14, 0xffa02a, { pos: [-0.09, 0.07, 0] });
      body.cyl(0.025, 0.025, 0.14, 0xffa02a, { pos: [0.09, 0.07, 0] });
      head.sphere(0.17, c, {}, 12);
      head.cone(0.05, 0.1, 0xffa02a, { pos: [0, -0.02, 0.17], rot: [Math.PI / 2, 0, 0] });
      head.sphere(0.06, 0xe83a3a, { pos: [0, 0.16, 0.02], scale: [0.6, 1, 1.2] });
      head.sphere(0.035, 0xe83a3a, { pos: [0, -0.08, 0.13] });
      eyes(head, 0.075, 0.03, 0.13, 0.035);
      tail.cone(0.1, 0.18, darker(c, 0.9), { rot: [-0.8, 0, 0] });
      return { body, head, tail, headPos: [0, 0.6, 0.12], tailPos: [0, 0.42, -0.28], height: 0.8 };
    }
    case 'duck': {
      body.sphere(0.27, c, { pos: [0, 0.28, 0], scale: [0.95, 0.85, 1.25] }, 12);
      body.cyl(0.025, 0.025, 0.1, 0xffa02a, { pos: [-0.09, 0.05, 0] });
      body.cyl(0.025, 0.025, 0.1, 0xffa02a, { pos: [0.09, 0.05, 0] });
      body.sphere(0.07, 0xffa02a, { pos: [-0.09, 0.01, 0.05], scale: [1, 0.3, 1.4] });
      body.sphere(0.07, 0xffa02a, { pos: [0.09, 0.01, 0.05], scale: [1, 0.3, 1.4] });
      head.sphere(0.16, c === 0xffffff ? 0xffffff : 0x3a8a5a, {}, 12);
      head.sphere(0.09, 0xffb02a, { pos: [0, -0.04, 0.16], scale: [1, 0.4, 1.3] });
      eyes(head, 0.08, 0.04, 0.12, 0.033);
      tail.cone(0.08, 0.14, c, { rot: [-1.1, 0, 0] });
      return { body, head, tail, headPos: [0, 0.55, 0.22], tailPos: [0, 0.38, -0.32], height: 0.75 };
    }
    case 'rabbit': {
      body.sphere(0.25, c, { pos: [0, 0.26, -0.02], scale: [0.95, 0.95, 1.15] }, 12);
      body.sphere(0.08, c, { pos: [-0.12, 0.06, 0.15], scale: [0.8, 0.6, 1.3] });
      body.sphere(0.08, c, { pos: [0.12, 0.06, 0.15], scale: [0.8, 0.6, 1.3] });
      head.sphere(0.19, c, {}, 12);
      head.capsule(0.055, 0.22, c, { pos: [-0.08, 0.26, -0.03], rot: [-0.2, 0, 0.15] });
      head.capsule(0.055, 0.22, c, { pos: [0.08, 0.26, -0.03], rot: [-0.2, 0, -0.15] });
      head.capsule(0.03, 0.17, pink, { pos: [-0.08, 0.26, 0.0], rot: [-0.2, 0, 0.15] });
      head.capsule(0.03, 0.17, pink, { pos: [0.08, 0.26, 0.0], rot: [-0.2, 0, -0.15] });
      head.sphere(0.03, pink, { pos: [0, -0.03, 0.18] });
      eyes(head, 0.08, 0.03, 0.15, 0.038);
      blush(head, 0.12, -0.04, 0.14, 0.035);
      tail.sphere(0.08, 0xffffff);
      return { body, head, tail, headPos: [0, 0.48, 0.16], tailPos: [0, 0.3, -0.3], height: 0.85 };
    }
    case 'cow': {
      body.rbox(0.62, 0.48, 0.95, c, { pos: [0, 0.62, 0] }, 0.35);
      if (c === 0xffffff) {
        body.sphere(0.18, 0x3a3030, { pos: [0.24, 0.72, 0.1], scale: [0.5, 0.9, 1.2] });
        body.sphere(0.15, 0x3a3030, { pos: [-0.25, 0.6, -0.22], scale: [0.5, 0.9, 1.1] });
      }
      legs4(body, 0.2, 0.32, 0.4, 0.08, darker(c, 0.85));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.cyl(0.085, 0.085, 0.06, 0x3a2a22, { pos: [sx * 0.2, 0.03, sz * 0.32] }, 6);
      body.sphere(0.1, pink, { pos: [0, 0.38, -0.08], scale: [1.2, 0.8, 1] });
      head.rbox(0.38, 0.34, 0.36, c, {}, 0.4);
      head.rbox(0.32, 0.18, 0.12, 0xffc8c8, { pos: [0, -0.08, 0.2] }, 0.4);
      head.sphere(0.02, 0x5a3a3a, { pos: [-0.07, -0.07, 0.27] });
      head.sphere(0.02, 0x5a3a3a, { pos: [0.07, -0.07, 0.27] });
      head.cone(0.04, 0.12, 0xfff0d8, { pos: [-0.15, 0.22, -0.02], rot: [0, 0, 0.5] });
      head.cone(0.04, 0.12, 0xfff0d8, { pos: [0.15, 0.22, -0.02], rot: [0, 0, -0.5] });
      head.sphere(0.07, c, { pos: [-0.24, 0.06, -0.03], scale: [1.3, 0.5, 0.8] });
      head.sphere(0.07, c, { pos: [0.24, 0.06, -0.03], scale: [1.3, 0.5, 0.8] });
      eyes(head, 0.11, 0.06, 0.17, 0.045);
      tail.cyl(0.02, 0.02, 0.32, darker(c, 0.85), { pos: [0, -0.16, 0] });
      tail.sphere(0.05, 0x3a3030, { pos: [0, -0.33, 0] });
      return { body, head, tail, headPos: [0, 0.92, 0.55], tailPos: [0, 0.78, -0.48], height: 1.25 };
    }
    case 'sheep': {
      const wool = c;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        body.sphere(0.2, wool, { pos: [Math.sin(a) * 0.2, 0.5 + Math.cos(a * 2) * 0.06, Math.cos(a) * 0.28] }, 8);
      }
      body.sphere(0.32, wool, { pos: [0, 0.55, 0], scale: [1, 0.9, 1.15] }, 10);
      legs4(body, 0.16, 0.22, 0.3, 0.05, 0x3a3030);
      head.sphere(0.17, 0x3a3434, { scale: [0.9, 1, 1.05] }, 12);
      head.sphere(0.13, wool, { pos: [0, 0.13, -0.02] }, 8);
      head.sphere(0.06, 0x3a3434, { pos: [-0.17, 0.02, -0.02], scale: [1.4, 0.6, 0.8] });
      head.sphere(0.06, 0x3a3434, { pos: [0.17, 0.02, -0.02], scale: [1.4, 0.6, 0.8] });
      head.sphere(0.035, 0xffffff, { pos: [-0.065, 0.03, 0.14] });
      head.sphere(0.035, 0xffffff, { pos: [0.065, 0.03, 0.14] });
      head.sphere(0.018, EYE, { pos: [-0.065, 0.03, 0.17] });
      head.sphere(0.018, EYE, { pos: [0.065, 0.03, 0.17] });
      tail.sphere(0.09, wool);
      return { body, head, tail, headPos: [0, 0.72, 0.38], tailPos: [0, 0.6, -0.4], height: 0.95 };
    }
    case 'goat': {
      body.rbox(0.44, 0.38, 0.7, c, { pos: [0, 0.52, 0] }, 0.35);
      legs4(body, 0.15, 0.24, 0.34, 0.05, darker(c, 0.8));
      head.rbox(0.26, 0.28, 0.3, c, {}, 0.4);
      head.cone(0.04, 0.2, 0x8a7a6a, { pos: [-0.07, 0.2, -0.06], rot: [-0.6, 0, 0.2] });
      head.cone(0.04, 0.2, 0x8a7a6a, { pos: [0.07, 0.2, -0.06], rot: [-0.6, 0, -0.2] });
      head.cone(0.04, 0.12, darker(c, 0.85), { pos: [0, -0.2, 0.08], rot: [Math.PI, 0, 0] });
      head.sphere(0.06, c, { pos: [-0.17, 0.04, -0.02], scale: [1.4, 0.5, 0.8] });
      head.sphere(0.06, c, { pos: [0.17, 0.04, -0.02], scale: [1.4, 0.5, 0.8] });
      eyes(head, 0.08, 0.04, 0.14, 0.035);
      tail.cone(0.05, 0.12, c, { rot: [-0.6, 0, 0] });
      return { body, head, tail, headPos: [0, 0.82, 0.42], tailPos: [0, 0.72, -0.36], height: 1.05 };
    }
    case 'pig': {
      body.sphere(0.38, c, { pos: [0, 0.46, 0], scale: [0.95, 0.85, 1.2] }, 14);
      legs4(body, 0.18, 0.25, 0.22, 0.06, darker(c, 0.9));
      head.sphere(0.24, c, {}, 12);
      head.cyl(0.1, 0.11, 0.07, darker(c, 0.9), { pos: [0, -0.04, 0.23], rot: [Math.PI / 2, 0, 0] }, 10);
      head.sphere(0.02, 0x8a4a5a, { pos: [-0.04, -0.04, 0.27] });
      head.sphere(0.02, 0x8a4a5a, { pos: [0.04, -0.04, 0.27] });
      head.cone(0.07, 0.1, c, { pos: [-0.14, 0.2, 0], rot: [0.3, 0, 0.3] });
      head.cone(0.07, 0.1, c, { pos: [0.14, 0.2, 0], rot: [0.3, 0, -0.3] });
      eyes(head, 0.1, 0.06, 0.19, 0.038);
      blush(head, 0.15, -0.02, 0.17, 0.04);
      tail.torus(0.05, 0.015, darker(c, 0.9), { rot: [0, Math.PI / 2, 0] });
      return { body, head, tail, headPos: [0, 0.6, 0.44], tailPos: [0, 0.55, -0.45], height: 0.9 };
    }
    case 'horse': {
      body.rbox(0.5, 0.5, 1.05, c, { pos: [0, 0.82, 0] }, 0.4);
      legs4(body, 0.17, 0.36, 0.6, 0.07, darker(c, 0.85));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.cyl(0.08, 0.08, 0.08, 0x2a1e1a, { pos: [sx * 0.17, 0.04, sz * 0.36] }, 6);
      body.box(0.52, 0.06, 0.4, 0xc8463a, { pos: [0, 1.08, 0] });
      head.capsule(0.15, 0.25, c, { rot: [0.9, 0, 0] });
      head.rbox(0.24, 0.22, 0.3, c, { pos: [0, 0.12, 0.2] }, 0.4);
      head.box(0.06, 0.4, 0.22, 0x3a2a22, { pos: [0, 0.18, -0.08], rot: [0.5, 0, 0] });
      head.cone(0.05, 0.12, c, { pos: [-0.08, 0.32, 0.1] });
      head.cone(0.05, 0.12, c, { pos: [0.08, 0.32, 0.1] });
      eyes(head, 0.11, 0.18, 0.28, 0.035);
      tail.capsule(0.07, 0.35, 0x3a2a22, { pos: [0, -0.2, 0], rot: [0.3, 0, 0] });
      return { body, head, tail, headPos: [0, 1.2, 0.52], tailPos: [0, 1.0, -0.55], height: 1.6 };
    }
    case 'cat':
    case 'fox':
    case 'raccoon': {
      const belly = species === 'fox' ? 0xffffff : species === 'raccoon' ? 0xd8d8dc : 0xffffff;
      body.sphere(0.22, c, { pos: [0, 0.27, 0], scale: [0.85, 0.85, 1.35] }, 12);
      body.sphere(0.12, belly, { pos: [0, 0.22, 0.12], scale: [1, 0.9, 1.3] });
      legs4(body, 0.1, 0.16, 0.14, 0.04, species === 'fox' ? 0x3a2a22 : c);
      head.sphere(0.2, c, { scale: [1.1, 0.95, 1] }, 12);
      head.cone(0.08, 0.15, c, { pos: [-0.12, 0.17, -0.02], rot: [0, 0, 0.25] });
      head.cone(0.08, 0.15, c, { pos: [0.12, 0.17, -0.02], rot: [0, 0, -0.25] });
      head.cone(0.04, 0.08, 0xffb3c1, { pos: [-0.12, 0.16, 0.02], rot: [0, 0, 0.25] });
      head.cone(0.04, 0.08, 0xffb3c1, { pos: [0.12, 0.16, 0.02], rot: [0, 0, -0.25] });
      if (species === 'fox') head.cone(0.09, 0.16, belly, { pos: [0, -0.06, 0.18], rot: [Math.PI / 2, 0, 0] });
      else head.sphere(0.08, belly, { pos: [0, -0.06, 0.15], scale: [1.2, 0.8, 0.8] });
      if (species === 'raccoon') head.box(0.34, 0.07, 0.05, 0x3a3a40, { pos: [0, 0.02, 0.17] });
      head.sphere(0.02, 0x3a2a2a, { pos: [0, -0.03, species === 'fox' ? 0.27 : 0.21] });
      eyes(head, 0.085, 0.03, 0.17, 0.038);
      if (species === 'cat') blush(head, 0.13, -0.05, 0.15, 0.03);
      if (species === 'fox') {
        tail.capsule(0.09, 0.28, c, { pos: [0, 0, -0.15], rot: [-1.1, 0, 0] });
        tail.sphere(0.08, 0xffffff, { pos: [0, 0.14, -0.32] });
      } else if (species === 'raccoon') {
        for (let i = 0; i < 4; i++) tail.sphere(0.07, i % 2 ? 0x3a3a40 : c, { pos: [0, i * 0.06, -0.08 - i * 0.07] });
      } else {
        tail.capsule(0.035, 0.3, c, { pos: [0, 0.12, -0.08], rot: [-0.4, 0, 0] });
      }
      return { body, head, tail, headPos: [0, 0.48, 0.22], tailPos: [0, 0.32, -0.28], height: 0.7 };
    }
    case 'dog': {
      body.sphere(0.25, c, { pos: [0, 0.32, 0], scale: [0.85, 0.85, 1.3] }, 12);
      legs4(body, 0.11, 0.17, 0.18, 0.05, c);
      body.torus(0.1, 0.025, 0xe85a5a, { pos: [0, 0.48, 0.2], rot: [Math.PI / 2 + 0.4, 0, 0] });
      head.sphere(0.21, c, {}, 12);
      head.sphere(0.1, 0xfff0e0, { pos: [0, -0.06, 0.16], scale: [1.1, 0.85, 1] });
      head.sphere(0.04, 0x2a1e1a, { pos: [0, -0.02, 0.26] });
      head.sphere(0.09, darker(c, 0.75), { pos: [-0.19, 0.0, -0.02], scale: [0.5, 1.4, 0.9] });
      head.sphere(0.09, darker(c, 0.75), { pos: [0.19, 0.0, -0.02], scale: [0.5, 1.4, 0.9] });
      head.sphere(0.04, 0xff7a8a, { pos: [0, -0.13, 0.19], scale: [1, 0.5, 1] });
      eyes(head, 0.085, 0.05, 0.17, 0.04);
      tail.capsule(0.04, 0.16, c, { pos: [0, 0.08, -0.04], rot: [-0.6, 0, 0] });
      return { body, head, tail, headPos: [0, 0.56, 0.26], tailPos: [0, 0.42, -0.3], height: 0.8 };
    }
    case 'deer': {
      body.rbox(0.36, 0.36, 0.7, c, { pos: [0, 0.7, 0] }, 0.4);
      for (let i = 0; i < 5; i++) body.sphere(0.035, 0xffffff, { pos: [(i % 2 ? 0.1 : -0.1), 0.85, -0.2 + i * 0.1] });
      legs4(body, 0.12, 0.24, 0.55, 0.04, darker(c, 0.85));
      head.sphere(0.17, c, { scale: [0.9, 1, 1.2] }, 12);
      head.sphere(0.03, 0x2a1e1a, { pos: [0, -0.04, 0.22] });
      for (const sx of [-1, 1]) {
        head.cyl(0.02, 0.02, 0.22, 0xd8c8a0, { pos: [sx * 0.08, 0.24, -0.04], rot: [0, 0, sx * -0.3] });
        head.cyl(0.015, 0.015, 0.12, 0xd8c8a0, { pos: [sx * 0.16, 0.3, -0.04], rot: [0, 0, sx * -1.0] });
        head.sphere(0.06, c, { pos: [sx * 0.17, 0.06, -0.04], scale: [1.4, 0.5, 0.8] });
      }
      eyes(head, 0.08, 0.04, 0.14, 0.04);
      tail.sphere(0.06, 0xffffff);
      return { body, head, tail, headPos: [0, 1.05, 0.38], tailPos: [0, 0.85, -0.36], height: 1.35 };
    }
    case 'otter': {
      body.capsule(0.17, 0.3, c, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] });
      body.sphere(0.12, 0xd8c0a0, { pos: [0, 0.17, 0.12], scale: [1, 0.8, 1.3] });
      head.sphere(0.17, c, {}, 12);
      head.sphere(0.09, 0xd8c0a0, { pos: [0, -0.05, 0.13], scale: [1.3, 0.8, 0.8] });
      head.sphere(0.03, 0x2a1e1a, { pos: [0, -0.02, 0.21] });
      head.sphere(0.04, c, { pos: [-0.14, 0.1, -0.02] });
      head.sphere(0.04, c, { pos: [0.14, 0.1, -0.02] });
      eyes(head, 0.075, 0.05, 0.14, 0.035);
      tail.cone(0.08, 0.3, c, { pos: [0, 0, -0.1], rot: [-1.5, 0, 0] });
      return { body, head, tail, headPos: [0, 0.32, 0.3], tailPos: [0, 0.18, -0.3], height: 0.55 };
    }
    case 'hedgehog': {
      body.sphere(0.2, 0xf0d8b8, { pos: [0, 0.18, 0.05], scale: [0.9, 0.8, 1.1] }, 10);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2, el = 0.3 + (i % 3) * 0.3;
        body.cone(0.05, 0.14, c, { pos: [Math.sin(a) * 0.17 * Math.cos(el), 0.22 + Math.sin(el) * 0.12, Math.cos(a) * 0.2 - 0.05], rot: [Math.cos(a) * -1.2, 0, Math.sin(a) * 1.2] });
      }
      head.sphere(0.1, 0xf0d8b8, {}, 10);
      head.cone(0.05, 0.1, 0xf0d8b8, { pos: [0, -0.02, 0.1], rot: [Math.PI / 2, 0, 0] });
      head.sphere(0.022, 0x2a1e1a, { pos: [0, -0.02, 0.16] });
      eyes(head, 0.05, 0.03, 0.08, 0.025);
      return { body, head, tail, headPos: [0, 0.18, 0.24], tailPos: [0, 0.2, -0.2], height: 0.4 };
    }
    case 'lumipanda': {
      body.sphere(0.4, 0xf7f4ff, { pos: [0, 0.48, 0], scale: [1, 0.95, 1.1] }, 14);
      body.sphere(0.25, 0x3a3a4a, { pos: [0, 0.6, 0], scale: [1.65, 0.5, 1.2] });
      legs4(body, 0.2, 0.2, 0.2, 0.1, 0x3a3a4a);
      head.sphere(0.3, 0xf7f4ff, {}, 14);
      head.sphere(0.1, 0x3a3a4a, { pos: [-0.2, 0.22, -0.03] });
      head.sphere(0.1, 0x3a3a4a, { pos: [0.2, 0.22, -0.03] });
      head.sphere(0.08, 0x3a3a4a, { pos: [-0.11, 0.03, 0.24], scale: [1, 1.3, 0.5] });
      head.sphere(0.08, 0x3a3a4a, { pos: [0.11, 0.03, 0.24], scale: [1, 1.3, 0.5] });
      head.sphere(0.03, 0xb8c8ff, { pos: [-0.1, 0.05, 0.28] });
      head.sphere(0.03, 0xb8c8ff, { pos: [0.1, 0.05, 0.28] });
      head.sphere(0.04, 0x3a3a4a, { pos: [0, -0.08, 0.29] });
      head.sphere(0.05, 0xfff0a0, { pos: [0, 0.27, 0.12], scale: [1, 0.4, 1] }); // moon mark
      blush(head, 0.19, -0.08, 0.22, 0.045);
      tail.sphere(0.08, 0xf7f4ff);
      return { body, head, tail, headPos: [0, 0.95, 0.25], tailPos: [0, 0.4, -0.45], height: 1.3 };
    }
  }
  body.sphere(0.3, c, { pos: [0, 0.3, 0] });
  head.sphere(0.2, c);
  return { body, head, tail, headPos: [0, 0.6, 0.2], tailPos: [0, 0.3, -0.3], height: 0.8 };
}

const shadowGeo = new THREE.CircleGeometry(0.4, 14).rotateX(-Math.PI / 2);

export function buildAnimal(species: string, color: number, scale: number, outline = false): AnimalRig {
  const p = speciesParts(species, color);
  const mat = vcMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bm = p.body.mesh(mat);
  body.add(bm);
  const head = new THREE.Group();
  head.position.set(...p.headPos);
  const hm = p.head.mesh(mat);
  head.add(hm);
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(...p.tailPos);
  if (p.tail.parts.length) tail.add(p.tail.mesh(mat));
  body.add(tail);
  if (outline) {
    for (const src of [bm, hm]) {
      const o = new THREE.Mesh(src.geometry, outlineMat);
      o.scale.setScalar(1.05);
      src.parent!.add(o);
    }
  }
  const shadow = new THREE.Mesh(shadowGeo, blobShadowMat);
  shadow.position.y = 0.02;
  shadow.scale.setScalar(p.height * 0.9);
  root.add(shadow);
  root.scale.setScalar(scale);
  return { root, body, head, tail, eyes: null, shadow, height: p.height * scale };
}

/** Meadowkin creatures — original little spirits with glowing accents. */
export function buildCreature(def: CreatureDef): AnimalRig {
  const b = mb(), h = mb(), t = mb();
  const c = def.body, a = def.accent;
  let headPos: [number, number, number] = [0, 0.4, 0.05];
  let height = 0.6;
  switch (def.shape) {
    case 'blob':
      b.sphere(0.28, c, { pos: [0, 0.25, 0], scale: [1.1, 0.85, 1] }, 14);
      b.sphere(0.12, a, { pos: [0, 0.48, -0.05], scale: [1.4, 0.5, 1.2] });
      for (let i = 0; i < 3; i++) b.cone(0.04, 0.12, a, { pos: [-0.08 + i * 0.08, 0.52, -0.02] });
      headPos = [0, 0.27, 0.22];
      eyes(h, 0.09, 0.02, 0.04, 0.045);
      blush(h, 0.15, -0.04, 0.02, 0.035);
      break;
    case 'shroom':
      b.cyl(0.13, 0.16, 0.28, c, { pos: [0, 0.14, 0] }, 10);
      b.sphere(0.3, a, { pos: [0, 0.32, 0], scale: [1, 0.6, 1] }, 14);
      for (let i = 0; i < 5; i++) b.sphere(0.045, 0xffffff, { pos: [Math.sin(i * 1.3) * 0.2, 0.43, Math.cos(i * 1.3) * 0.2] });
      headPos = [0, 0.15, 0.13];
      eyes(h, 0.06, 0.0, 0.03, 0.035);
      break;
    case 'bunny':
      b.sphere(0.24, c, { pos: [0, 0.24, 0] }, 12);
      h.sphere(0.2, c, {}, 12);
      h.capsule(0.06, 0.26, a, { pos: [-0.08, 0.3, -0.02], rot: [-0.2, 0, 0.2] });
      h.capsule(0.06, 0.26, a, { pos: [0.08, 0.3, -0.02], rot: [-0.2, 0, -0.2] });
      eyes(h, 0.08, 0.02, 0.16, 0.04);
      blush(h, 0.12, -0.05, 0.15, 0.035);
      headPos = [0, 0.48, 0.12];
      height = 0.85;
      t.sphere(0.07, a);
      break;
    case 'bird':
      b.sphere(0.24, c, { pos: [0, 0.3, 0] }, 12);
      b.sphere(0.12, a, { pos: [-0.22, 0.3, 0], scale: [0.4, 1, 1.3] });
      b.sphere(0.12, a, { pos: [0.22, 0.3, 0], scale: [0.4, 1, 1.3] });
      b.sphere(0.13, 0xffffff, { pos: [0, 0.25, 0.14], scale: [1, 1, 0.6] });
      h.cone(0.04, 0.08, 0xffa02a, { pos: [0, 0.0, 0.08], rot: [Math.PI / 2, 0, 0] });
      eyes(h, 0.08, 0.05, 0.03, 0.04);
      h.cone(0.05, 0.1, a, { pos: [0, 0.14, -0.04] });
      headPos = [0, 0.38, 0.18];
      t.cone(0.07, 0.14, a, { rot: [-1.2, 0, 0] });
      break;
    case 'sprite':
      b.sphere(0.16, c, { pos: [0, 0.5, 0] }, 12);
      b.sphere(0.13, a, { pos: [-0.16, 0.56, -0.05], scale: [1, 0.4, 0.15], rot: [0, 0.4, 0.4] });
      b.sphere(0.13, a, { pos: [0.16, 0.56, -0.05], scale: [1, 0.4, 0.15], rot: [0, -0.4, -0.4] });
      eyes(h, 0.06, 0.0, 0.02, 0.03);
      headPos = [0, 0.5, 0.13];
      height = 0.8;
      break;
    case 'fluff':
      for (let i = 0; i < 7; i++) b.sphere(0.16, i % 2 ? c : a, { pos: [Math.sin(i) * 0.15, 0.35 + Math.cos(i * 2) * 0.06, Math.cos(i) * 0.12] }, 8);
      b.sphere(0.24, c, { pos: [0, 0.35, 0] }, 12);
      eyes(h, 0.08, 0, 0.02, 0.04);
      blush(h, 0.14, -0.05, 0.0, 0.035);
      headPos = [0, 0.36, 0.22];
      break;
    case 'lizard':
      b.capsule(0.13, 0.35, c, { pos: [0, 0.16, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 4; i++) b.cone(0.05, 0.12, a, { pos: [0, 0.3, -0.15 + i * 0.1] });
      legs4(b, 0.13, 0.12, 0.1, 0.03, c);
      h.sphere(0.14, c, { scale: [1, 0.8, 1.3] }, 12);
      eyes(h, 0.07, 0.05, 0.1, 0.035);
      headPos = [0, 0.2, 0.3];
      t.cone(0.07, 0.35, c, { pos: [0, 0, -0.15], rot: [-1.55, 0, 0] });
      height = 0.45;
      break;
    case 'jelly':
      b.sphere(0.26, c, { pos: [0, 0.45, 0], scale: [1, 0.75, 1] }, 14);
      for (let i = 0; i < 6; i++) b.capsule(0.03, 0.2, a, { pos: [Math.sin(i) * 0.15, 0.25, Math.cos(i) * 0.15] });
      eyes(h, 0.08, 0, 0.0, 0.04);
      blush(h, 0.13, -0.05, -0.02, 0.03);
      headPos = [0, 0.45, 0.24];
      height = 0.8;
      break;
    case 'fox':
      b.sphere(0.2, c, { pos: [0, 0.25, 0], scale: [0.85, 0.85, 1.35] }, 12);
      legs4(b, 0.09, 0.15, 0.13, 0.035, a);
      h.sphere(0.18, c, {}, 12);
      h.cone(0.07, 0.15, c, { pos: [-0.1, 0.16, -0.02], rot: [0, 0, 0.25] });
      h.cone(0.07, 0.15, c, { pos: [0.1, 0.16, -0.02], rot: [0, 0, -0.25] });
      h.cone(0.07, 0.12, a, { pos: [0, -0.05, 0.15], rot: [Math.PI / 2, 0, 0] });
      eyes(h, 0.08, 0.03, 0.14, 0.036);
      headPos = [0, 0.44, 0.2];
      t.capsule(0.08, 0.25, a, { pos: [0, 0.05, -0.12], rot: [-1.0, 0, 0] });
      break;
  }
  const mat = def.glow ? vcMat({ emissive: def.accent, emissiveIntensity: 0.35 }) : vcMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(b.mesh(mat));
  const head = new THREE.Group();
  head.position.set(...headPos);
  if (h.parts.length) head.add(h.mesh(vcMat()));
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.25);
  if (t.parts.length) tail.add(t.mesh(mat));
  body.add(tail);
  const shadow = new THREE.Mesh(shadowGeo, blobShadowMat);
  shadow.position.y = 0.02;
  root.add(shadow);
  return { root, body, head, tail, eyes: null, shadow, height };
}
