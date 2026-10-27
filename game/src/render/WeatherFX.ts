import * as THREE from 'three';
import type { Particles } from './Particles';
import { PF } from './Particles';
import type { Season, WeatherType } from '../state/types';
import { globalUniforms } from './Materials';

/**
 * Visible weather: rain streaks & splashes, snow, fog, storms with lightning,
 * rainbows after rain, puddles, plus ambient life (petals, leaves, fireflies,
 * dust motes, butterflies of light) so the world feels alive when idle.
 */
export class WeatherFX {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private rainCount: number;
  private rainbow: THREE.Mesh;
  private puddles: THREE.InstancedMesh;
  private puddleLevel = 0;
  rainAmount = 0;
  /** 0..1 rainbow strength (the UI draws it as a sky arc in the overhead view) */
  rainbowLevel = 0;
  rainbowIso = false;
  snowAmount = 0;
  wetness = 0;
  private ambientT = 0;
  private snowT = 0;
  // lightning bolts
  private bolts: { line: THREE.LineSegments; glow: THREE.Mesh; t: number }[] = [];
  private boltMat = new THREE.LineBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  private boltGlowMat = new THREE.MeshBasicMaterial({ color: 0xb8c8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });

  constructor(private particles: Particles, maxRain = 900) {
    this.rainCount = maxRain;
    this.rainPos = new Float32Array(maxRain * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    for (let i = 0; i < maxRain; i++) this.respawnDrop(i, new THREE.Vector3(), true);
    // rainbow arc: a big translucent half torus with a spectral gradient
    const rg = new THREE.TorusGeometry(26, 1.6, 8, 64, Math.PI);
    const rm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uAlpha; varying vec3 vP;
        vec3 hsv(float h){ vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0); vec3 p = abs(fract(vec3(h)+k)*6.0-3.0); return clamp(p-1.0,0.0,1.0); }
        void main(){ float r = length(vP.xy); float t = clamp((r - 24.4)/3.2, 0.0, 1.0);
          vec3 c = hsv(0.83 - t*0.83); float edge = smoothstep(0.0,0.15,t)*smoothstep(1.0,0.85,t);
          gl_FragColor = vec4(c, uAlpha*edge*0.75); }`,
    });
    this.rainbow = new THREE.Mesh(rg, rm);
    this.rainbow.visible = false;
    // puddles: flat shiny discs
    const pg = new THREE.CircleGeometry(0.6, 14).rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.0, depthWrite: false });
    this.puddles = new THREE.InstancedMesh(pg, pm, 40);
    this.puddles.count = 0;
    this.puddles.frustumCulled = false;
    this.group.add(this.rain, this.rainbow, this.puddles);
  }

  private respawnDrop(i: number, c: THREE.Vector3, initial = false): void {
    const x = c.x + (Math.random() - 0.5) * 34, z = c.z + (Math.random() - 0.5) * 34;
    const y = initial ? Math.random() * 14 : 12 + Math.random() * 4;
    const p = this.rainPos;
    p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
    p[i * 6 + 3] = x + 0.08; p[i * 6 + 4] = y + 0.55; p[i * 6 + 5] = z + 0.05;
  }

  /** A jagged lightning bolt from the clouds to the ground, somewhere in view. Returns its distance. */
  strike(focus: THREE.Vector3, camera: THREE.Camera, groundY: (x: number, z: number) => number): number {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const iso = camera.position.y - focus.y > 6;
    const dist = iso ? 2.5 + Math.random() * 5 : 16 + Math.random() * 22;
    const end = focus.clone().addScaledVector(fwd, dist).addScaledVector(side, (Math.random() - 0.5) * dist * 0.9);
    end.y = groundY(end.x, end.z);
    const top = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 28, (Math.random() - 0.5) * 8));
    const pts: number[] = [];
    const segs = 14;
    let prev = top.clone();
    const branchFrom: THREE.Vector3[] = [];
    for (let i = 1; i <= segs; i++) {
      const k = i / segs;
      const p = top.clone().lerp(end, k);
      if (i < segs) p.add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.2));
      pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      if (i > 2 && i < segs - 2 && Math.random() < 0.35) branchFrom.push(p.clone());
      prev = p;
    }
    for (const b of branchFrom) {
      let q = b.clone();
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, -1.4, (Math.random() - 0.5) * 2).normalize();
      for (let j = 0; j < 4; j++) {
        const n = q.clone().addScaledVector(dir, 1.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
        pts.push(q.x, q.y, q.z, n.x, n.y, n.z);
        q = n;
      }
    }
    // thick glowing ribbons (plain GL lines are 1px on phones)
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length; i += 6) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]), new THREE.Vector3(pts[i + 3], pts[i + 4], pts[i + 5])));
    const g = new THREE.TubeGeometry(path, pts.length / 3, 0.13, 4, false);
    const line = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })) as unknown as THREE.LineSegments;
    line.frustumCulled = false;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 28, 8, 1, true), this.boltGlowMat.clone());
    glow.position.copy(top).lerp(end, 0.5);
    glow.lookAt(end);
    glow.rotateX(Math.PI / 2);
    // (no point light: adding one would recompile every material mid-storm)
    this.group.add(line, glow);
    this.bolts.push({ line, glow, t: 0 });
    // sparks where it hits
    this.particles.sparkle(end.x, end.y + 0.3, end.z, 0xe0e8ff, 12);
    return focus.distanceTo(end);
  }

  private updateBolts(dt: number): void {
    for (const b of this.bolts) {
      b.t += dt;
      const flicker = b.t < 0.08 ? 1 : b.t < 0.14 ? 0.25 : b.t < 0.22 ? 0.9 : Math.max(0, 1 - (b.t - 0.22) / 0.3);
      (b.line.material as THREE.MeshBasicMaterial).opacity = flicker;
      (b.glow.material as THREE.MeshBasicMaterial).opacity = 0.45 * flicker;
    }
    for (const b of this.bolts.filter((x) => x.t > 0.6)) {
      this.group.remove(b.line, b.glow);
      b.line.geometry.dispose();
      b.glow.geometry.dispose();
      (b.line.material as THREE.Material).dispose();
      (b.glow.material as THREE.Material).dispose();
    }
    this.bolts = this.bolts.filter((x) => x.t <= 0.6);
  }

  /** Place puddles on walkable ground after/while raining. */
  placePuddles(points: { x: number; z: number; y: number }[]): void {
    const m = new THREE.Matrix4();
    this.puddles.count = Math.min(points.length, 40);
    for (let i = 0; i < this.puddles.count; i++) {
      const p = points[i];
      const s = 0.7 + ((i * 37) % 10) / 10;
      m.makeScale(s * 1.3, 1, s);
      m.setPosition(p.x, p.y + 0.03, p.z);
      this.puddles.setMatrixAt(i, m);
    }
    this.puddles.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, focus: THREE.Vector3, weather: WeatherType, season: Season, night: number, rainbow: boolean, outdoor: boolean, region: string, groundY: (x: number, z: number) => number, camera: THREE.Camera): void {
    const raining = outdoor && (weather === 'rain' || weather === 'storm');
    const snowing = outdoor && weather === 'snow';
    this.rainAmount += ((raining ? (weather === 'storm' ? 1 : 0.7) : 0) - this.rainAmount) * Math.min(1, dt * 0.8);
    this.snowAmount += ((snowing ? 1 : 0) - this.snowAmount) * Math.min(1, dt * 0.8);
    this.wetness = Math.max(0, Math.min(1, this.wetness + (raining ? dt * 0.08 : -dt * 0.012)));
    globalUniforms.uWet.value = this.wetness;
    globalUniforms.uWind.value = weather === 'storm' ? 2.6 : weather === 'rain' ? 1.6 : 1;
    this.updateBolts(dt);
    const storm = weather === 'storm';
    // rain
    this.rain.visible = this.rainAmount > 0.03;
    if (this.rain.visible) {
      const active = Math.floor(this.rainCount * this.rainAmount * this.particles.budget);
      const p = this.rainPos;
      const fall = (storm ? 24 : 18) * dt;
      const slant = storm ? 0.32 : 0.08;
      for (let i = 0; i < active; i++) {
        p[i * 6 + 1] -= fall;
        p[i * 6 + 4] -= fall;
        p[i * 6] -= fall * slant;
        p[i * 6 + 3] -= fall * slant;
        const gx = p[i * 6], gz = p[i * 6 + 2];
        if (p[i * 6 + 1] < groundY(gx, gz) || Math.abs(gx - focus.x) > 18 || Math.abs(gz - focus.z) > 18) {
          if (p[i * 6 + 1] < 1 && Math.random() < 0.15) this.particles.emit({ x: gx, y: groundY(gx, gz) + 0.03, z: gz, life: 0.25, size: 0.06, size1: 0.3, color: 0xdff0ff, alpha: 0.6, frame: PF.RING, rot: 0 });
          this.respawnDrop(i, focus);
        }
      }
      for (let i = active; i < this.rainCount; i++) p[i * 6 + 1] = p[i * 6 + 4] = -100;
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.rain.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.25 * this.rainAmount;
    }
    // snow
    if (this.snowAmount > 0.05) {
      this.snowT -= dt;
      if (this.snowT <= 0) {
        this.snowT = 0.03 / this.snowAmount;
        const n = Math.ceil(3 * this.particles.budget);
        for (let i = 0; i < n; i++) this.particles.emit({ x: focus.x + (Math.random() - 0.5) * 30, y: 10 + Math.random() * 3, z: focus.z + (Math.random() - 0.5) * 30, vy: -1.3, vx: 0.2, life: 8, size: 0.12 + Math.random() * 0.08, color: 0xffffff, frame: PF.SNOW, wobble: 1.5, spin: 1 });
      }
    }
    // puddles fade in/out with wetness
    (this.puddles.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, this.wetness * 0.7) * (outdoor ? 1 : 0);
    this.puddleLevel = this.wetness;
    // rainbow placed far behind the island, facing the camera
    const target = rainbow && outdoor && night < 0.4 ? 1 : 0;
    const mat = this.rainbow.material as THREE.ShaderMaterial;
    mat.uniforms.uAlpha.value += (target - mat.uniforms.uAlpha.value) * Math.min(1, dt * 1.2);
    this.rainbowLevel = mat.uniforms.uAlpha.value;
    const isoCam = camera.position.y - focus.y > 6;
    this.rainbowIso = isoCam;
    this.rainbow.visible = mat.uniforms.uAlpha.value > 0.01 && !isoCam;
    if (this.rainbow.visible) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.setY(0).normalize();
      const iso = camera.position.y - focus.y > 6;
      const base = iso ? focus.y - 3 : -8; // high iso camera: a smaller magical arch over the farm
      (this.rainbow.material as THREE.ShaderMaterial).depthTest = !iso;
      this.rainbow.scale.setScalar(iso ? 0.42 : 1);
      this.rainbow.position.copy(focus).addScaledVector(dir, iso ? 7 : 34).setY(base);
      this.rainbow.lookAt(camera.position.x, base, camera.position.z);
    }
    // ambient life
    this.ambientT -= dt;
    if (this.ambientT <= 0 && outdoor) {
      this.ambientT = 0.25;
      const rx = () => focus.x + (Math.random() - 0.5) * 22, rz = () => focus.z + (Math.random() - 0.5) * 16;
      if (night > 0.5 && (season === 'summer' || season === 'spring') && region !== 'frosty' && weather !== 'rain') {
        for (let i = 0; i < 2; i++) {
          const x = rx(), z = rz();
          this.particles.emit({ x, y: groundY(x, z) + 0.4 + Math.random(), z, vx: (Math.random() - 0.5) * 0.3, vy: 0.05, vz: (Math.random() - 0.5) * 0.3, life: 3.5, size: 0.12, size1: 0.12, color: 0xfff27a, frame: PF.SOFT, additive: true, wobble: 1.2 });
        }
      }
      if (season === 'autumn' && Math.random() < 0.8) {
        const x = rx(), z = rz();
        this.particles.emit({ x, y: groundY(x, z) + 4, z, vx: 0.4, vy: -0.5, life: 6, size: 0.16, color: [0xe8903a, 0xd8602a, 0xf2b84a][Math.floor(Math.random() * 3)], frame: PF.LEAF, wobble: 1.4, spin: 2 });
      }
      if (season === 'spring' && Math.random() < 0.6) {
        const x = rx(), z = rz();
        this.particles.emit({ x, y: groundY(x, z) + 4, z, vx: 0.3, vy: -0.4, life: 7, size: 0.12, color: 0xffc8e0, frame: PF.PETAL, wobble: 1.6, spin: 2 });
      }
      if (night < 0.3 && Math.random() < 0.4) {
        const x = rx(), z = rz();
        this.particles.emit({ x, y: groundY(x, z) + 0.5 + Math.random() * 1.5, z, vx: (Math.random() - 0.5) * 0.2, vy: 0.05, life: 4, size: 0.05, color: 0xfffbe0, alpha: 0.7, frame: PF.SOFT, additive: true, wobble: 0.5 });
      }
      if (region === 'ember' && Math.random() < 0.9) {
        const x = rx(), z = rz();
        this.particles.emit({ x, y: groundY(x, z) + 0.2, z, vy: 0.8, life: 3, size: 0.08, size1: 0.02, color: 0xff8a3a, frame: PF.SOFT, additive: true, wobble: 1 });
      }
    }
    void this.puddleLevel;
  }
}
