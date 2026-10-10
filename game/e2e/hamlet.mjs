// Hamlet playtest: walk to Clairefontaine through the farm's south trail, build with the real
// placement UI, meet the first villager, sleep, collect production, talk & deliver a wish.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = 'e2e/out';
const [W, H] = (process.argv[3] ?? '1280x720').split('x').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: W < H });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const tag = `${W}x${H}`;
const shot = (n) => page.screenshot({ path: `${out}/h_${tag}_${n}.png` });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 90000 }); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const checks = [];
const check = (name, ok, info = '') => { checks.push([name, ok]); console.log(`${ok ? '✅' : '❌'} ${name} ${info}`); };

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(3);
await page.getByText('Nouvelle partie').click();
await frames(2);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await frames(5);
// walk through the south trail portal
await ev(() => { const g = window.__game; g.ui.closePanel(); g.player.teleport(23.5, 45.4); });
await page.waitForTimeout(2500);
await frames(10);
check('portal farm -> hamlet', await ev(() => window.__game.regionId === 'hamlet'));
await ev(() => window.__game.ui.closePanel());
await frames(4);
await shot('01_arrival');
// give materials, open build panel, place a cottage with the real placement UI
await ev(() => { const c = window.__game.ctx; c.state.player.coins = 20000; for (const [i, q] of [['wood', 300], ['stone', 200], ['fiber', 80], ['thatch', 20], ['rope', 10]]) c.inventory.add(i, q, true); });
await ev(() => { const g = window.__game; g.ctx.state.time.minute = 10 * 60; g.player.teleport(33, 30); g.player.faceTo(33, 34); });
await frames(4);
await ev(() => window.__game.ui.openPanel('build'));
await frames(3);
await shot('02_build_panel');
await page.locator('.item-row', { hasText: 'Chaumière' }).getByText('Placer').click();
await frames(4);
// drag the ghost to a free spot found by the logic
const spot = await ev(() => { const g = window.__game; for (let z = 28; z < 38; z++) for (let x = 28; x < 40; x++) if (g.ctx.building.canPlace('h_cottage', x, z, 0, 'hamlet').ok) return { x, z }; return null; });
await ev((p) => { const pl = window.__game.placement; pl.x = p.x; pl.z = p.z; pl.refresh(); }, spot);
await frames(3);
await shot('03_placing');
await page.getByText('✓ Valider').click();
await frames(6);
const pop1 = await ev(() => window.__game.ctx.hamlet.population());
check('cottage placed + first villager arrives', pop1 === 1, `pop=${pop1}`);
// workplace & decorations
await ev(() => { const c = window.__game.ctx; const B = c.building; const put = (k) => { for (let z = 8; z < 38; z++) for (let x = 8; x < 44; x++) if (B.canPlace(k, x, z, 0, 'hamlet').ok && B.affordable(k).ok) { B.place(k, x, z, 0, 'hamlet'); return true; } return false; }; put('h_lumber'); put('h_well'); c.state.decorOwned.bench = 1; c.state.decorOwned.flowerbed_red = 3; for (const k of ['bench', 'flowerbed_red', 'flowerbed_red', 'flowerbed_red']) put(k); window.__game.refreshWorld('placed'); });
await frames(5);
// sleep to the next morning, come back
await ev(() => window.__game.ctx.time.sleep(false));
await page.waitForTimeout(1500);
await ev(() => { window.__game.ui.closePanel(); window.__game.travel('hamlet'); });
await page.waitForTimeout(2500);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.time.minute = 9 * 60 + 30; });
await frames(30);
const st = await ev(() => { const h = window.__game.ctx.state.hamlet; return { pop: h.villagers.length, chest: h.chest.length, goals: h.goals }; });
check('morning: production in the chest', st.chest > 0, JSON.stringify(st));
check('more villagers arrived', st.pop >= 2, `pop=${st.pop}`);
// walk to the register & open it with the action button
await ev(() => { const g = window.__game; const a = g.world.layout.anchors.register; g.player.teleport(a.x, a.z + 0.6); g.player.faceTo(a.x, a.z - 1); });
await frames(8);
const act = await page.locator('.act-btn .lbl').textContent();
check('action button offers the register', /Registre/.test(act ?? ''), act);
await page.locator('.act-btn').dispatchEvent('pointerdown');
await frames(4);
await shot('04_register');
await page.getByText('🧺 Tout récupérer').click();
await frames(3);
check('collected', await ev(() => window.__game.ctx.state.hamlet.chest.length === 0));
await page.getByText('👥 Villageois').click();
await frames(2);
await shot('05_villagers');
await ev(() => window.__game.ui.closePanel());
// talk to a villager & deliver a wish
const vuid = await ev(() => { const g = window.__game; const v = g.ctx.state.hamlet.villagers[0]; v.wish = { id: 'wood', qty: 2, until: g.ctx.state.time.day + 2 }; const ag = g.entities.villagerAgent(v.uid); ag.setInside(false); ag.path = []; ag.pos.set(30, 0, 24); g.player.teleport(30, 25.2); g.player.faceTo(30, 24); return v.uid; });
await frames(12);
await ev((u) => window.__game.talkVillager(u), vuid);
await frames(6);
await shot('06_villager_dialogue');
await page.locator('.dialogue button', { hasText: 'Donner' }).click();
await frames(4);
check('wish delivered', await ev((u) => !window.__game.ctx.hamlet.villager(u).wish, vuid));
await ev(() => window.__game.ui.closeDialogue());
// overview shots: day & dusk
await ev(() => { const g = window.__game; g.player.teleport(30, 26); g.rig.snap(g.player.pos); g.ctx.state.time.minute = 11 * 60; });
await frames(20);
await shot('07_hamlet_day');
await ev(() => { window.__game.ctx.state.time.minute = 19 * 60 + 40; });
await frames(20);
await shot('08_hamlet_dusk');
// menus
for (const p of ['settings', 'guide', 'map', 'collections']) {
  await ev((n) => window.__game.ui.openPanel(n), p);
  await frames(3);
  await shot(`09_${p}`);
  await ev(() => window.__game.ui.closePanel());
}
await ev(() => window.__game.travel('farm'));
await page.waitForTimeout(2000);
await ev(() => { window.__game.ui.closePanel(); window.__game.ui.openPanel('build'); });
await frames(3);
await shot('10_farm_build');
await ev(() => window.__game.ui.closePanel());
await ev(() => window.__game.travel('village'));
await page.waitForTimeout(2000);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.time.minute = 12 * 60; g.player.teleport(22, 22); g.rig.snap(g.player.pos); });
await frames(15);
check('passers-by in Willowbrook', (await ev(() => window.__game.entities.villagers.length)) >= 2);
await shot('11_village');
console.log('info', await ev(() => window.__game.renderer.info()));
console.log(logs.slice(0, 20).join('\n') || 'no JS errors');
console.log(`${checks.filter((c) => c[1]).length}/${checks.length} checks passed`);
await browser.close();
