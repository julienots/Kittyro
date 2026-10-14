import * as THREE from 'three';
import type { RegionId, Season } from '../state/types';
import type { Ctx } from '../systems/Context';
import type { NodeRef } from '../systems/Gathering';
import { buildRegion } from './regions';
import { T, WALKABLE, FISHABLE, type RegionLayout, type Structure } from './Layout';
import { buildTerrain, type TerrainResult } from './Terrain';
import { InstanceBatch, trs, type Handle } from './Instancing';
import { nodeGeo, staticPropGeo, glowMat, windowMat, foliageMat, propMat, grassMat } from './PropFactory';
import { NODE_KINDS } from '../data/nodes';
import { grassTuftGeo, flowerTuftGeo } from '../models/Nature';
import { structureGeo, villageBuildingModel, type BuildingModel } from '../models/Buildings';
import { VILLAGE_BY_ID } from '../data/village';
import { vcMat, basicMat } from '../render/Materials';
import { seasonOfDay } from '../data/constants';
import { FARM_THEMES } from '../data/shop';
import type { Particles } from '../render/Particles';
import { FarmView } from './FarmView';
import { HouseView } from './HouseView';
import { HamletView } from './HamletView';
import type { MineFloor } from '../systems/Mining';
import { Random } from '../core/Random';

export interface Interactable {
  id: string;
  kind: string;
  x: number;
  z: number;
  radius: number;
  label: string;
  icon: string;
  data?: any;
}

interface NodeView {
  node: NodeRef;
  handle: Handle | null;
  extra: Handle | null; // stump while regrowing
  key: string;
  shake: number;
  baseScale: number;
  rot: number;
  growth: number;
}

const SPEC_FOLIAGE = (key: string) => key.includes('tree_') || key.includes('bush') || key.includes('weeds');

export class World {
  readonly root = new THREE.Group();
  layout!: RegionLayout;
  terrain!: TerrainResult;
  region: RegionId = 'farm';
  season: Season = 'spring';
  nodeBatch: InstanceBatch;
  propBatch: InstanceBatch;
  glowBatch: InstanceBatch;
  grassBatch: InstanceBatch;
  nodes: NodeView[] = [];
  private nodeIndex = new Map<string, NodeView>();
  structures: { s: Structure; obj: THREE.Object3D; model?: BuildingModel; spinner?: THREE.Object3D }[] = [];
  smokePoints: THREE.Vector3[] = [];
  lightPoints: THREE.Vector3[] = [];
  firePoints: THREE.Vector3[] = [];
  interactables: Interactable[] = [];
  farm: FarmView | null = null;
  house: HouseView | null = null;
  hamlet: HamletView | null = null;
  mineFloor: MineFloor | null = null;
  waterfalls: THREE.Mesh[] = [];
  private pointLights: THREE.PointLight[] = [];
  private dynBlocked: Uint8Array = new Uint8Array(0);
  private smokeTimer = 0;

  constructor(private ctx: Ctx, private particles: Particles, private qualityGrass: () => number, private maxLights: () => number) {
    const season = () => this.season;
    this.nodeBatch = new InstanceBatch((key) => {
      const g = nodeGeo(key, season(), this.region);
      if (!g) return null;
      const glowy = key.includes('ore_crystal') || key.includes('ore_frost') || key.includes('ore_ember') || key.includes('glowcap');
      return { geo: g, mat: SPEC_FOLIAGE(key) ? foliageMat() : glowy ? vcMat({ emissive: 0x332244, emissiveIntensity: 0.6, seeThrough: true }) : propMat() };
    });
    this.propBatch = new InstanceBatch((key) => {
      const g = staticPropGeo(key, season(), this.region);
      if (!g) return null;
      return { geo: g.geo, mat: key.startsWith('tree:') || key === 'fern' ? foliageMat() : propMat() };
    });
    this.glowBatch = new InstanceBatch((key) => {
      const g = staticPropGeo(key, season(), this.region);
      if (!g?.glow) return null;
      return { geo: g.glow, mat: glowMat, shadow: false };
    }, false, false);
    this.grassBatch = new InstanceBatch((key) => {
      if (key === 'grass') return { geo: grassTuftGeo(), mat: grassMat(), shadow: false };
      return { geo: flowerTuftGeo(), mat: grassMat(), shadow: false };
    }, false, true);
  }

  // ---------------- loading ----------------
  load(region: RegionId, mineFloor?: MineFloor): void {
    this.unload();
    const st = this.ctx.state;
    this.region = region;
    this.season = seasonOfDay(st.time.day);
    this.mineFloor = mineFloor ?? null;
    this.layout = buildRegion(region, st, mineFloor);
    const theme = FARM_THEMES.find((t) => t.id === st.flags.theme)?.grass as [number, number] | undefined;
    this.terrain = buildTerrain(this.layout, this.season, theme);
    this.root.add(this.terrain.ground, this.terrain.skirt);
    if (region === 'house') {
      this.terrain.ground.visible = false;
      this.terrain.skirt.visible = false;
    }
    if (this.terrain.water) this.root.add(this.terrain.water);
    if (this.terrain.lava) this.root.add(this.terrain.lava);
    this.root.add(this.nodeBatch.group, this.propBatch.group, this.glowBatch.group, this.grassBatch.group);
    this.dynBlocked = new Uint8Array(this.layout.w * this.layout.d);
    this.buildProps();
    this.buildGrass();
    this.buildStructures();
    this.buildNodes();
    if (region === 'farm') {
      this.farm = new FarmView(this.ctx, this, this.particles);
      this.root.add(this.farm.group);
      this.farm.build();
    }
    if (region === 'hamlet') {
      this.hamlet = new HamletView(this.ctx, this, this.particles);
      this.root.add(this.hamlet.group);
      this.hamlet.build();
    }
    if (region === 'house') {
      this.house = new HouseView(this.ctx, this);
      this.root.add(this.house.group);
      this.house.build();
    }
    this.buildInteractables();
    this.recomputeDynamicBlocked();
  }

  unload(): void {
    this.farm?.dispose();
    this.farm = null;
    this.house?.dispose();
    this.house = null;
    this.hamlet?.dispose();
    this.hamlet = null;
    for (const s of this.structures) {
      s.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && !(m.geometry as any).__cached) m.geometry.dispose();
      });
    }
    this.structures = [];
    this.nodes = [];
    this.nodeIndex.clear();
    this.waterfalls = [];
    for (const l of this.pointLights) this.root.remove(l);
    this.pointLights = [];
    if (this.terrain) {
      this.terrain.ground.geometry.dispose();
      this.terrain.skirt.geometry.dispose();
      this.terrain.water?.geometry.dispose();
      this.terrain.lava?.geometry.dispose();
    }
    this.nodeBatch.dispose();
    this.propBatch.dispose();
    this.glowBatch.dispose();
    this.grassBatch.dispose();
    this.root.clear();
    this.smokePoints = [];
    this.lightPoints = [];
    this.firePoints = [];
    this.interactables = [];
  }

  /** Re-skin after a season change without moving anything. */
  reloadVisuals(): void {
    const p = { region: this.region, floor: this.mineFloor ?? undefined };
    this.load(p.region, p.floor);
  }

  // ---------------- queries ----------------
  tile(x: number, z: number): number {
    const L = this.layout;
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= L.w || tz >= L.d) return T.VOID;
    return L.tiles[tz * L.w + tx];
  }

  heightAt(x: number, z: number): number {
    const t = this.tile(x, z);
    if (t === T.BRIDGE) return 0.3;
    if (this.layout.indoor && this.region === 'house') return 0;
    return this.terrain.heightAt(x, z);
  }

  /** Tile-level blocking (static + farm footprint + dynamic nodes). */
  blockedTile(tx: number, tz: number): boolean {
    const L = this.layout;
    if (tx < 0 || tz < 0 || tx >= L.w || tz >= L.d) return true;
    const i = tz * L.w + tx;
    return L.blocked[i] === 1 || this.dynBlocked[i] === 1;
  }

  /** Circle collision test for movement. */
  isBlocked(x: number, z: number, r = 0.28): boolean {
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
      if (this.blockedTile(Math.floor(x + ox), Math.floor(z + oz))) return true;
    }
    // round obstacles (trees, rocks)
    for (const nv of this.nodes) {
      const k = NODE_KINDS[nv.node.kind];
      if (!k?.blocks || nv.growth < 0.5) continue;
      const dx = x - nv.node.x, dz = z - nv.node.z;
      const rr = k.radius * nv.baseScale + r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    if (this.farm?.blockedAt(x, z, r)) return true;
    if (this.house?.blockedAt(x, z, r)) return true;
    return false;
  }

  recomputeDynamicBlocked(): void {
    const L = this.layout;
    this.dynBlocked.fill(0);
    for (const nv of this.nodes) {
      const k = NODE_KINDS[nv.node.kind];
      if (!k?.blocks || nv.growth < 0.5) continue;
      const tx = Math.floor(nv.node.x), tz = Math.floor(nv.node.z);
      if (tx >= 0 && tz >= 0 && tx < L.w && tz < L.d) this.dynBlocked[tz * L.w + tx] = 1;
    }
    this.farm?.markBlocked(this.dynBlocked, L.w);
    this.house?.markBlocked(this.dynBlocked, L.w);
    this.hamlet?.markBlocked(this.dynBlocked, L.w);
  }

  isWaterTile(tx: number, tz: number): boolean {
    const t = this.tile(tx + 0.5, tz + 0.5);
    return !!FISHABLE[t] || (this.farm?.isPondTile(tx, tz) ?? false);
  }

  /** Fishable tile within `reach` in front of a position, or near it. */
  waterInFront(x: number, z: number, facing: number, reach = 2.2): { x: number; z: number; lava: boolean } | null {
    const fx = Math.sin(facing), fz = Math.cos(facing);
    for (let d = 0.8; d <= reach; d += 0.35) {
      const px = x + fx * d, pz = z + fz * d;
      const tx = Math.floor(px), tz = Math.floor(pz);
      if (this.isWaterTile(tx, tz)) return { x: px, z: pz, lava: this.tile(px, pz) === T.LAVA };
    }
    return null;
  }

  nearWater(x: number, z: number, r = 1.6): boolean {
    for (let dx = -r; dx <= r; dx += 0.5) for (let dz = -r; dz <= r; dz += 0.5) {
      const tx = Math.floor(x + dx), tz = Math.floor(z + dz);
      if (this.isWaterTile(tx, tz) && this.tile(x + dx, z + dz) !== T.LAVA) return true;
    }
    return false;
  }

  walkable(x: number, z: number): boolean {
    return !!WALKABLE[this.tile(x, z)] && !this.blockedTile(Math.floor(x), Math.floor(z));
  }

  /** A* on the tile grid (8-neighbour). Returns waypoints at tile centres. */
  findPath(sx: number, sz: number, ex: number, ez: number, maxNodes = 4000): { x: number; z: number }[] | null {
    const L = this.layout;
    const W = L.w, D = L.d;
    const start = Math.floor(sz) * W + Math.floor(sx);
    let goalX = Math.floor(ex), goalZ = Math.floor(ez);
    // if target tile blocked, aim for the nearest free neighbour
    if (this.blockedTile(goalX, goalZ)) {
      let best: [number, number] | null = null, bd = 1e9;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const nx = goalX + dx, nz = goalZ + dz;
        if (this.blockedTile(nx, nz)) continue;
        const dd = (nx + 0.5 - ex) ** 2 + (nz + 0.5 - ez) ** 2;
        if (dd < bd) { bd = dd; best = [nx, nz]; }
      }
      if (!best) return null;
      [goalX, goalZ] = best;
    }
    const goal = goalZ * W + goalX;
    if (start === goal) return [{ x: ex, z: ez }];
    const g = new Float32Array(W * D).fill(Infinity);
    const came = new Int32Array(W * D).fill(-1);
    const closed = new Uint8Array(W * D);
    const open: number[] = [start];
    const f = new Float32Array(W * D).fill(Infinity);
    g[start] = 0;
    const h = (i: number) => Math.hypot((i % W) - goalX, Math.floor(i / W) - goalZ);
    f[start] = h(start);
    let expanded = 0;
    while (open.length && expanded < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      expanded++;
      const cx = cur % W, cz = Math.floor(cur / W);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (this.blockedTile(nx, nz)) continue;
        if (dx && dz && (this.blockedTile(cx + dx, cz) || this.blockedTile(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + h(ni);
          came[ni] = cur;
          open.push(ni);
        }
      }
    }
    if (came[goal] === -1) return null;
    const path: { x: number; z: number }[] = [];
    let c = goal;
    while (c !== start && c !== -1) {
      path.push({ x: (c % W) + 0.5, z: Math.floor(c / W) + 0.5 });
      c = came[c];
    }
    path.reverse();
    if (path.length) path[path.length - 1] = { x: ex, z: ez };
    // string-pull: drop intermediate points with clear line of sight
    const out: { x: number; z: number }[] = [];
    let ax = sx, az = sz;
    for (let i = 0; i < path.length; i++) {
      const next = path[i + 1];
      if (next && this.lineClear(ax, az, next.x, next.z)) continue;
      out.push(path[i]);
      ax = path[i].x;
      az = path[i].z;
    }
    return out;
  }

  lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(len * 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t, 0.25)) return false;
    }
    return true;
  }

  randomWalkable(cx: number, cz: number, r: number, rng: Random): { x: number; z: number } | null {
    for (let i = 0; i < 20; i++) {
      const x = cx + rng.range(-r, r), z = cz + rng.range(-r, r);
      if (!this.isBlocked(x, z, 0.3) && WALKABLE[this.tile(x, z)]) return { x, z };
    }
    return null;
  }

  // ---------------- props & grass ----------------
  private buildProps(): void {
    const items = [];
    const glowItems = [];
    for (const p of this.layout.props) {
      const geo = staticPropGeo(p.model, this.season, this.region);
      if (!geo) {
        if (p.model === 'waterfall') this.addWaterfall(p.x, p.z);
        continue;
      }
      const y = this.heightAt(p.x, p.z);
      const m = trs(p.x, y, p.z, p.rot ?? 0, p.scale ?? 1);
      items.push({ key: p.model, matrix: m });
      if (geo.glow) {
        glowItems.push({ key: p.model, matrix: m });
        this.lightPoints.push(new THREE.Vector3(p.x, y + 1.6, p.z));
      }
    }
    this.propBatch.build(items);
    this.glowBatch.build(glowItems);
  }

  private addWaterfall(x: number, z: number): void {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){ float s = sin(vUv.x*30.0)*0.5+0.5; float f = fract(vUv.y*3.0 + uTime*1.6 + s*0.3);
          vec3 c = mix(vec3(0.55,0.85,1.0), vec3(1.0), smoothstep(0.6,1.0,f)*0.8);
          float a = 0.85 * smoothstep(0.0,0.08,vUv.x) * smoothstep(1.0,0.92,vUv.x);
          gl_FragColor = vec4(c, a); }`,
    });
    const g = new THREE.PlaneGeometry(2.2, 3.2, 1, 1);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, 1.2, z + 0.4);
    m.rotation.x = -0.25;
    this.root.add(m);
    this.waterfalls.push(m);
  }

  private buildGrass(): void {
    const L = this.layout;
    const density = L.grass * this.qualityGrass();
    if (density <= 0.01) return;
    const rng = new Random(L.w * 7 + L.d);
    const items = [];
    const winter = this.season === 'winter' && L.seasonal;
    const tint = new THREE.Color();
    const grassCol = this.season === 'autumn' ? 0xd8c070 : this.season === 'spring' ? 0xa8dc84 : 0x94cc72;
    for (let z = 1; z < L.d - 1; z++) {
      for (let x = 1; x < L.w - 1; x++) {
        const t = L.tiles[z * L.w + x];
        if (t !== T.GRASS && t !== T.FOREST) continue;
        if (L.blocked[z * L.w + x]) continue;
        if (this.region === 'farm' && this.ctx.state.farm.plots[`${x},${z}`]) continue;
        const n = Math.floor(density * 3 + rng.next());
        for (let k = 0; k < n; k++) {
          const px = x + rng.next(), pz = z + rng.next();
          const y = this.heightAt(px, pz);
          const flower = !winter && rng.chance(0.12 * (this.season === 'spring' ? 2 : this.season === 'summer' ? 1.2 : 0.4));
          if (flower) {
            tint.setHex(rng.pick(L.flowers));
            items.push({ key: 'flower', matrix: trs(px, y, pz, rng.next() * 6.28, rng.range(0.8, 1.2)), color: tint.clone() });
          } else {
            tint.setHex(winter ? 0xe0e8f0 : t === T.FOREST ? 0x78b464 : grassCol).multiplyScalar(rng.range(0.85, 1.1));
            items.push({ key: 'grass', matrix: trs(px, y, pz, rng.next() * 6.28, rng.range(0.7, 1.25), rng.range(0.6, 1.3) * (winter ? 0.5 : 1)), color: tint.clone() });
          }
        }
      }
    }
    this.grassBatch.build(items);
  }

  /** Remove grass where new plots are tilled (cheap: rebuild). */
  rebuildGrass(): void {
    this.grassBatch.dispose();
    this.root.add(this.grassBatch.group);
    this.buildGrass();
  }

  // ---------------- structures ----------------
  private buildStructures(): void {
    const st = this.ctx.state;
    for (const s of this.layout.structures) {
      const cx = s.x + s.w / 2, cz = s.z + s.d / 2;
      const y = s.kind === 'bridge' || s.kind === 'pier' ? -0.1 : this.heightAt(cx, cz);
      let obj: THREE.Object3D | null = null;
      let model: BuildingModel | undefined;
      let spinner: THREE.Object3D | undefined;
      switch (s.kind) {
        case 'bridge': {
          const span = s.params?.span === 'z' ? s.d : s.w;
          const g = structureGeo('bridge', { w: span, broken: !!s.params?.broken, stone: !!s.params?.stone, dark: !!s.params?.dark });
          obj = new THREE.Mesh(g, propMat());
          obj.position.set(cx, y, cz);
          if (s.params?.span === 'z') obj.rotation.y = Math.PI / 2;
          const width = s.params?.span === 'z' ? s.w : s.d;
          obj.scale.set(1, 1, width / 1.4);
          break;
        }
        case 'pier': {
          const g = structureGeo('pier', { w: s.d });
          obj = new THREE.Mesh(g, propMat());
          obj.position.set(cx, 0, s.z + s.d - 0.2);
          obj.scale.set(s.w / 1.2, 1, 1);
          break;
        }
        case 'village': {
          const def = VILLAGE_BY_ID[s.id!];
          const restored = !!st.village[s.id!]?.restored;
          model = villageBuildingModel(def.style, s.w, s.d, def.roof, def.wall, restored);
          const g = new THREE.Group();
          const m = new THREE.Mesh(model.geo, vcMat({ seeThrough: true, snowCap: true, textured: true }));
          m.castShadow = m.receiveShadow = true;
          g.add(m);
          if (model.windows) g.add(new THREE.Mesh(model.windows, windowMat));
          g.position.set(s.x, y, s.z);
          obj = g;
          for (const p of model.smoke) this.smokePoints.push(p.clone().add(g.position));
          for (const p of model.lights) this.lightPoints.push(p.clone().add(g.position));
          break;
        }
        case 'campfire':
          obj = new THREE.Mesh(structureGeo('campfire'), propMat());
          obj.position.set(cx, y, cz);
          this.firePoints.push(new THREE.Vector3(cx, y + 0.2, cz));
          this.lightPoints.push(new THREE.Vector3(cx, y + 0.8, cz));
          break;
        case 'lighthouse':
          obj = new THREE.Mesh(structureGeo('lighthouse'), propMat());
          obj.position.set(cx, y, cz);
          this.lightPoints.push(new THREE.Vector3(cx, y + 4.9, cz));
          break;
        default: {
          const g = structureGeo(s.kind, s.params);
          if (!g.attributes.position) break;
          obj = new THREE.Mesh(g, propMat());
          obj.position.set(cx, y, cz);
          if (s.kind === 'ice_gate' || s.kind === 'lava_gate') obj.rotation.y = s.d > s.w ? Math.PI / 2 : 0;
          if (s.kind === 'mine_entrance') obj.position.z = s.z + 0.6;
          if (s.kind === 'shrine') this.lightPoints.push(new THREE.Vector3(cx, y + 1.3, cz));
        }
      }
      if (!obj) continue;
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.root.add(obj);
      this.structures.push({ s, obj, model, spinner });
    }
    // elevator / ladders in the mine
    if (this.region === 'mine' && this.mineFloor) {
      const up = this.layout.anchors.ladder_up;
      const lu = new THREE.Mesh(structureGeo('ladder_up'), propMat());
      lu.position.set(up.x, 0, up.z + 0.2);
      this.root.add(lu);
      const ev = this.layout.anchors.elevator;
      if (ev) {
        const e = new THREE.Mesh(structureGeo('elevator'), propMat());
        e.position.set(ev.x, this.heightAt(ev.x, ev.z), ev.z);
        this.root.add(e);
      }
    }
  }

  // ---------------- nodes ----------------
  private nodeKey(nv: NodeView): string {
    const n = nv.node;
    const g = nv.growth;
    switch (n.kind) {
      case 'forage': return `node:forage:${this.ctx.gathering.forageItem(n)}`;
      case 'bush_berry':
      case 'bush_snow': return `node:${n.kind}:${g >= 1 ? 'full' : 'empty'}`;
      case 'chest': return `node:chest:${g >= 1 ? 'closed' : 'open'}`;
      default: return `node:${n.kind}`;
    }
  }

  private visibleScale(nv: NodeView): number {
    const k = NODE_KINDS[nv.node.kind];
    const g = nv.growth;
    if (g >= 1) return 1;
    if (nv.node.kind === 'chest' || nv.node.kind.startsWith('bush')) return 1;
    if (nv.node.once) return 0;
    if (k.tool === 'axe') return g < 0.2 ? 0 : 0.2 + 0.8 * ((g - 0.2) / 0.8); // sapling grows back
    if (k.tool === 'pickaxe') return g < 0.4 ? 0 : 0.3 + 0.7 * ((g - 0.4) / 0.6); // stones re-emerge
    return g < 0.6 ? 0 : (g - 0.6) / 0.4;
  }

  buildNodes(): void {
    if (!this.nodes.length) {
      for (const n of this.layout.nodes) {
        const rng = new Random(Math.floor(n.x * 1000 + n.z * 7));
        const nv: NodeView = { node: n, handle: null, extra: null, key: '', shake: 0, baseScale: n.kind === 'tree_giant' ? 1 : rng.range(0.9, 1.15), rot: rng.range(0, Math.PI * 2), growth: 1 };
        this.nodes.push(nv);
        this.nodeIndex.set(n.id, nv);
      }
    }
    const items: { key: string; matrix: THREE.Matrix4 }[] = [];
    const owners: { nv: NodeView; extra: boolean }[] = [];
    for (const nv of this.nodes) {
      nv.growth = this.ctx.gathering.growth(nv.node);
      nv.key = this.nodeKey(nv);
      const s = this.visibleScale(nv) * nv.baseScale;
      const y = this.heightAt(nv.node.x, nv.node.z);
      if (s > 0.01) {
        items.push({ key: nv.key, matrix: trs(nv.node.x, y, nv.node.z, nv.rot, s) });
        owners.push({ nv, extra: false });
      }
      const k = NODE_KINDS[nv.node.kind];
      if (k?.tool === 'axe' && nv.growth < 1 && !nv.node.once && nv.node.kind !== 'stump') {
        items.push({ key: 'node:stump_small', matrix: trs(nv.node.x + 0.15, y, nv.node.z + 0.1, nv.rot, 1) });
        owners.push({ nv, extra: true });
      }
      nv.handle = null;
      nv.extra = null;
    }
    const handles = this.nodeBatch.build(items);
    handles.forEach((h, i) => {
      const o = owners[i];
      if (o.extra) o.nv.extra = h;
      else o.nv.handle = h;
    });
  }

  node(id: string): NodeView | undefined {
    return this.nodeIndex.get(id);
  }

  shakeNode(id: string): void {
    const nv = this.nodeIndex.get(id);
    if (nv) nv.shake = 0.35;
  }

  /** Periodic refresh: regrowth + daily forage changes. */
  refreshNodes(): void {
    let changed = false;
    for (const nv of this.nodes) {
      const g = this.ctx.gathering.growth(nv.node);
      const key = this.nodeKey({ ...nv, growth: g });
      if (Math.abs(g - nv.growth) > 0.02 || key !== nv.key || (g >= 1) !== (nv.growth >= 1)) changed = true;
    }
    if (changed) {
      this.buildNodes();
      this.recomputeDynamicBlocked();
    }
  }

  nodesNear(x: number, z: number, r: number): NodeView[] {
    return this.nodes.filter((nv) => (nv.node.x - x) ** 2 + (nv.node.z - z) ** 2 < r * r);
  }

  // ---------------- interactables ----------------
  buildInteractables(): void {
    const L = this.layout;
    const st = this.ctx.state;
    const out: Interactable[] = [];
    for (const s of L.structures) {
      const cx = s.x + s.w / 2;
      if (s.kind === 'village') {
        const def = VILLAGE_BY_ID[s.id!];
        const restored = st.village[s.id!]?.restored;
        const door = this.layout.anchors[`${s.id}_front`];
        out.push({ id: `village:${s.id}`, kind: 'village', x: door.x, z: door.z - 0.6, radius: 1.6, label: restored ? def.name : `Restaurer : ${def.name}`, icon: restored ? def.icon : '🔨', data: { id: s.id } });
      }
      if (s.kind === 'request_board') out.push({ id: 'board', kind: 'board', x: cx, z: s.z + 1.2, radius: 1.4, label: 'Tableau des demandes', icon: '📋' });
      if (s.kind === 'signpost' && s.params?.label === 'Carte de Bibi') out.push({ id: 'mapboard', kind: 'map', x: cx, z: s.z + 1, radius: 1.3, label: 'Carte du monde', icon: '🗺️' });
      if (s.kind === 'mine_entrance') out.push({ id: 'mine', kind: 'mine', x: L.anchors.mine_door.x, z: L.anchors.mine_door.z - 0.6, radius: 1.6, label: 'Entrer dans la mine', icon: '⛏️' });
      if (s.kind === 'bridge' && s.id === 'woods_bridge' && s.params?.broken) out.push({ id: 'woods_bridge', kind: 'bridge', x: cx, z: s.z + s.d + 0.3, radius: 2.2, label: 'Vieux pont cassé', icon: '🌉' });
      if (s.kind === 'shrine') out.push({ id: 'shrine', kind: 'shrine', x: cx, z: s.z + 1.2, radius: 1.4, label: 'Autel de cristal', icon: '💜' });
      if (s.kind === 'hamlet_board') out.push({ id: 'register', kind: 'register', x: cx, z: s.z + 1.6, radius: 1.5, label: 'Registre du hameau', icon: '📒' });
      if (s.kind === 'tent' && s.id === 'traveller_tent') { out.push({ id: 'traveller', kind: 'traveller', x: cx, z: s.z + s.d + 0.5, radius: 1.4, label: 'Tente du voyageur', icon: '⛺' }); continue; }
      if (s.kind === 'tent') out.push({ id: 'camp', kind: 'camp', x: cx + 1.5, z: s.z + 2, radius: 1.5, label: 'Camp de Bibi', icon: '⛺' });
      if (s.kind === 'igloo') out.push({ id: 'igloo', kind: 'secret', x: cx, z: s.z + s.d + 0.6, radius: 1.4, label: 'Igloo mystérieux', icon: '❄️', data: { secret: 'igloo' } });
      if (s.kind === 'lighthouse') out.push({ id: 'lighthouse', kind: 'secret', x: cx, z: s.z + s.d + 0.4, radius: 1.4, label: 'Phare', icon: '🗼', data: { secret: 'lighthouse' } });
    }
    if (this.region === 'mine' && this.mineFloor) {
      const up = L.anchors.ladder_up;
      out.push({ id: 'ladder_up', kind: 'ladder_up', x: up.x, z: up.z - 0.3, radius: 1.3, label: this.mineFloor.floor <= 1 ? 'Sortir de la mine' : 'Remonter', icon: '🪜' });
      if (L.anchors.elevator) out.push({ id: 'elevator', kind: 'elevator', x: L.anchors.elevator.x, z: L.anchors.elevator.z, radius: 1.5, label: 'Ascenseur', icon: '🛗' });
    }
    if (this.region === 'woods') out.push({ id: 'grove_secret', kind: 'secret', x: 45, z: 11, radius: 1.8, label: 'Cercle ancien', icon: '✨', data: { secret: 'grove' } });
    if (this.region === 'ember') out.push({ id: 'spring', kind: 'secret', x: 37, z: 33, radius: 1.8, label: 'Source chaude', icon: '♨️', data: { secret: 'spring' } });
    if (this.region === 'mountains') out.push({ id: 'summit', kind: 'secret', x: 41.5, z: 12, radius: 1.5, label: 'Derrière la cascade', icon: '💧', data: { secret: 'waterfall' } });
    if (this.region === 'village' && st.village.fountain?.restored) {
      const p = L.anchors.plaza;
      out.push({ id: 'fountain', kind: 'fountain', x: p.x, z: p.z - 1.6, radius: 1.6, label: 'Jeter une pièce', icon: '⛲' });
    }
    this.interactables = out;
  }

  // ---------------- per-frame ----------------
  update(dt: number, time: number, night: number, focus: THREE.Vector3, camera: THREE.Camera): void {
    // node shake animation
    for (const nv of this.nodes) {
      if (nv.shake <= 0 || !nv.handle) continue;
      nv.shake = Math.max(0, nv.shake - dt);
      const amp = Math.sin(nv.shake * 40) * nv.shake * 0.25;
      const s = this.visibleScale(nv) * nv.baseScale;
      this.nodeBatch.setMatrix(nv.handle, trs(nv.node.x, this.heightAt(nv.node.x, nv.node.z), nv.node.z, nv.rot, s * (1 + Math.abs(amp) * 0.3), s * (1 - Math.abs(amp) * 0.2), s * (1 + Math.abs(amp) * 0.3), amp * 0.4, amp * 0.3));
    }
    for (const w of this.waterfalls) (w.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    this.farm?.update(dt, time, night);
    this.hamlet?.update(dt, night);
    // chimney smoke & campfires
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.35;
      for (const p of this.smokePoints) if (p.distanceToSquared(focus) < 900) this.particles.smoke(p.x, p.y, p.z);
      for (const p of this.farm?.smokePoints ?? []) if (p.distanceToSquared(focus) < 900) this.particles.smoke(p.x, p.y, p.z);
      for (const p of this.hamlet?.smokePoints ?? []) if (p.distanceToSquared(focus) < 900) this.particles.smoke(p.x, p.y, p.z);
      for (const p of this.firePoints) {
        this.particles.emit({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y, z: p.z + (Math.random() - 0.5) * 0.3, vy: 1.2, life: 0.8, size: 0.3, size1: 0.05, color: 0xffa03a, frame: 0, additive: true });
        this.particles.smoke(p.x, p.y + 0.6, p.z, true);
      }
      if (this.region === 'ember' && Math.random() < 0.8) {
        const v = this.layout.anchors.volcano;
        this.particles.smoke(v.x + (Math.random() - 0.5) * 2, 4.5, v.z - 7 + Math.random(), true);
      }
    }
    this.updateLights(night, focus);
    void camera;
  }

  /** Assign the few dynamic point lights to the nearest light sources at night. */
  private updateLights(night: number, focus: THREE.Vector3): void {
    const max = this.maxLights();
    const want = night > 0.35 || this.region === 'mine' || this.region === 'house' ? max : 0;
    // keep a constant light count so shaders never recompile mid-region
    while (this.pointLights.length < max) {
      const l = new THREE.PointLight(0xffc878, 0, 7, 1.6);
      this.pointLights.push(l);
      this.root.add(l);
    }
    const pts = [...this.lightPoints, ...(this.farm?.lightPoints ?? []), ...(this.house?.lightPoints ?? []), ...(this.hamlet?.lightPoints ?? [])];
    pts.sort((a, b) => a.distanceToSquared(focus) - b.distanceToSquared(focus));
    for (let i = 0; i < this.pointLights.length; i++) {
      const l = this.pointLights[i];
      const p = pts[i];
      if (!p || i >= want) {
        l.intensity = 0;
        continue;
      }
      l.position.copy(p);
      l.intensity = 2.4 * Math.max(night, this.region === 'mine' ? 0.8 : 0);
    }
  }

  dispose(): void {
    this.unload();
  }
}

export const GHOST_OK = basicMat(0x7affa0, { transparent: true, opacity: 0.45 });
export const GHOST_BAD = basicMat(0xff6a6a, { transparent: true, opacity: 0.45 });
