# Hetex

Built in Uganda. Designed for the world.

A monorepo containing the Hetex AI platform:

| Folder | What it is | Stack |
| --- | --- | --- |
| [`hetex-ai/`](hetex-ai/) | Web app + API (the backend for everything) | Next.js 14, NextAuth, Drizzle ORM, Anthropic Claude |
| [`hetex-mobile/`](hetex-mobile/) | Mobile app | React Native + Expo |

The mobile app is a real native client that talks to `hetex-ai`'s API routes and
shares its database — it is not a webview wrapper. The two ship together, which
is why they live in one repo.

## Getting started

Each project has its own README with setup instructions:

- [hetex-ai/README.md](hetex-ai/README.md) — start here, the mobile app needs this running
- [hetex-mobile/README.md](hetex-mobile/README.md)

Quick version:

```bash
cd hetex-ai
npm install
cp .env.example .env   # then fill in NEXTAUTH_SECRET and ANTHROPIC_API_KEY
npm run db:push
npm run dev
```

## Environment variables

Never commit `.env`. Only `.env.example` belongs in the repo — it documents
which variables exist without exposing values. Real values go in your host's
environment variable panel (Vercel / Render) for deployed environments.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
