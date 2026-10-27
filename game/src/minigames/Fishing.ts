import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { Player } from '../entities/Player';
import type { Particles } from '../render/Particles';
import type { UI } from '../ui/UI';
import type { AudioEngine } from '../audio/Audio';
import { h } from '../ui/dom';
import { FISH_BY_ID, RARITY_COLOR, RARITY_NAME, type FishDef } from '../data/fish';
import { PF } from '../render/Particles';

type Phase = 'idle' | 'cast' | 'wait' | 'bite' | 'reel';

/**
 * Fishing: cast the line, wait for a nibble, tap when the "!" appears, then a
 * relaxed hold-to-follow mini-game. Better rods = bigger green zone.
 */
export class FishingGame {
  phase: Phase = 'idle';
  private bobber: THREE.Mesh;
  private line: THREE.Line;
  private spot = new THREE.Vector3();
  private t = 0;
  private biteIn = 0;
  private biteWindow = 0;
  private fish: { fish: FishDef; size: number } | null = null;
  private region = 'farm';
  private magic = false;
  private bait = false;
  // reel state
  private zoneY = 0.3;
  private zoneV = 0;
  private fishY = 0.5;
  private fishTarget = 0.5;
  private progress = 0.3;
  private holding = false;
  private overlay: HTMLElement | null = null;
  private zoneEl!: HTMLElement;
  private fishEl!: HTMLElement;
  private progEl!: HTMLElement;
  onCatch: ((id: string, size: number) => void) | null = null;
  contest: { until: number; best: number; count: number } | null = null;
  /** First-person view: world point where the rod tip is drawn (line start). */
  tipFn: ((out: THREE.Vector3) => boolean) | null = null;
  /** Easy mode: common fish are landed by just striking at the right time. */
  easy = true;
  private hint: HTMLElement | null = null;

  constructor(private ctx: Ctx, private player: Player, private particles: Particles, private ui: UI, private audio: AudioEngine, scene: THREE.Scene) {
    this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshToonMaterial({ color: 0xff5a4a }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshToonMaterial({ color: 0xffffff }));
    top.position.y = 0.07;
    this.bobber.add(top);
    this.bobber.visible = false;
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(16).fill(0).map(() => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.bobber, this.line);
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  start(spot: { x: number; z: number; lava?: boolean }, region: string): void {
    if (this.active) return;
    this.region = spot.lava ? 'ember' : region;
    this.spot.set(spot.x, -0.2, spot.z);
    this.magic = this.ctx.inventory.has('magic_bait');
    this.bait = this.magic || this.ctx.inventory.has('bait');
    this.phase = 'cast';
    this.player.faceTo(spot.x, spot.z);
    this.player.act('fishCast', 'rod', () => {
      this.bobber.position.copy(this.spot);
      this.bobber.visible = true;
      this.line.visible = true;
      this.particles.splash(this.spot.x, this.spot.y + 0.05, this.spot.z, 6);
      this.audio.play('splash');
      this.phase = 'wait';
      this.biteIn = this.ctx.fishing.biteDelay(this.bait);
      this.t = 0;
    }, 0.7, 0.75);
    this.audio.play('cut');
  }

  /** Action button while fishing. */
  action(): void {
    if (this.phase === 'wait') {
      this.ui.toast('Patience… attendez le ❗ puis touchez vite !', '🐟');
    } else if (this.phase === 'bite') {
      this.beginReel();
    } else if (this.phase === 'reel') {
      // handled by hold
    }
  }

  setHolding(v: boolean): void {
    this.holding = v;
    this.overlay?.querySelector('.hold-btn')?.classList.toggle('on', v);
  }

  private beginReel(): void {
    this.hint?.remove();
    this.hint = null;
    const roll = this.ctx.fishing.roll(this.region, this.magic);
    if (!roll) {
      this.ui.toast('Rien ne mord ici en ce moment…', '🌊');
      this.end();
      return;
    }
    if (this.magic) this.ctx.inventory.remove('magic_bait', 1);
    else if (this.bait) this.ctx.inventory.remove('bait', 1);
    this.fish = roll;
    if (this.easy && (roll.fish.rarity === 'common' || roll.fish.rarity === 'uncommon') && !this.contest) {
      // easy mode: a good strike is enough for everyday fish
      this.player.act('fishReel', 'rod', undefined, 999);
      this.phase = 'reel';
      this.progress = 1;
      setTimeout(() => { if (this.phase === 'reel' && this.fish) this.success(); }, 700);
      return;
    }
    this.phase = 'reel';
    this.player.act('fishReel', 'rod', undefined, 999);
    this.progress = 0.38;
    this.zoneY = 0.3;
    this.zoneV = 0;
    this.fishY = 0.5;
    this.fishTarget = 0.5;
    const zone = this.zoneSize();
    this.zoneEl = h('div.zone', { style: { height: `${zone * 100}%` } });
    this.fishEl = h('div.fish', null, roll.fish.rarity === 'mythic' || roll.fish.rarity === 'epic' ? '🌟' : '🐟');
    this.progEl = h('i', { style: { height: '30%' } });
    const hold = h('button.hold-btn', null, 'Maintenir');
    const down = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.setHolding(true); };
    const up = (e: Event) => { e.preventDefault(); this.setHolding(false); };
    hold.addEventListener('pointerdown', down);
    hold.addEventListener('pointerup', up);
    hold.addEventListener('pointerleave', up);
    hold.addEventListener('pointercancel', up);
    this.overlay = h('div.minigame', {
      onpointerdown: (e: Event) => { if (e.target === this.overlay) this.setHolding(true); },
      onpointerup: () => this.setHolding(false),
    }, h('div.fish-ui', null, h('div.water', null, this.zoneEl, this.fishEl), h('div.prog', null, this.progEl)), hold,
      h('div.mg-hud', null, '🎣 Maintenez le bouton pour monter la zone verte, lâchez pour la descendre : gardez le poisson dedans !'));
    this.ui.root.appendChild(this.overlay);
    this.ui.setHudVisible(false);
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    // line from the rod tip, gently sagging toward the bobber
    const tip = new THREE.Vector3();
    if (!this.tipFn?.(tip)) {
      this.player.rig.toolSlot.getWorldPosition(tip);
      tip.y += 0.75;
    }
    const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
    const end = new THREE.Vector3(this.bobber.position.x, this.bobber.position.y + 0.05, this.bobber.position.z);
    const n = pos.count;
    const sag = this.phase === 'reel' ? 0.02 : this.phase === 'bite' ? 0.05 : 0.35;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      pos.setXYZ(i, tip.x + (end.x - tip.x) * k, tip.y + (end.y - tip.y) * k - Math.sin(k * Math.PI) * sag, tip.z + (end.z - tip.z) * k);
    }
    pos.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    if (this.phase === 'wait') {
      this.bobber.position.y = this.spot.y + Math.sin(this.t * 2.5) * 0.02;
      if (Math.random() < dt * 0.6) this.particles.emit({ x: this.spot.x, y: this.spot.y + 0.02, z: this.spot.z, life: 1, size: 0.1, size1: 0.6, alpha: 0.5, frame: PF.RING, rot: 0 });
      if (this.t > this.biteIn) {
        this.phase = 'bite';
        this.biteWindow = this.easy ? 2.2 : 1.5;
        this.showHint('❗ Ça mord ! Touchez le gros bouton !');
        this.audio.play('bite');
        this.audio.vibrate(80);
        this.particles.splash(this.spot.x, this.spot.y, this.spot.z, 8);
        this.particles.icon(this.player.pos.x, this.player.pos.y + 1.9, this.player.pos.z, PF.EXCLAIM, 0xffffff);
      }
    } else if (this.phase === 'bite') {
      this.bobber.position.y = this.spot.y - 0.08 + Math.sin(this.t * 30) * 0.04;
      this.biteWindow -= dt;
      if (this.biteWindow <= 0) {
        this.ui.toast('Le poisson s\'est échappé… pas grave !', '💨');
        this.end();
      }
    } else if (this.phase === 'reel' && this.fish && this.overlay) {
      const diff = this.fish.fish.difficulty * (this.easy ? 0.55 : 0.8);
      // fish wanders, more erratic for harder fish
      if (Math.random() < dt * (0.6 + diff * 0.25)) this.fishTarget = Math.random();
      this.fishY += (this.fishTarget - this.fishY) * Math.min(1, dt * (0.8 + diff * 0.35));
      this.fishY = Math.max(0.03, Math.min(0.97, this.fishY + Math.sin(this.t * (2 + diff)) * dt * diff * 0.04));
      // zone physics (hold = rise)
      this.zoneV += (this.holding ? 1.9 : -1.5) * dt;
      this.zoneV *= 0.88;
      this.zoneY += this.zoneV * dt;
      const zone = this.zoneSize();
      // gentle assist: a fish just outside the zone drifts back in
      const mid = this.zoneY + zone / 2;
      if (Math.abs(this.fishY - mid) < zone * 0.8) this.fishY += (mid - this.fishY) * dt * 0.6;
      if (this.zoneY < 0) { this.zoneY = 0; this.zoneV = Math.max(0, this.zoneV) * 0.3; }
      if (this.zoneY > 1 - zone) { this.zoneY = 1 - zone; this.zoneV = Math.min(0, this.zoneV) * 0.3; }
      const inside = this.fishY >= this.zoneY && this.fishY <= this.zoneY + zone;
      this.progress += (inside ? 0.4 : -0.09 - diff * 0.01) * dt;
      if (inside && Math.random() < dt * 8) this.audio.play('reel');
      this.zoneEl.style.bottom = `${this.zoneY * 100}%`;
      this.fishEl.style.bottom = `${this.fishY * 100}%`;
      this.fishEl.style.transform = `translateY(50%) rotate(${Math.sin(this.t * 10) * 15}deg)`;
      this.progEl.style.height = `${Math.max(0, Math.min(1, this.progress)) * 100}%`;
      this.bobber.position.y = this.spot.y + Math.sin(this.t * 18) * 0.05;
      if (this.progress >= 1) this.success();
      else if (this.progress <= 0) {
        this.audio.play('fail');
        this.ui.toast(`${FISH_BY_ID[this.fish.fish.id].name} s'est échappé(e)… la prochaine fois !`, '🐟');
        this.end();
      }
    }
  }

  private zoneSize(): number {
    return Math.min(0.6, this.ctx.fishing.zoneSize() * (this.easy ? 1.6 : 1.25));
  }

  private showHint(text: string): void {
    this.hint?.remove();
    this.hint = h('div.fish-hint', null, text);
    this.ui.root.appendChild(this.hint);
  }

  private success(): void {
    const f = this.fish!;
    const isNew = !this.ctx.collections.has('fish', f.fish.id);
    this.ctx.fishing.catch(f.fish.id, f.size);
    this.audio.play('catch');
    this.particles.splash(this.spot.x, this.spot.y, this.spot.z, 14);
    this.particles.sparkle(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z);
    this.onCatch?.(f.fish.id, f.size);
    if (this.contest) {
      this.contest.count++;
      this.contest.best = Math.max(this.contest.best, f.size);
      this.ui.toast(`${f.fish.icon} ${f.fish.name} — ${f.size} cm`, '🎣', 'good');
    } else {
      this.ui.reveal(() => h('div', null,
        h('span.em', null, f.fish.icon),
        h('h2', null, f.fish.name),
        h('span.rarity', { style: { background: RARITY_COLOR[f.fish.rarity] } }, RARITY_NAME[f.fish.rarity]),
        h('p', null, `${f.size} cm${isNew ? ' · Nouvelle espèce !' : ''}`),
      ));
    }
    this.end(true);
  }

  end(caught = false): void {
    this.phase = 'idle';
    this.hint?.remove();
    this.hint = null;
    this.bobber.visible = false;
    this.line.visible = false;
    this.overlay?.remove();
    this.overlay = null;
    this.holding = false;
    this.ui.setHudVisible(true);
    this.player.stopAction();
    if (caught) this.player.celebrate();
    this.fish = null;
  }
}
