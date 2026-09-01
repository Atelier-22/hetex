# Aviel API

The backend for Aviel AI. Express + TypeScript + PostgreSQL, deployed on Render.

This is the only piece that touches the database or the Anthropic API key. The
web frontend and the mobile app are both clients of it and hold no secrets.

## Why it exists separately

Aviel started as a single Next.js app where the API routes and the UI shipped
together. Splitting the API out means the two deploy independently, the mobile
app talks to exactly the same endpoints the web app does, and the Anthropic key
lives in one place instead of being bundled into a frontend build.

## Auth

One mechanism for both clients: `POST /auth/login` returns a JWT, and every
authenticated request carries `Authorization: Bearer <token>`.

- **Web** — the token is stored inside the NextAuth session cookie. The browser
  never holds it in JavaScript, so an injected script can't read it.
- **Mobile** — stored in `expo-secure-store` (Keychain / Keystore).

Passwords are hashed with bcrypt at cost 12. Login returns the same error and
does the same work whether the email is unknown or the password is wrong, so
the endpoint can't be used to enumerate registered addresses.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness + whether an AI provider is configured |
| `POST` | `/auth/register` | — | Create account, returns token |
| `POST` | `/auth/login` | — | Returns token |
| `GET` | `/auth/me` | ✓ | Current user |
| `POST` | `/chat` | ✓ | Send a message (streams or not — see below) |
| `GET` | `/conversations` | ✓ | List |
| `GET` | `/conversations/:id` | ✓ | One conversation with its messages |
| `PATCH` | `/conversations/:id` | ✓ | Rename |
| `DELETE` | `/conversations/:id` | ✓ | Delete |
| `GET`/`POST` | `/projects` | ✓ | List / create |
| `DELETE` | `/projects/:id` | ✓ | Delete |
| `GET`/`PATCH` | `/settings` | ✓ | Read / update preferences |
| `GET`/`POST` | `/memory` | ✓ | List / add memory entries |
| `DELETE` | `/memory/:id` | ✓ | Remove one |
| `GET` | `/library` | ✓ | Uploaded and generated assets |
| `GET` | `/usage` | ✓ | Per-user counters |
| `POST` | `/feedback` | ✓ | Thumbs up/down on a message |

Every authenticated query is scoped to the token's user id, so asking for
someone else's conversation returns 404, not their data.

### `/chat` streams or doesn't, depending on the caller

Send `Accept: text/event-stream` and you get Server-Sent Events — `meta`,
then a `chunk` per token, then `done`. That's what the web app uses for the
typing effect.

Send anything else and you get one JSON object with the complete reply. That's
what the mobile app uses, because SSE in React Native needs a polyfill.

Same route, same logic, same database writes. A partial reply is still saved if
the user hits stop mid-stream — what they saw on screen is still there on
reload.

## Layout

```
src/
  index.ts                 # express app, CORS, migrations on boot, shutdown
  env.ts                   # zod-validated config — fails at boot, not mid-request
  db/
    schema.ts              # Drizzle schema (PostgreSQL)
    index.ts               # pool + drizzle client
  auth/
    jwt.ts                 # sign / verify
    middleware.ts          # requireAuth, asyncHandler
  ai/
    provider.interface.ts  # the only contract the rest of the app knows about
    providers/             # anthropic.provider.ts — add new providers here
  services/chat.service.ts # conversation + prompt assembly
  tools/web-search.tool.ts # interface only, no provider connected yet
  routes/                  # one file per resource
drizzle/                   # generated SQL migrations, applied at boot
```

Nothing outside `src/ai/` imports `@anthropic-ai/sdk`. Adding OpenAI or a
future in-house model means one new file in `providers/` and one line in
`ai/index.ts` — no route, service, or UI changes.

## Running locally

```bash
npm install
cp .env.example .env    # set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm run dev             # http://localhost:4000
```

Migrations run automatically at startup — there's no separate setup step. To
change the schema, edit `src/db/schema.ts` then `npm run db:generate` and commit
the generated SQL.

`JWT_SECRET` must be at least 32 characters or the server refuses to boot. A
short signing secret is a real vulnerability, not a style preference.

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md). The [`render.yaml`](../render.yaml)
blueprint at the repo root provisions this service and its database together.
