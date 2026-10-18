# formguard-website

## Waitlist

The "Become a test lifter" form is the waitlist. It posts to the site's own API and thanks people in place.

- `api/signup.ts`: `POST /api/signup`, checks the answers and saves them. The same email again updates the entry.
- `api/waitlist.ts`: the admin side, behind `ADMIN_PASSWORD`: the list as JSON, `?format=csv` to download it, `DELETE ?id=` to remove one.
- `/admin`: the page for it (`admin/index.html`, `src/admin/`): sign in, see everyone, download the CSV.

**On Vercel**

1. Import the repo (Vercel detects Vite; the build settings need no changes).
2. Storage → Create Database → **Neon** (free), connected to the project. That sets `DATABASE_URL`. The table is created on the first sign-up.
3. Settings → Environment Variables → `ADMIN_PASSWORD`: a long one; it's the only thing guarding the list.
4. Redeploy, then open `/admin`.

**Locally**, `npm run dev` runs the API too. Without `DATABASE_URL` it uses PGlite (Postgres inside Node), saved in `.data/`. Put `ADMIN_PASSWORD=...` in `.env.local`.
