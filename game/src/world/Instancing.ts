import * as THREE from 'three';

/**
 * Groups many objects sharing a geometry into InstancedMeshes (one draw call per
 * key). Used for trees, rocks, decorations, crops and grass.
 */
export interface Handle {
  key: string;
  index: number;
}

export interface BatchItem {
  key: string;
  matrix: THREE.Matrix4;
  color?: THREE.Color;
}

export type GeoProvider = (key: string) => { geo: THREE.BufferGeometry; mat: THREE.Material; shadow?: boolean } | null;

const CHUNK = 24;

export class InstanceBatch {
  meshes = new Map<string, THREE.InstancedMesh>();
  readonly group = new THREE.Group();

  constructor(private provider: GeoProvider, private castShadow = true, private receiveShadow = true) {}

  /** Rebuild every mesh from a list of items. Returns handles in the same order. */
  build(items: BatchItem[]): (Handle | null)[] {
    // one mesh per (model, 24 m cell): off-screen cells are culled, and the shadow
    // pass only draws the cells near the player
    const byKey = new Map<string, number[]>();
    items.forEach((it, i) => {
      const e = it.matrix.elements;
      const k = `${it.key}#${Math.floor(e[12] / CHUNK)},${Math.floor(e[14] / CHUNK)}`;
      let l = byKey.get(k);
      if (!l) byKey.set(k, (l = []));
      l.push(i);
    });
    // drop unused meshes
    for (const [k, m] of this.meshes) {
      if (!byKey.has(k)) {
        this.group.remove(m);
        m.dispose();
        this.meshes.delete(k);
      }
    }
    const handles: (Handle | null)[] = new Array(items.length).fill(null);
    for (const [key, list] of byKey) {
      let mesh = this.meshes.get(key);
      if (!mesh || mesh.instanceMatrix.count < list.length) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.dispose();
        }
        const g = this.provider(key.slice(0, key.lastIndexOf('#')));
        if (!g) continue;
        mesh = new THREE.InstancedMesh(g.geo, g.mat, Math.max(4, Math.ceil(list.length * 1.25)));
        mesh.castShadow = g.shadow ?? this.castShadow;
        mesh.receiveShadow = this.receiveShadow;
        mesh.frustumCulled = true; // bounds are recomputed after every rebuild
        this.meshes.set(key, mesh);
        this.group.add(mesh);
      }
      mesh.count = list.length;
      list.forEach((itemIdx, j) => {
        mesh!.setMatrixAt(j, items[itemIdx].matrix);
        const c = items[itemIdx].color;
        if (c) mesh!.setColorAt(j, c);
        handles[itemIdx] = { key, index: j };
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return handles;
  }

  setMatrix(h: Handle, m: THREE.Matrix4): void {
    const mesh = this.meshes.get(h.key);
    if (!mesh) return;
    mesh.setMatrixAt(h.index, m);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null; // recomputed lazily below (growth, shaking)
    if (!this.dirty.size) queueMicrotask(() => this.flushBounds());
    this.dirty.add(mesh);
  }

  private dirty = new Set<THREE.InstancedMesh>();
  private flushBounds(): void {
    for (const m of this.dirty) m.computeBoundingSphere();
    this.dirty.clear();
  }

  setColor(h: Handle, c: THREE.Color): void {
    const mesh = this.meshes.get(h.key);
    if (!mesh) return;
    mesh.setColorAt(h.index, c);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.meshes.values()) m.dispose();
    this.meshes.clear();
    this.group.clear();
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
export function trs(x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx, rotX = 0, rotZ = 0): THREE.Matrix4 {
  _e.set(rotX, rotY, rotZ);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.clone().compose(_p, _q, _s);
}
