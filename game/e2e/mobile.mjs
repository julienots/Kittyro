// Phone viewport checks (landscape & portrait) against any URL, with touch.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5180/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, w, h] of [['land', 844, 390], ['port', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__game && (window.__frames ?? 0) > 3, null, { timeout: 90000 });
  await page.getByText('Nouvelle partie').tap();
  await page.waitForTimeout(800);
  await page.getByText('Commencer l\'aventure').tap();
  await page.waitForTimeout(3000);
  // drag the joystick
  const cdp = await ctx.newCDPSession(page);
  const sx = w * 0.18, sy = h * 0.75;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 5, y: sy - i * 2 }] }); await page.waitForTimeout(60); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `e2e/out/m_${name}_joy.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const moved = await page.evaluate(() => window.__game.ctx.state.stats.walked ?? 0);
  console.log(name, 'walked', moved.toFixed(2), 'quality', await page.evaluate(() => window.__game.settings.quality));
  await page.evaluate(() => window.__game.ui.openPanel('quests'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `e2e/out/m_${name}_quests.png` });
  await ctx.close();
}
console.log('errors', errors);
await browser.close();
