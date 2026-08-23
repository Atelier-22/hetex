"use client";

import { useCallback, useEffect, useState } from "react";
import { Puzzle } from "lucide-react";
import {
  SectionHeader,
  SettingsButton,
  SaveIndicator,
  NotWiredBadge,
} from "../primitives";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";

type Integration = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  status: "connected" | "disconnected";
  connectedAt: string | null;
};

export function PluginsSection() {
  const { state, error, run } = useSave();
  const [items, setItems] = useState<Integration[] | null>(null);

  const load = useCallback(() => {
    apiFetch<Integration[]>("/integrations")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(load, [load]);

  async function toggle(item: Integration) {
    const action = item.status === "connected" ? "disconnect" : "connect";
    const ok = await run(() =>
      apiFetch(`/integrations/${item.id}/${action}`, { method: "POST" })
    );
    if (ok) load();
  }

  const anyAvailable = items?.some((i) => i.available);

  return (
    <>
      <SectionHeader
        title="Plugins"
        description="Tools Hetex can use on your behalf."
      />

      {items && !anyAvailable && (
        <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
          <NotWiredBadge>None available yet</NotWiredBadge>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            No integration is implemented yet, so none can be connected. These
            are the ones planned — the list comes from the server, so it updates
            here the moment one ships.
          </p>
        </div>
      )}

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      {!items && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items?.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] px-4 py-3.5"
          >
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <Puzzle size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {item.available ? (
                <SettingsButton
                  variant={item.status === "connected" ? "default" : "primary"}
                  onClick={() => toggle(item)}
                >
                  {item.status === "connected" ? "Disconnect" : "Connect"}
                </SettingsButton>
              ) : (
                // Disabled rather than hidden: knowing it's planned is useful,
                // and a button that appears to work but doesn't is not.
                <span className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                  Coming soon
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
