"use client";

import { useEffect, useState } from "react";
import {
  SectionHeader,
  SettingsRow,
  SettingsDropdown,
  SaveIndicator,
  NotWiredBadge,
} from "../primitives";
import { usePreferences, type NotificationChannel } from "../../preferences";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";

type Meta = {
  notificationCategories: { id: string; label: string; description: string }[];
  notificationChannels: { value: NotificationChannel; label: string }[];
};

export function NotificationsSection() {
  const { prefs, update } = usePreferences();
  const { state, error, run } = useSave();
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    apiFetch<Meta>("/settings/meta").then(setMeta).catch(() => {});
  }, []);

  function setChannel(category: string, channel: NotificationChannel) {
    run(() =>
      update({
        notificationPrefs: { ...prefs.notificationPrefs, [category]: channel },
      })
    );
  }

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Choose how each kind of update reaches you."
      />

      <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <div className="flex items-start gap-2">
          <NotWiredBadge>Not sending yet</NotWiredBadge>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          Hetex does not send notifications yet — there is no push service or
          mail transport connected. Your choices are stored and enforced by the
          permission check every future sender has to pass, so nothing will be
          sent that you have turned off here.
        </p>
      </div>

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      {!meta && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5"
            />
          ))}
        </div>
      )}

      {meta?.notificationCategories.map((c) => (
        <SettingsRow key={c.id} label={c.label} description={c.description}>
          <SettingsDropdown<NotificationChannel>
            label={`${c.label} notifications`}
            value={(prefs.notificationPrefs[c.id] as NotificationChannel) ?? "off"}
            onChange={(v) => setChannel(c.id, v)}
            options={meta.notificationChannels}
          />
        </SettingsRow>
      ))}

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
