import { db, json } from "./_lib/db.js";
import { EMAIL, MESSAGE_MAX, ROLES } from "./_lib/fields.js";

/**
 * POST /api/contact: a "Get in touch" message ({ role, message, email? }). The email is optional: empty means anonymous. Saved to the messages table only. It never
 * touches the waitlist: sending a message doesn't sign anyone up for anything, and the email is only for replying.
 * `fg_trap` is a field only bots fill in; what it sends is dropped (and logged).
 */
const ROLE_VALUES = new Set<string>(ROLES);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const b = await request.json();
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
    body = b as Record<string, unknown>;
  } catch {
    return json({ error: "Send the form as JSON." }, 400);
  }
  if (typeof body.fg_trap === "string" && body.fg_trap.trim()) {
    console.warn("[contact] dropped as a bot: the hidden field was filled in", { email: body.email });
    return json({ ok: true });
  }

  const role = typeof body.role === "string" && ROLE_VALUES.has(body.role) ? body.role : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MESSAGE_MAX) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!role) return json({ error: "Choose who you are." }, 400);
  if (!message) return json({ error: "Write a message." }, 400);
  // optional (anonymous feedback is fine), but if there is one it has to be a real address to reply to
  if (email && (!EMAIL.test(email) || email.length > 254)) return json({ error: "Check the email address, or leave it empty." }, 400);

  try {
    const q = await db();
    await q("insert into messages (role, message, email) values ($1, $2, $3)", [role, message, email]);
    return json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return json({ error: "Couldn't send that. Try again in a minute." }, 500);
  }
}
