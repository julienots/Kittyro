// Builds game/models/world/statue_chat.glb (the example custom model) with three.js'
// GLTFExporter inside a headless browser. Needs the dev server: npm run dev
// Usage: node tools/make-example-model.mjs [http://localhost:5173]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(base);
const b64 = await page.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const mat = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const root = new THREE.Group();
  root.name = 'statue_chat';
  const add = (geo, material, pos, rot = [0, 0, 0], scl = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
    root.add(m); return m;
  };
  const stone = mat(0xb8b0a4), stoneDark = mat(0x8a8478), fur = mat(0xf0a050), cream = mat(0xfff0d8), pink = mat(0xff9ab0), ink = mat(0x2a2030), gold = mat(0xffcf4a, 0.3, 0.6), moss = mat(0x6a9a4a);
  // pedestal
  add(new THREE.CylinderGeometry(0.75, 0.85, 0.35, 10), stoneDark, [0, 0.175, 0]);
  add(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 10), stone, [0, 0.6, 0]);
  add(new THREE.CylinderGeometry(0.72, 0.66, 0.12, 10), stoneDark, [0, 0.91, 0]);
  add(new THREE.SphereGeometry(0.22, 8, 6), moss, [0.55, 0.38, 0.35], [0, 0, 0], [1.2, 0.4, 1]);
  // sitting cat
  add(new THREE.SphereGeometry(0.42, 16, 12), fur, [0, 1.32, 0], [0, 0, 0], [1, 1.15, 0.95]);
  add(new THREE.SphereGeometry(0.3, 14, 10), cream, [0, 1.25, 0.2], [0, 0, 0], [0.8, 1, 0.7]);
  add(new THREE.SphereGeometry(0.34, 16, 12), fur, [0, 1.98, 0.08]);
  add(new THREE.SphereGeometry(0.17, 12, 8), cream, [0, 1.9, 0.33], [0, 0, 0], [1.2, 0.8, 0.7]);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.12, 0.26, 4), fur, [s * 0.2, 2.3, 0.04], [0, 0, -s * 0.3]);
    add(new THREE.ConeGeometry(0.06, 0.14, 4), pink, [s * 0.2, 2.28, 0.09], [0, 0, -s * 0.3]);
    add(new THREE.SphereGeometry(0.055, 8, 6), ink, [s * 0.12, 2.02, 0.36], [0, 0, 0], [1, 1.3, 0.6]);
    add(new THREE.SphereGeometry(0.018, 6, 4), cream, [s * 0.11, 2.05, 0.4]);
    add(new THREE.SphereGeometry(0.11, 10, 8), cream, [s * 0.16, 0.98, 0.3], [0, 0, 0], [1, 0.6, 1.4]);
    add(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), fur, [s * 0.16, 1.18, 0.28], [0.15, 0, 0]);
  }
  add(new THREE.SphereGeometry(0.035, 8, 6), pink, [0, 1.94, 0.45]);
  add(new THREE.TorusGeometry(0.3, 0.07, 8, 16, Math.PI * 1.2), fur, [0.05, 1.05, -0.32], [Math.PI / 2, 0, 0.6]);
  add(new THREE.TorusGeometry(0.2, 0.035, 6, 16), mat(0xd84a5a), [0, 1.72, 0.12], [Math.PI / 2 - 0.25, 0, 0]);
  add(new THREE.SphereGeometry(0.07, 10, 8), gold, [0, 1.64, 0.32]);
  const exporter = new GLTFExporter();
  const buf = await exporter.parseAsync(root, { binary: true });
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
});
writeFileSync(new URL('../models/world/statue_chat.glb', import.meta.url), Buffer.from(b64, 'base64'));
console.log('wrote models/world/statue_chat.glb', Buffer.from(b64, 'base64').length, 'bytes');
await browser.close();
