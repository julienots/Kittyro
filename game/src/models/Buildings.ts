import * as THREE from 'three';
import { mb, ModelBuilder, TEX } from './Builder';

/**
 * Buildings as merged vertex-coloured geometry plus a separate "windows" geometry
 * (glows warmly at night) and optional animated parts (mill blades) / smoke points.
 * Local origin = footprint min corner; the front door faces +Z (towards the camera).
 */
export interface BuildingModel {
  geo: THREE.BufferGeometry;
  windows: THREE.BufferGeometry | null;
  spinner?: { geo: THREE.BufferGeometry; pos: THREE.Vector3; axis: 'z' | 'y' };
  smoke: THREE.Vector3[];
  lights: THREE.Vector3[];
  door: THREE.Vector3;
  transparent?: THREE.BufferGeometry; // greenhouse glass
}

function darker(c: number, f = 0.8): number {
  return (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
}

const WOOD = 0xb07a4a;
const STONE = 0xc8c0b0;

interface HouseOpts {
  w: number;
  d: number;
  h: number;
  wall: number;
  roof: number;
  roofH?: number;
  ruined?: boolean;
  chimney?: boolean;
  door?: number;
  windows?: number; // windows per side
  foundation?: number;
  timber?: boolean;
  mat?: number; // wall pattern (TEX)
  roofTex?: number;
}

function house(b: ModelBuilder, win: ModelBuilder, cx: number, cz: number, o: HouseOpts) {
  const { w, d, h } = o;
  const found = o.foundation ?? STONE;
  const ruined = !!o.ruined;
  const wall = ruined ? darker(o.wall, 0.72) : o.wall;
  const roofC = ruined ? darker(o.roof, 0.55) : o.roof;
  b.rbox(w + 0.15, 0.25, d + 0.15, found, { pos: [cx, 0.12, cz], tex: TEX.stone }, 0.3);
  b.box(w, h, d, [darker(wall, 0.92), wall], { pos: [cx, 0.25 + h / 2, cz], tex: o.mat ?? TEX.plaster });
  if (o.timber && !ruined) {
    for (const sx of [-1, 1]) b.box(0.08, h, 0.08, 0x8a5a3a, { pos: [cx + sx * (w / 2 - 0.02), 0.25 + h / 2, cz + d / 2 + 0.01], tex: TEX.plank });
    for (const sx of [-1, 1]) b.box(0.07, h * 0.5, 0.06, 0x8a5a3a, { pos: [cx + sx * w * 0.25, 0.25 + h * 0.78, cz + d / 2 + 0.02], rot: [0, 0, sx * 0.6], tex: TEX.plank });
    b.box(w, 0.08, 0.06, 0x8a5a3a, { pos: [cx, 0.25 + h * 0.55, cz + d / 2 + 0.02] });
  }
  const roofH = o.roofH ?? Math.min(w, d) * 0.45;
  if (!ruined) {
    b.roof(w, roofH, d, roofC, { pos: [cx, 0.25 + h, cz], tex: o.roofTex ?? TEX.shingle }, 0.3);
    // ridge cap & fascia boards
    b.box(w + 0.65, 0.1, 0.16, darker(roofC, 0.85), { pos: [cx, 0.25 + h + roofH, cz] });
    b.box(w + 0.62, 0.06, 0.06, darker(roofC, 0.7), { pos: [cx, 0.25 + h + 0.02, cz + d / 2 + 0.3] });
  } else {
    // broken roof: a few slanted planks and holes
    b.roof(w * 0.55, roofH, d, roofC, { pos: [cx - w * 0.22, 0.25 + h, cz], tex: o.roofTex ?? TEX.shingle }, 0.2);
    for (let i = 0; i < 4; i++) b.box(0.16, 0.05, d * 0.7, darker(WOOD, 0.7), { pos: [cx + w * 0.15 + i * 0.3, 0.25 + h + 0.2 + i * 0.05, cz + 0.2], rot: [0.6, 0.1 * i, 0.2] });
    // vines
    for (let i = 0; i < 6; i++) b.sphere(0.18, 0x4f8a3a, { pos: [cx - w / 2 + 0.2 + i * (w / 6), 0.4 + (i % 3) * 0.35, cz + d / 2 + 0.05], scale: [1, 1.3, 0.4] }, 6);
    b.box(0.6, 0.06, 0.12, WOOD, { pos: [cx + 0.6, 0.15, cz + d / 2 + 0.5], rot: [0, 0.4, 0] });
  }
  // door
  const doorX = cx + (o.door ?? 0);
  b.box(0.62, 0.95, 0.08, ruined ? 0x5a4a3a : 0x8a5a3a, { pos: [doorX, 0.25 + 0.48, cz + d / 2 + 0.03], tex: TEX.plank });
  b.box(0.72, 0.08, 0.12, darker(wall, 0.8), { pos: [doorX, 0.25 + 1.0, cz + d / 2 + 0.05] });
  if (!ruined) b.sphere(0.04, 0xffd03a, { pos: [doorX + 0.18, 0.7, cz + d / 2 + 0.09] });
  b.box(0.8, 0.06, 0.4, 0xc8b8a0, { pos: [doorX, 0.27, cz + d / 2 + 0.25], tex: TEX.stone }); // step
  // windows
  const nw = o.windows ?? 2;
  const slots: number[] = [];
  for (let i = 0; i < nw; i++) slots.push(-w / 2 + (w / (nw + 1)) * (i + 1));
  for (const sx of slots) {
    if (Math.abs(sx - (o.door ?? 0)) < 0.6) continue;
    const wy = 0.25 + h * 0.58;
    b.box(0.56, 0.56, 0.06, 0xfff4e0, { pos: [cx + sx, wy, cz + d / 2 + 0.02] });
    if (ruined) b.box(0.46, 0.46, 0.04, 0x2a2a30, { pos: [cx + sx, wy, cz + d / 2 + 0.04] });
    else {
      win.box(0.44, 0.44, 0.04, 0xffffff, { pos: [cx + sx, wy, cz + d / 2 + 0.045] });
      b.box(0.04, 0.46, 0.05, 0xfff4e0, { pos: [cx + sx, wy, cz + d / 2 + 0.07] });
      b.box(0.46, 0.04, 0.05, 0xfff4e0, { pos: [cx + sx, wy, cz + d / 2 + 0.07] });
      for (const k of [-1, 1]) b.box(0.2, 0.56, 0.04, darker(roofC, 0.9), { pos: [cx + sx + k * 0.4, wy, cz + d / 2 + 0.05], tex: TEX.plank });
      // flower box
      b.box(0.6, 0.12, 0.16, 0x8a5a3a, { pos: [cx + sx, wy - 0.34, cz + d / 2 + 0.1] });
      for (let k = 0; k < 4; k++) b.sphere(0.06, [0xff6a8a, 0xffd03a, 0xffffff, 0xb08ae8][k], { pos: [cx + sx - 0.2 + k * 0.13, wy - 0.24, cz + d / 2 + 0.12] }, 5);
    }
  }
  // side windows
  if (!ruined) {
    const wy = 0.25 + h * 0.58;
    win.box(0.04, 0.4, 0.4, 0xffffff, { pos: [cx + w / 2 + 0.03, wy, cz] });
    b.box(0.05, 0.5, 0.5, 0xfff4e0, { pos: [cx + w / 2 + 0.01, wy, cz] });
  }
  const smoke: THREE.Vector3[] = [];
  if (o.chimney && !ruined) {
    b.box(0.36, 0.9, 0.36, 0xc8786a, { pos: [cx + w * 0.28, 0.25 + h + roofH * 0.6, cz - d * 0.15], tex: TEX.brick });
    b.box(0.44, 0.1, 0.44, 0x9a5a4a, { pos: [cx + w * 0.28, 0.25 + h + roofH * 0.6 + 0.45, cz - d * 0.15] });
    smoke.push(new THREE.Vector3(cx + w * 0.28, 0.25 + h + roofH * 0.6 + 0.55, cz - d * 0.15));
  }
  return { smoke, door: new THREE.Vector3(doorX, 0, cz + d / 2 + 0.5) };
}

function fenceRow(b: ModelBuilder, x0: number, z0: number, x1: number, z1: number, color = WOOD): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 0.5));
  const ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.box(0.08, 0.5, 0.08, color, { pos: [x0 + (x1 - x0) * t, 0.25, z0 + (z1 - z0) * t] });
  }
  b.box(0.05, 0.06, len, color, { pos: [(x0 + x1) / 2, 0.38, (z0 + z1) / 2], rot: [0, ang, 0], tex: TEX.plank });
  b.box(0.05, 0.06, len, color, { pos: [(x0 + x1) / 2, 0.18, (z0 + z1) / 2], rot: [0, ang, 0] });
}

export function farmBuildingModel(kind: string, w: number, d: number, roof: number, wall: number, ruined = false): BuildingModel {
  const b = mb(), win = mb();
  const cx = w / 2, cz = d / 2;
  let smoke: THREE.Vector3[] = [];
  let door = new THREE.Vector3(cx, 0, d + 0.4);
  let spinner: BuildingModel['spinner'];
  let transparent: THREE.BufferGeometry | undefined;
  const lights: THREE.Vector3[] = [];
  switch (kind) {
    case 'house': {
      const r = house(b, win, cx, cz - 0.2, { w: w - 0.6, d: d - 1.2, h: 1.7, wall, roof, chimney: true, windows: 3, door: 0.3, timber: true, mat: TEX.plaster, ruined });
      smoke = r.smoke;
      door = r.door;
      if (ruined) {
        // abandoned look: tarp over the roof hole, scaffolding, a pile of old planks
        b.box(1.5, 0.04, 1.3, 0x5a8ab8, { pos: [cx + 0.7, 0.25 + 1.7 + 0.55, cz - 0.3], rot: [0.5, 0, 0.15] });
        for (const sx of [-1.9, -1.1]) for (const sz of [d / 2 - 0.1, d / 2 + 0.3]) b.box(0.07, 2.1, 0.07, WOOD, { pos: [cx + sx, 1.05, sz] });
        b.box(1.0, 0.06, 0.5, darker(WOOD, 0.85), { pos: [cx - 1.5, 1.2, d / 2 + 0.1], tex: TEX.plank });
        b.box(1.0, 0.06, 0.5, darker(WOOD, 0.85), { pos: [cx - 1.5, 2.0, d / 2 + 0.1], tex: TEX.plank });
        for (let i = 0; i < 5; i++) b.box(1.1, 0.07, 0.18, darker(WOOD, 0.75 + (i % 2) * 0.1), { pos: [w - 0.6, 0.06 + i * 0.07, d - 0.5 + (i % 2) * 0.05], rot: [0, 0.2 * (i % 3), 0], tex: TEX.plank });
        b.box(0.9, 0.06, 0.08, 0x5a4a3a, { pos: [cx - 0.75, 0.25 + 1.0, d / 2 - 0.05], rot: [0, 0, 0.5] }); // boarded window
        b.box(0.9, 0.06, 0.08, 0x5a4a3a, { pos: [cx - 0.75, 0.25 + 1.0, d / 2 - 0.05], rot: [0, 0, -0.5] });
        // weeds around the walls
        for (let i = 0; i < 8; i++) b.cone(0.09, 0.35, 0x6a9a3a, { pos: [cx - w / 2 + 0.6 + i * 0.5, 0.15, d - 0.75 + (i % 2) * 0.1], rot: [0.2 * (i % 3 - 1), 0, 0.2] }, 5);
        break;
      }
      // porch
      b.box(1.8, 0.08, 0.9, 0xc8925a, { pos: [cx + 0.3, 0.3, d - 0.65] });
      for (const sx of [-0.8, 0.8]) b.cyl(0.05, 0.05, 1.3, 0xfff4e0, { pos: [cx + 0.3 + sx, 0.95, d - 0.3] }, 6);
      b.box(2.0, 0.08, 1.0, roof, { pos: [cx + 0.3, 1.62, d - 0.55], rot: [0.25, 0, 0] });
      lights.push(new THREE.Vector3(cx + 0.3, 1.4, d - 0.4));
      // mailbox
      b.cyl(0.04, 0.04, 0.7, WOOD, { pos: [0.4, 0.35, d - 0.3] });
      b.rbox(0.25, 0.2, 0.35, 0xe85a4a, { pos: [0.4, 0.75, d - 0.3] }, 0.5);
      break;
    }
    case 'coop': {
      const r = house(b, win, cx, cz, { w: w - 0.5, d: d - 0.6, h: 1.1, wall, roof, windows: 1, door: -0.6, roofH: 0.8, mat: TEX.plank });
      door = r.door;
      b.box(0.5, 0.06, 1.0, WOOD, { pos: [cx + 0.7, 0.3, d - 0.1], rot: [0.4, 0, 0] }); // ramp
      for (let i = 0; i < 4; i++) b.box(0.48, 0.02, 0.04, 0x8a5a3a, { pos: [cx + 0.7, 0.36 + i * 0.05, d - 0.4 + i * 0.2] });
      b.sphere(0.12, 0xffffff, { pos: [cx + 0.8, 1.45, cz + 0.3], scale: [1, 0.8, 1] }); // weathervane chicken
      break;
    }
    case 'barn': {
      const r = house(b, win, cx, cz, { w: w - 0.4, d: d - 0.6, h: 1.8, wall: 0xc8463a, roof: 0x5a4a4a, windows: 2, door: 0, roofH: 1.3, mat: TEX.plank });
      door = r.door;
      // big X doors
      b.box(1.3, 1.25, 0.06, 0xfff4e0, { pos: [cx, 0.9, cz + (d - 0.6) / 2 + 0.06] });
      b.box(1.5, 0.08, 0.07, 0xfff4e0, { pos: [cx, 0.9, cz + (d - 0.6) / 2 + 0.1], rot: [0, 0, 0.75] });
      b.box(1.5, 0.08, 0.07, 0xfff4e0, { pos: [cx, 0.9, cz + (d - 0.6) / 2 + 0.1], rot: [0, 0, -0.75] });
      b.box(0.7, 0.5, 0.06, 0xfff4e0, { pos: [cx, 2.55, cz + (d - 0.6) / 2 + 0.02] });
      win.box(0.5, 0.35, 0.04, 0xffffff, { pos: [cx, 2.55, cz + (d - 0.6) / 2 + 0.05] });
      break;
    }
    case 'stable': {
      const r = house(b, win, cx, cz, { w: w - 0.4, d: d - 0.6, h: 1.5, wall, roof, windows: 2, door: 0, roofH: 0.9, mat: TEX.plank });
      door = r.door;
      b.box(0.9, 0.5, 0.06, 0x8a5a3a, { pos: [cx, 0.5, cz + (d - 0.6) / 2 + 0.07] });
      b.torus(0.15, 0.03, 0xb8c2cc, { pos: [cx, 1.5, cz + (d - 0.6) / 2 + 0.08] }, Math.PI); // horseshoe
      break;
    }
    case 'sanctuary': {
      fenceRow(b, 0.2, 0.2, w - 0.2, 0.2);
      fenceRow(b, 0.2, 0.2, 0.2, d - 0.2);
      fenceRow(b, w - 0.2, 0.2, w - 0.2, d - 0.2);
      fenceRow(b, 0.2, d - 0.2, cx - 0.6, d - 0.2);
      fenceRow(b, cx + 0.6, d - 0.2, w - 0.2, d - 0.2);
      b.cyl(0.12, 0.16, 0.9, 0x8a5a3a, { pos: [1.0, 0.45, 1.0] }, 7);
      b.ico(0.6, [0x4f9e46, 0x6cbf4c], { pos: [1.0, 1.2, 1.0] }, 1);
      b.cyl(0.5, 0.5, 0.06, 0x5ab8e8, { pos: [w - 1.2, 0.05, 1.2] }, 12);
      b.box(1.0, 0.6, 0.8, 0xd8c8a0, { pos: [w - 1.0, 0.3, d - 1.2] });
      b.roof(1.0, 0.4, 0.8, 0x5a9a5a, { pos: [w - 1.0, 0.6, d - 1.2] });
      for (let i = 0; i < 6; i++) b.sphere(0.07, [0xffd03a, 0xff8ab8, 0xffffff][i % 3], { pos: [0.6 + i * 0.5, 0.06, d - 0.8], scale: [1, 0.4, 1] });
      door = new THREE.Vector3(cx, 0, d + 0.2);
      break;
    }
    case 'silo': {
      b.cyl(0.8, 0.85, 2.4, [0xd8d0c0, 0xe8e0d0], { pos: [cx, 1.2, cz], tex: TEX.plank }, 14);
      b.sphere(0.82, roof, { pos: [cx, 2.4, cz], scale: [1, 0.6, 1] }, 14);
      for (let i = 0; i < 3; i++) b.torus(0.83, 0.03, 0x8aa8c8, { pos: [cx, 0.5 + i * 0.7, cz], rot: [Math.PI / 2, 0, 0] });
      b.box(0.1, 2.2, 0.1, 0x7a7a7a, { pos: [cx + 0.55, 1.1, cz + 0.62] });
      door = new THREE.Vector3(cx, 0, cz + 1.3);
      break;
    }
    case 'greenhouse': {
      b.box(w, 0.2, d, 0xd8d0c0, { pos: [cx, 0.1, cz] });
      for (let i = 0; i <= 4; i++) for (const sz of [0.05, d - 0.05]) b.box(0.06, 1.6, 0.06, 0xffffff, { pos: [(w / 4) * i, 0.8, sz] });
      for (let i = 0; i <= 3; i++) for (const sx of [0.05, w - 0.05]) b.box(0.06, 1.6, 0.06, 0xffffff, { pos: [sx, 0.8, (d / 3) * i] });
      b.box(w, 0.06, 0.06, 0xffffff, { pos: [cx, 1.6, 0.05] });
      b.box(w, 0.06, 0.06, 0xffffff, { pos: [cx, 1.6, d - 0.05] });
      b.box(w, 0.06, 0.06, 0xffffff, { pos: [cx, 2.4, cz] });
      const g = mb();
      g.roof(w - 0.1, 0.8, d - 0.1, 0xbfe8f0, { pos: [cx, 1.6, cz] }, 0.02);
      g.box(w, 1.4, 0.02, 0xbfe8f0, { pos: [cx, 0.9, 0.05] });
      g.box(0.02, 1.4, d, 0xbfe8f0, { pos: [0.05, 0.9, cz] });
      g.box(0.02, 1.4, d, 0xbfe8f0, { pos: [w - 0.05, 0.9, cz] });
      transparent = g.build();
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
    case 'mill': {
      b.cyl(0.9, 1.15, 2.3, [0xe8dcc0, wall], { pos: [cx, 1.15, cz], tex: TEX.stone }, 10);
      b.cone(1.2, 1.0, roof, { pos: [cx, 2.8, cz], tex: TEX.shingle }, 10);
      b.box(0.55, 0.85, 0.08, 0x8a5a3a, { pos: [cx, 0.45, cz + 1.05] });
      win.box(0.35, 0.35, 0.04, 0xffffff, { pos: [cx, 1.6, cz + 0.98] });
      const s = mb();
      for (let i = 0; i < 4; i++) {
        s.box(0.12, 1.5, 0.04, 0x8a5a3a, { pos: [Math.sin((i * Math.PI) / 2) * 0.75, Math.cos((i * Math.PI) / 2) * 0.75, 0], rot: [0, 0, -(i * Math.PI) / 2] });
        s.box(0.36, 1.15, 0.02, 0xfff4e0, { pos: [Math.sin((i * Math.PI) / 2) * 0.8 + Math.cos((i * Math.PI) / 2) * 0.2, Math.cos((i * Math.PI) / 2) * 0.8 - Math.sin((i * Math.PI) / 2) * 0.2, 0.02], rot: [0, 0, -(i * Math.PI) / 2] });
      }
      s.cyl(0.12, 0.12, 0.2, 0x5a4a3a, { rot: [Math.PI / 2, 0, 0] });
      spinner = { geo: s.build(), pos: new THREE.Vector3(cx, 2.4, cz + 1.15), axis: 'z' };
      door = new THREE.Vector3(cx, 0, cz + 1.6);
      break;
    }
    case 'workshop': {
      const r = house(b, win, cx, cz, { w: w - 0.4, d: d - 0.8, h: 1.4, wall, roof, windows: 1, door: -0.5, chimney: true, mat: TEX.brick });
      smoke = r.smoke;
      door = r.door;
      b.box(1.0, 0.1, 0.5, WOOD, { pos: [cx + 0.6, 0.7, d - 0.3] });
      for (const sx of [-0.4, 0.4]) b.box(0.08, 0.7, 0.08, WOOD, { pos: [cx + 0.6 + sx, 0.35, d - 0.3] });
      b.box(0.3, 0.15, 0.2, 0x8a8a9a, { pos: [cx + 0.4, 0.82, d - 0.3] }); // anvil-ish
      break;
    }
    case 'kitchen': {
      b.box(w - 0.3, 0.9, d - 0.6, 0xfff0d8, { pos: [cx, 0.45, cz - 0.1], tex: TEX.brick });
      b.box(w - 0.2, 0.1, d - 0.5, 0xc8925a, { pos: [cx, 0.95, cz - 0.1] });
      b.box(0.8, 1.2, 0.6, 0xc8786a, { pos: [cx - 0.6, 1.5, cz - 0.3] });
      b.box(0.6, 0.4, 0.05, 0x2a2020, { pos: [cx - 0.6, 1.3, cz] });
      win.box(0.4, 0.2, 0.04, 0xffffff, { pos: [cx - 0.6, 1.25, cz + 0.03] });
      for (const sx of [-1, 1]) b.cyl(0.05, 0.05, 1.5, WOOD, { pos: [cx + sx * (w / 2 - 0.2), 1.0, d - 0.3] });
      b.box(w + 0.2, 0.08, 1.2, roof, { pos: [cx, 1.85, cz + 0.2], rot: [0.2, 0, 0] });
      b.cyl(0.2, 0.15, 0.15, 0x3a3a3a, { pos: [cx + 0.6, 1.07, cz - 0.1] }, 10);
      smoke = [new THREE.Vector3(cx - 0.6, 2.2, cz - 0.3)];
      lights.push(new THREE.Vector3(cx, 1.6, cz + 0.4));
      break;
    }
    case 'forge': {
      b.rbox(1.4, 1.0, 1.4, 0x8a8a9a, { pos: [cx, 0.5, cz], tex: TEX.stone }, 0.3);
      b.cyl(0.35, 0.45, 1.2, 0x7a6a6a, { pos: [cx, 1.5, cz - 0.1] }, 8);
      b.box(0.6, 0.45, 0.06, 0x2a1a1a, { pos: [cx, 0.45, cz + 0.71] });
      win.box(0.45, 0.3, 0.04, 0xffffff, { pos: [cx, 0.42, cz + 0.74] });
      smoke = [new THREE.Vector3(cx, 2.2, cz - 0.1)];
      lights.push(new THREE.Vector3(cx, 0.6, cz + 0.9));
      break;
    }
    case 'dairy': {
      const r = house(b, win, cx, cz, { w: w - 0.4, d: d - 0.5, h: 1.2, wall, roof, windows: 1, door: 0.6, roofH: 0.6 });
      door = r.door;
      b.cyl(0.18, 0.2, 0.5, 0xd8dce8, { pos: [0.4, 0.25, d - 0.2] }, 10); // milk can
      b.cyl(0.12, 0.12, 0.08, 0xd8dce8, { pos: [0.4, 0.54, d - 0.2] }, 10);
      break;
    }
    case 'beehive': {
      b.box(0.15, 0.4, 0.15, WOOD, { pos: [cx, 0.2, cz] });
      for (let i = 0; i < 3; i++) b.rbox(0.6 - i * 0.06, 0.2, 0.6 - i * 0.06, i % 2 ? 0xf4d27a : 0xffc42a, { pos: [cx, 0.5 + i * 0.2, cz] }, 0.4);
      b.roof(0.6, 0.2, 0.6, 0xc8925a, { pos: [cx, 1.08, cz] }, 0.06);
      b.box(0.16, 0.05, 0.05, 0x3a2a1a, { pos: [cx, 0.45, cz + 0.31] });
      door = new THREE.Vector3(cx, 0, cz + 0.8);
      break;
    }
    case 'pond': {
      b.cyl(1.4, 1.5, 0.12, [0x8a8478, STONE], { pos: [cx, 0.02, cz] }, 16);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        b.dodeca(0.2, i % 2 ? 0xb0aaa0 : 0x9a948a, { pos: [cx + Math.sin(a) * 1.4, 0.12, cz + Math.cos(a) * 1.4], scale: [1, 0.6, 1] });
      }
      for (let i = 0; i < 3; i++) b.cyl(0.18, 0.18, 0.02, 0x5aa84a, { pos: [cx - 0.5 + i * 0.45, 0.13, cz + 0.2 - i * 0.3] }, 8);
      b.sphere(0.08, 0xffb8d8, { pos: [cx - 0.05, 0.18, cz - 0.1] });
      door = new THREE.Vector3(cx, 0, cz + 1.8);
      break;
    }
    case 'shed': {
      const r = house(b, win, cx, cz, { w: w - 0.3, d: d - 0.5, h: 1.2, wall, roof, windows: 0, roofH: 0.6, mat: TEX.plank });
      door = r.door;
      b.cyl(0.25, 0.25, 0.5, 0xa8743a, { pos: [w - 0.3, 0.25, d - 0.25] }, 8);
      break;
    }
  }
  return { geo: b.build(), windows: win.parts.length ? win.build() : null, smoke, door, spinner, transparent, lights };
}

/** Village buildings — `restored=false` renders the ruined version. */
export function villageBuildingModel(style: string, w: number, d: number, roof: number, wall: number, restored: boolean): BuildingModel {
  const b = mb(), win = mb();
  const cx = w / 2, cz = d / 2;
  let smoke: THREE.Vector3[] = [];
  let door = new THREE.Vector3(cx, 0, d + 0.4);
  const lights: THREE.Vector3[] = [];
  const ruined = !restored;
  const awning = (x: number, z: number, width: number, c1: number, c2: number) => {
    if (ruined) return;
    const n = Math.round(width / 0.3);
    for (let i = 0; i < n; i++) b.box(width / n, 0.06, 0.7, i % 2 ? c1 : c2, { pos: [x - width / 2 + (i + 0.5) * (width / n), 1.55, z + 0.3], rot: [0.35, 0, 0] });
  };
  const sign = (x: number, y: number, z: number, c: number) => {
    if (ruined) {
      b.box(0.9, 0.35, 0.05, 0x6a5a4a, { pos: [x, y - 0.1, z], rot: [0, 0, 0.3] });
      return;
    }
    b.rbox(1.0, 0.4, 0.06, c, { pos: [x, y, z] }, 0.3);
    b.box(0.85, 0.08, 0.07, 0xffffff, { pos: [x, y, z + 0.01] });
  };
  switch (style) {
    case 'shop': case 'bakery': case 'florist': case 'fishing': case 'workshop': case 'house': {
      const h = style === 'house' ? 1.5 : 1.6;
      if (style === 'house') {
        // three cottages
        const colors = [0x6ab86a, 0x6a9ad8, 0xe8a33a];
        for (let i = 0; i < 3; i++) {
          const r = house(b, win, 1.3 + i * 2.7, cz, { w: 2.2, d: d - 1, h, wall: [0xfff0e0, 0xf0f4ff, 0xfff8e0][i], roof: colors[i], windows: 1, chimney: i !== 1, ruined, roofH: 0.9, mat: [TEX.plaster, TEX.stone, TEX.plank][i] });
          smoke.push(...r.smoke);
          if (i === 1) door = r.door;
        }
        break;
      }
      const r = house(b, win, cx, cz, { w: w - 0.6, d: d - 1.0, h, wall, roof, ruined, chimney: style === 'bakery' || style === 'workshop', windows: 2, door: style === 'fishing' ? 0.6 : 0, timber: style === 'shop' || style === 'florist', mat: ({ bakery: TEX.brick, fishing: TEX.plank, workshop: TEX.stone } as Record<string, number>)[style] ?? TEX.plaster });
      smoke = r.smoke;
      door = r.door;
      const front = cz + (d - 1.0) / 2;
      sign(cx, 0.25 + h + 0.25, front + 0.08, roof);
      if (style === 'shop') {
        awning(cx, front, w - 0.6, 0xffffff, roof);
        if (!ruined) for (let i = 0; i < 3; i++) b.rbox(0.4, 0.3, 0.4, [0xe8a33a, 0x8ad07a, 0xe85a5a][i], { pos: [cx - 1.4 + i * 0.5, 0.4, front + 0.7] }, 0.3);
      }
      if (style === 'bakery') {
        awning(cx, front, w - 0.6, 0xfff4e0, 0xe8a33a);
        if (!ruined) b.torus(0.18, 0.07, 0xe8b86a, { pos: [cx + 1.1, 2.15, front + 0.12] }); // pretzel sign
      }
      if (style === 'florist' && !ruined) {
        for (let i = 0; i < 5; i++) {
          b.cyl(0.14, 0.11, 0.22, 0xd8805a, { pos: [cx - 1.2 + i * 0.6, 0.36, front + 0.65] }, 8);
          b.sphere(0.16, [0xff6a8a, 0xffd03a, 0xb08ae8, 0xffffff, 0xff8a3a][i], { pos: [cx - 1.2 + i * 0.6, 0.58, front + 0.65] }, 7);
        }
        awning(cx, front, w - 0.6, 0xffffff, 0xff8ab8);
      }
      if (style === 'fishing') {
        b.box(1.6, 0.1, 1.4, WOOD, { pos: [w - 0.4, 0.35, d - 0.2] });
        for (const sx of [-0.7, 0.7]) b.cyl(0.07, 0.07, 0.8, 0x8a5a3a, { pos: [w - 0.4 + sx, 0.1, d + 0.4] });
        if (!ruined) {
          b.torus(0.25, 0.07, 0xff5a4a, { pos: [cx - 1.0, 1.0, front + 0.08] });
          b.cyl(0.05, 0.05, 1.8, 0x8a5a3a, { pos: [cx - 1.5, 0.9, front + 0.6] });
          for (let i = 0; i < 3; i++) b.sphere(0.12, 0x9fb8c8, { pos: [cx - 1.5, 1.5 - i * 0.3, front + 0.75], scale: [0.5, 0.8, 1.4] });
        }
      }
      if (style === 'workshop' && !ruined) {
        b.box(1.4, 0.1, 0.6, WOOD, { pos: [w - 0.7, 0.75, d - 0.4] });
        b.box(0.4, 0.4, 0.4, 0x8a8a9a, { pos: [w - 0.9, 1.0, d - 0.4] });
        for (let i = 0; i < 3; i++) b.cyl(0.1, 0.1, 1.2, 0xc8925a, { pos: [0.4, 0.15 + i * 0.2, d - 0.5], rot: [0, 0, Math.PI / 2] }, 7);
      }
      lights.push(new THREE.Vector3(cx, 1.9, front + 0.5));
      break;
    }
    case 'stable': {
      const r = house(b, win, cx, cz - 0.3, { w: w - 0.4, d: d - 1.4, h: 1.5, wall, roof, ruined, windows: 3, roofH: 1.0, mat: TEX.plank });
      door = r.door;
      const front = cz - 0.3 + (d - 1.4) / 2;
      for (let i = 0; i < 3; i++) b.box(0.9, 0.55, 0.06, ruined ? 0x5a4a3a : 0x8a5a3a, { pos: [0.9 + i * 2.0, 0.55, front + 0.06] });
      fenceRow(b, 0.2, d - 0.2, w - 0.2, d - 0.2, ruined ? 0x6a5a4a : WOOD);
      if (!ruined) for (let i = 0; i < 4; i++) b.rbox(0.6, 0.4, 0.4, 0xf2cd5c, { pos: [w - 0.6, 0.2 + (i % 2) * 0.4, 0.6 + Math.floor(i / 2) * 0.5] }, 0.3);
      break;
    }
    case 'market': {
      for (const sx of [0.3, w - 0.3]) for (const sz of [0.3, d - 0.3]) b.box(0.18, 2.0, 0.18, ruined ? 0x6a5a4a : WOOD, { pos: [sx, 1.0, sz], rot: ruined && sx > 1 && sz > 1 ? [0, 0, 0.3] : [0, 0, 0] });
      if (!ruined) {
        b.roof(w - 0.2, 1.0, d - 0.2, roof, { pos: [cx, 2.0, cz] }, 0.3);
        const cols = [0xe85a5a, 0xffd03a, 0x8ad07a];
        for (let i = 0; i < 3; i++) {
          const x = 1.0 + i * 2.0;
          b.box(1.5, 0.7, 0.7, 0xc8925a, { pos: [x, 0.35, cz] });
          for (let k = 0; k < 6; k++) b.sphere(0.12, cols[(i + k) % 3], { pos: [x - 0.55 + k * 0.22, 0.78, cz + (k % 2) * 0.15] }, 6);
        }
        for (let i = 0; i < 9; i++) b.box(0.25, 0.3, 0.02, [0xff6a8a, 0xffd03a, 0x6ad8ff][i % 3], { pos: [0.4 + i * (w - 0.8) / 8, 1.8, d - 0.25], rot: [0, 0, Math.PI / 4] });
      } else {
        b.box(1.5, 0.5, 0.7, 0x6a5a4a, { pos: [1.2, 0.25, cz], rot: [0, 0.3, 0.2] });
        b.box(2.2, 0.08, 1.6, 0x6a5a4a, { pos: [cx, 0.2, cz + 0.5], rot: [0.1, 0.4, 0.15] });
      }
      lights.push(new THREE.Vector3(cx, 1.8, cz));
      break;
    }
    case 'fountain': {
      b.cyl(1.6, 1.7, 0.4, [0xb0a898, 0xd8d0c0], { pos: [cx, 0.2, cz], tex: TEX.stone }, 16);
      b.cyl(1.4, 1.4, 0.05, ruined ? 0x6a8a5a : 0x5ac8e8, { pos: [cx, 0.38, cz] }, 16);
      b.cyl(0.25, 0.35, 1.0, 0xd8d0c0, { pos: [cx, 0.8, cz] }, 10);
      b.cyl(0.7, 0.5, 0.2, 0xd8d0c0, { pos: [cx, 1.35, cz] }, 12);
      if (!ruined) {
        b.cyl(0.6, 0.6, 0.04, 0x8ae0f8, { pos: [cx, 1.45, cz] }, 12);
        b.sphere(0.2, 0xd8d0c0, { pos: [cx, 1.65, cz] });
        b.sphere(0.12, 0x8ae0f8, { pos: [cx, 1.9, cz], scale: [1, 1.6, 1] });
      } else {
        for (let i = 0; i < 6; i++) b.sphere(0.25, 0x4f8a3a, { pos: [cx + Math.sin(i) * 1.2, 0.45, cz + Math.cos(i) * 1.2], scale: [1, 0.5, 1] }, 6);
      }
      door = new THREE.Vector3(cx, 0, cz + 2.0);
      break;
    }
    case 'park': {
      if (ruined) {
        for (let i = 0; i < 18; i++) b.cone(0.12, 0.6, 0x7a9a4a, { pos: [0.5 + (i * 1.7) % (w - 1), 0.3, 0.5 + ((i * 2.3) % (d - 1))], rot: [0.2, i, 0.1] }, 4);
        b.box(1.6, 0.1, 0.5, 0x5a4a3a, { pos: [cx, 0.3, cz], rot: [0, 0.4, 0.25] });
      } else {
        b.cyl(1.0, 1.0, 0.05, 0xd8c8a0, { pos: [cx, 0.03, cz] }, 16);
        for (const [x, z] of [[1.2, 1.2], [w - 1.2, 1.2], [1.2, d - 1.2], [w - 1.2, d - 1.2]]) {
          b.cyl(0.1, 0.14, 0.9, 0x8a5a3a, { pos: [x, 0.45, z] }, 7);
          b.ico(0.6, [0x4f9e46, 0x7ccf5a], { pos: [x, 1.25, z] }, 1);
          b.ico(0.12, 0xffb8d8, { pos: [x + 0.3, 1.45, z + 0.3] }, 0);
        }
        for (const sx of [-1.8, 1.8]) {
          b.box(1.2, 0.08, 0.4, WOOD, { pos: [cx + sx, 0.42, cz + 0.3] });
          b.box(1.2, 0.3, 0.06, WOOD, { pos: [cx + sx, 0.6, cz + 0.1] });
          for (const k of [-0.5, 0.5]) b.box(0.06, 0.4, 0.3, 0x5a5a5a, { pos: [cx + sx + k, 0.2, cz + 0.3] });
        }
        for (let i = 0; i < 16; i++) b.sphere(0.08, [0xffd03a, 0xff6a8a, 0xffffff, 0xb08ae8][i % 4], { pos: [0.5 + (i * 0.47) % (w - 1), 0.08, d - 0.5 - (i % 2) * 0.3], scale: [1, 0.5, 1] }, 5);
        lights.push(new THREE.Vector3(cx, 1.5, cz));
      }
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
  }
  if (ruined) {
    // construction hint: planks & stones
    b.box(0.8, 0.08, 0.2, WOOD, { pos: [0.4, 0.05, d + 0.1], rot: [0, 0.3, 0] });
    b.dodeca(0.15, 0xa8a49a, { pos: [w - 0.3, 0.1, d + 0.2] });
  }
  return { geo: b.build(), windows: win.parts.length ? win.build() : null, smoke, door, lights };
}

/** Misc world structures. */
export function structureGeo(kind: string, p: { w?: number; color?: number; broken?: boolean; stone?: boolean; dark?: boolean; label?: string } = {}): THREE.BufferGeometry {
  const b = mb();
  switch (kind) {
    case 'bridge': {
      const w = p.w ?? 3;
      const broken = !!p.broken;
      if ((p as any).stone) {
        const c1 = (p as any).dark ? 0x5a4a48 : 0xb8b0a0, c2 = (p as any).dark ? 0x3a3030 : 0x9a9288;
        for (let i = 0; i < w * 2; i++) b.box(0.48, 0.22, 1.4, i % 2 ? c1 : c2, { pos: [-w / 2 + 0.25 + i * 0.5, 0.2 + Math.sin((i / (w * 2)) * Math.PI) * 0.2, 0] });
        for (const sz of [-0.66, 0.66]) b.box(w, 0.3, 0.16, c2, { pos: [0, 0.45, sz] });
        break;
      }
      for (let i = 0; i < w * 3; i++) {
        if (broken && i % 3 === 1) continue;
        b.box(0.3, 0.08, 1.4, i % 2 ? 0xb07a4a : 0xc08a5a, { pos: [-w / 2 + 0.17 + i * 0.33, 0.25 + Math.sin((i / (w * 3)) * Math.PI) * 0.25, 0], rot: [0, 0, broken && i % 4 === 0 ? 0.3 : 0] });
      }
      if (!broken) for (const sz of [-0.68, 0.68]) {
        for (let i = 0; i <= w; i++) b.box(0.08, 0.5, 0.08, 0x8a5a3a, { pos: [-w / 2 + i, 0.5 + Math.sin((i / w) * Math.PI) * 0.25, sz] });
        b.box(w, 0.06, 0.06, 0x8a5a3a, { pos: [0, 0.78, sz] });
      }
      break;
    }
    case 'signpost':
      b.cyl(0.06, 0.07, 1.4, 0x8a5a3a, { pos: [0, 0.7, 0] });
      b.box(0.9, 0.25, 0.06, p.color ?? 0xd8b07a, { pos: [0.2, 1.2, 0] });
      b.cone(0.13, 0.2, p.color ?? 0xd8b07a, { pos: [0.72, 1.2, 0], rot: [0, 0, -Math.PI / 2] }, 3);
      b.box(0.8, 0.22, 0.06, 0xc8a06a, { pos: [-0.15, 0.88, 0], rot: [0, 0.3, 0] });
      break;
    case 'shipping_bin':
      b.rbox(1.0, 0.6, 0.7, 0xb07a4a, { pos: [0, 0.3, 0] }, 0.2);
      b.box(1.06, 0.08, 0.76, 0x8a5a3a, { pos: [0, 0.62, 0], rot: [-0.25, 0, 0] });
      for (let i = 0; i < 3; i++) b.box(1.02, 0.04, 0.02, 0x8a5a3a, { pos: [0, 0.12 + i * 0.18, 0.36] });
      b.rbox(0.3, 0.2, 0.05, 0xfff4e0, { pos: [0, 0.4, 0.37] }, 0.3);
      break;
    case 'mine_entrance':
      b.dodeca(2.2, [0x6a6a78, 0x8a8a98], { pos: [0, 1.0, -0.8], scale: [1.3, 1, 0.8] });
      b.box(1.6, 2.0, 0.6, 0x1a1418, { pos: [0, 1.0, 0.6] });
      for (const sx of [-0.85, 0.85]) b.box(0.2, 2.1, 0.2, 0x8a5a3a, { pos: [sx, 1.05, 0.9] });
      b.box(2.0, 0.2, 0.25, 0x8a5a3a, { pos: [0, 2.1, 0.9] });
      b.box(0.08, 0.06, 1.6, 0x8a8a9a, { pos: [-0.3, 0.05, 1.4] });
      b.box(0.08, 0.06, 1.6, 0x8a8a9a, { pos: [0.3, 0.05, 1.4] });
      for (let i = 0; i < 5; i++) b.box(0.8, 0.05, 0.12, 0x8a5a3a, { pos: [0, 0.03, 0.8 + i * 0.35] });
      break;
    case 'ladder_down':
      b.cyl(0.5, 0.5, 0.05, 0x1a1418, { pos: [0, 0.02, 0] }, 12);
      for (const sx of [-0.18, 0.18]) b.box(0.06, 0.8, 0.06, 0x8a5a3a, { pos: [sx, 0.2, -0.3], rot: [-0.4, 0, 0] });
      for (let i = 0; i < 4; i++) b.box(0.36, 0.04, 0.04, 0x8a5a3a, { pos: [0, -0.05 + i * 0.16, -0.38 + i * 0.07] });
      break;
    case 'ladder_up':
      for (const sx of [-0.2, 0.2]) b.box(0.07, 2.2, 0.07, 0x8a5a3a, { pos: [sx, 1.1, 0] });
      for (let i = 0; i < 7; i++) b.box(0.4, 0.05, 0.05, 0x8a5a3a, { pos: [0, 0.2 + i * 0.3, 0] });
      break;
    case 'elevator':
      b.box(1.4, 0.15, 1.4, 0x8a8a9a, { pos: [0, 0.07, 0] });
      for (const sx of [-0.65, 0.65]) for (const sz of [-0.65, 0.65]) b.box(0.1, 2.4, 0.1, 0x6a5a4a, { pos: [sx, 1.2, sz] });
      b.box(1.5, 0.12, 1.5, 0x6a5a4a, { pos: [0, 2.4, 0] });
      b.cyl(0.15, 0.15, 0.3, 0xffd03a, { pos: [0, 2.6, 0], rot: [0, 0, Math.PI / 2] });
      break;
    case 'boat':
      b.lathe([[0, 0], [0.5, 0.05], [0.65, 0.35], [0.62, 0.45]], [0x8a5a3a, 0xc8925a], { pos: [0, 0, 0], scale: [1, 1, 2.2] }, 10);
      b.box(1.1, 0.06, 0.3, 0xc8925a, { pos: [0, 0.35, 0.2] });
      b.cyl(0.04, 0.04, 1.8, 0x8a5a3a, { pos: [0, 1.1, -0.2] });
      b.box(0.02, 1.2, 0.9, 0xfff4e0, { pos: [0.05, 1.3, 0.25] });
      break;
    case 'pier': {
      const len = p.w ?? 4;
      for (let i = 0; i < len * 3; i++) b.box(1.2, 0.08, 0.3, i % 2 ? 0xb07a4a : 0xc08a5a, { pos: [0, 0.3, -i * 0.33] });
      for (let i = 0; i <= len; i++) for (const sx of [-0.55, 0.55]) b.cyl(0.07, 0.07, 1.0, 0x8a5a3a, { pos: [sx, -0.1, -i] });
      break;
    }
    case 'campfire':
      for (let i = 0; i < 8; i++) b.dodeca(0.12, 0x9a948a, { pos: [Math.sin(i * 0.785) * 0.4, 0.06, Math.cos(i * 0.785) * 0.4] });
      for (let i = 0; i < 3; i++) b.cyl(0.05, 0.06, 0.6, 0x8a5a3a, { pos: [0, 0.1, 0], rot: [Math.PI / 2, i * 1.05, 0.3] });
      break;
    case 'tent':
      b.cone(1.1, 1.4, 0xe8a33a, { pos: [0, 0.7, 0] }, 4);
      b.box(0.5, 0.7, 0.05, 0x5a3a2a, { pos: [0, 0.35, 0.62], rot: [0, Math.PI / 4, 0] });
      break;
    case 'shrine':
      b.box(1.2, 0.2, 1.2, 0xc8c0b0, { pos: [0, 0.1, 0] });
      b.cyl(0.3, 0.35, 0.9, 0xd8d0c0, { pos: [0, 0.65, 0] }, 8);
      b.ico(0.3, 0xb08ae8, { pos: [0, 1.35, 0] }, 0);
      break;
    case 'hamlet_board':
      b.box(0.9, 0.12, 0.9, 0xb8b0a0, { pos: [0, 0.06, 0], tex: TEX.stone });
      b.cyl(0.12, 0.16, 0.9, 0x8a5a3a, { pos: [0, 0.55, 0], tex: TEX.plank }, 8);
      b.box(0.8, 0.08, 0.6, 0x9a6a3a, { pos: [0, 1.02, 0], rot: [-0.35, 0, 0], tex: TEX.plank });
      b.box(0.34, 0.05, 0.46, 0xfff8e8, { pos: [-0.17, 1.08, 0.02], rot: [-0.35, 0, 0.08] });
      b.box(0.34, 0.05, 0.46, 0xfff8e8, { pos: [0.17, 1.08, 0.02], rot: [-0.35, 0, -0.08] });
      b.box(0.04, 0.06, 0.48, 0xc8463a, { pos: [0, 1.11, 0.02], rot: [-0.35, 0, 0] });
      b.cyl(0.03, 0.03, 0.4, 0xf4f4f4, { pos: [0.35, 1.2, -0.1], rot: [0.4, 0, -0.4] }, 5);
      break;
    case 'request_board':
      for (const sx of [-0.55, 0.55]) b.cyl(0.06, 0.06, 1.6, 0x8a5a3a, { pos: [sx, 0.8, 0] });
      b.box(1.3, 0.9, 0.08, 0xc8925a, { pos: [0, 1.2, 0] });
      b.roof(1.4, 0.3, 0.4, 0xc8463a, { pos: [0, 1.7, 0] }, 0.05);
      for (let i = 0; i < 4; i++) b.box(0.25, 0.3, 0.02, 0xfff8e8, { pos: [-0.4 + i * 0.27, 1.2 + (i % 2) * 0.1, 0.05], rot: [0, 0, (i - 1.5) * 0.1] });
      break;
    case 'gate_rock':
      b.dodeca(0.9, [0x6a6a78, 0x9a9aa8], { pos: [0, 0.8, 0], scale: [1.4, 1, 1] });
      b.dodeca(0.6, 0x8a8a98, { pos: [1.0, 0.5, 0.3] });
      b.dodeca(0.6, 0x7a7a88, { pos: [-1.0, 0.45, -0.2] });
      break;
    case 'ice_gate':
      for (let i = 0; i < 5; i++) b.cone(0.3, 2.0, [0x9ad8f0, 0xffffff], { pos: [-1.2 + i * 0.6, 1.0, 0], rot: [0, 0, (i - 2) * 0.1] }, 6);
      break;
    case 'lighthouse':
      b.cyl(1.0, 1.1, 0.4, 0xb0a898, { pos: [0, 0.2, 0] }, 12);
      for (let i = 0; i < 4; i++) b.cyl(0.62 - i * 0.05, 0.68 - i * 0.05, 1.0, i % 2 ? 0xe85a4a : 0xffffff, { pos: [0, 0.9 + i * 1.0, 0] }, 12);
      b.cyl(0.62, 0.62, 0.12, 0x3a3a4a, { pos: [0, 4.45, 0] }, 12);
      b.cyl(0.4, 0.4, 0.7, 0xfff8d0, { pos: [0, 4.85, 0] }, 10);
      b.cone(0.55, 0.6, 0xe85a4a, { pos: [0, 5.5, 0] }, 12);
      b.box(0.45, 0.8, 0.06, 0x8a5a3a, { pos: [0, 0.75, 0.66] });
      break;
    case 'igloo':
      b.sphere(1.3, [0xd8e8f8, 0xffffff], { pos: [0, 0, 0], scale: [1, 0.85, 1] }, 16);
      b.cyl(0.55, 0.6, 0.9, 0xf0f6ff, { pos: [0, 0.4, 1.2], rot: [Math.PI / 2, 0, 0] }, 12);
      b.box(0.6, 0.65, 0.1, 0x2a3a5a, { pos: [0, 0.32, 1.66] });
      for (let i = 0; i < 4; i++) b.torus(1.0 - i * 0.2, 0.02, 0xc8d8e8, { pos: [0, 0.3 + i * 0.25, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'lava_gate':
      for (let i = 0; i < 4; i++) b.dodeca(0.6, [0x2a2020, 0x4a3a3a], { pos: [-1.1 + i * 0.75, 0.6, 0], scale: [1, 1.3, 1] });
      b.box(0.5, 0.5, 0.1, 0xff6a2a, { pos: [0, 0.8, 0.5] });
      break;
  }
  return b.build();
}

/** Hamlet buildings (Clairefontaine). Same conventions as farm buildings: origin = min corner, door toward +Z. */
export function hamletBuildingModel(kind: string, w: number, d: number, roof: number, wall: number, mat: number, roofTex: number): BuildingModel {
  const b = mb(), win = mb();
  const cx = w / 2, cz = d / 2;
  let smoke: THREE.Vector3[] = [];
  let door = new THREE.Vector3(cx, 0, d + 0.4);
  const lights: THREE.Vector3[] = [];
  const H = (o: Partial<HouseOpts> & { w: number; d: number; h: number }, x = cx, z = cz) => {
    const r = house(b, win, x, z, { wall, roof, mat, roofTex, ...o });
    smoke.push(...r.smoke);
    door = r.door;
    return r;
  };
  const logPile = (x: number, z: number, n = 3) => {
    for (let i = 0; i < n; i++) for (let k = 0; k < n - i; k++) b.cyl(0.11, 0.11, 0.9, 0x9a6a3a, { pos: [x - (n - i - 1) * 0.11 + k * 0.22, 0.12 + i * 0.19, z], rot: [Math.PI / 2, 0, 0], tex: TEX.log }, 7);
  };
  const barrel = (x: number, z: number) => {
    b.cyl(0.2, 0.17, 0.48, 0xa8743a, { pos: [x, 0.24, z], tex: TEX.plank }, 9);
    b.torus(0.2, 0.02, 0x5a5a5a, { pos: [x, 0.36, z], rot: [Math.PI / 2, 0, 0] });
  };
  switch (kind) {
    case 'h_hut':
      H({ w: 1.7, d: 1.5, h: 1.05, windows: 1, roofH: 0.85, door: -0.35 });
      b.box(0.5, 0.05, 0.5, 0xc8a06a, { pos: [cx + 0.55, 0.05, d - 0.15], tex: TEX.plank });
      break;
    case 'h_cottage':
      H({ w: 2.5, d: 2.0, h: 1.35, windows: 2, roofH: 1.15, chimney: true, door: 0.0, timber: true }, cx, cz - 0.15);
      for (const sx of [-1.1, 1.1]) b.sphere(0.22, 0x5aa84a, { pos: [cx + sx, 0.25, d - 0.2], scale: [1, 0.8, 1] }, 7);
      lights.push(new THREE.Vector3(cx, 1.3, d - 0.2));
      break;
    case 'h_stonehouse':
      H({ w: 3.4, d: 2.1, h: 1.75, windows: 3, roofH: 1.2, chimney: true, door: 0.0 }, cx, cz - 0.1);
      b.box(1.0, 0.08, 0.6, 0xb8b0a0, { pos: [cx, 0.06, d - 0.15], tex: TEX.cobble });
      lights.push(new THREE.Vector3(cx + 0.5, 1.4, d - 0.2));
      break;
    case 'h_manor': {
      H({ w: 3.5, d: 2.7, h: 2.3, windows: 3, roofH: 1.5, chimney: true, door: 0.0, timber: true }, cx, cz - 0.2);
      const front = cz - 0.2 + 1.35;
      for (const sx of [-1.1, 1.1]) {
        b.box(0.5, 0.45, 0.06, 0xfff4e0, { pos: [cx + sx, 2.05, front + 0.02] });
        win.box(0.38, 0.34, 0.04, 0xffffff, { pos: [cx + sx, 2.05, front + 0.05] });
      }
      b.box(1.4, 0.08, 0.5, 0xc8925a, { pos: [cx, 1.45, front + 0.25], tex: TEX.plank }); // balcony
      for (let i = 0; i < 6; i++) b.box(0.04, 0.3, 0.04, 0xfff4e0, { pos: [cx - 0.65 + i * 0.26, 1.62, front + 0.47] });
      for (const sx of [-1.6, 1.6]) {
        b.cyl(0.18, 0.2, 0.3, 0xd8805a, { pos: [cx + sx, 0.15, d - 0.25] }, 8);
        b.cone(0.2, 0.7, 0x3f8a5a, { pos: [cx + sx, 0.6, d - 0.25] }, 7);
      }
      lights.push(new THREE.Vector3(cx, 1.3, d - 0.1));
      break;
    }
    case 'h_lumber': {
      for (const [x, z] of [[0.4, 0.4], [w - 0.4, 0.4], [0.4, 1.8], [w - 0.4, 1.8]]) b.box(0.14, 1.4, 0.14, 0x8a5a3a, { pos: [x, 0.7, z], tex: TEX.plank });
      b.roof(w - 0.4, 0.6, 1.6, roof, { pos: [cx, 1.4, 1.1], tex: TEX.shingle }, 0.15);
      b.box(1.6, 0.5, 0.5, 0xb07a4a, { pos: [cx, 0.25, 1.1], tex: TEX.plank }); // saw table
      b.cyl(0.32, 0.32, 0.03, 0xc8d0d8, { pos: [cx, 0.5, 1.1], rot: [Math.PI / 2, 0, 0] }, 16);
      logPile(0.8, d - 0.5, 3);
      b.cyl(0.25, 0.28, 0.35, 0x9a6a3a, { pos: [w - 0.6, 0.18, d - 0.5] }, 9);
      b.box(0.05, 0.5, 0.05, 0x8a5a3a, { pos: [w - 0.55, 0.55, d - 0.5], rot: [0, 0, 0.5] });
      b.box(0.18, 0.1, 0.04, 0xb8c2cc, { pos: [w - 0.45, 0.75, d - 0.5], rot: [0, 0, 0.5] });
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
    case 'h_quarry': {
      H({ w: 1.5, d: 1.3, h: 1.0, windows: 0, roofH: 0.6, door: 0 }, 0.95, 0.9);
      for (let i = 0; i < 5; i++) b.dodeca(0.32 + (i % 2) * 0.12, i % 2 ? 0x9a948a : 0xb0aaa0, { pos: [w - 0.8 + (i % 2) * 0.3, 0.25, 0.5 + i * 0.4], scale: [1, 0.75, 1] });
      for (let i = 0; i < 4; i++) b.box(0.42, 0.3, 0.3, 0xc8c0b0, { pos: [0.6 + (i % 2) * 0.45, 0.15 + Math.floor(i / 2) * 0.3, d - 0.4], tex: TEX.stone });
      b.box(0.08, 1.6, 0.08, 0x8a5a3a, { pos: [w - 0.4, 0.8, d - 0.3] });
      b.box(0.9, 0.08, 0.08, 0x8a5a3a, { pos: [w - 0.8, 1.55, d - 0.3] });
      b.box(0.02, 0.6, 0.02, 0x5a4a3a, { pos: [w - 1.2, 1.25, d - 0.3] });
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
    case 'h_fields': {
      const crop = 0xe8c860;
      for (let r = 0; r < 4; r++) {
        b.box(w - 0.5, 0.1, 0.42, 0x8a6040, { pos: [cx, 0.05, 0.45 + r * 0.6] });
        for (let k = 0; k < 8; k++) b.cone(0.09, 0.42, k % 3 ? crop : 0x8ac850, { pos: [0.5 + k * ((w - 1) / 7), 0.3, 0.45 + r * 0.6], rot: [0.1 * (k % 2), 0, 0.1 * ((k + r) % 3 - 1)] }, 4);
      }
      // scarecrow
      b.box(0.06, 1.1, 0.06, 0x8a5a3a, { pos: [w - 0.4, 0.55, d - 0.3] });
      b.box(0.7, 0.06, 0.06, 0x8a5a3a, { pos: [w - 0.4, 0.85, d - 0.3] });
      b.sphere(0.15, 0xf2cd5c, { pos: [w - 0.4, 1.2, d - 0.3] }, 7);
      b.cone(0.22, 0.15, 0xd8b04a, { pos: [w - 0.4, 1.35, d - 0.3] }, 8);
      b.box(0.35, 0.35, 0.18, 0x5a8ad8, { pos: [w - 0.4, 0.82, d - 0.3] });
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
    case 'h_fishery': {
      H({ w: 1.9, d: 1.4, h: 1.15, windows: 1, roofH: 0.7, door: -0.3 }, 1.15, 0.85);
      for (let i = 0; i < 3; i++) b.sphere(0.1, 0x9fb8c8, { pos: [w - 0.45, 1.1 - i * 0.25, 0.4], scale: [0.5, 0.8, 1.6] });
      b.box(0.06, 1.3, 0.06, 0x8a5a3a, { pos: [w - 0.45, 0.65, 0.2] });
      b.torus(0.3, 0.025, 0xd8c8a0, { pos: [w - 0.4, 0.55, d - 0.3], rot: [0, 0.4, 0] });
      b.lathe([[0, 0], [0.25, 0.03], [0.32, 0.18], [0.3, 0.22]], [0x8a5a3a, 0xc8925a], { pos: [w - 0.5, 0, d - 0.35], scale: [1, 1, 2.2], rot: [0, 0.3, 0] }, 8);
      break;
    }
    case 'h_bakery': {
      H({ w: 2.6, d: 2.0, h: 1.5, windows: 2, roofH: 1.0, chimney: true, door: 0 }, cx, cz - 0.2);
      const front = cz - 0.2 + 1.0;
      for (let i = 0; i < 6; i++) b.box(2.6 / 6, 0.05, 0.6, i % 2 ? 0xfff4e0 : 0xe8a33a, { pos: [cx - 1.3 + (i + 0.5) * (2.6 / 6), 1.45, front + 0.28], rot: [0.35, 0, 0] });
      b.torus(0.16, 0.06, 0xe8b86a, { pos: [cx + 0.95, 1.95, front + 0.12] });
      b.box(0.9, 0.5, 0.4, 0xc8925a, { pos: [cx - 0.6, 0.25, d - 0.25], tex: TEX.plank });
      for (let k = 0; k < 3; k++) b.capsule(0.06, 0.25, 0xe8b86a, { pos: [cx - 0.85 + k * 0.25, 0.55, d - 0.25], rot: [0, 0, Math.PI / 2] });
      smoke.push(new THREE.Vector3(cx + 0.7, 2.9, cz - 0.4));
      lights.push(new THREE.Vector3(cx, 1.4, d - 0.2));
      break;
    }
    case 'h_weaver': {
      H({ w: 2.5, d: 1.3, h: 1.3, windows: 2, roofH: 0.8, door: 0.6 }, cx, 0.8);
      b.box(0.9, 0.7, 0.06, 0x8a5a3a, { pos: [0.7, 0.45, d - 0.25], tex: TEX.plank });
      for (let i = 0; i < 6; i++) b.box(0.02, 0.6, 0.02, [0xe85a5a, 0xffd03a, 0x5ab8e8][i % 3], { pos: [0.35 + i * 0.14, 0.45, d - 0.21] });
      for (let i = 0; i < 3; i++) b.sphere(0.12, [0xff9ac8, 0x8ad07a, 0xb08ae8][i], { pos: [w - 0.9 + i * 0.28, 0.12, d - 0.25] }, 8);
      break;
    }
    case 'h_smithy': {
      b.rbox(1.5, 1.1, 1.3, 0x9a948a, { pos: [0.95, 0.55, 1.0], tex: TEX.stone }, 0.2);
      b.cyl(0.3, 0.4, 1.3, 0x8a7a72, { pos: [0.95, 1.7, 0.8], tex: TEX.brick }, 8);
      b.box(0.6, 0.45, 0.06, 0x2a1a1a, { pos: [0.95, 0.42, 1.66] });
      win.box(0.45, 0.3, 0.04, 0xffffff, { pos: [0.95, 0.4, 1.7] });
      for (const [x, z] of [[1.9, 0.4], [w - 0.2, 0.4], [1.9, 1.8], [w - 0.2, 1.8]]) b.box(0.1, 1.3, 0.1, 0x8a5a3a, { pos: [x, 0.65, z] });
      b.box(1.3, 0.08, 1.7, roof, { pos: [2.35, 1.32, 1.1], rot: [0, 0, 0.12], tex: TEX.shingle });
      b.box(0.5, 0.2, 0.25, 0x5a5a6a, { pos: [2.3, 0.55, 1.2] }); // anvil
      b.box(0.25, 0.35, 0.2, 0x5a5a6a, { pos: [2.3, 0.28, 1.2] });
      barrel(2.6, d - 0.4);
      smoke = [new THREE.Vector3(0.95, 2.45, 0.8)];
      lights.push(new THREE.Vector3(0.95, 0.6, 1.9));
      door = new THREE.Vector3(1.8, 0, d + 0.3);
      break;
    }
    case 'h_apiary': {
      for (let i = 0; i < 3; i++) {
        const x = 0.55 + i * 0.95;
        b.box(0.12, 0.3, 0.12, 0x8a5a3a, { pos: [x, 0.15, 0.7] });
        for (let k = 0; k < 3; k++) b.rbox(0.5, 0.18, 0.5, k % 2 ? 0xf4d27a : 0xffc42a, { pos: [x, 0.4 + k * 0.18, 0.7], tex: TEX.plank }, 0.3);
        b.roof(0.5, 0.18, 0.5, 0xc8925a, { pos: [x, 0.92, 0.7] }, 0.06);
      }
      for (let i = 0; i < 10; i++) b.sphere(0.08, [0xb08ae8, 0xffd03a, 0xff8ab8, 0xffffff][i % 4], { pos: [0.3 + i * 0.27, 0.1, d - 0.3 - (i % 2) * 0.2], scale: [1, 0.6, 1] }, 5);
      door = new THREE.Vector3(cx, 0, d + 0.3);
      break;
    }
    case 'h_tavern': {
      H({ w: 3.5, d: 2.0, h: 1.7, windows: 3, roofH: 1.15, chimney: true, door: 0.2, timber: true }, cx, cz - 0.3);
      const front = cz - 0.3 + 1.0;
      b.box(0.06, 0.06, 0.6, 0x5a4a3a, { pos: [cx - 1.2, 1.75, front + 0.3] });
      b.rbox(0.55, 0.4, 0.05, 0xffd03a, { pos: [cx - 1.2, 1.5, front + 0.55] }, 0.4);
      b.cyl(0.08, 0.08, 0.16, 0xfff4e0, { pos: [cx - 1.2, 1.5, front + 0.6], rot: [Math.PI / 2, 0, 0] }, 8);
      barrel(0.35, d - 0.35);
      barrel(0.75, d - 0.3);
      b.box(1.0, 0.07, 0.4, 0xb07a4a, { pos: [w - 0.9, 0.42, d - 0.3], tex: TEX.plank });
      for (const sx of [-0.4, 0.4]) b.box(0.06, 0.4, 0.3, 0x8a5a3a, { pos: [w - 0.9 + sx, 0.2, d - 0.3] });
      lights.push(new THREE.Vector3(cx, 1.5, d - 0.2));
      break;
    }
    case 'h_market': {
      for (const sx of [0.3, cx, w - 0.3]) for (const sz of [0.4, d - 0.4]) b.box(0.18, 1.9, 0.18, 0x8a5a3a, { pos: [sx, 0.95, sz], tex: TEX.plank });
      b.roof(w - 0.3, 0.9, d - 0.5, roof, { pos: [cx, 1.9, cz], tex: TEX.shingle }, 0.3);
      b.box(w, 0.1, d, 0xb8b0a0, { pos: [cx, 0.05, cz], tex: TEX.cobble });
      const cols = [0xe85a5a, 0xffd03a, 0x8ad07a, 0xff8a3a];
      for (let i = 0; i < 2; i++) {
        const x = 1.0 + i * 2.0;
        b.box(1.4, 0.65, 0.7, 0xc8925a, { pos: [x, 0.38, cz], tex: TEX.plank });
        for (let k = 0; k < 6; k++) b.sphere(0.11, cols[(i + k) % 4], { pos: [x - 0.5 + k * 0.2, 0.78, cz + (k % 2) * 0.15] }, 6);
      }
      for (let i = 0; i < 9; i++) b.box(0.25, 0.3, 0.02, [0xff6a8a, 0xffd03a, 0x6ad8ff][i % 3], { pos: [0.4 + i * (w - 0.8) / 8, 1.75, d - 0.25], rot: [0, 0, Math.PI / 4] });
      lights.push(new THREE.Vector3(cx, 1.7, cz));
      break;
    }
    case 'h_well':
      b.cyl(0.45, 0.48, 0.5, 0xb8b0a0, { pos: [0.5, 0.25, 0.5], tex: TEX.stone }, 12);
      b.cyl(0.36, 0.36, 0.03, 0x4a8ab8, { pos: [0.5, 0.42, 0.5] }, 12);
      for (const sx of [-0.4, 0.4]) b.box(0.07, 0.9, 0.07, 0x8a5a3a, { pos: [0.5 + sx, 0.8, 0.5] });
      b.roof(0.9, 0.35, 0.7, roof, { pos: [0.5, 1.2, 0.5], tex: TEX.shingle }, 0.08);
      b.cyl(0.04, 0.04, 0.8, 0x8a5a3a, { pos: [0.5, 1.0, 0.5], rot: [0, 0, Math.PI / 2] }, 6);
      b.cyl(0.1, 0.08, 0.14, 0x9a6a3a, { pos: [0.5, 0.75, 0.5] }, 8);
      door = new THREE.Vector3(0.5, 0, 1.3);
      break;
    case 'h_bandstand': {
      b.cyl(1.4, 1.45, 0.3, 0xd8d0c0, { pos: [cx, 0.15, cz], tex: TEX.stone }, 8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.cyl(0.06, 0.06, 1.5, 0xffffff, { pos: [cx + Math.sin(a) * 1.25, 1.05, cz + Math.cos(a) * 1.25] }, 6);
      }
      b.cone(1.65, 0.9, roof, { pos: [cx, 2.2, cz], tex: TEX.shingle }, 8);
      b.sphere(0.12, 0xffd03a, { pos: [cx, 2.7, cz] }, 8);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        b.sphere(0.05, [0xff6a8a, 0xffd03a, 0x6ad8ff, 0x8ad07a][i % 4], { pos: [cx + Math.sin(a) * 1.5, 1.75, cz + Math.cos(a) * 1.5] }, 5);
      }
      b.box(0.08, 0.6, 0.08, 0x3a3a3a, { pos: [cx - 0.3, 0.6, cz] });
      b.torus(0.12, 0.03, 0xffd03a, { pos: [cx + 0.35, 0.55, cz], rot: [0, 0.6, 0] });
      lights.push(new THREE.Vector3(cx, 1.8, cz));
      break;
    }
    case 'h_statue': {
      b.box(1.3, 0.5, 1.3, 0xc8c0b0, { pos: [cx, 0.25, cz], tex: TEX.stone });
      b.box(1.0, 0.25, 1.0, 0xb8b0a0, { pos: [cx, 0.62, cz], tex: TEX.stone });
      b.capsule(0.22, 0.4, 0xd8d0c8, { pos: [cx, 1.15, cz] });
      b.sphere(0.32, 0xd8d0c8, { pos: [cx, 1.75, cz] }, 12);
      b.cyl(0.36, 0.42, 0.12, 0xd8d0c8, { pos: [cx, 1.95, cz] }, 10);
      b.box(0.09, 0.45, 0.09, 0xd8d0c8, { pos: [cx + 0.3, 1.45, cz], rot: [0, 0, -2.4] });
      b.box(0.7, 0.18, 0.04, 0xd8b04a, { pos: [cx, 0.3, cz + 0.66] });
      lights.push(new THREE.Vector3(cx, 1.2, cz + 0.8));
      break;
    }
  }
  return { geo: b.build(), windows: win.parts.length ? win.build() : null, smoke, door, lights };
}
