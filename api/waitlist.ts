import { db, json } from "./_lib/db.js";
import { allowed, csv } from "./_lib/admin.js";

/**
 * The admin side of the waitlist (behind ADMIN_PASSWORD, see _lib/admin.ts).
 *   GET /api/waitlist              everyone on it, newest first, as JSON
 *   GET /api/waitlist?format=csv   the same as a CSV download
 *   DELETE /api/waitlist?id=12     take one entry off (test sign-ups)
 */
const COLUMNS = ["id", "created_at", "updated_at", "intent", "name", "email", "adelaide", "lifts", "frequency", "worry", "source", "consent"] as const;

export async function GET(request: Request) {
  const no = allowed(request);
  if (no) return no;
  try {
    const q = await db();
    const rows = await q(`select ${COLUMNS.join(", ")} from waitlist order by created_at desc, id desc`);
    if (new URL(request.url).searchParams.get("format") === "csv") return csv(rows, COLUMNS, "formguard-waitlist");
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
