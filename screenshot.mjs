import pw from '/tmp/.npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.js';
const { chromium } = pw;
import { mkdirSync } from 'fs';

mkdirSync('docs/screenshots/review', { recursive: true });

const configs = [
  { name: 'desktop-1440x900-viewport', width: 1440, height: 900, fullPage: false },
  { name: 'desktop-1440x900-fullpage', width: 1440, height: 900, fullPage: true },
  { name: 'desktop-1920x1080-viewport', width: 1920, height: 1080, fullPage: false },
  { name: 'desktop-1920x1080-fullpage', width: 1920, height: 1080, fullPage: true },
  { name: 'mobile-iphone14-viewport', width: 390, height: 844, fullPage: false },
  { name: 'mobile-iphone14-fullpage', width: 390, height: 844, fullPage: true },
  { name: 'tablet-ipad-viewport', width: 820, height: 1180, fullPage: false },
  { name: 'tablet-ipad-fullpage', width: 820, height: 1180, fullPage: true },
  { name: 'ultrawide-2560x1080-viewport', width: 2560, height: 1080, fullPage: false },
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-web-security', '--allow-running-insecure-content'],
});

for (const cfg of configs) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(4000);
    const path = `docs/screenshots/review/${cfg.name}.png`;
    await page.screenshot({ path, fullPage: cfg.fullPage });
    console.log(`Saved: ${path} (${cfg.width}x${cfg.height}, fullPage=${cfg.fullPage})`);
  } catch (e) {
    console.error(`Failed: ${cfg.name} - ${e.message}`);
  }
  await context.close();
}

// Hover screenshots
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.mouse.move(300, 400);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/review/desktop-1440x900-hover.png', fullPage: false });
  console.log('Saved: desktop-1440x900-hover.png');
  await page.mouse.move(800, 200);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/review/desktop-1440x900-hover2.png', fullPage: false });
  console.log('Saved: desktop-1440x900-hover2.png');
  await context.close();
}

// Reduced motion
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'docs/screenshots/review/desktop-1440x900-reduced-motion.png', fullPage: false });
  console.log('Saved: desktop-1440x900-reduced-motion.png');
  await context.close();
}

await browser.close();
console.log('All screenshots captured.');
