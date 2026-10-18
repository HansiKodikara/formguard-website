import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * In dev, /api/<name> runs api/<name>.ts the way Vercel does (its GET / POST / DELETE export, given a Request), so
 * the waitlist works without the Vercel CLI. With no DATABASE_URL in .env.local it uses PGlite, a real Postgres
 * inside Node, kept in .data/.
 */
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
          const g = globalThis as { __fgQuery?: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };
          if (!process.env.DATABASE_URL && !g.__fgQuery) {
            const { PGlite } = await import("@electric-sql/pglite");
            mkdirSync(r(".data"), { recursive: true });
            const pg = await PGlite.create(r(".data/waitlist"));   // awaited, so a failure is this request's error, not a crash
            g.__fgQuery = async (t, p) => (await pg.query<Record<string, unknown>>(t, p)).rows;
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
          next(e);
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
