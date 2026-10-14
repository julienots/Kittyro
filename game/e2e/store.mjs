// Play Store screenshots (1920x1080) of real game scenes. Usage: node e2e/store.mjs [url] [outDir]
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '../store/screenshots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 120000 }); };
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async (name) => { await ev(() => document.querySelectorAll('.toast, .tip-card').forEach((e) => e.remove())); await frames(3); await page.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(3);
await page.getByText('Nouvelle partie').click();
await frames(2);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(3000);
await frames(5);
// a lived-in save: crops, animals, restored village, a hamlet with villagers
await ev(() => {
  const g = window.__game; const c = g.ctx; const st = c.state;
  g.ui.closePanel(); g.settings.tips = false; st.flags.tips = ['controls'];
  st.player.coins = 80000; st.player.level = 6; st.time.minute = 10 * 60 + 30;
  for (const [i, q] of [['wood', 900], ['stone', 900], ['fiber', 300], ['thatch', 60], ['rope', 40], ['timber', 80], ['cut_stone', 80], ['glass', 40], ['brick', 60], ['plank', 80], ['iron_bar', 10], ['coal', 40], ['cloth', 10], ['copper_bar', 10]]) c.inventory.add(i, q, true);
  for (let x = 20; x < 30; x++) for (let z = 18; z < 23; z++) { c.farming.till(x, z); c.farming.plant(x, z, (x + z) % 3 ? 'seed_carrot' : 'seed_tulip'); const p = c.farming.plot(x, z); if (p?.crop) { p.crop.growth = 99999; p.crop.ready = (x + z) % 2 === 0; } }
  c.building.place('coop', 30, 12, 0, 'farm');
  for (const k in st.village) st.village[k].restored = true;
  st.quests.storyStep = 6;
});
await ev(() => { const g = window.__game; g.refreshWorld('all'); g.player.teleport(24, 25, Math.PI); g.rig.yawTarget = g.rig.yaw = Math.PI / 4; g.rig.snap(g.player.pos); });
await page.waitForTimeout(1500); await frames(15);
await shot('01-ferme');
// hamlet
await ev(() => window.__game.travel('hamlet'));
await page.waitForTimeout(3000);
await ev(() => {
  const g = window.__game; const c = g.ctx; g.ui.closePanel();
  const put = (k, x, z) => { if (c.building.canPlace(k, x, z, 0, 'hamlet').ok) c.building.place(k, x, z, 0, 'hamlet'); };
  for (const nv of g.world.nodes) if (c.gathering.isDebris(nv.node)) c.gathering.clear(nv.node);
  c.state.hamlet.level = 3;
  put('h_cottage', 20, 10); put('h_cottage', 30, 10); put('h_stonehouse', 33, 14); put('h_tavern', 15, 15); put('h_well', 29, 16); put('h_lumber', 16, 26); put('h_fields', 31, 26); put('h_bakery', 22, 27); put('h_bandstand', 36, 20);
  c.state.decorOwned.flowerbed_red = 6; c.state.decorOwned.lamp_post = 3; c.state.decorOwned.bench = 2;
  for (const [k, x, z] of [['flowerbed_red', 24, 15], ['flowerbed_red', 25, 15], ['flowerbed_red', 28, 15], ['lamp_post', 23, 24], ['lamp_post', 30, 24], ['bench', 25, 25]]) put(k, x, z);
  for (let i = 0; i < 6; i++) c.hamlet.arrive();
  g.refreshWorld('all');
});
await page.waitForTimeout(1500);
await ev(() => { const g = window.__game; g.ctx.state.time.minute = 11 * 60; g.player.teleport(26, 22.5); g.rig.yawTarget = g.rig.yaw = Math.PI / 4 + 0.3; g.rig.setZoom(1.25); g.rig.snap(g.player.pos); });
await page.waitForTimeout(2500); await frames(25);
await shot('02-hameau');
await ev(() => window.__game.ui.openPanel('hamlet'));
await frames(4);
await shot('03-registre');
await ev(() => window.__game.ui.closePanel());
// village at dusk
await ev(() => window.__game.travel('village'));
await page.waitForTimeout(3000);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.time.minute = 18 * 60 + 50; g.player.teleport(24, 23); g.rig.setZoom(1); g.rig.snap(g.player.pos); });
await page.waitForTimeout(1500); await frames(20);
await shot('04-village-soir');
// first person in the woods
await ev(() => { const s = window.__game.ctx.state; s.regions.woods.unlocked = true; window.__game.travel('woods'); });
await page.waitForTimeout(3000);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.time.minute = 9 * 60; g.player.teleport(30, 36, 3.6); g.ctx.state.player.activeTool = 'axe'; g.toggleView(); g.rig.fpPitch = 0.02; });
await page.waitForTimeout(2000); await frames(20);
await shot('05-premiere-personne');
await ev(() => window.__game.toggleView());
// map
await ev(() => { const s = window.__game.ctx.state; for (const r of ['mountains', 'coast', 'mine']) s.regions[r].unlocked = true; window.__game.ui.openPanel('map'); });
await frames(5);
await shot('06-carte');
await browser.close();
