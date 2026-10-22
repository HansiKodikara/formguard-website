import { db, json } from "./_lib/db.js";
import { allowed, csv } from "./_lib/admin.js";

/**
 * The admin side of "Get in touch" (behind ADMIN_PASSWORD, see _lib/admin.ts).
 *   GET /api/messages              every message, newest first, as JSON
 *   GET /api/messages?format=csv   the same as a CSV download
 *   DELETE /api/messages?id=12     delete one (spam, tests)
 */
const COLUMNS = ["id", "created_at", "role", "email", "message"] as const;

export async function GET(request: Request) {
  const no = allowed(request);
  if (no) return no;
  try {
    const q = await db();
    const rows = await q(`select ${COLUMNS.join(", ")} from messages order by created_at desc, id desc`);
    if (new URL(request.url).searchParams.get("format") === "csv") return csv(rows, COLUMNS, "formguard-messages");
    return json({ count: rows.length, rows });
  } catch (e) {
    console.error("[messages]", e);
    return json({ error: "Couldn't read the messages." }, 500);
  }
}

export async function DELETE(request: Request) {
  const no = allowed(request);
  if (no) return no;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Which message? Pass ?id=" }, 400);
  try {
    const q = await db();
    const gone = await q("delete from messages where id = $1 returning id", [id]);
    return gone.length ? json({ ok: true }) : json({ error: "No message with that id." }, 404);
  } catch (e) {
    console.error("[messages]", e);
    return json({ error: "Couldn't delete that message." }, 500);
  }
}
