import Link from "next/link";
import {
  MessageSquare,
  FolderKanban,
  Library,
  Smartphone,
  ArrowRight,
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
    body: "Chat with Claude through Hetex. Replies stream as they are written, and every conversation is saved so you can pick it back up later.",
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
