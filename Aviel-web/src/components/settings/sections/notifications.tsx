"use client";

import { useEffect, useState } from "react";
import { BellRing, Moon, Volume2 } from "lucide-react";
import {
  Callout,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import type { NotificationChannel } from "@/lib/settings/types";

export function NotificationsSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("notifications");

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  async function requestPermission() {
    if (permission === "unsupported") return;
    setAsking(true);
    try {
      setPermission(await Notification.requestPermission());
    } finally {
      setAsking(false);
    }
  }

  const categories = meta?.notificationCategories ?? [];
  const channels = (meta?.notificationChannels ?? []) as {
    value: NotificationChannel;
    label: string;
  }[];

  const desktopUsable = permission === "granted";

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="What reaches you, and how."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard
        title="Browser notifications"
        description="The one kind of notification that works today: your browser tells you when a long reply finishes while this tab is in the background. It never leaves your device."
      >
        <SettingsRow
          label="Tell me when a reply finishes"
          icon={BellRing}
          unavailable={
            permission === "unsupported"
              ? "This browser has no Notification API."
              : permission === "denied"
                ? "Notifications are blocked for this site. Allow them in your browser's site settings to switch this on."
                : permission === "default"
                  ? "Your browser has not been asked yet."
                  : undefined
          }
        >
          <div className="flex items-center gap-2">
            {permission === "granted" && <StatusPill tone="ok">Allowed</StatusPill>}
            {permission === "denied" && <StatusPill tone="off">Blocked</StatusPill>}
            {permission === "default" && (
              <button
                type="button"
                onClick={requestPermission}
                disabled={asking}
                className="focus-ring rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                {asking ? "Asking…" : "Allow"}
              </button>
            )}
            <SettingsToggle
              label="Tell me when a reply finishes"
              checked={values.desktopCompletion && desktopUsable}
              onChange={(v) => set({ desktopCompletion: v })}
              disabled={!desktopUsable}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Notification sound"
          icon={Volume2}
          description="A short tone alongside the notification."
        >
          <SettingsToggle
            label="Notification sound"
            checked={values.sound}
            onChange={(v) => set({ sound: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Quiet hours">
        <SettingsRow
          label="Quiet hours"
          icon={Moon}
          description="Nothing is shown between these times. Uses this device's clock."
        >
          <SettingsToggle
            label="Quiet hours"
            checked={values.quietHoursEnabled}
            onChange={(v) => set({ quietHoursEnabled: v })}
          />
        </SettingsRow>

        <SettingsRow label="From">
          <input
            type="time"
            aria-label="Quiet hours start"
            value={values.quietHoursStart}
            disabled={!values.quietHoursEnabled}
            onChange={(e) => set({ quietHoursStart: e.target.value })}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-sm outline-none disabled:opacity-40"
          />
        </SettingsRow>

        <SettingsRow label="Until">
          <input
            type="time"
            aria-label="Quiet hours end"
            value={values.quietHoursEnd}
            disabled={!values.quietHoursEnabled}
            onChange={(e) => set({ quietHoursEnd: e.target.value })}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-sm outline-none disabled:opacity-40"
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Push and email"
        description="Choose how each kind of update should reach you when delivery exists."
      >
        {!meta && (
          <div className="py-4">
            <LoadingRows count={4} />
          </div>
        )}

        {categories.map((c) => (
          <SettingsRow key={c.id} label={c.label} description={c.description}>
            <SettingsDropdown<NotificationChannel>
              label={`${c.label} notifications`}
              value={(values.categories[c.id] as NotificationChannel) ?? "off"}
              onChange={(v) =>
                set({ categories: { ...values.categories, [c.id]: v } })
              }
              options={channels}
            />
          </SettingsRow>
        ))}
      </SettingsCard>

      {meta?.notificationsDeliverable === false && (
        <Callout tone="warn" title="Nothing is sent yet">
          Aviel has no push service and no mail transport, so no push
          notification or email has ever been sent. Your choices above are
          stored and are checked by the permission gate every future sender has
          to pass — so nothing will be sent that you have turned off here. The
          browser notification at the top of this page is the only one that
          works today, and it never leaves your device.
        </Callout>
      )}
    </>
  );
}
