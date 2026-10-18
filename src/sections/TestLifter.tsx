import { useState, type FormEvent } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Button } from "../components/Button";
import { ChipGroup, Field } from "../components/Field";
import { Flag } from "../components/Flag";
import { SITE } from "../config";
import { EMAIL, FREQ, LIFTS } from "../../api/_lib/fields";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Test-lifter sign-up: the waitlist. Posts JSON to SITE.formEndpoint (the site's own api/signup.ts) and thanks
 * them in place; nobody leaves the page. `fg_trap` is a field only bots fill in (display: none, so browsers never
 * autofill it, and hidden from people and from
 * screen readers); the API drops what it sends.
 */
export function TestLifter() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [lifts, setLifts] = useState<string[]>([]);
  const [freq, setFreq] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ email?: string; lifts?: string }>({});
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: EMAIL.test(email.trim()) ? undefined : "Enter a full email address, like you@example.com",
      lifts: lifts.length ? undefined : "Pick at least one lift you train",
    };
    setErrors(next);
    if (next.email || next.lifts) return;
    const data = { name, email, lifts, frequency: freq[0] ?? "", fg_trap: trap };
    setStatus("sending");
    try {
      const r = await fetch(SITE.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      setStatus(r.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Section id="test-lifter" surface="iron" label="Become a test lifter">
      <div className="wrap grid-12 gap-y-12 pb-24 pt-20 lg:pb-32 lg:pt-28">
        <div className="col-span-12 lg:col-span-5">
          <Kicker index="03">Test lifters</Kicker>
          <h2 className="t-head mt-6 text-h2">Become a test lifter.</h2>
          <p className="mt-6 max-w-[40ch] text-lead">
            FormGuard learns from real lifters. Test lifters wear the suit for a few sessions and help build the form database: what a good rep and a slipping rep look like, across different bodies.
          </p>
          <ul className="mt-8 space-y-3 text-[16px]">
            <li className="flex gap-3"><span className="t-mono text-[var(--ink-muted)]">01</span>A few sessions in your own gym, on your own program.</li>
            <li className="flex gap-3"><span className="t-mono text-[var(--ink-muted)]">02</span>Early access to the suit and the app.</li>
            <li className="flex gap-3"><span className="t-mono text-[var(--ink-muted)]">03</span>Your data stays yours. We only use it to train form checks.</li>
          </ul>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          {status === "sent" ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-6 sm:p-8" role="status">
              <Flag tone="clear">Signed up</Flag>
              <p className="t-head mt-4 text-h3">Thanks{name ? `, ${name.split(" ")[0]}` : ""}.</p>
              <p className="mt-4 max-w-[44ch] text-[16px]">
                You're on the list. We'll email you when suits are ready to test. It won't be often.
              </p>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="relative space-y-8 rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Name" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                <Field label="Email" type="email" required autoComplete="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} error={errors.email} />
              </div>
              <ChipGroup legend="What do you lift?" name="lifts" value={lifts} onChange={setLifts} error={errors.lifts}
                options={LIFTS.map((l) => ({ value: l.toLowerCase(), label: l }))} />
              {/* for bots only: display: none, so people never see it and browsers never autofill it */}
              <div hidden>
                <label>Leave this empty<input type="text" name="fg_trap" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
              </div>
              <ChipGroup legend="How often do you train?" type="radio" name="freq" value={freq} onChange={setFreq} options={[...FREQ]} />
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Become a test lifter"}</Button>
                {status === "error" && <Flag tone="fault">That didn't send. Try again, or email {SITE.contactEmail}</Flag>}
              </div>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}
