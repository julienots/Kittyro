// v1.6 checks: Highlands region, swimming, jumping, custom models. node e2e/freedom.mjs [url]
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 120000 }); };
const ev = (s) => page.evaluate(s);
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await ev(`window.__game.settings.intro = false; window.__game.settings.tips = false;`);
await frames(3);
await page.getByText('Nouvelle partie').click();
await frames(2);
await page.getByText("Commencer l'aventure").click();
await page.waitForTimeout(3000);
await frames(5);
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name} ${info}`); };
check('models loaded', (await ev(`window.__game.ctx && true`)) === true);
await ev(`window.__game.travel('highlands')`);
await page.waitForTimeout(2500); await frames(6);
check('in highlands', (await ev(`window.__game.regionId`)) === 'highlands');
check('highlands size', (await ev(`window.__game.world.layout.w * window.__game.world.layout.d`)) === 120 * 108);
check('statue placed', (await ev(`(() => { let f = false; window.__game.world.root.traverse(o => { if (o.name === 'statue_chat') f = true; }); return f; })()`)));
await ev(`window.__game.ui.closePanel()`); await frames(3);
await ev(`window.__game.player.teleport(73.5, 51.5, Math.PI); window.__game.rig.setZoom(0.8)`);
await frames(20);
await page.screenshot({ path: 'e2e/out/f_statue.png' });
// swim: lake centre
const lake = await ev(`(() => { const w = window.__game.world; for (let x = 24; x < 46; x++) if (w.isSwimTile(x + .5, 84.5)) return x + .5; return null; })()`);
check('lake swimmable', lake !== null, String(lake));
await ev(`window.__game.player.teleport(${lake ?? 30}, 84.5, -1.5)`);
await frames(15);
check('swimming', await ev(`window.__game.player.swimming`));
await page.screenshot({ path: 'e2e/out/f_swim.png' });
// walk out of the water with the keyboard toward the east shore
await page.keyboard.down('d'); await page.waitForTimeout(400); await frames(10); await page.keyboard.up('d');
// jump
await ev(`window.__game.player.teleport(46.5, 77.5, 0)`); await frames(5);
await page.keyboard.press(' ');
await frames(3);
check('jump airborne', (await ev(`window.__game.player.airY`)) > 0.05);
await page.screenshot({ path: 'e2e/out/f_jump.png' });
await frames(40);
check('landed', (await ev(`window.__game.player.airY`)) === 0);
// sprint
await page.keyboard.down('Shift'); await page.keyboard.down('w'); await page.waitForTimeout(800); await frames(15);
const sp = await ev(`Math.hypot(window.__game.player.vel.x, window.__game.player.vel.z)`);
await page.keyboard.up('w'); await page.keyboard.up('Shift');
check('sprint speed', sp > 4.5, sp.toFixed(2));
// back to the farm by the west trail
await ev(`window.__game.travel('farm', 'highlands_entry')`); await page.waitForTimeout(2500); await frames(6);
check('farm west trail', (await ev(`window.__game.regionId`)) === 'farm' && (await ev(`window.__game.world.walkable(3.2, 28.5)`)));
await ev(`window.__game.ui.closePanel()`); await frames(10);
await page.screenshot({ path: 'e2e/out/f_farm.png' });
console.log(results.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no page errors');
await browser.close();
