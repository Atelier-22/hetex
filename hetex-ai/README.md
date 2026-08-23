# Hetex AI — v0.1

Built in Uganda. Designed for the world.

This is the first working foundation of Hetex AI: real authentication, real
persistent conversations, real streaming AI responses through a provider
abstraction layer — not a mockup. `npm run build` passes clean and I've
tested registration end-to-end against a real SQLite database before
packaging this.

## What's actually implemented in v0.1

- Email/password authentication (NextAuth + bcrypt, JWT sessions)
- Persistent conversations and messages (Drizzle ORM + SQLite for local dev)
- Streaming chat via Server-Sent Events, connected to a real AI provider
  abstraction (`src/lib/ai/`) — currently implemented for Anthropic's Claude
- Settings (theme, assistant name, response style)
- Projects (create/list — conversation linking is in the schema, UI to
  associate chats with a project comes in the next milestone)
- Library (data model + page shell — populates once image/file generation
  is wired up)
- System/Light/Dark theme, persisted, with the Hetex green/blue identity
- Responsive layout with a collapsible sidebar / mobile drawer

## What's intentionally NOT implemented yet (per the phased plan)

Image generation, video generation, voice, tool-calling beyond the
architecture, real payments/subscriptions, mobile apps. The abstractions for
most of these exist in the schema and provider layer so they can be added
without a rewrite — but nothing is faked in the UI.

## Getting it running

```bash
npm install
cp .env.example .env
```

Then edit `.env`:

1. `NEXTAUTH_SECRET` — generate one with `openssl rand -base64 32`
2. `ANTHROPIC_API_KEY` — your key from https://console.anthropic.com/
   (without this, chat will return a clear "provider not configured" error
   instead of a fake response)

Then set up the database and run:

```bash
npm run db:push
npm run dev
```

Visit http://localhost:3000 — you'll land on the login screen. Create an
account, and you're in.

## Project structure

```
src/
  app/
    (app)/              # authenticated routes (sidebar layout)
      page.tsx           # new chat
      chat/[id]/         # existing conversation
      settings/
      projects/
      library/
    login/ register/     # public auth pages
    api/                  # route handlers (auth, chat, conversations, ...)
  components/
    chat/                 # chat window, message bubbles
    sidebar.tsx
    theme-toggle.tsx
  lib/
    ai/                   # provider abstraction — add new providers here
    services/              # business logic between routes and DB
    db/                    # Drizzle schema + client
    auth.ts
```

Why Drizzle instead of Prisma: functionally equivalent for this project —
typed schema, typed queries, migrations — but it's pure TypeScript with no
separate binary engine to download at build time, which makes it lighter to
build, deploy, and reason about. If you'd rather use Prisma later (bigger
ecosystem, Prisma Studio GUI), the schema in `src/lib/db/schema.ts` maps
over directly; it's a swap, not a redesign.

## Adding a second AI provider (e.g. OpenAI)

1. Create `src/lib/ai/providers/openai.provider.ts` implementing `AIProvider`
   from `provider.interface.ts`
2. Register it in `src/lib/ai/index.ts`
3. Nothing in the chat UI, routes, or database needs to change

## Moving to production

- Swap `better-sqlite3` for `drizzle-orm/node-postgres` (or Neon/PlanetScale
  drivers) in `src/lib/db/index.ts` and `drizzle.config.ts` — the schema
  itself barely changes (column type helpers differ slightly)
- Set real secrets in your host's environment variable panel, never in code
- Add rate limiting middleware (usage records are already tracked per user,
  ready to enforce limits against)

## Roadmap (next milestones, per the original phased plan)

1. Wire Projects → conversations (move chats into a project from the UI)
2. Web search tool + calculator tool through the tools architecture
3. File uploads (PDF/DOCX/images) into conversations
4. Image generation provider + Library population
5. Usage-based free/pro tier enforcement
6. Voice (STT/TTS)

