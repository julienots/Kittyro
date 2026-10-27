import * as THREE from 'three';
import type { Quality } from '../save/Settings';
import { globalUniforms } from './Materials';

export interface QualityProfile {
  pixelRatio: number;
  shadow: number; // shadow map size, 0 = blob shadows only
  post: boolean; // tilt-shift + grading
  particles: number; // budget 0..1
  grass: number; // grass density multiplier
  outlines: boolean;
  lights: number; // max dynamic point lights at night
  antialias: boolean;
  drawDistance: number;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1.0, shadow: 0, post: false, particles: 0.4, grass: 0.35, outlines: false, lights: 0, antialias: false, drawDistance: 40 },
  medium: { pixelRatio: 1.25, shadow: 1024, post: false, particles: 0.7, grass: 0.7, outlines: true, lights: 2, antialias: true, drawDistance: 55 },
  high: { pixelRatio: 1.75, shadow: 2048, post: true, particles: 1, grass: 1, outlines: true, lights: 4, antialias: true, drawDistance: 70 },
  ultra: { pixelRatio: 2.25, shadow: 4096, post: true, particles: 1, grass: 1.4, outlines: true, lights: 6, antialias: true, drawDistance: 90 },
};

/** Tilt-shift "miniature" post effect with warm grading and vignette. */
class TiltShift {
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;

  constructor(w: number, h: number, samples: number) {
    this.rt = new THREE.WebGLRenderTarget(w, h, { samples, type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(w, h) }, uFocus: { value: 0.52 }, uAmount: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus; uniform float uAmount;
        varying vec2 vUv;
        const int N = 12;
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
          // gentle grading: lift saturation, warm highlights
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.96);
          c *= vec3(1.02, 1.0, 0.97);
          // vignette
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.55;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setSize(w: number, h: number): void {
    this.rt.setSize(w, h);
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  profile: QualityProfile;
  quality: Quality;
  private post: TiltShift | null = null;
  private dynScale = 1;
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
    this.renderer.shadowMap.type = quality === 'medium' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
    this.scene.fog = new THREE.Fog(0xe0f0f8, 42, this.profile.drawDistance + 20);
    this.resize();
  }

  applyQuality(q: Quality): void {
    this.quality = q;
    this.profile = QUALITY[q];
    this.renderer.shadowMap.enabled = this.profile.shadow > 0;
    this.renderer.shadowMap.needsUpdate = true;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.far = this.profile.drawDistance + 20;
    this.dynScale = 1;
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
    if (this.profile.post) {
      const pw = Math.floor(w * this.pixelRatio), ph = Math.floor(h * this.pixelRatio);
      if (!this.post) this.post = new TiltShift(pw, ph, this.quality === 'ultra' ? 4 : 2);
      else this.post.setSize(pw, ph);
    } else if (this.post) {
      this.post.rt.dispose();
      this.post = null;
    }
  }

  setTiltShift(amount: number): void {
    if (this.post) this.post.mat.uniforms.uAmount.value = amount;
  }

  /** Track FPS and adapt resolution on slow devices. */
  trackFps(dt: number): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc < 1.5) return;
    this.fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    if (!this.autoQuality) return;
    if (this.fps < 45 && this.dynScale > 0.6) {
      this.dynScale = Math.max(0.6, this.dynScale - 0.1);
      this.goodTime = 0;
      this.resize();
    } else if (this.fps > 57) {
      this.goodTime += 1.5;
      if (this.goodTime > 8 && this.dynScale < 1) {
        this.dynScale = Math.min(1, this.dynScale + 0.05);
        this.goodTime = 0;
        this.resize();
      }
    }
  }

  /** Optional overlay drawn on top with its own depth (first-person hands). */
  overlay: { scene: THREE.Scene; camera: THREE.Camera; visible: boolean } | null = null;

  render(): void {
    if (this.post) {
      this.renderer.setRenderTarget(this.post.rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.post.scene, this.post.cam);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.overlay?.visible) {
      const auto = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
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
