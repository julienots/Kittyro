import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from '../render/Materials';

/**
 * Custom 3D models dropped into `game/models/` (see game/models/README.md).
 *
 *  - models/override/<key>.glb  replaces a built-in procedural model (tree_oak, rock, bench,
 *    building_barn ...). Colours and textures are baked into the game's toon vertex colours so
 *    the model keeps working with instancing, wind, snow and the see-through effect.
 *  - models/world/<name>.glb     free models placed anywhere with models/placements.json.
 *  - models/models.json          optional per-model settings (scale, rotation, offsets...).
 *
 * Files are bundled at build time (inlined in the single-file build), loaded once at boot.
 */

export interface ModelConfig {
  /** uniform scale applied after normalisation (default 1) */
  scale?: number;
  /** rotation around the vertical axis, in degrees */
  rotY?: number;
  /** vertical offset in metres after the model is put on the ground */
  y?: number;
  /** put the lowest point on the ground and centre it (default true) */
  ground?: boolean;
  /** world models only: keep the original materials instead of the toon look */
  keepMaterials?: boolean;
  /** blocks the player (world placements, default true) */
  blocks?: boolean;
}

export interface Placement {
  model: string;
  region: string;
  x: number;
  z: number;
  rot?: number; // degrees
  scale?: number;
  y?: number;
  blocks?: boolean;
}

const FILES = import.meta.glob('../../models/**/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const JSONS = import.meta.glob('../../models/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const overrides = new Map<string, THREE.BufferGeometry>();

/** Settings for a rigged character base (models/character/player.glb), in models.json. */
export interface CharacterConfig extends ModelConfig {
  /** height of the character in metres (default 1.32, like the built-in one) */
  height?: number;
  /** the model already has hair: don't add the game's hairstyles (default: add them) */
  hair?: boolean;
  /** move / resize the game's hair & hats on the head: [x, y, z] metres, scale multiplier */
  hairOffset?: [number, number, number];
  hairScale?: number;
  /** recolour skin / top / trousers / shoes from the creator (default true) */
  recolor?: boolean;
  /** skin colour used in the texture (hex string), for skin tone changes */
  refSkin?: string;
  /** relative heights (0 = feet, 1 = top of head) where the top stops, the trousers stop */
  topMax?: number;
  bottomMax?: number;
  shoesMax?: number;
}
const characters = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[]; cfg: CharacterConfig }>();

/** The rigged character base dropped in models/character/ (e.g. "player"), or null. */
export function characterBase(name = 'player'): { scene: THREE.Group; animations: THREE.AnimationClip[]; cfg: CharacterConfig } | null {
  return characters.get(name) ?? null;
}
const worldModels = new Map<string, THREE.Group>();
let configs: Record<string, ModelConfig> = {};
let placements: Placement[] = [];
const report: string[] = [];

function fileKey(path: string): { folder: string; name: string } {
  const parts = path.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1].replace(/\.glb$/i, '').toLowerCase();
  const i = parts.indexOf('models');
  const folder = (parts[i + 1] ?? '').toLowerCase();
  return { folder, name };
}

/** Sample a texture's pixels on the CPU (to bake textures into vertex colours). */
function texSampler(tex: THREE.Texture | null): ((u: number, v: number) => THREE.Color) | null {
  const img = tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width || typeof document === 'undefined') return null;
  try {
    const w = Math.min(512, img.width), h = Math.min(512, img.height);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    const out = new THREE.Color();
    const flipY = tex!.flipY;
    return (u, v) => {
      u = u - Math.floor(u);
      v = v - Math.floor(v);
      const x = Math.min(w - 1, Math.floor(u * w));
      const y = Math.min(h - 1, Math.floor((flipY ? 1 - v : v) * h));
      const i = (y * w + x) * 4;
      out.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
      return out;
    };
  } catch {
    return null;
  }
}

function applyConfig(root: THREE.Object3D, cfg: ModelConfig): void {
  const parent = root.parent;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const s = cfg.scale ?? 1;
  const pivot = new THREE.Group();
  if (cfg.ground !== false && !box.isEmpty()) {
    const c = box.getCenter(new THREE.Vector3());
    root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  }
  pivot.add(root);
  pivot.scale.setScalar(s);
  pivot.rotation.y = THREE.MathUtils.degToRad(cfg.rotY ?? 0);
  pivot.position.y = cfg.y ?? 0;
  parent?.add(pivot);
  pivot.updateMatrixWorld(true);
}

/**
 * Merge every mesh of a glTF scene into ONE geometry in the game's format
 * (position, normal, uv, color, aPat) with material colours / textures baked per vertex.
 */
function bake(scene: THREE.Object3D, cfg: ModelConfig): THREE.BufferGeometry | null {
  const holder = new THREE.Group();
  holder.add(scene);
  applyConfig(scene, cfg);
  holder.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  holder.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const count = src.attributes.position.count;
    // per-vertex material index from geometry groups
    const matOf = new Uint16Array(count);
    for (const gr of mesh.geometry.groups ?? []) {
      for (let i = gr.start; i < Math.min(count, gr.start + gr.count); i++) matOf[i] = gr.materialIndex ?? 0;
    }
    const samplers = mats.map((m) => texSampler(((m as THREE.MeshStandardMaterial)?.map) ?? null));
    const colors = new Float32Array(count * 3);
    const uv = src.attributes.uv;
    const vc = src.attributes.color;
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const m = mats[matOf[i]] as THREE.MeshStandardMaterial | undefined;
      tmp.copy(m?.color ?? new THREE.Color(1, 1, 1));
      const smp = samplers[matOf[i]];
      if (smp && uv) tmp.multiply(smp(uv.getX(i), uv.getY(i)));
      if (vc) tmp.multiply(new THREE.Color(vc.getX(i), vc.getY(i), vc.getZ(i)));
      if (m?.emissive && m.emissiveIntensity > 0) tmp.add(m.emissive.clone().multiplyScalar(m.emissiveIntensity * 0.6));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    // bake the skinned/bind pose transform into the vertices
    src.applyMatrix4(mesh.matrixWorld);
    if (!src.attributes.normal) src.computeVertexNormals();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.attributes.position);
    g.setAttribute('normal', src.attributes.normal);
    g.setAttribute('uv', uv ? src.attributes.uv : new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aPat', new THREE.BufferAttribute(new Float32Array(count), 1));
    parts.push(g);
    src = null as unknown as THREE.BufferGeometry;
  });
  if (!parts.length) return null;
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (!merged) return null;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  (merged as any).__cached = true;
  return merged;
}

/** Give a world model the game's toon look (keeps textures and colours). */
function toonify(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const conv = (m: THREE.Material) => {
      const s = m as THREE.MeshStandardMaterial;
      const t = new THREE.MeshToonMaterial({
        color: s.color ?? new THREE.Color(1, 1, 1),
        map: s.map ?? null,
        gradientMap: toonGradient(),
        transparent: s.transparent,
        opacity: s.opacity,
        alphaTest: s.alphaTest,
        side: s.side,
        vertexColors: !!(mesh.geometry.attributes.color),
      });
      if (s.emissive) {
        t.emissive = s.emissive.clone();
        t.emissiveIntensity = s.emissiveIntensity ?? 1;
        t.emissiveMap = s.emissiveMap ?? null;
      }
      return t;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
  });
}

let loaded: Promise<void> | null = null;

/** Load every bundled model once (call before the world is built). Never throws. */
export function loadExternalModels(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    for (const [path, data] of Object.entries(JSONS)) {
      const n = path.split('/').pop()!.toLowerCase();
      if (n === 'models.json' && data && typeof data === 'object') configs = data as Record<string, ModelConfig>;
      if (n === 'placements.json' && Array.isArray(data)) placements = (data as Placement[]).filter((p) => p && typeof p.model === 'string' && typeof p.region === 'string' && Number.isFinite(p.x) && Number.isFinite(p.z));
      if (n === 'placements.json' && data && !Array.isArray(data) && Array.isArray((data as any).placements)) placements = (data as any).placements;
    }
    const entries = Object.entries(FILES);
    if (!entries.length) return;
    const loader = new GLTFLoader();
    await Promise.all(entries.map(async ([path, url]) => {
      const { folder, name } = fileKey(path);
      try {
        const gltf = await loader.loadAsync(url);
        const cfg = configs[name] ?? {};
        if (folder === 'character') {
          characters.set(name, { scene: gltf.scene, animations: gltf.animations ?? [], cfg: (configs[name] ?? {}) as CharacterConfig });
          report.push(`character:${name}`);
        } else if (folder === 'world') {
          const holder = new THREE.Group();
          const scene = gltf.scene;
          holder.add(scene);
          applyConfig(scene, cfg);
          if (!cfg.keepMaterials) toonify(holder);
          else holder.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
          holder.userData.blocks = cfg.blocks !== false;
          worldModels.set(name, holder);
          report.push(`world:${name}`);
        } else {
          const geo = bake(gltf.scene, cfg);
          if (geo) {
            overrides.set(name, geo);
            report.push(`override:${name}`);
          }
        }
      } catch (e) {
        console.warn(`[models] ${path} could not be loaded`, e);
        report.push(`error:${name}`);
      }
    }));
    if (report.length) console.info('[models]', report.join(', '));
    if (typeof window !== 'undefined') (window as any).__models = { report, placements, configs, world: [...worldModels.keys()], overrides: [...overrides.keys()], characters: [...characters.keys()] };
  })();
  return loaded;
}

/** Baked geometry replacing built-in model `key` (e.g. "tree_oak", "bench", "building_barn"), or null. */
export function overrideGeo(key: string): THREE.BufferGeometry | null {
  if (!overrides.size) return null;
  return overrides.get(key.toLowerCase()) ?? null;
}

/** Fit an override into a footprint (buildings): scaled so it fills w × d. */
export function fittedOverride(key: string, w: number, d: number): THREE.BufferGeometry | null {
  const g = overrideGeo(key);
  if (!g) return null;
  const cacheKey = `${key}|${w}x${d}`;
  const hit = fitted.get(cacheKey);
  if (hit) return hit;
  const bb = g.boundingBox!;
  const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
  const cfgScale = configs[key]?.scale;
  const k = cfgScale !== undefined ? 1 : Math.min(w / Math.max(0.01, sx), d / Math.max(0.01, sz));
  const out = g.clone();
  out.scale(k, k, k);
  out.translate(w / 2, 0, d / 2);
  (out as any).__cached = true;
  fitted.set(cacheKey, out);
  return out;
}
const fitted = new Map<string, THREE.BufferGeometry>();

/** A fresh copy of a free world model, or null. */
export function worldModel(name: string): THREE.Object3D | null {
  const m = worldModels.get(name.toLowerCase());
  return m ? m.clone(true) : null;
}

export function placementsFor(region: string): Placement[] {
  return placements.filter((p) => p.region === region && worldModels.has(p.model.toLowerCase()));
}

export function externalReport(): string[] {
  return report.slice();
}
