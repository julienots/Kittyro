// Builds a simple rigged T-pose mannequin (Mixamo-style bone names, neutral colours:
// peach skin, white top, grey trousers, black shoes) to test models/character/.
// Usage (dev server running): node tools/make-test-character.mjs [out.glb]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'e2e/out/test_player.glb';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
const b64 = await page.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const bones = {};
  const mk = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; const p = parent ? bones[parent] : null; const wp = p ? p.userData.w : new THREE.Vector3(); b.position.set(x - wp.x, y - wp.y, z - wp.z); b.userData.w = new THREE.Vector3(x, y, z); if (p) p.add(b); bones[name] = b; return b; };
  mk('mixamorig:Hips', null, 0, 0.62, 0); mk('mixamorig:Spine', 'mixamorig:Hips', 0, 0.72, 0); mk('mixamorig:Neck', 'mixamorig:Spine', 0, 0.98, 0); mk('mixamorig:Head', 'mixamorig:Neck', 0, 1.04, 0); mk('mixamorig:HeadTop_End', 'mixamorig:Head', 0, 1.32, 0);
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    mk(`mixamorig:${n}Arm`, 'mixamorig:Spine', s * 0.17, 0.93, 0); mk(`mixamorig:${n}ForeArm`, `mixamorig:${n}Arm`, s * 0.37, 0.93, 0); mk(`mixamorig:${n}Hand`, `mixamorig:${n}ForeArm`, s * 0.55, 0.93, 0);
    mk(`mixamorig:${n}UpLeg`, 'mixamorig:Hips', s * 0.08, 0.58, 0); mk(`mixamorig:${n}Leg`, `mixamorig:${n}UpLeg`, s * 0.08, 0.32, 0); mk(`mixamorig:${n}Foot`, `mixamorig:${n}Leg`, s * 0.08, 0.06, 0);
  }
  const list = Object.values(bones);
  const skeleton = new THREE.Skeleton(list);
  const root = new THREE.Group(); root.name = 'TestMannequin';
  root.add(bones['mixamorig:Hips']);
  root.updateMatrixWorld(true);
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const SKIN = 0xf2c4a0, TOP = 0xf4f4f4, BOT = 0x7a7a7a, SHOE = 0x1e1e1e;
  const part = (geo, color, bone, x, y, z, rz = 0) => {
    geo.rotateZ(rz); geo.translate(x, y, z);
    const n = geo.attributes.position.count, bi = list.indexOf(bones[bone]);
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? bi : 0)), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    const m = new THREE.SkinnedMesh(geo, mat(color)); root.add(m); m.bind(skeleton); return m;
  };
  part(new THREE.BoxGeometry(0.34, 0.3, 0.2), TOP, 'mixamorig:Spine', 0, 0.83, 0);
  part(new THREE.BoxGeometry(0.3, 0.14, 0.19), BOT, 'mixamorig:Hips', 0, 0.62, 0);
  part(new THREE.SphereGeometry(0.17, 16, 12), SKIN, 'mixamorig:Head', 0, 1.16, 0);
  part(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), SKIN, 'mixamorig:Neck', 0, 1.0, 0);
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    part(new THREE.SphereGeometry(0.03, 8, 6), 0x101010, 'mixamorig:Head', s * 0.06, 1.18, 0.15);
    part(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 8), TOP, `mixamorig:${n}Arm`, s * 0.27, 0.93, 0, Math.PI / 2);
    part(new THREE.CylinderGeometry(0.04, 0.035, 0.18, 8), SKIN, `mixamorig:${n}ForeArm`, s * 0.46, 0.93, 0, Math.PI / 2);
    part(new THREE.SphereGeometry(0.045, 8, 6), SKIN, `mixamorig:${n}Hand`, s * 0.58, 0.93, 0);
    part(new THREE.CylinderGeometry(0.065, 0.055, 0.26, 8), BOT, `mixamorig:${n}UpLeg`, s * 0.08, 0.45, 0);
    part(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 8), BOT, `mixamorig:${n}Leg`, s * 0.08, 0.19, 0);
    part(new THREE.BoxGeometry(0.1, 0.07, 0.18), SHOE, `mixamorig:${n}Foot`, s * 0.08, 0.035, 0.03);
  }
  const buf = await new GLTFExporter().parseAsync(root, { binary: true });
  const bytes = new Uint8Array(buf); let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
});
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote', out);
await browser.close();
