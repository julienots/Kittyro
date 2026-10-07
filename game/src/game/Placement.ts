import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from '../world/World';
import type { UI } from '../ui/UI';
import type { CameraRig } from '../render/CameraRig';
import { h } from '../ui/dom';
import { BUILDING_BY_ID } from '../data/buildings';
import { DECOR_BY_ID } from '../data/decor';
import { farmBuildingModel } from '../models/Buildings';
import { propModel } from '../models/Props';
import { treeGeo } from '../models/Nature';
import { footprintOf, sizeOf } from '../systems/Building';
import { item } from '../data/items';

/**
 * Finger-friendly placement: the ghost follows your finger (snapped to the grid),
 * turns green/red, and a bottom bar offers rotate / confirm / cancel.
 * Edit mode: tap a placed object to move or store it.
 */
export class Placement {
  active = false;
  editMode = false;
  kind = '';
  uid: string | null = null;
  x = 0;
  z = 0;
  rot = 0;
  private ghost = new THREE.Group();
  private tiles: THREE.Mesh;
  private okMat = new THREE.MeshBasicMaterial({ color: 0x7affa0, transparent: true, opacity: 0.5, depthWrite: false });
  private badMat = new THREE.MeshBasicMaterial({ color: 0xff6a6a, transparent: true, opacity: 0.5, depthWrite: false });
  private bar: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  onDone: ((placed: boolean) => void) | null = null;

  constructor(private ctx: Ctx, private world: World, private ui: UI, private rig: CameraRig, scene: THREE.Scene) {
    this.tiles = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.okMat);
    this.tiles.renderOrder = 5;
    this.ghost.visible = false;
    this.tiles.visible = false;
    scene.add(this.ghost, this.tiles);
  }

  get area(): 'farm' | 'house' {
    return this.world.region === 'house' ? 'house' : 'farm';
  }

  private isSapling(): boolean {
    return this.kind.startsWith('sapling_');
  }

  start(kind: string, at: { x: number; z: number }, uid?: string): void {
    this.cancel(false);
    this.kind = kind;
    this.uid = uid ?? null;
    const existing = uid ? this.ctx.building.find(uid)?.obj : null;
    this.rot = existing?.rot ?? 0;
    const [w, d] = this.isSapling() ? [1, 1] : sizeOf(kind);
    this.x = existing ? existing.x : Math.round(at.x - w / 2);
    this.z = existing ? existing.z : Math.round(at.z - d / 2);
    this.buildGhost();
    this.active = true;
    this.ghost.visible = this.tiles.visible = true;
    const name = this.isSapling() ? item(kind).name : BUILDING_BY_ID[kind]?.name ?? DECOR_BY_ID[kind]?.name ?? kind;
    this.hint = h('div.card.placement-hint', null, `${name} — glissez pour déplacer`);
    const canRotate = !BUILDING_BY_ID[kind] && !this.isSapling();
    this.bar = h('div.card.placement-bar', { onpointerdown: (e: Event) => e.stopPropagation() },
      canRotate ? h('button.btn.sky', { onclick: () => { this.rot = (this.rot + 1) % 4; this.refresh(); } }, '⟳ Tourner') : null,
      uid && !BUILDING_BY_ID[kind]?.id.startsWith('house') ? h('button.btn.lav', { onclick: () => this.store() }, '📦 Ranger') : null,
      h('button.btn.ghost', { onclick: () => this.cancel() }, '✕'),
      h('button.btn', { onclick: () => this.confirm() }, '✓ Valider'),
    );
    this.ui.root.append(this.hint, this.bar);
    this.ui.setHudVisible(false);
    this.refresh();
  }

  private buildGhost(): void {
    this.ghost.clear();
    let geo: THREE.BufferGeometry;
    const b = BUILDING_BY_ID[this.kind];
    if (b) geo = farmBuildingModel(this.kind, b.size[0], b.size[1], b.roof, b.wall).geo;
    else if (this.isSapling()) geo = treeGeo('tree_oak', 'spring').clone().scale(0.35, 0.35, 0.35);
    else geo = propModel(DECOR_BY_ID[this.kind], this.world.season).geo;
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }));
    m.userData.inner = true;
    this.ghost.add(m);
  }

  private footprint() {
    if (this.isSapling()) return { x0: this.x, z0: this.z, x1: this.x + 1, z1: this.z + 1, w: 1, d: 1 };
    return footprintOf(this.kind, this.x, this.z, this.rot);
  }

  valid(): { ok: boolean; reason?: string } {
    if (this.isSapling()) {
      const ok = this.area === 'farm' && this.ctx.farming.inFarm(this.x, this.z) && !this.ctx.farming.occupied(this.x, this.z) && !this.ctx.farming.plot(this.x, this.z) && this.ctx.terrain.isTillable(this.x, this.z);
      return ok ? { ok } : { ok, reason: 'Impossible de planter ici.' };
    }
    return this.ctx.building.canPlace(this.kind, this.x, this.z, this.rot, this.area, this.uid ?? undefined);
  }

  refresh(): void {
    const fp = this.footprint();
    const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
    const y = this.world.heightAt(cx, cz);
    const b = BUILDING_BY_ID[this.kind];
    if (b) {
      this.ghost.position.set(fp.x0, y, fp.z0);
      this.ghost.rotation.y = 0;
    } else {
      this.ghost.position.set(cx, y + (DECOR_BY_ID[this.kind]?.path ? 0.02 : 0), cz);
      this.ghost.rotation.y = DECOR_BY_ID[this.kind]?.wall ? 0 : -this.rot * (Math.PI / 2);
    }
    this.tiles.position.set(cx, y + 0.06, cz);
    this.tiles.scale.set(fp.w, 1, fp.d);
    const v = this.valid();
    this.tiles.material = v.ok ? this.okMat : this.badMat;
    if (this.hint) this.hint.textContent = v.ok ? 'Glissez pour déplacer · ✓ pour valider' : `⚠️ ${v.reason ?? 'Emplacement invalide'}`;
  }

  /** Finger drag in normalized device coordinates. */
  drag(nx: number, ny: number): void {
    if (!this.active) return;
    const p = this.rig.screenToGround(nx, ny, 0);
    if (!p) return;
    const fp = this.footprint();
    const nx0 = Math.round(p.x - fp.w / 2), nz0 = Math.round(p.z - fp.d / 2);
    if (nx0 !== this.x || nz0 !== this.z) {
      this.x = nx0;
      this.z = nz0;
      this.refresh();
    }
  }

  confirm(): void {
    const v = this.valid();
    if (!v.ok) {
      this.ui.toast(v.reason ?? 'Emplacement invalide', '🚫', 'warn');
      this.ui.g.audio.play('error');
      return;
    }
    let ok = false;
    if (this.isSapling()) ok = this.ctx.farming.plantTree(this.kind.replace('sapling_', ''), this.x, this.z).ok;
    else if (this.uid) ok = this.ctx.building.move(this.uid, this.x, this.z, this.rot);
    else ok = !!this.ctx.building.place(this.kind, this.x, this.z, this.rot, this.area);
    if (ok) {
      this.ui.g.audio.play('build');
      const kind = this.kind;
      const more = !this.uid && !BUILDING_BY_ID[kind] && !this.isSapling() && (this.ctx.state.decorOwned[kind] ?? 0) > 0;
      this.finish(true);
      // keep placing the same decoration (fences, paths...) quickly
      if (more) this.start(kind, { x: this.x + 1.5, z: this.z + 0.5 });
    }
  }

  private store(): void {
    if (this.uid && this.ctx.building.store(this.uid)) {
      this.ui.g.audio.play('close');
      this.ui.toast('Rangé dans le sac de décorations', '📦');
      this.finish(true);
    }
  }

  cancel(notify = true): void {
    if (!this.active) return;
    this.finish(false, notify);
  }

  private finish(placed: boolean, notify = true): void {
    this.active = false;
    this.ghost.visible = this.tiles.visible = false;
    this.bar?.remove();
    this.hint?.remove();
    this.bar = this.hint = null;
    this.ui.setHudVisible(true);
    if (notify) this.onDone?.(placed);
  }

  // ---------- edit mode ----------
  beginEdit(): void {
    this.editMode = true;
    this.hint?.remove();
    this.hint = h('div.card.placement-hint', null, '✋ Touchez un objet à déplacer');
    this.bar = h('div.card.placement-bar', { onpointerdown: (e: Event) => e.stopPropagation() }, h('button.btn', { onclick: () => this.endEdit() }, '✓ Terminé'));
    this.ui.root.append(this.hint, this.bar);
    this.ui.setHudVisible(false);
  }

  endEdit(): void {
    this.editMode = false;
    this.hint?.remove();
    this.bar?.remove();
    this.hint = this.bar = null;
    this.ui.setHudVisible(true);
    this.onDone?.(false);
  }

  /** Tap while editing: pick the object under the finger. */
  pick(nx: number, ny: number): void {
    const p = this.rig.screenToGround(nx, ny, 0);
    if (!p) return;
    const list = this.area === 'farm' ? this.ctx.state.farm.placed : this.ctx.state.house.furniture;
    const tx = Math.floor(p.x), tz = Math.floor(p.z);
    // prefer non-path objects
    const hits = list.filter((o) => {
      const fp = footprintOf(o.kind, o.x, o.z, o.rot);
      return tx >= fp.x0 && tx < fp.x1 && tz >= fp.z0 && tz < fp.z1 && o.kind !== 'house';
    }).sort((a, b) => (DECOR_BY_ID[a.kind]?.path ? 1 : 0) - (DECOR_BY_ID[b.kind]?.path ? 1 : 0));
    const o = hits[0];
    if (!o) {
      this.ui.toast('Aucun objet ici', '🤔');
      return;
    }
    this.editMode = false;
    this.hint?.remove();
    this.bar?.remove();
    this.hint = this.bar = null;
    this.start(o.kind, { x: o.x, z: o.z }, o.uid);
  }
}
