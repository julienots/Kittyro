// Rendering load per frame (draw calls, triangles, shadow pass included) at the farm.
import { chromium } from 'playwright-core';
const q = process.env.Q ?? 'medium';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript((qq) => localStorage.setItem('mm_settings', JSON.stringify({ quality: qq, intro: false, tips: false, autoQuality: false })), q);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.getByText('Nouvelle partie').click({ timeout: 180000 });
await page.getByText('Commencer l\'aventure').click({ timeout: 180000 });
await page.waitForTimeout(3000);
// let neighbours stream in
await page.waitForTimeout(20000);
const res = await page.evaluate(() => {
  const g = window.__game;
  const r = g.renderer.renderer;
  r.info.autoReset = false;
  r.info.reset();
  g.renderer.render();
  const out = { quality: g.renderer.quality, calls: r.info.render.calls, triangles: r.info.render.triangles, worlds: [...(g.worlds?.keys?.() ?? [])].join(','), camFar: Math.round(g.renderer.camera.far) };
  const measure = () => { r.info.reset(); g.renderer.render(); return r.info.render.triangles; };
  const total = measure();
  const parts = {};
  const probe = (name, obj) => { if (!obj || !obj.visible) return; obj.visible = false; parts[name] = total - measure(); obj.visible = true; };
  probe('backdrop', g.backdrop);
  for (const [id, w] of g.worlds) probe('world:' + id, w.root);
  const w = g.world;
  probe('act.nodes', w.nodeBatch.group); probe('act.props', w.propBatch.group); probe('act.grass', w.grassBatch.group);
  probe('act.ground', w.terrain.ground); probe('act.farm', w.farm?.group);
  probe('player', g.player.root); probe('entities', g.entities.group); probe('particles', g.particles.group);
  r.shadowMap.enabled = false; parts.shadowPass = total - measure(); r.shadowMap.enabled = true;
  out.parts = parts;
  r.info.autoReset = true;
  return out;
});
console.log(JSON.stringify(res));
await browser.close();
