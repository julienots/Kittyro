import * as THREE from 'three';
import type { Quality } from '../save/Settings';
import { globalUniforms } from './Materials';
import { Cinematic } from './Cinematic';
import { realifyScene, SkyEnvironment } from './Realism';

export interface QualityProfile {
  pixelRatio: number;
  shadow: number; // shadow map size, 0 = blob shadows only
  post: boolean; // bloom + grading (+ tilt-shift when `tilt`)
  tilt: boolean;
  bloomPasses: number;
  particles: number; // budget 0..1
  grass: number; // grass density multiplier
  outlines: boolean;
  lights: number; // max dynamic point lights at night
  antialias: boolean;
  drawDistance: number;
  realistic?: boolean; // PBR materials + cinematic HDR pipeline
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1.5, shadow: 0, post: false, tilt: false, bloomPasses: 0, particles: 0.4, grass: 0.35, outlines: false, lights: 0, antialias: true, drawDistance: 48 },
  medium: { pixelRatio: 1.6, shadow: 1024, post: true, tilt: false, bloomPasses: 1, particles: 0.7, grass: 0.7, outlines: true, lights: 2, antialias: true, drawDistance: 70 },
  high: { pixelRatio: 2.0, shadow: 2048, post: true, tilt: true, bloomPasses: 2, particles: 1, grass: 1, outlines: true, lights: 4, antialias: true, drawDistance: 90 },
  ultra: { pixelRatio: 2.25, shadow: 4096, post: true, tilt: true, bloomPasses: 3, particles: 1, grass: 1.4, outlines: true, lights: 6, antialias: true, drawDistance: 120 },
  realistic: { pixelRatio: 2, shadow: 4096, post: true, tilt: false, bloomPasses: 0, particles: 1, grass: 1.6, outlines: false, lights: 8, antialias: true, drawDistance: 140, realistic: true },
};

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/**
 * Post-processing chain: HDR scene target -> bright-pass + separable blur at quarter
 * resolution (bloom) -> composite with tilt-shift "miniature" depth of field, soft
 * highlight roll-off, colour grading driven by the time of day, vignette and grain.
 */
class PostFX {
  rt: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;

  constructor(w: number, h: number, samples: number, private passes: number) {
    this.rt = new THREE.WebGLRenderTarget(w, h, { samples, type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter } as const;
    this.bloomA = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.bloomB = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.bright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uPx: { value: new THREE.Vector2(1 / w, 1 / h) }, uThreshold: { value: 0.95 } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uThreshold; varying vec2 vUv;
        vec3 tap(vec2 o){ vec3 c = texture2D(tDiffuse, vUv + o * uPx).rgb; float l = max(c.r, max(c.g, c.b));
          return c * smoothstep(uThreshold, uThreshold + 0.4, l); }
        void main(){
          vec3 c = tap(vec2(-1.5,-1.5)) + tap(vec2(1.5,-1.5)) + tap(vec2(-1.5,1.5)) + tap(vec2(1.5,1.5));
          gl_FragColor = vec4(c * 0.25, 1.0);
        }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1 / bw, 0) } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
          c += (texture2D(tDiffuse, vUv + uDir * 1.385).rgb + texture2D(tDiffuse, vUv - uDir * 1.385).rgb) * 0.316;
          c += (texture2D(tDiffuse, vUv + uDir * 3.231).rgb + texture2D(tDiffuse, vUv - uDir * 3.231).rgb) * 0.070;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture }, tBloom: { value: this.bloomA.texture },
        uRes: { value: new THREE.Vector2(w, h) }, uFocus: { value: 0.52 }, uAmount: { value: 1 },
        uBloom: { value: 0.45 }, uTime: { value: 0 }, uGrain: { value: 0.025 },
        uWarm: { value: 0 }, uNight: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uVignette: { value: 0.5 },
      },
      vertexShader: FS_VERT,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uFocus; uniform float uAmount;
        uniform float uBloom, uTime, uGrain, uWarm, uNight, uSat, uContrast, uVignette;
        varying vec2 vUv;
        const int N = 12;
        float hashP(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
        void main(){
          vec2 px = 1.0 / uRes;
          float dist = abs(vUv.y - uFocus);
          float blur = smoothstep(0.18, 0.5, dist) * 3.2 * uAmount;
          vec4 acc = texture2D(tDiffuse, vUv);
          float wsum = 1.0;
          if (blur > 0.05) {
            for (int i = 0; i < N; i++) {
              float a = float(i) * 2.39996;
              float r = sqrt(float(i) + 0.5) / sqrt(float(N));
              vec2 o = vec2(cos(a), sin(a)) * r * blur * px * 2.5;
              acc += texture2D(tDiffuse, vUv + o);
              wsum += 1.0;
            }
          }
          vec3 c = acc.rgb / wsum;
          // bloom: soft glow around lamps, sun-lit water, crystals, fireflies
          vec3 bl = texture2D(tBloom, vUv).rgb;
          c += bl * uBloom * (1.0 + uNight * 0.5);
          // soft highlight roll-off (keeps the pastel look, no harsh clipping)
          vec3 over = max(c - 0.82, 0.0);
          c = min(c, 0.82) + over / (1.0 + over * 2.2);
          // grading: contrast around mid-grey, saturation, warm sunsets / cool nights
          c = (c - 0.5) * uContrast + 0.5;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, uSat);
          c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), uWarm);
          c *= mix(vec3(1.0), vec3(0.95, 0.98, 1.05), uNight);
          // lifted shadows tinted slightly blue-violet, like a painted illustration
          c += vec3(0.012, 0.014, 0.03) * (1.0 - smoothstep(0.0, 0.35, l));
          // vignette
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * uVignette;
          // fine film grain (breaks banding in skies and fog)
          c += (hashP(vUv * uRes) - 0.5) * uGrain;
          gl_FragColor = vec4(max(c, 0.0), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(w: number, h: number): void {
    this.rt.setSize(w, h);
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
    (this.bright.uniforms.uPx.value as THREE.Vector2).set(1 / w, 1 / h);
  }

  private pass(r: THREE.WebGLRenderer, m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = m;
    r.setRenderTarget(target);
    r.render(this.scene, this.cam);
  }

  /** Bloom + composite; the scene must already be rendered into `rt`. */
  finish(r: THREE.WebGLRenderer): void {
    if ((this.mat.uniforms.uBloom.value as number) > 0.01) {
      this.pass(r, this.bright, this.bloomA);
      const bw = this.bloomA.width, bh = this.bloomA.height;
      for (let i = 0; i < this.passes; i++) {
        const sp = 1 + i * 1.5;
        this.blur.uniforms.tDiffuse.value = this.bloomA.texture;
        (this.blur.uniforms.uDir.value as THREE.Vector2).set(sp / bw, 0);
        this.pass(r, this.blur, this.bloomB);
        this.blur.uniforms.tDiffuse.value = this.bloomB.texture;
        (this.blur.uniforms.uDir.value as THREE.Vector2).set(0, sp / bh);
        this.pass(r, this.blur, this.bloomA);
      }
    }
    this.pass(r, this.mat, null);
  }

  dispose(): void {
    this.rt.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
  }
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  profile: QualityProfile;
  quality: Quality;
  private post: PostFX | null = null;
  cine: Cinematic | null = null;
  private env: SkyEnvironment | null = null;
  skyDome: THREE.Mesh | null = null;
  private lastDt = 1 / 60;
  private tiltAmount = 1;
  /** grading inputs, set by the game every frame */
  grade = { warm: 0, night: 0, time: 0 };
  private dynScale = 1;
  /** 0 = all effects, 1 = no tilt-shift blur, 2 = no bloom either (set by the FPS governor) */
  private fxLevel = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private goodTime = 0;
  autoQuality = true;
  fps = 60;

  constructor(private canvas: HTMLCanvasElement, quality: Quality) {
    this.quality = quality;
    this.profile = QUALITY[quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.profile.antialias && !this.profile.post, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = this.profile.shadow > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r18x
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
    this.scene.fog = new THREE.Fog(0xe0f0f8, 42, this.profile.drawDistance + 20);
    this.applyRealism();
    this.resize();
  }

  get realistic(): boolean {
    return !!this.profile.realistic;
  }

  private applyRealism(): void {
    const real = this.realistic;
    globalUniforms.uReal.value = real ? 1 : 0;
    if (real && !this.env) this.env = new SkyEnvironment(this.renderer);
    if (!real && this.env) {
      this.env.dispose(this.scene);
      this.env = null;
    }
  }

  applyQuality(q: Quality): void {
    if (this.post) {
      this.post.dispose();
      this.post = null;
    }
    this.quality = q;
    this.profile = QUALITY[q];
    this.renderer.shadowMap.enabled = this.profile.shadow > 0;
    this.renderer.shadowMap.needsUpdate = true;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.far = this.profile.drawDistance + 20;
    this.dynScale = 1;
    this.fxLevel = 0;
    this.applyRealism();
    // materials must recompile for shadow changes
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
    });
    this.resize();
  }

  get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.profile.pixelRatio) * this.dynScale;
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    globalUniforms.uAspect.value = w / h;
    if (this.realistic) {
      const pw = Math.floor(w * this.pixelRatio), ph = Math.floor(h * this.pixelRatio);
      if (this.post) { this.post.dispose(); this.post = null; }
      if (!this.cine) this.cine = new Cinematic(pw, ph, 4);
      else this.cine.setSize(pw, ph);
      return;
    }
    if (this.cine) { this.cine.dispose(); this.cine = null; }
    if (this.profile.post) {
      const pw = Math.floor(w * this.pixelRatio), ph = Math.floor(h * this.pixelRatio);
      if (!this.post) this.post = new PostFX(pw, ph, this.quality === 'ultra' ? 4 : 2, this.profile.bloomPasses);
      else this.post.setSize(pw, ph);
    } else if (this.post) {
      this.post.dispose();
      this.post = null;
    }
  }

  setTiltShift(amount: number): void {
    this.tiltAmount = amount;
  }

  /** Track FPS and adapt resolution on slow devices. */
  trackFps(dt: number): void {
    this.lastDt = dt;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc < 1.5) return;
    this.fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    if (!this.autoQuality) return;
    // keep the picture sharp: drop costly screen effects first (miniature blur,
    // then bloom), lower the resolution only a little and only as a last resort
    const minScale = Math.max(0.8, 1.25 / Math.max(1, Math.min(window.devicePixelRatio || 1, this.profile.pixelRatio)));
    if (this.fps < 48) {
      this.goodTime = 0;
      if (this.fxLevel < 2 && this.post) this.fxLevel++;
      else if (this.dynScale > minScale) {
        this.dynScale = Math.max(minScale, this.dynScale - 0.1);
        this.resize();
      }
    } else if (this.fps > 57) {
      this.goodTime += 1.5;
      if (this.goodTime > 8) {
        this.goodTime = 0;
        if (this.dynScale < 1) {
          this.dynScale = Math.min(1, this.dynScale + 0.05);
          this.resize();
        } else if (this.fxLevel > 0) this.fxLevel--;
      }
    }
  }

  /** Optional overlay drawn on top with its own depth (first-person hands). */
  overlay: { scene: THREE.Scene; camera: THREE.Camera; visible: boolean } | null = null;

  render(): void {
    if (this.cine) {
      realifyScene(this.scene);
      this.env?.update(this.lastDt, this.scene, this.skyDome);
      this.cine.night = this.grade.night;
      this.cine.render(this.renderer, this.scene, this.camera);
    } else if (this.post) {
      this.renderer.setRenderTarget(this.post.rt);
      this.renderer.render(this.scene, this.camera);
      const u = this.post.mat.uniforms;
      u.uAmount.value = this.profile.tilt && this.fxLevel < 1 ? this.tiltAmount : 0;
      u.uBloom.value = this.fxLevel >= 2 ? 0 : 0.45;
      u.uWarm.value = this.grade.warm;
      u.uNight.value = this.grade.night;
      u.uTime.value = this.grade.time % 100;
      u.uGrain.value = 0.012;
      this.post.finish(this.renderer);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.overlay?.visible) {
      const auto = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      if (this.cine) realifyScene(this.overlay.scene);
      this.renderer.render(this.overlay.scene, this.overlay.camera);
      this.renderer.autoClear = auto;
    }
  }

  /** Copy of the current frame (for cross-fading between regions). */
  snapshot(): HTMLCanvasElement | null {
    try {
      this.render(); // same task as the copy: the drawing buffer is still intact
      const src = this.renderer.domElement;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(src.width / 2));
      c.height = Math.max(1, Math.round(src.height / 2));
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      return c;
    } catch {
      return null;
    }
  }

  info(): string {
    const i = this.renderer.info;
    return `${this.fps.toFixed(0)} fps · ${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris · x${this.pixelRatio.toFixed(2)}`;
  }
}
