import { createHash, timingSafeEqual } from "node:crypto";
import { json, type Row } from "./db.js";

/**
 * Shared by the admin APIs (waitlist.ts, messages.ts): everything sits behind ADMIN_PASSWORD (set in Vercel's
 * Environment Variables), sent as "Authorization: Bearer <password>".
 */
export function allowed(request: Request): Response | null {
  const want = process.env.ADMIN_PASSWORD;
  if (!want) return json({ error: "ADMIN_PASSWORD isn't set on the server." }, 503);
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  // compare digests, so the check takes the same time however much of the password is right
  const h = (s: string) => createHash("sha256").update(s).digest();
  return got && timingSafeEqual(h(got), h(want)) ? null : json({ error: "Wrong password." }, 401);
}

function csvCell(v: unknown) {
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;             // a spreadsheet would run it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A CSV download of `rows` (these columns, in this order), named `<name>-<date>.csv`. */
export function csv(rows: Row[], columns: readonly string[], name: string) {
  const body = [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: {
    "content-type": "text/csv; charset=utf-8", "cache-control": "no-store",
    "content-disposition": `attachment; filename="${name}-${day}.csv"`,
  } });
}
