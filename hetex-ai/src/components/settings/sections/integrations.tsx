"use client";

import { useCallback, useEffect, useState } from "react";
import { Blocks, RefreshCw } from "lucide-react";
import {
  Callout,
  LoadingRows,
  SectionHeader,
  SettingsButton,
  SettingsCard,
  StatusPill,
} from "../primitives";
import { useSectionShell } from "../use-section";
import { apiFetch } from "@/lib/api-client";

type Integration = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  status: "connected" | "disconnected" | "error";
  connectedAt: string | null;
};

export function IntegrationsSection() {
  const { meta } = useSectionShell();
  const [items, setItems] = useState<Integration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Integration[]>("/integrations")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(load, [load]);

  async function toggle(item: Integration) {
    const action = item.status === "connected" ? "disconnect" : "connect";
    setBusy(item.id);
    setError(null);
    try {
      await apiFetch(`/integrations/${item.id}/${action}`, { method: "POST" });
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That didn't work."
      );
    } finally {
      setBusy(null);
    }
  }

  const anyAvailable = items?.some((i) => i.available) ?? false;
  const disabledByAdmin = meta?.features?.integrations === false;

  return (
    <>
      <SectionHeader
        title="Integrations"
        description="Services Hetex can use on your behalf. The catalogue comes from the server, so it updates here the moment one ships."
      />

      {items && !anyAvailable && (
        <Callout tone="warn" title="Nothing is connectable yet">
          No integration provider is implemented on this server, so none can be
          connected. The framework is in place — a catalogue, per-account
          connection records, and connect/disconnect endpoints — and the server
          refuses a connection attempt rather than recording a fake one. What is
          missing in each case is an OAuth client and the code to use the
          service.
        </Callout>
      )}

      {disabledByAdmin && (
        <Callout tone="warn" title="Integrations are unavailable">
          An administrator has turned them off for this server.
        </Callout>
      )}

      {!items && <LoadingRows count={3} />}

      <SettingsCard>
        {items?.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 border-b border-[var(--border-subtle)] py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <Blocks size={16} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.name}
                  <StatusPill
                    tone={
                      item.status === "connected"
                        ? "ok"
                        : item.status === "error"
                          ? "off"
                          : "neutral"
                    }
                  >
                    {item.status === "connected"
                      ? "Connected"
                      : item.status === "error"
                        ? "Error"
                        : "Not connected"}
                  </StatusPill>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
                {item.connectedAt && (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Connected {new Date(item.connectedAt).toLocaleDateString()}
                  </p>
                )}
                {!item.available && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    Not implemented yet. Connecting is refused by the server
                    rather than recorded, so this can never claim a capability
                    that does not exist.
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:pt-0.5">
              {item.available ? (
                <>
                  <SettingsButton
                    variant={item.status === "connected" ? "default" : "primary"}
                    busy={busy === item.id}
                    disabled={disabledByAdmin}
                    onClick={() => toggle(item)}
                  >
                    {item.status === "connected" ? "Disconnect" : "Connect"}
                  </SettingsButton>
                  {item.status === "error" && (
                    <SettingsButton onClick={() => toggle(item)}>
                      <RefreshCw size={13} /> Reconnect
                    </SettingsButton>
                  )}
                </>
              ) : (
                <StatusPill>Coming</StatusPill>
              )}
            </div>
          </div>
        ))}
      </SettingsCard>

      {error && (
        <p role="alert" className="mt-3 text-xs text-hetex-red-500">
          {error}
        </p>
      )}

      <Callout title="Permissions">
        When an integration does ship, the permissions it asks for will be listed
        on its row before you connect, and shown here afterwards. Nothing is
        granted implicitly.
      </Callout>
    </>
  );
}
