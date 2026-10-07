import * as THREE from 'three';

/**
 * GPU-friendly particle system: one instanced quad mesh per blend mode, sprites
 * from a procedurally painted atlas. Particles live in a fixed-size pool (no GC).
 */
export const PF = {
  SOFT: 0, SPARKLE: 1, LEAF: 2, PETAL: 3, DROP: 4, HEART: 5, NOTE: 6, ZZZ: 7,
  SMOKE: 8, SNOW: 9, DUST: 10, RING: 11, BUBBLE: 12, STAR: 13, EXCLAIM: 14, QUESTION: 15,
} as const;

function makeAtlas(): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S * 4;
  const g = c.getContext('2d')!;
  const cell = (i: number, draw: (cx: number, cy: number) => void) => {
    const x = (i % 4) * S, y = Math.floor(i / 4) * S;
    g.save();
    g.beginPath();
    g.rect(x, y, S, S);
    g.clip();
    draw(x + S / 2, y + S / 2);
    g.restore();
  };
  const radial = (cx: number, cy: number, r: number, stops: [number, string][]) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  };
  cell(PF.SOFT, (x, y) => radial(x, y, 30, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));
  cell(PF.SPARKLE, (x, y) => {
    radial(x, y, 14, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? 6 : 28;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
  });
  cell(PF.LEAF, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x, y, 12, 24, 0.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 12, y + 16);
    g.lineTo(x + 12, y - 16);
    g.stroke();
  });
  cell(PF.PETAL, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y + 20);
    g.bezierCurveTo(x - 22, y, x - 10, y - 22, x, y - 10);
    g.bezierCurveTo(x + 10, y - 22, x + 22, y, x, y + 20);
    g.fill();
  });
  cell(PF.DROP, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y - 24);
    g.bezierCurveTo(x + 16, y, x + 14, y + 20, x, y + 20);
    g.bezierCurveTo(x - 14, y + 20, x - 16, y, x, y - 24);
    g.fill();
  });
  cell(PF.HEART, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y + 20);
    g.bezierCurveTo(x - 30, y - 2, x - 14, y - 26, x, y - 10);
    g.bezierCurveTo(x + 14, y - 26, x + 30, y - 2, x, y + 20);
    g.fill();
  });
  cell(PF.NOTE, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x - 8, y + 14, 10, 8, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x, y - 22, 5, 36);
    g.fillRect(x, y - 22, 16, 6);
  });
  cell(PF.ZZZ, (x, y) => {
    g.fillStyle = '#fff';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('z', x, y);
  });
  cell(PF.SMOKE, (x, y) => radial(x, y, 30, [[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]));
  cell(PF.SNOW, (x, y) => {
    radial(x, y, 10, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
      g.lineTo(x - Math.cos(a) * 22, y - Math.sin(a) * 22);
      g.stroke();
    }
  });
  cell(PF.DUST, (x, y) => radial(x, y, 18, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));
  cell(PF.RING, (x, y) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 24, 0, Math.PI * 2);
    g.stroke();
  });
  cell(PF.BUBBLE, (x, y) => {
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.arc(x - 8, y - 8, 5, 0, Math.PI * 2);
    g.fill();
  });
  cell(PF.STAR, (x, y) => {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 11 : 26;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
  });
  const glyph = (ch: string) => (x: number, y: number) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x, y, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a30';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x, y + 2);
  };
  cell(PF.EXCLAIM, glyph('!'));
  cell(PF.QUESTION, glyph('?'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface EmitOpts {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life?: number;
  size?: number;
  size1?: number;
  color?: number;
  alpha?: number;
  frame?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  rot?: number;
  additive?: boolean;
  wobble?: number;
}

class ParticlePool {
  readonly max: number;
  count = 0;
  // state arrays
  px: Float32Array; py: Float32Array; pz: Float32Array;
  vx: Float32Array; vy: Float32Array; vz: Float32Array;
  age: Float32Array; life: Float32Array; s0: Float32Array; s1: Float32Array;
  grav: Float32Array; drag: Float32Array; spin: Float32Array; wob: Float32Array;
  // gpu attributes
  aPos: THREE.InstancedBufferAttribute;
  aSize: THREE.InstancedBufferAttribute;
  aColor: THREE.InstancedBufferAttribute;
  aFrame: THREE.InstancedBufferAttribute;
  aRot: THREE.InstancedBufferAttribute;
  baseAlpha: Float32Array;
  mesh: THREE.Mesh;
  geo: THREE.InstancedBufferGeometry;

  constructor(max: number, tex: THREE.Texture, additive: boolean) {
    this.max = max;
    const f = () => new Float32Array(max);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.age = f(); this.life = f(); this.s0 = f(); this.s1 = f(); this.grav = f(); this.drag = f(); this.spin = f(); this.wob = f();
    this.baseAlpha = f();
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aFrame = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iColor', this.aColor);
    geo.setAttribute('iFrame', this.aFrame);
    geo.setAttribute('iRot', this.aRot);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: tex } },
      vertexShader: `
        attribute vec3 iPos; attribute float iSize; attribute vec4 iColor; attribute float iFrame; attribute float iRot;
        varying vec2 vUv; varying vec4 vColor;
        void main(){
          float c = cos(iRot), s = sin(iRot);
          vec2 q = vec2(position.x*c - position.y*s, position.x*s + position.y*c) * iSize;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
          float fx = mod(iFrame, 4.0), fy = floor(iFrame / 4.0);
          vUv = vec2((fx + uv.x) / 4.0, 1.0 - (fy + 1.0 - uv.y) / 4.0);
          vColor = iColor;
        }`,
      fragmentShader: `
        uniform sampler2D uTex; varying vec2 vUv; varying vec4 vColor;
        void main(){ vec4 t = texture2D(uTex, vUv); if (t.a * vColor.a < 0.02) discard; gl_FragColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
  }

  emit(o: EmitOpts): void {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z;
    this.vx[i] = o.vx ?? 0; this.vy[i] = o.vy ?? 0; this.vz[i] = o.vz ?? 0;
    this.age[i] = 0;
    this.life[i] = o.life ?? 1;
    this.s0[i] = o.size ?? 0.3;
    this.s1[i] = o.size1 ?? this.s0[i];
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.spin[i] = o.spin ?? 0;
    this.wob[i] = o.wobble ?? 0;
    this.baseAlpha[i] = o.alpha ?? 1;
    const c = new THREE.Color(o.color ?? 0xffffff);
    this.aColor.setXYZW(i, c.r, c.g, c.b, this.baseAlpha[i]);
    this.aFrame.setX(i, o.frame ?? 0);
    this.aRot.setX(i, o.rot ?? Math.random() * 6.28);
  }

  private copy(from: number, to: number): void {
    const arrs = [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.age, this.life, this.s0, this.s1, this.grav, this.drag, this.spin, this.wob, this.baseAlpha];
    for (const a of arrs) a[to] = a[from];
    this.aColor.setXYZW(to, this.aColor.getX(from), this.aColor.getY(from), this.aColor.getZ(from), this.aColor.getW(from));
    this.aFrame.setX(to, this.aFrame.getX(from));
    this.aRot.setX(to, this.aRot.getX(from));
  }

  update(dt: number, time: number): void {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.count--;
        if (i !== this.count) this.copy(this.count, i);
        continue;
      }
      const t = this.age[i] / this.life[i];
      this.vy[i] -= this.grav[i] * dt;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= dr; this.vy[i] *= dr; this.vz[i] *= dr;
      const wob = this.wob[i] ? Math.sin(time * 3 + i) * this.wob[i] * dt : 0;
      this.px[i] += this.vx[i] * dt + wob;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt + wob * 0.6;
      this.aPos.setXYZ(i, this.px[i], this.py[i], this.pz[i]);
      this.aSize.setX(i, this.s0[i] + (this.s1[i] - this.s0[i]) * t);
      this.aRot.setX(i, this.aRot.getX(i) + this.spin[i] * dt);
      // fade in quickly, fade out at the end
      const a = Math.min(1, t * 8) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      this.aColor.setW(i, this.baseAlpha[i] * a);
      i++;
    }
    this.geo.instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aFrame.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }
}

export class Particles {
  readonly group = new THREE.Group();
  private normal: ParticlePool;
  private add: ParticlePool;
  budget = 1; // quality multiplier 0..1
  private time = 0;

  constructor(max = 1500) {
    const tex = makeAtlas();
    this.normal = new ParticlePool(max, tex, false);
    this.add = new ParticlePool(Math.floor(max / 2), tex, true);
    this.group.add(this.normal.mesh, this.add.mesh);
  }

  emit(o: EmitOpts): void {
    (o.additive ? this.add : this.normal).emit(o);
  }

  /** Emit n particles with a randomizer, respecting the quality budget. */
  burst(n: number, f: (i: number) => EmitOpts): void {
    const k = Math.max(1, Math.round(n * this.budget));
    for (let i = 0; i < k; i++) this.emit(f(i));
  }

  update(dt: number): void {
    this.time += dt;
    this.normal.update(dt, this.time);
    this.add.update(dt, this.time);
  }

  clear(): void {
    this.normal.count = 0;
    this.add.count = 0;
  }

  get active(): number {
    return this.normal.count + this.add.count;
  }

  // ---------- presets ----------
  dust(x: number, y: number, z: number, color = 0xd8c8a8, n = 8): void {
    this.burst(n, () => ({ x: x + (Math.random() - 0.5) * 0.4, y: y + 0.1, z: z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.2 + 0.4, vz: (Math.random() - 0.5) * 1.5, life: 0.6 + Math.random() * 0.3, size: 0.25, size1: 0.5, color, alpha: 0.7, frame: PF.SMOKE, gravity: 1.5, drag: 2 }));
  }
  sparkle(x: number, y: number, z: number, color = 0xfff0a0, n = 10): void {
    this.burst(n, () => ({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3, life: 0.7 + Math.random() * 0.4, size: 0.22, size1: 0.05, color, frame: PF.SPARKLE, gravity: 4, drag: 1.5, spin: 4, additive: true }));
  }
  leaves(x: number, y: number, z: number, color: number, n = 8): void {
    this.burst(n, () => ({ x: x + (Math.random() - 0.5), y: y + Math.random(), z: z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, life: 1.4, size: 0.18, color, frame: PF.LEAF, gravity: 1.2, drag: 1.5, spin: 3, wobble: 1.5 }));
  }
  splash(x: number, y: number, z: number, n = 12): void {
    this.burst(n, () => ({ x, y, z, vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 3 + 1.5, vz: (Math.random() - 0.5) * 2.5, life: 0.6, size: 0.14, color: 0xbfefff, frame: PF.DROP, gravity: 9, rot: 0 }));
    this.emit({ x, y: y + 0.02, z, life: 0.6, size: 0.3, size1: 1.4, color: 0xffffff, alpha: 0.7, frame: PF.RING, rot: 0 });
  }
  hearts(x: number, y: number, z: number, n = 4, color = 0xff7a9a): void {
    this.burst(n, (i) => ({ x: x + (Math.random() - 0.5) * 0.4, y: y + i * 0.05, z: z + (Math.random() - 0.5) * 0.4, vy: 1 + Math.random() * 0.5, life: 1.3, size: 0.25, size1: 0.35, color, frame: PF.HEART, rot: 0, wobble: 0.6 }));
  }
  notes(x: number, y: number, z: number, n = 3): void {
    this.burst(n, (i) => ({ x: x + (Math.random() - 0.5) * 0.4, y: y + i * 0.1, z, vy: 0.9, vx: 0.3, life: 1.6, size: 0.22, color: [0x8ad8ff, 0xffd03a, 0xff8ab8][i % 3], frame: PF.NOTE, rot: 0, wobble: 0.6 }));
  }
  smoke(x: number, y: number, z: number, dark = false): void {
    this.emit({ x: x + (Math.random() - 0.5) * 0.1, y, z: z + (Math.random() - 0.5) * 0.1, vx: 0.15 + Math.random() * 0.1, vy: 0.6 + Math.random() * 0.2, vz: 0.05, life: 3.2, size: 0.25, size1: 0.9, color: dark ? 0x5a5050 : 0xf0f0f0, alpha: 0.55, frame: PF.SMOKE, drag: 0.2, wobble: 0.3 });
  }
  zzz(x: number, y: number, z: number): void {
    this.emit({ x, y, z, vx: 0.2, vy: 0.4, life: 2, size: 0.14, size1: 0.3, color: 0xffffff, frame: PF.ZZZ, rot: 0, wobble: 0.4 });
  }
  icon(x: number, y: number, z: number, frame: number, color = 0xffffff): void {
    this.emit({ x, y, z, vy: 0.4, life: 1.2, size: 0.45, size1: 0.5, color, frame, rot: 0, drag: 2 });
  }
}
