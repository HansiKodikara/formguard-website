import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Flag } from "../components/Flag";
import { Logo } from "../components/Logo";
import { FREQ, LIFTS } from "../../api/_lib/fields";

/**
 * /admin: the waitlist. Asks for ADMIN_PASSWORD (kept for this tab only), then lists everyone who signed up,
 * newest first, with a CSV download and a way to take test entries off. Everything goes through api/waitlist.ts,
 * which checks the password on every request.
 */
type Entry = {
  id: number; created_at: string; intent: string; name: string; email: string; adelaide: boolean | null;
  lifts: string[]; frequency: string; worry: string; source: string; consent: boolean;
};

type Message = { id: number; created_at: string; role: string; email: string; message: string };

const KEY = "fg-admin";
const remembered = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const remember = (p: string) => { try { if (p) sessionStorage.setItem(KEY, p); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } };

const liftName = (v: string) => LIFTS.find((l) => l.toLowerCase() === v) ?? v;
const freqName = (v: string) => FREQ.find((f) => f.value === v)?.label ?? (v || "—");
const when = (s: string) => new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function call(path: string, password: string, init: RequestInit = {}) {
  const r = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${password}` } });
  if (!r.ok) {
    const msg = await r.json().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw Object.assign(new Error(msg ?? `The server said ${r.status}.`), { status: r.status });
  }
  return r;
}

export function Admin() {
  const [password, setPassword] = useState(remembered);
  const [typed, setTyped] = useState("");
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [view, setView] = useState<"signups" | "messages">("signups");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pw: string) => {
    setBusy(true); setError("");
    try {
      const [w, m] = await Promise.all([call("/api/waitlist", pw), call("/api/messages", pw)]);
      setRows(((await w.json()) as { rows: Entry[] }).rows);
      setMsgs(((await m.json()) as { rows: Message[] }).rows);
      setPassword(pw); remember(pw);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) { setPassword(""); remember(""); setRows(null); }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { if (password) load(password); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, with the tab's saved password

  const signIn = (e: FormEvent) => { e.preventDefault(); if (typed) load(typed); };
  const signOut = () => { setPassword(""); remember(""); setRows(null); setTyped(""); };

  const download = async (what: "waitlist" | "messages" = "waitlist") => {
    setError("");
    try {
      const r = await call(`/api/${what}?format=csv`, password);
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? `formguard-${what}.csv`;
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (row: Entry) => {
    if (!confirm(`Take ${row.email} off the waitlist?`)) return;
    setError("");
    try {
      await call(`/api/waitlist?id=${row.id}`, password, { method: "DELETE" });
      setRows((rs) => rs?.filter((r) => r.id !== row.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeMessage = async (m: Message) => {
    if (!confirm(`Delete the message from ${m.email || "an anonymous sender"}?`)) return;
    setError("");
    try {
      await call(`/api/messages?id=${m.id}`, password, { method: "DELETE" });
      setMsgs((ms) => ms.filter((x) => x.id !== m.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const testers = rows ? rows.filter((r) => r.intent === "tester").length : 0;
  const counts = rows ? LIFTS.map((l) => [l, rows.filter((r) => r.lifts.includes(l.toLowerCase())).length] as const) : [];

  return (
    <main className="wrap min-h-[100svh] py-10 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div className="flex items-center gap-4">
          <Logo height={24} />
          <span className="t-label text-[var(--ink-muted)]">Admin</span>
        </div>
        {rows && <Button variant="quiet" size="sm" onClick={signOut}>Sign out</Button>}
      </header>

      {!rows ? (
        <form onSubmit={signIn} className="mt-16 max-w-sm space-y-6">
          <h1 className="t-head text-h3">Admin</h1>
          <Field label="Password" type="password" autoComplete="current-password" autoFocus value={typed}
            onChange={(e) => setTyped(e.target.value)} error={error || undefined} />
          <Button type="submit" disabled={busy || !typed}>{busy ? "Opening…" : "Open"}</Button>
        </form>
      ) : (
        <>
          <div role="tablist" aria-label="What to show" className="mt-8 flex gap-2">
            {([["signups", `Sign-ups · ${rows.length}`], ["messages", `Messages · ${msgs.length}`]] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`h-10 rounded-md border px-4 text-[15px] font-semibold transition-colors ${view === v ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--ground)]" : "border-[var(--line-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {l}
              </button>
            ))}
          </div>
          {view === "messages" ? (
            <Messages rows={msgs} busy={busy} error={error} onRefresh={() => load(password)} onDownload={() => download("messages")} onRemove={removeMessage} />
          ) : (<>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="t-num text-[56px] leading-none">{rows.length}</p>
              <p className="t-label mt-2 text-[var(--ink-muted)]">signed up · {testers} test lifters, {rows.length - testers} launch updates</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => load(password)} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</Button>
              <Button size="sm" onClick={() => download("waitlist")} disabled={!rows.length}>Download CSV</Button>
            </div>
          </div>
          {rows.length > 0 && (
            <p className="t-mono mt-6 text-[13px] text-[var(--ink-muted)]">{counts.map(([l, n]) => `${l} ${n}`).join("  ·  ")}</p>
          )}
          {error && <div className="mt-6"><Flag tone="fault">{error}</Flag></div>}

          {rows.length ? (
            <div className="mt-8 overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--ground-raised)]">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="t-label border-b border-[var(--line)] text-[var(--ink-muted)]">
                    <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Wants</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Adelaide</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Lifts</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Training</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Form worry</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Heard via</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="t-mono whitespace-nowrap px-4 py-3 text-[13px] text-[var(--ink-muted)]">{when(r.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.intent === "tester" ? "Test lifter" : "Launch updates"}</td>
                      <td className="px-4 py-3">{r.name || <span className="text-[var(--ink-muted)]">—</span>}</td>
                      <td className="px-4 py-3"><a href={`mailto:${r.email}`} className="underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]">{r.email}</a></td>
                      <td className="px-4 py-3">{r.adelaide === null ? "—" : r.adelaide ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{r.lifts.map(liftName).join(", ") || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{freqName(r.frequency)}</td>
                      <td className="max-w-[18rem] px-4 py-3">{r.worry || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.source || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => remove(r)} className="text-[14px] text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--signal-ink)] hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-10 text-[var(--ink-muted)]">Nobody yet. Sign-ups from the site's form show up here.</p>
          )}
          </>)}
        </>
      )}
    </main>
  );
}

/** "Get in touch" messages: newest first, each with who they are, when, and a reply link. */
function Messages({ rows, busy, error, onRefresh, onDownload, onRemove }: {
  rows: Message[]; busy: boolean; error: string; onRefresh: () => void; onDownload: () => void; onRemove: (m: Message) => void;
}) {
  return (
    <>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="t-num text-[56px] leading-none">{rows.length}</p>
          <p className="t-label mt-2 text-[var(--ink-muted)]">messages from Get in touch</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</Button>
          <Button size="sm" onClick={onDownload} disabled={!rows.length}>Download CSV</Button>
        </div>
      </div>
      {error && <div className="mt-6"><Flag tone="fault">{error}</Flag></div>}
      {rows.length ? (
        <ul className="mt-8 space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="t-label">{m.role}</span>
                  {m.email ? (
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to FormGuard")}`}
                      className="underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]">{m.email}</a>
                  ) : <span className="text-[var(--ink-muted)]">Anonymous</span>}
                </p>
                <span className="t-mono text-[13px] text-[var(--ink-muted)]">{when(m.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[16px] leading-[1.5]">{m.message}</p>
              <button type="button" onClick={() => onRemove(m)} className="mt-3 text-[14px] text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--signal-ink)] hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-[var(--ink-muted)]">No messages yet. Messages from the site's Get in touch form show up here.</p>
      )}
    </>
  );
}
