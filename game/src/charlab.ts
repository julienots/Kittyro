// Visual check harness for characters: node e2e/look ... ?charlab[&row=hair|tops|faces]
import * as THREE from 'three';
import { buildCharacter } from './models/Character';
import { buildAnimal } from './models/Animals';
import { ANIMALS } from './data/animals';
import { DEFAULT_LOOK } from './state/newGame';
import { NPCS } from './data/npcs';
import type { Appearance } from './state/types';

export function charLab(): void {
  const params = new URLSearchParams(location.search);
  const mode = params.get('row') ?? 'hair';
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setSize(window.innerWidth, window.innerHeight, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8aa070, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  if (mode === 'animals') {
    ANIMALS.forEach((a, i) => {
      const r = buildAnimal(a.id, a.colors[0], a.scale, true);
      r.root.position.set((i % 9 - 4) * 1.15, Math.floor(i / 9) * -1.6, 0);
      r.root.rotation.y = 0.6;
      scene.add(r.root);
    });
    const cam = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
    cam.position.set(0, 1.2, 12);
    cam.lookAt(0, -0.6, 0);
    const loop = () => { r.render(scene, cam); (window as any).__frames = ((window as any).__frames ?? 0) + 1; requestAnimationFrame(loop); };
    loop();
    return;
  }
  const looks: Appearance[] = [];
  const base: Appearance = { ...DEFAULT_LOOK };
  if (mode === 'hair') for (let i = 0; i < 20; i++) looks.push({ ...base, hairStyle: i, hairColor: i % 14, skin: i % 8, top: ['tee', 'overalls', 'hoodie', 'shirt', 'dress', 'tank', 'jacket', 'sweater', 'vest', 'kimono'][i % 10], topColor: [0x5ab8e8, 0xe85a5a, 0x8ad07a, 0xffd03a, 0xb08ae8][i % 5], eyeStyle: i % 5, brow: i % 4, mouth: i % 4, freckles: i % 3 === 0, lashes: i % 2 === 0, facialHair: i % 7 === 3 ? 1 + (i % 3) : 0, bottom: ['pants', 'shorts', 'skirt', 'cargo'][i % 4] });
  else for (const n of NPCS) looks.push(n.look);
  if (params.has('one')) { const k = Number(params.get('one')); looks.splice(0, looks.length, ...looks.slice(k, k + 4)); }
  const cols = params.has('one') ? 4 : mode === 'hair' ? 10 : looks.length;
  const face = params.has('face');
  looks.forEach((l, i) => {
    const c = buildCharacter(l, { outline: true });
    c.root.position.set((i % cols - (cols - 1) / 2) * (face ? 0.55 : 0.75), Math.floor(i / cols) * -(face ? 0.75 : 1.55), 0);
    c.root.rotation.y = Number(params.get('yaw') ?? 0.25);
    scene.add(c.root);
  });
  const cam = new THREE.PerspectiveCamera(face ? 22 : 30, window.innerWidth / window.innerHeight, 0.1, 100);
  const rows = Math.ceil(looks.length / cols);
  if (face && params.has('one')) { cam.fov = 14; cam.updateProjectionMatrix(); cam.position.set(0, 1.15, 6.5); cam.lookAt(0, 1.1, 0); }
  else if (face) { cam.position.set(0, 1.1 - (rows - 1) * 0.375, 9.5); cam.lookAt(0, 1.12 - (rows - 1) * 0.375, 0); }
  else { cam.position.set(0, 0.4 - (rows - 1) * 0.75, 10.5); cam.lookAt(0, 0.65 - (rows - 1) * 0.78, 0); }
  const loop = () => { r.render(scene, cam); (window as any).__frames = ((window as any).__frames ?? 0) + 1; requestAnimationFrame(loop); };
  loop();
  (window as any).__game = { lab: true };
}
