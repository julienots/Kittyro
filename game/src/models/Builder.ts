import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * ModelBuilder: compose stylised models from primitives and merge them into a
 * single vertex-coloured geometry — one draw call per model, which keeps the
 * draw-call budget low on mid-range Android phones.
 */
export type Vec3 = [number, number, number];

export interface PartOpts {
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  /** Procedural surface pattern (see TEX), rendered by materials created with `textured`. */
  tex?: number;
}

export { TEX } from './tex';

const tmpColor = new THREE.Color();

function colorize(g: THREE.BufferGeometry, color: number, jitter = 0): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  tmpColor.setHex(color);
  // convert to linear for correct lighting with sRGB output
  const c = tmpColor.clone();
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * jitter : 1;
    arr[i * 3] = c.r * j;
    arr[i * 3 + 1] = c.g * j;
    arr[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Vertical gradient colouring (e.g. grass tufts, foliage). */
function gradientize(g: THREE.BufferGeometry, bottom: number, top: number): THREE.BufferGeometry {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const h = Math.max(0.0001, bb.max.y - bb.min.y);
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const a = new THREE.Color(bottom);
  const b = new THREE.Color(top);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / h;
    arr[i * 3] = a.r + (b.r - a.r) * t;
    arr[i * 3 + 1] = a.g + (b.g - a.g) * t;
    arr[i * 3 + 2] = a.b + (b.b - a.b) * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

export class ModelBuilder {
  parts: THREE.BufferGeometry[] = [];
  /** Default pattern for parts that don't specify one. */
  tex = 0;

  private push(g: THREE.BufferGeometry, color: number | [number, number], o: PartOpts = {}): this {
    if (!g.index) {
      // ensure indexed for merging consistency
      const count = g.attributes.position.count;
      const idx = new Uint32Array(count);
      for (let i = 0; i < count; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.aPat || o.tex !== undefined) g.setAttribute('aPat', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(o.tex ?? this.tex), 1));
    if (Array.isArray(color)) gradientize(g, color[0], color[1]);
    else colorize(g, color);
    e.set(...(o.rot ?? [0, 0, 0]));
    q.setFromEuler(e);
    v.set(...(o.pos ?? [0, 0, 0]));
    s.set(...(o.scale ?? [1, 1, 1]));
    m4.compose(v, q, s);
    g.applyMatrix4(m4);
    // drop attributes we don't need so merges stay compatible
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aPat'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
    return this;
  }

  box(w: number, h: number, d: number, color: number | [number, number], o?: PartOpts): this {
    const g = new THREE.BoxGeometry(w, h, d);
    return this.push(g, color, o);
  }

  /** Box with softly bevelled look approximated by a slightly scaled sphere-box blend (cheap). */
  rbox(w: number, h: number, d: number, color: number | [number, number], o?: PartOpts, r = 0.25): this {
    const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    const p = g.attributes.position;
    const hw = w / 2, hh = h / 2, hd = d / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // pull corners inwards for a rounded toy look
      const cx = Math.abs(x) / hw, cy = Math.abs(y) / hh, cz = Math.abs(z) / hd;
      const corner = cx * cy * cz;
      const k = 1 - corner * r;
      p.setXYZ(i, x * (cy > 0.99 && cz > 0.99 ? k : 1), y * (cx > 0.99 && cz > 0.99 ? k : 1), z * (cx > 0.99 && cy > 0.99 ? k : 1));
    }
    g.computeVertexNormals();
    return this.push(g, color, o);
  }

  sphere(r: number, color: number | [number, number], o?: PartOpts, seg = 10): this {
    return this.push(new THREE.SphereGeometry(r, seg, Math.max(6, Math.floor(seg * 0.7))), color, o);
  }

  ico(r: number, color: number | [number, number], o?: PartOpts, detail = 0): this {
    const g = new THREE.IcosahedronGeometry(r, detail);
    return this.push(g, color, o);
  }

  dodeca(r: number, color: number | [number, number], o?: PartOpts): this {
    return this.push(new THREE.DodecahedronGeometry(r, 0), color, o);
  }

  cyl(rt: number, rb: number, h: number, color: number | [number, number], o?: PartOpts, seg = 8): this {
    return this.push(new THREE.CylinderGeometry(rt, rb, h, seg), color, o);
  }

  cone(r: number, h: number, color: number | [number, number], o?: PartOpts, seg = 8): this {
    return this.push(new THREE.ConeGeometry(r, h, seg), color, o);
  }

  capsule(r: number, len: number, color: number | [number, number], o?: PartOpts): this {
    return this.push(new THREE.CapsuleGeometry(r, len, 3, 8), color, o);
  }

  torus(r: number, tube: number, color: number | [number, number], o?: PartOpts, arc = Math.PI * 2): this {
    return this.push(new THREE.TorusGeometry(r, tube, 6, 14, arc), color, o);
  }

  /** Triangular prism roof (gable), ridge along X. */
  roof(w: number, h: number, d: number, color: number, o?: PartOpts, overhang = 0.25): this {
    const W = w / 2 + overhang, D = d / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-D, 0);
    shape.lineTo(D, 0);
    shape.lineTo(0, h);
    shape.lineTo(-D, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: W * 2, bevelEnabled: false });
    g.translate(0, 0, -W);
    g.rotateY(Math.PI / 2);
    return this.push(g.index ? g.toNonIndexed() : g, color, o);
  }

  /** Flat disc. */
  disc(r: number, color: number, o?: PartOpts, seg = 16): this {
    const g = new THREE.CircleGeometry(r, seg);
    g.rotateX(-Math.PI / 2);
    return this.push(g, color, o);
  }

  plane(w: number, d: number, color: number, o?: PartOpts): this {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    return this.push(g, color, o);
  }

  /** Lathe for vases, pots, bells. points: [radius, y][] */
  lathe(points: [number, number][], color: number | [number, number], o?: PartOpts, seg = 10): this {
    return this.push(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, o);
  }

  /** Add an already built geometry (must have position/normal). */
  geo(g: THREE.BufferGeometry, color: number | [number, number], o?: PartOpts): this {
    return this.push(g, color, o);
  }

  /** Add an already coloured geometry (e.g. another builder's output), transformed but NOT recoloured. */
  merge(src: THREE.BufferGeometry, o: PartOpts = {}): this {
    const g = src.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.aPat) g.setAttribute('aPat', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(this.tex), 1));
    e.set(...(o.rot ?? [0, 0, 0]));
    q.setFromEuler(e);
    v.set(...(o.pos ?? [0, 0, 0]));
    s.set(...(o.scale ?? [1, 1, 1]));
    m4.compose(v, q, s);
    g.applyMatrix4(m4);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aPat'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g.index ? g : g);
    return this;
  }

  /** Tapered limb/lock from a to b (radius ra at a, rb at b), rounded at a. */
  limb(a: Vec3, b: Vec3, ra: number, rb: number, color: number | [number, number], seg = 8, capB = true): this {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const len = Math.max(1e-4, dir.length());
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const eul = new THREE.Euler().setFromQuaternion(quat);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    this.push(new THREE.CylinderGeometry(rb, ra, len, seg, 1, true), color, { pos: [mid.x, mid.y, mid.z], rot: [eul.x, eul.y, eul.z] });
    this.push(new THREE.SphereGeometry(ra, seg, Math.max(5, Math.floor(seg * 0.7))), Array.isArray(color) ? color[0] : color, { pos: a });
    if (capB && rb > 0.004) this.push(new THREE.SphereGeometry(rb, seg, Math.max(5, Math.floor(seg * 0.7))), Array.isArray(color) ? color[1] : color, { pos: b });
    return this;
  }

  /** Partial sphere (hair caps, hoods). theta measured from the top. */
  shell(r: number, color: number | [number, number], thetaLen: number, o?: PartOpts, seg = 18, phiStart = 0, phiLen = Math.PI * 2): this {
    return this.push(new THREE.SphereGeometry(r, seg, Math.max(6, Math.floor(seg * 0.6)), phiStart, phiLen, 0, thetaLen), color, o);
  }

  build(): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const nonIdx = this.parts.some((p) => !p.index);
    const parts = nonIdx ? this.parts.map((p) => (p.index ? p.toNonIndexed() : p)) : this.parts;
    const g = mergeGeometries(parts, false)!;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.build(), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

export const mb = () => new ModelBuilder();

/** Geometry cache so identical models are generated once. */
const geoCache = new Map<string, THREE.BufferGeometry>();
export function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
export function clearGeoCache(prefix?: string): void {
  for (const [k, g] of geoCache) {
    if (!prefix || k.startsWith(prefix)) {
      g.dispose();
      geoCache.delete(k);
    }
  }
}
