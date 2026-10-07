import * as THREE from 'three';
import { mb, ModelBuilder } from './Builder';
import { vcMat, outlineMat, basicMat } from '../render/Materials';
import type { Appearance } from '../state/types';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../data/wardrobe';
import { TOOL_TIER_COLORS } from '../data/constants';

/**
 * Chibi character: big round head, small rounded body, stubby limbs.
 * Parts are merged per animated bone (head, torso, arms, legs) for few draw calls.
 */

const HEAD_Y = 0.86;
const HEAD_R = 0.33;

function darker(c: number, f = 0.8): number {
  const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
function lighter(c: number, f = 0.25): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
}

function buildHair(b: ModelBuilder, style: number, color: number): void {
  const R = HEAD_R;
  const c2 = darker(color, 0.85);
  switch (style) {
    case 0: // short
      b.sphere(R * 1.06, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      b.sphere(R * 0.5, color, { pos: [0.1, 0.2, 0.2], scale: [1.4, 0.5, 0.8] });
      break;
    case 1: // swept fringe
      b.sphere(R * 1.07, color, { pos: [0, 0.06, -0.04], scale: [1, 0.86, 1] }, 14);
      b.sphere(R * 0.55, c2, { pos: [0.12, 0.17, 0.22], rot: [0.3, 0, -0.5], scale: [1.6, 0.45, 0.8] });
      b.cone(0.08, 0.2, color, { pos: [-0.2, -0.05, 0.18], rot: [0.4, 0, 0.6] });
      break;
    case 2: // pigtails
      b.sphere(R * 1.06, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      b.sphere(0.13, color, { pos: [-0.36, -0.05, -0.05] });
      b.sphere(0.13, color, { pos: [0.36, -0.05, -0.05] });
      b.sphere(0.05, 0xff6a8a, { pos: [-0.3, 0.05, -0.02] });
      b.sphere(0.05, 0xff6a8a, { pos: [0.3, 0.05, -0.02] });
      break;
    case 3: // spiky
      b.sphere(R * 1.04, color, { pos: [0, 0.04, -0.03], scale: [1, 0.85, 1] }, 14);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 1.6 - Math.PI * 0.8;
        b.cone(0.09, 0.22, color, { pos: [Math.sin(a) * 0.2, 0.28, Math.cos(a) * 0.12 - 0.05], rot: [Math.cos(a) * -0.6, 0, Math.sin(a) * -0.6] });
      }
      break;
    case 4: // bun
      b.sphere(R * 1.05, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      b.sphere(0.15, color, { pos: [0, 0.36, -0.08] });
      break;
    case 5: // braids
      b.sphere(R * 1.06, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.sphere(0.065 - i * 0.006, i % 2 ? c2 : color, { pos: [sx * 0.27, -0.12 - i * 0.1, 0.0] });
      break;
    case 6: // wise bald + beard
      b.sphere(0.12, color, { pos: [-0.3, 0.02, -0.06], scale: [0.8, 1, 1.2] });
      b.sphere(0.12, color, { pos: [0.3, 0.02, -0.06], scale: [0.8, 1, 1.2] });
      b.sphere(0.2, color, { pos: [0, -0.2, 0.2], scale: [1.1, 1, 0.7] });
      b.sphere(0.12, color, { pos: [0, -0.33, 0.18] });
      break;
    case 7: // curly bob
      b.sphere(R * 1.05, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.sphere(0.1, i % 2 ? c2 : color, { pos: [Math.sin(a) * 0.32, -0.08 + (i % 3) * 0.04, Math.cos(a) * 0.28 - 0.04] });
      }
      break;
    case 8: // ponytail
      b.sphere(R * 1.06, color, { pos: [0, 0.05, -0.03], scale: [1, 0.85, 1] }, 14);
      b.sphere(0.06, 0xff6a8a, { pos: [0, 0.12, -0.33] });
      b.capsule(0.08, 0.22, color, { pos: [0, -0.06, -0.38], rot: [0.35, 0, 0] });
      break;
    case 9: // fluffy afro
      b.sphere(R * 1.35, color, { pos: [0, 0.1, -0.05] }, 14);
      break;
  }
}

function buildHat(b: ModelBuilder, hat: string, color: number): void {
  const top = HEAD_R * 0.85;
  switch (hat) {
    case 'straw':
      b.cyl(0.52, 0.52, 0.03, color, { pos: [0, top - 0.02, 0] }, 18);
      b.cyl(0.24, 0.28, 0.18, color, { pos: [0, top + 0.08, -0.02] }, 14);
      b.cyl(0.285, 0.285, 0.05, 0xe85a5a, { pos: [0, top + 0.02, -0.02] }, 14);
      break;
    case 'cap':
      b.sphere(0.34, color, { pos: [0, top - 0.06, -0.02], scale: [1, 0.6, 1] }, 14);
      b.cyl(0.2, 0.2, 0.03, darker(color), { pos: [0, top - 0.05, 0.3], scale: [1, 1, 0.9] }, 14);
      break;
    case 'beanie':
      b.sphere(0.35, color, { pos: [0, top - 0.04, -0.02], scale: [1, 0.75, 1] }, 14);
      b.torus(0.3, 0.05, darker(color), { pos: [0, top - 0.1, -0.02], rot: [Math.PI / 2, 0, 0] });
      b.sphere(0.09, 0xffffff, { pos: [0, top + 0.24, -0.02] });
      break;
    case 'flower':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.sphere(0.07, [0xffd03a, 0xff8ab8, 0xffffff, 0x8ad8ff][i % 4], { pos: [Math.sin(a) * 0.3, top - 0.03, Math.cos(a) * 0.3 - 0.02] });
      }
      break;
    case 'bandana':
      b.sphere(0.345, color, { pos: [0, top - 0.08, -0.02], scale: [1, 0.55, 1] }, 14);
      b.cone(0.07, 0.16, color, { pos: [0, top - 0.12, -0.36], rot: [-1.2, 0, 0] });
      break;
    case 'explorer':
      b.sphere(0.36, color, { pos: [0, top - 0.04, -0.02], scale: [1, 0.75, 1] }, 14);
      b.cyl(0.46, 0.46, 0.03, darker(color), { pos: [0, top - 0.06, -0.02] }, 18);
      b.cyl(0.36, 0.36, 0.04, 0x8a5a3a, { pos: [0, top - 0.02, -0.02] }, 14);
      break;
    case 'cowboy':
      b.cyl(0.5, 0.5, 0.03, color, { pos: [0, top - 0.02, 0], scale: [1, 1, 0.8] }, 18);
      b.cyl(0.18, 0.24, 0.24, color, { pos: [0, top + 0.1, -0.02] }, 12);
      b.cyl(0.245, 0.245, 0.05, 0x3a2a22, { pos: [0, top + 0.02, -0.02] }, 12);
      break;
    case 'chef':
      b.cyl(0.28, 0.26, 0.2, 0xffffff, { pos: [0, top + 0.04, -0.02] }, 14);
      b.sphere(0.3, 0xffffff, { pos: [0, top + 0.24, -0.02], scale: [1.1, 0.7, 1.1] }, 12);
      break;
    case 'bunny':
      b.capsule(0.07, 0.3, 0xffffff, { pos: [-0.14, top + 0.2, -0.04], rot: [0, 0, 0.2] });
      b.capsule(0.07, 0.3, 0xffffff, { pos: [0.14, top + 0.2, -0.04], rot: [0, 0, -0.2] });
      b.capsule(0.035, 0.22, 0xffb8c8, { pos: [-0.14, top + 0.2, -0.0], rot: [0, 0, 0.2] });
      b.capsule(0.035, 0.22, 0xffb8c8, { pos: [0.14, top + 0.2, -0.0], rot: [0, 0, -0.2] });
      break;
    case 'frog':
      b.sphere(0.36, 0x6ac85a, { pos: [0, top - 0.04, -0.02], scale: [1, 0.7, 1] }, 14);
      b.sphere(0.1, 0x6ac85a, { pos: [-0.16, top + 0.15, 0.12] });
      b.sphere(0.1, 0x6ac85a, { pos: [0.16, top + 0.15, 0.12] });
      b.sphere(0.055, 0xffffff, { pos: [-0.16, top + 0.17, 0.2] });
      b.sphere(0.055, 0xffffff, { pos: [0.16, top + 0.17, 0.2] });
      b.sphere(0.03, 0x1a1a1a, { pos: [-0.16, top + 0.17, 0.25] });
      b.sphere(0.03, 0x1a1a1a, { pos: [0.16, top + 0.17, 0.25] });
      break;
    case 'witch':
      b.cyl(0.5, 0.5, 0.03, 0x4a3a6a, { pos: [0, top - 0.02, 0] }, 18);
      b.cone(0.26, 0.55, 0x4a3a6a, { pos: [0, top + 0.27, -0.04], rot: [-0.15, 0, 0.1] }, 12);
      b.cyl(0.265, 0.265, 0.05, 0xffb02e, { pos: [0, top + 0.03, -0.02] }, 12);
      break;
    case 'crown':
      b.cyl(0.24, 0.24, 0.1, 0x6aa84f, { pos: [0, top + 0.04, 0] }, 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.cone(0.05, 0.13, 0x8ad07a, { pos: [Math.sin(a) * 0.22, top + 0.14, Math.cos(a) * 0.22] });
        b.sphere(0.035, 0xffd03a, { pos: [Math.sin(a) * 0.22, top + 0.22, Math.cos(a) * 0.22] });
      }
      break;
  }
}

function buildAccessoryHead(b: ModelBuilder, acc: string): void {
  if (acc === 'glasses') {
    b.torus(0.075, 0.015, 0x3a2a22, { pos: [-0.12, 0.0, HEAD_R * 0.93] });
    b.torus(0.075, 0.015, 0x3a2a22, { pos: [0.12, 0.0, HEAD_R * 0.93] });
    b.box(0.08, 0.015, 0.015, 0x3a2a22, { pos: [0, 0.01, HEAD_R * 0.95] });
  }
  if (acc === 'flower_pin') {
    b.sphere(0.07, 0xff5a8a, { pos: [0.28, 0.12, 0.1] });
    b.sphere(0.035, 0xffd03a, { pos: [0.31, 0.13, 0.14] });
  }
}

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  toolSlot: THREE.Group;
  shadow: THREE.Mesh;
  outlines: THREE.Mesh[];
}

const blobShadowGeo = new THREE.CircleGeometry(0.35, 16).rotateX(-Math.PI / 2);
export const blobShadowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a10, transparent: true, opacity: 0.22, depthWrite: false });

export function buildCharacter(look: Appearance, opts: { outline?: boolean; scale?: number } = {}): CharacterRig {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const hair = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const eyeCol = EYE_COLORS[look.eyeColor % EYE_COLORS.length];
  const mat = vcMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const outlines: THREE.Mesh[] = [];

  // ---------- torso ----------
  const tb = mb();
  const top = look.topColor;
  const bottomCol = look.bottomColor;
  tb.sphere(0.24, top, { pos: [0, 0.44, 0], scale: [1, 1.05, 0.85] }, 12);
  switch (look.top) {
    case 'overalls':
      tb.sphere(0.243, 0xfff4e8, { pos: [0, 0.48, 0.0], scale: [1, 0.65, 0.84] }, 12);
      tb.box(0.26, 0.16, 0.05, top, { pos: [0, 0.48, 0.19] });
      tb.box(0.04, 0.2, 0.04, top, { pos: [-0.1, 0.58, 0.17], rot: [0.2, 0, 0] });
      tb.box(0.04, 0.2, 0.04, top, { pos: [0.1, 0.58, 0.17], rot: [0.2, 0, 0] });
      tb.sphere(0.025, 0xffd03a, { pos: [-0.1, 0.55, 0.22] });
      tb.sphere(0.025, 0xffd03a, { pos: [0.1, 0.55, 0.22] });
      break;
    case 'hoodie':
      tb.sphere(0.16, darker(top, 0.9), { pos: [0, 0.62, -0.15], scale: [1.2, 0.8, 0.7] });
      tb.box(0.18, 0.08, 0.04, darker(top, 0.85), { pos: [0, 0.36, 0.2] });
      break;
    case 'vest':
      tb.sphere(0.243, 0xfff8ec, { pos: [0, 0.44, 0.01], scale: [0.5, 1.0, 0.86] }, 12);
      break;
    case 'dress':
      tb.cone(0.32, 0.38, top, { pos: [0, 0.27, 0] }, 14);
      tb.sphere(0.05, 0xffffff, { pos: [0, 0.58, 0.19] });
      break;
    case 'raincoat':
      tb.cone(0.3, 0.42, top, { pos: [0, 0.32, 0] }, 12);
      tb.box(0.03, 0.3, 0.02, darker(top), { pos: [0, 0.38, 0.22] });
      break;
    case 'apron':
      tb.box(0.26, 0.32, 0.03, lighter(top, 0.1), { pos: [0, 0.4, 0.2] });
      tb.box(0.12, 0.08, 0.02, darker(top, 0.85), { pos: [0, 0.34, 0.215] });
      break;
    case 'explorer':
      tb.box(0.08, 0.07, 0.03, darker(top), { pos: [-0.1, 0.5, 0.2] });
      tb.box(0.08, 0.07, 0.03, darker(top), { pos: [0.1, 0.5, 0.2] });
      tb.box(0.4, 0.05, 0.26, 0x6a4a2a, { pos: [0, 0.3, 0] });
      break;
    case 'sweater':
      tb.torus(0.14, 0.05, lighter(top, 0.2), { pos: [0, 0.64, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 3; i++) tb.box(0.42, 0.025, 0.36, darker(top, 0.85), { pos: [0, 0.36 + i * 0.09, 0], scale: [1, 1, 0.9] });
      break;
    case 'kimono':
      tb.box(0.1, 0.36, 0.03, 0xffffff, { pos: [0, 0.44, 0.2], rot: [0, 0, 0.3] });
      tb.box(0.42, 0.06, 0.3, 0xe85a5a, { pos: [0, 0.34, 0] });
      break;
    case 'starcloak':
      tb.cone(0.36, 0.5, 0x2f3a6a, { pos: [0, 0.38, -0.06] }, 12);
      for (let i = 0; i < 6; i++) tb.sphere(0.025, 0xfff0a0, { pos: [Math.sin(i * 2.1) * 0.22, 0.25 + (i % 3) * 0.1, -0.2 - (i % 2) * 0.05] });
      break;
    default: // tee
      tb.sphere(0.03, 0xffffff, { pos: [0, 0.48, 0.21] });
      break;
  }
  // bottom part of torso / hips
  if (look.top !== 'dress' && look.top !== 'raincoat') {
    if (look.bottom === 'skirt') tb.cone(0.3, 0.22, bottomCol, { pos: [0, 0.24, 0] }, 14);
    else tb.sphere(0.22, bottomCol, { pos: [0, 0.3, 0], scale: [1, 0.55, 0.85] }, 12);
  }
  // accessories on body
  if (look.accessory === 'scarf') {
    tb.torus(0.15, 0.06, 0xe85a5a, { pos: [0, 0.63, 0], rot: [Math.PI / 2, 0, 0] });
    tb.box(0.08, 0.2, 0.04, 0xe85a5a, { pos: [0.1, 0.52, 0.18], rot: [0, 0, 0.2] });
  }
  if (look.accessory === 'backpack') {
    tb.rbox(0.3, 0.32, 0.16, 0xc8803a, { pos: [0, 0.48, -0.25] });
    tb.box(0.22, 0.1, 0.04, 0xa8602a, { pos: [0, 0.44, -0.34] });
  }
  if (look.accessory === 'bell') {
    tb.torus(0.14, 0.025, 0xe85a5a, { pos: [0, 0.63, 0], rot: [Math.PI / 2, 0, 0] });
    tb.sphere(0.05, 0xffd03a, { pos: [0, 0.57, 0.16] });
  }
  if (look.accessory === 'wings') {
    tb.sphere(0.22, 0xd8f0ff, { pos: [-0.2, 0.55, -0.24], rot: [0, 0.5, 0.5], scale: [1, 0.6, 0.12] });
    tb.sphere(0.22, 0xd8f0ff, { pos: [0.2, 0.55, -0.24], rot: [0, -0.5, -0.5], scale: [1, 0.6, 0.12] });
  }
  const torso = tb.mesh(mat);
  body.add(torso);

  // ---------- head ----------
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  body.add(head);
  const hb = mb();
  hb.sphere(HEAD_R, skin, { scale: [1.05, 0.95, 1] }, 18);
  hb.sphere(0.06, skin, { pos: [-HEAD_R * 1.0, -0.02, 0], scale: [0.6, 1, 1] }); // ears
  hb.sphere(0.06, skin, { pos: [HEAD_R * 1.0, -0.02, 0], scale: [0.6, 1, 1] });
  if (look.cheeks) {
    hb.sphere(0.055, 0xff9aa8, { pos: [-0.17, -0.09, HEAD_R * 0.86], scale: [1.2, 0.7, 0.4] });
    hb.sphere(0.055, 0xff9aa8, { pos: [0.17, -0.09, HEAD_R * 0.86], scale: [1.2, 0.7, 0.4] });
  }
  // little smile
  hb.torus(0.035, 0.011, 0x5a2a2a, { pos: [0, -0.1, HEAD_R * 0.97], rot: [0, 0, Math.PI] }, Math.PI);
  hb.sphere(0.022, darker(skin, 0.92), { pos: [0, -0.04, HEAD_R * 1.0] }); // nose
  buildHair(hb, look.hairStyle, hair);
  buildHat(hb, look.hat, look.hatColor);
  buildAccessoryHead(hb, look.accessory);
  const headMesh = hb.mesh(mat);
  head.add(headMesh);

  // eyes (separate for blinking)
  const eb = mb();
  const eyeStyle = look.eyeStyle % 5;
  for (const sx of [-1, 1]) {
    const x = sx * 0.12;
    if (eyeStyle === 1) {
      eb.torus(0.045, 0.016, 0x2a1e1a, { pos: [x, 0.02, HEAD_R * 0.95] }, Math.PI); // happy closed arcs
    } else {
      const sc: [number, number, number] = eyeStyle === 4 ? [0.8, 1.15, 0.5] : eyeStyle === 3 ? [1, 0.85, 0.5] : [1, 1.2, 0.5];
      eb.sphere(0.06, eyeCol, { pos: [x, 0.0, HEAD_R * 0.9], scale: sc }, 10);
      eb.sphere(0.022, 0xffffff, { pos: [x + 0.018, 0.03, HEAD_R * 0.9 + 0.032] }, 6);
      if (eyeStyle === 2) eb.sphere(0.012, 0xffffff, { pos: [x - 0.02, -0.025, HEAD_R * 0.9 + 0.03] }, 5);
    }
  }
  const eyes = new THREE.Mesh(eb.build(), mat);
  head.add(eyes);

  // ---------- arms ----------
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.24, 0.56, 0);
    const ab = mb();
    const sleeveLong = ['hoodie', 'raincoat', 'sweater', 'explorer', 'kimono', 'starcloak'].includes(look.top);
    ab.capsule(0.065, 0.14, sleeveLong ? top : skin, { pos: [side * 0.04, -0.1, 0], rot: [0, 0, side * 0.25] });
    if (!sleeveLong) ab.sphere(0.075, top, { pos: [side * 0.01, -0.02, 0] });
    ab.sphere(0.072, skin, { pos: [side * 0.08, -0.22, 0] });
    const m = ab.mesh(mat);
    g.add(m);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  body.add(armL, armR);
  const toolSlot = new THREE.Group();
  toolSlot.position.set(0.08, -0.22, 0.02);
  armR.add(toolSlot);

  // ---------- legs ----------
  const shoeCol = look.shoesColor;
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.1, 0.24, 0);
    const lb = mb();
    const legCol = look.bottom === 'shorts' || look.bottom === 'skirt' || look.top === 'dress' ? skin : bottomCol;
    lb.cyl(0.07, 0.065, 0.16, legCol, { pos: [0, -0.08, 0] });
    if (look.bottom === 'shorts') lb.cyl(0.085, 0.085, 0.06, bottomCol, { pos: [0, -0.01, 0] });
    // shoe
    lb.sphere(0.085, shoeCol, { pos: [0, -0.17, 0.035], scale: [1, 0.65, 1.35] });
    if (look.shoes === 'sneakers') lb.cyl(0.09, 0.09, 0.03, 0xffffff, { pos: [0, -0.21, 0.035], scale: [1, 1, 1.35] });
    if (look.shoes === 'boots' || look.shoes === 'rainboots') lb.cyl(0.075, 0.075, 0.1, shoeCol, { pos: [0, -0.12, 0] });
    g.add(lb.mesh(mat));
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  body.add(legL, legR);

  if (opts.outline) {
    for (const src of [torso, headMesh]) {
      const o = new THREE.Mesh(src.geometry, outlineMat);
      o.scale.setScalar(1.06);
      o.castShadow = false;
      src.parent!.add(o);
      outlines.push(o);
    }
  }

  const shadow = new THREE.Mesh(blobShadowGeo, blobShadowMat);
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  root.add(shadow);

  const sc = opts.scale ?? 1;
  root.scale.setScalar(sc);
  return { root, body, head, eyes, armL, armR, legL, legR, toolSlot, shadow, outlines };
}

/** Tool meshes held in the hand. */
export function buildToolMesh(tool: string, tier: number): THREE.Mesh {
  const b = mb();
  const metal = TOOL_TIER_COLORS[tier] ?? 0xb98a5a;
  const handle = 0x9a6a3a;
  switch (tool) {
    case 'hoe':
      b.cyl(0.02, 0.02, 0.55, handle, { pos: [0, 0.1, 0] });
      b.box(0.16, 0.03, 0.09, metal, { pos: [0.05, 0.37, 0.02] });
      break;
    case 'can':
      b.cyl(0.1, 0.11, 0.17, metal === 0xb98a5a ? 0x6ab8e8 : metal, { pos: [0, -0.05, 0.06] }, 10);
      b.cyl(0.015, 0.025, 0.2, metal === 0xb98a5a ? 0x6ab8e8 : metal, { pos: [0, 0.0, 0.2], rot: [1.0, 0, 0] });
      b.torus(0.06, 0.015, 0x5a5a6a, { pos: [0, 0.07, 0.0], rot: [0, Math.PI / 2, 0] }, Math.PI);
      break;
    case 'axe':
      b.cyl(0.02, 0.02, 0.45, handle, { pos: [0, 0.08, 0] });
      b.box(0.04, 0.13, 0.16, metal, { pos: [0, 0.28, 0.07] });
      break;
    case 'pickaxe':
      b.cyl(0.02, 0.02, 0.45, handle, { pos: [0, 0.08, 0] });
      b.torus(0.14, 0.025, metal, { pos: [0, 0.27, 0], rot: [0, Math.PI / 2, 0] }, Math.PI);
      break;
    case 'rod':
      b.cyl(0.012, 0.022, 0.9, handle, { pos: [0, 0.35, 0.1], rot: [0.5, 0, 0] });
      b.cyl(0.03, 0.03, 0.05, metal, { pos: [0, 0.0, -0.02], rot: [0, 0, Math.PI / 2] });
      break;
    case 'sickle':
      b.cyl(0.02, 0.02, 0.2, handle, { pos: [0, 0.0, 0] });
      b.torus(0.1, 0.018, metal, { pos: [0, 0.16, 0.05], rot: [0, Math.PI / 2, 0] }, Math.PI * 1.2);
      break;
    case 'net':
      b.cyl(0.015, 0.015, 0.5, handle, { pos: [0, 0.15, 0] });
      b.torus(0.1, 0.012, 0xffffff, { pos: [0, 0.45, 0], rot: [Math.PI / 2, 0, 0] });
      break;
  }
  const m = new THREE.Mesh(b.build(), vcMat());
  m.castShadow = true;
  return m;
}

export function npcEmoteMaterial(): THREE.Material {
  return basicMat(0xffffff);
}
