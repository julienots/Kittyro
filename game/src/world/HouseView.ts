import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from './World';
import { HOUSE_ROOMS, HOUSE_W, HOUSE_D } from './houseLayout';
import { WALLPAPERS, FLOORS, DECOR_BY_ID } from '../data/decor';
import { InstanceBatch, trs } from './Instancing';
import { propModel } from '../models/Props';
import { cachedGeo, mb } from '../models/Builder';
import { footprintOf } from '../systems/Building';
import { glowMat, propMat } from './PropFactory';
import { toonGradient, vcMat } from '../render/Materials';

const texCache = new Map<string, THREE.CanvasTexture>();

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Procedurally painted wallpaper / floor textures. */
export function patternTexture(pattern: string, c1: number, c2: number): THREE.CanvasTexture {
  const key = `${pattern}_${c1}_${c2}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = hex(c1);
  g.fillRect(0, 0, S, S);
  g.fillStyle = hex(c2);
  g.strokeStyle = hex(c2);
  switch (pattern) {
    case 'stripes':
      for (let x = 0; x < S; x += 32) g.fillRect(x, 0, 14, S);
      break;
    case 'dots':
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
        g.beginPath();
        g.arc(16 + x * 32 + (y % 2) * 16, 16 + y * 32, 6, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'check':
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32);
      break;
    case 'planks':
      g.lineWidth = 3;
      for (let y = 0; y < S; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
        const off = (y / 32) % 2 ? 40 : 90;
        g.beginPath();
        g.moveTo(off, y);
        g.lineTo(off, y + 32);
        g.stroke();
      }
      break;
    case 'bricks':
      g.lineWidth = 3;
      for (let y = 0; y < S; y += 21) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
        for (let x = ((y / 21) % 2) * 21; x < S; x += 42) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 21);
          g.stroke();
        }
      }
      break;
    case 'tiles':
      g.lineWidth = 3;
      for (let i = 0; i <= S; i += 32) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, S);
        g.moveTo(0, i);
        g.lineTo(S, i);
        g.stroke();
      }
      break;
    case 'leaves':
      for (let i = 0; i < 10; i++) {
        g.save();
        g.translate((i * 37) % S, (i * 53) % S);
        g.rotate(i);
        g.beginPath();
        g.ellipse(0, 0, 6, 13, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      break;
    case 'stars':
      for (let i = 0; i < 9; i++) {
        const x = (i * 43) % S, y = (i * 71) % S;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2, r = k % 2 ? 2.5 : 6;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.fill();
      }
      break;
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** A painted outside view for windows (sky, hills, a tree). */
let windowTex: THREE.CanvasTexture | null = null;
function outsideTexture(): THREE.CanvasTexture {
  if (windowTex) return windowTex;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#8fd0ff');
  sky.addColorStop(0.65, '#d8f0ff');
  g.fillStyle = sky;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (const [x, y, r] of [[30, 30, 12], [44, 26, 10], [56, 32, 9], [96, 22, 8], [106, 26, 7]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#9fd472';
  g.beginPath(); g.moveTo(0, 92); g.quadraticCurveTo(40, 70, 80, 88); g.quadraticCurveTo(110, 96, 128, 84); g.lineTo(128, 128); g.lineTo(0, 128); g.fill();
  g.fillStyle = '#7ab85a';
  g.beginPath(); g.moveTo(0, 106); g.quadraticCurveTo(64, 92, 128, 108); g.lineTo(128, 128); g.lineTo(0, 128); g.fill();
  g.fillStyle = '#6a4a2a'; g.fillRect(92, 74, 5, 22);
  g.fillStyle = '#4f9e46'; g.beginPath(); g.arc(94, 70, 13, 0, Math.PI * 2); g.fill();
  windowTex = new THREE.CanvasTexture(cv);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  return windowTex;
}

/** Small framed paintings for the walls. */
const paintingCache = new Map<number, THREE.CanvasTexture>();
function paintingTexture(kind: number): THREE.CanvasTexture {
  const c = paintingCache.get(kind);
  if (c) return c;
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 72;
  const g = cv.getContext('2d')!;
  const bgs = ['#ffe9c8', '#d8f0ff', '#f6e0ff', '#e4f6d8'];
  g.fillStyle = bgs[kind % 4];
  g.fillRect(0, 0, 96, 72);
  if (kind % 4 === 0) { // sunset hills
    g.fillStyle = '#ffb36a'; g.beginPath(); g.arc(48, 46, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7ab85a'; g.beginPath(); g.moveTo(0, 50); g.quadraticCurveTo(48, 30, 96, 52); g.lineTo(96, 72); g.lineTo(0, 72); g.fill();
  } else if (kind % 4 === 1) { // boat on the sea
    g.fillStyle = '#5aa8e8'; g.fillRect(0, 44, 96, 28);
    g.fillStyle = '#8a5a3a'; g.fillRect(36, 40, 26, 6);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(48, 12); g.lineTo(48, 40); g.lineTo(66, 40); g.fill();
  } else if (kind % 4 === 2) { // flowers in a vase
    g.fillStyle = '#7a8ad8'; g.fillRect(40, 44, 16, 24);
    for (const [x, y, col] of [[40, 30, '#ff7a9a'], [50, 24, '#ffd03a'], [58, 32, '#ff9ac8'], [46, 36, '#ffffff']] as [number, number, string][]) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
  } else { // the farm
    g.fillStyle = '#9fd472'; g.fillRect(0, 46, 96, 26);
    g.fillStyle = '#e8d8c0'; g.fillRect(30, 30, 30, 20);
    g.fillStyle = '#c8463a'; g.beginPath(); g.moveTo(26, 32); g.lineTo(45, 16); g.lineTo(64, 32); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  paintingCache.set(kind, t);
  return t;
}

/** Walls between rooms: [axis, fixed coord, from, to, doorway gaps]. */
type WallDef = { axis: 'x' | 'z'; at: number; from: number; to: number; gaps: [number, number][]; outer?: 'n' | 's' | 'e' | 'w' };
const WALLS: WallDef[] = [
  { axis: 'z', at: 1, from: 1, to: 21, gaps: [], outer: 'n' },
  { axis: 'x', at: 1, from: 1, to: 15, gaps: [], outer: 'w' },
  { axis: 'z', at: 15, from: 1, to: 21, gaps: [], outer: 's' },
  { axis: 'x', at: 21, from: 1, to: 15, gaps: [[5.95, 7.05]], outer: 'e' },
  { axis: 'x', at: 8, from: 1, to: 8, gaps: [[4.0, 5.4]] },
  { axis: 'x', at: 14, from: 1, to: 8, gaps: [[4.0, 5.4]] },
  { axis: 'z', at: 8, from: 1, to: 8, gaps: [[3.8, 5.2]] },
  { axis: 'z', at: 8, from: 8, to: 14, gaps: [[10.3, 11.7]] },
  { axis: 'z', at: 8, from: 14, to: 21, gaps: [[16.8, 18.2]] },
  { axis: 'x', at: 8, from: 8, to: 15, gaps: [[10.8, 12.2]] },
];
const WALL_H = 2.4;
const DOOR_H = 1.95;
const T = 0.09; // half thickness of a wall

export class HouseView {
  readonly group = new THREE.Group();
  private furn: InstanceBatch;
  private glow: InstanceBatch;
  private shell = new THREE.Group();
  /** full-height walls, ceiling & lamps: only in first person */
  private fpOnly = new THREE.Group();
  /** low dollhouse walls: only in the overhead view */
  private isoOnly = new THREE.Group();
  private fp = false;
  lightPoints: THREE.Vector3[] = [];

  constructor(private ctx: Ctx, private world: World) {
    this.furn = new InstanceBatch((key) => {
      const def = DECOR_BY_ID[key];
      if (!def) return null;
      return { geo: cachedGeo(`decor:${key}|summer`, () => propModel(def, 'summer').geo), mat: propMat() };
    });
    this.glow = new InstanceBatch((key) => {
      const def = DECOR_BY_ID[key];
      const g = def ? propModel(def, 'summer').glow : null;
      return g ? { geo: g, mat: glowMat, shadow: false } : null;
    }, false, false);
    this.group.add(this.shell, this.fpOnly, this.isoOnly, this.furn.group, this.glow.group);
  }

  build(): void {
    this.buildShell();
    this.refreshFurniture();
  }

  /** First person shows the whole house (walls all around, ceiling); the overhead view cuts it open. */
  setFirstPerson(fp: boolean): void {
    this.fp = fp;
    this.fpOnly.visible = fp;
    this.isoOnly.visible = !fp;
  }

  private roomAt(x: number, z: number): (typeof HOUSE_ROOMS)[number] | undefined {
    return HOUSE_ROOMS.find((r) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1);
  }

  private wallMat(roomId: string | undefined, len: number): THREE.Material {
    const st = this.ctx.state;
    const rs = roomId ? st.house.rooms[roomId] : undefined;
    const wp = WALLPAPERS.find((x) => x.id === rs?.wall) ?? WALLPAPERS[0];
    const tex = patternTexture(wp.pattern, wp.c1, wp.c2).clone();
    tex.repeat.set(Math.max(0.5, len / 2), 1.2);
    tex.needsUpdate = true;
    return new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), color: !rs || rs.unlocked ? 0xffffff : 0x9a9088 });
  }

  buildShell(): void {
    for (const g of [this.shell, this.fpOnly, this.isoOnly]) {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
      g.clear();
    }
    const st = this.ctx.state;
    const trimMat = new THREE.MeshToonMaterial({ color: 0xfff4e0, gradientMap: toonGradient() });
    const woodMat = new THREE.MeshToonMaterial({ color: 0x9a6a42, gradientMap: toonGradient() });
    // base slab
    const base = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W - 1.6, 0.3, HOUSE_D - 1.6), woodMat);
    base.position.set(HOUSE_W / 2, -0.16, HOUSE_D / 2);
    this.shell.add(base);
    // floors & ceilings
    for (const r of HOUSE_ROOMS) {
      const rs = st.house.rooms[r.id];
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const fl = FLOORS.find((f) => f.id === rs.floor) ?? FLOORS[0];
      const ftex = patternTexture(fl.pattern, fl.c1, fl.c2).clone();
      ftex.repeat.set(w / 2, d / 2);
      ftex.needsUpdate = true;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: ftex, gradientMap: toonGradient(), color: rs.unlocked ? 0xffffff : 0x8a8078 }));
      floor.position.set(r.x0 + w / 2, 0.01, r.z0 + d / 2);
      floor.receiveShadow = true;
      this.shell.add(floor);
      // ceiling with wooden beams (first person)
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xfff6e8, gradientMap: toonGradient() }));
      ceil.position.set(r.x0 + w / 2, WALL_H, r.z0 + d / 2);
      this.fpOnly.add(ceil);
      const beams = mb();
      for (let x = r.x0 + 1.2; x < r.x1 - 0.5; x += 1.6) beams.box(0.16, 0.14, d, 0x9a6a42, { pos: [x, WALL_H - 0.07, r.z0 + d / 2] });
      this.fpOnly.add(new THREE.Mesh(beams.build(), vcMat()));
      if (!rs.unlocked) {
        // construction tape + sign
        const b = mb();
        b.box(w - 0.6, 0.06, 0.06, 0xffd03a, { pos: [r.x0 + w / 2, 0.6, r.z0 + d / 2], rot: [0, 0.6, 0] });
        b.box(w - 0.6, 0.06, 0.06, 0x2a2a2a, { pos: [r.x0 + w / 2, 0.68, r.z0 + d / 2], rot: [0, 0.6, 0] });
        b.box(0.9, 0.6, 0.08, 0xc8925a, { pos: [r.x0 + w / 2, 0.9, r.z0 + d / 2 + 0.6] });
        b.cyl(0.05, 0.05, 0.9, 0x8a5a3a, { pos: [r.x0 + w / 2, 0.45, r.z0 + d / 2 + 0.55] });
        this.shell.add(new THREE.Mesh(b.build(), vcMat()));
      }
    }
    // walls, one face per room side so each room keeps its own wallpaper
    const decor = mb(); // trims & frames shared by both views
    for (const wd of WALLS) {
      // split into solid segments around the doorways
      const segs: [number, number][] = [];
      let c = wd.from;
      for (const [g0, g1] of wd.gaps) { if (g0 > c) segs.push([c, g0]); c = g1; }
      if (c < wd.to) segs.push([c, wd.to]);
      const isoFull = wd.outer === 'n' || wd.outer === 'w';
      const isoH = wd.outer ? (isoFull ? WALL_H : 0.35) : 0.75;
      for (const sideSign of wd.outer ? [wd.outer === 'n' || wd.outer === 'w' ? 1 : -1] : [-1, 1]) {
        for (const [a0, a1] of segs) {
          const len = a1 - a0, mid = (a0 + a1) / 2;
          const px = wd.axis === 'x' ? wd.at + sideSign * T / 2 : mid;
          const pz = wd.axis === 'z' ? wd.at + sideSign * T / 2 : mid;
          const probe = wd.axis === 'x' ? this.roomAt(wd.at + sideSign * 0.3, mid) : this.roomAt(mid, wd.at + sideSign * 0.3);
          const mk = (h: number, group: THREE.Group) => {
            const geo = wd.axis === 'x' ? new THREE.BoxGeometry(T, h, len) : new THREE.BoxGeometry(len, h, T);
            const m = new THREE.Mesh(geo, this.wallMat(probe?.id, len));
            m.position.set(px, h / 2, pz);
            m.receiveShadow = true;
            group.add(m);
          };
          mk(WALL_H, this.fpOnly);
          mk(isoH, this.isoOnly);
          // baseboard + picture rail on the room side
          const off = sideSign * (T + 0.012);
          const bx = wd.axis === 'x' ? wd.at + off : mid, bz = wd.axis === 'z' ? wd.at + off : mid;
          const bw = wd.axis === 'x' ? 0.03 : len, bd = wd.axis === 'x' ? len : 0.03;
          decor.box(bw, 0.12, bd, 0xe8d8c0, { pos: [bx, 0.06, bz] });
        }
        // lintel above each doorway + door frame (first person)
        for (const [g0, g1] of wd.gaps) {
          const len = g1 - g0, mid = (g0 + g1) / 2;
          const lx = wd.axis === 'x' ? wd.at : mid, lz = wd.axis === 'z' ? wd.at : mid;
          const lintel = new THREE.Mesh(wd.axis === 'x' ? new THREE.BoxGeometry(T * 2, WALL_H - DOOR_H, len) : new THREE.BoxGeometry(len, WALL_H - DOOR_H, T * 2), this.wallMat(this.roomAt(wd.axis === 'x' ? wd.at - 0.3 : mid, wd.axis === 'z' ? wd.at - 0.3 : mid)?.id, len));
          lintel.position.set(lx, (WALL_H + DOOR_H) / 2, lz);
          this.fpOnly.add(lintel);
          const fr = mb();
          for (const e of [g0, g1]) {
            const fx = wd.axis === 'x' ? wd.at : e, fz = wd.axis === 'z' ? wd.at : e;
            fr.box(wd.axis === 'x' ? T * 2 + 0.06 : 0.08, DOOR_H, wd.axis === 'x' ? 0.08 : T * 2 + 0.06, 0xc8945e, { pos: [fx, DOOR_H / 2, fz] });
          }
          fr.box(wd.axis === 'x' ? T * 2 + 0.06 : len + 0.16, 0.08, wd.axis === 'x' ? len + 0.16 : T * 2 + 0.06, 0xc8945e, { pos: [lx, DOOR_H + 0.04, lz] });
          this.fpOnly.add(new THREE.Mesh(fr.build(), vcMat()));
        }
      }
    }
    this.shell.add(new THREE.Mesh(decor.build(), vcMat()));
    // windows on the outer walls (sky view, frame, sill, curtains)
    const winMat = new THREE.MeshBasicMaterial({ map: outsideTexture(), toneMapped: false });
    const winSpots: { x: number; z: number; ry: number; group: THREE.Group }[] = [
      { x: 4.5, z: 1, ry: 0, group: this.shell }, { x: 9.6, z: 1, ry: 0, group: this.shell }, { x: 19.6, z: 1, ry: 0, group: this.shell },
      { x: 1, z: 4.5, ry: Math.PI / 2, group: this.shell }, { x: 1, z: 11.5, ry: Math.PI / 2, group: this.shell },
      { x: 4.5, z: 15, ry: Math.PI, group: this.fpOnly }, { x: 12, z: 15, ry: Math.PI, group: this.fpOnly }, { x: 18, z: 15, ry: Math.PI, group: this.fpOnly },
      { x: 21, z: 3, ry: -Math.PI / 2, group: this.fpOnly }, { x: 21, z: 11.5, ry: -Math.PI / 2, group: this.fpOnly },
    ];
    for (const w of winSpots) {
      const g = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.85), winMat);
      pane.position.set(0, 1.45, T + 0.015);
      g.add(pane);
      const f = mb();
      f.box(1.14, 0.07, 0.08, 0xfff4e0, { pos: [0, 1.88, T + 0.03] });
      f.box(1.14, 0.07, 0.08, 0xfff4e0, { pos: [0, 1.02, T + 0.03] });
      for (const sx of [-1, 1]) f.box(0.07, 0.9, 0.08, 0xfff4e0, { pos: [sx * 0.535, 1.45, T + 0.03] });
      f.box(0.04, 0.85, 0.05, 0xfff4e0, { pos: [0, 1.45, T + 0.035] });
      f.box(1.0, 0.04, 0.05, 0xfff4e0, { pos: [0, 1.45, T + 0.035] });
      f.box(1.3, 0.05, 0.18, 0xd8b890, { pos: [0, 0.99, T + 0.09] }); // sill
      f.sphere(0.07, 0xc8603a, { pos: [-0.35, 1.07, T + 0.1], scale: [1, 0.8, 1] }, 8); // little pot
      f.sphere(0.08, 0x6ac85a, { pos: [-0.35, 1.16, T + 0.1] }, 8);
      // curtains
      for (const sx of [-1, 1]) {
        f.box(0.22, 1.05, 0.04, 0xf4a0a0, { pos: [sx * 0.66, 1.42, T + 0.12] });
        for (let k = 0; k < 3; k++) f.box(0.03, 1.05, 0.05, 0xe08888, { pos: [sx * 0.66 + (k - 1) * 0.07, 1.42, T + 0.14] });
      }
      f.cyl(0.015, 0.015, 1.6, 0x8a5a3a, { pos: [0, 2.0, T + 0.13], rot: [0, 0, Math.PI / 2] }, 6);
      g.add(new THREE.Mesh(f.build(), vcMat()));
      // face into the room
      g.position.set(w.x, 0, w.z);
      g.rotation.y = w.ry;
      w.group.add(g);
    }
    // living room fireplace (north wall)
    const fpB = mb();
    fpB.box(1.6, 1.15, 0.24, 0xb8b0a8, { pos: [17.2, 0.58, 1 + T + 0.12] });
    fpB.box(1.0, 0.7, 0.05, 0x2a2220, { pos: [17.2, 0.45, 1 + T + 0.23] });
    fpB.box(1.85, 0.1, 0.34, 0x8a5a3a, { pos: [17.2, 1.2, 1 + T + 0.15] });
    for (let i = 0; i < 3; i++) fpB.cyl(0.05, 0.05, 0.6, 0x7a5232, { pos: [17.2 + (i - 1) * 0.12, 0.2 + (i % 2) * 0.06, 1 + T + 0.2], rot: [0, 0, Math.PI / 2] }, 6);
    fpB.cyl(0.05, 0.06, 0.18, 0xd8c8a8, { pos: [16.6, 1.34, 1 + T + 0.16] }, 8); // candle
    fpB.sphere(0.06, 0xffc8a0, { pos: [17.6, 1.32, 1 + T + 0.16] }, 8);
    this.shell.add(new THREE.Mesh(fpB.build(), vcMat()));
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 7), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }));
    fire.position.set(17.2, 0.42, 1 + T + 0.2);
    fire.userData.flame = true;
    this.shell.add(fire);
    // paintings, a clock and shelves
    const pics: [number, number, number, number][] = [[2.6, 1, 0, 0], [6.6, 1, 0, 2], [15.0, 1, 0, 3], [1, 2.6, Math.PI / 2, 1], [1, 13.6, Math.PI / 2, 2]];
    for (const [x, z, ry, k] of pics) {
      const g = new THREE.Group();
      const fr = mb();
      fr.box(0.74, 0.58, 0.05, 0x8a5a3a, { pos: [0, 1.6, T + 0.025] });
      g.add(new THREE.Mesh(fr.build(), vcMat()));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshLambertMaterial({ map: paintingTexture(k) }));
      pic.position.set(0, 1.6, T + 0.052);
      g.add(pic);
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.shell.add(g);
    }
    const kit = mb();
    kit.box(1.8, 0.05, 0.26, 0xa87a4a, { pos: [11.6, 1.55, 1 + T + 0.13] }); // shelf
    for (let i = 0; i < 6; i++) kit.cyl(0.06, 0.06, 0.16, [0xff9a6a, 0x8ad07a, 0xffd03a, 0x8ab8e8, 0xe8a0c8, 0xd8c8a0][i], { pos: [10.9 + i * 0.28, 1.66, 1 + T + 0.13] }, 8);
    kit.cyl(0.2, 0.2, 0.04, 0xfff4e0, { pos: [13.2, 1.75, 1 + T + 0.03], rot: [Math.PI / 2, 0, 0] }, 16); // clock
    kit.torus(0.2, 0.02, 0x8a5a3a, { pos: [13.2, 1.75, 1 + T + 0.05] });
    kit.box(0.015, 0.14, 0.01, 0x3a2a22, { pos: [13.2, 1.8, 1 + T + 0.06] });
    kit.box(0.1, 0.015, 0.01, 0x3a2a22, { pos: [13.24, 1.75, 1 + T + 0.06] });
    this.shell.add(new THREE.Mesh(kit.build(), vcMat()));
    // pendant lamps (first person) at the light points
    this.lightPoints = [new THREE.Vector3(4.5, 2.0, 4.5), new THREE.Vector3(11, 2.0, 4.5), new THREE.Vector3(17.5, 2.0, 4.5), new THREE.Vector3(4.5, 2.0, 11.5), new THREE.Vector3(14.5, 2.0, 11.5)];
    const lamps = mb();
    const bulbs = mb();
    for (const p of this.lightPoints) {
      lamps.cyl(0.01, 0.01, WALL_H - 1.95, 0x3a2a22, { pos: [p.x, (WALL_H + 1.95) / 2, p.z] }, 4);
      lamps.lathe([[0.02, 0.0], [0.12, -0.05], [0.24, -0.2], [0.25, -0.22]], 0xf0d8a0, { pos: [p.x, 1.95, p.z] }, 14);
      bulbs.sphere(0.07, 0xfff0c0, { pos: [p.x, 1.76, p.z] }, 8);
    }
    const lampMesh = new THREE.Mesh(lamps.build(), vcMat());
    (lampMesh.material as THREE.Material).side = THREE.DoubleSide;
    this.fpOnly.add(lampMesh, new THREE.Mesh(bulbs.build(), glowMat));
    // exit door (east wall) with mat
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x8a5a3a, gradientMap: toonGradient() }));
    mat.position.set(20.3, 0.02, 6.5);
    this.shell.add(mat);
    const door = mb();
    door.box(0.1, DOOR_H, 1.1, 0x8a5a3a, { pos: [21.0, DOOR_H / 2, 6.5] });
    for (let i = 0; i < 3; i++) door.box(0.12, 0.5, 0.42, 0x7a4a2a, { pos: [20.98, 0.4 + i * 0.6, 6.5] });
    door.box(0.12, 0.3, 0.5, 0xcfeaff, { pos: [20.97, 1.6, 6.5] });
    door.sphere(0.06, 0xffd03a, { pos: [20.9, 1.0, 6.15] });
    this.shell.add(new THREE.Mesh(door.build(), vcMat()));
    this.setFirstPerson(this.fp);
  }

  /** Flicker the fireplace. */
  update(t: number): void {
    for (const c of this.shell.children) if (c.userData.flame) c.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9.7) * 0.15, 1);
  }

  refreshFurniture(): void {
    const items: { key: string; matrix: THREE.Matrix4 }[] = [];
    const glow: { key: string; matrix: THREE.Matrix4 }[] = [];
    for (const f of this.ctx.state.house.furniture) {
      const def = DECOR_BY_ID[f.kind];
      if (!def) continue;
      const fp = footprintOf(f.kind, f.x, f.z, f.rot);
      const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
      const m = trs(cx, 0.02, cz, def.wall ? 0 : -f.rot * (Math.PI / 2));
      items.push({ key: f.kind, matrix: m });
      if (def.light) glow.push({ key: f.kind, matrix: m });
    }
    this.furn.build(items);
    this.glow.build(glow);
    this.world.recomputeDynamicBlocked();
  }

  blockedAt(x: number, z: number, r: number): boolean {
    // outer bounds
    if (x - r < 1 || z - r < 1 || x + r > HOUSE_W - 1 || z + r > HOUSE_D - 1) return true;
    // locked rooms
    for (const room of HOUSE_ROOMS) {
      if (this.ctx.state.house.rooms[room.id]?.unlocked) continue;
      if (x + r > room.x0 && x - r < room.x1 && z + r > room.z0 && z - r < room.z1) return true;
    }
    // interior walls (walk through the doorways)
    for (const wd of WALLS) {
      if (wd.outer) continue;
      const along = wd.axis === 'x' ? z : x, across = wd.axis === 'x' ? x : z;
      if (Math.abs(across - wd.at) > r + T) continue;
      if (along < wd.from - r || along > wd.to + r) continue;
      if (wd.gaps.some(([g0, g1]) => along - r * 0.6 > g0 && along + r * 0.6 < g1)) continue;
      return true;
    }
    return false;
  }

  markBlocked(arr: Uint8Array, w: number): void {
    for (const f of this.ctx.state.house.furniture) {
      const def = DECOR_BY_ID[f.kind];
      if (!def || def.blocks === false || def.wall || def.cat === 'rug') continue;
      const fp = footprintOf(f.kind, f.x, f.z, f.rot);
      for (let x = fp.x0; x < fp.x1; x++) for (let z = fp.z0; z < fp.z1; z++) arr[z * w + x] = 1;
    }
    for (const room of HOUSE_ROOMS) {
      if (this.ctx.state.house.rooms[room.id]?.unlocked) continue;
      for (let x = room.x0; x < room.x1; x++) for (let z = room.z0; z < room.z1; z++) arr[z * w + x] = 1;
    }
  }

  dispose(): void {
    this.furn.dispose();
    this.glow.dispose();
    for (const g of [this.shell, this.fpOnly, this.isoOnly]) g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.group.clear();
  }
}
