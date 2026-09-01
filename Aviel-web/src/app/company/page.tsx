import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Company — Aviel AI",
  description: "Aviel AI is built in Kampala, Uganda by Muhwezi Peter.",
};

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Our story</h1>

        <div className="mt-7 space-y-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <p>
            Aviel AI started as a vision in 2025 — an idea for what an AI company
            built from Uganda could look like.
          </p>
          <p>
            Through 2025 into 2026 that vision became something real: a
            full-stack AI platform, with a web app and a React Native mobile app,
            built from the ground up by Muhwezi Peter, with Alafi Jonathan
            collaborating on design and direction.
          </p>
          <p>
            We are a small team and this is early. What is here is what we have
            actually built — a working product rather than a promise — and it is
            the beginning rather than the finished thing.
          </p>
        </div>

        <blockquote className="mt-9 border-l-2 border-[var(--accent-solid)] pl-4 text-lg italic">
          AI should empower people, not replace them.
        </blockquote>

        <h2 className="mt-12 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          People
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Person
            name="Muhwezi Peter"
            role="Founder"
            detail="Based in Kampala, Uganda. Built the platform."
          />
          <Person
            name="Alafi Jonathan"
            role="Co-founder"
            detail="Design and product collaborator."
          />
        </div>

        <p className="mt-12 text-sm text-[var(--text-secondary)]">
          Built in Uganda. Designed for the world.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Person({
  name,
  role,
  detail,
}: {
  name: string;
  role: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-accent text-xs font-medium">{role}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
        {detail}
      </p>
    </div>
  );
}
