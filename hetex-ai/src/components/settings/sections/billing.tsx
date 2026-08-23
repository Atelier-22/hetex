"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsButton,
  NotWiredBadge,
} from "../primitives";
import { apiFetch } from "@/lib/api-client";

type Billing = {
  plan: string;
  planLabel: string;
  description: string;
  memberSince: string | null;
  paidPlansAvailable: boolean;
  invoices: { id: string; amount: string; date: string }[];
  usage: { messages: number };
};

const INCLUDED = [
  "Chat with Claude, with streaming replies",
  "Conversation history and projects",
  "Image attachments and your Library",
  "Web and mobile, one account",
];

export function BillingSection() {
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Billing>("/billing")
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load billing")
      );
  }, []);

  return (
    <>
      <SectionHeader title="Billing" description="Your plan." />

      {error && <p className="text-xs text-hetex-red-500">{error}</p>}

      {!data && !error && (
        <div className="h-40 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
      )}

      {data && (
        <>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  {data.planLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold">{data.plan}</p>
              </div>
              <span className="bg-accent-soft rounded-full px-2.5 py-1 text-xs font-medium">
                Current plan
              </span>
            </div>

            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {data.description}
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={14} className="text-accent mt-0.5 shrink-0" />
                  <span className="text-[var(--text-secondary)]">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm">Upgrade</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  There are no paid plans yet. Nothing is published here until
                  pricing exists, so this button stays disabled rather than
                  linking to a checkout that isn&apos;t there.
                </p>
              </div>
              {/* Disabled rather than hidden — you should be able to see that
                  upgrading is a thing that will exist. */}
              <SettingsButton variant="primary" disabled>
                Upgrade
              </SettingsButton>
            </div>
          </div>

          <div className="mt-4">
            <SettingsRow label="Messages sent">
              <span className="text-sm">{data.usage.messages}</span>
            </SettingsRow>

            {data.memberSince && (
              <SettingsRow label="Member since">
                <span className="text-sm text-[var(--text-secondary)]">
                  {new Date(data.memberSince).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </SettingsRow>
            )}

            <SettingsRow
              label="Invoices"
              description="No charges have been made, so there are no invoices."
            >
              <NotWiredBadge>None</NotWiredBadge>
            </SettingsRow>
          </div>
        </>
      )}
    </>
  );
}
