// Usage: node e2e/shot.mjs <url> <out.png> [waitFrames] [w] [h]
import { chromium } from 'playwright-core';
const [url, out, frames = '30', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url);
try {
  await page.waitForFunction((n) => (window.__frames ?? 0) >= n, +frames, { timeout: 90000 });
} catch (e) { logs.push('timeout waiting frames'); }
await page.screenshot({ path: out });
const info = await page.evaluate(() => window.__info);
console.log('info:', info);
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
