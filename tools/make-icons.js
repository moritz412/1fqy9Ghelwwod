// Rendert icons/icon.svg in die PNG-Größen für Home-Screen & Manifest.
// Nutzung (am PC): npm i -D playwright && node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.join(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(root, `icons/icon-${size}.png`) });
    console.log(`icons/icon-${size}.png`);
  }
  await browser.close();
})();
