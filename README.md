# Hetex

Built in Uganda. Designed for the world.

Hetex AI is a general-purpose AI platform — chat with Claude, organised into
projects, with conversation history, per-user preferences, and a memory the
assistant can draw on. It runs on the web and on phones, off one backend.

## The three pieces

| Folder | What it is | Runs on |
| --- | --- | --- |
| [`hetex-api/`](hetex-api/) | Express + PostgreSQL API. Owns the database, auth, and every call to Claude | Render |
| [`hetex-ai/`](hetex-ai/) | Next.js web frontend | Vercel |
| [`hetex-mobile/`](hetex-mobile/) | React Native + Expo app | Expo / EAS |

```
  Browser  ──┐
             ├──►  hetex-api (Render)  ──►  PostgreSQL
  Phone    ──┘            │
                          └──────────────►  Claude (Anthropic)
```

Both clients call the same endpoints and share the same database, so an account
made on the web works on the phone and the conversations are the same ones. The
API key never leaves the backend — neither client holds a secret.

## Getting started

```bash
# Backend — start this first, the clients need it
cd hetex-api
npm install
cp .env.example .env      # set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm run dev               # http://localhost:4000

# Web frontend
cd hetex-ai
npm install
cp .env.example .env.local  # set NEXTAUTH_SECRET
npm run dev                 # http://localhost:3000
```

Each project has its own README with the detail:
[hetex-api](hetex-api/README.md) · [hetex-ai](hetex-ai/README.md) ·
[hetex-mobile](hetex-mobile/README.md)

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) — Render for the API and database, Vercel for
the frontend, EAS for the mobile build. It also lists the known gaps honestly:
what is wired but not yet finished.

## Environment variables

Never commit `.env`. Only `.env.example` belongs in the repo — it documents
which variables exist without exposing values. Real values go in the Render,
Vercel, and EAS dashboards.
