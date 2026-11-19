// Close-ups of region borders (farm|village, village|coast) to check the ground is seamless.
import { chromium } from 'playwright-core';
const q = process.env.Q ?? 'medium';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push(m.text()); });
await page.addInitScript((qq) => localStorage.setItem('mm_settings', JSON.stringify({ quality: qq, intro: false, tips: false, tracker: false })), q);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.getByText('Nouvelle partie').click({ timeout: 180000 });
await page.getByText('Commencer l\'aventure').click({ timeout: 180000 });
await page.waitForTimeout(3000);
const go = async (region, x, z, name, yaw = 0) => {
  await page.evaluate(([r, x, z, yaw]) => {
    const g = window.__game;
    for (const k of ['village', 'coast']) g.ctx.state.regions[k].unlocked = true;
    if (g.world.region !== r) g.loadRegion(r, null, true, { x, z });
    g.player.teleport(x, z); g.rig.snap(g.player.pos); g.rig.yawTarget = g.rig.yaw = yaw; g.rig.setZoom(0.9); for (const r of Object.values(g.ctx.state.regions)) r.visited = true;
    g.ctx.state.time.minute = 11 * 60;
  }, [region, x, z, yaw]);
  await page.waitForFunction(() => window.__game.worlds.size >= 3, null, { timeout: 300000 });
  const f = await page.evaluate(() => window.__frames);
  await page.waitForFunction((t) => window.__frames >= t, f + 25, { timeout: 300000 });
  await page.screenshot({ path: `e2e/out/seam_${name}_${q}.png` });
};
await go('farm', 64.6, 24, 'farm_village');
await go('village', 58.8, 50.5, 'village_coast');
await go('farm', 27, 57, 'farm_hamlet');
console.log(logs.slice(0, 10).join('\n') || 'no errors');
await browser.close();
