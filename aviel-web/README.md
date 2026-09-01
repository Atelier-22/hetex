# Aviel AI — Web

Built in Uganda. Designed for the world.

The Next.js frontend for Aviel AI, deployed on Vercel. It renders the UI and
nothing else: no database, no API keys, no model calls. Everything goes through
[`aviel-api`](../aviel-api/README.md).

## What's here

- Email/password auth via NextAuth, verified against the Aviel API
- Streaming chat over Server-Sent Events
- Conversations, projects, library, per-user settings and memory
- Image attachments (analysed by the model), file attachments (stored + named)
- System / light / dark theme with the Aviel green-blue identity
- Responsive layout with a collapsible sidebar and mobile drawer

## How auth works

The login form calls NextAuth's credentials provider, which calls the API's
`/auth/login`. The bearer token that comes back is stored inside the NextAuth
session cookie — not in `localStorage`, which any injected script could read.
Client components pull it back out through `getSession()` in
[src/lib/api-client.ts](src/lib/api-client.ts); server components use
[src/lib/api-server.ts](src/lib/api-server.ts).

`NEXTAUTH_SECRET` (encrypts that cookie) and the backend's `JWT_SECRET` (signs
API tokens) are different secrets doing different jobs. Don't reuse one for the
other.

## Running locally

The API has to be running first — see [aviel-api](../aviel-api/README.md).

```bash
npm install
cp .env.example .env.local   # set NEXTAUTH_SECRET
npm run dev                  # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000`. Because it is
`NEXT_PUBLIC_`, it is compiled into the browser bundle at build time — changing
it in production needs a redeploy, not just a restart.

## Layout

```
src/
  app/
    (app)/               # authenticated routes (sidebar layout)
      page.tsx            # new chat
      chat/[id]/          # existing conversation
      settings/ projects/ library/ terms/
    login/ register/      # public auth pages
    api/auth/[...nextauth]/  # the only route handler left — session management
  components/
    chat/                 # chat window, bubbles, composer, message actions
    sidebar.tsx  theme-toggle.tsx  providers.tsx
  lib/
    api.ts                # base URL + error shape
    api-client.ts         # browser fetch, bearer token from the session
    api-server.ts         # server-component fetch
    auth.ts               # NextAuth config
```

There is deliberately no `lib/db`, `lib/ai`, or `lib/services` here any more —
all of that lives in the backend.

## Deployment

Vercel, with **Root Directory set to `aviel-web`**. Full walkthrough in
[DEPLOYMENT.md](../DEPLOYMENT.md).
