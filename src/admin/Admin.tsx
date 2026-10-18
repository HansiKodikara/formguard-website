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
type Entry = { id: number; created_at: string; name: string; email: string; lifts: string[]; frequency: string };

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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pw: string) => {
    setBusy(true); setError("");
    try {
      const r = await call("/api/waitlist", pw);
      setRows(((await r.json()) as { rows: Entry[] }).rows);
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

  const download = async () => {
    setError("");
    try {
      const r = await call("/api/waitlist?format=csv", password);
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "formguard-waitlist.csv";
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

  const counts = rows ? LIFTS.map((l) => [l, rows.filter((r) => r.lifts.includes(l.toLowerCase())).length] as const) : [];

  return (
    <main className="wrap min-h-[100svh] py-10 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div className="flex items-center gap-4">
          <Logo height={24} />
          <span className="t-label text-[var(--ink-muted)]">Waitlist</span>
        </div>
        {rows && <Button variant="quiet" size="sm" onClick={signOut}>Sign out</Button>}
      </header>

      {!rows ? (
        <form onSubmit={signIn} className="mt-16 max-w-sm space-y-6">
          <h1 className="t-head text-h3">Admin</h1>
          <Field label="Password" type="password" autoComplete="current-password" autoFocus value={typed}
            onChange={(e) => setTyped(e.target.value)} error={error || undefined} />
          <Button type="submit" disabled={busy || !typed}>{busy ? "Opening…" : "Open the waitlist"}</Button>
        </form>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="t-num text-[56px] leading-none">{rows.length}</p>
              <p className="t-label mt-2 text-[var(--ink-muted)]">on the waitlist</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => load(password)} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</Button>
              <Button size="sm" onClick={download} disabled={!rows.length}>Download CSV</Button>
            </div>
          </div>
          {rows.length > 0 && (
            <p className="t-mono mt-6 text-[13px] text-[var(--ink-muted)]">{counts.map(([l, n]) => `${l} ${n}`).join("  ·  ")}</p>
          )}
          {error && <div className="mt-6"><Flag tone="fault">{error}</Flag></div>}

          {rows.length ? (
            <div className="mt-8 overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--ground-raised)]">
              <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="t-label border-b border-[var(--line)] text-[var(--ink-muted)]">
                    <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Lifts</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Training</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="t-mono whitespace-nowrap px-4 py-3 text-[13px] text-[var(--ink-muted)]">{when(r.created_at)}</td>
                      <td className="px-4 py-3">{r.name || <span className="text-[var(--ink-muted)]">—</span>}</td>
                      <td className="px-4 py-3"><a href={`mailto:${r.email}`} className="underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]">{r.email}</a></td>
                      <td className="px-4 py-3">{r.lifts.map(liftName).join(", ")}</td>
                      <td className="whitespace-nowrap px-4 py-3">{freqName(r.frequency)}</td>
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
        </>
      )}
    </main>
  );
}
