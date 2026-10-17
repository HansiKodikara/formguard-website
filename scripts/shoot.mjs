// Site screenshots. node scripts/shoot.mjs <url> <out-prefix> [--sizes 390x844,1280x800,1920x1080] [--full]
//   [--at 0,1200,2400 (scroll y list) | --sel "#id"] [--wait 600] [--motion reduce]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Chrome can't rasterise one capture taller than ~16k device px: slice and stitch (PIL).
async function fullPage(p, path, dsf) {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  const w = await p.evaluate(() => document.documentElement.clientWidth);
  const step = Math.floor(7000 / dsf);
  if (h * dsf <= 14000) return p.screenshot({ path, fullPage: true });
  const dir = mkdtempSync(join(tmpdir(), "slices-"));
  const parts = [];
  for (let y = 0; y < h; y += step) {
    const f = join(dir, `s${String(parts.length).padStart(3, "0")}.png`);
    await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y, width: w, height: Math.min(step, h - y) } });
    parts.push(f);
  }
  execFileSync("python3", ["-c", "import sys\nfrom PIL import Image\nims=[Image.open(f).convert('RGB') for f in sys.argv[2:]]\nout=Image.new('RGB',(ims[0].width,sum(i.height for i in ims)))\ny=0\nfor i in ims:\n    out.paste(i,(0,y)); y+=i.height\nout.save(sys.argv[1])", path, ...parts]);
}
const a = process.argv.slice(2);
const url = a[0], out = a[1];
const opt = (k, d) => { const i = a.indexOf("--" + k); return i > -1 ? a[i + 1] : d; };
const has = (k) => a.includes("--" + k);
const sizes = opt("sizes", "1280x800").split(",").map((s) => s.split("x").map(Number));
const at = opt("at", null);
const sel = opt("sel", null);
const wait = +opt("wait", "500");
const motion = opt("motion", "no-preference");
const b = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const [w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +opt("dsf", w <= 500 ? "2" : "1"), reducedMotion: motion, isMobile: w <= 500, hasTouch: w <= 500 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.error("[pageerror]", e.message));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error(`[${m.type()}]`, m.text().slice(0, 300)); });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(wait);
  if (sel) {
    const loc = p.locator(sel).first();
    await loc.scrollIntoViewIfNeeded();
    await p.waitForTimeout(+opt("settle", "6000"));   // lazy 3D mounts when near the viewport
    if (has("nohead")) await p.addStyleTag({ content: "header{visibility:hidden !important}" });
    await loc.screenshot({ path: `${out}-${w}.png` });
  } else if (at) {
    for (const y of at.split(",").map(Number)) {
      await p.evaluate((yy) => window.scrollTo(0, yy), y);
      await p.waitForTimeout(wait);
      await p.screenshot({ path: `${out}-${w}-y${y}.png` });
    }
  } else {
    if (has("full")) await fullPage(p, `${out}-${w}.png`, +opt("dsf", w <= 500 ? "2" : "1"));
    else await p.screenshot({ path: `${out}-${w}.png` });
  }
  await ctx.close();
}
await b.close();
console.log("shot", out, sizes.map((s) => s.join("x")).join(" "));
