import { db, json } from "./_lib/db.js";
import { EMAIL, FREQ, INTENTS, LIFTS, SOURCES } from "./_lib/fields.js";

/**
 * POST /api/signup: launch updates or a test-lifter sign-up. Takes the form's JSON ({ intent, name, email, consent,
 * source, and for test lifters adelaide, lifts, frequency, worry }), checks it again here (the page's own checks can
 * be skipped), and saves it with a timestamp. Signing up again with the same email updates the answers rather than
 * adding a second row. `fg_trap` is a field people never see (and browsers never autofill): if it's filled in, a bot
 * sent it, and it's dropped (logged, so a dropped sign-up is never a mystery).
 */
const LIFT_VALUES = new Set<string>(LIFTS.map((l) => l.toLowerCase()));
const FREQ_VALUES = new Set<string>(FREQ.map((f) => f.value));
const INTENT_VALUES = new Set<string>(INTENTS.map((i) => i.value));
const SOURCE_VALUES = new Set<string>(SOURCES);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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

  const intent = typeof body.intent === "string" && INTENT_VALUES.has(body.intent) ? body.intent : "";
  const email = text(body.email, 254).toLowerCase();
  const name = text(body.name, 100);
  const source = typeof body.source === "string" && SOURCE_VALUES.has(body.source) ? body.source : "";
  const tester = intent === "tester";
  const adelaide = tester && typeof body.adelaide === "boolean" ? body.adelaide : null;
  const lifts = tester && Array.isArray(body.lifts) ? [...new Set(body.lifts.filter((l): l is string => typeof l === "string" && LIFT_VALUES.has(l)))] : [];
  const frequency = tester && typeof body.frequency === "string" && FREQ_VALUES.has(body.frequency) ? body.frequency : "";
  const worry = tester ? text(body.worry, 300) : "";
  if (!intent) return json({ error: "Choose launch updates or test lifter." }, 400);
  if (!name) return json({ error: "Enter your name." }, 400);
  if (!EMAIL.test(email)) return json({ error: "Enter a full email address." }, 400);
  if (tester && adelaide === null) return json({ error: "Tell us if you're in Adelaide." }, 400);
  if (body.consent !== true) return json({ error: "Tick the box so we can contact you." }, 400);

  try {
    const q = await db();
    await q(
      `insert into waitlist (email, name, intent, adelaide, lifts, frequency, worry, source, consent)
         values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       on conflict (email) do update set name = excluded.name, intent = excluded.intent, adelaide = excluded.adelaide,
         lifts = excluded.lifts, frequency = excluded.frequency, worry = excluded.worry,
         source = coalesce(nullif(excluded.source, ''), waitlist.source), consent = true, updated_at = now()`,
      [email, name, intent, adelaide, lifts, frequency, worry, source],
    );
    return json({ ok: true });
  } catch (e) {
    console.error("[signup]", e);
    return json({ error: "Couldn't save that. Try again in a minute." }, 500);
  }
}
