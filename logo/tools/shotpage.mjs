// Full-page JPEG of an HTML file, captured in slices (Chrome can't rasterise >16k px in one go)
// and stitched with Python/PIL.   node shotpage.mjs <html> <out.jpg> [width] [scale]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [,, file, out, width = '1400', scale = '1'] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: +width, height: 1000 }, deviceScaleFactor: +scale });
await p.goto('file://' + file);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'slices-'));
const SLICE = 6000, parts = [];
for (let y = 0; y < h; y += SLICE) {
  const f = join(dir, `s${String(parts.length).padStart(3, '0')}.png`);
  await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y, width: +width, height: Math.min(SLICE, h - y) } });
  parts.push(f);
}
await b.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image
ims = [Image.open(f).convert('RGB') for f in sys.argv[2:]]
out = Image.new('RGB', (ims[0].width, sum(i.height for i in ims)), 'white')
y = 0
for i in ims:
    out.paste(i, (0, y)); y += i.height
out.save(sys.argv[1], quality=82)
`, out, ...parts]);
console.log('shot', out, 'height', h, 'slices', parts.length);
