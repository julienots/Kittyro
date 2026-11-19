// Bird's-eye view of the whole open world (title-screen demo farm + all regions).
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'e2e/out/world_overview.png';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ quality: 'medium', intro: false })));
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
// wait until every neighbour of the farm streamed in
await page.waitForFunction(() => window.__game.worlds.size >= 6, null, { timeout: 300000 });
const info = await page.evaluate(() => {
  const g = window.__game;
  g.running = false; // freeze the loop, we drive the camera
  const cam = g.renderer.camera;
  g.renderer.scene.fog.far = 2000; g.renderer.scene.fog.near = 1500;
  cam.far = 3000; cam.fov = 50; cam.updateProjectionMatrix();
  cam.position.set(40, 260, 210); cam.lookAt(40, 0, 10);
  g.renderer.render();
  return { worlds: [...g.worlds.keys()] };
});
console.log(info);
await page.screenshot({ path: out });
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
