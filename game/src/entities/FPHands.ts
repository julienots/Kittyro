import * as THREE from 'three';
import type { Appearance } from '../state/types';
import type { Player } from './Player';
import { buildToolMesh } from '../models/Character';
import { SKIN_TONES } from '../data/wardrobe';
import { damp } from '../core/MathUtil';

/**
 * First-person arms: two sleeves + hands hanging at the bottom of the view.
 * They swing while walking, lag behind when you turn (dangling feel), breathe
 * when idle, and play the tool / pick-up gestures of the avatar. Drawn on top
 * of the world so they never clip into walls.
 */
export class FPHands {
  readonly group = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private handR = new THREE.Group();
  private tool: THREE.Object3D | null = null;
  private toolKey = '';
  private t = 0;
  private sway = new THREE.Vector2();
  private lookKey = '';

  constructor() {
    this.group.add(this.armL, this.armR);
    this.group.visible = false;
  }

  private mat(color: number): THREE.Material {
    const m = new THREE.MeshToonMaterial({ color, depthTest: false, depthWrite: false });
    return m;
  }

  /** (Re)build the arms with the avatar's skin tone and top colour. */
  build(look: Appearance): void {
    const key = `${look.skin}:${look.topColor}:${look.top}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    for (const arm of [this.armL, this.armR]) arm.clear();
    const skin = this.mat(SKIN_TONES[look.skin] ?? SKIN_TONES[1]);
    const sleeveColor = look.top === 'overalls' ? 0xfff4e0 : look.topColor;
    const sleeve = this.mat(sleeveColor);
    const cuff = this.mat(new THREE.Color(sleeveColor).multiplyScalar(0.8).getHex());
    const make = (side: number, arm: THREE.Group) => {
      // sleeve along -Z (towards the view), hand at its end
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.42, 10).rotateX(Math.PI / 2), sleeve);
      s.position.set(0, 0, -0.16);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.035, 10).rotateX(Math.PI / 2), cuff);
      c.position.set(0, 0, -0.37);
      const hand = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), skin);
      palm.scale.set(1, 0.75, 1.2);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.04, 3, 6), skin);
      thumb.position.set(side * -0.045, 0.02, -0.02);
      thumb.rotation.set(0.6, 0, side * 0.8);
      const fingers = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
      fingers.scale.set(1.05, 0.55, 0.9);
      fingers.position.set(0, -0.012, -0.055);
      hand.add(palm, thumb, fingers);
      hand.position.set(0, 0, -0.43);
      arm.add(s, c, hand);
      for (const m of [s, c, palm, thumb, fingers]) m.renderOrder = 999;
      return hand;
    };
    make(-1, this.armL);
    const hr = make(1, this.armR);
    this.handR = hr;
    this.tool = null;
    this.toolKey = '';
  }

  private setTool(key: string, tier: number): void {
    if (key === this.toolKey) return;
    if (this.tool) this.handR.remove(this.tool);
    this.tool = null;
    this.toolKey = key;
    const tool = key.split(':')[0];
    if (!tool) return;
    const m = buildToolMesh(tool, tier);
    const mat = (m.material as THREE.Material).clone();
    mat.depthTest = false;
    mat.depthWrite = false;
    m.material = mat;
    m.renderOrder = 1000;
    m.scale.setScalar(0.75);
    m.rotation.set(-0.35, 0, 0);
    m.position.set(0, 0.02, -0.02);
    this.tool = m;
    this.handR.add(m);
  }

  update(dt: number, p: Player, opts: { visible: boolean; turnSpeed: number; bob: number; tier: (tool: string) => number }): void {
    this.group.visible = opts.visible;
    if (!opts.visible) return;
    this.t += dt;
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const moving = speed > 0.3;
    // the arms lag behind head turns, like dangling hands
    this.sway.x = damp(this.sway.x, THREE.MathUtils.clamp(-opts.turnSpeed * 0.035, -0.12, 0.12), 6, dt);
    this.sway.y = damp(this.sway.y, opts.bob * 1.2, 10, dt);
    const tool = p.toolKey ? p.toolKey.split(':')[0] : '';
    this.setTool(p.toolKey, tool ? opts.tier(tool) : 0);
    // resting pose: low at the bottom corners of the view
    const restY = -0.47, restZ = -0.1;
    let lx = -0.24, ly = restY, lrx = 0.55, lry = 0.16;
    let rx = 0.24, ry = restY, rrx = 0.55, rry = -0.16, rrz = 0;
    const walkSwing = moving ? Math.sin(this.t * Math.min(speed, 6) * 1.9) * 0.22 : 0;
    const breathe = Math.sin(this.t * 1.6) * 0.012;
    lrx += walkSwing;
    rrx -= walkSwing;
    ly += breathe + (moving ? Math.abs(walkSwing) * -0.05 : 0);
    ry += breathe;
    const k = p.animDur > 0 ? Math.min(1, p.animT / p.animDur) : 1;
    switch (p.anim) {
      case 'tool': {
        // wind up, then strike down (axe/pickaxe/hoe) — the can is tilted instead
        if (tool === 'can') { rrx = 0.5; rrz = -0.9 * Math.sin(k * Math.PI); ry = -0.42; rx = 0.2; }
        else if (tool === 'rod') { rrx = -0.3 + k * 1.2; ry = -0.42; }
        else {
          const swing = k < 0.45 ? -1.3 * (k / 0.45) : -1.3 + 2.0 * Math.min(1, (k - 0.45) / 0.25);
          rrx = 0.55 + swing;
          ry = restY + 0.06 + (k < 0.45 ? k * 0.15 : 0);
          rx = 0.18;
        }
        break;
      }
      case 'fishCast': rrx = -0.6 + k * 1.4; ry = -0.42; break;
      case 'fishWait': case 'fishReel': rrx = 0.45 + Math.sin(this.t * 14) * (p.anim === 'fishReel' ? 0.08 : 0.01); ry = -0.42; rx = 0.2; break;
      case 'pet': case 'eat': {
        // both hands reach forward (pick up, pet, eat)
        const reach = Math.sin(k * Math.PI);
        lrx = 0.55 - reach * 0.6; rrx = 0.55 - reach * 0.6;
        lx = -0.22 + reach * 0.08; rx = 0.22 - reach * 0.08;
        ly = restY + reach * 0.1; ry = restY + reach * 0.1;
        if (p.anim === 'eat') { rrx = 0.55 + 0.6 * reach; ry = restY + reach * 0.2; rx = 0.14; }
        break;
      }
      case 'happy': {
        const w = Math.sin(this.t * 10) * 0.3;
        lrx = 1.3 + w; rrx = 1.3 - w; ly = -0.36; ry = -0.36;
        break;
      }
    }
    const a = this.armL, b = this.armR;
    a.position.set(damp(a.position.x, lx + this.sway.x, 12, dt), damp(a.position.y, ly + this.sway.y, 12, dt), restZ);
    b.position.set(damp(b.position.x, rx + this.sway.x, 12, dt), damp(b.position.y, ry + this.sway.y, 12, dt), restZ);
    a.rotation.x = damp(a.rotation.x, lrx, 14, dt);
    a.rotation.y = damp(a.rotation.y, lry + this.sway.x * 1.5, 10, dt);
    b.rotation.x = damp(b.rotation.x, rrx, p.anim === 'tool' ? 30 : 14, dt);
    b.rotation.y = damp(b.rotation.y, rry + this.sway.x * 1.5, 10, dt);
    b.rotation.z = damp(b.rotation.z, rrz, 12, dt);
  }
}
