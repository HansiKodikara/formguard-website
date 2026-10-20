import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Button } from "../components/Button";
import { Checkbox, ChipGroup, Field, Select } from "../components/Field";
import { Flag } from "../components/Flag";
import { SITE } from "../config";
import { EMAIL, FREQ, INTENTS, LIFTS, SOURCES } from "../../api/_lib/fields";

type Status = "idle" | "sending" | "sent" | "error";
type Errors = Partial<Record<"intent" | "name" | "email" | "adelaide" | "consent", string>>;
const ORDER: (keyof Errors)[] = ["intent", "name", "email", "adelaide", "consent"];

/**
 * Launch updates or test-lifter sign-up (#test-lifter, the page the showcase QR code opens). Posts JSON to
 * SITE.formEndpoint (the site's own api/signup.ts, which saves it to the waitlist table: see /admin) and thanks them
 * in place. The test-lifter questions only appear once they choose to be one. `fg_trap` is a field only bots fill in
 * (display: none, so browsers never autofill it, and hidden from screen readers); the API drops what it sends.
 */
export function TestLifter() {
  const [intent, setIntent] = useState<string[]>(["tester"]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adelaide, setAdelaide] = useState<string[]>([]);
  const [lifts, setLifts] = useState<string[]>([]);
  const [freq, setFreq] = useState<string[]>([]);
  const [worry, setWorry] = useState("");
  const [source, setSource] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [sentAs, setSentAs] = useState<"tester" | "updates">("tester");
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLDivElement>(null);

  const tester = intent[0] === "tester";
  // once they've tried to send, fix-as-you-go: an error clears as soon as its answer is there
  const clear = (k: keyof Errors) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      intent: intent.length ? undefined : "Choose one of the two options",
      name: name.trim() ? undefined : "Enter your name",
      email: !email.trim() ? "Enter your email" : EMAIL.test(email.trim()) ? undefined : "Enter a full email address, like you@example.com",
      adelaide: !tester || adelaide.length ? undefined : "Tell us if you're in Adelaide",
      consent: consent ? undefined : "Tick this so we can contact you",
    };
    setErrors(next);
    const first = ORDER.find((k) => next[k]);
    if (first) {
      // take them to the first thing to fix (on a phone it's often off screen)
      const el = form.current?.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select`);
      el?.focus({ preventScroll: true });
      el?.closest("[data-field]")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const data = {
      intent: intent[0], name: name.trim(), email: email.trim(), source, consent,
      ...(tester ? { adelaide: adelaide[0] === "yes", lifts, frequency: freq[0] ?? "", worry: worry.trim() } : {}),
      fg_trap: trap,
    };
    setStatus("sending");
    try {
      const r = await fetch(SITE.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      setSentAs(tester ? "tester" : "updates");
      setStatus("sent");
      requestAnimationFrame(() => {
        done.current?.focus({ preventScroll: true });
        done.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } catch {
      setStatus("error");
    }
  };

  const missing = ORDER.filter((k) => errors[k]).length;

  return (
    <Section id="test-lifter" surface="iron" label="Become a test lifter" className="scroll-mt-[var(--header-h)]">
      <div className="wrap grid-12 gap-y-10 pb-20 pt-10 sm:gap-y-12 sm:pt-16 lg:pb-32 lg:pt-28">
        <div className="col-span-12 lg:col-span-5">
          <Kicker index="03">Test lifters</Kicker>
          <h2 className="t-head mt-6 text-h2">Become a test lifter.</h2>
          <p className="mt-6 max-w-[40ch] text-lead">
            Wear the suit for 2 sessions at your usual gym and help FormGuard learn what good form looks like.
          </p>
          <List title="You get" items={[
            "First access before anyone else",
            "Feedback on your own form",
            "A discount when FormGuard launches",
          ]} />
        </div>

        <div id="signup" className="col-span-12 scroll-mt-[calc(var(--header-h)+1rem)] lg:col-span-6 lg:col-start-7">
          {status === "sent" ? (
            <div ref={done} tabIndex={-1} role="status" className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-6 outline-none sm:p-8">
              <Flag tone="clear">{sentAs === "tester" ? "Signed up" : "Subscribed"}</Flag>
              <p className="t-head mt-4 text-h3">Thanks!</p>
              <p className="mt-4 max-w-[44ch] text-[17px]">
                {sentAs === "tester"
                  ? "You're on the test lifter list. We'll be in touch about sessions."
                  : "We'll let you know when FormGuard launches."}
              </p>
            </div>
          ) : (
            <form ref={form} noValidate onSubmit={submit} aria-label="Sign up"
              className="relative space-y-7 rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-5 sm:space-y-8 sm:p-8">
              <p className="text-[14px] text-[var(--ink-muted)]">Fields marked <span className="text-[var(--signal-ink)]">*</span> are required.</p>

              <div data-field="intent">
                <ChipGroup legend="What would you like?" type="radio" name="intent" required stacked value={intent}
                  onChange={(v) => {
                    // agreeing to launch emails isn't agreeing to testing: ask again when they move up to test lifter
                    if (intent[0] === "updates" && v[0] === "tester") setConsent(false);
                    setIntent(v); clear("intent");
                  }} error={errors.intent} options={[...INTENTS]} />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div data-field="name">
                  <Field label="Name" required autoComplete="name" placeholder="Your name" value={name}
                    onChange={(e) => { setName(e.target.value); clear("name"); }} error={errors.name} />
                </div>
                <div data-field="email">
                  <Field label="Email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                    placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); clear("email"); }} error={errors.email} />
                </div>
              </div>

              {tester && (
                <div className="space-y-7 border-l-2 border-[var(--signal)] pl-4 sm:space-y-8 sm:pl-5">
                  <p className="t-label text-[var(--ink-muted)]">About your training</p>
                  <div data-field="adelaide">
                    <ChipGroup legend="Are you in Adelaide?" type="radio" name="adelaide" required value={adelaide}
                      onChange={(v) => { setAdelaide(v); clear("adelaide"); }} error={errors.adelaide}
                      options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                  </div>
                  <ChipGroup legend="What do you lift?" name="lifts" value={lifts} onChange={setLifts}
                    options={LIFTS.map((l) => ({ value: l.toLowerCase(), label: l }))} />
                  <ChipGroup legend="How often do you train?" type="radio" name="freq" value={freq} onChange={setFreq} options={[...FREQ]} />
                  <Field label="What's your biggest worry about your form?" maxLength={300} autoComplete="off"
                    placeholder="e.g. my lower back on deadlifts" value={worry} onChange={(e) => setWorry(e.target.value)} />
                </div>
              )}

              <Select label="How did you hear about us?" name="source" options={SOURCES} value={source} onChange={(e) => setSource(e.target.value)} />

              <div data-field="consent">
                <Checkbox required checked={consent} onChange={(v) => { setConsent(v); clear("consent"); }} error={errors.consent}>
                  {intent[0] === "updates"
                    ? "I'm happy for FormGuard to contact me about the launch."
                    : "I'm happy for FormGuard to contact me about launch and testing."}
                </Checkbox>
                {/* lined up with the checkbox's sentence (20px box + 12px gap) */}
                <p className="mt-2 pl-8 text-[14px] leading-[1.45] text-[var(--ink-muted)]">
                  Your data stays yours. We only use it to improve form checks.
                </p>
              </div>

              {/* for bots only: display: none, so people never see it and browsers never autofill it */}
              <div hidden>
                <label>Leave this empty<input type="text" name="fg_trap" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
              </div>

              <div className="space-y-4">
                <Button type="submit" disabled={status === "sending"} className="w-full sm:w-auto">
                  {status === "sending" ? "Sending…" : tester || !intent.length ? "Become a test lifter" : "Keep me updated"}
                </Button>
                <div aria-live="polite">
                  {missing > 0 && <Flag tone="fault">{missing === 1 ? "One required answer is missing." : `${missing} required answers are missing.`} They're marked above.</Flag>}
                  {status === "error" && <Flag tone="fault">That didn't send. Try again, or email {SITE.contactEmail}</Flag>}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}

function List({ title, items }: { title: ReactNode; items: string[] }) {
  return (
    <div className="mt-10">
      <h3 className="t-label text-[var(--ink)]">{title}</h3>
      <ul className="mt-4 space-y-3 border-t border-[var(--line)] pt-4 text-[17px] leading-[1.5]">
        {items.map((t) => (
          <li key={t} className="flex gap-3">
            <span aria-hidden className="shrink-0 text-[var(--signal-ink)]">—</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
