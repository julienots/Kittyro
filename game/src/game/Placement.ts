import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from '../world/World';
import type { UI } from '../ui/UI';
import type { CameraRig } from '../render/CameraRig';
import { h } from '../ui/dom';
import { BUILDING_BY_ID } from '../data/buildings';
import { DECOR_BY_ID } from '../data/decor';
import { farmBuildingModel, hamletBuildingModel } from '../models/Buildings';
import { HAMLET_BY_ID } from '../data/hamlet';
import { propModel } from '../models/Props';
import { treeGeo } from '../models/Nature';
import { footprintOf, sizeOf } from '../systems/Building';
import { item } from '../data/items';

/**
 * Finger-friendly placement. Drag anywhere on the screen: the ghost moves WITH
 * your finger (relative, so it never hides under it), the camera follows it and
 * scrolls when you reach the screen edge. Arrow buttons nudge it tile by tile,
 * ⟳ turns it (buildings too), weeds & pebbles underneath are swept up on ✓.
 * Edit mode: tap near a placed object to move, turn or store it.
 */
export class Placement {
  active = false;
  editMode = false;
  kind = '';
  uid: string | null = null;
  x = 0;
  z = 0;
  rot = 0;
  /** where the camera should look while placing */
  readonly center = new THREE.Vector3();
  private ghost = new THREE.Group();
  private tiles: THREE.Mesh;
  private okMat = new THREE.MeshBasicMaterial({ color: 0x7affa0, transparent: true, opacity: 0.5, depthWrite: false });
  private badMat = new THREE.MeshBasicMaterial({ color: 0xff6a6a, transparent: true, opacity: 0.5, depthWrite: false });
  private bar: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private dragging = false;
  private grab = { x: 0, z: 0 };
  private finger = { nx: 0, ny: 0 };
  private pan = new THREE.Vector2();
  onDone: ((placed: boolean) => void) | null = null;

  constructor(private ctx: Ctx, private world: World, private ui: UI, private rig: CameraRig, scene: THREE.Scene) {
    this.tiles = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.okMat);
    this.tiles.renderOrder = 5;
    this.ghost.visible = false;
    this.tiles.visible = false;
    scene.add(this.ghost, this.tiles);
  }

  get area(): 'farm' | 'house' | 'hamlet' {
    return this.world.region === 'house' ? 'house' : this.world.region === 'hamlet' ? 'hamlet' : 'farm';
  }

  private isBuilding(): boolean {
    return !!BUILDING_BY_ID[this.kind] || !!HAMLET_BY_ID[this.kind];
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
    const name = this.isSapling() ? item(kind).name : BUILDING_BY_ID[kind]?.name ?? HAMLET_BY_ID[kind]?.name ?? DECOR_BY_ID[kind]?.name ?? kind;
    this.hint = h('div.card.placement-hint', null, name);
    const canRotate = kind !== 'house' && !this.isSapling() && !DECOR_BY_ID[kind]?.wall;
    const stop = (e: Event) => e.stopPropagation();
    const nudge = (sx: number, sz: number) => h('button.nudge', { onpointerdown: stop, onclick: () => this.nudge(sx, sz) }, sx < 0 ? '◀' : sx > 0 ? '▶' : sz < 0 ? '▲' : '▼');
    this.bar = h('div.card.placement-bar', { onpointerdown: stop },
      h('div.dpad', null, h('span'), nudge(0, -1), h('span'), nudge(-1, 0), h('span.dot', null, '✥'), nudge(1, 0), h('span'), nudge(0, 1), h('span')),
      h('div.pbtns', null,
        canRotate ? h('button.btn.sky', { onclick: () => { this.rot = (this.rot + 1) % 4; this.refresh(); this.ui.g.audio.play('click'); } }, '⟳ Tourner') : null,
        uid && kind !== 'house' ? h('button.btn.lav', { onclick: () => this.store() }, this.isBuilding() ? '🔧 Démonter' : '📦 Ranger') : null,
        h('button.btn.ghost', { onclick: () => this.cancel() }, '✕'),
        h('button.btn', { onclick: () => this.confirm() }, '✓ Valider'),
      ),
    );
    this.ui.root.append(this.hint, this.bar);
    this.ui.setHudVisible(false);
    this.refresh();
    this.ui.tip('placement', '✋', 'Placer librement', 'Glissez le doigt n\'importe où : le bâtiment suit votre geste (la caméra suit aussi, et défile au bord de l\'écran). Les flèches le déplacent d\'une case, ⟳ le tourne. Les herbes et cailloux dessous sont ramassés automatiquement.');
  }

  private buildGhost(): void {
    this.ghost.clear();
    let geo: THREE.BufferGeometry;
    const b = BUILDING_BY_ID[this.kind];
    const hb = HAMLET_BY_ID[this.kind];
    if (b) geo = farmBuildingModel(this.kind, b.size[0], b.size[1], b.roof, b.wall).geo;
    else if (hb) geo = hamletBuildingModel(this.kind, hb.size[0], hb.size[1], hb.roof, hb.wall, hb.mat, hb.roofTex).geo;
    else if (this.isSapling()) geo = treeGeo('tree_oak', 'spring').clone().scale(0.35, 0.35, 0.35);
    else geo = propModel(DECOR_BY_ID[this.kind], this.world.season).geo;
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }));
    m.userData.inner = true;
    if (this.isBuilding()) {
      // building models use their min corner as origin: centre them, and show where the door is
      const [w, d] = (b ?? hb)!.size;
      m.position.set(-w / 2, 0, -d / 2);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      arrow.position.set(0, 0.15, d / 2 + 0.7);
      this.ghost.add(arrow);
    }
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

  /** Debris (weeds, pebbles, stumps) under the footprint that will be swept up. */
  private debrisUnder() {
    const fp = this.footprint();
    return this.world.nodes.filter((nv) => nv.node.x >= fp.x0 && nv.node.x < fp.x1 && nv.node.z >= fp.z0 && nv.node.z < fp.z1 && this.ctx.gathering.isDebris(nv.node));
  }

  refresh(): void {
    const fp = this.footprint();
    const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
    const y = this.world.heightAt(cx, cz);
    const def = DECOR_BY_ID[this.kind];
    this.ghost.position.set(cx, y + (def?.path ? 0.02 : 0), cz);
    this.ghost.rotation.y = def?.wall ? 0 : -this.rot * (Math.PI / 2);
    this.tiles.position.set(cx, y + 0.06, cz);
    this.tiles.scale.set(fp.w, 1, fp.d);
    this.center.set(cx, y, cz);
    const v = this.valid();
    this.tiles.material = v.ok ? this.okMat : this.badMat;
    const debris = v.ok && !this.isSapling() ? this.debrisUnder().length : 0;
    if (this.hint) this.hint.textContent = v.ok ? (debris ? `✓ OK · ${debris} herbe(s)/caillou(x) seront ramassés` : '✓ Emplacement libre · glissez ou utilisez les flèches') : `⚠️ ${v.reason ?? 'Emplacement invalide'}`;
  }

  /** Grid step along the camera's screen axes (so ▲ always goes "up" on screen). */
  private nudge(sx: number, sz: number): void {
    const f = this.rig.forward, r = this.rig.right;
    const vx = r.x * sx - f.x * sz, vz = r.z * sx - f.z * sz;
    if (Math.abs(vx) > Math.abs(vz)) this.x += Math.sign(vx);
    else this.z += Math.sign(vz);
    this.ui.g.audio.play('click');
    this.refresh();
  }

  /** Finger drag in normalized device coordinates (relative: the ghost keeps its offset to the finger). */
  drag(nx: number, ny: number, phase: 'start' | 'move' | 'end' = 'move'): void {
    if (!this.active) return;
    this.finger = { nx, ny };
    const p = this.rig.screenToGround(nx, ny, this.center.y);
    if (phase === 'end') {
      this.dragging = false;
      return;
    }
    if (!p) return;
    if (phase === 'start' || !this.dragging) {
      this.dragging = true;
      this.grab = { x: p.x - this.x, z: p.z - this.z };
      return;
    }
    const nx0 = Math.round(p.x - this.grab.x), nz0 = Math.round(p.z - this.grab.z);
    if (nx0 !== this.x || nz0 !== this.z) {
      this.x = nx0;
      this.z = nz0;
      this.refresh();
    }
  }

  /** Edge scrolling while dragging near the border of the screen. */
  update(dt: number): void {
    if (!this.active || !this.dragging) return;
    const { nx, ny } = this.finger;
    const ex = Math.abs(nx) > 0.82 ? Math.sign(nx) : 0;
    const ey = Math.abs(ny) > 0.72 ? Math.sign(ny) : 0;
    if (!ex && !ey) { this.pan.set(0, 0); return; }
    this.pan.x += ex * dt * 5;
    this.pan.y += ey * dt * 5;
    while (Math.abs(this.pan.x) >= 1 || Math.abs(this.pan.y) >= 1) {
      const sx = Math.abs(this.pan.x) >= 1 ? Math.sign(this.pan.x) : 0;
      const sy = Math.abs(this.pan.y) >= 1 ? Math.sign(this.pan.y) : 0;
      this.pan.x -= sx;
      this.pan.y -= sy;
      const ox = this.x, oz = this.z;
      if (sx) this.nudgeQuiet(sx, 0);
      if (sy) this.nudgeQuiet(0, -sy);
      this.grab.x -= this.x - ox;
      this.grab.z -= this.z - oz;
    }
  }

  private nudgeQuiet(sx: number, sz: number): void {
    const f = this.rig.forward, r = this.rig.right;
    const vx = r.x * sx - f.x * sz, vz = r.z * sx - f.z * sz;
    if (Math.abs(vx) > Math.abs(vz)) this.x += Math.sign(vx);
    else this.z += Math.sign(vz);
    this.refresh();
  }

  confirm(): void {
    const v = this.valid();
    if (!v.ok) {
      this.ui.toast(v.reason ?? 'Emplacement invalide', '🚫', 'warn');
      this.ui.g.audio.play('error');
      return;
    }
    const debris = this.isSapling() ? [] : this.debrisUnder();
    let ok = false;
    if (this.isSapling()) ok = this.ctx.farming.plantTree(this.kind.replace('sapling_', ''), this.x, this.z).ok;
    else if (this.uid) ok = this.ctx.building.move(this.uid, this.x, this.z, this.rot);
    else ok = !!this.ctx.building.place(this.kind, this.x, this.z, this.rot, this.area);
    if (ok) {
      if (debris.length) {
        const got = new Map<string, number>();
        for (const nv of debris) for (const d of this.ctx.gathering.clear(nv.node).drops) got.set(d.id, (got.get(d.id) ?? 0) + d.qty);
        this.world.refreshNodes();
        if (got.size) this.ui.toast(`Terrain dégagé : ${[...got].map(([id, q]) => `${item(id).icon}${q}`).join(' ')}`, '🧹', 'good');
      }
      this.ui.g.audio.play('build');
      const kind = this.kind;
      const more = !this.uid && !BUILDING_BY_ID[kind] && !HAMLET_BY_ID[kind] && !this.isSapling() && (this.ctx.state.decorOwned[kind] ?? 0) > 0;
      const rot = this.rot;
      this.finish(true);
      // keep placing the same decoration (fences, paths...) quickly
      if (more) {
        this.start(kind, { x: this.x + 1.5, z: this.z + 0.5 });
        this.rot = rot;
        this.refresh();
      }
    }
  }

  private store(): void {
    if (this.uid && this.ctx.building.store(this.uid)) {
      this.ui.g.audio.play('close');
      this.ui.toast(this.isBuilding() ? 'Bâtiment démonté : la moitié du prix vous est remboursée' : 'Rangé dans le sac de décorations', '📦');
      this.finish(true);
    }
  }

  cancel(notify = true): void {
    if (!this.active) return;
    this.finish(false, notify);
  }

  private finish(placed: boolean, notify = true): void {
    this.active = false;
    this.dragging = false;
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
    this.hint = h('div.card.placement-hint', null, '✋ Touchez un bâtiment ou une décoration à déplacer');
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

  /** Tap while editing: pick the object nearest to the finger (forgiving on small phones). */
  pick(nx: number, ny: number): void {
    const p = this.rig.screenToGround(nx, ny, 0);
    if (!p) return;
    const list = this.ctx.building.list(this.area);
    let best: (typeof list)[number] | null = null, bd = 1.1;
    for (const o of list) {
      if (o.kind === 'house') continue;
      const fp = footprintOf(o.kind, o.x, o.z, o.rot);
      const dx = Math.max(fp.x0 - p.x, 0, p.x - fp.x1), dz = Math.max(fp.z0 - p.z, 0, p.z - fp.z1);
      const d = Math.hypot(dx, dz) + (DECOR_BY_ID[o.kind]?.path ? 0.5 : 0); // prefer real objects over paths
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) {
      this.ui.toast('Aucun objet ici — touchez plus près d\'un bâtiment', '🤔');
      return;
    }
    this.editMode = false;
    this.hint?.remove();
    this.bar?.remove();
    this.hint = this.bar = null;
    this.start(best.kind, { x: best.x, z: best.z }, best.uid);
  }
}
