import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from './World';
import type { Particles } from '../render/Particles';
import { InstanceBatch, trs } from './Instancing';
import { hamletBuildingModel } from '../models/Buildings';
import { propModel } from '../models/Props';
import { cachedGeo } from '../models/Builder';
import { HAMLET_BY_ID } from '../data/hamlet';
import { DECOR_BY_ID } from '../data/decor';
import { footprintOf, doorPoint } from '../systems/Building';
import { vcMat } from '../render/Materials';
import { glowMat, windowMat, propMat } from './PropFactory';

interface BuiltObj {
  uid: string;
  kind: string;
  group: THREE.Group;
  inner: THREE.Group;
}

/** Renders what the player built in the hamlet: buildings (with textures, smoke, lights) and decorations. */
export class HamletView {
  readonly group = new THREE.Group();
  private decor: InstanceBatch;
  private decorGlow: InstanceBatch;
  private objs: BuiltObj[] = [];
  smokePoints: THREE.Vector3[] = [];
  lightPoints: THREE.Vector3[] = [];
  private fxT = 0;

  constructor(private ctx: Ctx, private world: World, private particles: Particles) {
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
    this.group.add(this.decor.group, this.decorGlow.group);
  }

  build(): void {
    this.refreshPlaced();
  }

  refreshPlaced(): void {
    for (const o of this.objs) {
      this.group.remove(o.group);
      o.group.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    this.objs = [];
    this.smokePoints = [];
    this.lightPoints = [];
    const decorItems: { key: string; matrix: THREE.Matrix4 }[] = [];
    const glowItems: { key: string; matrix: THREE.Matrix4 }[] = [];
    for (const p of this.ctx.state.hamlet.placed) {
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
      const y = this.world.heightAt(cx, cz);
      const hdef = HAMLET_BY_ID[p.kind];
      if (hdef) {
        const model = hamletBuildingModel(p.kind, hdef.size[0], hdef.size[1], hdef.roof, hdef.wall, hdef.mat, hdef.roofTex);
        const outer = new THREE.Group();
        const g = new THREE.Group();
        outer.add(g);
        g.position.set(-hdef.size[0] / 2, 0, -hdef.size[1] / 2);
        const m = new THREE.Mesh(model.geo, vcMat({ seeThrough: true, snowCap: true, textured: true }));
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        if (model.windows) g.add(new THREE.Mesh(model.windows, windowMat));
        outer.position.set(cx, y, cz);
        outer.rotation.y = -p.rot * (Math.PI / 2);
        outer.updateMatrixWorld(true);
        this.group.add(outer);
        this.objs.push({ uid: p.uid, kind: p.kind, group: outer, inner: g });
        for (const s of model.smoke) this.smokePoints.push(g.localToWorld(s.clone()));
        for (const l of model.lights) this.lightPoints.push(g.localToWorld(l.clone()));
      } else if (DECOR_BY_ID[p.kind]) {
        const def = DECOR_BY_ID[p.kind];
        const yy = def.path ? y + 0.005 : y;
        const mtx = trs(cx, yy, cz, -p.rot * (Math.PI / 2));
        decorItems.push({ key: p.kind, matrix: mtx });
        if (def.light) {
          glowItems.push({ key: p.kind, matrix: mtx });
          this.lightPoints.push(new THREE.Vector3(cx, yy + 1.2, cz));
        }
      }
    }
    this.decor.build(decorItems);
    this.decorGlow.build(glowItems);
    this.world.recomputeDynamicBlocked();
  }

  markBlocked(arr: Uint8Array, w: number): void {
    for (const p of this.ctx.state.hamlet.placed) {
      const def = DECOR_BY_ID[p.kind];
      if (def && (def.path || def.blocks === false)) continue;
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      for (let x = fp.x0; x < fp.x1; x++) for (let z = fp.z0; z < fp.z1; z++) arr[z * w + x] = 1;
    }
  }

  doorOf(uid: string): THREE.Vector3 | null {
    const p = this.ctx.state.hamlet.placed.find((q) => q.uid === uid);
    if (!p || !HAMLET_BY_ID[p.kind]) return null;
    const d = doorPoint(p.kind, p.x, p.z, p.rot, 0.4);
    return new THREE.Vector3(d.x, 0, d.z);
  }

  update(dt: number, night: number): void {
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.45;
    const w = new THREE.Vector3();
    const at = (o: BuiltObj, x: number, y: number, z: number) => o.inner.localToWorld(w.set(x, y, z));
    for (const o of this.objs) {
      const def = HAMLET_BY_ID[o.kind];
      const staffed = this.ctx.hamlet.workers(o.uid).length > 0;
      // bees around the apiary, sparks at the smithy, music notes from the bandstand
      if (o.kind === 'h_apiary' && night < 0.3 && staffed) { const p = at(o, Math.random() * def.size[0], 0.8 + Math.random() * 0.4, 0.7); this.particles.emit({ x: p.x, y: p.y, z: p.z, vx: Math.random() - 0.5, vz: Math.random() - 0.5, life: 1.2, size: 0.07, color: 0xffc42a, frame: 0, wobble: 2 }); }
      if (o.kind === 'h_smithy' && staffed && Math.random() < 0.6) { const p = at(o, 2.3, 0.75, 1.2); this.particles.emit({ x: p.x, y: p.y, z: p.z, vy: 1.2, vx: (Math.random() - 0.5) * 1.5, life: 0.5, size: 0.06, color: 0xffa03a, frame: 0, additive: true, gravity: 4 }); }
      if (o.kind === 'h_bandstand' && night > 0.15 && Math.random() < 0.5) { const p = at(o, 1.5, 1.8, 1.5); this.particles.notes(p.x, p.y, p.z, 1); }
      if (o.kind === 'h_lumber' && staffed && night < 0.3 && Math.random() < 0.3) { const p = at(o, 1.5, 0.6, 1.1); this.particles.dust(p.x, p.y, p.z, 0xd8b07a, 2); }
    }
  }

  dispose(): void {
    this.decor.dispose();
    this.decorGlow.dispose();
    for (const o of this.objs) o.group.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
    this.group.clear();
  }
}
