// Open world check: walk from the farm across the borders, no loading screens.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'e2e/out';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
if (process.env.Q) await page.addInitScript((q) => localStorage.setItem('mm_settings', JSON.stringify({ quality: q, intro: false })), process.env.Q);
else await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ quality: 'medium', intro: false })));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 120000 }); };
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await frames(5);
await page.getByText('Nouvelle partie').click();
await frames(3);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await frames(10);
const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByText('Super !'); if (await b.count()) { await b.first().click().catch(() => {}); await frames(3); } } };
const st = () => page.evaluate(() => { const g = window.__game; return { region: g.world.region, x: +g.player.pos.x.toFixed(1), z: +g.player.pos.z.toFixed(1), loaded: [...g.worlds.keys()].join(','), info: g.renderer.info() }; });
// let the neighbours stream in
await frames(40);
console.log('start', await st());
await page.evaluate(() => { const g = window.__game; g.ui.closePanel?.(); g.rig.setZoom(2.4); });
await frames(20);
await shot('ow01_farm_far');
// walk east from the farm into Willowbrook
await page.evaluate(() => { const g = window.__game; g.rig.yawTarget = g.rig.yaw = 0; g.ctx.state.regions.village.unlocked = true; g.player.teleport(62.5, 24); g.rig.snap(g.player.pos); });
await frames(5);
await page.keyboard.down('d');
for (let i = 0; i < 12; i++) { await frames(8); const s = await st(); if (s.region !== 'farm') { console.log('crossed', s); break; } }
await page.keyboard.up('d');
await frames(20);
await dismiss();
console.log('after east', await st());
await shot('ow02_village_edge');
// south road out of the village towards the coast
await page.evaluate(() => { const g = window.__game; g.ctx.state.regions.coast.unlocked = true; g.player.teleport(58.5, 50.5); g.rig.snap(g.player.pos); });
await page.evaluate(() => { window.__game.rig.yawTarget = window.__game.rig.yaw = 0; });
await frames(5);
await page.keyboard.down('d');
for (let i = 0; i < 12; i++) { await frames(8); const s = await st(); if (s.region !== 'village') { console.log('crossed', s); break; } }
await page.keyboard.up('d');
await frames(20);
await dismiss();
console.log('after coast', await st());
await shot('ow03_coast');
// back west into the village
await page.keyboard.down('a');
for (let i = 0; i < 12; i++) { await frames(8); const s = await st(); if (s.region !== 'coast') { console.log('crossed back', s); break; } }
await page.keyboard.up('a');
await frames(10);
await dismiss();
console.log('back', await st());
await page.evaluate(() => { const g = window.__game; g.rig.setZoom(1); });
await frames(20);
await shot('ow04_village_close');
console.log(logs.filter((l) => !l.includes('GL Driver') && !l.includes('404')).slice(0, 30).join('\n'));
await browser.close();
