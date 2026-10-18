// The squat render's story, sampled finely over the 'How it works' scroll (0..1): which moment of the MyoSuite motion
// shows at each point (a fractional frame of the 74-frame motion library, from the site's own story in src/viz/how.ts).
// render_squat.py places its output frames along it (denser where the lifter moves) and the camera.
//   node scripts/squat-timeline.mjs [samples=2001] > suit-render/squat-video/timeline.json
import { createServer } from "vite";

const N = Number(process.argv[2] ?? 2001);
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { howPose } = await vite.ssrLoadModule("/src/viz/how.ts");
  const { frameExact } = await vite.ssrLoadModule("/src/viz/squatFrames.ts");
  const motion = [];
  for (let i = 0; i < N; i++) motion.push(Math.round(frameExact(howPose(i / (N - 1))) * 1000) / 1000);
  process.stdout.write(JSON.stringify({ frames: N, motion }) + "\n");
} finally {
  await vite.close();
}
