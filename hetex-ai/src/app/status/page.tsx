import type { Metadata } from "next";
import { API_BASE_URL } from "@/lib/api";
import { MarketingPage } from "@/components/marketing/page-shell";

export const metadata: Metadata = {
  title: "Status — Hetex AI",
  description: "Live status of the Hetex AI service.",
};

// Checked on every request. A status page that caches is worse than none.
export const dynamic = "force-dynamic";

type Health = { status: string; aiProvider: string };

async function checkApi(): Promise<{
  up: boolean;
  aiConfigured: boolean;
  ms: number;
}> {
  const started = Date.now();
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      // Render's free tier sleeps after inactivity and takes ~30s to wake, so
      // this has to allow for a cold start rather than calling it an outage.
      signal: AbortSignal.timeout(45_000),
    });
    const ms = Date.now() - started;
    if (!res.ok) return { up: false, aiConfigured: false, ms };

    const body = (await res.json()) as Health;
    return {
      up: body.status === "ok",
      aiConfigured: body.aiProvider === "configured",
      ms,
    };
  } catch {
    return { up: false, aiConfigured: false, ms: Date.now() - started };
  }
}

export default async function StatusPage() {
  const api = await checkApi();

  // The page rendering at all means the frontend is up.
  const services = [
    { name: "Website", up: true, detail: "Serving this page" },
    {
      name: "API and database",
      up: api.up,
      detail: api.up ? `Responded in ${api.ms} ms` : "Not responding",
    },
    {
      name: "AI responses",
      up: api.up && api.aiConfigured,
      detail:
        api.up && api.aiConfigured
          ? "Provider configured"
          : api.up
            ? "Provider not configured"
            : "Depends on the API",
    },
  ];

  const allUp = services.every((s) => s.up);

  return (
    <MarketingPage
      title="Status"
      intro="Checked live, each time this page loads. Nothing here is cached or hand-updated."
    >
      <div
        className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
          allUp
            ? "border-[var(--accent-solid)]/30 bg-[var(--accent-soft)]"
            : "border-hetex-red-500/30 bg-hetex-red-500/10"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            allUp ? "bg-accent" : "bg-hetex-red-500"
          }`}
        />
        <p className="text-sm font-medium">
          {allUp
            ? "All systems operational"
            : "Some services are having trouble"}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm">{s.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{s.detail}</p>
            </div>
            <span
              className={`shrink-0 text-xs font-medium ${
                s.up ? "text-accent" : "text-hetex-red-500"
              }`}
            >
              {s.up ? "Operational" : "Down"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[var(--text-secondary)]">
        Hetex runs on a free hosting tier, which sleeps after a period of
        inactivity. The first request after a quiet spell can take around thirty
        seconds while the service wakes — that is not an outage, and this check
        waits for it rather than reporting one.
      </p>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        There is no incident history yet. Past incidents will be listed here
        once there are any to list.
      </p>
    </MarketingPage>
  );
}
