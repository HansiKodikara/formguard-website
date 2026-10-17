// Usage: node shot.mjs <html-file> <out.png> [--width 1400] [--scale 2] [--sel ".css"] [--nth 0] [--full]
import { chromium } from 'playwright';
const a = process.argv.slice(2);
const file = a[0], out = a[1];
const opt = (k, d) => { const i = a.indexOf('--' + k); return i > -1 ? a[i + 1] : d; };
const width = +opt('width', 1400), scale = +opt('scale', 1), sel = opt('sel', null), nth = +opt('nth', 0);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: scale });
await p.goto('file://' + file);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(250);
if (sel) await p.locator(sel).nth(nth).screenshot({ path: out });
else await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('shot', out);
