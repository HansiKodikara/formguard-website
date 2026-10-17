// Render brand/manifest.json jobs (SVG → PNG at exact pixel sizes, transparent background).
// node rasterize.mjs <brand-dir>
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
const dir = process.argv[2];
const jobs = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ deviceScaleFactor: 1 });
for (const j of jobs) {
  const svg = readFileSync(join(dir, j.svg), 'utf8')
    .replace(/width="[^"]*" height="[^"]*"/, '')
    .replace('<svg ', `<svg width="${j.w}" height="${j.h}" preserveAspectRatio="xMidYMid meet" `);
  await p.setViewportSize({ width: j.w, height: j.h });
  await p.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  mkdirSync(dirname(join(dir, j.png)), { recursive: true });
  await p.locator('svg').screenshot({ path: join(dir, j.png), omitBackground: true });
}
await b.close();
console.log('rendered', jobs.length, 'PNGs');
