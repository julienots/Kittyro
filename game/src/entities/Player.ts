import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from '../world/World';
import type { Particles } from '../render/Particles';
import { buildCharacter, buildToolMesh, type CharacterRig } from '../models/Character';
import { buildAnimal, type AnimalRig } from '../models/Animals';
import { angleLerp, clamp, damp } from '../core/MathUtil';
import { TRAILS } from '../data/shop';
import { ANIMAL_BY_ID } from '../data/animals';
import { applyEmote } from './Emotes';

export type PlayerAnim = 'idle' | 'walk' | 'tool' | 'fishCast' | 'fishWait' | 'fishReel' | 'happy' | 'pet' | 'sleep' | 'eat' | 'emote';

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
  emoteId = '';
  /** held Shift / sprint button: run faster */
  sprint = false;
  /** height above the ground while jumping */
  airY = 0;
  private jumpV = 0;
  private landT = 1;
  private airborne = false;
  /** in water: swimming (slower, no tools) */
  swimming = false;
  private swimT = 0;
  private rippleT = 0;
  private idleT = 0;
  private idleVariant = -1;
  private lean = 0;
  private turnRate = 0;
  private stretchY = 1;
  /** character height option (root scale set by buildCharacter) */
  private rigScale = 1;
  /** fired when a jump lands (camera dip, sound) */
  onLand: ((strength: number) => void) | null = null;
  onSplash: (() => void) | null = null;

  constructor(private ctx: Ctx, private world: World, private particles: Particles) {
    this.rebuild();
  }

  rebuild(): void {
    const old = this.rig;
    if (old) this.root.remove(old.root);
    this.rig = buildCharacter(this.ctx.state.player.look, { outline: this.outline, player: true });
    this.rigScale = this.rig.root.scale.x;
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
      this.rig.root.position.y = 0.82;
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
    let s = 3.6;
    if (this.horse) s *= 1.85;
    if (this.sprint && !this.swimming) s *= this.horse ? 1.3 : 1.65;
    if (this.swimming) s *= 0.55;
    if (this.ctx.hasBuff('speed')) s *= 1.35;
    if (this.world.region === 'house') s *= 0.85;
    return s;
  }

  get running(): boolean {
    return this.sprint && Math.hypot(this.vel.x, this.vel.z) > 4.2;
  }

  /** Hop! Leaps over narrow streams; a second press mid-air does nothing. */
  jump(): boolean {
    if (this.airborne || this.busy || this.frozen || this.swimming) return false;
    this.jumpV = this.horse ? 6.2 : 5.4;
    this.airborne = true;
    this.stretchY = 1.18;
    this.idleT = 0;
    if (this.anim === 'emote' || this.anim === 'happy' || this.anim === 'fishWait') this.stopAction();
    this.particles.dust(this.pos.x, this.pos.y, this.pos.z, 0xe8dcc0, 3);
    return true;
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
      if (this.anim === 'fishWait' || this.anim === 'happy' || this.anim === 'emote') this.stopAction();
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
    // without the horse you may swim; mid-jump you clear water and low edges
    const pass = { swim: !this.horse, air: this.airY > 0.3 };
    const nx = this.pos.x + this.vel.x * dt;
    if (!this.world.isBlocked(nx, this.pos.z, r, pass)) this.pos.x = nx;
    else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this.world.isBlocked(this.pos.x, nz, r, pass)) this.pos.z = nz;
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
    // water: swim when the ground under us is a lake / river (not a bridge)
    const wasSwimming = this.swimming;
    const inWater = !this.horse && this.world.isSwimTile(this.pos.x, this.pos.z);
    let ty = this.world.heightAt(this.pos.x, this.pos.z);
    if (inWater) ty = Math.max(ty, this.world.layout.waterLevel - 0.62);
    // jump physics
    if (this.airborne) {
      this.jumpV -= 17 * dt;
      this.airY += this.jumpV * dt;
      if (this.airY <= 0) {
        const strength = Math.min(1, -this.jumpV / 6);
        this.airY = 0;
        this.jumpV = 0;
        this.airborne = false;
        this.landT = 0;
        if (!inWater) this.particles.dust(this.pos.x, ty, this.pos.z, 0xe0d4b8, 4);
        this.onLand?.(strength);
      }
    }
    this.swimming = inWater && !this.airborne;
    if (this.swimming && !wasSwimming) {
      this.onSplash?.();
      this.splash(8);
      if (this.busy) this.stopAction();
    }
    this.pos.y = damp(this.pos.y, ty, this.swimming ? 6 : 18, dt);
    const prevFacing = this.facing;
    this.facing = angleLerp(this.facing, this.targetFacing, Math.min(1, dt * (this.running ? 9 : 12)));
    let df = this.facing - prevFacing;
    if (df > Math.PI) df -= Math.PI * 2;
    if (df < -Math.PI) df += Math.PI * 2;
    this.turnRate = damp(this.turnRate, df / Math.max(dt, 1e-3), 10, dt);
    this.root.position.copy(this.pos);
    this.root.position.y += this.airY + (this.swimming ? Math.sin(this.animT * 2.4) * 0.04 : 0);
    this.root.rotation.y = this.facing;
    st.player.x = this.pos.x;
    st.player.z = this.pos.z;
    st.player.facing = this.facing;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.3;
    if (!this.busy && this.anim !== 'happy' && this.anim !== 'emote') this.anim = moving ? 'walk' : 'idle';
    this.animate(dt, moving);
    this.secondary(dt, moving);
    if (this.swimming) {
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.rippleT = moving ? 0.18 : 0.6;
        this.particles.emit({ x: this.pos.x, y: this.world.layout.waterLevel + 0.03, z: this.pos.z, life: 1.1, size: 0.4, size1: 1.3, color: 0xffffff, alpha: 0.55, frame: 11, rot: 0 });
      }
    }
    // footsteps & trail
    if (moving && !this.airborne && !this.swimming) {
      this.stepT -= dt * Math.hypot(this.vel.x, this.vel.z);
      if (this.stepT <= 0) {
        this.stepT = this.horse ? 1.6 : this.running ? 1.5 : 1.1;
        if (this.running && !this.horse) this.particles.dust(this.pos.x - Math.sin(this.facing) * 0.2, this.pos.y, this.pos.z - Math.cos(this.facing) * 0.2, 0xe8dcc0, 2);
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

  private splash(n: number): void {
    this.particles.splash(this.pos.x, this.world.layout.waterLevel + 0.05, this.pos.z, n);
  }

  /** Squash & stretch, banking into turns, idle fidgets, head following the action. */
  private secondary(dt: number, moving: boolean): void {
    const rig = this.rig;
    // stretch while rising, squash on landing, settle back with a little wobble
    this.landT = Math.min(1, this.landT + dt * 3.2);
    let sy = 1;
    if (this.airborne) sy = 1 + Math.max(-0.08, Math.min(0.14, this.jumpV * 0.025));
    else if (this.landT < 1) sy = 1 - Math.sin(this.landT * Math.PI) * 0.16 * (1 - this.landT * 0.5);
    this.stretchY = damp(this.stretchY, sy, 22, dt);
    const sxz = 1 / Math.sqrt(Math.max(0.6, this.stretchY));
    const k0 = this.rigScale;
    rig.root.scale.set(sxz * k0, this.stretchY * k0, sxz * k0);
    // bank into turns and lean forward when sprinting
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const bank = moving ? Math.max(-0.22, Math.min(0.22, -this.turnRate * 0.035 * Math.min(1, spd / 4))) : 0;
    this.lean = damp(this.lean, bank, 8, dt);
    rig.root.rotation.z = this.horse ? this.lean * 0.4 : this.lean;
    if (this.horse) this.horse.root.rotation.z = this.lean * 0.5;
    if (this.airborne && !this.horse && !this.busy) {
      // arms up, knees tucked in the air
      rig.armL.rotation.z = damp(rig.armL.rotation.z, -0.9, 14, dt);
      rig.armR.rotation.z = damp(rig.armR.rotation.z, 0.9, 14, dt);
      rig.armL.rotation.x = damp(rig.armL.rotation.x, -0.5, 14, dt);
      rig.armR.rotation.x = damp(rig.armR.rotation.x, -0.5, 14, dt);
      rig.legL.rotation.x = damp(rig.legL.rotation.x, this.jumpV > 0 ? -0.7 : 0.2, 12, dt);
      rig.legR.rotation.x = damp(rig.legR.rotation.x, this.jumpV > 0 ? 0.35 : -0.2, 12, dt);
    } else if (!this.airborne && this.anim !== 'happy' && this.anim !== 'emote') {
      rig.armL.rotation.z = damp(rig.armL.rotation.z, 0, 10, dt);
      rig.armR.rotation.z = damp(rig.armR.rotation.z, 0, 10, dt);
    }
    // the blob shadow stays on the ground and shrinks while airborne
    if (rig.shadow) {
      rig.shadow.position.y = -this.airY / Math.max(0.6, this.stretchY * k0) + 0.02;
      const k = Math.max(0.45, 1 - this.airY * 0.5);
      rig.shadow.scale.set(k, 1, k);
      rig.shadow.visible = !this.swimming;
    }
  }

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
      rig.body.rotation.y = damp(rig.body.rotation.y, 0, k, dt);
      rig.head.rotation.y = damp(rig.head.rotation.y, 0, k, dt);
    };
    if (this.anim !== 'idle') {
      this.idleT = 0;
      this.idleVariant = -1;
      rig.body.scale.set(1, 1, 1);
    }
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
        } else if (this.swimming) {
          // breaststroke: arms sweep, legs kick, head stays above the water
          const c = Math.sin(this.walkT * 0.7);
          rig.armL.rotation.x = damp(rig.armL.rotation.x, -2.2 + c * 0.6, 10, dt);
          rig.armR.rotation.x = damp(rig.armR.rotation.x, -2.2 + c * 0.6, 10, dt);
          rig.armL.rotation.z = -0.6 - c * 0.5;
          rig.armR.rotation.z = 0.6 + c * 0.5;
          rig.legL.rotation.x = Math.sin(this.walkT * 1.4) * 0.5 + 0.4;
          rig.legR.rotation.x = -Math.sin(this.walkT * 1.4) * 0.5 + 0.4;
          rig.body.rotation.x = damp(rig.body.rotation.x, 0.55, 6, dt);
          rig.head.rotation.x = damp(rig.head.rotation.x, -0.45, 6, dt);
          rig.body.position.y = c * 0.03;
        } else {
          // walk -> run blend: bigger strides, pumping arms, forward lean, more bounce
          const run = Math.min(1, Math.max(0, (spd - 3.8) / 2.2));
          const legA = 0.75 + run * 0.35, armA = 0.65 + run * 0.45;
          rig.legL.rotation.x = s * legA;
          rig.legR.rotation.x = -s * legA;
          rig.armL.rotation.x = -s * armA - run * 0.35;
          rig.armR.rotation.x = s * armA - run * 0.35;
          rig.armL.rotation.z = -run * 0.25;
          rig.armR.rotation.z = run * 0.25;
          rig.body.position.y = Math.abs(Math.cos(this.walkT)) * (0.06 + run * 0.07);
          rig.body.rotation.x = 0.06 + spd * 0.01 + run * 0.2;
          rig.body.rotation.y = Math.sin(this.walkT) * (0.06 + run * 0.08);
          rig.head.rotation.z = Math.sin(this.walkT) * 0.05;
          rig.head.rotation.x = -run * 0.12;
          rig.head.rotation.y = -Math.sin(this.walkT) * (0.05 + run * 0.06);
        }
        break;
      }
      case 'idle': {
        reset(8);
        if (this.swimming) {
          // treading water
          const c = this.animT * 3;
          rig.armL.rotation.x = -0.9 + Math.sin(c) * 0.3;
          rig.armR.rotation.x = -0.9 - Math.sin(c) * 0.3;
          rig.armL.rotation.z = -0.7 + Math.cos(c) * 0.25;
          rig.armR.rotation.z = 0.7 - Math.cos(c) * 0.25;
          rig.legL.rotation.x = Math.sin(c * 1.2) * 0.4;
          rig.legR.rotation.x = -Math.sin(c * 1.2) * 0.4;
          break;
        }
        // breathing
        const b = Math.sin(this.animT * 2.2);
        rig.body.position.y = b * 0.012;
        rig.body.scale.set(1 + b * 0.008, 1 - b * 0.004, 1 + b * 0.008);
        rig.head.rotation.z = Math.sin(this.animT * 0.7) * 0.04;
        rig.head.rotation.x = Math.sin(this.animT * 0.5) * 0.03;
        // after a while standing still: look around, stretch, tap a foot
        this.idleT += dt;
        if (this.idleT > 7 && this.idleVariant < 0 && !this.horse) {
          this.idleVariant = Math.floor(Math.random() * 3);
          this.idleT = 0;
        }
        if (this.idleVariant >= 0) {
          const t = this.idleT;
          const env = Math.sin(Math.min(1, t / 2.6) * Math.PI);
          if (this.idleVariant === 0) {
            rig.head.rotation.y = Math.sin(t * 1.6) * 0.75 * env;
            rig.body.rotation.y = Math.sin(t * 1.6) * 0.15 * env;
          } else if (this.idleVariant === 1) {
            rig.armL.rotation.z = -2.6 * env;
            rig.armR.rotation.z = 2.6 * env;
            rig.body.rotation.x = -0.12 * env;
            rig.head.rotation.x = -0.25 * env;
          } else {
            rig.legR.rotation.x = -Math.abs(Math.sin(t * 9)) * 0.3 * env;
            rig.head.rotation.z = Math.sin(t * 4.5) * 0.08 * env;
          }
          if (t > 2.6) {
            this.idleVariant = -1;
            this.idleT = 0;
          }
        }
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
      case 'emote':
        if (!applyEmote(rig, this.emoteId, this.animT)) { this.anim = 'idle'; this.emoteId = ''; }
        break;
    }
    if (this.horse && !moving && this.anim === 'idle') this.horse.body.position.y = damp(this.horse.body.position.y, 0, 8, dt);
  }

  /** Play an emote (interrupted by walking). */
  emote(id: string): void {
    if (this.busy) return;
    this.path = [];
    this.pathTarget = null;
    this.showTool(null);
    this.anim = 'emote';
    this.emoteId = id;
    this.animT = 0;
  }

  celebrate(): void {
    if (this.busy) return;
    this.anim = 'happy';
    this.animT = 0;
  }
}
