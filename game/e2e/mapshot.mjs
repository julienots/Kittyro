// Screenshot of the world map panel.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => localStorage.setItem('mm_settings', JSON.stringify({ quality: 'low', intro: false })));
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.getByText('Nouvelle partie').click();
await page.getByText('Commencer l\'aventure').click();
await page.waitForTimeout(4000);
await page.evaluate(() => { const g = window.__game; for (const r of ['village', 'woods', 'mountains', 'coast', 'hamlet', 'highlands']) g.ctx.state.regions[r].unlocked = true; g.ui.openPanel('map'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: process.argv[3] ?? 'e2e/out/map.png' });
await browser.close();
