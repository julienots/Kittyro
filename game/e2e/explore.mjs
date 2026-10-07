import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack?.split('\n').slice(0, 3).join('\n')}`));
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 90000 }); };
const ev = (fn, a) => page.evaluate(fn, a);
const res = [];
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game);
await ev(() => localStorage.clear());
await page.getByText('Nouvelle partie').click();
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await ev(() => { const g = window.__game; for (const r of Object.keys(g.ctx.state.regions)) g.ctx.state.regions[r].unlocked = true; g.ctx.inventory.add('animal_treat', 10); g.ctx.state.player.coins = 50000; });
for (const r of ['woods', 'mountains', 'coast', 'frosty', 'ember', 'village', 'farm']) {
  await ev((r) => { window.__game.ui.closePanel(); window.__game.travel(r); }, r);
  await page.waitForTimeout(1600);
  await ev(() => window.__game.ui.closePanel());
  // force a creature + insect spawn near the player
  await ev(() => { const em = window.__game.entities; em.spawnT = 0; em.insectT = 0; em.wildAnimalT = 0; });
  await frames(40);
  const info = await ev(() => { const g = window.__game; return { wild: g.entities.wild.map((w) => `${w.kind}:${w.id}`), npcs: g.entities.npcs.map((n) => n.def.id), nodes: g.world.nodes.length, calls: g.renderer.renderer.info.render.calls }; });
  res.push(`${r}: ${JSON.stringify(info)}`);
  await page.screenshot({ path: `e2e/out/x_${r}.png` });
  // try observing a creature / catching a bug
  const did = await ev(async () => {
    const g = window.__game;
    const w = g.entities.wild.find((x) => x.kind === 'creature') ?? g.entities.wild.find((x) => x.kind === 'insect');
    if (!w) return 'none';
    g.player.teleport(w.pos.x + 1, w.pos.z + 0.5);
    w.noticed = true;
    return w.kind + ':' + w.id;
  });
  await frames(6);
  await page.keyboard.press('e');
  await frames(40);
  res.push(`  interact ${did} -> creatures=${await ev(() => Object.keys(window.__game.ctx.state.collections.creatures).length)} insects=${await ev(() => Object.keys(window.__game.ctx.state.collections.insects).length)}`);
  await ev(() => window.__game.ui.closePanel());
}
// crafting & house decor
await ev(() => { const g = window.__game; g.ctx.inventory.add('fiber', 20); g.ui.openPanel('craft', 'hand'); });
await frames(4);
await page.screenshot({ path: 'e2e/out/x_craft.png' });
await ev(() => window.__game.ui.closePanel());
await ev(() => window.__game.travel('house'));
await page.waitForTimeout(1600);
await ev(() => { const g = window.__game; g.ctx.inventory.add('sofa', 1); g.enterPlacement('sofa'); });
await frames(5);
const placed = await ev(() => { const g = window.__game; for (let x = 14; x < 20; x++) for (let z = 2; z < 7; z++) { g.placement.x = x; g.placement.z = z; g.placement.refresh(); if (g.placement.valid().ok) { g.placement.confirm(); return true; } } return false; });
res.push(`house sofa placed: ${placed}`);
await ev(() => { const g = window.__game; if (g.placement.active) g.placement.cancel(); });
await frames(10);
await page.screenshot({ path: 'e2e/out/x_house.png' });
console.log(res.join('\n'));
console.log('ERRORS', errors.length, errors.slice(0, 10).join('\n'));
await browser.close();
