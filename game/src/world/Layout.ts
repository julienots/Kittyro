import type { RegionId } from '../state/types';
import type { NodeRef } from '../systems/Gathering';
import { Noise2D, Random, hashString } from '../core/Random';

export const T = {
  GRASS: 0, PATH: 1, SAND: 2, WATER: 3, DEEP: 4, ROCK: 5, SNOW: 6, LAVA: 7, FLOOR: 8, BRIDGE: 9, VOID: 10,
  FOREST: 11, ASH: 12, PLAZA: 13, ICE: 14, DIRT: 15,
} as const;
export type Tile = (typeof T)[keyof typeof T];

export const WALKABLE: Record<number, boolean> = {
  [T.GRASS]: true, [T.PATH]: true, [T.SAND]: true, [T.SNOW]: true, [T.FLOOR]: true, [T.BRIDGE]: true,
  [T.FOREST]: true, [T.ASH]: true, [T.PLAZA]: true, [T.ICE]: true, [T.DIRT]: true,
};
export const FISHABLE: Record<number, boolean> = { [T.WATER]: true, [T.DEEP]: true, [T.LAVA]: true };

export interface StaticProp {
  model: string; // decor model id OR special ('tree:<kind>', 'rock', 'grassClump'...)
  x: number;
  z: number;
  rot?: number;
  scale?: number;
  blocks?: boolean;
}

export interface Structure {
  kind: string; // 'farmBuilding' | 'village' | 'bridge' | 'signpost' | ...
  id?: string;
  x: number;
  z: number;
  w: number;
  d: number;
  rot?: number;
  params?: Record<string, any>;
  blocks?: boolean;
}

export interface Portal {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  to: RegionId;
  anchor: string; // spawn anchor name in target region
  label: string;
}

export interface RegionLayout {
  id: RegionId;
  w: number;
  d: number;
  tiles: Uint8Array;
  heights: Float32Array; // per tile target height
  blocked: Uint8Array; // static collision
  nodes: NodeRef[];
  props: StaticProp[];
  structures: Structure[];
  anchors: Record<string, { x: number; z: number }>;
  portals: Portal[];
  grass: number; // grass tuft density 0..1
  flowers: number[]; // flower tuft colours
  skirt: number[]; // soil layer colours (diorama sides)
  waterLevel: number;
  indoor: boolean;
  seasonal: boolean; // snow cover in winter
}

/** Helper used by region generators to paint tiles, heights, nodes and props. */
export class LayoutBuilder {
  L: RegionLayout;
  noise: Noise2D;
  r: Random;
  private reserved: Uint8Array;

  constructor(id: RegionId, w: number, d: number, seed: number, base: Tile = T.GRASS) {
    this.L = {
      id, w, d,
      tiles: new Uint8Array(w * d).fill(base),
      heights: new Float32Array(w * d),
      blocked: new Uint8Array(w * d),
      nodes: [], props: [], structures: [], anchors: {}, portals: [],
      grass: 0.5, flowers: [0xffffff, 0xffd03a, 0xff8ab8], skirt: [0x8fcf5f, 0x9a6a42, 0x7a5232, 0x5a4a48],
      waterLevel: -0.22, indoor: false, seasonal: true,
    };
    this.noise = new Noise2D(seed ^ hashString(id));
    this.r = new Random((seed ^ hashString(id + 'r')) >>> 0);
    this.reserved = new Uint8Array(w * d);
  }

  in(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.L.w && z < this.L.d;
  }
  i(x: number, z: number): number {
    return z * this.L.w + x;
  }
  get(x: number, z: number): number {
    return this.in(x, z) ? this.L.tiles[this.i(x, z)] : T.VOID;
  }
  set(x: number, z: number, t: Tile): void {
    if (this.in(x, z)) this.L.tiles[this.i(x, z)] = t;
  }
  rect(x0: number, z0: number, x1: number, z1: number, t: Tile): void {
    for (let x = Math.floor(x0); x < x1; x++) for (let z = Math.floor(z0); z < z1; z++) this.set(x, z, t);
  }
  circle(cx: number, cz: number, r: number, t: Tile, wobble = 0.25): void {
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      for (let z = Math.floor(cz - r - 2); z <= cz + r + 2; z++) {
        const n = (this.noise.get(x * 0.4, z * 0.4) - 0.5) * 2 * wobble * r;
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r + n) this.set(x, z, t);
      }
    }
  }
  /** Thick polyline (paths, rivers). */
  line(points: [number, number][], width: number, t: Tile, wobble = 0.3): void {
    for (let p = 0; p < points.length - 1; p++) {
      const [ax, az] = points[p], [bx, bz] = points[p + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(len * 3);
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const x = ax + (bx - ax) * t2, z = az + (bz - az) * t2;
        const wv = width / 2 + (this.noise.get(x * 0.3, z * 0.3) - 0.5) * wobble * width;
        for (let ix = Math.floor(x - wv - 1); ix <= x + wv + 1; ix++) {
          for (let iz = Math.floor(z - wv - 1); iz <= z + wv + 1; iz++) {
            if (Math.hypot(ix + 0.5 - x, iz + 0.5 - z) <= wv) this.set(ix, iz, t);
          }
        }
      }
    }
  }
  reserve(x0: number, z0: number, x1: number, z1: number): void {
    for (let x = Math.floor(x0); x < x1; x++) for (let z = Math.floor(z0); z < z1; z++) if (this.in(x, z)) this.reserved[this.i(x, z)] = 1;
  }
  isReserved(x: number, z: number): boolean {
    return !this.in(x, z) || this.reserved[this.i(x, z)] === 1;
  }
  free(x: number, z: number, allowed: number[] = [T.GRASS, T.FOREST, T.SNOW, T.ASH, T.SAND, T.DIRT, T.FLOOR]): boolean {
    if (!this.in(x, z) || this.isReserved(x, z)) return false;
    return allowed.includes(this.get(x, z));
  }
  /** Border of impassable scenery so the diorama has a framed edge. */
  border(t: Tile, thickness = 2, except: [number, number, number, number][] = []): void {
    const { w, d } = this.L;
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
      const edge = x < thickness || z < thickness || x >= w - thickness || z >= d - thickness;
      if (!edge) continue;
      if (except.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1)) continue;
      this.set(x, z, t);
    }
  }

  node(kind: string, x: number, z: number, extra: Partial<NodeRef> = {}): NodeRef {
    const id = `${this.L.id}_${kind}_${Math.round(x * 2)}_${Math.round(z * 2)}`;
    const n: NodeRef = { id, kind, region: this.L.id, x, z, variant: this.r.int(0, 5), ...extra };
    this.L.nodes.push(n);
    this.reserve(Math.floor(x), Math.floor(z), Math.floor(x) + 1, Math.floor(z) + 1);
    return n;
  }
  /** Scatter nodes on free tiles inside a rect using noise density. */
  scatter(kind: string | string[], count: number, x0: number, z0: number, x1: number, z1: number, allowed?: number[], spacing = 1): number {
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 30) {
      tries++;
      const x = this.r.int(Math.floor(x0), Math.floor(x1) - 1), z = this.r.int(Math.floor(z0), Math.floor(z1) - 1);
      if (!this.free(x, z, allowed)) continue;
      let ok = true;
      for (let dx = -spacing; dx <= spacing && ok; dx++) for (let dz = -spacing; dz <= spacing && ok; dz++) if (this.isReserved(x + dx, z + dz) && (dx || dz)) ok = false;
      if (!ok) continue;
      const k = Array.isArray(kind) ? this.r.pick(kind) : kind;
      this.node(k, x + 0.5 + this.r.range(-0.15, 0.15), z + 0.5 + this.r.range(-0.15, 0.15));
      placed++;
    }
    return placed;
  }
  prop(model: string, x: number, z: number, o: Partial<StaticProp> = {}): void {
    this.L.props.push({ model, x, z, rot: o.rot ?? this.r.range(0, Math.PI * 2), scale: o.scale ?? 1, blocks: o.blocks });
    if (o.blocks) this.reserve(Math.floor(x), Math.floor(z), Math.floor(x) + 1, Math.floor(z) + 1);
  }
  structure(s: Structure): void {
    this.L.structures.push(s);
    this.reserve(s.x, s.z, s.x + s.w, s.z + s.d);
  }
  anchor(name: string, x: number, z: number): void {
    this.L.anchors[name] = { x, z };
  }
  portal(p: Portal): void {
    this.L.portals.push(p);
    this.reserve(p.x0, p.z0, p.x1, p.z1);
  }

  /** Compute tile target heights from types + gentle noise. */
  finalizeHeights(opts: { hills?: number; rockHeight?: number } = {}): void {
    const { w, d, tiles, heights } = this.L;
    const hills = opts.hills ?? 0.25;
    const rockH = opts.rockHeight ?? 2.2;
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const t = tiles[z * w + x];
      let h = (this.noise.fbm(x * 0.09, z * 0.09, 3) - 0.5) * 2 * hills;
      if (t === T.WATER) h = -0.55;
      else if (t === T.DEEP) h = -0.9;
      else if (t === T.LAVA) h = -0.45;
      else if (t === T.ROCK) h = rockH * (0.7 + this.noise.fbm(x * 0.15 + 9, z * 0.15, 2) * 0.8);
      else if (t === T.PATH || t === T.PLAZA || t === T.FLOOR || t === T.BRIDGE) h *= 0.3;
      else if (t === T.SAND) h = h * 0.3 - 0.05;
      else if (t === T.ICE) h = 0.02;
      // land never dips below the water surface (keeps shorelines clean)
      if (t !== T.WATER && t !== T.DEEP && t !== T.LAVA && t !== T.ROCK) h = Math.max(h, -0.08);
      heights[z * w + x] = h;
    }
    // soften rocky ridges into rounded cliffs (avoid spiky pyramids)
    for (let pass = 0; pass < 2; pass++) {
      const copy = heights.slice();
      for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) {
        if (tiles[z * w + x] !== T.ROCK) continue;
        let sum = 0, n = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const t2 = tiles[(z + dz) * w + x + dx];
          if (t2 === T.ROCK) { sum += copy[(z + dz) * w + x + dx]; n++; }
        }
        heights[z * w + x] = sum / n;
      }
    }
    // flatten anything structures stand on
    for (const s of this.L.structures) {
      if (s.kind === 'bridge') continue;
      let avg = 0, n = 0;
      for (let x = s.x; x < s.x + s.w; x++) for (let z = s.z; z < s.z + s.d; z++) if (this.in(x, z)) { avg += heights[z * w + x]; n++; }
      avg = n ? avg / n : 0;
      for (let x = s.x - 1; x <= s.x + s.w; x++) for (let z = s.z - 1; z <= s.z + s.d; z++) if (this.in(x, z) && tiles[z * w + x] !== T.WATER) heights[z * w + x] = avg;
    }
  }

  finalizeBlocked(): void {
    const { w, d, tiles, blocked } = this.L;
    for (let i = 0; i < w * d; i++) blocked[i] = WALKABLE[tiles[i]] ? 0 : 1;
    for (const s of this.L.structures) {
      if (s.blocks === false) continue;
      for (let x = s.x; x < s.x + s.w; x++) for (let z = s.z; z < s.z + s.d; z++) if (this.in(x, z)) blocked[z * w + x] = 1;
    }
    for (const p of this.L.props) if (p.blocks) blocked[this.i(Math.floor(p.x), Math.floor(p.z))] = 1;
  }

  done(opts?: { hills?: number; rockHeight?: number }): RegionLayout {
    this.finalizeHeights(opts);
    this.finalizeBlocked();
    return this.L;
  }
}
