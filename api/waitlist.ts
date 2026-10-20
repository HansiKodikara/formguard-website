import { createHash, timingSafeEqual } from "node:crypto";
import { db, json, type Row } from "./_lib/db.js";

/**
 * The admin side of the waitlist, behind ADMIN_PASSWORD (set in Vercel's Environment Variables), sent as
 * "Authorization: Bearer <password>".
 *   GET /api/waitlist              everyone on it, newest first, as JSON
 *   GET /api/waitlist?format=csv   the same as a CSV download
 *   DELETE /api/waitlist?id=12     take one entry off (test sign-ups)
 */
function allowed(request: Request): Response | null {
  const want = process.env.ADMIN_PASSWORD;
  if (!want) return json({ error: "ADMIN_PASSWORD isn't set on the server." }, 503);
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  // compare digests, so the check takes the same time however much of the password is right
  const h = (s: string) => createHash("sha256").update(s).digest();
  return got && timingSafeEqual(h(got), h(want)) ? null : json({ error: "Wrong password." }, 401);
}

const COLUMNS = ["id", "created_at", "updated_at", "intent", "name", "email", "adelaide", "lifts", "frequency", "worry", "source", "consent"] as const;

function csvCell(v: unknown) {
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;             // a spreadsheet would run it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows: Row[]) => [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";

export async function GET(request: Request) {
  const no = allowed(request);
  if (no) return no;
  try {
    const q = await db();
    const rows = await q(`select ${COLUMNS.join(", ")} from waitlist order by created_at desc, id desc`);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const day = new Date().toISOString().slice(0, 10);
      return new Response(toCsv(rows), { headers: {
        "content-type": "text/csv; charset=utf-8", "cache-control": "no-store",
        "content-disposition": `attachment; filename="formguard-waitlist-${day}.csv"`,
      } });
    }
    return json({ count: rows.length, rows });
  } catch (e) {
    console.error("[waitlist]", e);
    return json({ error: "Couldn't read the waitlist." }, 500);
  }
}

export async function DELETE(request: Request) {
  const no = allowed(request);
  if (no) return no;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Which entry? Pass ?id=" }, 400);
  try {
    const q = await db();
    const gone = await q("delete from waitlist where id = $1 returning id", [id]);
    return gone.length ? json({ ok: true }) : json({ error: "No entry with that id." }, 404);
  } catch (e) {
    console.error("[waitlist]", e);
    return json({ error: "Couldn't delete that entry." }, 500);
  }
}
