import * as THREE from 'three';

/**
 * Ambient wildlife that makes the valley feel inhabited: flocks of birds crossing
 * the sky, seagulls circling over the coast, and little sparrows pecking on the
 * ground that take off when you walk up to them. One instanced draw call, wing
 * flapping done in the vertex shader.
 */
interface Bird {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mode: 'fly' | 'ground' | 'takeoff' | 'circle';
  phase: number;
  flap: number; // flap speed
  scale: number;
  t: number;
  center?: THREE.Vector3;
  radius?: number;
  color: THREE.Color;
}

const MAX = 48;

function birdGeometry(): THREE.BufferGeometry {
  // body + two wings (wing tips flagged with aWing=1 so the shader can flap them)
  const pos: number[] = [];
  const wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], wa: number, wb: number, wc: number) => {
    pos.push(...a, ...b, ...c);
    wing.push(wa, wb, wc);
  };
  // body (a thin diamond, both sides)
  tri([0, 0, 0.22], [0.05, 0, 0], [0, 0, -0.18], 0, 0, 0);
  tri([0, 0, 0.22], [0, 0, -0.18], [-0.05, 0, 0], 0, 0, 0);
  tri([0, 0, 0.22], [0, 0.04, 0], [0, 0, -0.18], 0, 0, 0);
  // wings
  tri([0.04, 0, 0.08], [0.34, 0, -0.04], [0.04, 0, -0.07], 0, 1, 0);
  tri([-0.04, 0, 0.08], [-0.04, 0, -0.07], [-0.34, 0, -0.04], 0, 0, 1);
  // tail
  tri([0, 0, -0.16], [0.06, 0, -0.27], [-0.06, 0, -0.27], 0, 0, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  return g;
}

export class AmbientLife {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private phaseAttr: THREE.InstancedBufferAttribute;
  private flapAttr: THREE.InstancedBufferAttribute;
  private birds: Bird[] = [];
  private flockT = 3;
  private groundT = 2;
  private uTime = { value: 0 };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private col = new THREE.Color();

  constructor() {
    const g = birdGeometry();
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: this.uTime },
      vertexShader: `
        attribute float aWing; attribute float aPhase; attribute float aFlap;
        uniform float uTime; varying vec3 vCol;
        void main(){
          vec3 p = position;
          float f = sin(uTime * aFlap + aPhase);
          p.y += aWing * f * abs(p.x) * 1.6;
          p.x *= 1.0 - aWing * abs(f) * 0.25;
          vCol = instanceColor * (0.8 + 0.2 * (1.0 - aWing));
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }',
    });
    this.mesh = new THREE.InstancedMesh(g, mat, MAX);
    this.phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.flapAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    g.setAttribute('aPhase', this.phaseAttr);
    g.setAttribute('aFlap', this.flapAttr);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  clear(): void {
    this.birds = [];
    this.mesh.count = 0;
    this.flockT = 2;
  }

  private addFlock(focus: THREE.Vector3, region: string): void {
    const n = 4 + Math.floor(Math.random() * 6);
    const ang = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const start = focus.clone().addScaledVector(dir, -32).add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
    const h = 6 + Math.random() * 4;
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const dark = region === 'ember' ? 0x3a3036 : 0x585266;
    for (let i = 0; i < n && this.birds.length < MAX; i++) {
      const row = Math.ceil(i / 2), s = i % 2 ? 1 : -1;
      const p = start.clone().addScaledVector(dir, -row * 0.9).addScaledVector(side, s * row * 0.8);
      p.y = h + Math.random() * 0.4;
      this.birds.push({ pos: p, vel: dir.clone().multiplyScalar(3.8 + Math.random() * 0.4), mode: 'fly', phase: Math.random() * 6, flap: 9 + Math.random() * 3, scale: 0.9 + Math.random() * 0.3, t: 0, color: new THREE.Color(dark) });
    }
  }

  private addGulls(focus: THREE.Vector3): void {
    for (let i = 0; i < 3 && this.birds.length < MAX; i++) {
      const c = focus.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, 0, 6 + Math.random() * 8));
      const r = 3 + Math.random() * 4;
      const a = Math.random() * 6.28;
      this.birds.push({ pos: new THREE.Vector3(c.x + Math.cos(a) * r, 5 + Math.random() * 3, c.z + Math.sin(a) * r), vel: new THREE.Vector3(), mode: 'circle', phase: a, flap: 4, scale: 1.4, t: 0, center: c, radius: r, color: new THREE.Color(0xf4f6f8) });
    }
  }

  private addGround(focus: THREE.Vector3, groundY: (x: number, z: number) => number, walkable: (x: number, z: number) => boolean): void {
    const ang = Math.random() * Math.PI * 2;
    const d = 6 + Math.random() * 6;
    const cx = focus.x + Math.cos(ang) * d, cz = focus.z + Math.sin(ang) * d;
    if (!walkable(cx, cz)) return;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n && this.birds.length < MAX; i++) {
      const x = cx + (Math.random() - 0.5) * 1.6, z = cz + (Math.random() - 0.5) * 1.6;
      if (!walkable(x, z)) continue;
      this.birds.push({ pos: new THREE.Vector3(x, groundY(x, z) + 0.06, z), vel: new THREE.Vector3(), mode: 'ground', phase: Math.random() * 6, flap: 22, scale: 0.55, t: Math.random() * 3, color: new THREE.Color([0x8a6a4a, 0x6a5a4a, 0xa8784a][i % 3]) });
    }
  }

  update(dt: number, time: number, focus: THREE.Vector3, opts: { active: boolean; night: number; weather: string; region: string; groundY: (x: number, z: number) => number; walkable: (x: number, z: number) => boolean }): void {
    this.uTime.value = time;
    const calm = opts.weather !== 'rain' && opts.weather !== 'storm' && opts.weather !== 'snow';
    const day = opts.night < 0.4;
    if (!opts.active) {
      if (this.birds.length) this.clear();
      return;
    }
    // spawn
    this.flockT -= dt;
    if (this.flockT <= 0) {
      this.flockT = 14 + Math.random() * 18;
      if (day && calm && this.birds.filter((b) => b.mode === 'fly').length < 18) this.addFlock(focus, opts.region);
      if (opts.region === 'coast' && day && this.birds.filter((b) => b.mode === 'circle').length < 3) this.addGulls(focus);
    }
    this.groundT -= dt;
    if (this.groundT <= 0) {
      this.groundT = 8 + Math.random() * 10;
      const ok = day && calm && opts.region !== 'ember' && opts.region !== 'frosty' && opts.region !== 'mine';
      if (ok && this.birds.filter((b) => b.mode === 'ground').length < 6) this.addGround(focus, opts.groundY, opts.walkable);
    }
    // simulate
    for (const b of this.birds) {
      b.t += dt;
      if (b.mode === 'fly' || b.mode === 'takeoff') {
        if (b.mode === 'takeoff') {
          b.vel.y = Math.max(0, b.vel.y - dt * 1.5);
          if (b.pos.y > 7) b.mode = 'fly';
        } else b.pos.y += Math.sin(b.t * 1.3 + b.phase) * dt * 0.3;
        b.pos.addScaledVector(b.vel, dt);
      } else if (b.mode === 'circle') {
        b.phase += dt * 0.35;
        b.pos.set(b.center!.x + Math.cos(b.phase) * b.radius!, b.pos.y + Math.sin(b.t) * dt * 0.2, b.center!.z + Math.sin(b.phase) * b.radius!);
        b.vel.set(-Math.sin(b.phase), 0, Math.cos(b.phase));
      } else {
        // hop & peck; flee when the player walks close
        const dx = b.pos.x - focus.x, dz = b.pos.z - focus.z;
        if (dx * dx + dz * dz < 6.5 || !day) {
          b.mode = 'takeoff';
          const away = new THREE.Vector3(dx, 0, dz).normalize();
          b.vel.set(away.x * 3.5 + (Math.random() - 0.5), 2.6 + Math.random(), away.z * 3.5 + (Math.random() - 0.5));
          b.flap = 26;
          continue;
        }
        if (b.t > 1.2 && Math.random() < dt * 1.5) {
          b.t = 0;
          const a = Math.random() * 6.28;
          const nx = b.pos.x + Math.cos(a) * 0.25, nz = b.pos.z + Math.sin(a) * 0.25;
          if (opts.walkable(nx, nz)) {
            b.vel.set(Math.cos(a), 0, Math.sin(a));
            b.pos.x = nx;
            b.pos.z = nz;
          }
        }
        b.pos.y = opts.groundY(b.pos.x, b.pos.z) + 0.06 + (b.t < 0.15 ? Math.sin((b.t / 0.15) * Math.PI) * 0.08 : 0);
      }
    }
    // cull far birds
    this.birds = this.birds.filter((b) => b.pos.distanceToSquared(focus) < 48 * 48 && (b.mode !== 'ground' || b.pos.distanceToSquared(focus) < 22 * 22));
    // write instances
    let i = 0;
    for (const b of this.birds) {
      const v = b.vel;
      const yaw = Math.atan2(v.x, v.z);
      const peck = b.mode === 'ground' ? Math.max(0, Math.sin(time * 9 + b.phase)) * 0.5 : 0;
      const bank = b.mode === 'circle' ? 0.35 : 0;
      this.e.set(b.mode === 'takeoff' ? -0.5 : peck, yaw, bank);
      this.q.setFromEuler(this.e);
      this.s.setScalar(b.scale);
      this.m.compose(b.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.col.copy(b.color);
      this.mesh.setColorAt(i, this.col);
      // perched / gliding birds keep their wings still (flap 0, phase 0 ⇒ flat wings)
      const flap = b.mode === 'ground' ? 0 : b.mode === 'circle' ? (Math.sin(time * 0.7 + b.t) > 0.6 ? 6 : 0) : b.flap;
      this.phaseAttr.setX(i, flap ? b.phase : 0);
      this.flapAttr.setX(i, flap);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.phaseAttr.needsUpdate = true;
    this.flapAttr.needsUpdate = true;
  }
}
