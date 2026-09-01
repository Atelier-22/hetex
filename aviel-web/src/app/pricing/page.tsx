import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Pricing — Aviel AI",
  description: "Aviel AI is free while in early access.",
};

/**
 * Pricing.
 *
 * There is one plan because there is one plan: the backend reports "Free" and
 * no billing system exists. Inventing tiers and prices to fill a page would
 * mean publishing numbers nobody has decided.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--text-secondary)]">
          Aviel AI is in early access. There is one plan, and it is free.
        </p>

        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-7 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Early access
          </p>
          <p className="mt-2 text-4xl font-semibold">Free</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {[
              "Chat with Claude, with streaming replies",
              "Conversation history and projects",
              "Image attachments and your Library",
              "Web and mobile, one account",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check size={15} className="text-accent mt-0.5 shrink-0" />
                <span className="text-[var(--text-secondary)]">{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className="bg-accent-gradient mt-7 block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
          {/* TODO: paid tiers, limits and prices are undecided. Nothing is
              published here until they exist, so this page never promises a
              plan that cannot be bought. */}
          Paid plans are not available yet. If usage limits or paid tiers are
          introduced, they will be announced here first.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
