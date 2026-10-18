import { db, json } from "./_lib/db.js";
import { EMAIL, FREQ, LIFTS } from "./_lib/fields.js";

/**
 * POST /api/signup: join the waitlist. Takes the form's JSON ({ name, email, lifts, frequency }), checks it again
 * here (the page's own checks can be skipped), and saves it. Signing up again with the same email updates the
 * answers rather than adding a second row. `fg_trap` is a field people never see (and browsers never autofill):
 * if it's filled in, a bot sent it, and it's dropped (logged, so a dropped sign-up is never a mystery).
 */
const LIFT_VALUES = new Set<string>(LIFTS.map((l) => l.toLowerCase()));
const FREQ_VALUES = new Set<string>(FREQ.map((f) => f.value));

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
    console.warn("[signup] dropped as a bot: the hidden field was filled in", { email: body.email });
    return json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const lifts = Array.isArray(body.lifts) ? [...new Set(body.lifts.filter((l): l is string => typeof l === "string" && LIFT_VALUES.has(l)))] : [];
  const frequency = typeof body.frequency === "string" && FREQ_VALUES.has(body.frequency) ? body.frequency : "";
  if (!EMAIL.test(email) || email.length > 254) return json({ error: "Enter a full email address." }, 400);
  if (!lifts.length) return json({ error: "Pick at least one lift you train." }, 400);

  try {
    const q = await db();
    await q(
      `insert into waitlist (email, name, lifts, frequency) values ($1, $2, $3, $4)
       on conflict (email) do update set name = excluded.name, lifts = excluded.lifts, frequency = excluded.frequency, updated_at = now()`,
      [email, name, lifts, frequency],
    );
    return json({ ok: true });
  } catch (e) {
    console.error("[signup]", e);
    return json({ error: "Couldn't save that. Try again in a minute." }, 500);
  }
}
