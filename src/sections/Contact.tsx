import { useRef, useState, type FormEvent } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Button } from "../components/Button";
import { Field, Select, Textarea } from "../components/Field";
import { Flag } from "../components/Flag";
import { SITE } from "../config";
import { EMAIL, MESSAGE_MAX, ROLES } from "../../api/_lib/fields";

type Errors = Partial<Record<"role" | "message" | "email", string>>;
const ORDER: (keyof Errors)[] = ["role", "message", "email"];

/**
 * "Get in touch" (#contact): feedback, questions, working together. Deliberately quieter than #test-lifter above it
 * (a hairline, less padding, a smaller heading, no card, an outlined button), so it never competes with the main call
 * to action. Posts to api/contact.ts, which saves to the messages table only: it signs nobody up for anything.
 * The email is optional, so feedback can be anonymous; it's only ever used to reply.
 */
export function Contact() {
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [repliable, setRepliable] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLParagraphElement>(null);
  const clear = (k: keyof Errors) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      role: role ? undefined : "Choose one",
      message: message.trim() ? undefined : "Write your message",
      // optional: they can stay anonymous; if they leave one, it has to be one we can reply to
      email: !email.trim() || EMAIL.test(email.trim()) ? undefined : "Check your email address, like you@example.com, or leave it empty",
    };
    setErrors(next);
    const first = ORDER.find((k) => next[k]);
    if (first) {
      const el = form.current?.querySelector<HTMLElement>(`[data-field="${first}"] :is(input, select, textarea)`);
      el?.focus({ preventScroll: true });
      el?.closest("[data-field]")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setStatus("sending");
    try {
      const r = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ role, message: message.trim(), email: email.trim(), fg_trap: trap }),
      });
      if (!r.ok) throw new Error();
      setRepliable(Boolean(email.trim()));
      setStatus("sent");
      requestAnimationFrame(() => done.current?.focus({ preventScroll: true }));
    } catch {
      setStatus("error");
    }
  };

  const missing = ORDER.filter((k) => errors[k]).length;

  return (
    <Section id="contact" surface="iron" label="Get in touch" className="scroll-mt-[var(--header-h)]">
      <div className="wrap">
        <div className="grid-12 gap-y-8 border-t border-[var(--line)] pb-16 pt-12 lg:pb-24 lg:pt-16">
          <div className="col-span-12 lg:col-span-5">
            <Kicker index="04">Get in touch</Kicker>
            <h2 className="t-head mt-5 text-h3">Got thoughts on FormGuard?</h2>
            <p className="mt-4 max-w-[40ch] text-[17px] leading-[1.5] text-[var(--ink-muted)]">
              Feedback, questions, or want to work with us? We'd love to hear from you.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            {status === "sent" ? (
              <p ref={done} tabIndex={-1} role="status" className="t-head text-[22px] leading-[1.3] outline-none">
                {repliable ? "Thanks! We'll get back to you soon." : "Thanks! We've got your message."}
              </p>
            ) : (
              <form ref={form} noValidate onSubmit={submit} aria-label="Get in touch" className="space-y-6">
                <div data-field="role" className="sm:max-w-[20rem]">
                  <Select label="I'm a…" name="role" required options={ROLES} value={role}
                    onChange={(e) => { setRole(e.target.value); clear("role"); }} error={errors.role} />
                </div>
                <div data-field="message">
                  <Textarea label="Message" name="message" required maxLength={MESSAGE_MAX} placeholder="What's on your mind?" value={message}
                    onChange={(e) => { setMessage(e.target.value); clear("message"); }} error={errors.message} />
                </div>
                <div data-field="email">
                  <Field label="Email (optional)" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none"
                    spellCheck={false} placeholder="you@example.com" hint="Only if you'd like a reply. Leave it empty to stay anonymous." value={email}
                    onChange={(e) => { setEmail(e.target.value); clear("email"); }} error={errors.email} />
                </div>
                {/* for bots only: display: none, so people never see it and browsers never autofill it */}
                <div hidden>
                  <label>Leave this empty<input type="text" name="fg_trap" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Button type="submit" variant="secondary" disabled={status === "sending"} className="w-full sm:w-auto sm:min-w-32">
                    {status === "sending" ? "Sending…" : "Send"}
                  </Button>
                  <p className="text-[14px] text-[var(--ink-muted)]"><span className="text-[var(--signal-ink)]">*</span> Required</p>
                </div>
                <div aria-live="polite">
                  {missing > 0 && <Flag tone="fault">{missing === 1 ? "One required answer is missing." : `${missing} required answers are missing.`} They're marked above.</Flag>}
                  {status === "error" && <Flag tone="fault">That didn't send. Try again, or email {SITE.contactEmail}</Flag>}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
