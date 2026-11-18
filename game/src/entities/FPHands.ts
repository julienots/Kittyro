import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Appearance } from '../state/types';
import type { Player } from './Player';
import { fpToolMesh } from '../models/FPTools';
import { LONG_SLEEVE_TOPS as LONG_SLEEVES } from '../models/Character';
import { SKIN_TONES } from '../data/wardrobe';
import { damp } from '../core/MathUtil';
import { toonGradient, outlineMat } from '../render/Materials';

/**
 * First-person arms, rendered in their own pass (own scene, camera and depth) so
 * they are always crisp and never clip into walls or trees.
 *
 * Each hand has a rounded palm, four 3-joint fingers and a 2-joint thumb that
 * curl around tool handles or relax and twitch softly when empty. The arms bob
 * with every step, lag behind head turns, breathe when idle, and play
 * anticipation → strike → follow-through for every tool, plus reach/grab, eat,
 * cast/reel and cheer gestures. Switching tools lowers and raises the hand.
 */

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

interface Finger {
  joints: THREE.Group[];
  curl: number; // current 0..1
  phase: number;
}

class Hand {
  readonly wrist = new THREE.Group();
  readonly grip = new THREE.Group();
  fingers: Finger[] = [];
  thumb: THREE.Group[] = [];
  thumbCurl = 0;

  constructor(private side: 1 | -1, skin: THREE.Material, nail: THREE.Material) {
    const outline = (m: THREE.Mesh, k = 1.12) => {
      const o = new THREE.Mesh(m.geometry, outlineMat);
      o.scale.setScalar(k);
      o.renderOrder = -1;
      m.add(o);
    };
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.074, 0.03, 0.082, 3, 0.013), skin);
    palm.position.set(0, 0, -0.042);
    outline(palm, 1.05);
    // a little volume on the back of the hand and at the base of the thumb
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), skin);
    heel.scale.set(1.1, 0.75, 1.3);
    heel.position.set(-side * 0.022, -0.006, -0.018);
    this.wrist.add(palm, heel);
    const xs = [-0.026, -0.009, 0.008, 0.025].map((x) => x * side);
    const lens = [1, 1.1, 1.02, 0.8];
    xs.forEach((x, i) => {
      const f: Finger = { joints: [], curl: 0.2, phase: i * 0.7 };
      let parent: THREE.Object3D = this.wrist;
      const segs = [0.03, 0.022, 0.018].map((l) => l * lens[i]);
      const rads = [0.0105, 0.0097, 0.0088].map((r) => r * (i === 3 ? 0.86 : 1));
      segs.forEach((len, s) => {
        const j = new THREE.Group();
        if (s === 0) j.position.set(x, 0.002, -0.084);
        else j.position.set(0, 0, -segs[s - 1]);
        const bone = new THREE.Mesh(new THREE.CapsuleGeometry(rads[s], len, 4, 10).rotateX(Math.PI / 2), skin);
        bone.position.z = -len / 2;
        outline(bone, 1.09);
        j.add(bone);
        if (s === 2) {
          const n = new THREE.Mesh(new THREE.SphereGeometry(rads[s] * 0.8, 8, 6), nail);
          n.scale.set(1, 0.35, 1.2);
          n.position.set(0, rads[s] * 0.75, -len * 0.75);
          j.add(n);
        }
        parent.add(j);
        f.joints.push(j);
        parent = j;
      });
      this.fingers.push(f);
    });
    // thumb: angled out from the inner side of the palm
    let parent: THREE.Object3D = this.wrist;
    [0.03, 0.026].forEach((len, s) => {
      const j = new THREE.Group();
      if (s === 0) {
        j.position.set(-side * 0.036, -0.006, -0.03);
        j.rotation.set(-0.15, side * 0.75, side * -0.4);
      } else j.position.set(0, 0, -0.03);
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125 - s * 0.0015, len, 4, 10).rotateX(Math.PI / 2), skin);
      bone.position.z = -len / 2;
      outline(bone, 1.09);
      j.add(bone);
      if (s === 1) {
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), nail);
        n.scale.set(1, 0.35, 1.2);
        n.position.set(0, 0.009, -len * 0.75);
        j.add(n);
      }
      parent.add(j);
      this.thumb.push(j);
      parent = j;
    });
    // where a handle sits inside the closed fist
    this.grip.position.set(0, -0.026, -0.064);
    this.grip.rotation.z = (side * Math.PI) / 2;
    this.wrist.add(this.grip);
  }

  /** Curl fingers toward `target` (0 open … 1 fist) with a soft wave across the fingers. */
  pose(dt: number, target: number, thumbTarget: number, t: number, twitch: number): void {
    for (const f of this.fingers) {
      const wobble = Math.sin(t * 1.3 + f.phase) * 0.06 * twitch;
      f.curl = damp(f.curl, target + wobble, 9 - f.phase * 1.2, dt);
      const c = f.curl;
      f.joints[0].rotation.x = -(0.15 + c * 1.35);
      f.joints[1].rotation.x = -(0.2 + c * 1.55);
      f.joints[2].rotation.x = -(0.12 + c * 1.05);
    }
    this.thumbCurl = damp(this.thumbCurl, thumbTarget, 10, dt);
    const k = this.thumbCurl;
    this.thumb[0].rotation.x = -0.15 - k * 0.55;
    this.thumb[0].rotation.y = this.side * (0.75 - k * 0.65);
    this.thumb[1].rotation.x = -0.2 - k * 0.9;
  }
}

interface Arm {
  root: THREE.Group; // elbow-ish pivot below the view
  hand: Hand;
  forearm: THREE.Group;
}

export class FPHands {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.01, 8);
  private group = new THREE.Group();
  private hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 1.2);
  private amb = new THREE.AmbientLight(0xffffff, 0.25);
  private arms: Arm[] = [];
  private tool: THREE.Object3D | null = null;
  private toolKey = '';
  private pendingTool = '';
  private swapT = 1;
  private t = 0;
  private walkPhase = 0;
  private sway = new THREE.Vector3();
  private lookKey = '';
  private lastPitch = 0;
  visible = false;

  constructor() {
    this.scene.add(this.group, this.hemi, this.sun, this.amb);
    this.sun.position.set(-0.6, 1, 0.4);
  }

  private mat(color: number): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  }

  /** (Re)build the arms with the avatar's skin tone and sleeves. */
  build(look: Appearance): void {
    const key = `${look.skin}:${look.topColor}:${look.top}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.group.clear();
    this.arms = [];
    const skinCol = SKIN_TONES[look.skin] ?? SKIN_TONES[1];
    const skin = this.mat(skinCol);
    const nail = this.mat(new THREE.Color(skinCol).lerp(new THREE.Color(0xffe8e8), 0.55).getHex());
    const long = LONG_SLEEVES.has(look.top);
    const sleeveCol = look.top === 'overalls' || look.top === 'vest' || look.top === 'apron' ? 0xfff4e6 : look.topColor;
    const sleeve = this.mat(sleeveCol);
    const cuff = this.mat(new THREE.Color(sleeveCol).multiplyScalar(0.82).getHex());
    for (const side of [-1, 1] as const) {
      const root = new THREE.Group();
      const forearm = new THREE.Group();
      // forearm runs from the root toward -Z; the wrist sits at its end
      const fa = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.36, 14).rotateX(Math.PI / 2), long ? sleeve : skin);
      fa.position.z = -0.18;
      const o = new THREE.Mesh(fa.geometry, outlineMat);
      o.scale.set(1.07, 1.07, 1.005);
      fa.add(o);
      forearm.add(fa);
      if (long) {
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 18), cuff);
        c.position.z = -0.345;
        forearm.add(c);
      } else {
        // short sleeve just entering the view
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 14).rotateX(Math.PI / 2), sleeve);
        sl.position.z = 0.02;
        forearm.add(sl);
      }
      const hand = new Hand(side, skin, nail);
      hand.wrist.position.z = -0.36;
      forearm.add(hand.wrist);
      root.add(forearm);
      this.group.add(root);
      this.arms.push({ root, hand, forearm });
    }
    this.tool = null;
    this.toolKey = '';
  }

  private setTool(key: string, tool: string, tier: number): void {
    if (key === this.toolKey) return;
    // lower the hand, swap, raise it again
    if (this.swapT >= 1 && this.toolKey !== '') {
      this.pendingTool = key;
      this.swapT = 0;
    }
    const swap = () => {
      const hand = this.arms[1]?.hand;
      if (!hand) return;
      if (this.tool) hand.grip.remove(this.tool);
      this.tool = null;
      this.toolKey = key;
      if (!tool) return;
      const m = fpToolMesh(tool, tier);
      m.scale.setScalar(tool === 'can' ? 0.62 : tool === 'rod' ? 0.8 : 0.78);
      // working edge points forward, angled toward the aiming dot (what you are about to hit)
      m.rotation.y = ({ axe: 0.5, pickaxe: 0.45, hoe: 0.35, sickle: 0.95, can: 0.35, net: 0.3 } as Record<string, number>)[tool] ?? 0;
      this.tool = m;
      hand.grip.add(m);
    };
    if (this.toolKey === '' || this.swapT >= 0.5) swap();
  }

  /** Where the rod tip is drawn on screen, expressed as a world point in front of the main camera. */
  rodTip(main: THREE.Camera, out: THREE.Vector3): boolean {
    if (!this.visible || !this.tool || !this.toolKey.startsWith('rod')) return false;
    const local = new THREE.Vector3(0, 0.1 + Math.cos(0.55) * 0.95, -Math.sin(0.55) * 0.95);
    this.group.updateMatrixWorld(true);
    const p = local.applyMatrix4(this.tool.matrixWorld);
    this.camera.updateMatrixWorld();
    const ndc = p.clone().project(this.camera);
    const camPos = new THREE.Vector3().setFromMatrixPosition(main.matrixWorld);
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(main).sub(camPos).normalize();
    out.copy(camPos).addScaledVector(dir, 1.1);
    return true;
  }

  setAspect(a: number): void {
    if (Math.abs(this.camera.aspect - a) > 1e-3) {
      this.camera.aspect = a;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Match the hands' lighting to the world's sun & sky. */
  light(sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, night: number): void {
    this.sun.color.copy(sun.color);
    this.sun.intensity = sun.intensity * 0.95;
    this.hemi.color.copy(hemi.color);
    this.hemi.groundColor.copy(hemi.groundColor);
    this.hemi.intensity = hemi.intensity;
    this.amb.intensity = 0.25 + night * 0.25;
  }

  update(dt: number, p: Player, o: { visible: boolean; turnSpeed: number; pitch: number; tool: string; tier: number }): void {
    this.visible = o.visible;
    if (!o.visible || this.arms.length < 2) return;
    this.t += dt;
    const t = this.t;
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const moving = speed > 0.3;
    const walk = Math.min(1, speed / 3.6);
    this.walkPhase += dt * Math.min(speed, 7) * 1.85;
    const ph = this.walkPhase;
    // equipped tool lives in the right hand (except while fishing it's the rod)
    const anim = p.anim;
    const tool = anim.startsWith('fish') ? 'rod' : o.tool;
    this.setTool(tool ? `${tool}:${o.tier}` : '', tool, o.tier);
    if (this.swapT < 1) {
      this.swapT = Math.min(1, this.swapT + dt / 0.45);
      if (this.swapT >= 0.5 && this.pendingTool !== this.toolKey) {
        const k = this.pendingTool;
        this.toolKey = '__';
        this.setTool(k, k.split(':')[0], +(k.split(':')[1] ?? 0));
      }
    }
    const swapDip = Math.sin(this.swapT * Math.PI) * 0.18;
    // view sway: arms trail behind head turns and pitch changes
    const pitchSpeed = (o.pitch - this.lastPitch) / Math.max(dt, 1e-3);
    this.lastPitch = o.pitch;
    this.sway.x = damp(this.sway.x, THREE.MathUtils.clamp(-o.turnSpeed * 0.018, -0.07, 0.07), 7, dt);
    this.sway.y = damp(this.sway.y, THREE.MathUtils.clamp(-pitchSpeed * 0.02, -0.05, 0.05), 7, dt);
    // step bob (figure-eight), breathing
    const bobY = moving ? -Math.abs(Math.sin(ph)) * 0.022 * walk : Math.sin(t * 1.7) * 0.005;
    const bobX = moving ? Math.sin(ph) * 0.014 * walk : 0;
    this.group.position.set(this.sway.x + bobX, this.sway.y + bobY - swapDip, 0);
    this.group.rotation.set(this.sway.y * 1.5, this.sway.x * 2, -this.sway.x * 1.2);

    const [L, R] = this.arms;
    const k = p.animDur > 0 ? clamp01(p.animT / p.animDur) : 1;
    const holding = !!this.tool;
    // ---- rest poses (camera space)
    const swing = moving ? Math.sin(ph) * 0.09 * walk : 0;
    const lPos = new THREE.Vector3(-0.21, -0.31 + Math.sin(t * 1.7 + 1) * 0.003, -0.05 + swing * 0.3);
    const lRot = new THREE.Euler(0.22 + swing, 0.38, 0.3);
    const rPos = new THREE.Vector3(0.17, -0.27 + Math.sin(t * 1.7) * 0.003, -0.07 - swing * 0.3);
    const rRot = new THREE.Euler(0.36 - swing, -0.34, holding ? -Math.PI / 2 + 0.2 : -0.35);
    let lCurl = 0.38, lThumb = 0.2, rCurl = holding ? 1 : 0.25, rThumb = holding ? 1 : 0.1;
    let toolTilt = 0;
    const twitch = moving ? 0.3 : 1;
    // ---- actions
    switch (anim) {
      case 'tool': {
        if (tool === 'can') {
          // tip the can forward and pour
          const pour = Math.sin(k * Math.PI);
          rPos.add(new THREE.Vector3(-0.03 * pour, 0.04 * pour, -0.05 * pour));
          rRot.x -= 0.2 * pour;
          toolTilt = -0.9 * pour;
        } else if (tool === 'rod') {
          rRot.x += k < 0.4 ? 0.9 * ease(k / 0.4) : 0.9 - 1.5 * ease(clamp01((k - 0.4) / 0.25));
        } else {
          // anticipation (raise & wind back) → fast strike → follow-through → recover
          const wind = ease(clamp01(k / 0.42));
          const strike = ease(clamp01((k - 0.42) / 0.16));
          const rec = ease(clamp01((k - 0.7) / 0.3));
          const lift = wind * (1 - strike);
          rPos.add(new THREE.Vector3(-0.03 * lift, 0.11 * lift - 0.05 * strike * (1 - rec), 0.04 * lift - 0.07 * strike * (1 - rec)));
          rRot.x += 0.95 * lift - 0.85 * strike * (1 - rec);
          toolTilt = 0.35 * lift - 0.45 * strike * (1 - rec);
          // the left hand drops out of the way, then comes back
          lPos.y -= 0.06 * Math.sin(k * Math.PI);
          if (k > 0.55 && k < 0.62) rCurl = 1.05;
        }
        break;
      }
      case 'fishCast': {
        const back = ease(clamp01(k / 0.5)), flick = ease(clamp01((k - 0.5) / 0.2));
        rRot.x += 0.9 * back * (1 - flick) - 0.5 * flick;
        rPos.y += 0.06 * back * (1 - flick);
        break;
      }
      case 'fishWait':
        rRot.x += Math.sin(t * 1.1) * 0.03;
        lPos.set(-0.1, -0.24, -0.16);
        lRot.set(0.3, 0.1, 0.2);
        lCurl = 0.8;
        break;
      case 'fishReel': {
        // left hand cranks the reel in little circles
        rRot.x += Math.sin(t * 22) * 0.025;
        lPos.set(-0.06 + Math.cos(t * 14) * 0.015, -0.23 + Math.sin(t * 14) * 0.015, -0.18);
        lRot.set(0.2, 0.2, 0.9);
        lCurl = 0.85;
        lThumb = 0.8;
        break;
      }
      case 'pet': {
        // reach out with the free hand, grab, bring back
        const reach = Math.sin(k * Math.PI);
        lPos.add(new THREE.Vector3(0.09 * reach, 0.05 * reach, -0.14 * reach));
        lRot.x -= 0.35 * reach;
        lRot.z -= 0.4 * reach;
        lCurl = k < 0.45 ? 0 : 0.9;
        lThumb = k < 0.45 ? 0 : 0.8;
        if (!holding) { rPos.add(new THREE.Vector3(-0.06 * reach, 0.04 * reach, -0.1 * reach)); rCurl = lCurl; }
        break;
      }
      case 'eat': {
        // bring the left hand up to the mouth
        const up = Math.sin(clamp01(k * 1.2) * Math.PI);
        lPos.add(new THREE.Vector3(0.16 * up, 0.17 * up, -0.02 * up));
        lRot.x += 0.5 * up;
        lRot.z -= 0.6 * up;
        lCurl = 0.75;
        lThumb = 0.7;
        break;
      }
      case 'happy': {
        const w = Math.sin(t * 12) * 0.25;
        lPos.add(new THREE.Vector3(0.02, 0.17, -0.05));
        lRot.set(1.3 + w, 0.2, 0.3);
        lCurl = 0;
        lThumb = 0;
        if (!holding) { rPos.add(new THREE.Vector3(-0.02, 0.17, -0.05)); rRot.set(1.3 - w, -0.2, -0.3); rCurl = 0; }
        break;
      }
    }
    // ---- apply (springy damping gives weight to every move)
    const springy = anim === 'tool' ? 26 : 13;
    const apply = (a: Arm, pos: THREE.Vector3, rot: THREE.Euler, kk: number) => {
      a.root.position.set(damp(a.root.position.x, pos.x, kk, dt), damp(a.root.position.y, pos.y, kk, dt), damp(a.root.position.z, pos.z, kk, dt));
      a.root.rotation.x = damp(a.root.rotation.x, rot.x, kk, dt);
      a.root.rotation.y = damp(a.root.rotation.y, rot.y, kk, dt);
      a.root.rotation.z = damp(a.root.rotation.z, rot.z, kk * 0.8, dt);
    };
    apply(L, lPos, lRot, 12);
    apply(R, rPos, rRot, springy);
    // keep the tool upright-ish whatever the arm angle
    if (this.tool) {
      const lean = this.toolKey.startsWith('can') ? -0.1 : this.toolKey.startsWith('rod') ? 0.05 : this.toolKey.startsWith('sickle') ? -1.2 : -0.85;
      this.tool.rotation.x = damp(this.tool.rotation.x, -R.root.rotation.x * 0.6 + lean + toolTilt, springy, dt);
    }
    L.hand.pose(dt, lCurl, lThumb, t, twitch);
    R.hand.pose(dt, rCurl, rThumb, t + 2, holding ? 0 : twitch);
  }
}
