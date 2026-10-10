// Placement with real pointer drags + camera rotation + first-person view.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = 'e2e/out';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push(m.text()); });
const shot = (n) => page.screenshot({ path: `${out}/c_${n}.png` });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 90000 }); };
const ev = (fn, a) => page.evaluate(fn, a);
const checks = [];
const check = (n, ok, info = '') => { checks.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} ${info}`); };
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(3);
await page.getByText('Nouvelle partie').click();
await frames(2);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await frames(5);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.settings; g.settings.tips = false; const c = g.ctx; c.state.player.coins = 20000; for (const [i, q] of [['wood', 300], ['stone', 200]]) c.inventory.add(i, q, true); g.player.teleport(24, 26); g.rig.snap(g.player.pos); });
// --- placement with a real mouse drag on the canvas
await ev(() => window.__game.ui.openPanel('build'));
await frames(3);
await page.locator('.item-row', { hasText: 'Poulailler' }).getByText('Placer').click();
await frames(6);
const before = await ev(() => ({ x: window.__game.placement.x, z: window.__game.placement.z }));
await page.mouse.move(640, 360);
await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(640 + i * 18, 360 + i * 6); await frames(1); }
await page.mouse.up();
await frames(4);
const after = await ev(() => ({ x: window.__game.placement.x, z: window.__game.placement.z }));
check('drag moves the ghost', after.x !== before.x || after.z !== before.z, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
await page.locator('.nudge').first().click();
await frames(2);
const nudged = await ev(() => ({ x: window.__game.placement.x, z: window.__game.placement.z }));
check('arrow nudges one tile', Math.abs(nudged.x - after.x) + Math.abs(nudged.z - after.z) === 1);
await page.getByText('⟳ Tourner').click();
await frames(2);
check('buildings can rotate', await ev(() => window.__game.placement.rot === 1));
// find a valid spot nearby with arrows if needed
await ev(() => { const p = window.__game.placement; for (let r = 0; r < 8 && !p.valid().ok; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (p.valid().ok) break; p.x += dx; p.z += dz; p.refresh(); if (!p.valid().ok) { p.x -= dx; p.z -= dz; p.refresh(); } } });
await frames(3);
await shot('01_placing_rotated');
await page.getByText('✓ Valider').click();
await frames(8);
const coop = await ev(() => window.__game.ctx.state.farm.placed.find((p) => p.kind === 'coop'));
check('rotated coop built', !!coop && coop.rot === 1, JSON.stringify(coop));
// debris under a building is swept up
const swept = await ev(() => { const g = window.__game; const n = g.world.nodes.find((nv) => g.ctx.gathering.isDebris(nv.node) && nv.node.kind === 'weeds'); if (!n) return 'none'; const x = Math.floor(n.node.x), z = Math.floor(n.node.z); const ok = g.ctx.building.canPlace('fence_wood', x, z, 0, 'farm'); return ok.ok ? 'ok' : ok.reason; });
check('weeds no longer block construction', swept === 'ok' || swept === 'none', swept);
await shot('02_coop_built');
// --- camera rotate & tilt with a drag on the right side
const y0 = await ev(() => window.__game.rig.yawTarget);
await page.mouse.move(1000, 300); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(1000 - i * 25, 300 + i * 5); await frames(1); }
await page.mouse.up();
await frames(10);
check('drag rotates the camera', Math.abs((await ev(() => window.__game.rig.yawTarget)) - y0) > 0.3);
await shot('03_rotated_camera');
await page.locator('.cam-ctrl button').first().click();
await frames(10);
// --- first person
await ev(() => { const g = window.__game; g.player.teleport(18, 19, 0); });
await page.locator('.cam-ctrl .view').click();
await frames(15);
check('first-person view on', await ev(() => window.__game.rig.view === 'fp' && !window.__game.player.rig.root.visible));
await shot('04_fp');
await page.keyboard.down('w'); await frames(25); await page.keyboard.up('w');
await shot('05_fp_walk');
await ev(() => { window.__game.ctx.state.player.activeTool = 'axe'; window.__game.useTool(); });
await frames(6);
await shot('06_fp_axe');
await ev(() => window.__game.travel('village'));
await page.waitForTimeout(2200);
await ev(() => { const g = window.__game; g.ui.closePanel(); g.ctx.state.time.minute = 11 * 60; g.player.teleport(24, 25); g.rig.yawTarget = Math.PI; g.rig.fpPitch = 0.05; });
await frames(20);
await shot('07_fp_village');
await page.locator('.cam-ctrl .view').click();
await frames(10);
check('back to iso view', await ev(() => window.__game.rig.view === 'iso' && window.__game.player.rig.root.visible));
console.log(logs.join('\n') || 'no JS errors');
console.log(`${checks.filter(Boolean).length}/${checks.length} checks passed`);
await browser.close();
