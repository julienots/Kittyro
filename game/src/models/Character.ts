import * as THREE from 'three';
import { mb, ModelBuilder, type Vec3 } from './Builder';
import { vcMat, outlineMat, basicMat } from '../render/Materials';
import type { Appearance } from '../state/types';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../data/wardrobe';
import { TOOL_TIER_COLORS } from '../data/constants';

/**
 * Stylised character with believable proportions: a slightly large head (cosy
 * look) on a real torso with neck, shoulders, two-segment arms with hands and
 * thumbs, thighs, shins and soled shoes. Detailed face (eye whites, irises,
 * pupils, eyelids, brows, nose, mouth, ears) and hair built from shaped locks.
 * Parts are merged per animated bone (head, torso, arms, legs) — few draw calls.
 */

export const HEAD_Y = 1.12;
const R = 0.2; // head radius
const SHOULDER_Y = 0.875;
const HIP_Y = 0.5;

/** Tops that cover the whole arm. */
export const LONG_SLEEVE_TOPS = new Set(['hoodie', 'raincoat', 'sweater', 'explorer', 'kimono', 'starcloak', 'shirt', 'jacket']);

function darker(c: number, f = 0.8): number {
  const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
function lighter(c: number, f = 0.25): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
}
function mix(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

// ------------------------------------------------------------------ hair
/** Point on the head surface: yaw (0 = front, + = to the character's left), pitch (0 = equator, + = up). */
function onHead(yaw: number, pitch: number, r = R * 1.04): Vec3 {
  return [Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r + 0.012, Math.cos(yaw) * Math.cos(pitch) * r * 0.97];
}

/** Hair cap covering the skull, open at the face. */
function hairCap(b: ModelBuilder, color: number, size = 1.07, cover = 0.6, tilt = -0.55): void {
  b.shell(R * size, [darker(color, 0.85), color], Math.PI * cover, { pos: [0, 0.018, -0.012], rot: [tilt, 0, 0], scale: [1.02, 1.02, 1] }, 20);
  // back of the head fully covered
  b.shell(R * size * 0.995, darker(color, 0.9), Math.PI * 0.62, { pos: [0, 0.0, -0.02], rot: [-Math.PI * 0.5 - 0.2, 0, 0] }, 18);
}

/** A row of fringe locks across the forehead. */
function fringe(b: ModelBuilder, color: number, n: number, opts: { from?: number; to?: number; len?: number; sweep?: number; width?: number; lift?: number } = {}): void {
  const from = opts.from ?? -0.9, to = opts.to ?? 0.9, len = opts.len ?? 0.07, sweep = opts.sweep ?? 0, w = opts.width ?? 0.03, lift = opts.lift ?? 0.62;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const yaw = from + (to - from) * t;
    const a = onHead(yaw, lift, R * 1.08);
    const c = onHead(yaw + sweep, lift - 0.42 - len * 1.5, R * 1.1);
    b.limb(a, c, w, w * 0.35, i % 2 ? color : darker(color, 0.9), 7);
  }
}

/** Hanging locks (long hair), around the back/sides. */
function curtain(b: ModelBuilder, color: number, yaw0: number, yaw1: number, n: number, len: number, wave = 0, w = 0.042): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const yaw = yaw0 + (yaw1 - yaw0) * t;
    const top = onHead(yaw, 0.35, R * 1.07);
    const out = 1.12 + Math.abs(Math.sin(yaw)) * 0.05;
    const mid: Vec3 = [Math.sin(yaw) * R * out, -0.08, Math.cos(yaw) * R * out * 0.95];
    const end: Vec3 = [Math.sin(yaw) * R * (out + 0.06) + (wave ? Math.sin(i * 1.7) * wave : 0), -0.08 - len, Math.cos(yaw) * R * (out + 0.04) * 0.95 - 0.02];
    const col = i % 3 === 1 ? darker(color, 0.88) : color;
    b.limb(top, mid, w, w * 0.95, col, 7);
    if (wave) {
      const m2: Vec3 = [(mid[0] + end[0]) / 2 + Math.sin(i * 2.3) * wave, (mid[1] + end[1]) / 2, (mid[2] + end[2]) / 2 + Math.cos(i * 1.3) * wave];
      b.limb(mid, m2, w * 0.95, w * 0.85, col, 7);
      b.limb(m2, end, w * 0.85, w * 0.4, col, 7);
    } else b.limb(mid, end, w * 0.95, w * 0.45, col, 7);
  }
}

function braid(b: ModelBuilder, color: number, start: Vec3, dir: Vec3, n: number, r: number, tie = 0xff6a8a): void {
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const p: Vec3 = [start[0] + dir[0] * i + Math.sin(i * 2.4) * 0.008, start[1] + dir[1] * i, start[2] + dir[2] * i];
    b.sphere(r * (1 - k * 0.35), i % 2 ? darker(color, 0.85) : color, { pos: p, scale: [1, 1.15, 0.9] }, 8);
  }
  const e: Vec3 = [start[0] + dir[0] * n, start[1] + dir[1] * n, start[2] + dir[2] * n];
  b.sphere(r * 0.55, tie, { pos: [e[0], e[1] + 0.02, e[2]] }, 7);
  b.limb(e, [e[0], e[1] - 0.06, e[2]], r * 0.5, r * 0.15, color, 6);
}

function buildHair(b: ModelBuilder, d: ModelBuilder, style: number, color: number): void {
  const c2 = darker(color, 0.82);
  switch (style) {
    case 0: // short & neat
      hairCap(b, color, 1.08);
      fringe(d, color, 6, { from: -0.85, to: 0.85, len: 0.03, sweep: 0.25 });
      for (const sx of [-1, 1]) d.limb(onHead(sx * 1.35, 0.25), onHead(sx * 1.45, -0.35, R * 1.04), 0.025, 0.012, c2, 6);
      break;
    case 1: // swept fringe
      hairCap(b, color, 1.09);
      fringe(d, color, 7, { from: -0.95, to: 0.7, len: 0.08, sweep: -0.55, width: 0.034 });
      d.limb(onHead(0.6, 0.85, R * 1.1), onHead(-0.9, 0.2, R * 1.14), 0.045, 0.02, lighter(color, 0.08), 8);
      for (const sx of [-1, 1]) d.limb(onHead(sx * 1.35, 0.25), onHead(sx * 1.45, -0.4, R * 1.04), 0.026, 0.012, c2, 6);
      break;
    case 2: // pigtails
      hairCap(b, color, 1.08);
      fringe(d, color, 7, { len: 0.06, sweep: 0.1 });
      for (const sx of [-1, 1]) {
        const base: Vec3 = [sx * R * 1.0, 0.06, -0.06];
        b.sphere(0.03, 0xff6a8a, { pos: base }, 8);
        d.limb(base, [sx * R * 1.45, -0.08, -0.08], 0.05, 0.055, color, 8);
        d.limb([sx * R * 1.45, -0.08, -0.08], [sx * R * 1.35, -0.26, -0.06], 0.055, 0.02, c2, 8);
      }
      break;
    case 3: // spiky
      hairCap(b, color, 1.07);
      for (let i = 0; i < 11; i++) {
        const yaw = (i / 11) * Math.PI * 2;
        const pitch = 0.55 + (i % 3) * 0.18;
        const a = onHead(yaw, pitch, R * 1.0);
        const tip = onHead(yaw, pitch + 0.25, R * 1.5);
        d.limb(a, tip, 0.045, 0.004, i % 2 ? color : c2, 6, false);
      }
      fringe(d, color, 5, { len: 0.05, sweep: 0.35, width: 0.028, lift: 0.7 });
      break;
    case 4: // bun
      hairCap(b, color, 1.07, 0.62, -0.4);
      b.sphere(0.075, color, { pos: [0, R * 1.05, -R * 0.45] }, 12);
      b.torus(0.055, 0.012, darker(color, 0.7), { pos: [0, R * 0.92, -R * 0.4], rot: [Math.PI / 2 - 0.5, 0, 0] });
      fringe(d, color, 2, { from: -1.1, to: 1.1, len: 0.12, width: 0.022, lift: 0.4 });
      break;
    case 5: // two braids
      hairCap(b, color, 1.08);
      fringe(d, color, 6, { len: 0.04, sweep: 0.2 });
      for (const sx of [-1, 1]) braid(d, color, [sx * R * 0.95, -0.05, -0.02], [sx * 0.004, -0.045, 0.012], 8, 0.034);
      break;
    case 6: // wise: bald top, side tufts + beard
      for (const sx of [-1, 1]) {
        b.sphere(0.06, color, { pos: [sx * R * 0.92, 0.0, -0.05], scale: [0.7, 1, 1.25] }, 8);
        b.sphere(0.05, c2, { pos: [sx * R * 0.85, -0.05, -0.1], scale: [0.7, 1, 1.2] }, 8);
      }
      b.shell(R * 1.04, color, Math.PI * 0.32, { pos: [0, -0.02, -0.02], rot: [-Math.PI * 0.62, 0, 0] }, 16);
      b.sphere(0.13, color, { pos: [0, -0.15, 0.11], scale: [1.15, 1, 0.75] }, 12);
      b.sphere(0.08, c2, { pos: [0, -0.25, 0.12], scale: [1, 1.1, 0.8] }, 10);
      b.sphere(0.045, color, { pos: [-0.035, -0.07, 0.19], scale: [1.4, 0.55, 0.6] }, 8);
      b.sphere(0.045, color, { pos: [0.035, -0.07, 0.19], scale: [1.4, 0.55, 0.6] }, 8);
      break;
    case 7: // curly bob
      hairCap(b, color, 1.1);
      for (let i = 0; i < 16; i++) {
        const yaw = 0.95 + (i / 15) * (Math.PI * 2 - 1.9);
        const p = onHead(yaw, -0.05 + (i % 2) * 0.12, R * 1.12);
        b.sphere(0.05, i % 2 ? c2 : color, { pos: [p[0], p[1] - 0.04, p[2]] }, 8);
      }
      for (let i = 0; i < 9; i++) {
        const yaw = (i / 9) * Math.PI * 2;
        b.sphere(0.055, i % 2 ? color : c2, { pos: onHead(yaw, 0.75, R * 1.08) }, 8);
      }
      fringe(d, color, 5, { len: 0.03, width: 0.035 });
      break;
    case 8: // ponytail
      hairCap(b, color, 1.08, 0.62, -0.45);
      fringe(d, color, 6, { len: 0.05, sweep: 0.2 });
      b.sphere(0.03, 0xff6a8a, { pos: [0, R * 0.55, -R * 1.0] }, 8);
      d.limb([0, R * 0.55, -R * 1.02], [0, R * 0.1, -R * 1.45], 0.055, 0.06, color, 9);
      d.limb([0, R * 0.1, -R * 1.45], [0, -R * 1.2, -R * 1.25], 0.06, 0.012, c2, 9);
      break;
    case 9: // fluffy afro
      b.sphere(R * 1.42, color, { pos: [0, 0.07, -0.04], scale: [1, 0.92, 0.95] }, 16);
      for (let i = 0; i < 14; i++) {
        const yaw = (i / 14) * Math.PI * 2;
        b.sphere(0.07, i % 2 ? c2 : color, { pos: onHead(yaw, 0.35 + (i % 3) * 0.2, R * 1.38) }, 8);
      }
      break;
    case 10: // long straight
      hairCap(b, color, 1.09);
      fringe(d, color, 6, { from: -0.8, to: 0.8, len: 0.05, sweep: 0.2 });
      curtain(d, color, 0.95, Math.PI * 2 - 0.95, 14, 0.3, 0, 0.052);
      for (const sx of [-1, 1]) curtain(d, color, sx * 0.8, sx * 0.8, 1, 0.26, 0, 0.038);
      break;
    case 11: // long wavy
      hairCap(b, color, 1.1);
      fringe(d, color, 5, { from: -0.9, to: 0.6, len: 0.07, sweep: -0.5, width: 0.034 });
      curtain(d, color, 0.85, Math.PI * 2 - 0.85, 14, 0.32, 0.02, 0.054);
      break;
    case 12: // straight bob
      hairCap(b, color, 1.1);
      curtain(d, color, 0.75, Math.PI * 2 - 0.75, 15, 0.06, 0, 0.052);
      fringe(d, color, 8, { from: -0.8, to: 0.8, len: 0.1, width: 0.03, lift: 0.7 });
      break;
    case 13: // mohawk
      hairCap(b, darker(color, 0.7), 1.03, 0.55, -0.5);
      for (let i = 0; i < 7; i++) {
        const pitch = 0.35 + i * 0.32;
        const a: Vec3 = [0, Math.sin(pitch) * R, Math.cos(pitch) * R];
        const tip: Vec3 = [0, Math.sin(pitch) * R * 1.55, Math.cos(pitch) * R * 1.4];
        d.limb(a, tip, 0.04, 0.005, i % 2 ? color : c2, 6, false);
      }
      break;
    case 14: // side part
      hairCap(b, color, 1.09);
      d.limb(onHead(-0.25, 0.95, R * 1.08), onHead(0.9, 0.5, R * 1.14), 0.05, 0.03, lighter(color, 0.06), 9);
      d.limb(onHead(-0.25, 0.95, R * 1.08), onHead(-0.85, 0.55, R * 1.12), 0.04, 0.025, color, 9);
      fringe(d, color, 4, { from: 0, to: 0.85, len: 0.04, sweep: 0.4 });
      break;
    case 15: // space buns
      hairCap(b, color, 1.08);
      fringe(d, color, 7, { len: 0.05 });
      for (const sx of [-1, 1]) {
        b.sphere(0.065, color, { pos: [sx * R * 0.7, R * 0.95, -0.03] }, 12);
        b.torus(0.045, 0.01, 0xffd03a, { pos: [sx * R * 0.66, R * 0.78, -0.03], rot: [Math.PI / 2, 0, sx * 0.4] });
      }
      break;
    case 16: // buzz cut
      hairCap(b, color, 1.035, 0.58, -0.55);
      break;
    case 17: // mullet
      hairCap(b, color, 1.09);
      fringe(d, color, 5, { len: 0.03, sweep: 0.2 });
      curtain(d, color, Math.PI - 0.85, Math.PI + 0.85, 9, 0.16, 0.01, 0.05);
      break;
    case 18: // long with straight bangs
      hairCap(b, color, 1.1);
      fringe(d, color, 9, { from: -0.85, to: 0.85, len: 0.11, width: 0.028, lift: 0.75 });
      curtain(d, color, 0.9, Math.PI * 2 - 0.9, 14, 0.34, 0, 0.052);
      break;
    case 19: // single braid
      hairCap(b, color, 1.08, 0.62, -0.45);
      fringe(d, color, 6, { len: 0.05, sweep: 0.25 });
      braid(d, color, [0, -0.02, -R * 1.08], [0, -0.042, -0.006], 10, 0.04, 0x8ad8ff);
      break;
  }
}

// ------------------------------------------------------------------ hats & head accessories
/** Hats were authored for a 0.33 head; they are built at that scale and merged scaled down. */
function buildHat(hat: string, color: number): THREE.BufferGeometry | null {
  const b = mb();
  const top = 0.33 * 0.85;
  switch (hat) {
    case 'straw':
      b.cyl(0.55, 0.55, 0.03, color, { pos: [0, top - 0.02, 0] }, 22);
      b.torus(0.55, 0.018, darker(color, 0.85), { pos: [0, top - 0.02, 0], rot: [Math.PI / 2, 0, 0] });
      b.cyl(0.26, 0.3, 0.2, color, { pos: [0, top + 0.08, -0.02] }, 16);
      b.cyl(0.305, 0.305, 0.055, 0xe85a5a, { pos: [0, top + 0.02, -0.02] }, 16);
      break;
    case 'cap':
      b.shell(0.36, [darker(color, 0.9), color], Math.PI * 0.5, { pos: [0, top - 0.1, -0.02], scale: [1, 0.8, 1.02] }, 16);
      b.cyl(0.21, 0.21, 0.025, darker(color), { pos: [0, top - 0.09, 0.32], scale: [1, 1, 0.85] }, 16);
      b.sphere(0.035, darker(color, 0.7), { pos: [0, top + 0.18, -0.02] }, 6);
      break;
    case 'beanie':
      b.shell(0.37, color, Math.PI * 0.55, { pos: [0, top - 0.12, -0.02], scale: [1, 1.05, 1] }, 16);
      b.torus(0.33, 0.06, darker(color), { pos: [0, top - 0.12, -0.02], rot: [Math.PI / 2, 0, 0] });
      b.sphere(0.1, 0xffffff, { pos: [0, top + 0.26, -0.02] }, 8);
      break;
    case 'flower':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        b.sphere(0.075, [0xffd03a, 0xff8ab8, 0xffffff, 0x8ad8ff, 0xb08ae8][i % 5], { pos: [Math.sin(a) * 0.32, top - 0.02, Math.cos(a) * 0.32 - 0.02] }, 8);
        b.sphere(0.03, 0x6ac85a, { pos: [Math.sin(a + 0.3) * 0.33, top - 0.04, Math.cos(a + 0.3) * 0.33 - 0.02], scale: [1.6, 0.5, 1] }, 5);
      }
      break;
    case 'bandana':
      b.shell(0.36, color, Math.PI * 0.45, { pos: [0, top - 0.11, -0.02], rot: [-0.2, 0, 0] }, 16);
      b.cone(0.08, 0.18, color, { pos: [0, top - 0.12, -0.38], rot: [-1.2, 0, 0] });
      for (let i = 0; i < 6; i++) b.sphere(0.018, 0xffffff, { pos: [Math.sin(i) * 0.25, top + 0.02, Math.cos(i) * 0.25 - 0.05] }, 5);
      break;
    case 'explorer':
      b.shell(0.38, color, Math.PI * 0.5, { pos: [0, top - 0.08, -0.02], scale: [1, 0.85, 1] }, 16);
      b.cyl(0.5, 0.5, 0.03, darker(color), { pos: [0, top - 0.08, -0.02] }, 22);
      b.cyl(0.385, 0.385, 0.05, 0x8a5a3a, { pos: [0, top - 0.04, -0.02] }, 16);
      break;
    case 'cowboy':
      b.cyl(0.55, 0.55, 0.03, color, { pos: [0, top - 0.02, 0], scale: [1, 1, 0.8] }, 22);
      b.torus(0.4, 0.05, color, { pos: [0, top + 0.0, 0], rot: [Math.PI / 2, 0, 0], scale: [1.25, 0.9, 1] });
      b.cyl(0.2, 0.26, 0.26, color, { pos: [0, top + 0.11, -0.02] }, 14);
      b.cyl(0.265, 0.265, 0.05, 0x3a2a22, { pos: [0, top + 0.02, -0.02] }, 14);
      break;
    case 'chef':
      b.cyl(0.3, 0.28, 0.22, 0xffffff, { pos: [0, top + 0.04, -0.02] }, 16);
      for (let i = 0; i < 5; i++) b.sphere(0.17, 0xffffff, { pos: [Math.sin(i * 1.26) * 0.14, top + 0.26, Math.cos(i * 1.26) * 0.14 - 0.02] }, 10);
      break;
    case 'bunny':
      for (const sx of [-1, 1]) {
        b.capsule(0.075, 0.32, 0xffffff, { pos: [sx * 0.14, top + 0.22, -0.04], rot: [0, 0, -sx * 0.2] });
        b.capsule(0.04, 0.24, 0xffb8c8, { pos: [sx * 0.14, top + 0.22, 0.0], rot: [0, 0, -sx * 0.2] });
      }
      b.torus(0.3, 0.025, 0xffffff, { pos: [0, top - 0.05, 0], rot: [Math.PI / 2 - 0.3, 0, 0] });
      break;
    case 'frog':
      b.shell(0.37, 0x6ac85a, Math.PI * 0.55, { pos: [0, top - 0.1, -0.02] }, 16);
      for (const sx of [-1, 1]) {
        b.sphere(0.1, 0x6ac85a, { pos: [sx * 0.16, top + 0.15, 0.12] });
        b.sphere(0.06, 0xffffff, { pos: [sx * 0.16, top + 0.17, 0.2] });
        b.sphere(0.03, 0x1a1a1a, { pos: [sx * 0.16, top + 0.17, 0.25] });
      }
      break;
    case 'witch':
      b.cyl(0.52, 0.52, 0.03, 0x4a3a6a, { pos: [0, top - 0.02, 0] }, 22);
      b.cone(0.27, 0.58, 0x4a3a6a, { pos: [0, top + 0.28, -0.04], rot: [-0.15, 0, 0.1] }, 14);
      b.cyl(0.275, 0.275, 0.05, 0xffb02e, { pos: [0, top + 0.03, -0.02] }, 14);
      break;
    case 'crown':
      b.cyl(0.25, 0.25, 0.1, 0x6aa84f, { pos: [0, top + 0.04, 0] }, 12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.cone(0.05, 0.13, 0x8ad07a, { pos: [Math.sin(a) * 0.23, top + 0.14, Math.cos(a) * 0.23] });
        b.sphere(0.035, 0xffd03a, { pos: [Math.sin(a) * 0.23, top + 0.22, Math.cos(a) * 0.23] });
      }
      break;
    case 'beret':
      b.sphere(0.36, color, { pos: [0.04, top - 0.02, -0.03], scale: [1.05, 0.35, 1.05] }, 16);
      b.limb([0.04, top + 0.1, -0.03], [0.05, top + 0.16, -0.02], 0.015, 0.01, darker(color), 6);
      break;
    case 'bow':
      for (const sx of [-1, 1]) b.sphere(0.1, color, { pos: [0.18 + sx * 0.1, top + 0.0, 0.02], scale: [1.2, 0.8, 0.4], rot: [0, 0, sx * 0.3] }, 10);
      b.sphere(0.05, darker(color), { pos: [0.18, top, 0.03] }, 8);
      break;
    case 'headband':
      b.torus(0.335, 0.03, color, { pos: [0, top - 0.06, 0.0], rot: [Math.PI / 2 - 0.55, 0, 0] });
      break;
    default:
      return null;
  }
  return b.build();
}

function buildHeadAccessory(b: ModelBuilder, acc: string): void {
  if (acc === 'glasses') {
    for (const sx of [-1, 1]) b.torus(0.046, 0.007, 0x3a2a22, { pos: [sx * 0.075, 0.0, R * 0.98] });
    b.box(0.05, 0.008, 0.008, 0x3a2a22, { pos: [0, 0.008, R * 0.99] });
    for (const sx of [-1, 1]) b.box(0.008, 0.008, 0.16, 0x3a2a22, { pos: [sx * 0.12, 0.005, R * 0.55] });
  }
  if (acc === 'flower_pin') {
    for (let i = 0; i < 5; i++) b.sphere(0.022, 0xff5a8a, { pos: [0.16 + Math.cos(i * 1.26) * 0.022, 0.1 + Math.sin(i * 1.26) * 0.022, 0.08] }, 6);
    b.sphere(0.016, 0xffd03a, { pos: [0.165, 0.1, 0.095] }, 6);
  }
  if (acc === 'earrings') for (const sx of [-1, 1]) { b.sphere(0.012, 0xffd03a, { pos: [sx * R * 1.0, -0.06, 0.0] }, 6); b.sphere(0.018, 0x8ad8ff, { pos: [sx * R * 1.0, -0.09, 0.0] }, 6); }
}

// ------------------------------------------------------------------ face
function buildFace(b: ModelBuilder, look: Appearance, skin: number, hair: number): void {
  // ears
  for (const sx of [-1, 1]) {
    b.sphere(0.042, skin, { pos: [sx * R * 0.98, -0.01, -0.005], scale: [0.5, 1, 0.75] }, 10);
    b.sphere(0.022, darker(skin, 0.85), { pos: [sx * R * 1.0, -0.01, 0.006], scale: [0.4, 0.9, 0.6] }, 6);
  }
  // nose
  b.sphere(0.021, skin, { pos: [0, -0.03, R * 0.955], scale: [0.85, 1.05, 0.9] }, 10);
  b.sphere(0.013, darker(skin, 0.88), { pos: [0, -0.046, R * 0.965], scale: [1.5, 0.5, 0.6] }, 6);
  // mouth
  const lip = mix(skin, 0xc0505a, 0.55);
  const mouth = look.mouth ?? 0;
  if (mouth === 1) { // big smile with teeth
    b.sphere(0.034, 0x7a2a32, { pos: [0, -0.098, R * 0.92], scale: [1.1, 0.55, 0.45] }, 10);
    b.sphere(0.026, 0xffffff, { pos: [0, -0.088, R * 0.95], scale: [1.15, 0.32, 0.4] }, 8);
  } else if (mouth === 2) { // small o
    b.torus(0.011, 0.005, lip, { pos: [0, -0.1, R * 0.955] }, Math.PI * 2);
  } else if (mouth === 3) { // smirk
    b.torus(0.028, 0.006, lip, { pos: [0.008, -0.096, R * 0.945], rot: [-0.25, 0, Math.PI + 0.35] }, Math.PI * 0.8);
  } else { // gentle smile
    b.torus(0.03, 0.0065, lip, { pos: [0, -0.092, R * 0.945], rot: [-0.25, 0, Math.PI] }, Math.PI);
  }
  // brows
  const browCol = darker(hair === 0xf0f0f0 ? 0xb0b0b0 : hair, 0.75);
  const brow = look.brow ?? 0;
  for (const sx of [-1, 1]) {
    const x = sx * 0.075;
    if (brow === 1) b.box(0.06, 0.016, 0.014, browCol, { pos: [x, 0.07, R * 0.95], rot: [-0.3, 0, -sx * 0.05] });
    else if (brow === 2) b.box(0.055, 0.011, 0.012, browCol, { pos: [x, 0.08, R * 0.94], rot: [-0.3, 0, sx * 0.25] });
    else if (brow === 3) b.box(0.05, 0.008, 0.01, browCol, { pos: [x, 0.072, R * 0.95], rot: [-0.3, 0, -sx * 0.12] });
    else b.torus(0.032, 0.0075, browCol, { pos: [x, 0.05, R * 0.94], rot: [-0.3, 0, 0] }, Math.PI * 0.8);
  }
  // cheeks & freckles
  if (look.cheeks) for (const sx of [-1, 1]) b.sphere(0.03, mix(skin, 0xff7a8a, 0.55), { pos: [sx * 0.112, -0.058, R * 0.84], scale: [1.35, 0.7, 0.35] }, 8);
  if (look.freckles) for (let i = 0; i < 10; i++) {
    const sx = i % 2 ? 1 : -1;
    b.sphere(0.0042, darker(skin, 0.72), { pos: [sx * (0.05 + (i % 5) * 0.011), -0.03 - (i % 3) * 0.011, R * 0.93] }, 4);
  }
  // facial hair
  const fh = look.facialHair ?? 0;
  if (fh === 1 || fh === 3) for (const sx of [-1, 1]) b.sphere(0.03, hair, { pos: [sx * 0.026, -0.064, R * 0.97], scale: [1.4, 0.5, 0.55], rot: [0, 0, -sx * 0.25] }, 8);
  if (fh === 2) {
    b.sphere(0.15, hair, { pos: [0, -0.115, 0.07], scale: [1.08, 0.85, 0.9] }, 14);
    for (const sx of [-1, 1]) b.sphere(0.03, hair, { pos: [sx * 0.026, -0.066, R * 0.97], scale: [1.4, 0.5, 0.55] }, 8);
    b.sphere(0.026, lip, { pos: [0, -0.095, R * 0.96], scale: [1.2, 0.5, 0.5] }, 6);
  }
  if (fh === 3) b.sphere(0.04, hair, { pos: [0, -0.15, R * 0.83], scale: [1, 1.3, 0.8] }, 8);
}

function buildEyes(look: Appearance, skin: number): THREE.BufferGeometry {
  const b = mb();
  const eyeCol = EYE_COLORS[look.eyeColor % EYE_COLORS.length];
  const style = look.eyeStyle % 5;
  const lidCol = 0x2a1e1a;
  for (const sx of [-1, 1]) {
    const x = sx * 0.075;
    const z = R * 0.86;
    if (style === 1) { // happy closed
      b.torus(0.03, 0.007, lidCol, { pos: [x, 0.0, z + 0.022] }, Math.PI);
      continue;
    }
    const w = style === 4 ? 1.2 : 1;
    const hgt = style === 4 ? 0.82 : style === 3 ? 0.9 : 1.12;
    const ir = style === 2 ? 0.031 : 0.027;
    b.sphere(0.04, 0xffffff, { pos: [x, 0.004, z], scale: [w, hgt, 0.5] }, 12);
    b.sphere(ir, eyeCol, { pos: [x, 0.0, z + 0.012], scale: [1, 1.08, 0.5] }, 10);
    b.sphere(ir * 0.55, mix(eyeCol, 0xffffff, 0.35), { pos: [x, -0.008, z + 0.016], scale: [1, 0.7, 0.4] }, 6);
    b.sphere(ir * 0.52, 0x14100e, { pos: [x, 0.0, z + 0.018], scale: [1, 1.1, 0.45] }, 8);
    b.sphere(0.0085, 0xffffff, { pos: [x + 0.011, 0.013, z + 0.026] }, 5);
    if (style === 2) b.sphere(0.005, 0xffffff, { pos: [x - 0.01, -0.011, z + 0.025] }, 4);
    // upper lid line (+ lashes)
    b.torus(0.038 * w, 0.0055, lidCol, { pos: [x, 0.004, z + 0.006], rot: [0, 0, 0.06 * sx], scale: [1, hgt, 1] }, Math.PI);
    if (style === 3) b.sphere(0.041, skin, { pos: [x, 0.028, z - 0.002], scale: [w * 1.02, 0.55, 0.52] }, 10); // half-lidded
    if (look.lashes) for (let k = 0; k < 3; k++) b.limb([x + sx * (0.022 + k * 0.008), 0.03 - k * 0.006, z + 0.012], [x + sx * (0.036 + k * 0.01), 0.044 - k * 0.006, z + 0.012], 0.003, 0.0015, lidCol, 4, false);
  }
  return b.build();
}

// ------------------------------------------------------------------ rig
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

const blobShadowGeo = new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2);
export const blobShadowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a10, transparent: true, opacity: 0.22, depthWrite: false });

/** Inverted-hull outline: the same surface pushed out along its normals. */
function hull(src: THREE.BufferGeometry, t: number): THREE.BufferGeometry {
  const g = src.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return g;
}

export function buildCharacter(look: Appearance, opts: { outline?: boolean; scale?: number } = {}): CharacterRig {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const hair = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const mat = vcMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const outlines: THREE.Mesh[] = [];
  const top = look.topColor;
  const bottomCol = look.bottomColor;
  const shirt = 0xfff4e6;
  const longSleeve = LONG_SLEEVE_TOPS.has(look.top);
  const sleeveCol = look.top === 'overalls' || look.top === 'vest' || look.top === 'apron' ? shirt : look.top === 'jacket' ? top : top;
  const dressLike = look.top === 'dress' || look.top === 'raincoat' || look.top === 'starcloak';

  // ---------- torso ----------
  const tb = mb(); // silhouette (outlined)
  const td = mb(); // small details (no outline)
  // neck
  tb.cyl(0.048, 0.055, 0.1, skin, { pos: [0, 0.945, 0.0] }, 10);
  const chestCol = look.top === 'overalls' || look.top === 'vest' ? shirt : look.top === 'tank' ? top : top;
  tb.lathe([[0.128, 0.56], [0.141, 0.6], [0.146, 0.66], [0.154, 0.72], [0.162, 0.78], [0.165, 0.83], [0.158, 0.868], [0.136, 0.9], [0.09, 0.925], [0.05, 0.935], [0.0, 0.94]], [darker(chestCol, 0.88), chestCol], { scale: [1.1, 1, 0.74] }, 20);
  for (const sx of [-1, 1]) tb.sphere(0.06, look.top === 'tank' ? skin : chestCol, { pos: [sx * 0.162, 0.855, 0], scale: [1, 0.85, 0.95] }, 10);
  if (look.top === 'overalls') tb.cyl(0.152, 0.146, 0.13, top, { pos: [0, 0.625, 0], scale: [1.1, 1, 0.76] }, 18);
  // hips
  if (!dressLike) {
    if (look.bottom === 'skirt') {
      tb.cyl(0.155, 0.27, 0.24, [darker(bottomCol, 0.85), bottomCol], { pos: [0, 0.47, 0], scale: [1, 1, 0.85] }, 18);
      td.torus(0.155, 0.014, darker(bottomCol, 0.8), { pos: [0, 0.585, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.78, 1] });
    } else {
      tb.sphere(0.152, bottomCol, { pos: [0, 0.535, 0], scale: [1.04, 0.62, 0.78] }, 14);
      td.torus(0.15, 0.016, darker(bottomCol, 0.7), { pos: [0, 0.575, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.76, 1] }); // waistband
    }
  }
  const front = 0.125; // chest front surface z
  switch (look.top) {
    case 'overalls':
      td.box(0.2, 0.17, 0.03, top, { pos: [0, 0.73, front - 0.005] });
      td.box(0.08, 0.06, 0.012, darker(top, 0.85), { pos: [0, 0.72, front + 0.012] }); // pocket
      for (const sx of [-1, 1]) {
        td.box(0.035, 0.2, 0.02, top, { pos: [sx * 0.085, 0.87, 0.06], rot: [0.55, 0, 0] });
        td.box(0.035, 0.24, 0.02, top, { pos: [sx * 0.085, 0.8, -0.11], rot: [-0.25, 0, 0] });
        td.sphere(0.014, 0xffd03a, { pos: [sx * 0.085, 0.8, front + 0.01] }, 6);
      }
      td.torus(0.05, 0.012, lighter(shirt, 0.0), { pos: [0, 0.9, 0.02], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'hoodie':
      tb.sphere(0.1, darker(top, 0.88), { pos: [0, 0.9, -0.1], scale: [1.4, 0.7, 0.8] }, 10);
      td.box(0.16, 0.07, 0.02, darker(top, 0.88), { pos: [0, 0.64, front - 0.01] });
      for (const sx of [-1, 1]) td.limb([sx * 0.03, 0.88, front - 0.02], [sx * 0.035, 0.76, front + 0.01], 0.005, 0.004, 0xffffff, 4);
      td.torus(0.06, 0.015, darker(top, 0.9), { pos: [0, 0.905, 0.01], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'vest':
      tb.geo(new THREE.LatheGeometry([[0.14, 0.57], [0.15, 0.62], [0.156, 0.7], [0.166, 0.78], [0.17, 0.83], [0.162, 0.87], [0.14, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 20, 0.42, Math.PI * 2 - 0.84), top, { scale: [1.1, 1, 0.76] });
      for (let i = 0; i < 3; i++) td.sphere(0.009, 0x8a5a3a, { pos: [0.062, 0.8 - i * 0.06, front + 0.008] }, 5);
      td.torus(0.05, 0.012, shirt, { pos: [0, 0.9, 0.02], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'dress':
      tb.cyl(0.15, 0.31, 0.36, [darker(top, 0.85), top], { pos: [0, 0.45, 0], scale: [1, 1, 0.86] }, 20);
      td.torus(0.15, 0.018, lighter(top, 0.35), { pos: [0, 0.63, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.75, 1] });
      td.torus(0.31, 0.014, lighter(top, 0.4), { pos: [0, 0.275, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1] });
      td.sphere(0.028, 0xffffff, { pos: [0, 0.82, front + 0.005] }, 8);
      break;
    case 'raincoat':
      tb.cyl(0.165, 0.27, 0.48, [darker(top, 0.85), top], { pos: [0, 0.55, 0], scale: [1, 1, 0.8] }, 18);
      td.box(0.012, 0.5, 0.012, darker(top, 0.75), { pos: [0, 0.6, front + 0.04] });
      for (let i = 0; i < 4; i++) td.sphere(0.012, 0x3a3a4a, { pos: [0.025, 0.82 - i * 0.1, front + 0.03 + i * 0.012] }, 5);
      tb.sphere(0.1, darker(top, 0.9), { pos: [0, 0.91, -0.1], scale: [1.4, 0.7, 0.8] }, 10);
      break;
    case 'apron':
      td.box(0.2, 0.36, 0.015, lighter(top, 0.1), { pos: [0, 0.62, front + 0.01] });
      td.box(0.12, 0.07, 0.01, darker(top, 0.85), { pos: [0, 0.56, front + 0.02] });
      td.torus(0.15, 0.01, lighter(top, 0.1), { pos: [0, 0.62, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.78, 1] });
      td.torus(0.05, 0.012, shirt, { pos: [0, 0.9, 0.02], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'explorer':
      for (const sx of [-1, 1]) {
        td.box(0.06, 0.06, 0.012, darker(top, 0.85), { pos: [sx * 0.065, 0.79, front + 0.005] });
        td.box(0.064, 0.018, 0.014, darker(top, 0.75), { pos: [sx * 0.065, 0.825, front + 0.008] });
      }
      td.torus(0.15, 0.02, 0x6a4a2a, { pos: [0, 0.57, 0], rot: [Math.PI / 2, 0, 0], scale: [1.02, 0.78, 1] });
      td.box(0.04, 0.035, 0.02, 0xd8b050, { pos: [0, 0.57, 0.12] });
      td.cone(0.05, 0.06, top, { pos: [-0.04, 0.9, 0.06], rot: [0.9, 0, 0.6] }, 4);
      td.cone(0.05, 0.06, top, { pos: [0.04, 0.9, 0.06], rot: [0.9, 0, -0.6] }, 4);
      break;
    case 'sweater':
      td.cyl(0.06, 0.07, 0.06, lighter(top, 0.15), { pos: [0, 0.92, 0] }, 12);
      for (let i = 0; i < 4; i++) td.torus(0.153, 0.008, darker(top, 0.86), { pos: [0, 0.6 + i * 0.07, 0], rot: [Math.PI / 2, 0, 0], scale: [1.05 + (i > 1 ? 0.06 : 0), 0.76, 1] });
      break;
    case 'kimono':
      td.box(0.05, 0.28, 0.012, 0xffffff, { pos: [0.02, 0.76, front + 0.005], rot: [0, 0, 0.35] });
      td.box(0.05, 0.28, 0.012, darker(top, 0.8), { pos: [-0.02, 0.76, front + 0.002], rot: [0, 0, -0.35] });
      td.torus(0.152, 0.03, 0xe85a5a, { pos: [0, 0.62, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.76, 1] });
      for (let i = 0; i < 5; i++) td.sphere(0.012, 0xffd0e0, { pos: [Math.sin(i * 1.7) * 0.12, 0.7 + (i % 3) * 0.06, front * Math.cos(Math.sin(i * 1.7))] }, 5);
      break;
    case 'starcloak':
      tb.cyl(0.18, 0.32, 0.6, [0x1f2850, 0x2f3a6a], { pos: [0, 0.6, -0.04], scale: [1, 1, 0.85] }, 18);
      for (let i = 0; i < 10; i++) td.sphere(0.012, 0xfff0a0, { pos: [Math.sin(i * 2.1) * 0.22, 0.4 + (i % 4) * 0.1, -0.2 - (i % 2) * 0.04] }, 5);
      td.sphere(0.02, 0xffd03a, { pos: [0, 0.88, front] }, 6);
      break;
    case 'shirt':
      td.box(0.008, 0.3, 0.01, darker(top, 0.8), { pos: [0, 0.74, front + 0.01] });
      for (let i = 0; i < 4; i++) td.sphere(0.009, 0xffffff, { pos: [0, 0.84 - i * 0.07, front + 0.013] }, 5);
      for (let i = 0; i < 4; i++) td.torus(0.166, 0.006, darker(top, 0.8), { pos: [0, 0.65 + i * 0.07, 0], rot: [Math.PI / 2, 0, 0], scale: [1.1, 0.74, 1] });
      td.cone(0.045, 0.06, lighter(top, 0.25), { pos: [-0.035, 0.905, 0.07], rot: [1.0, 0, 0.6] }, 4);
      td.cone(0.045, 0.06, lighter(top, 0.25), { pos: [0.035, 0.905, 0.07], rot: [1.0, 0, -0.6] }, 4);
      break;
    case 'tank':
      for (const sx of [-1, 1]) td.box(0.035, 0.12, 0.13, top, { pos: [sx * 0.09, 0.86, 0], rot: [0, 0, sx * 0.15] });
      td.torus(0.07, 0.01, darker(top, 0.85), { pos: [0, 0.88, 0.04], rot: [Math.PI / 2 - 0.4, 0, 0] });
      break;
    case 'jacket':
      td.box(0.08, 0.3, 0.02, 0xffffff, { pos: [0, 0.74, front + 0.0] }); // tee under the open jacket
      for (const sx of [-1, 1]) {
        td.box(0.012, 0.32, 0.03, darker(top, 0.8), { pos: [sx * 0.045, 0.72, front + 0.012] });
        td.cone(0.04, 0.12, darker(top, 0.85), { pos: [sx * 0.055, 0.84, front + 0.02], rot: [0.15, 0, sx * 2.8] }, 3);
        td.box(0.05, 0.012, 0.012, darker(top, 0.7), { pos: [sx * 0.09, 0.66, front + 0.005] });
      }
      td.torus(0.07, 0.018, darker(top, 0.85), { pos: [0, 0.905, 0.0], rot: [Math.PI / 2, 0, 0] });
      break;
    default: // tee
      td.torus(0.055, 0.012, lighter(top, 0.3), { pos: [0, 0.9, 0.02], rot: [Math.PI / 2, 0, 0] });
      td.sphere(0.025, lighter(top, 0.45), { pos: [0.06, 0.8, front + 0.004], scale: [1, 1, 0.3] }, 8);
      break;
  }
  // accessories on the body
  if (look.accessory === 'scarf') {
    td.torus(0.075, 0.035, 0xe85a5a, { pos: [0, 0.91, 0.01], rot: [Math.PI / 2, 0, 0] });
    td.box(0.055, 0.17, 0.025, 0xe85a5a, { pos: [0.055, 0.8, front + 0.02], rot: [0.1, 0, 0.15] });
    for (let i = 0; i < 3; i++) td.box(0.056, 0.008, 0.026, 0xffffff, { pos: [0.055 + i * 0.002, 0.76 + i * 0.03, front + 0.024], rot: [0.1, 0, 0.15] });
  }
  if (look.accessory === 'backpack') {
    tb.rbox(0.24, 0.27, 0.11, 0xc8803a, { pos: [0, 0.74, -0.17] });
    td.box(0.18, 0.08, 0.03, 0xa8602a, { pos: [0, 0.69, -0.23] });
    for (const sx of [-1, 1]) td.box(0.03, 0.26, 0.02, 0x8a5a2a, { pos: [sx * 0.1, 0.78, 0.115], rot: [0.12, 0, 0] });
  }
  if (look.accessory === 'bell') {
    td.torus(0.07, 0.012, 0xe85a5a, { pos: [0, 0.905, 0.01], rot: [Math.PI / 2, 0, 0] });
    td.sphere(0.03, 0xffd03a, { pos: [0, 0.855, 0.085] }, 8);
  }
  if (look.accessory === 'wings') {
    for (const sx of [-1, 1]) {
      tb.sphere(0.16, 0xd8f0ff, { pos: [sx * 0.15, 0.85, -0.17], rot: [0, sx * 0.5, sx * 0.5], scale: [1, 0.65, 0.1] }, 12);
      tb.sphere(0.1, 0xe8f8ff, { pos: [sx * 0.12, 0.66, -0.15], rot: [0, sx * 0.4, -sx * 0.4], scale: [1, 0.6, 0.1] }, 10);
    }
  }
  if (look.accessory === 'necklace') {
    td.torus(0.07, 0.006, 0xffd03a, { pos: [0, 0.89, 0.03], rot: [Math.PI / 2 - 0.5, 0, 0] });
    td.sphere(0.017, 0x8ad8ff, { pos: [0, 0.855, 0.1] }, 6);
  }
  if (look.accessory === 'satchel') {
    td.box(0.03, 0.4, 0.02, 0x8a5a2a, { pos: [0, 0.73, 0.125], rot: [0, 0, 0.7] });
    td.rbox(0.16, 0.13, 0.06, 0xa8703a, { pos: [-0.16, 0.6, 0.06] });
    td.box(0.16, 0.06, 0.065, 0x8a5a2a, { pos: [-0.16, 0.645, 0.062] });
  }
  const torsoBase = tb.build();
  const torsoAll = mb().merge(torsoBase).merge(td.build()).build();
  const torso = new THREE.Mesh(torsoAll, mat);
  torso.castShadow = torso.receiveShadow = true;
  body.add(torso);

  // ---------- head ----------
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  body.add(head);
  const hb = mb(); // silhouette (outlined)
  const hd = mb(); // face details & hair locks (no outline)
  hb.sphere(R, skin, { scale: [1, 1.04, 0.97] }, 22);
  hb.sphere(R * 0.82, skin, { pos: [0, -0.075, 0.03], scale: [0.98, 0.78, 0.92] }, 16); // jaw / chin
  buildFace(hd, look, skin, hair);
  buildHair(hb, hd, look.hairStyle, hair);
  const hat = buildHat(look.hat, look.hatColor);
  if (hat) hb.merge(hat, { pos: [0, 0.0, 0.0], scale: [0.66, 0.66, 0.66] });
  buildHeadAccessory(hd, look.accessory);
  const headBase = hb.build();
  const headMesh = new THREE.Mesh(mb().merge(headBase).merge(hd.build()).build(), mat);
  headMesh.castShadow = headMesh.receiveShadow = true;
  head.add(headMesh);
  const eyes = new THREE.Mesh(buildEyes(look, skin), mat);
  head.add(eyes);

  // ---------- arms ----------
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.19, SHOULDER_Y, 0);
    const ab = mb();
    const upperCol = look.top === 'tank' ? skin : sleeveCol;
    const foreCol = longSleeve ? sleeveCol : skin;
    const elbow: Vec3 = [side * 0.035, -0.21, 0.0];
    const wrist: Vec3 = [side * 0.045, -0.405, 0.035];
    ab.limb([side * 0.012, -0.01, 0], elbow, 0.048, 0.042, upperCol, 10);
    if (!longSleeve && look.top !== 'tank') ab.limb([side * 0.01, -0.02, 0], [side * 0.03, -0.12, 0], 0.056, 0.054, sleeveCol, 10, false); // short sleeve
    ab.limb(elbow, wrist, 0.041, 0.034, foreCol, 10);
    if (longSleeve) ab.torus(0.035, 0.008, darker(sleeveCol, 0.85), { pos: [wrist[0], wrist[1] + 0.01, wrist[2]], rot: [Math.PI / 2, 0, 0] });
    // hand: palm, fingers, thumb
    ab.sphere(0.04, skin, { pos: [side * 0.048, -0.44, 0.04], scale: [0.72, 1, 0.92] }, 10);
    ab.sphere(0.03, skin, { pos: [side * 0.048, -0.475, 0.05], scale: [0.75, 1, 0.85] }, 8);
    ab.limb([side * 0.032, -0.425, 0.068], [side * 0.03, -0.455, 0.088], 0.012, 0.01, skin, 6);
    const m = ab.mesh(mat);
    g.add(m);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  body.add(armL, armR);
  const toolSlot = new THREE.Group();
  toolSlot.position.set(0.05, -0.45, 0.05);
  armR.add(toolSlot);

  // ---------- legs ----------
  const shoeCol = look.shoesColor;
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.082, HIP_Y, 0);
    const lb = mb();
    const bare = look.bottom === 'skirt' || dressLike;
    const thighCol = bare ? skin : bottomCol;
    const shinCol = bare || look.bottom === 'shorts' ? skin : bottomCol;
    lb.limb([0, 0.02, 0], [0, -0.21, 0.01], 0.064, 0.05, thighCol, 10);
    lb.limb([0, -0.21, 0.01], [0, -0.42, -0.005], 0.05, 0.04, shinCol, 10);
    if (look.bottom === 'shorts' && !dressLike) lb.limb([0, 0.0, 0], [0, -0.12, 0.005], 0.07, 0.066, bottomCol, 10);
    if (look.bottom === 'cargo' && !dressLike) for (const sx of [-1, 1]) lb.box(0.02, 0.07, 0.06, darker(bottomCol, 0.85), { pos: [side * 0.062 * (sx > 0 ? 1 : 1), -0.16, 0.005] });
    if (!bare && look.bottom !== 'shorts') lb.torus(0.042, 0.008, darker(bottomCol, 0.8), { pos: [0, -0.4, 0], rot: [Math.PI / 2, 0, 0] });
    // shoe
    const boot = look.shoes === 'boots' || look.shoes === 'rainboots';
    if (boot) lb.cyl(0.047, 0.05, 0.12, shoeCol, { pos: [0, -0.42, 0.0] }, 10);
    lb.sphere(0.055, shoeCol, { pos: [0, -0.455, 0.035], scale: [0.95, 0.62, 1.55] }, 12);
    lb.box(0.1, 0.022, 0.19, look.shoes === 'sneakers' ? 0xffffff : darker(shoeCol, 0.6), { pos: [0, -0.49, 0.035] });
    if (look.shoes === 'sneakers') for (let i = 0; i < 3; i++) lb.box(0.04, 0.006, 0.01, 0xffffff, { pos: [0, -0.43 + i * 0.006, 0.06 + i * 0.022], rot: [0.5, 0, 0] });
    if (look.shoes === 'flats') lb.sphere(0.012, lighter(shoeCol, 0.4), { pos: [0, -0.44, 0.105] }, 5);
    g.add(lb.mesh(mat));
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  body.add(legL, legR);

  if (opts.outline) {
    for (const [geo, parent] of [[torsoBase, body], [headBase, head]] as [THREE.BufferGeometry, THREE.Group][]) {
      const o = new THREE.Mesh(hull(geo, 0.011), outlineMat);
      o.castShadow = false;
      parent.add(o);
      outlines.push(o);
    }
  }

  const shadow = new THREE.Mesh(blobShadowGeo, blobShadowMat);
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  root.add(shadow);

  const sc = (opts.scale ?? 1) * (look.height ?? 1);
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
      b.cyl(0.018, 0.018, 0.6, handle, { pos: [0, 0.12, 0] });
      b.box(0.14, 0.03, 0.08, metal, { pos: [0.045, 0.41, 0.02] });
      break;
    case 'can':
      b.cyl(0.09, 0.1, 0.15, metal === 0xb98a5a ? 0x6ab8e8 : metal, { pos: [0, -0.06, 0.06] }, 12);
      b.cyl(0.013, 0.022, 0.18, metal === 0xb98a5a ? 0x6ab8e8 : metal, { pos: [0, -0.01, 0.19], rot: [1.0, 0, 0] });
      b.torus(0.055, 0.013, 0x5a5a6a, { pos: [0, 0.05, 0.0], rot: [0, Math.PI / 2, 0] }, Math.PI);
      break;
    case 'axe':
      b.cyl(0.018, 0.018, 0.48, handle, { pos: [0, 0.1, 0] });
      b.box(0.035, 0.12, 0.15, metal, { pos: [0, 0.3, 0.065] });
      break;
    case 'pickaxe':
      b.cyl(0.018, 0.018, 0.48, handle, { pos: [0, 0.1, 0] });
      b.torus(0.13, 0.022, metal, { pos: [0, 0.3, 0], rot: [0, Math.PI / 2, 0] }, Math.PI);
      break;
    case 'rod':
      b.cyl(0.01, 0.02, 0.95, handle, { pos: [0, 0.37, 0.1], rot: [0.5, 0, 0] });
      b.cyl(0.028, 0.028, 0.045, metal, { pos: [0, 0.0, -0.02], rot: [0, 0, Math.PI / 2] });
      break;
    case 'sickle':
      b.cyl(0.018, 0.018, 0.2, handle, { pos: [0, 0.0, 0] });
      b.torus(0.09, 0.016, metal, { pos: [0, 0.15, 0.05], rot: [0, Math.PI / 2, 0] }, Math.PI * 1.2);
      break;
    case 'net':
      b.cyl(0.014, 0.014, 0.5, handle, { pos: [0, 0.15, 0] });
      b.torus(0.1, 0.011, 0xffffff, { pos: [0, 0.45, 0], rot: [Math.PI / 2, 0, 0] });
      break;
  }
  const m = new THREE.Mesh(b.build(), vcMat());
  m.castShadow = true;
  return m;
}

export function npcEmoteMaterial(): THREE.Material {
  return basicMat(0xffffff);
}
