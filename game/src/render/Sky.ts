import * as THREE from 'three';
import { mixHex } from '../core/MathUtil';

/**
 * Sky dome + sea of clouds below the floating diorama, stars & moon at night,
 * and the day/night lighting rig (sun, hemisphere, ambient) driven by keyframes.
 */

interface Key {
  m: number; // minute of day
  zenith: number;
  horizon: number;
  below: number;
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  amb: number;
  fog: number;
  night: number;
}

const KEYS: Key[] = [
  { m: 0, zenith: 0x10183a, horizon: 0x2a3a6a, below: 0x1a2448, sun: 0x8aa0ff, sunI: 0.55, hemiSky: 0x6a7ab8, hemiGround: 0x3a4060, hemiI: 0.78, amb: 0x3a4880, fog: 0x2a3560, night: 1 },
  { m: 300, zenith: 0x1a2048, horizon: 0x5a4a7a, below: 0x2a2a58, sun: 0x9aa0e0, sunI: 0.36, hemiSky: 0x6a6ab0, hemiGround: 0x3a3050, hemiI: 0.58, amb: 0x4a4880, fog: 0x3a3a68, night: 0.9 },
  { m: 360, zenith: 0x7a9ad8, horizon: 0xffb8a0, below: 0xf0c8c8, sun: 0xffc090, sunI: 0.72, hemiSky: 0xffd8c8, hemiGround: 0x8a7a6a, hemiI: 0.66, amb: 0xc8a8a8, fog: 0xf0d0c8, night: 0.3 },
  { m: 480, zenith: 0x8fcfff, horizon: 0xfff0d8, below: 0xe8f4ff, sun: 0xfff0d8, sunI: 1.12, hemiSky: 0xdff2ff, hemiGround: 0xc0b8a0, hemiI: 0.74, amb: 0xc8d8e8, fog: 0xe0f0f8, night: 0 },
  { m: 720, zenith: 0x7ec8ff, horizon: 0xe8f8ff, below: 0xf0f8ff, sun: 0xffffff, sunI: 1.26, hemiSky: 0xe8f6ff, hemiGround: 0xc8c0a0, hemiI: 0.78, amb: 0xd0dce8, fog: 0xe8f4fa, night: 0 },
  { m: 1020, zenith: 0x8ab8f0, horizon: 0xffe0b0, below: 0xfff0d8, sun: 0xffd8a0, sunI: 1.12, hemiSky: 0xfff0d8, hemiGround: 0xa89a6a, hemiI: 0.74, amb: 0xe0c8b0, fog: 0xf8e8d0, night: 0 },
  { m: 1110, zenith: 0x6a7ac8, horizon: 0xff9a6a, below: 0xffb890, sun: 0xff9a5a, sunI: 0.90, hemiSky: 0xffb890, hemiGround: 0x8a6a5a, hemiI: 0.66, amb: 0xd8a088, fog: 0xf8b898, night: 0.15 },
  { m: 1200, zenith: 0x3a3a88, horizon: 0xb86a9a, below: 0x6a4a88, sun: 0xc88ab8, sunI: 0.54, hemiSky: 0x8a7ab8, hemiGround: 0x4a3a58, hemiI: 0.62, amb: 0x7a6aa0, fog: 0x7a5a98, night: 0.6 },
  { m: 1290, zenith: 0x141c40, horizon: 0x2e3a70, below: 0x1e2850, sun: 0x8aa0ff, sunI: 0.55, hemiSky: 0x6a7ab8, hemiGround: 0x3a4060, hemiI: 0.78, amb: 0x3a4880, fog: 0x2a3560, night: 1 },
  { m: 1440, zenith: 0x10183a, horizon: 0x2a3a6a, below: 0x1a2448, sun: 0x8aa0ff, sunI: 0.55, hemiSky: 0x6a7ab8, hemiGround: 0x3a4060, hemiI: 0.78, amb: 0x3a4880, fog: 0x2a3560, night: 1 },
];

export interface LightState {
  night: number;
  sunDir: THREE.Vector3;
  fog: THREE.Color;
  below: THREE.Color;
}

export function sampleKeys(minute: number): Key {
  const m = ((minute % 1440) + 1440) % 1440;
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (m >= KEYS[i].m && m <= KEYS[i + 1].m) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const t = (m - a.m) / Math.max(1, b.m - a.m);
  const out: any = { m };
  for (const k of Object.keys(a) as (keyof Key)[]) {
    if (k === 'm') continue;
    if (k === 'sunI' || k === 'hemiI' || k === 'night') out[k] = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
    else out[k] = mixHex(a[k] as number, b[k] as number, t);
  }
  return out as Key;
}

export class SkyRig {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  state: LightState = { night: 0, sunDir: new THREE.Vector3(), fog: new THREE.Color(), below: new THREE.Color() };
  overcast = 0; // 0..1 from weather
  storm = 0;
  flash = 0;
  indoor: 'none' | 'house' | 'cave' = 'none';
  aurora = 0;
  tint = new THREE.Color(1, 1, 1);

  constructor() {
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -16; cam.right = 16; cam.top = 16; cam.bottom = -16; cam.near = 1; cam.far = 70;
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x9ab87a, 1);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.group.add(this.sun, this.sun.target, this.hemi, this.ambient);

    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBelow: { value: new THREE.Color() },
        uNight: { value: 0 }, uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uAurora: { value: 0 }, uOvercast: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uBelow; uniform float uNight, uTime, uAurora, uOvercast; uniform vec3 uSunDir;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          float a=hash(vec3(i,0.)), b=hash(vec3(i+vec2(1,0),0.)), c=hash(vec3(i+vec2(0,1),0.)), d=hash(vec3(i+vec2(1,1),0.));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          vec3 col;
          if (d.y > 0.0) col = mix(uHorizon, uZenith, pow(d.y, 0.6));
          else {
            col = mix(uHorizon, uBelow, smoothstep(0.0, 0.35, -d.y));
            // sea of clouds under the floating world
            vec2 uv = d.xz / max(0.15, -d.y) * 1.2;
            float n = noise(uv * 1.3 + vec2(uTime*0.02, uTime*0.01)) * 0.6 + noise(uv * 3.1 - vec2(uTime*0.03, 0.)) * 0.4;
            float cl = smoothstep(0.45, 0.75, n);
            vec3 cloudCol = mix(vec3(1.0), uHorizon, 0.35) * mix(1.0, 0.35, uNight);
            col = mix(col, cloudCol, cl * smoothstep(0.02, 0.25, -d.y) * 0.85);
          }
          // stars (everywhere: we float in the sky)
          vec3 sd = floor(d * 140.0);
          float s = step(0.9965, hash(sd)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(sd + 3.0) * 30.0));
          col += vec3(s) * uNight * (1.0 - uOvercast);
          // sun / moon glow
          float sg = max(0.0, dot(d, normalize(uSunDir)));
          col += vec3(1.0, 0.9, 0.7) * pow(sg, 48.0) * (1.0 - uNight) * 0.8;
          // aurora (Frosty Peaks)
          if (uAurora > 0.0) {
            float a = sin(d.x * 6.0 + uTime * 0.4) * 0.5 + 0.5;
            float band = smoothstep(0.1, 0.5, d.y) * (1.0 - smoothstep(0.5, 0.95, d.y));
            col += mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.3, 1.0), a) * band * uAurora * 0.5 * noise(vec2(d.x * 8.0 + uTime * 0.2, d.z * 3.0));
          }
          col = mix(col, vec3(dot(col, vec3(0.33))), uOvercast * 0.45);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;
    this.group.add(this.dome);
  }

  setShadowSize(size: number): void {
    if (size <= 0) {
      this.sun.castShadow = false;
      return;
    }
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as any).map = null;
  }

  update(minute: number, time: number, focus: THREE.Vector3, scene: THREE.Scene): void {
    const k = sampleKeys(minute);
    const st = this.state;
    st.night = k.night;
    // sun path: rises east (+x), sets west, tilted south so shadows fall toward the camera's back
    const dayT = ((minute % 1440) - 360) / (1200 - 360);
    const ang = Math.PI * Math.min(1, Math.max(0, dayT));
    const night = k.night > 0.6;
    if (!night) st.sunDir.set(Math.cos(ang) * 0.8, Math.max(0.45, Math.sin(ang)), -0.55).normalize();
    else st.sunDir.set(-0.4, 0.8, -0.5).normalize(); // moonlight
    const over = this.overcast;
    const dim = 1 - over * 0.45 - this.storm * 0.2;
    const tc = (hex: number) => new THREE.Color(hex);
    if (this.indoor === 'house') {
      this.sun.color.set(0xfff0d8);
      this.sun.intensity = 1.0;
      this.hemi.color.set(0xfff4e8);
      this.hemi.groundColor.set(0xb08a6a);
      this.hemi.intensity = 1.05;
      this.ambient.color.set(0xffe8d0);
      this.ambient.intensity = 0.5;
      st.sunDir.set(0.35, 1, 0.45).normalize();
      st.fog.set(0xfff4e0);
      st.night = k.night * 0.6;
    } else if (this.indoor === 'cave') {
      this.sun.color.set(0xb8b0e0);
      this.sun.intensity = 0.7;
      this.hemi.color.set(0xb0a8d8);
      this.hemi.groundColor.set(0x6a5a60);
      this.hemi.intensity = 1.25;
      this.ambient.color.set(0x8a7aa0);
      this.ambient.intensity = 0.55;
      st.sunDir.set(0.2, 1, 0.3).normalize();
      st.fog.set(0x1a1420);
      st.night = 1;
    } else {
      this.sun.color.copy(tc(k.sun)).multiply(this.tint);
      this.sun.intensity = k.sunI * dim + this.flash * 2;
      this.hemi.color.copy(tc(k.hemiSky)).lerp(new THREE.Color(0xb8c0c8), over * 0.4);
      this.hemi.groundColor.copy(tc(k.hemiGround));
      this.hemi.intensity = k.hemiI * (1 - over * 0.15) + this.flash;
      this.ambient.color.copy(tc(k.amb));
      this.ambient.intensity = 0.18 + this.flash;
      st.fog.copy(tc(k.fog)).lerp(new THREE.Color(0xc8ccd4), over * 0.5);
    }
    st.below.copy(tc(k.below));
    this.sun.position.copy(focus).addScaledVector(st.sunDir, 30);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    const u = this.domeMat.uniforms;
    (u.uZenith.value as THREE.Color).copy(tc(this.indoor === 'cave' ? 0x0a0810 : k.zenith));
    (u.uHorizon.value as THREE.Color).copy(tc(this.indoor === 'cave' ? 0x1a1420 : this.indoor === 'house' ? 0xf0e0c8 : k.horizon));
    (u.uBelow.value as THREE.Color).copy(tc(this.indoor === 'cave' ? 0x0a0810 : this.indoor === 'house' ? 0xd8c0a0 : k.below));
    u.uNight.value = this.indoor === 'house' ? 0 : st.night;
    u.uTime.value = time;
    u.uOvercast.value = over;
    u.uAurora.value = this.aurora * st.night;
    (u.uSunDir.value as THREE.Vector3).copy(st.sunDir);
    this.dome.position.copy(focus);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(st.fog);
    this.flash = Math.max(0, this.flash - 0.05);
  }
}
