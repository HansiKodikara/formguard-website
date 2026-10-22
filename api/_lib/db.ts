import { neon } from "@neondatabase/serverless";

/**
 * The waitlist and messages tables, on the Postgres in DATABASE_URL (Neon, added from Vercel's Storage tab). The table is
 * created on first use, so there's no setup step. In local dev, vite.config.ts hands in a PGlite database instead
 * (globalThis.__fgQuery), saved in .data/.
 */
export type Row = Record<string, unknown>;
export type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

declare global {
  var __fgQuery: Query | undefined;
}

const SCHEMA = `create table if not exists waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  name text not null default '',
  lifts text[] not null default '{}',
  frequency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`;
// added with the launch-updates / test-lifter split; safe to run on every cold start
const MIGRATIONS = [
  `alter table waitlist add column if not exists intent text not null default 'tester'`,
  `alter table waitlist add column if not exists adelaide boolean`,
  `alter table waitlist add column if not exists worry text not null default ''`,
  `alter table waitlist add column if not exists source text not null default ''`,
  `alter table waitlist add column if not exists consent boolean not null default false`,
  // "Get in touch" messages: kept apart from the waitlist, and never added to it
  `create table if not exists messages (
    id bigint generated always as identity primary key,
    role text not null,
    message text not null,
    email text not null,
    created_at timestamptz not null default now()
  )`,
];

function connect(): Query {
  if (globalThis.__fgQuery) return globalThis.__fgQuery;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set: add a Neon database to the project in Vercel's Storage tab");
  const sql = neon(url);
  return (text, params) => sql.query(text, params) as Promise<Row[]>;
}

let ready: Promise<void> | null = null;

export async function db(): Promise<Query> {
  const q = connect();
  ready ??= q(SCHEMA).then(async () => { for (const m of MIGRATIONS) await q(m); }).then(() => undefined, (e) => { ready = null; throw e; });
  await ready;
  return q;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
