# Deployment

## The shape of this app (read this first)

`hetex-ai` is a **Next.js app**, which means the frontend and the backend are
the same deployable. The API lives in `hetex-ai/src/app/api/**/route.ts` and is
compiled and served by the same process that serves the pages. There is no
separate backend server to put on one host and a frontend to put on another —
splitting them would mean extracting the API routes into a standalone Node
service first, which is a rewrite, not a config change.

So the plan that uses both Vercel and Render as intended is:

| Service | Hosts | Why |
| --- | --- | --- |
| **Vercel** | The `hetex-ai` Next.js app (pages **and** API routes) | Vercel is built by the Next.js team; zero-config builds, preview deploys per branch |
| **Render** | The PostgreSQL database | Vercel is serverless — no persistent disk, so the current SQLite file cannot live there. Render gives you a managed Postgres instance |
| **Expo / EAS** | The `hetex-mobile` app | Mobile apps ship through app stores, not web hosts. It just points at the Vercel URL |

If you would rather have one host for everything, deploy the whole Next.js app
to Render as a Node web service instead and skip Vercel. That works too — it is
just a less optimised path for Next.js.

---

## Blockers to clear before the first deploy

These are real code changes, not settings. Nothing deploys correctly until they
are done.

### 1. SQLite → Postgres

Today the database is libSQL/SQLite (`hetex-ai/src/lib/db/index.ts`) writing to
a local `dev.db` file. On Vercel there is no writable persistent filesystem, so
every deploy would start from an empty database and lose it again on the next
request.

What changes:

- `hetex-ai/src/lib/db/index.ts` — swap `@libsql/client` + `drizzle-orm/libsql`
  for `pg` + `drizzle-orm/node-postgres`
- `hetex-ai/src/lib/db/schema.ts` — swap `sqliteTable`/`integer(... mode:
  "timestamp")` for `pgTable`/`timestamp`. The table shapes and relations stay
  identical; only the column type helpers differ
- `hetex-ai/drizzle.config.ts` — `dialect: "sqlite"` becomes `dialect:
  "postgresql"`

An alternative that avoids this work entirely: use **Turso** (hosted libSQL)
instead of Render Postgres. The driver already matches, so it is only a
`DATABASE_URL` change — but then Render is not part of the stack.

### 2. The mobile app's API endpoints do not exist

`hetex-mobile/src/api/client.ts` calls:

- `POST /api/mobile/auth/register`
- `POST /api/mobile/auth/login`
- `GET  /api/mobile/auth/me`
- `POST /api/mobile/chat`

None of these exist in `hetex-ai/src/app/api/`. The web app uses NextAuth
cookie sessions; the mobile app expects bearer-token JSON endpoints. Those
routes need to be written before the mobile app can talk to anything, deployed
or local.

### 3. The mobile app's base URL is hardcoded to a LAN IP

`hetex-mobile/src/api/client.ts` line 5 pins `http://10.180.201.18:3000`. That
address only exists on your home Wi-Fi. It needs to read from Expo config
(`app.json` → `extra`, or `EXPO_PUBLIC_API_URL`) so it can point at the
deployed URL.

---

## Render — PostgreSQL

1. Sign in at [render.com](https://render.com) → **New** → **Postgres**
2. Name it `hetex-db`, pick the region closest to your users, choose the free
   tier to start
3. Once it provisions, copy the **External Database URL** (starts with
   `postgresql://`) — external, not internal, because Vercel connects from
   outside Render's network
4. Keep that URL somewhere safe; it is a secret and goes in Vercel's
   environment variables, never in the repo

> Render's free Postgres tier expires after 30 days. For anything you intend to
> keep, budget for the paid tier.

## Vercel — the Next.js app

1. Sign in at [vercel.com](https://vercel.com) with GitHub → **Add New** →
   **Project** → import the `hetex` repo
2. **Root Directory: `hetex-ai`** — this is the important one. The repo root is
   a monorepo; Vercel needs to be told which folder holds the Next.js app.
   Framework preset and build command auto-detect once it is set
3. Add environment variables (Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Render External Database URL |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | your production URL, e.g. `https://hetex.vercel.app` |
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |

4. Deploy. On the first successful build, run the schema push against the
   Render database from your machine:

   ```bash
   cd hetex-ai
   DATABASE_URL="<render-external-url>" npm run db:push
   ```

5. `NEXTAUTH_URL` must match the final domain exactly. If you attach a custom
   domain later, update it or login will break.

## Expo — the mobile app

Once the web app has a public URL, point the mobile app at it (blocker 3 above),
then build with EAS:

```bash
cd hetex-mobile
npx eas build --platform android --profile preview
```

Expo Go remains fine for testing against the deployed backend — the LAN
requirement in `hetex-mobile/README.md` only applies when the backend runs on
your laptop.

---

## Secrets

`.env` is gitignored at the repo root and must stay that way — this repository
is public. Real values belong only in the Vercel and Render dashboards. If a key
ever lands in a commit, rotate it at the provider; deleting the commit is not
enough, because the value is already published.
