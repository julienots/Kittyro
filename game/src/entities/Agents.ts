import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World, Interactable } from '../world/World';
import type { Particles } from '../render/Particles';
import { PF } from '../render/Particles';
import { buildCharacter, type CharacterRig } from '../models/Character';
import { buildAnimal, buildCreature, type AnimalRig } from '../models/Animals';
import { NPCS, NPC_BY_ID, type NpcDef } from '../data/npcs';
import { ANIMAL_BY_ID, ANIMALS } from '../data/animals';
import { CREATURE_BY_ID } from '../data/creatures';
import { INSECT_BY_ID, type InsectDef } from '../data/insects';
import { emojiSprite } from '../render/EmojiSprite';
import { item } from '../data/items';
import { angleLerp, damp } from '../core/MathUtil';
import { Random, rng } from '../core/Random';
import { isNight } from '../data/constants';
import { FARM } from '../state/newGame';
import { footprintOf } from '../systems/Building';
import type { AnimalState, VillagerState } from '../state/types';
import { HAMLET_BY_ID } from '../data/hamlet';
import { VILLAGE_BUILDINGS } from '../data/village';

/** Shared path-following mover for NPCs and animals. */
class Mover {
  pos = new THREE.Vector3();
  facing = 0;
  path: { x: number; z: number }[] = [];
  speed = 1.6;
  moving = false;
  constructor(protected world: World) {}

  goTo(x: number, z: number): boolean {
    const p = this.world.findPath(this.pos.x, this.pos.z, x, z, 2500);
    if (!p) return false;
    this.path = p;
    return true;
  }

  step(dt: number): void {
    this.moving = false;
    if (!this.path.length) return;
    const wp = this.path[0];
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      this.path.shift();
      return;
    }
    const s = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    this.facing = angleLerp(this.facing, Math.atan2(dx, dz), Math.min(1, dt * 8));
    this.moving = true;
  }
}

// ---------------------------------------------------------------- NPC
export class NpcAgent extends Mover {
  rig: CharacterRig;
  def: NpcDef;
  private walkT = 0;
  private blink = 1;
  private idleT = 0;
  currentAnchor = '';
  talking = 0;
  bubble: THREE.Sprite | null = null;

  constructor(world: World, def: NpcDef, outline: boolean) {
    super(world);
    this.def = def;
    this.rig = buildCharacter(def.look, { outline, scale: def.scale });
    this.speed = 1.7;
  }

  update(dt: number, player: THREE.Vector3): void {
    this.step(dt);
    const rig = this.rig;
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    rig.root.position.copy(this.pos);
    const near = player.distanceTo(this.pos) < 3;
    if (!this.moving && (near || this.talking > 0)) {
      this.facing = angleLerp(this.facing, Math.atan2(player.x - this.pos.x, player.z - this.pos.z), Math.min(1, dt * 5));
    }
    rig.root.rotation.y = this.facing;
    this.talking = Math.max(0, this.talking - dt);
    this.blink -= dt;
    rig.eyes.scale.y = this.blink < 0.12 ? 0.15 : 1;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    if (this.moving) {
      this.walkT += dt * 9;
      const s = Math.sin(this.walkT);
      rig.legL.rotation.x = s * 0.7;
      rig.legR.rotation.x = -s * 0.7;
      rig.armL.rotation.x = -s * 0.6;
      rig.armR.rotation.x = s * 0.6;
      rig.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.05;
    } else {
      this.idleT += dt;
      rig.legL.rotation.x = damp(rig.legL.rotation.x, 0, 8, dt);
      rig.legR.rotation.x = damp(rig.legR.rotation.x, 0, 8, dt);
      rig.armL.rotation.x = damp(rig.armL.rotation.x, 0, 8, dt);
      rig.body.position.y = Math.sin(this.idleT * 2) * 0.012;
      // wave when the player approaches, gesture while talking
      if (this.talking > 0) rig.armR.rotation.x = -0.8 + Math.sin(this.idleT * 6) * 0.3;
      else if (near) rig.armR.rotation.z = damp(rig.armR.rotation.z, 2.6 + Math.sin(this.idleT * 10) * 0.25, 6, dt);
      else {
        rig.armR.rotation.z = damp(rig.armR.rotation.z, 0, 6, dt);
        rig.armR.rotation.x = damp(rig.armR.rotation.x, 0, 6, dt);
      }
      rig.head.rotation.z = Math.sin(this.idleT * 0.8) * 0.06;
    }
    if (this.bubble) this.bubble.position.set(this.pos.x, this.pos.y + 1.85 * this.def.scale + Math.sin(this.idleT * 3) * 0.05, this.pos.z);
  }
}

// ---------------------------------------------------------------- Farm animal
type AState = 'idle' | 'wander' | 'graze' | 'sleep' | 'react' | 'follow' | 'sunbathe';

export class AnimalAgent extends Mover {
  rig: AnimalRig;
  state: AState = 'idle';
  private t = 0;
  private stateT = 0;
  private anim = 0;
  private reactKind = '';
  bubble: THREE.Sprite | null = null;
  private bubbleId = '';
  private home: { x: number; z: number } | null = null;
  private r: Random;
  private soundT = 5 + Math.random() * 10;

  constructor(world: World, public data: AnimalState, outline: boolean, private particles: Particles, private ctx: Ctx) {
    super(world);
    const def = ANIMAL_BY_ID[data.species];
    this.rig = buildAnimal(data.species, def.colors[data.color % def.colors.length], def.scale, outline);
    this.speed = def.speed;
    this.pos.set(data.x, 0, data.z);
    this.r = new Random(data.uid.length * 991 + data.bornDay);
    const home = data.homeUid ? ctx.state.farm.placed.find((p) => p.uid === data.homeUid) : null;
    if (home) {
      const fp = footprintOf(home.kind, home.x, home.z, home.rot);
      this.home = { x: (fp.x0 + fp.x1) / 2, z: fp.z1 + 0.8 };
    }
    // keep inside walkable space
    if (world.isBlocked(this.pos.x, this.pos.z, 0.2)) {
      const p = world.randomWalkable(this.home?.x ?? FARM.spawn.x + 3, this.home?.z ?? FARM.spawn.z + 2, 3, this.r);
      if (p) this.pos.set(p.x, 0, p.z);
    }
  }

  get def() {
    return ANIMAL_BY_ID[this.data.species];
  }

  react(kind: string): void {
    this.state = 'react';
    this.reactKind = kind;
    this.stateT = 0.9;
    this.path = [];
    const top = this.pos.y + this.rig.height + 0.2;
    if (kind === 'love') this.particles.hearts(this.pos.x, top, this.pos.z, 4);
    else if (kind === 'eat') this.particles.notes(this.pos.x, top, this.pos.z, 2);
    else if (kind === 'product') this.particles.sparkle(this.pos.x, top, this.pos.z, 0xfff0a0, 8);
    else this.particles.icon(this.pos.x, top, this.pos.z, PF.HEART, 0xff9ab8);
    this.ctx.bus.emit('animal:sound', { species: this.data.species });
  }

  update(dt: number, player: THREE.Vector3, minute: number): void {
    this.t += dt;
    this.stateT -= dt;
    const night = isNight(minute);
    const def = this.def;
    // brain
    if (this.state !== 'react' && this.stateT <= 0) {
      const species = this.data.species;
      if (night && def.home !== 'pet') {
        this.state = 'sleep';
        if (this.home && this.pos.distanceTo(new THREE.Vector3(this.home.x, this.pos.y, this.home.z)) > 1.5) this.goTo(this.home.x + this.r.range(-1, 1), this.home.z + this.r.range(0, 0.8));
        this.stateT = 6;
      } else if (species === 'dog') {
        this.state = 'follow';
        this.stateT = 0.6;
      } else if (species === 'cat' && this.r.chance(0.5)) {
        this.state = 'sunbathe';
        this.stateT = this.r.range(8, 16);
        const p = this.world.randomWalkable(this.pos.x, this.pos.z, 4, this.r);
        if (p) this.goTo(p.x, p.z);
      } else if (this.r.chance(0.45)) {
        this.state = 'wander';
        const cx = this.home?.x ?? this.pos.x, cz = this.home?.z ?? this.pos.z;
        const p = this.world.randomWalkable(cx, cz + 2, 6, this.r);
        if (p) this.goTo(p.x, p.z);
        this.stateT = this.r.range(3, 6);
      } else {
        this.state = this.r.chance(0.6) ? 'graze' : 'idle';
        this.stateT = this.r.range(2, 5);
      }
    }
    if (this.state === 'follow') {
      const d = player.distanceTo(this.pos);
      if (d > 2.2 && (!this.path.length || this.r.chance(0.05))) this.goTo(player.x - 0.8, player.z - 0.8);
      if (d < 1.4) this.path = [];
      this.speed = d > 5 ? 4.2 : 2.6;
    } else this.speed = def.speed * (this.state === 'wander' && this.data.species === 'sheep' && this.data.happiness > 70 ? 1.8 : 1);
    if (this.state === 'react' && this.stateT <= 0) this.state = 'idle';
    this.step(dt);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    this.data.x = this.pos.x;
    this.data.z = this.pos.z;
    this.animate(dt, night);
    // product bubble
    const want = this.data.product ? item(this.data.product).icon : '';
    if (want !== this.bubbleId) {
      if (this.bubble) this.bubble.removeFromParent();
      this.bubble = want ? emojiSprite(want, 0.55) : null;
      this.bubbleId = want;
      if (this.bubble) this.rig.root.parent?.add(this.bubble);
    }
    if (this.bubble) this.bubble.position.set(this.pos.x, this.pos.y + this.rig.height + 0.45 + Math.sin(this.t * 3) * 0.06, this.pos.z);
    // ambient sounds & zzz
    this.soundT -= dt;
    if (this.soundT <= 0) {
      this.soundT = 8 + Math.random() * 14;
      if (this.state === 'sleep') this.particles.zzz(this.pos.x, this.pos.y + this.rig.height, this.pos.z);
      else if (player.distanceTo(this.pos) < 10) this.ctx.bus.emit('animal:sound', { species: this.data.species, soft: true });
    }
    if (this.state === 'sleep' && Math.random() < dt * 0.6) this.particles.zzz(this.pos.x, this.pos.y + this.rig.height, this.pos.z);
  }

  private animate(dt: number, night: boolean): void {
    const rig = this.rig;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.facing;
    const sp = this.data.species;
    if (this.moving) {
      this.anim += dt * (sp === 'rabbit' ? 10 : 12) * (this.speed / 1.5);
      const hop = sp === 'rabbit' || sp === 'sheep' || sp === 'dog';
      rig.body.position.y = hop ? Math.abs(Math.sin(this.anim)) * 0.14 : Math.abs(Math.sin(this.anim)) * 0.05;
      rig.body.rotation.z = Math.sin(this.anim) * (sp === 'duck' || sp === 'chicken' || sp === 'pig' ? 0.14 : 0.05);
      rig.head.rotation.x = Math.sin(this.anim * 2) * 0.08;
      rig.tail.rotation.y = Math.sin(this.anim * 2) * 0.4;
      rig.body.scale.y = damp(rig.body.scale.y, 1, 8, dt);
    } else {
      rig.body.position.y = damp(rig.body.position.y, 0, 8, dt);
      rig.body.rotation.z = damp(rig.body.rotation.z, 0, 8, dt);
      const t = this.t;
      switch (this.state) {
        case 'graze': {
          // species flavour: chicken pecks, pig sniffs, cow & sheep & goat graze
          const k = sp === 'chicken' || sp === 'duck' ? Math.max(0, Math.sin(t * 9)) * 0.8 : sp === 'pig' ? 0.4 + Math.sin(t * 12) * 0.1 : 0.55 + Math.sin(t * 3) * 0.05;
          rig.head.rotation.x = k;
          rig.tail.rotation.y = Math.sin(t * 4) * 0.3;
          break;
        }
        case 'sleep':
        case 'sunbathe':
          rig.body.scale.y = damp(rig.body.scale.y, 0.82, 4, dt);
          rig.head.rotation.x = damp(rig.head.rotation.x, 0.45, 4, dt);
          rig.body.position.y = -0.04;
          break;
        case 'react':
          rig.body.position.y = Math.abs(Math.sin(t * 12)) * 0.18;
          rig.tail.rotation.y = Math.sin(t * 25) * 0.6;
          rig.head.rotation.x = -0.2;
          break;
        case 'follow':
          rig.tail.rotation.y = Math.sin(t * 18) * 0.6;
          rig.head.rotation.x = -0.1 + Math.sin(t * 2) * 0.05;
          break;
        default:
          rig.head.rotation.x = damp(rig.head.rotation.x, Math.sin(t * 0.7) * 0.1, 4, dt);
          rig.head.rotation.y = Math.sin(t * 0.5) * 0.3;
          rig.tail.rotation.y = Math.sin(t * 2) * 0.2;
      }
      if (this.state !== 'sleep' && this.state !== 'sunbathe') rig.body.scale.y = damp(rig.body.scale.y, 1 + Math.sin(this.t * 2.5) * 0.015, 6, dt);
    }
    void night;
  }

  dispose(): void {
    this.bubble?.removeFromParent();
  }
}

// ---------------------------------------------------------------- Wild things
export type WildKind = 'creature' | 'insect' | 'wildanimal' | 'critter';

/**
 * Wild creatures follow a little "encounter" script: appear (often peeking from
 * behind a tree), notice the player, maybe flee. Approaching gently lets you
 * record them in the Bestiary.
 */
export class WildAgent extends Mover {
  rig: AnimalRig | null = null;
  sprite: THREE.Object3D | null = null;
  mode: 'appear' | 'idle' | 'notice' | 'flee' | 'gone' | 'fly' = 'appear';
  t = 0;
  life = 40;
  noticed = false;
  private base = new THREE.Vector3();
  private flyPhase = Math.random() * 10;
  discovered = false;

  constructor(world: World, public kind: WildKind, public id: string, x: number, z: number, private particles: Particles, private ctx: Ctx) {
    super(world);
    this.pos.set(x, world.heightAt(x, z), z);
    this.base.copy(this.pos);
    if (kind === 'creature') {
      this.rig = buildCreature(CREATURE_BY_ID[id]);
      this.rig.root.scale.setScalar(0.01);
      this.speed = 2.6;
    } else if (kind === 'wildanimal') {
      const def = ANIMAL_BY_ID[id];
      this.rig = buildAnimal(id, def.colors[0], def.scale, false);
      this.speed = def.speed;
      this.life = 90;
    } else if (kind === 'insect') {
      const def = INSECT_BY_ID[id];
      this.sprite = makeInsect(def);
      this.mode = def.flying ? 'fly' : 'idle';
      this.life = 60;
      this.speed = 1.2;
    } else {
      this.sprite = makeCritter(id);
      this.mode = 'idle';
      this.life = 50;
    }
  }

  get object(): THREE.Object3D {
    return (this.rig?.root ?? this.sprite)!;
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number): void {
    this.t += dt;
    this.life -= dt;
    const d = player.distanceTo(this.pos);
    const obj = this.object;
    if (this.kind === 'insect' || this.kind === 'critter') {
      if (this.mode === 'fly') {
        const ph = this.t + this.flyPhase;
        this.pos.x = this.base.x + Math.sin(ph * 0.7) * 1.4 + Math.sin(ph * 2.3) * 0.2;
        this.pos.z = this.base.z + Math.cos(ph * 0.5) * 1.4;
        this.pos.y = this.world.heightAt(this.pos.x, this.pos.z) + 0.7 + Math.sin(ph * 3) * 0.25;
        if (d < 1.2 && playerSpeed > 3) this.base.add(new THREE.Vector3(this.pos.x - player.x, 0, this.pos.z - player.z).normalize().multiplyScalar(dt * 4));
      } else {
        // ground bugs crawl slowly; frogs hop
        if (this.t % 3 < dt && Math.random() < 0.5) {
          const p = this.world.randomWalkable(this.base.x, this.base.z, 1.5, new Random(Math.floor(this.t * 100)));
          if (p) this.path = [p];
        }
        this.step(dt);
        this.pos.y = this.world.heightAt(this.pos.x, this.pos.z) + (this.id === 'frog' ? Math.abs(Math.sin(this.t * 6)) * 0.15 * (this.moving ? 1 : 0) : 0.02);
      }
      obj.position.copy(this.pos);
      if (this.sprite) this.sprite.rotation.y = this.facing;
      if (this.life < 0) this.mode = 'gone';
      return;
    }
    const rig = this.rig!;
    const shy = this.kind === 'creature' ? CREATURE_BY_ID[this.id].shy : 0.3;
    switch (this.mode) {
      case 'appear': {
        const k = Math.min(1, this.t / 0.6);
        rig.root.scale.setScalar(k);
        if (this.t < 0.05) this.particles.sparkle(this.pos.x, this.pos.y + 0.4, this.pos.z, 0xfff0d0, 6);
        if (k >= 1) this.mode = 'idle';
        break;
      }
      case 'idle':
        rig.body.position.y = Math.abs(Math.sin(this.t * 3)) * 0.05;
        rig.head.rotation.y = Math.sin(this.t * 1.3) * 0.5;
        if (d < 6 && !this.noticed) {
          this.noticed = true;
          this.mode = 'notice';
          this.t = 0;
          this.particles.icon(this.pos.x, this.pos.y + rig.height + 0.4, this.pos.z, PF.QUESTION);
        }
        if (!this.path.length && Math.random() < dt * 0.3) {
          const p = this.world.randomWalkable(this.base.x, this.base.z, 2.5, new Random(Math.floor(this.t * 99)));
          if (p) this.goTo(p.x, p.z);
        }
        break;
      case 'notice':
        // look at the player
        this.facing = angleLerp(this.facing, Math.atan2(player.x - this.pos.x, player.z - this.pos.z), Math.min(1, dt * 6));
        rig.body.position.y = this.t < 0.3 ? Math.sin(this.t * 10) * 0.12 : 0;
        if (this.t > 1.2) {
          // running or a shy creature => flee; walking slowly => stays curious
          if (playerSpeed > 3.2 && d < 4.5 && Math.random() < shy) {
            this.flee(player);
          } else if (this.t > 6 && Math.random() < shy * dt * 0.3) this.flee(player);
        }
        if (playerSpeed > 4 && d < 2.5 && shy > 0.3) this.flee(player);
        break;
      case 'flee':
        rig.body.position.y = Math.abs(Math.sin(this.t * 14)) * 0.12;
        if (!this.path.length || this.t > 4) {
          this.mode = 'gone';
          this.particles.dust(this.pos.x, this.pos.y, this.pos.z, 0xffffff, 6);
        }
        break;
    }
    if (this.life < 0 && this.mode !== 'flee') this.mode = 'gone';
    this.step(dt);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    const c = this.kind === 'creature' ? CREATURE_BY_ID[this.id] : null;
    if (c?.shape === 'sprite' || c?.shape === 'jelly' || c?.shape === 'fluff') this.pos.y += 0.4 + Math.sin(this.t * 2) * 0.1;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.facing;
    if (c?.glow && Math.random() < dt * 4) this.particles.emit({ x: this.pos.x + (Math.random() - 0.5) * 0.5, y: this.pos.y + 0.4, z: this.pos.z + (Math.random() - 0.5) * 0.5, vy: 0.3, life: 1, size: 0.1, size1: 0.02, color: c.accent, frame: PF.SPARKLE, additive: true });
  }

  flee(player: THREE.Vector3): void {
    this.mode = 'flee';
    this.t = 0;
    const dir = new THREE.Vector3(this.pos.x - player.x, 0, this.pos.z - player.z).normalize();
    const tx = this.pos.x + dir.x * 7, tz = this.pos.z + dir.z * 7;
    if (!this.goTo(tx, tz)) this.mode = 'gone';
    this.speed = 4.5;
    this.particles.icon(this.pos.x, this.pos.y + (this.rig?.height ?? 0.5) + 0.4, this.pos.z, PF.EXCLAIM);
  }
}

function makeInsect(def: InsectDef): THREE.Object3D {
  const g = new THREE.Group();
  const col = new THREE.MeshBasicMaterial({ color: def.color, side: THREE.DoubleSide });
  if (def.flying) {
    const wing = new THREE.CircleGeometry(0.11, 8);
    const l = new THREE.Mesh(wing, col);
    const r = new THREE.Mesh(wing, col);
    l.position.x = -0.08;
    r.position.x = 0.08;
    l.rotation.x = r.rotation.x = -Math.PI / 2;
    g.add(l, r);
    g.userData.wings = [l, r];
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 2, 4), new THREE.MeshBasicMaterial({ color: 0x2a2020 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    if (def.id === 'firefly') g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff27a })));
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshToonMaterial({ color: def.color }));
    b.scale.set(1, 0.6, 1.3);
    b.position.y = 0.04;
    g.add(b);
  }
  return g;
}

function makeCritter(id: string): THREE.Object3D {
  const g = new THREE.Group();
  if (id === 'frog') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshToonMaterial({ color: 0x6ac85a }));
    b.scale.set(1, 0.7, 1.1);
    b.position.y = 0.07;
    g.add(b);
    for (const sx of [-0.05, 0.05]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
      e.position.set(sx, 0.14, 0.06);
      g.add(e);
    }
  } else {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshToonMaterial({ color: 0xc89a6a }));
    shell.position.y = 0.08;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 2, 5), new THREE.MeshToonMaterial({ color: 0xd8d0b8 }));
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.03;
    g.add(shell, body);
  }
  return g;
}

// ---------------------------------------------------------------- Villagers (hamlet) & passers-by (Willowbrook)
const PASSERBY_LINES = [
  'Bonjour ! Belle journée, n\'est-ce pas ?', 'Je vais au marché, il paraît que les tomates sont superbes.', 'Le village change à vue d\'œil grâce à toi !',
  'Tu as vu ? La fontaine coule de nouveau.', 'Je promène mes pensées… et mes pieds.', 'Il paraît qu\'un hameau se construit au sud de ta ferme !',
  'Mes enfants adorent les lucioles du soir.', 'J\'ai croisé un Moussinet près du ruisseau ce matin !',
];

export class VillagerAgent extends NpcAgent {
  goal = '';
  inside = false;
  private wanderT = Math.random() * 6;
  line = '';

  constructor(world: World, public data: VillagerState | null, look: VillagerState['look'], name: string, role: string, outline: boolean) {
    super(world, { id: data ? `v:${data.uid}` : `p:${name}`, name, role, desc: '', look, scale: 0.86 + ((name.length * 7) % 10) / 60, loves: [], likes: [], dislikes: [], schedule: [], lines: [], rain: '', night: '', winter: '' } as NpcDef, outline);
    this.speed = 1.4 + Math.random() * 0.4;
    this.line = PASSERBY_LINES[(name.length * 3) % PASSERBY_LINES.length];
  }

  setInside(v: boolean): void {
    this.inside = v;
    this.rig.root.visible = !v;
    if (this.bubble) this.bubble.visible = !v;
  }

  /** Small idle wander around the current goal. */
  idle(dt: number, cx: number, cz: number, r: number, rng: Random): void {
    this.wanderT -= dt;
    if (this.wanderT > 0 || this.path.length) return;
    this.wanderT = 5 + Math.random() * 8;
    const p = this.world.randomWalkable(cx, cz, r, rng);
    if (p) this.goTo(p.x, p.z);
  }
}

// ---------------------------------------------------------------- Manager
export class EntityManager {
  readonly group = new THREE.Group();
  npcs: NpcAgent[] = [];
  villagers: VillagerAgent[] = [];
  animals: AnimalAgent[] = [];
  wild: WildAgent[] = [];
  private spawnT = 8;
  private insectT = 3;
  private wildAnimalT = 15;
  private scheduleT = 0;
  private r = new Random(Date.now() >>> 0);
  outline = true;
  onDiscover: ((w: WildAgent) => void) | null = null;

  constructor(private ctx: Ctx, private world: World, private particles: Particles) {}

  clear(): void {
    for (const a of this.animals) a.dispose();
    for (const n of this.npcs) n.bubble?.removeFromParent();
    for (const n of this.villagers) n.bubble?.removeFromParent();
    this.group.clear();
    this.npcs = [];
    this.villagers = [];
    this.animals = [];
    this.wild = [];
  }

  /** Spawn everything for the freshly loaded region. */
  populate(): void {
    this.clear();
    const st = this.ctx.state;
    const region = this.world.region;
    for (const def of NPCS) {
      const loc = this.npcLocation(def);
      if (!loc || loc.region !== region) continue;
      if (!this.npcAvailable(def.id)) continue;
      const a = this.world.layout.anchors[loc.anchor];
      if (!a) continue;
      const n = new NpcAgent(this.world, def, this.outline);
      const p = this.world.isBlocked(a.x, a.z, 0.25) ? this.world.randomWalkable(a.x, a.z, 2, this.r) ?? a : a;
      n.pos.set(p.x, 0, p.z);
      n.currentAnchor = loc.anchor;
      n.facing = 0.6;
      this.npcs.push(n);
      this.group.add(n.rig.root);
    }
    if (region === 'hamlet') this.syncVillagers(true);
    if (region === 'village') this.spawnPassersby();
    if (region === 'farm') {
      for (const data of st.animals) {
        const ag = new AnimalAgent(this.world, data, this.outline, this.particles, this.ctx);
        this.animals.push(ag);
        this.group.add(ag.rig.root);
      }
    } else {
      // pets (dog) follow you everywhere outdoors
      for (const data of st.animals.filter((a) => a.species === 'dog')) {
        if (this.world.layout.indoor) break;
        const ag = new AnimalAgent(this.world, data, this.outline, this.particles, this.ctx);
        ag.pos.set(st.player.x - 1, 0, st.player.z - 1);
        this.animals.push(ag);
        this.group.add(ag.rig.root);
      }
    }
    this.spawnT = 5;
  }

  npcAvailable(id: string): boolean {
    const st = this.ctx.state;
    // shopkeepers wait in the village until their building is restored? No: they are there, looking at their ruin.
    if (id === 'bibi' && !st.npcs.bibi.met && st.quests.storyStep < 3) return false;
    return true;
  }

  npcLocation(def: NpcDef): { region: string; anchor: string } | null {
    const m = this.ctx.state.time.minute;
    let cur = def.schedule[0];
    for (const s of def.schedule) if (m >= s.from) cur = s;
    // early game: Moss always waits near the farm house for the first quest
    if (def.id === 'moss' && this.ctx.state.quests.storyStep === 0) return { region: 'farm', anchor: 'moss_bench' };
    if (cur.region === 'woods' && !this.ctx.state.regions.woods.unlocked) return { region: 'village', anchor: 'map_board' };
    if (this.ctx.festivals.active() && def.id !== 'moss') return { region: 'village', anchor: 'plaza' };
    return cur;
  }

  /** Walk NPCs to their schedule anchors as the day goes by. */
  private updateSchedules(): void {
    for (const n of this.npcs) {
      const loc = this.npcLocation(n.def);
      if (!loc) continue;
      if (loc.region !== this.world.region) {
        // walk off toward the edge then vanish
        if (!n.path.length) {
          n.rig.root.removeFromParent();
          this.npcs = this.npcs.filter((x) => x !== n);
        }
        continue;
      }
      if (loc.anchor !== n.currentAnchor) {
        const a = this.world.layout.anchors[loc.anchor];
        if (a && n.goTo(a.x + this.r.range(-0.6, 0.6), a.z + this.r.range(-0.4, 0.4))) n.currentAnchor = loc.anchor;
      }
    }
    // NPCs whose schedule brings them into this region appear at the region entry
    for (const def of NPCS) {
      if (this.npcs.some((n) => n.def.id === def.id)) continue;
      const loc = this.npcLocation(def);
      if (!loc || loc.region !== this.world.region || !this.npcAvailable(def.id)) continue;
      const a = this.world.layout.anchors[loc.anchor];
      if (!a) continue;
      const entry = Object.entries(this.world.layout.anchors).find(([k]) => k.endsWith('_entry'))?.[1] ?? a;
      const n = new NpcAgent(this.world, def, this.outline);
      n.pos.set(entry.x, 0, entry.z);
      n.goTo(a.x, a.z);
      n.currentAnchor = loc.anchor;
      this.npcs.push(n);
      this.group.add(n.rig.root);
    }
  }

  syncAnimals(): void {
    if (this.world.region !== 'farm') return;
    const st = this.ctx.state;
    for (const data of st.animals) {
      if (this.animals.some((a) => a.data.uid === data.uid)) continue;
      const ag = new AnimalAgent(this.world, data, this.outline, this.particles, this.ctx);
      this.animals.push(ag);
      this.group.add(ag.rig.root);
      this.particles.sparkle(ag.pos.x, ag.pos.y + 0.5, ag.pos.z);
    }
  }

  // ------------------------------------------------ hamlet villagers
  /** Make the agents match the hamlet's villagers (newcomers walk in from the trail). */
  syncVillagers(initial = false): void {
    if (this.world.region !== 'hamlet') return;
    const st = this.ctx.state.hamlet;
    for (const v of this.villagers.filter((a) => a.data && !st.villagers.some((x) => x.uid === a.data!.uid))) {
      v.rig.root.removeFromParent();
      v.bubble?.removeFromParent();
    }
    this.villagers = this.villagers.filter((a) => !a.data || st.villagers.some((x) => x.uid === a.data!.uid));
    for (const data of st.villagers) {
      if (this.villagers.some((a) => a.data?.uid === data.uid)) continue;
      const ag = new VillagerAgent(this.world, data, data.look, data.name, '', this.outline);
      const goal = this.villagerGoal(ag);
      const entry = this.world.layout.anchors.farm_entry;
      const start = initial ? this.world.randomWalkable(goal.x, goal.z, 1.5, this.r) ?? goal : entry;
      ag.pos.set(start.x, 0, start.z);
      ag.goal = initial ? goal.key : '';
      if (initial && goal.inside) ag.setInside(true);
      this.villagers.push(ag);
      this.group.add(ag.rig.root);
      if (!initial) this.particles.sparkle(ag.pos.x, 1, ag.pos.z);
    }
  }

  /** Where a villager wants to be right now (home / work / tavern / plaza). */
  private villagerGoal(ag: VillagerAgent): { key: string; x: number; z: number; inside: boolean; wander: number } {
    const st = this.ctx.state;
    const m = st.time.minute;
    const v = ag.data!;
    const placed = st.hamlet.placed;
    const doorOf = (uid: string | null) => {
      const p = uid ? placed.find((q) => q.uid === uid) : null;
      if (!p) return null;
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      return { x: (fp.x0 + fp.x1) / 2, z: fp.z1 + 0.6 };
    };
    const plaza = this.world.layout.anchors.plaza;
    const home = doorOf(v.homeUid);
    const raining = st.weather.current === 'rain' || st.weather.current === 'storm';
    if (m < 7 * 60 || m >= 21 * 60 || (raining && !v.jobUid && m >= 9 * 60)) {
      if (home) return { key: `home:${v.homeUid}`, ...home, inside: true, wander: 0 };
      const t = this.world.layout.anchors.register;
      return { key: 'camp', x: t.x - 2.5, z: t.z + 2.5, inside: false, wander: 1 };
    }
    if (m < 17.5 * 60) {
      const work = doorOf(v.jobUid);
      if (work) return { key: `work:${v.jobUid}`, ...work, inside: false, wander: 1.4 };
      return { key: 'plaza', x: plaza.x, z: plaza.z, inside: false, wander: 4 };
    }
    const tavern = placed.find((p) => p.kind === 'h_tavern') ?? placed.find((p) => p.kind === 'h_bandstand');
    const t = tavern ? doorOf(tavern.uid) : null;
    if (t && (v.happiness + v.name.length * 7) % 3 !== 0) return { key: `fun:${tavern!.uid}`, ...t, inside: false, wander: 2 };
    return { key: 'plaza', x: plaza.x, z: plaza.z, inside: false, wander: 3 };
  }

  private updateVillagers(dt: number): void {
    for (const ag of this.villagers) {
      if (!ag.data) {
        // passers-by in Willowbrook stroll between landmarks
        if (!ag.path.length && Math.random() < dt * 0.15) {
          const anchors = Object.entries(this.world.layout.anchors).filter(([k]) => !k.endsWith('_entry'));
          const [, a] = this.r.pick(anchors);
          ag.goTo(a.x + this.r.range(-1, 1), a.z + this.r.range(-1, 1));
        }
        continue;
      }
      const g = this.villagerGoal(ag);
      if (g.key !== ag.goal) {
        ag.goal = g.key;
        if (ag.inside) {
          // step out of the house
          const p = this.world.randomWalkable(ag.pos.x, ag.pos.z, 1, this.r);
          if (p) ag.pos.set(p.x, 0, p.z);
          ag.setInside(false);
        }
        if (!ag.goTo(g.x + this.r.range(-0.4, 0.4), g.z + this.r.range(-0.2, 0.4))) ag.path = [];
      } else if (!ag.path.length) {
        const d = Math.hypot(ag.pos.x - g.x, ag.pos.z - g.z);
        if (g.inside && d < 1.2 && !ag.inside) ag.setInside(true);
        else if (!g.inside && g.wander) ag.idle(dt, g.x, g.z, g.wander, this.r);
      }
      // wish bubble
      const want = ag.data.wish && !ag.inside ? item(ag.data.wish.id).icon : '';
      const cur = (ag.bubble?.userData.icon as string | undefined) ?? '';
      if (want !== cur) {
        ag.bubble?.removeFromParent();
        ag.bubble = want ? emojiSprite(want, 0.5) : null;
        if (ag.bubble) {
          ag.bubble.userData.icon = want;
          this.group.add(ag.bubble);
        }
      }
    }
  }

  /** A few anonymous villagers strolling around Willowbrook — more as the village is restored. */
  private spawnPassersby(): void {
    const st = this.ctx.state;
    const m = st.time.minute;
    if (m < 7 * 60 || m > 21 * 60) return;
    const restored = VILLAGE_BUILDINGS.filter((b) => st.village[b.id]?.restored).length;
    const n = Math.min(7, 2 + Math.floor(restored / 2));
    const rr = new Random(st.time.day * 31 + 7);
    const anchors = Object.values(this.world.layout.anchors);
    for (let i = 0; i < n; i++) {
      const v = this.ctx.hamlet.makeVillager();
      const ag = new VillagerAgent(this.world, null, v.look, v.name, 'Passant·e', this.outline);
      const a = rr.pick(anchors);
      const p = this.world.randomWalkable(a.x, a.z, 2, rr) ?? a;
      ag.pos.set(p.x, 0, p.z);
      this.villagers.push(ag);
      this.group.add(ag.rig.root);
    }
  }

  villagerAgent(uid: string): VillagerAgent | undefined {
    return this.villagers.find((v) => v.data?.uid === uid);
  }

  animal(uid: string): AnimalAgent | undefined {
    return this.animals.find((a) => a.data.uid === uid);
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number): void {
    const st = this.ctx.state;
    this.scheduleT -= dt;
    if (this.scheduleT <= 0) {
      this.scheduleT = 1.5;
      this.updateSchedules();
    }
    for (const n of this.npcs) n.update(dt, player);
    this.updateVillagers(dt);
    for (const v of this.villagers) if (!v.inside) v.update(dt, player);
    for (const a of this.animals) a.update(dt, player, st.time.minute);
    for (const w of this.wild) w.update(dt, player, playerSpeed);
    // despawn
    for (const w of this.wild.filter((x) => x.mode === 'gone')) w.object.removeFromParent();
    this.wild = this.wild.filter((x) => x.mode !== 'gone');
    // butterflies wings
    for (const w of this.wild) {
      const wings = (w.sprite?.userData.wings as THREE.Mesh[] | undefined);
      if (wings) {
        const a = Math.sin(w.t * 22) * 0.9;
        wings[0].rotation.y = a;
        wings[1].rotation.y = -a;
      }
    }
    this.spawnWild(dt, player);
  }

  /** Random little encounters: creatures, insects, wild animals, critters after rain. */
  private spawnWild(dt: number, player: THREE.Vector3): void {
    const region = this.world.region;
    if (region === 'house') return;
    const st = this.ctx.state;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.r.range(28, 55) / (this.ctx.weather.rainbow() ? 2 : 1);
      const c = this.ctx.creatures.roll(region);
      if (c && this.wild.filter((w) => w.kind === 'creature').length < 2) {
        // prefer a spot next to a tree/rock so it "peeks out"
        const near = this.world.nodes.filter((n) => n.growth >= 1 && (n.node.kind.startsWith('tree') || n.node.kind.startsWith('rock')) && Math.hypot(n.node.x - player.x, n.node.z - player.z) > 5 && Math.hypot(n.node.x - player.x, n.node.z - player.z) < 11);
        let pos = near.length ? this.r.pick(near).node : null;
        let p = pos ? this.world.randomWalkable(pos.x, pos.z, 1.2, this.r) : this.world.randomWalkable(player.x, player.z, 9, this.r);
        if (p && Math.hypot(p.x - player.x, p.z - player.z) > 4) {
          const w = new WildAgent(this.world, 'creature', c.id, p.x, p.z, this.particles, this.ctx);
          this.wild.push(w);
          this.group.add(w.object);
          this.ctx.bus.emit('creature:spawn', { id: c.id });
        }
      }
    }
    this.insectT -= dt;
    if (this.insectT <= 0) {
      this.insectT = this.r.range(6, 12);
      if (this.wild.filter((w) => w.kind === 'insect').length < 4) {
        const ins = this.ctx.creatures.rollInsect(region);
        const p = this.world.randomWalkable(player.x, player.z, 10, this.r);
        if (ins && p && Math.hypot(p.x - player.x, p.z - player.z) > 3) {
          const w = new WildAgent(this.world, 'insect', ins.id, p.x, p.z, this.particles, this.ctx);
          this.wild.push(w);
          this.group.add(w.object);
        }
      }
      // after the rain: frogs & snails come out
      if ((st.weather.current === 'rain' || st.weather.today === 'rain') && this.wild.filter((w) => w.kind === 'critter').length < 3 && !this.world.layout.indoor) {
        const p = this.world.randomWalkable(player.x, player.z, 8, this.r);
        if (p) {
          const w = new WildAgent(this.world, 'critter', this.r.chance(0.5) ? 'frog' : 'snail', p.x, p.z, this.particles, this.ctx);
          this.wild.push(w);
          this.group.add(w.object);
        }
      }
    }
    // rare wild animals in their home region
    this.wildAnimalT -= dt;
    if (this.wildAnimalT <= 0) {
      this.wildAnimalT = this.r.range(40, 80);
      const candidates = ANIMALS.filter((a) => a.wild && a.region === region && !this.ctx.animals.owns(a.id));
      const night = isNight(st.time.minute);
      const pick = candidates.filter((a) => (a.id === 'hedgehog' || a.id === 'raccoon' || a.id === 'lumipanda' ? night || a.id === 'lumipanda' : true));
      if (pick.length && !this.wild.some((w) => w.kind === 'wildanimal')) {
        const def = this.r.pick(pick);
        if (def.id === 'lumipanda' && !(night && rng.chance(0.5))) return;
        const p = this.world.randomWalkable(player.x, player.z, 10, this.r);
        if (p && Math.hypot(p.x - player.x, p.z - player.z) > 5) {
          const w = new WildAgent(this.world, 'wildanimal', def.id, p.x, p.z, this.particles, this.ctx);
          this.wild.push(w);
          this.group.add(w.object);
        }
      }
    }
  }

  /** Entities you can interact with near the player. */
  interactables(): Interactable[] {
    const out: Interactable[] = [];
    for (const n of this.npcs) out.push({ id: `npc:${n.def.id}`, kind: 'npc', x: n.pos.x, z: n.pos.z, radius: 1.6, label: n.def.name, icon: '💬', data: { npc: n.def.id } });
    for (const v of this.villagers) {
      if (v.inside) continue;
      if (v.data) out.push({ id: `villager:${v.data.uid}`, kind: 'villager', x: v.pos.x, z: v.pos.z, radius: 1.5, label: v.data.name, icon: v.data.wish ? '💭' : '💬', data: { uid: v.data.uid } });
      else out.push({ id: `passerby:${v.def.name}`, kind: 'passerby', x: v.pos.x, z: v.pos.z, radius: 1.4, label: v.def.name, icon: '👋', data: { agent: v } });
    }
    for (const a of this.animals) {
      const def = a.def;
      out.push({ id: `animal:${a.data.uid}`, kind: 'animal', x: a.pos.x, z: a.pos.z, radius: 1.3 + def.scale * 0.4, label: a.data.product ? `Récolter (${a.data.name})` : `${a.data.name}`, icon: a.data.product ? item(a.data.product).icon : def.icon, data: { uid: a.data.uid } });
    }
    for (const w of this.wild) {
      if (w.kind === 'creature' && w.mode !== 'flee') out.push({ id: `wild:${w.id}:${w.t.toFixed(0)}`, kind: 'creature', x: w.pos.x, z: w.pos.z, radius: 2.4, label: 'Observer doucement', icon: '🔍', data: { agent: w } });
      if (w.kind === 'insect') out.push({ id: `bug:${w.id}`, kind: 'insect', x: w.pos.x, z: w.pos.z, radius: 1.4, label: `Attraper : ${INSECT_BY_ID[w.id].name}`, icon: INSECT_BY_ID[w.id].icon, data: { agent: w } });
      if (w.kind === 'wildanimal' && w.mode !== 'flee') out.push({ id: `wa:${w.id}`, kind: 'wildanimal', x: w.pos.x, z: w.pos.z, radius: 2.0, label: `Amadouer : ${ANIMAL_BY_ID[w.id].name}`, icon: ANIMAL_BY_ID[w.id].icon, data: { agent: w } });
    }
    return out;
  }

  npc(id: string): NpcAgent | undefined {
    return this.npcs.find((n) => n.def.id === id);
  }
}

export { NPC_BY_ID };
