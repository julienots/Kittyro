// Scripted playtest: new game -> creator -> walk, talk, till, plant, water, menus, save.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = 'e2e/out';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 60000 }); };
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(5);
await shot('p01_title');
await page.getByText('Nouvelle partie').click();
await frames(3);
await shot('p02_creator');
await page.getByText('Commencer l\'aventure').click();
await wait(2500);
await frames(5);
await shot('p03_start');
const state = () => page.evaluate(() => { const g = window.__game; const s = g.ctx.state; return { region: s.player.region, x: s.player.x.toFixed(1), z: s.player.z.toFixed(1), quest: g.ctx.quests.story?.id, coins: s.player.coins, plots: Object.keys(s.farm.plots).length, time: s.time.minute }; });
console.log('start', await state());
// walk toward Moss with keyboard
await page.keyboard.down('d'); await frames(20); await page.keyboard.up('d');
console.log('after walk', await state());
// talk to moss via game API: teleport near & action
await page.evaluate(() => { const g = window.__game; const m = g.entities.npc('moss'); g.player.teleport(m.pos.x + 0.9, m.pos.z + 0.6); g.player.faceTo(m.pos.x, m.pos.z); });
await frames(6);
await page.keyboard.press('e');
await frames(10);
await shot('p04_dialogue');
await page.evaluate(() => window.__game.ui.closeDialogue());
// claim quest
await page.evaluate(() => window.__game.ctx.quests.claim('s0'));
console.log('quest', await state());
// till / plant / water in front of the start plots
await page.evaluate(() => { const g = window.__game; g.player.teleport(26.5, 22.5, Math.PI); });
await frames(4);
for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.keyboard.press('f'); await frames(25); }
await page.keyboard.press('e'); await frames(25);
await page.keyboard.press('2'); await page.keyboard.press('f'); await frames(30);
await shot('p05_farming');
console.log('farm', await state(), await page.evaluate(() => JSON.stringify(Object.values(window.__game.ctx.state.farm.plots).slice(-3))));
// open panels
for (const p of ['inventory', 'quests', 'collections', 'map', 'build', 'settings', 'pass']) {
  await page.evaluate((n) => window.__game.ui.openPanel(n), p);
  await frames(4);
  await shot(`p06_${p}`);
  await page.evaluate(() => window.__game.ui.closePanel());
}
// travel to village & night
await page.evaluate(() => { const g = window.__game; g.ctx.state.regions.village.unlocked = true; g.travel('village'); });
await wait(1500); await frames(10);
await shot('p07_village');
await page.evaluate(() => { const g = window.__game; g.ctx.state.time.minute = 22 * 60; });
await frames(10);
await shot('p08_night');
// save/load round trip
const saved = await page.evaluate(async () => await window.__game.save());
console.log('saved', saved);
console.log('final', await state());
console.log('info', await page.evaluate(() => window.__game.renderer.info()));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
