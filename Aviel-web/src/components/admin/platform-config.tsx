"use client";

// Platform configuration — the administrator's settings.
//
// Deliberately here and not in the user Settings screen. Nothing on this panel
// is a personal preference: a feature switched off here disappears from every
// account as unavailable, and a limit set here is enforced on the request path
// regardless of what any client sends.

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";

type Features = Record<string, boolean>;

type Limits = {
  messagesPerDay: number;
  imageGenerationsPerDay: number;
  imageUploadsPerDay: number;
  voiceMinutesPerDay: number;
  maxUploadMb: number;
  maxAttachmentsPerMessage: number;
  maxStorageMb: number;
  maxProjects: number;
  maxMemoryEntries: number;
  maxOutputTokens: number;
};

type Config = {
  features: Features;
  limits: Limits;
  allowedFileTypes: string[];
  defaults: {
    model: string;
    theme: string;
    memoryEnabled: boolean;
    autoRouting: boolean;
  };
  billingConfigured: boolean;
  revealProviderNames: boolean;
};

type Payload = {
  config: Config;
  providers: {
    id: string;
    label: string;
    vendor: string | null;
    configured: boolean;
    local: boolean;
    models: { value: string; label: string }[];
  }[];
  localAI: { runtime: string; available: boolean; models: { name: string }[] };
};

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  voice: "Voice",
  liveVoice: "Live voice",
  imageAnalysis: "Image analysis",
  imageGeneration: "Image generation",
  fileUploads: "File uploads",
  memory: "Memory",
  projects: "Projects",
  library: "Library",
  webSearch: "Web search",
  localAI: "Local AI",
  integrations: "Integrations",
};

const LIMIT_LABELS: { key: keyof Limits; label: string; hint: string }[] = [
  { key: "messagesPerDay", label: "Messages per day", hint: "0 means no limit" },
  { key: "imageGenerationsPerDay", label: "Image generations per day", hint: "0 means no limit" },
  { key: "imageUploadsPerDay", label: "Image uploads per day", hint: "0 means no limit" },
  { key: "voiceMinutesPerDay", label: "Voice minutes per day", hint: "0 means no limit" },
  { key: "maxUploadMb", label: "Maximum file size (MB)", hint: "1–100" },
  { key: "maxAttachmentsPerMessage", label: "Attachments per message", hint: "1–20" },
  { key: "maxStorageMb", label: "Storage per account (MB)", hint: "0 means no limit" },
  { key: "maxProjects", label: "Projects per account", hint: "0 means no limit" },
  { key: "maxMemoryEntries", label: "Memory entries per account", hint: "1–500" },
  { key: "maxOutputTokens", label: "Maximum output tokens", hint: "256–32000" },
];

export function PlatformConfigPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/config", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load configuration (${res.status})`);
        setData(await res.json());
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load configuration")
      );
  }, []);

  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "That change was refused.");

      setData((prev) => (prev ? { ...prev, config: payload.config } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That change was refused.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <section className="rounded-xl border border-[var(--border-subtle)] p-5">
        <p className="flex items-center gap-2 text-sm text-Aviel-red-500">
          <AlertCircle size={15} /> {error}
        </p>
        <button
          onClick={load}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm"
        >
          <RefreshCw size={13} /> Try again
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="h-40 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
    );
  }

  const { config } = data;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Platform configuration</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Applies to every account. A feature turned off here shows in user
            Settings as unavailable, and limits are enforced by the API rather
            than the browser.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saved && (
            <span className="text-accent flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          )}
        </span>
      </header>

      {error && (
        <p role="alert" className="text-xs text-Aviel-red-500">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h3 className="text-sm font-medium">Features</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(config.features).map(([key, on]) => {
            // Image generation cannot be switched on: no provider implements
            // it, and the API refuses the change rather than letting the flag
            // enable a button that then fails.
            const locked = key === "imageGeneration";
            return (
              <label
                key={key}
                className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm ${
                  locked ? "opacity-60" : ""
                }`}
              >
                <span>
                  {FEATURE_LABELS[key] ?? key}
                  {locked && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
                      no provider
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked || saving}
                  onChange={(e) =>
                    patch({ features: { [key]: e.target.checked } })
                  }
                  className="h-4 w-4"
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h3 className="text-sm font-medium">Limits</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LIMIT_LABELS.map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block">{label}</span>
                <span className="block text-[11px] text-[var(--text-secondary)]">
                  {hint}
                </span>
              </span>
              <input
                type="number"
                defaultValue={config.limits[key]}
                disabled={saving}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== config.limits[key]) {
                    patch({ limits: { [key]: value } });
                  }
                }}
                className="w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-right text-sm tabular-nums"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h3 className="text-sm font-medium">Defaults for new accounts</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
            Default model
            <select
              value={config.defaults.model}
              disabled={saving}
              onChange={(e) => patch({ defaults: { model: e.target.value } })}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-sm"
            >
              {data.providers
                .flatMap((p) => p.models)
                .map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
            Default theme
            <select
              value={config.defaults.theme}
              disabled={saving}
              onChange={(e) => patch({ defaults: { theme: e.target.value } })}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-sm"
            >
              {["system", "light", "dark", "amoled"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
            Memory on by default
            <input
              type="checkbox"
              checked={config.defaults.memoryEnabled}
              disabled={saving}
              onChange={(e) =>
                patch({ defaults: { memoryEnabled: e.target.checked } })
              }
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
            Automatic model selection by default
            <input
              type="checkbox"
              checked={config.defaults.autoRouting}
              disabled={saving}
              onChange={(e) =>
                patch({ defaults: { autoRouting: e.target.checked } })
              }
              className="h-4 w-4"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h3 className="text-sm font-medium">Providers</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          Which services this server can reach. Keys live in the server
          environment; there is no field here to enter one.
        </p>
        <div className="mt-3 space-y-2">
          {data.providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <span>
                {p.vendor ?? p.label}
                <span className="ml-2 text-xs text-[var(--text-secondary)]">
                  {p.models.length} model{p.models.length === 1 ? "" : "s"}
                </span>
              </span>
              <span
                className={
                  p.configured ? "text-accent text-xs" : "text-xs text-[var(--text-secondary)]"
                }
              >
                {p.configured ? "Configured" : "Not configured"}
              </span>
            </div>
          ))}
        </div>

        <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block">Show vendor names to users</span>
            <span className="block text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Off by default: the assistant&apos;s own prompt refuses to name the
              model vendor, so Settings names none either. Turning this on shows
              them in user Settings as well.
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.revealProviderNames}
            disabled={saving}
            onChange={(e) => patch({ revealProviderNames: e.target.checked })}
            className="h-4 w-4 shrink-0"
          />
        </label>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h3 className="text-sm font-medium">Local AI</h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Runtime: {data.localAI.available ? data.localAI.runtime : "none"} ·{" "}
          {data.localAI.models.length} model
          {data.localAI.models.length === 1 ? "" : "s"} installed
        </p>
      </div>
    </section>
  );
}
