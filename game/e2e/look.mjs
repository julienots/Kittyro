// Visual check: node e2e/look.mjs <url> <outPrefix> <js-to-run-after-start> [w h]
import { chromium } from 'playwright-core';
const [url = 'http://localhost:5173/', out = 'e2e/out/look', script = '', w = '1280', hgt = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +hgt } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const frames = async (n) => { const f = await page.evaluate(() => window.__frames ?? 0); await page.waitForFunction((t) => (window.__frames ?? 0) >= t, f + n, { timeout: 90000 }); };
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await frames(3);
await page.getByText('Nouvelle partie').click();
await frames(2);
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(2500);
await frames(5);
const steps = script.split(';;');
let i = 0;
for (const s of steps) {
  if (!s.trim()) continue;
  if (s.trim().startsWith('wait')) { await page.waitForTimeout(+s.trim().slice(4)); await frames(3); continue; }
  if (s.trim() === 'shot') { await frames(4); await page.screenshot({ path: `${out}_${i++}.png` }); continue; }
  const r = await page.evaluate(s);
  if (r !== undefined) console.log('>', JSON.stringify(r));
  await frames(4);
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
