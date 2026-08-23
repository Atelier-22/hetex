import Link from "next/link";
import {
  MessageSquare,
  FolderKanban,
  Library,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Globe,
  Brain,
} from "lucide-react";
import { MarketingNav } from "./nav";
import { MarketingFooter } from "./footer";
import { HeroPrompt } from "./hero-prompt";

/**
 * Public landing page, shown at "/" to logged-out visitors.
 *
 * Every feature named here is one the product actually ships today. Nothing on
 * this page describes something a visitor could sign up for and then fail to
 * find.
 */

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Real conversations",
    body: "Replies stream as they are written, and every conversation is saved so you can pick it back up later — or switched off entirely if you would rather nothing were kept.",
  },
  {
    icon: Globe,
    title: "It can look things up",
    body: "When an answer depends on something current, Hetex searches the web itself and shows you the pages it read, so you can check the source rather than take its word.",
  },
  {
    icon: Brain,
    title: "It learns how you work",
    body: "Turn memory on and Hetex notes what matters — the language you write in, the answers you find useful — so you stop explaining yourself every time.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    body: "Group related conversations together instead of scrolling through one long list looking for the thread you had last week.",
  },
  {
    icon: Library,
    title: "Files and images",
    body: "Attach an image and ask about it. What you share is collected in your Library, tied to the conversation it came from.",
  },
  {
    icon: Smartphone,
    title: "Web and mobile",
    body: "One account across both. A conversation started in the browser is the same conversation on your phone, because both talk to the same backend.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MarketingNav />

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:pt-24">
        {/* Brand glow rather than flat black, kept low-opacity so text contrast
            is unaffected. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[52rem] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.18] blur-3xl"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, var(--accent-from), transparent)",
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-[2rem] font-semibold tracking-tight sm:text-5xl">
            What can I help with?
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)] sm:mt-5 sm:text-lg">
            AI should empower people, not replace them — so Hetex AI is a
            straightforward assistant for thinking, writing and working through
            problems, on the web and on your phone.
          </p>

          <div className="mx-auto mt-8 max-w-2xl sm:mt-9">
            <HeroPrompt />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <PillLink href="/register">Talk with Hetex AI</PillLink>
            <PillLink href="#what-it-does">What it does</PillLink>
            <PillLink href="/company">Our story</PillLink>
            <PillLink href="/pricing">Pricing</PillLink>
          </div>

          <p className="mt-10 text-sm text-[var(--text-secondary)]">
            Built in Uganda. Designed for the world.
          </p>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section
        id="what-it-does"
        className="border-t border-[var(--border-subtle)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            What Hetex AI does
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[var(--text-secondary)]">
            An early-stage product, built and shipped rather than announced.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6"
              >
                <span className="bg-accent-gradient mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white">
                  <Icon size={19} />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="border-t border-[var(--border-subtle)] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Ask",
                body: "Type it, or press the microphone and say it. Attach an image if it helps explain.",
              },
              {
                step: "02",
                title: "It looks things up",
                body: "When an answer depends on current information, Hetex searches the web itself and shows you the pages it read.",
              },
              {
                step: "03",
                title: "It gets to know you",
                body: "Switch memory on and it remembers how you like to work, so you stop repeating yourself. You can read and delete everything it has noted.",
              },
            ].map((s) => (
              <div key={s.step}>
                <span className="text-accent font-mono text-xs font-semibold">
                  {s.step}
                </span>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Your data ---------------- */}
      <section className="border-t border-[var(--border-subtle)] px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-4">
            <span className="bg-accent-gradient hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white sm:flex">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Your conversations are yours
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                We do not train on what you write — Hetex does not train models
                at all. Memory is off until you turn it on. You can switch off
                chat history entirely, and conversations are then deleted as
                each reply finishes.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                Export everything as a single file, delete all of it, or delete
                your account — each takes effect immediately, with no email to
                wait for and no recovery window to trap you.
              </p>
              <Link
                href="/privacy"
                className="text-accent mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                Read the privacy page <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="border-t border-[var(--border-subtle)] px-5 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Common questions
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {[
              {
                q: "What does it cost?",
                a: "Nothing. Hetex is free while in early access, and there are no paid plans yet.",
              },
              {
                q: "Can it search the web?",
                a: "Yes, and it decides when to on its own. Answers that used the web show the pages they came from.",
              },
              {
                q: "Does it remember me?",
                a: "Only if you switch memory on. It is off by default, and every remembered item is visible and deletable.",
              },
              {
                q: "Is there a mobile app?",
                a: "There is a React Native app sharing the same backend, and the web app works on a phone browser.",
              },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3.5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium marker:content-none">
                  {q}
                  <span className="shrink-0 text-[var(--text-secondary)] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {a}
                </p>
              </details>
            ))}
          </div>
          <Link
            href="/help"
            className="text-accent mt-5 inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            More answers <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ---------------- Story ---------------- */}
      <section
        id="story"
        className="border-t border-[var(--border-subtle)] px-5 py-20"
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Our story
          </h2>

          <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            <p>
              Hetex AI started as a vision in 2025 — an idea for what an AI
              company built from Uganda could look like.
            </p>
            <p>
              Through 2025 into 2026 that vision became something real: a
              full-stack AI platform, with a web app and a React Native mobile
              app, built from the ground up by{" "}
              <span className="text-[var(--text-primary)]">Muhwezi Peter</span>,
              founder, based in Kampala — with{" "}
              <span className="text-[var(--text-primary)]">Alafi Jonathan</span>{" "}
              collaborating on design and direction.
            </p>
            <p>
              We are a small team and this is early. What is here is what we
              have actually built, and it is the beginning rather than the
              finished thing.
            </p>
          </div>

          <p className="mt-8 border-l-2 border-[var(--accent-solid)] pl-4 text-[15px] italic text-[var(--text-primary)]">
            AI should empower people, not replace them.
          </p>

          <p className="mt-8 text-sm text-[var(--text-secondary)]">
            Built in Uganda. Designed for the world.
          </p>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-5 pb-20">
        <div className="bg-accent-gradient mx-auto max-w-5xl rounded-3xl px-6 py-14 text-center text-white">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Get started with Hetex AI
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/90">
            Free while we are in early access. Create an account and start a
            conversation.
          </p>
          <Link
            href="/register"
            className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0b1512] transition-opacity hover:opacity-90"
          >
            Create an account <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hover:border-accent rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 text-sm transition-colors"
    >
      {children}
    </Link>
  );
}
