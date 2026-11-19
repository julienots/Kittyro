// Touch joystick check: a finger on the left half (also over bare HUD areas) walks the hero.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 420 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ quality: 'low', intro: false, tips: false })));
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.getByText('Nouvelle partie').tap({ timeout: 180000 });
await page.getByText('Commencer l\'aventure').tap({ timeout: 180000 });
await page.waitForTimeout(4000);
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
const pos = () => page.evaluate(() => { const p = window.__game.player.pos; return [+p.x.toFixed(2), +p.z.toFixed(2)]; });
for (const [name, x, y] of [['canvas', 160, 330], ['over HUD (tracker area)', 120, 150]]) {
  const before = await pos();
  await touch('touchStart', x, y);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', x, y - i * 10); await page.waitForTimeout(80); }
  await page.waitForTimeout(1500);
  await touch('touchEnd', x, y - 60);
  const after = await pos();
  console.log(name, 'moved', Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(2));
  await page.waitForTimeout(500);
}
// lost finger: start, then no end event, then a new finger must still work
await touch('touchStart', 160, 330, 7);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
const b2 = await pos();
await touch('touchStart', 170, 330, 8);
for (let i = 1; i <= 6; i++) { await touch('touchMove', 170 + i * 10, 330, 8); await page.waitForTimeout(80); }
await page.waitForTimeout(1500);
await touch('touchEnd', 230, 330, 8);
const a2 = await pos();
console.log('after cancel moved', Math.hypot(a2[0] - b2[0], a2[1] - b2[1]).toFixed(2));
await browser.close();
