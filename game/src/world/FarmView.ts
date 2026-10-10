import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from './World';
import type { Particles } from '../render/Particles';
import { InstanceBatch, trs, type Handle } from './Instancing';
import { cropGeo, soilGeo, treeGeo } from '../models/Nature';
import { farmBuildingModel } from '../models/Buildings';
import { structureGeo } from '../models/Buildings';
import { propModel } from '../models/Props';
import { cachedGeo, mb } from '../models/Builder';
import { BUILDING_BY_ID } from '../data/buildings';
import { DECOR_BY_ID } from '../data/decor';
import { CROP_BY_ID } from '../data/crops';
import { FRUIT_TREES } from '../data/resources';
import { FARM } from '../state/newGame';
import { footprintOf } from '../systems/Building';
import { vcMat, colorMat } from '../render/Materials';
import { glowMat, windowMat, cropMat, propMat } from './PropFactory';
import { easeOutBack } from '../core/MathUtil';

interface BuiltObj {
  uid: string;
  kind: string;
  group: THREE.Group;
  spinner?: THREE.Object3D;
}

export class FarmView {
  readonly group = new THREE.Group();
  private soil: THREE.InstancedMesh;
  private crops: InstanceBatch;
  private decor: InstanceBatch;
  private decorGlow: InstanceBatch;
  private objs: BuiltObj[] = [];
  private trees = new THREE.Group();
  private plotIndex = new Map<string, number>();
  private cropHandles = new Map<string, Handle>();
  private pops = new Map<string, number>(); // plot key -> anim time left
  smokePoints: THREE.Vector3[] = [];
  lightPoints: THREE.Vector3[] = [];
  private pondTiles = new Set<string>();
  private readyTimer = 0;
  private bin: THREE.Mesh;
  private off: () => void;

  constructor(private ctx: Ctx, private world: World, private particles: Particles) {
    this.soil = new THREE.InstancedMesh(soilGeo(), vcMat(), 1600);
    this.soil.receiveShadow = true;
    this.soil.count = 0;
    this.soil.frustumCulled = false;
    this.group.add(this.soil);
    this.crops = new InstanceBatch((key) => {
      const [id, stage, dorm] = key.split(':');
      return { geo: cachedGeo(`crop:${key}`, () => cropGeo(id, +stage, dorm === '1')), mat: cropMat() };
    });
    this.decor = new InstanceBatch((key) => {
      const def = DECOR_BY_ID[key];
      if (!def) return null;
      return { geo: cachedGeo(`decor:${key}|${this.world.season}`, () => propModel(def, this.world.season).geo), mat: def.path ? vcMat() : propMat(), shadow: !def.path };
    }, true, true);
    this.decorGlow = new InstanceBatch((key) => {
      const def = DECOR_BY_ID[key];
      const g = def ? propModel(def, this.world.season).glow : null;
      return g ? { geo: g, mat: glowMat, shadow: false } : null;
    }, false, false);
    this.group.add(this.crops.group, this.decor.group, this.decorGlow.group, this.trees);
    this.bin = new THREE.Mesh(structureGeo('shipping_bin'), propMat());
    this.bin.castShadow = true;
    this.group.add(this.bin);
    this.off = this.ctx.bus.on('plot:changed', this.onPlot);
  }

  private onPlot = (e: { x: number; z: number; kind: string }) => {
    if (e.kind === 'grow' || e.kind === 'plant' || e.kind === 'harvest') this.pops.set(`${e.x},${e.z}`, 0.45);
  };

  build(): void {
    const b = FARM.shippingBin;
    this.bin.position.set(b.x + 0.5, this.world.heightAt(b.x + 0.5, b.z + 0.5), b.z + 0.5);
    this.refreshPlots();
    this.refreshPlaced();
    this.refreshTrees();
  }

  // ---------- plots & crops ----------
  refreshPlots(): void {
    const plots = Object.values(this.ctx.state.farm.plots);
    const dry = new THREE.Color(0xb08a5e);
    const wet = new THREE.Color(0x6a4a34);
    const fert = new THREE.Color(0x8a6a4a);
    const c = new THREE.Color();
    this.plotIndex.clear();
    let i = 0;
    for (const p of plots) {
      if (i >= this.soil.instanceMatrix.count) break;
      const y = this.world.heightAt(p.x + 0.5, p.z + 0.5);
      this.soil.setMatrixAt(i, trs(p.x + 0.5, y, p.z + 0.5));
      c.copy(p.watered ? wet : p.fertilized ? fert : dry);
      this.soil.setColorAt(i, c);
      this.plotIndex.set(`${p.x},${p.z}`, i);
      i++;
    }
    this.soil.count = i;
    this.soil.instanceMatrix.needsUpdate = true;
    if (this.soil.instanceColor) this.soil.instanceColor.needsUpdate = true;
    this.rebuildCrops();
  }

  private cropKey(x: number, z: number): string | null {
    const p = this.ctx.state.farm.plots[`${x},${z}`];
    if (!p?.crop) return null;
    const stage = this.ctx.farming.stage(p);
    const dormant = !this.ctx.farming.canGrowNow(p.crop.id, x, z);
    return `${p.crop.id}:${stage}:${dormant ? 1 : 0}`;
  }

  rebuildCrops(): void {
    const items: { key: string; matrix: THREE.Matrix4 }[] = [];
    const keys: string[] = [];
    for (const p of Object.values(this.ctx.state.farm.plots)) {
      const key = this.cropKey(p.x, p.z);
      if (!key) continue;
      const y = this.world.heightAt(p.x + 0.5, p.z + 0.5) + 0.06;
      items.push({ key, matrix: trs(p.x + 0.5, y, p.z + 0.5, ((p.x * 7 + p.z * 3) % 4) * 0.4) });
      keys.push(`${p.x},${p.z}`);
    }
    const handles = this.crops.build(items);
    this.cropHandles.clear();
    handles.forEach((h, i) => h && this.cropHandles.set(keys[i], h));
  }

  isPondTile(tx: number, tz: number): boolean {
    return this.pondTiles.has(`${tx},${tz}`);
  }

  // ---------- placed buildings & decor ----------
  refreshPlaced(): void {
    for (const o of this.objs) {
      this.group.remove(o.group);
      o.group.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.shared) mesh.geometry.dispose();
      });
    }
    this.objs = [];
    this.smokePoints = [];
    this.lightPoints = [];
    this.pondTiles.clear();
    const decorItems: { key: string; matrix: THREE.Matrix4 }[] = [];
    const glowItems: { key: string; matrix: THREE.Matrix4 }[] = [];
    for (const p of this.ctx.state.farm.placed) {
      const bdef = BUILDING_BY_ID[p.kind];
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
      const y = this.world.heightAt(cx, cz);
      if (bdef) {
        const model = farmBuildingModel(p.kind, bdef.size[0], bdef.size[1], bdef.roof, bdef.wall);
        const g = new THREE.Group();
        const m = new THREE.Mesh(model.geo, vcMat({ seeThrough: true, snowCap: true, textured: true }));
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        if (model.windows) g.add(new THREE.Mesh(model.windows, windowMat));
        if (model.transparent) {
          const glass = new THREE.Mesh(model.transparent, colorMat(0xd8f4ff, { transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
          glass.renderOrder = 2;
          g.add(glass);
        }
        let spinner: THREE.Object3D | undefined;
        if (model.spinner) {
          spinner = new THREE.Mesh(model.spinner.geo, vcMat());
          spinner.position.copy(model.spinner.pos);
          spinner.castShadow = true;
          g.add(spinner);
        }
        if (p.kind === 'pond') {
          const water = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20).rotateX(-Math.PI / 2), colorMat(0x5ac8e8, { transparent: true, opacity: 0.85 }));
          water.position.set(bdef.size[0] / 2, 0.12, bdef.size[1] / 2);
          g.add(water);
          for (let ix = fp.x0; ix < fp.x1; ix++) for (let iz = fp.z0; iz < fp.z1; iz++) this.pondTiles.add(`${ix},${iz}`);
        }
        g.position.set(fp.x0, y, fp.z0);
        this.group.add(g);
        this.objs.push({ uid: p.uid, kind: p.kind, group: g, spinner });
        for (const s of model.smoke) this.smokePoints.push(s.clone().add(g.position));
        for (const l of model.lights) this.lightPoints.push(l.clone().add(g.position));
      } else if (DECOR_BY_ID[p.kind]) {
        const def = DECOR_BY_ID[p.kind];
        const yy = def.path ? y + 0.005 : y;
        const m = trs(cx, yy, cz, -p.rot * (Math.PI / 2));
        decorItems.push({ key: p.kind, matrix: m });
        if (def.light) {
          glowItems.push({ key: p.kind, matrix: m });
          this.lightPoints.push(new THREE.Vector3(cx, yy + 1.2, cz));
        }
      }
    }
    this.decor.build(decorItems);
    this.decorGlow.build(glowItems);
    this.world.recomputeDynamicBlocked();
  }

  // ---------- fruit trees ----------
  refreshTrees(): void {
    this.trees.clear();
    for (const t of this.ctx.state.farm.fruitTrees) {
      const def = FRUIT_TREES.find((f) => f.id === t.kind);
      if (!def) continue;
      const age = this.ctx.farming.treeAge(t);
      const grown = Math.min(1, age / 6);
      const g = new THREE.Group();
      const season = this.world.season;
      const base = new THREE.Mesh(cachedGeo(`ftree|${season}`, () => treeGeo('tree_oak', season, 2)), vcMat({ wind: 0.03, seeThrough: true, snowCap: true }));
      base.castShadow = true;
      g.add(base);
      const s = 0.3 + grown * 0.55;
      g.scale.setScalar(s);
      if (this.ctx.farming.treeHasFruit(t)) {
        const fb = mb();
        for (let i = 0; i < 9; i++) fb.sphere(0.1, def.color, { pos: [Math.sin(i * 2.4) * 0.55, 1.3 + (i % 3) * 0.25, Math.cos(i * 2.4) * 0.55] }, 7);
        g.add(new THREE.Mesh(fb.build(), vcMat()));
      } else if (season === 'spring' && grown >= 1) {
        const bb = mb();
        for (let i = 0; i < 14; i++) bb.sphere(0.07, def.blossom, { pos: [Math.sin(i * 2.4) * 0.6, 1.3 + (i % 4) * 0.2, Math.cos(i * 2.4) * 0.6] }, 5);
        g.add(new THREE.Mesh(bb.build(), vcMat()));
      }
      g.position.set(t.x + 0.5, this.world.heightAt(t.x + 0.5, t.z + 0.5), t.z + 0.5);
      g.userData.uid = t.uid;
      this.trees.add(g);
    }
    this.world.recomputeDynamicBlocked();
  }

  // ---------- collision ----------
  blockedAt(x: number, z: number, r: number): boolean {
    const st = this.ctx.state;
    const b = FARM.shippingBin;
    if (x + r > b.x && x - r < b.x + 1 && z + r > b.z && z - r < b.z + 1) return true;
    for (const t of st.farm.fruitTrees) if ((x - t.x - 0.5) ** 2 + (z - t.z - 0.5) ** 2 < (0.35 + r) ** 2) return true;
    return false;
  }

  markBlocked(arr: Uint8Array, w: number): void {
    const st = this.ctx.state;
    for (const p of st.farm.placed) {
      const def = DECOR_BY_ID[p.kind];
      if (def && (def.path || def.blocks === false)) continue;
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      for (let x = fp.x0; x < fp.x1; x++) for (let z = fp.z0; z < fp.z1; z++) {
        if (p.kind === 'greenhouse' && !(x === fp.x0 || x === fp.x1 - 1) ) continue; // walk inside the greenhouse
        if (p.kind === 'sanctuary' && z > fp.z0 && x > fp.x0 && x < fp.x1 - 1) continue;
        arr[z * w + x] = 1;
      }
      // doors stay reachable: the tile in front is never blocked (outside footprint anyway)
    }
    for (const t of st.farm.fruitTrees) arr[t.z * w + t.x] = 1;
    arr[FARM.shippingBin.z * w + FARM.shippingBin.x] = 1;
  }

  /** Door position of a placed building (for interactions). */
  doorOf(uid: string): THREE.Vector3 | null {
    const p = this.ctx.state.farm.placed.find((q) => q.uid === uid);
    if (!p) return null;
    const def = BUILDING_BY_ID[p.kind];
    if (!def) return null;
    const fp = footprintOf(p.kind, p.x, p.z, p.rot);
    if (p.kind === 'house') return new THREE.Vector3(fp.x0 + 2.8, 0, fp.z1 + 0.3);
    return new THREE.Vector3((fp.x0 + fp.x1) / 2, 0, fp.z1 + 0.35);
  }

  update(dt: number, time: number, night: number): void {
    for (const o of this.objs) if (o.spinner) o.spinner.rotation.z += dt * 0.8;
    // crop pop animation
    for (const [key, t] of this.pops) {
      const nt = t - dt;
      const h = this.cropHandles.get(key);
      const [x, z] = key.split(',').map(Number);
      if (h) {
        const k = 1 - Math.max(0, nt) / 0.45;
        const s = 0.6 + 0.4 * easeOutBack(k);
        this.crops.setMatrix(h, trs(x + 0.5, this.world.heightAt(x + 0.5, z + 0.5) + 0.06, z + 0.5, ((x * 7 + z * 3) % 4) * 0.4, s, s * (1 + Math.sin(k * Math.PI) * 0.15), s));
      }
      if (nt <= 0) this.pops.delete(key);
      else this.pops.set(key, nt);
    }
    // ready crops twinkle
    this.readyTimer -= dt;
    if (this.readyTimer <= 0) {
      this.readyTimer = 0.5;
      const ready = Object.values(this.ctx.state.farm.plots).filter((p) => p.crop?.ready);
      for (let i = 0; i < Math.min(3, ready.length); i++) {
        const p = ready[Math.floor(Math.random() * ready.length)];
        const def = CROP_BY_ID[p.crop!.id];
        this.particles.emit({ x: p.x + 0.5 + (Math.random() - 0.5) * 0.4, y: 0.6, z: p.z + 0.5, vy: 0.4, life: 1, size: 0.16, size1: 0.02, color: 0xfff6b0, frame: 1, additive: true });
        void def;
      }
      // bees around hives in good weather
      if (night < 0.3) for (const o of this.objs) if (o.kind === 'beehive' && Math.random() < 0.7) {
        const p = o.group.position;
        this.particles.emit({ x: p.x + 0.5 + (Math.random() - 0.5), y: p.y + 0.9 + Math.random() * 0.4, z: p.z + 0.5 + (Math.random() - 0.5), vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), life: 1.2, size: 0.07, color: 0xffc42a, frame: 0, wobble: 2 });
      }
    }
    void time;
  }

  dispose(): void {
    this.off();
    this.crops.dispose();
    this.decor.dispose();
    this.decorGlow.dispose();
    this.soil.dispose();
    this.group.clear();
  }
}
