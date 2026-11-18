import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Appearance } from '../state/types';
import { SKIN_TONES, HAIR_COLORS } from '../data/wardrobe';
import { characterBase, type CharacterConfig } from './External';
import { mb } from './Builder';
import { toonGradient, vcMat, globalUniforms } from '../render/Materials';
import { buildHair, buildHat, buildHeadAccessory, blobShadowMat, type CharacterRig } from './Character';

/**
 * Player built on a rigged base model (e.g. generated with Tripo and dropped in
 * game/models/character/player.glb). The game keeps full control:
 *
 *  - the usual procedural animation code drives invisible "proxy" joints (body, head,
 *    arms, legs) exactly like the built-in character; each frame those rotations are
 *    retargeted onto the model's skeleton (any bone naming, any rest pose: T-pose,
 *    A-pose... arms are brought down automatically);
 *  - the creator still works: skin tone, top / trousers / shoes colours are re-tinted
 *    in the shader from the base's neutral colours, the game's hairstyles, hats and
 *    head accessories are attached to the head bone, height is applied.
 */

const DOWN = new THREE.Vector3(0, -1, 0);
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();

interface Joint {
  bone: THREE.Bone;
  restLocal: THREE.Quaternion;
  restRoot: THREE.Quaternion;
  /** brings a T/A-pose limb down along -Y (identity for spine / head) */
  fix: THREE.Quaternion;
}

const clean = (n: string) => n.toLowerCase().replace(/^.*[:|]/, '').replace(/[\s.-]/g, '_');

function findBones(root: THREE.Object3D) {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  const by = (test: (n: string) => boolean) => bones.filter((b) => test(clean(b.name)));
  const hips = by((n) => /hips|pelvis/.test(n))[0] ?? bones[0];
  const spine = by((n) => /spine|chest/.test(n))[0] ?? null;
  const neck = by((n) => /neck/.test(n))[0] ?? null;
  const head = by((n) => /head/.test(n) && !/top|end|nub/.test(n))[0] ?? null;
  const arms = by((n) => /arm/.test(n) && !/fore|lower|low|hand|twist|shoulder|clavicle|_end/.test(n));
  const legs = by((n) => (/up_?leg|thigh|upper_?leg/.test(n)) || (/leg/.test(n) && !/low|calf|knee|foot|toe|_end|fore/.test(n)));
  const hands = by((n) => /hand|wrist/.test(n) && !/finger|thumb|index|middle|ring|pinky|_end/.test(n));
  // keep the top-most upper arm / thigh of each chain
  const topOnly = (list: THREE.Bone[]) => list.filter((b) => !list.some((o) => o !== b && isAncestor(o, b)));
  return { bones, hips, spine, neck, head, arms: topOnly(arms), legs: topOnly(legs), hands };
}

function isAncestor(a: THREE.Object3D, b: THREE.Object3D): boolean {
  for (let o = b.parent; o; o = o.parent) if (o === a) return true;
  return false;
}

/** Quaternion of `o` relative to `top` (exclusive), from local rotations only. */
function rootQ(o: THREE.Object3D, top: THREE.Object3D, out: THREE.Quaternion): THREE.Quaternion {
  out.identity();
  for (let p: THREE.Object3D | null = o; p && p !== top; p = p.parent) out.premultiply(p.quaternion);
  return out;
}

function rootPos(o: THREE.Object3D, top: THREE.Object3D): THREE.Vector3 {
  top.updateMatrixWorld(true);
  tmpM.copy(top.matrixWorld).invert().multiply(o.matrixWorld);
  return new THREE.Vector3().setFromMatrixPosition(tmpM);
}

function hexColor(h: string | undefined, fallback: number): THREE.Color {
  try { return new THREE.Color(h ?? fallback); } catch { return new THREE.Color(fallback); }
}

/** Toon material with the creator re-tint stage (skin / top / bottom / shoes masks). */
function recolorMaterial(src: THREE.Material, uniforms: Record<string, THREE.IUniform>, recolor: boolean, skinned: boolean): THREE.MeshToonMaterial {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({
    color: s.color ?? new THREE.Color(1, 1, 1),
    map: s.map ?? null,
    gradientMap: toonGradient(),
    transparent: s.transparent,
    alphaTest: s.alphaTest,
    side: s.side,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uRimColor: globalUniforms.uRimColor, uRim: globalUniforms.uRim, uShadowTint: globalUniforms.uShadowTint });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uY0; uniform float uY1; varying float vHgt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHgt = clamp((position.y - uY0) / max(uY1 - uY0, 1e-4), 0.0, 1.0);');
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uSkin, uRefSkin, uTop, uBottom, uShoes; uniform float uRecolor, uTopMax, uBottomMax, uShoesMax;
      uniform vec3 uRimColor, uShadowTint; uniform float uRim;
      varying float vHgt;`);
    if (recolor) {
      fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = mx > 0.002 ? (mx - mn) / mx : 0.0;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float h = vHgt;
        float neutral = 1.0 - smoothstep(0.1, 0.2, sat);
        float skinM = step(c.b, c.g) * step(c.g, c.r) * smoothstep(0.1, 0.2, sat) * (1.0 - smoothstep(0.62, 0.78, sat)) * step(0.04, l);
        float topM = neutral * smoothstep(0.32, 0.45, l) * step(uBottomMax * 0.7, h) * step(h, uTopMax);
        float botM = neutral * smoothstep(0.05, 0.09, l) * (1.0 - smoothstep(0.32, 0.45, l)) * step(uShoesMax, h) * step(h, uBottomMax);
        float shoeM = neutral * (1.0 - smoothstep(0.05, 0.09, l)) * step(h, uShoesMax);
        vec3 o = c;
        o = mix(o, min(c / max(uRefSkin, vec3(0.02)) * uSkin, vec3(1.2)), skinM);
        o = mix(o, uTop * (l / 0.62), topM);
        o = mix(o, uBottom * (l / 0.2), botM);
        o = mix(o, uShoes * (0.35 + l * 6.0), shoeM);
        diffuseColor.rgb = mix(c, o, uRecolor);
      }`);
    }
    fs = fs.replace('#include <opaque_fragment>', `
      {
        float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        float base = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.02);
        outgoingLight *= mix(uShadowTint, vec3(1.0), smoothstep(0.35, 0.95, clamp(lum / base, 0.0, 1.6)));
        float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(1.0 - ndv, 3.0) * uRim * (0.35 + base);
      }
      #include <opaque_fragment>`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `tripo_${recolor}_${skinned}`;
  return m;
}

/** Build the player on the rigged base, or null when there is none. */
export function buildTripoCharacter(look: Appearance, opts: { scale?: number } = {}): CharacterRig | null {
  const base = characterBase('player');
  if (!base) return null;
  const cfg: CharacterConfig = base.cfg;
  const model = cloneSkinned(base.scene) as THREE.Group;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.add(model);
  root.add(pivot);
  // normalise: feet on the ground, centred, wanted height, facing +Z
  pivot.rotation.y = THREE.MathUtils.degToRad(cfg.rotY ?? 0);
  const measure = () => {
    root.updateMatrixWorld(true);
    model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
    return new THREE.Box3().setFromObject(model, true);
  };
  let box = measure();
  const height = Math.max(0.01, box.max.y - box.min.y);
  const k = ((cfg.height ?? 1.32) / height) * (cfg.scale ?? 1);
  pivot.scale.setScalar(k);
  box = measure();
  const c = box.getCenter(new THREE.Vector3());
  pivot.position.set(-c.x, -box.min.y + (cfg.y ?? 0), -c.z);
  root.updateMatrixWorld(true);
  const H = cfg.height ?? 1.32;

  // ---------- materials (creator colours) ----------
  const skin = new THREE.Color(SKIN_TONES[look.skin % SKIN_TONES.length]);
  const uniforms: Record<string, THREE.IUniform> = {
    uSkin: { value: skin },
    uRefSkin: { value: hexColor(cfg.refSkin, 0xf2c4a0) },
    uTop: { value: new THREE.Color(look.topColor) },
    uBottom: { value: new THREE.Color(look.bottomColor) },
    uShoes: { value: new THREE.Color(look.shoesColor) },
    uRecolor: { value: cfg.recolor === false ? 0 : 1 },
    uTopMax: { value: cfg.topMax ?? 0.76 },
    uBottomMax: { value: cfg.bottomMax ?? 0.55 },
    uShoesMax: { value: cfg.shoesMax ?? 0.1 },
  };
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    // map the whole character's height (feet 0 → head 1) into this mesh's own bind space
    const m2r = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
    const a = m2r.elements[5] || 1, b = m2r.elements[13];
    const u = { ...uniforms, uY0: { value: (box.min.y - b) / a }, uY1: { value: (box.max.y - b) / a } };
    const skinned = !!(mesh as THREE.SkinnedMesh).isSkinnedMesh;
    const conv = (mm: THREE.Material) => recolorMaterial(mm, u, cfg.recolor !== false, skinned);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
  });

  // ---------- skeleton ----------
  const B = findBones(model);
  const joint = (bone: THREE.Bone | null, child?: THREE.Object3D | null): Joint | null => {
    if (!bone) return null;
    const restRoot = rootQ(bone, root, new THREE.Quaternion());
    const fix = new THREE.Quaternion();
    const kid = child ?? (bone.children.find((ch) => (ch as THREE.Bone).isBone) as THREE.Bone | undefined);
    if (kid) {
      const a = rootPos(bone, root), b = rootPos(kid, root);
      const dir = b.sub(a);
      if (dir.lengthSq() > 1e-8) fix.setFromUnitVectors(dir.normalize(), DOWN);
    }
    return { bone, restLocal: bone.quaternion.clone(), restRoot, fix };
  };
  const side = (list: THREE.Bone[], neg: boolean) => list.find((b) => (rootPos(b, root).x < 0) === neg) ?? null;
  const jSpine = joint(B.spine);
  if (jSpine) jSpine.fix.identity();
  const jHead = joint(B.head ?? B.neck);
  if (jHead) jHead.fix.identity();
  const jArmL = joint(side(B.arms, true));
  const jArmR = joint(side(B.arms, false));
  const jLegL = joint(side(B.legs, true));
  const jLegR = joint(side(B.legs, false));
  const hips = B.hips;
  const hipsRest = hips ? hips.position.clone() : new THREE.Vector3();
  const hipsScale = hips ? new THREE.Vector3().setFromMatrixScale(tmpM.copy(root.matrixWorld).invert().multiply(hips.parent!.matrixWorld)).y : 1;

  // ---------- proxies driven by the animation code ----------
  const body = new THREE.Group();
  const head = new THREE.Group();
  const armL = new THREE.Group(), armR = new THREE.Group(), legL = new THREE.Group(), legR = new THREE.Group();
  const eyes = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
  const qBody = new THREE.Quaternion(), qHead = new THREE.Quaternion(), qLimb = new THREE.Quaternion();
  const apply = (j: Joint | null, delta: THREE.Quaternion) => {
    if (!j) return;
    // target orientation relative to the rig root, then back into the bone's parent space
    tmpQ.copy(delta).multiply(j.fix).multiply(j.restRoot);
    rootQ(j.bone.parent!, root, tmpQ2);
    j.bone.quaternion.copy(tmpQ2.invert().multiply(tmpQ));
  };
  const sync = () => {
    qBody.setFromEuler(tmpE.copy(body.rotation));
    qHead.setFromEuler(tmpE.copy(head.rotation));
    apply(jSpine, qBody);
    apply(jHead, qLimb.copy(qBody).multiply(qHead));
    apply(jArmL, qLimb.copy(qBody).multiply(tmpQ2.setFromEuler(tmpE.copy(armL.rotation))));
    apply(jArmR, qLimb.copy(qBody).multiply(tmpQ2.setFromEuler(tmpE.copy(armR.rotation))));
    apply(jLegL, qLimb.setFromEuler(tmpE.copy(legL.rotation)));
    apply(jLegR, qLimb.setFromEuler(tmpE.copy(legR.rotation)));
    if (hips) hips.position.set(hipsRest.x, hipsRest.y + body.position.y / Math.max(1e-4, hipsScale), hipsRest.z);
  };
  // retarget right before the scene computes world matrices (works in every view: game, studio, other players)
  const baseUpdate = root.updateMatrixWorld.bind(root);
  root.updateMatrixWorld = (force?: boolean) => {
    sync();
    baseUpdate(force);
  };
  // neutral pose once: arms down, so the hand / head attachments are measured in that pose
  sync();
  root.updateMatrixWorld(true);

  // ---------- tool in the right hand ----------
  const toolSlot = new THREE.Group();
  const hand = B.hands.find((h) => jArmR && isAncestor(jArmR.bone, h)) ?? jArmR?.bone ?? null;
  if (hand) {
    const p = rootPos(hand, root).add(new THREE.Vector3(0.0, -0.03, 0.04));
    const want = new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    tmpM.copy(root.matrixWorld).invert().multiply(hand.matrixWorld).invert().multiply(want);
    tmpM.decompose(toolSlot.position, toolSlot.quaternion, toolSlot.scale);
    hand.add(toolSlot);
  } else root.add(toolSlot);

  // ---------- the game's hairstyles, hats & head accessories ----------
  const headBone = B.head ?? B.neck;
  if (headBone) {
    const kit = mb();
    if (cfg.hair !== false) buildHair(kit, kit, look.hairStyle, HAIR_COLORS[look.hairColor % HAIR_COLORS.length]);
    const hat = buildHat(look.hat, look.hatColor);
    if (hat) kit.merge(hat, { scale: [0.66, 0.66, 0.66] });
    buildHeadAccessory(kit, look.accessory);
    if (kit.parts.length) {
      const hp = rootPos(headBone, root);
      const top = H;
      const r = Math.max(0.05, (top - hp.y) / 2);
      const off = cfg.hairOffset ?? [0, 0, 0];
      const centre = new THREE.Vector3(hp.x + off[0], hp.y + r * 0.95 + off[1], hp.z + off[2]);
      const s = (r / 0.2) * (cfg.hairScale ?? 1);
      const mesh = new THREE.Mesh(kit.build(), vcMat({}));
      mesh.castShadow = true;
      const want = new THREE.Matrix4().compose(centre, new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      tmpM.copy(root.matrixWorld).invert().multiply(headBone.matrixWorld).invert().multiply(want);
      tmpM.decompose(mesh.position, mesh.quaternion, mesh.scale);
      headBone.add(mesh);
    }
  }

  // ---------- blob shadow, height ----------
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2), blobShadowMat);
  shadow.position.y = 0.02;
  shadow.renderOrder = -1;
  root.add(shadow);
  root.scale.setScalar((opts.scale ?? 1) * (look.height ?? 1));
  root.userData.tripo = true;
  if (typeof window !== 'undefined') (window as any).__tripo = { height, k, bones: B.bones.map((b) => b.name), arms: [jArmL?.bone.name, jArmR?.bone.name], legs: [jLegL?.bone.name, jLegR?.bone.name], head: headBone?.name, headPos: headBone ? rootPos(headBone, root).toArray() : null, box: [box.min.toArray(), box.max.toArray()] };
  return { root, body, head, eyes, armL, armR, legL, legR, toolSlot, shadow, outlines: [] };
}
