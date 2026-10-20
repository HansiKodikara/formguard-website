// Where does a #test-lifter link land? node scripts/check-landing.mjs [url]  (default: the local dev server)
// Prints, per phone/tablet/laptop profile, the gap between the header and the section top over 12 s (0 = right).
import { webkit, chromium, firefox, devices } from "playwright";
const URL = process.argv[2] ?? "http://localhost:5173/#test-lifter";
const runs = [
  ["iPhone SE (Safari)", webkit, devices["iPhone SE"]],
  ["iPhone 15 Pro Max (Safari)", webkit, devices["iPhone 15 Pro Max"]],
  ["iPhone 15 landscape (Safari)", webkit, devices["iPhone 15 landscape"]],
  ["iPad Mini (Safari)", webkit, devices["iPad Mini"]],
  ["iPad Pro 11 landscape (Safari)", webkit, devices["iPad Pro 11 landscape"]],
  ["Pixel 7 (Chrome)", chromium, devices["Pixel 7"]],
  ["Galaxy S9+ (Chrome)", chromium, devices["Galaxy S9+"]],
  ["Small Android 360x640 (Chrome)", chromium, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ["Galaxy Tab S4 (Chrome)", chromium, devices["Galaxy Tab S4"]],
  ["Laptop 1280x800 (Chrome)", chromium, { viewport: { width: 1280, height: 800 } }],
  ["Laptop 1440x900 (Safari)", webkit, { viewport: { width: 1440, height: 900 } }],
  ["Desktop 1920x1080 (Firefox)", firefox, { viewport: { width: 1920, height: 1080 } }],
];
const bs = new Map();
for (const [name, type, dev] of runs) {
  if (!bs.has(type)) bs.set(type, await type.launch());
  const { defaultBrowserType, ...opts } = dev;
  if (type === firefox) delete opts.isMobile;
  const ctx = await bs.get(type).newContext(opts);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "commit" });
  const gap = () => p.evaluate(() => {
    const s = document.getElementById("test-lifter"), h = document.querySelector("header");
    return s && h ? Math.round(s.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : null;
  }).catch(() => null);
  const out = [];
  for (const t of [1500, 4000, 8000, 12000]) { await p.waitForTimeout(t - (out.length ? [1500, 4000, 8000, 12000][out.length - 1] : 0)); out.push(await gap()); }
  const h1 = await p.evaluate(() => { const r = document.querySelector("#test-lifter h2").getBoundingClientRect(); return r.bottom <= innerHeight; });
  console.log(`${name.padEnd(32)} gap below header (px) at 1.5/4/8/12 s: ${out.join(" / ").padEnd(18)} headline on screen: ${h1}`);
  await ctx.close();
}
for (const b of bs.values()) await b.close();
