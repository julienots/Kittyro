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

export class HouseView {
  readonly group = new THREE.Group();
  private furn: InstanceBatch;
  private glow: InstanceBatch;
  private shell = new THREE.Group();
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
    this.group.add(this.shell, this.furn.group, this.glow.group);
  }

  build(): void {
    this.buildShell();
    this.refreshFurniture();
  }

  buildShell(): void {
    this.shell.clear();
    const st = this.ctx.state;
    const H = 2.4;
    // base slab
    const base = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W - 1.6, 0.3, HOUSE_D - 1.6), new THREE.MeshToonMaterial({ color: 0xa87a52, gradientMap: toonGradient() }));
    base.position.set(HOUSE_W / 2, -0.16, HOUSE_D / 2);
    this.shell.add(base);
    for (const r of HOUSE_ROOMS) {
      const rs = st.house.rooms[r.id];
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const fl = FLOORS.find((f) => f.id === rs.floor) ?? FLOORS[0];
      const wp = WALLPAPERS.find((x) => x.id === rs.wall) ?? WALLPAPERS[0];
      // floor
      const ftex = patternTexture(fl.pattern, fl.c1, fl.c2).clone();
      ftex.repeat.set(w / 2, d / 2);
      ftex.needsUpdate = true;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: ftex, gradientMap: toonGradient(), color: rs.unlocked ? 0xffffff : 0x8a8078 }));
      floor.position.set(r.x0 + w / 2, 0.01, r.z0 + d / 2);
      floor.receiveShadow = true;
      this.shell.add(floor);
      // back wall (north) — full height only for the top row; low partitions elsewhere
      const topRow = r.z0 <= 1;
      const wtex = patternTexture(wp.pattern, wp.c1, wp.c2).clone();
      wtex.repeat.set(w / 2, 1.2);
      wtex.needsUpdate = true;
      const wallMat = new THREE.MeshToonMaterial({ map: wtex, gradientMap: toonGradient(), color: rs.unlocked ? 0xffffff : 0x9a9088 });
      const wh = topRow ? H : 0.7;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, wh, 0.18), wallMat);
      back.position.set(r.x0 + w / 2, wh / 2, r.z0 - 0.09);
      back.receiveShadow = true;
      back.castShadow = true;
      this.shell.add(back);
      // trim
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.24), new THREE.MeshToonMaterial({ color: 0xfff4e0, gradientMap: toonGradient() }));
      trim.position.set(r.x0 + w / 2, wh, r.z0 - 0.09);
      this.shell.add(trim);
      // left wall (west)
      const lw = r.x0 <= 1 ? H : 0.7;
      const ltex = wtex.clone();
      ltex.repeat.set(d / 2, 1.2);
      ltex.needsUpdate = true;
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.18, lw, d), new THREE.MeshToonMaterial({ map: ltex, gradientMap: toonGradient(), color: rs.unlocked ? 0xffffff : 0x9a9088 }));
      left.position.set(r.x0 - 0.09, lw / 2, r.z0 + d / 2);
      left.receiveShadow = true;
      this.shell.add(left);
      if (r.x0 <= 1 || topRow) {
        // window on outer wall with daylight
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), new THREE.MeshBasicMaterial({ color: 0xcfeaff }));
        if (topRow) win.position.set(r.x0 + w / 2 + 1.2, 1.5, r.z0 + 0.005);
        else {
          win.position.set(r.x0 + 0.005, 1.5, r.z0 + d / 2);
          win.rotation.y = Math.PI / 2;
        }
        this.shell.add(win);
      }
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
    // exit door mat
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x8a5a3a, gradientMap: toonGradient() }));
    mat.position.set(20.5, 0.02, 6.6);
    this.shell.add(mat);
    const door = mb();
    door.box(0.12, 2.0, 1.1, 0x8a5a3a, { pos: [21.0, 1.0, 6.5] });
    door.sphere(0.06, 0xffd03a, { pos: [20.9, 1.0, 6.2] });
    this.shell.add(new THREE.Mesh(door.build(), vcMat()));
    this.lightPoints = [new THREE.Vector3(4.5, 2.0, 4.5), new THREE.Vector3(11, 2.0, 4.5), new THREE.Vector3(17.5, 2.0, 4.5), new THREE.Vector3(4.5, 2.0, 11.5), new THREE.Vector3(14.5, 2.0, 11.5)];
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
    this.shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.group.clear();
  }
}
