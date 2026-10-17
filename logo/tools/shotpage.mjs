// Full-page JPEG of an HTML file: node shotpage.mjs <html> <out.jpg> [width] [scale]
import { chromium } from 'playwright';
const [,, file, out, width = '1400', scale = '1'] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: +width, height: 1000 }, deviceScaleFactor: +scale });
await p.goto('file://' + file);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 82 });
await b.close();
console.log('shot', out, 'height', h);
