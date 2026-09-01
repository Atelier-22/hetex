"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Callout,
  LoadingRows,
  SectionHeader,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  Stat,
  StatusPill,
} from "../primitives";
import { useSectionShell } from "../use-section";
import { apiFetch } from "@/lib/api-client";

type Billing = {
  plan: string;
  planId: string;
  planLabel: string;
  description: string;
  memberSince: string | null;
  paidPlansAvailable: boolean;
  billingConfigured: boolean;
  billingNote: string | null;
  plans: {
    id: string;
    name: string;
    description: string;
    priceLabel: string;
    available: boolean;
  }[];
  invoices: unknown[];
  usage: {
    allTime: { messages: number; images: number; voice: number; toolCalls: number };
    today: { messages: number; images: number; voice: number };
    storageBytes: number;
    storageLimitBytes: number | null;
  };
  limits: {
    type: string;
    used: number;
    limit: number;
    remaining: number | null;
    exceeded: boolean;
  }[];
};

const INCLUDED = [
  "Unlimited conversations, with streaming replies",
  "Projects and a searchable Library",
  "Image attachments and analysis",
  "Memory, and full control over what is remembered",
  "Web and mobile, on one account",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LIMIT_LABEL: Record<string, string> = {
  message: "Messages",
  image: "Image generations",
  voice: "Voice minutes",
};

export function SubscriptionSection() {
  const { meta } = useSectionShell();
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Billing>("/billing")
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Couldn't load your plan.")
      );
  }, []);

  const capped = data?.limits.filter((l) => l.limit > 0) ?? [];

  return (
    <>
      <SectionHeader
        title="Subscription & usage"
        description="Your plan, what you have used, and any limits an administrator has set."
      />

      {error && (
        <p role="alert" className="text-xs text-aviel-red-500">
          {error}
        </p>
      )}
      {!data && !error && <LoadingRows count={3} />}

      {data && (
        <>
          <div className="settings-card mb-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  {data.planLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold">{data.plan}</p>
              </div>
              <StatusPill tone="accent">Current plan</StatusPill>
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

            {data.memberSince && (
              <p className="mt-4 text-xs text-[var(--text-secondary)]">
                Member since{" "}
                {new Date(data.memberSince).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>

          <SettingsCard title="Usage">
            <div className="py-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat
                  label="Messages"
                  value={data.usage.allTime.messages}
                  hint={`${data.usage.today.messages} today`}
                />
                <Stat label="Attachments" value={data.usage.allTime.toolCalls} />
                <Stat
                  label="Images"
                  value={data.usage.allTime.images}
                  hint={`${data.usage.today.images} today`}
                />
                <Stat
                  label="Storage"
                  value={formatBytes(data.usage.storageBytes)}
                  hint={
                    data.usage.storageLimitBytes
                      ? `of ${formatBytes(data.usage.storageLimitBytes)}`
                      : "no limit"
                  }
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Daily limits"
            description="Set by an administrator and enforced on the server. A client that ignores them is still refused."
          >
            {capped.length === 0 ? (
              <SettingsRow
                label="No daily limits"
                description="This server has no per-day ceiling configured on messages, images or voice."
              >
                <StatusPill tone="ok">Unlimited</StatusPill>
              </SettingsRow>
            ) : (
              capped.map((l) => (
                <SettingsRow
                  key={l.type}
                  label={LIMIT_LABEL[l.type] ?? l.type}
                  description={`${l.used} of ${l.limit} used today. Resets at midnight.`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className={`h-full ${l.exceeded ? "bg-aviel-red-500" : "bg-accent-gradient"}`}
                        style={{
                          width: `${Math.min(100, Math.round((l.used / l.limit) * 100))}%`,
                        }}
                      />
                    </div>
                    <StatusPill tone={l.exceeded ? "off" : "neutral"}>
                      {l.exceeded ? "Reached" : `${l.remaining} left`}
                    </StatusPill>
                  </div>
                </SettingsRow>
              ))
            )}
          </SettingsCard>

          <SettingsCard
            title="Plans"
            description="What is planned. Every plan says plainly whether it can be bought."
          >
            {data.plans.map((p) => (
              <SettingsRow
                key={p.id}
                label={p.name}
                description={p.description}
              >
                <div className="flex items-center gap-2">
                  <StatusPill tone={p.id === data.planId ? "accent" : "neutral"}>
                    {p.priceLabel}
                  </StatusPill>
                  {p.id === data.planId ? (
                    <StatusPill tone="ok">Yours</StatusPill>
                  ) : (
                    <SettingsButton
                      variant="primary"
                      disabled={!p.available || !data.billingConfigured}
                      title={
                        data.billingConfigured
                          ? undefined
                          : "No payment processor is connected."
                      }
                    >
                      Upgrade
                    </SettingsButton>
                  )}
                </div>
              </SettingsRow>
            ))}
          </SettingsCard>

          <SettingsCard title="Payments">
            <SettingsRow
              label="Payment method"
              unavailable={
                data.billingNote ??
                "No payment processor is connected to this server."
              }
            >
              <StatusPill tone="off">Not configured</StatusPill>
            </SettingsRow>

            <SettingsRow
              label="Invoices"
              description="No charge has ever been made, so there are no invoices to show."
            >
              <StatusPill>None</StatusPill>
            </SettingsRow>
          </SettingsCard>

          <Callout title="What is real here">
            The plan catalogue, the daily limits and every usage figure are read
            from the server. The Upgrade buttons are disabled rather than linking
            to a checkout that does not exist — when a processor is connected,
            this page needs no change beyond that flag flipping.
          </Callout>

          {meta?.billingConfigured === false && null}
        </>
      )}
    </>
  );
}
