import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * In dev, /api/<name> runs api/<name>.ts the way Vercel does (its GET / POST / DELETE export, given a Request), so
 * the waitlist works without the Vercel CLI. With no DATABASE_URL in .env.local it uses PGlite, a real Postgres
 * inside Node, kept in .data/.
 */
type Rows = Record<string, unknown>[];
type DevGlobals = { __fgQuery?: (t: string, p?: unknown[]) => Promise<Rows>; __fgDb?: Promise<void> };

/**
 * The local stand-in for the production database: PGlite (Postgres in Node), saved in .data/waitlist. Only one
 * process may open that folder, so a lock file records which dev server has it. A second dev server (or one that
 * can't open it) gets a temporary in-memory database instead, and says so in the terminal, rather than crashing.
 */
async function openDevDb(g: DevGlobals, log: { warn: (m: string) => void }) {
  const { PGlite } = await import("@electric-sql/pglite");
  const memory = async (why: string) => {
    log.warn(`[dev api] ${why} Using a temporary in-memory database: form posts on this server won't be kept.`);
    const pg = await PGlite.create();
    g.__fgQuery = async (t, p) => (await pg.query<Record<string, unknown>>(t, p)).rows;
  };
  mkdirSync(r(".data"), { recursive: true });
  const lock = r(".data/waitlist.lock");
  const holder = existsSync(lock) ? Number(readFileSync(lock, "utf8")) : 0;
  if (holder && holder !== process.pid && alive(holder)) return memory(`Another dev server (pid ${holder}) has .data/waitlist open.`);
  writeFileSync(lock, String(process.pid));
  const release = () => { try { if (Number(readFileSync(lock, "utf8")) === process.pid) unlinkSync(lock); } catch { /* gone */ } };
  process.once("exit", release);
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.once(sig, () => { release(); process.exit(0); });
  try {
    const pg = await PGlite.create(r(".data/waitlist"));
    g.__fgQuery = async (t, p) => (await pg.query<Record<string, unknown>>(t, p)).rows;
  } catch (e) {
    release();
    await memory(`Couldn't open .data/waitlist (${(e as Error).message}).`);
  }
}

function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function devApi(): Plugin {
  return {
    name: "fg-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        // /admin is a page of its own (admin/index.html); without the slash Vite would serve the home page instead
        if (url.pathname === "/admin") { res.statusCode = 302; res.setHeader("Location", `/admin/${url.search}`); res.end(); return; }
        const route = url.pathname.match(/^\/api\/([a-z][a-z-]*)$/);
        if (!route) return next();
        try {
          for (const [k, v] of Object.entries(loadEnv(server.config.mode, process.cwd(), ""))) process.env[k] ??= v;
          const g = globalThis as DevGlobals;
          if (!process.env.DATABASE_URL && !g.__fgQuery) {
            // one open per server, however many requests arrive at once (two opens of one folder abort PGlite)
            g.__fgDb ??= openDevDb(g, server.config.logger).catch((e) => { g.__fgDb = undefined; throw e; });
            await g.__fgDb;
          }
          const mod = await server.ssrLoadModule(`/api/${route[1]}.ts`);
          const method = req.method ?? "GET";
          const handler = mod[method] as ((q: Request) => Promise<Response>) | undefined;
          if (!handler) { res.statusCode = 405; res.end(); return; }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const out = await handler(new Request(url, { method, headers, body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks) }));
          res.statusCode = out.status;
          out.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (e) {
          // answer the form, don't hand it to Vite: its error page would cover the whole site
          server.config.logger.error(`[dev api] ${url.pathname}: ${(e as Error).stack ?? e}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "The local dev database had a problem. See the terminal." }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  build: {
    target: "es2022",
    rollupOptions: {
      // lab/ and og/ pages are dev-only tools (figure test bench, Open Graph renderer)
      input: { main: r("index.html"), styleguide: r("styleguide/index.html"), admin: r("admin/index.html") },
    },
  },
});
