import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from '../world/World';
import type { Particles } from '../render/Particles';
import { buildCharacter, buildToolMesh, type CharacterRig } from '../models/Character';
import { buildAnimal, type AnimalRig } from '../models/Animals';
import { angleLerp, clamp, damp } from '../core/MathUtil';
import { TRAILS } from '../data/shop';
import { ANIMAL_BY_ID } from '../data/animals';

export type PlayerAnim = 'idle' | 'walk' | 'tool' | 'fishCast' | 'fishWait' | 'fishReel' | 'happy' | 'pet' | 'sleep' | 'eat';

/**
 * The player avatar: movement with collision, tap-to-move path following,
 * procedural chibi animation, tool swings, riding the horse, cosmetic trails.
 */
export class Player {
  rig!: CharacterRig;
  readonly root = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  facing = 0;
  private targetFacing = 0;
  anim: PlayerAnim = 'idle';
  animT = 0;
  private walkT = 0;
  private toolMesh: THREE.Mesh | null = null;
  toolKey = '';
  private onImpact: (() => void) | null = null;
  private impactAt = 0.3;
  private impactDone = false;
  animDur = 0.5;
  /** first-person view: the body always faces where the camera looks */
  lockFacing: number | null = null;
  path: { x: number; z: number }[] = [];
  pathTarget: { x: number; z: number; onArrive?: () => void } | null = null;
  private blinkT = 2;
  private stepT = 0;
  private trailT = 0;
  horse: AnimalRig | null = null;
  lantern: THREE.PointLight | null = null;
  outline = true;
  frozen = false;

  constructor(private ctx: Ctx, private world: World, private particles: Particles) {
    this.rebuild();
  }

  rebuild(): void {
    const old = this.rig;
    if (old) this.root.remove(old.root);
    this.rig = buildCharacter(this.ctx.state.player.look, { outline: this.outline });
    this.root.add(this.rig.root);
    this.toolMesh = null;
    this.toolKey = '';
    this.updateRiding();
  }

  updateRiding(): void {
    const riding = this.ctx.state.player.riding && this.world.layout && !this.world.layout.indoor;
    if (riding && !this.horse) {
      const h = this.ctx.state.animals.find((a) => a.species === 'horse');
      const def = ANIMAL_BY_ID.horse;
      this.horse = buildAnimal('horse', def.colors[h?.color ?? 0], def.scale, this.outline);
      this.root.add(this.horse.root);
      this.rig.root.position.y = 0.95;
    } else if (!riding && this.horse) {
      this.root.remove(this.horse.root);
      this.horse = null;
      this.rig.root.position.y = 0;
    }
  }

  setLantern(on: boolean): void {
    if (on && !this.lantern) {
      this.lantern = new THREE.PointLight(0xffd8a0, 2.2, 9, 1.4);
      this.lantern.position.set(0, 1.6, 0.3);
      this.root.add(this.lantern);
    } else if (!on && this.lantern) {
      this.root.remove(this.lantern);
      this.lantern = null;
    }
  }

  teleport(x: number, z: number, facing = this.facing): void {
    this.pos.set(x, this.world.heightAt(x, z), z);
    this.facing = this.targetFacing = facing;
    this.vel.set(0, 0, 0);
    this.path = [];
    this.pathTarget = null;
    this.root.position.copy(this.pos);
    this.root.rotation.y = facing;
  }

  get busy(): boolean {
    return this.anim === 'tool' || this.anim === 'fishCast' || this.anim === 'fishWait' || this.anim === 'fishReel' || this.anim === 'sleep' || this.anim === 'eat' || this.anim === 'pet';
  }

  speed(): number {
    const st = this.ctx.state;
    let s = 3.6;
    if (this.horse) s *= 1.85;
    if (this.ctx.hasBuff('speed')) s *= 1.35;
    if (this.world.region === 'house') s *= 0.85;
    return s;
  }

  /** Begin a tool/action animation; `impact` runs at the hit frame. */
  act(anim: PlayerAnim, tool: string | null, impact?: () => void, dur = 0.5, impactAt = 0.55): void {
    this.anim = anim;
    this.animT = 0;
    this.animDur = dur;
    this.onImpact = impact ?? null;
    this.impactAt = impactAt;
    this.impactDone = false;
    this.path = [];
    this.pathTarget = null;
    this.showTool(tool);
  }

  showTool(tool: string | null): void {
    const key = tool ? `${tool}:${this.ctx.state.player.tools[tool as keyof typeof this.ctx.state.player.tools] ?? 0}` : '';
    if (key === this.toolKey) return;
    if (this.toolMesh) this.rig.toolSlot.remove(this.toolMesh);
    this.toolMesh = null;
    this.toolKey = key;
    if (!tool) return;
    this.toolMesh = buildToolMesh(tool, this.ctx.state.player.tools[tool as keyof typeof this.ctx.state.player.tools] ?? 0);
    this.rig.toolSlot.add(this.toolMesh);
  }

  stopAction(): void {
    this.anim = 'idle';
    this.animT = 0;
    this.showTool(null);
  }

  faceTo(x: number, z: number): void {
    this.targetFacing = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  walkTo(x: number, z: number, onArrive?: () => void): boolean {
    const p = this.world.findPath(this.pos.x, this.pos.z, x, z);
    if (!p) return false;
    this.path = p;
    this.pathTarget = { x, z, onArrive };
    if (this.busy && this.anim !== 'fishWait') return false;
    if (this.anim === 'fishWait') this.stopAction();
    return true;
  }

  /** Move with a world-space direction (x,z), magnitude 0..1. */
  update(dt: number, moveX: number, moveZ: number, night: number): void {
    const st = this.ctx.state;
    let mx = moveX, mz = moveZ;
    const manual = Math.hypot(mx, mz) > 0.05;
    if (manual) {
      this.path = [];
      this.pathTarget = null;
      if (this.anim === 'fishWait' || this.anim === 'happy') this.stopAction();
    }
    if (!manual && this.path.length && !this.busy) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.18) {
        this.path.shift();
        if (!this.path.length && this.pathTarget) {
          const cb = this.pathTarget.onArrive;
          this.pathTarget = null;
          cb?.();
        }
      } else {
        mx = dx / d;
        mz = dz / d;
        if (d < 0.6 && this.path.length === 1) {
          mx *= Math.max(0.4, d / 0.6);
          mz *= Math.max(0.4, d / 0.6);
        }
      }
    }
    const mag = Math.min(1, Math.hypot(mx, mz));
    const canMove = !this.busy && !this.frozen;
    const sp = this.speed() * mag;
    const tvx = canMove && mag > 0.05 ? (mx / (mag || 1)) * sp : 0;
    const tvz = canMove && mag > 0.05 ? (mz / (mag || 1)) * sp : 0;
    this.vel.x = damp(this.vel.x, tvx, 14, dt);
    this.vel.z = damp(this.vel.z, tvz, 14, dt);
    if (this.lockFacing !== null) this.targetFacing = this.lockFacing;
    else if (canMove && mag > 0.05) this.targetFacing = Math.atan2(mx, mz);
    // integrate with axis-separated collision (slides along walls)
    const r = this.horse ? 0.4 : 0.26;
    const nx = this.pos.x + this.vel.x * dt;
    if (!this.world.isBlocked(nx, this.pos.z, r)) this.pos.x = nx;
    else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this.world.isBlocked(this.pos.x, nz, r)) this.pos.z = nz;
    else this.vel.z = 0;
    // stuck on path? give up gracefully
    if (this.path.length && Math.hypot(this.vel.x, this.vel.z) < 0.05 && !this.busy) {
      this.stuckT = (this.stuckT ?? 0) + dt;
      if (this.stuckT > 0.8) {
        this.path = [];
        this.pathTarget = null;
        this.stuckT = 0;
      }
    } else this.stuckT = 0;
    const ty = this.world.heightAt(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, ty, 18, dt);
    this.facing = angleLerp(this.facing, this.targetFacing, Math.min(1, dt * 12));
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    st.player.x = this.pos.x;
    st.player.z = this.pos.z;
    st.player.facing = this.facing;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.3;
    if (!this.busy && this.anim !== 'happy') this.anim = moving ? 'walk' : 'idle';
    this.animate(dt, moving);
    // footsteps & trail
    if (moving) {
      this.stepT -= dt * Math.hypot(this.vel.x, this.vel.z);
      if (this.stepT <= 0) {
        this.stepT = this.horse ? 1.6 : 1.1;
        this.ctx.bus.emit('step', { x: this.pos.x, z: this.pos.z, tile: this.world.tile(this.pos.x, this.pos.z), horse: !!this.horse });
        const tile = this.world.tile(this.pos.x, this.pos.z);
        if (tile === 1 || tile === 2 || tile === 12 || tile === 15) this.particles.dust(this.pos.x, this.pos.y, this.pos.z, tile === 2 ? 0xf4e0a8 : tile === 12 ? 0x7a6a64 : 0xd8c0a0, 2);
        if (tile === 6) this.particles.dust(this.pos.x, this.pos.y, this.pos.z, 0xffffff, 2);
      }
      const trail = TRAILS.find((t) => t.id === st.flags.trail);
      if (trail && trail.id !== 'none') {
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.12;
          const frame = { petals: 3, sparkles: 1, leaves: 2, bubbles: 12, snow: 9 }[trail.id as 'petals'] ?? 0;
          this.particles.emit({ x: this.pos.x + (Math.random() - 0.5) * 0.3, y: this.pos.y + 0.2, z: this.pos.z + (Math.random() - 0.5) * 0.3, vy: 0.4, life: 1.1, size: 0.16, size1: 0.05, color: trail.color, frame, additive: trail.id === 'sparkles', wobble: 0.5 });
        }
      }
    }
    if (this.lantern) this.lantern.intensity = 1.6 + Math.sin(performance.now() * 0.006) * 0.15;
    void night;
  }
  private stuckT = 0;

  private animate(dt: number, moving: boolean): void {
    const rig = this.rig;
    this.animT += dt;
    // blink
    this.blinkT -= dt;
    rig.eyes.scale.y = this.blinkT < 0.12 ? 0.15 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const reset = (k = 10) => {
      rig.armL.rotation.x = damp(rig.armL.rotation.x, 0, k, dt);
      rig.armR.rotation.x = damp(rig.armR.rotation.x, 0, k, dt);
      rig.armR.rotation.z = damp(rig.armR.rotation.z, 0, k, dt);
      rig.armL.rotation.z = damp(rig.armL.rotation.z, 0, k, dt);
      rig.legL.rotation.x = damp(rig.legL.rotation.x, 0, k, dt);
      rig.legR.rotation.x = damp(rig.legR.rotation.x, 0, k, dt);
      rig.body.rotation.x = damp(rig.body.rotation.x, 0, k, dt);
      rig.body.position.y = damp(rig.body.position.y, 0, k, dt);
      rig.head.rotation.x = damp(rig.head.rotation.x, 0, k, dt);
      rig.head.rotation.z = damp(rig.head.rotation.z, 0, k, dt);
    };
    switch (this.anim) {
      case 'walk': {
        this.walkT += dt * (4 + spd * 1.9);
        const s = Math.sin(this.walkT);
        if (this.horse) {
          reset();
          rig.legL.rotation.x = -0.9;
          rig.legR.rotation.x = -0.9;
          rig.body.position.y = Math.abs(s) * 0.12;
          this.horse.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.1;
          this.horse.head.rotation.x = Math.sin(this.walkT * 2) * 0.12;
          this.horse.tail.rotation.x = Math.sin(this.walkT) * 0.3;
        } else {
          rig.legL.rotation.x = s * 0.75;
          rig.legR.rotation.x = -s * 0.75;
          rig.armL.rotation.x = -s * 0.65;
          rig.armR.rotation.x = s * 0.65;
          rig.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.06;
          rig.body.rotation.x = 0.06 + spd * 0.01;
          rig.head.rotation.z = Math.sin(this.walkT) * 0.05;
        }
        break;
      }
      case 'idle': {
        reset(8);
        const b = Math.sin(this.animT * 2.2);
        rig.body.position.y = b * 0.012;
        rig.head.rotation.z = Math.sin(this.animT * 0.7) * 0.04;
        rig.head.rotation.x = Math.sin(this.animT * 0.5) * 0.03;
        if (this.horse) {
          rig.legL.rotation.x = -0.9;
          rig.legR.rotation.x = -0.9;
          this.horse.head.rotation.x = Math.sin(this.animT * 0.8) * 0.1;
        }
        break;
      }
      case 'tool': {
        const t = Math.min(1, this.animT / this.animDur);
        // wind up then strike
        const up = t < this.impactAt ? t / this.impactAt : 1 - (t - this.impactAt) / (1 - this.impactAt);
        rig.armR.rotation.x = -2.6 * up + (t > this.impactAt ? 0.4 * (1 - up) : 0);
        rig.armL.rotation.x = -1.2 * up;
        rig.body.rotation.x = -0.15 * up + (t > this.impactAt ? 0.25 * (1 - up) : 0);
        rig.head.rotation.x = t > this.impactAt ? 0.15 : -0.1;
        if (!this.impactDone && t >= this.impactAt) {
          this.impactDone = true;
          this.onImpact?.();
        }
        if (t >= 1) this.stopAction();
        break;
      }
      case 'pet': {
        const t = this.animT / this.animDur;
        rig.armR.rotation.x = -1.3 + Math.sin(this.animT * 18) * 0.2;
        rig.armL.rotation.x = -1.0;
        rig.body.rotation.x = 0.35;
        rig.head.rotation.x = 0.2;
        if (!this.impactDone && t >= 0.3) {
          this.impactDone = true;
          this.onImpact?.();
        }
        if (t >= 1) this.stopAction();
        break;
      }
      case 'eat': {
        const t = this.animT / this.animDur;
        rig.armR.rotation.x = -1.9 + Math.sin(this.animT * 14) * 0.15;
        rig.head.rotation.x = -0.1 + Math.sin(this.animT * 14) * 0.05;
        if (!this.impactDone && t >= 0.5) {
          this.impactDone = true;
          this.onImpact?.();
        }
        if (t >= 1) this.stopAction();
        break;
      }
      case 'happy': {
        const t = this.animT / 0.9;
        rig.body.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.25;
        rig.armL.rotation.z = -2.4;
        rig.armR.rotation.z = 2.4;
        if (t >= 1) {
          this.anim = 'idle';
          rig.armL.rotation.z = 0;
          rig.armR.rotation.z = 0;
        }
        break;
      }
      case 'fishCast': {
        const t = Math.min(1, this.animT / this.animDur);
        rig.armR.rotation.x = t < 0.5 ? -2.8 * (t / 0.5) : -2.8 + 3.4 * ((t - 0.5) / 0.5);
        rig.armL.rotation.x = -0.6;
        if (!this.impactDone && t >= 0.75) {
          this.impactDone = true;
          this.onImpact?.();
        }
        if (t >= 1) {
          this.anim = 'fishWait';
          this.animT = 0;
        }
        break;
      }
      case 'fishWait':
        rig.armR.rotation.x = -0.75 + Math.sin(this.animT * 2) * 0.03;
        rig.armL.rotation.x = -0.6;
        rig.body.position.y = Math.sin(this.animT * 2) * 0.01;
        break;
      case 'fishReel':
        rig.armR.rotation.x = -1.2 + Math.sin(this.animT * 22) * 0.12;
        rig.armL.rotation.x = -0.9 + Math.cos(this.animT * 22) * 0.12;
        rig.body.rotation.x = -0.15;
        break;
      case 'sleep':
        rig.body.rotation.x = clamp(rig.body.rotation.x - dt * 2, -1.4, 0);
        break;
    }
    if (this.horse && !moving && this.anim === 'idle') this.horse.body.position.y = damp(this.horse.body.position.y, 0, 8, dt);
  }

  celebrate(): void {
    if (this.busy) return;
    this.anim = 'happy';
    this.animT = 0;
  }
}
