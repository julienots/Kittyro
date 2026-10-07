// Deep system playtest driving the real game through its runtime API + input.
import { chromium } from 'playwright-core';
const url = 'http://localhost:5173/';
const out = 'e2e/out';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`[console] ${m.text()}`); });
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 90000 }); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };

await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.getByText('Nouvelle partie').click();
await frames(3);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await frames(5);

// --- farming via real tool use
await ev(() => { const g = window.__game; g.player.teleport(30.5, 30.5, Math.PI / 2); g.ctx.state.player.activeTool = 'hoe'; });
await frames(3);
for (let i = 0; i < 2; i++) { await page.keyboard.press('f'); await frames(16); }
let plots = await ev(() => Object.keys(window.__game.ctx.state.farm.plots).length);
check('till with hoe', plots > 8, `plots=${plots}`);
await ev(() => window.__game.selectSeed('seed_lettuce'));
await page.keyboard.press('e'); await frames(16);
const planted = await ev(() => Object.values(window.__game.ctx.state.farm.plots).filter((p) => p.crop).length);
check('plant via action', planted >= 1, `crops=${planted}`);
await ev(() => { window.__game.ctx.state.player.activeTool = 'can'; });
await page.keyboard.press('f'); await frames(18);
const watered = await ev(() => Object.values(window.__game.ctx.state.farm.plots).filter((p) => p.watered).length);
check('water with can', watered >= 1, `watered=${watered}`);
await ev(() => window.__game.ctx.farming.tick(600));
await frames(5);
await shot('s01_grown');
await page.keyboard.press('e'); await frames(16);
const lettuce = await ev(() => window.__game.ctx.inventory.count('lettuce'));
check('harvest', lettuce >= 1, `lettuce=${lettuce}`);

// --- chop a tree and mine a rock (auto tool)
const nodeRes = await ev(() => {
  const g = window.__game;
  const tree = g.world.nodes.find((n) => n.node.kind === 'tree_oak' && n.growth >= 1);
  const rock = g.world.nodes.find((n) => n.node.kind === 'rock' && n.growth >= 1);
  return { tree: tree && [tree.node.x, tree.node.z, tree.node.id], rock: rock && [rock.node.x, rock.node.z, rock.node.id] };
});
const woodBefore = await ev(() => window.__game.ctx.inventory.count('wood'));
await ev((t) => { const g = window.__game; g.player.teleport(t[0] + 1.0, t[1]); g.player.faceTo(t[0], t[1]); }, nodeRes.tree);
for (let i = 0; i < 6; i++) { await page.keyboard.press('e'); await frames(14); }
const woodAfter = await ev(() => window.__game.ctx.inventory.count('wood'));
check('chop tree', woodAfter > woodBefore, `${woodBefore}->${woodAfter}`);
await shot('s02_chopped');
await ev((t) => { const g = window.__game; g.player.teleport(t[0] + 0.9, t[1]); g.player.faceTo(t[0], t[1]); }, nodeRes.rock);
for (let i = 0; i < 6; i++) { await page.keyboard.press('e'); await frames(14); }
const stone = await ev(() => window.__game.ctx.inventory.count('stone'));
check('mine rock', stone > 0, `stone=${stone}`);

// --- shipping bin sell
const coins0 = await ev(() => window.__game.ctx.state.player.coins);
await ev(() => window.__game.ctx.economy.sell('lettuce', 1));
check('sell', (await ev(() => window.__game.ctx.state.player.coins)) > coins0);

// --- village: restore shop, buy seeds, adopt
await ev(() => { const g = window.__game; g.ctx.inventory.add('wood', 200); g.ctx.inventory.add('stone', 100); g.ctx.state.player.coins = 20000; g.travel('village'); });
await page.waitForTimeout(1500); await frames(10);
const restored = await ev(() => window.__game.ctx.village.contribute('shop').restored);
check('restore shop', restored);
await page.waitForTimeout(800); await frames(10);
await ev(() => { const g = window.__game; g.ui.closePanel(); });
await shot('s03_village_restored');
await ev(() => window.__game.ui.openPanel('shop', 'general'));
await frames(3);
await shot('s04_shop');
await ev(() => window.__game.ui.closePanel());
// talk to Mallow through the action button
const talked = await ev(() => { const g = window.__game; const m = g.entities.npc('mallow'); if (!m) return 'no mallow'; g.player.teleport(m.pos.x + 0.8, m.pos.z + 0.5); g.player.faceTo(m.pos.x, m.pos.z); return 'ok'; });
await frames(5); await page.keyboard.press('e'); await frames(8);
check('dialogue opens', await ev(() => !!window.__game.ui.dialogueEl), talked);
await shot('s05_mallow');
await ev(() => window.__game.ui.closeDialogue());

// --- build a coop on the farm & adopt chicken
await ev(() => window.__game.travel('farm'));
await page.waitForTimeout(1500); await frames(10);
await ev(() => { const g = window.__game; g.ctx.inventory.add('wood', 50); g.ctx.inventory.add('stone', 30); g.player.teleport(32, 26); });
await ev(() => window.__game.enterPlacement('coop'));
await frames(5);
await shot('s06_placement');
const placedOk = await ev(() => { const g = window.__game; for (let x = 26; x < 36; x++) for (let z = 26; z < 34; z++) { g.placement.x = x; g.placement.z = z; g.placement.refresh(); if (g.placement.valid().ok) { g.placement.confirm(); return true; } } return false; });
check('place coop', placedOk && (await ev(() => window.__game.ctx.building.count('coop'))) === 1);
const chick = await ev(() => !!window.__game.ctx.animals.adopt('chicken'));
check('adopt chicken', chick);
await frames(20);
await shot('s07_coop_chicken');

// --- sleep to next day: production
await ev(() => { const a = window.__game.ctx.state.animals[0]; a.hunger = 100; a.happiness = 90; window.__game.sleep(); });
await page.waitForTimeout(2500); await frames(10);
check('slept to day 2', (await ev(() => window.__game.ctx.state.time.day)) === 2);
check('in house after sleep', (await ev(() => window.__game.regionId)) === 'house');
await shot('s08_house_morning');
await ev(() => window.__game.ui.closePanel());
check('egg produced', (await ev(() => window.__game.ctx.state.animals[0].product)) === 'egg');

// --- fishing: start and force catch
await ev(() => window.__game.travel('farm'));
await page.waitForTimeout(1500); await frames(8);
const fishOk = await ev(() => { const g = window.__game; g.ui.closePanel(); g.player.teleport(42.2, 30, Math.PI / 2); const w = g.world.waterInFront(42.2, 30, Math.PI / 2, 3); if (!w) return 'nowater'; g.fishing.start(w, 'farm'); return 'ok'; });
await frames(30);
await ev(() => { const f = window.__game.fishing; f.t = 99; });
await frames(6);
await page.keyboard.press('e');
await frames(8);
await shot('s09_fishing');
await ev(() => { const f = window.__game.fishing; f.progress = 2; });
await frames(6);
check('fish caught', (await ev(() => Object.keys(window.__game.ctx.state.collections.fish).length)) > 0, fishOk);
await ev(() => window.__game.ui.closePanel());

// --- mine
await ev(() => { const g = window.__game; g.ctx.state.regions.mountains.unlocked = true; g.ctx.state.regions.mine.unlocked = true; g.goMine(1); });
await page.waitForTimeout(2000); await frames(10);
check('in mine', (await ev(() => window.__game.regionId)) === 'mine');
await shot('s10_mine');
const ladder = await ev(() => { const g = window.__game; const r = g.mineFloor.rocks.find((q) => q.ladder); g.ctx.state.player.tools.pickaxe = 4; const nv = g.world.node(r.id); for (let i = 0; i < 10; i++) g.ctx.gathering.hit(nv.node, 'pickaxe'); return !!g.mineLadderPos; });
check('ladder revealed', ladder);
await ev(() => window.__game.goMine(2));
await page.waitForTimeout(2000); await frames(5);
check('mine floor 2', (await ev(() => window.__game.ctx.state.mine.deepest)) >= 2);

// --- festival minigame
await ev(() => { const g = window.__game; g.travel('village'); });
await page.waitForTimeout(1500); await frames(5);
await ev(() => window.__game.startMinigame('harvest'));
await frames(5);
await page.getByText('▶ Jouer').click();
await frames(20);
await shot('s11_minigame');
const box = await page.locator('canvas.mg-canvas').boundingBox();
for (let i = 0; i < 12; i++) { await page.mouse.click(box.x + box.width * Math.random(), box.y + box.height * (0.3 + Math.random() * 0.6)); await frames(2); }
await page.locator('.minigame .btn.ghost').click();
check('minigame closed', (await ev(() => document.querySelector('.minigame') === null)));

// --- weather & seasons visuals
await ev(() => { const g = window.__game; g.travel('farm'); });
await page.waitForTimeout(1500); await frames(5);
await ev(() => { const g = window.__game; g.ctx.state.weather.current = 'rain'; });
await frames(60);
await shot('s12_rain');
await ev(() => { const g = window.__game; g.ctx.state.weather.current = 'sun'; g.ctx.state.weather.rainbowUntil = g.ctx.state.absMinute + 100; g.ctx.state.time.day = 30; g.loadRegion('farm', null, true, { x: g.player.pos.x, z: g.player.pos.z }); });
await frames(40);
await shot('s13_autumn_rainbow');
await ev(() => { const g = window.__game; g.ctx.state.weather.current = 'snow'; g.ctx.state.time.day = 40; g.loadRegion('farm', null, true, { x: g.player.pos.x, z: g.player.pos.z }); });
await frames(60);
await shot('s14_winter_snow');

// --- save & reload
await ev(async () => { await window.__game.save(); });
const before = await ev(() => ({ day: window.__game.ctx.state.time.day, coins: window.__game.ctx.state.player.coins, animals: window.__game.ctx.state.animals.length }));
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(5);
await page.getByText('Continuer').click();
await page.waitForTimeout(2000); await frames(5);
const after = await ev(() => ({ day: window.__game.ctx.state.time.day, coins: window.__game.ctx.state.player.coins, animals: window.__game.ctx.state.animals.length }));
check('save/load roundtrip', before.day === after.day && before.animals === after.animals && Math.abs(before.coins - after.coins) < 1, JSON.stringify({ before, after }));
await shot('s15_continued');

console.log(results.join('\n'));
console.log('ERRORS:', errors.length);
console.log(errors.slice(0, 15).join('\n'));
await browser.close();
