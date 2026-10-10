import * as THREE from 'three';
import { clamp, damp } from '../core/MathUtil';
import { globalUniforms } from './Materials';

/**
 * Elegant 2.5D camera: slightly isometric (45° yaw, ~50° pitch), smooth follow
 * with inertia and look-ahead, pinch zoom, gentle shake, indoor framing.
 */
export class CameraRig {
  target = new THREE.Vector3();
  private cur = new THREE.Vector3();
  yaw = Math.PI / 4;
  pitch = 0.84;
  baseDist = 19;
  zoom = 1;
  zoomTarget = 1;
  mode: 'outdoor' | 'house' | 'cave' = 'outdoor';
  private shakeT = 0;
  private shakeAmp = 0;
  private lookAhead = new THREE.Vector3();
  bounds: { x0: number; z0: number; x1: number; z1: number } | null = null;
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  /** 'iso' = classic 2.5D view (can orbit), 'fp' = first person */
  view: 'iso' | 'fp' = 'iso';
  yawTarget = Math.PI / 4;
  pitchTarget = 0.84;
  fpPitch = -0.12;
  eyeHeight = 1.18;
  /** head bob & turn speed, read by the first-person hands */
  bob = 0;
  turnSpeed = 0;
  private bobT = 0;

  constructor(public camera: THREE.PerspectiveCamera) {}

  setView(v: 'iso' | 'fp'): void {
    this.view = v;
    this.camera.fov = v === 'fp' ? 72 : 32;
    this.camera.near = v === 'fp' ? 0.05 : 0.5;
    this.camera.updateProjectionMatrix();
  }

  /** Orbit (iso) or turn the head (fp) by a yaw step in radians. */
  rotate(d: number): void {
    this.yawTarget += d;
  }

  /** Finger/mouse look in pixels. */
  look(dx: number, dy: number): void {
    if (this.view === 'fp') {
      this.yawTarget -= dx * 0.0055;
      this.fpPitch = clamp(this.fpPitch - dy * 0.0045, -1.25, 1.05);
    } else {
      this.yawTarget -= dx * 0.006;
      this.pitchTarget = clamp(this.pitchTarget + dy * 0.003, 0.45, 1.3);
    }
  }

  snap(p: THREE.Vector3): void {
    this.target.copy(p);
    this.cur.copy(p);
    this.lookAhead.set(0, 0, 0);
  }

  shake(amp = 0.12, t = 0.25): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, t);
  }

  setZoom(z: number): void {
    this.zoomTarget = clamp(z, 0.6, 1.55);
  }

  update(dt: number, follow: THREE.Vector3, velocity: THREE.Vector3): void {
    const prevYaw = this.yaw;
    this.yaw = this.view === 'fp' ? this.yawTarget : damp(this.yaw, this.yawTarget, 8, dt);
    this.turnSpeed = (this.yaw - prevYaw) / Math.max(dt, 1e-3);
    this.pitch = damp(this.pitch, this.pitchTarget, 8, dt);
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (this.view === 'fp') {
      const speed = Math.hypot(velocity.x, velocity.z);
      this.bobT += dt * Math.min(speed, 6) * 2.2;
      this.bob = Math.sin(this.bobT * 2) * 0.035 * Math.min(1, speed / 3);
      this.cur.copy(follow);
      this.camera.position.set(follow.x, follow.y + this.eyeHeight + this.bob, follow.z);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp * 0.5;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp * 0.5;
      }
      const cp = Math.cos(this.fpPitch);
      this.camera.lookAt(this.camera.position.x + this.forward.x * cp, this.camera.position.y + Math.sin(this.fpPitch), this.camera.position.z + this.forward.z * cp);
      return;
    }
    // look slightly ahead in the walking direction
    this.lookAhead.x = damp(this.lookAhead.x, velocity.x * 0.35, 3, dt);
    this.lookAhead.z = damp(this.lookAhead.z, velocity.z * 0.35, 3, dt);
    this.target.copy(follow).add(this.lookAhead);
    if (this.bounds) {
      this.target.x = clamp(this.target.x, this.bounds.x0, this.bounds.x1);
      this.target.z = clamp(this.target.z, this.bounds.z0, this.bounds.z1);
    }
    const lambda = this.mode === 'house' ? 4 : 5;
    this.cur.x = damp(this.cur.x, this.target.x, lambda, dt);
    this.cur.y = damp(this.cur.y, this.target.y, lambda, dt);
    this.cur.z = damp(this.cur.z, this.target.z, lambda, dt);
    this.zoom = damp(this.zoom, this.zoomTarget, 6, dt);
    const dist = this.baseDist * this.zoom * (this.mode === 'house' ? 0.85 : this.mode === 'cave' ? 0.8 : 1);
    const pitch = this.mode === 'house' ? Math.max(0.9, this.pitch) : this.pitch;
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch)).multiplyScalar(dist);
    this.camera.position.copy(this.cur).add(off);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT > 0 ? 1 : 0);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.cur.x, this.cur.y + 0.4, this.cur.z);
  }

  /** Update the see-through uniform so foliage/buildings near the player dither away. */
  updateSeeThrough(playerPos: THREE.Vector3): void {
    const v = playerPos.clone().add(new THREE.Vector3(0, 0.7, 0)).project(this.camera);
    (globalUniforms.uPlayerScreen.value as THREE.Vector2).set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    globalUniforms.uPlayerDepth.value = this.camera.position.distanceTo(playerPos);
  }

  /** Screen → ground raycast (y = height function approx with plane at y). */
  screenToGround(nx: number, ny: number, y = 0): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
}
