"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AtSign, Clock, Globe2, Mail, UserRound } from "lucide-react";
import {
  Callout,
  ConfirmButton,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  StatusPill,
  TextField,
} from "../primitives";
import { HetexIcon } from "../../logo";
import { useSection } from "../use-section";
import { useSettingsUi } from "../settings-context";
import { apiFetch } from "@/lib/api-client";

/** Interests are a list, but nobody wants a list editor for five words. */
function parseInterests(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
}

const COUNTRIES = [
  "UG", "KE", "TZ", "RW", "NG", "ZA", "GH", "ET",
  "GB", "US", "CA", "IE", "AU", "NZ",
  "DE", "FR", "ES", "IT", "NL", "SE", "PT",
  "IN", "PK", "BD", "AE", "SA", "EG",
  "BR", "MX", "AR", "JP", "KR", "CN", "SG",
];

export function ProfileSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("profile");
  const { data: session, update: updateSession } = useSession();
  const { setSection } = useSettingsUi();

  const [interests, setInterests] = useState(values.interests.join(", "));
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    setInterests(values.interests.join(", "));
  }, [values.interests]);

  // Offered rather than assumed: guessing someone's time zone and saving it
  // without asking is a change they never made.
  const browserZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

  const initials = (
    (values.displayName || session?.user?.email || "?").match(/\b\w/g) ?? ["?"]
  )
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function saveDisplayName(next: string) {
    set({ displayName: next.trim() || null });
    // The session carries the name into the sidebar and the header, so it has
    // to be told too or the two disagree until the next reload.
    await updateSession({ name: next.trim() }).catch(() => {});
  }

  async function saveUsername(next: string) {
    setUsernameError(null);
    const trimmed = next.trim();

    if (trimmed && !/^[a-zA-Z0-9_.-]{3,32}$/.test(trimmed)) {
      setUsernameError("Use 3–32 letters, numbers, dot, dash or underscore.");
      return;
    }

    try {
      await apiFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({ profile: { username: trimmed || null } }),
      });
      set({ username: trimmed || null });
    } catch (err) {
      setUsernameError(
        err instanceof Error ? err.message : "Couldn't save that username."
      );
    }
  }

  return (
    <>
      <SectionHeader
        title="Profile & account"
        description="Who you are, how Hetex addresses you, and how you sign in."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard>
        <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] py-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <HetexIcon size={38} />
            <span className="bg-accent-gradient absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white">
              {initials}
            </span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {values.displayName || "Your account"}
            </p>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {session?.user?.email}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <StatusPill>No upload</StatusPill>
              Profile pictures need a file store, which isn&apos;t connected.
              Your initials are used instead.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Identity">
        <SettingsRow label="Full name" icon={UserRound}>
          <TextField
            label="Full name"
            className="w-56"
            value={values.fullName ?? ""}
            onCommit={(v) => set({ fullName: v.trim() || null })}
            maxLength={120}
            autoComplete="name"
          />
        </SettingsRow>

        <SettingsRow
          label="Display name"
          description="What Hetex calls you, and what appears in the sidebar."
        >
          <TextField
            label="Display name"
            className="w-56"
            value={values.displayName ?? ""}
            onCommit={saveDisplayName}
            maxLength={80}
          />
        </SettingsRow>

        <SettingsRow
          label="Username"
          icon={AtSign}
          description="Unique across Hetex. Leave it blank if you would rather not have one."
        >
          <TextField
            label="Username"
            className="w-56"
            value={values.username ?? ""}
            onCommit={saveUsername}
            maxLength={32}
            placeholder="not set"
            error={usernameError}
          />
        </SettingsRow>

        <SettingsRow
          label="Email"
          icon={Mail}
          unavailable="Changing your email needs a confirmation message, and no mail transport is connected to this server."
        >
          <span className="text-sm text-[var(--text-secondary)]">
            {session?.user?.email}
          </span>
        </SettingsRow>

        <SettingsRow label="Phone number">
          <TextField
            label="Phone number"
            className="w-56"
            type="tel"
            inputMode="tel"
            value={values.phone ?? ""}
            onCommit={(v) => set({ phone: v.trim() || null })}
            maxLength={32}
            autoComplete="tel"
          />
        </SettingsRow>

        <SettingsRow label="Country" icon={Globe2}>
          <select
            aria-label="Country"
            value={values.country ?? ""}
            onChange={(e) => set({ country: e.target.value || null })}
            className="focus-ring min-w-[10rem] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-sm outline-none"
          >
            <option value="">Not set</option>
            {COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code}
              </option>
            ))}
          </select>
        </SettingsRow>

        <SettingsRow
          label="Time zone"
          icon={Clock}
          description={
            browserZone && values.timezone !== browserZone ? (
              <button
                type="button"
                onClick={() => set({ timezone: browserZone })}
                className="focus-ring rounded underline underline-offset-2"
              >
                Use this device&apos;s zone ({browserZone})
              </button>
            ) : undefined
          }
        >
          <TextField
            label="Time zone"
            className="w-56"
            value={values.timezone ?? ""}
            onCommit={(v) => set({ timezone: v.trim() || null })}
            placeholder="Not set"
            maxLength={64}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Personalization"
        description="Everything here is added to what Hetex knows about you, and it uses it when replying."
      >
        <SettingsRow
          label="Preferred name"
          description="What you would like to be called, if it differs from your display name."
        >
          <TextField
            label="Preferred name"
            className="w-56"
            value={values.preferredName ?? ""}
            onCommit={(v) => set({ preferredName: v.trim() || null })}
            maxLength={80}
          />
        </SettingsRow>

        <SettingsRow label="Preferred greeting">
          <TextField
            label="Preferred greeting"
            className="w-56"
            value={values.preferredGreeting ?? ""}
            onCommit={(v) => set({ preferredGreeting: v.trim() || null })}
            placeholder="e.g. Hey"
            maxLength={120}
          />
        </SettingsRow>

        <SettingsRow
          label="Pronunciation"
          description="How your name sounds. Used when a reply is read aloud."
        >
          <TextField
            label="Pronunciation"
            className="w-56"
            value={values.pronunciation ?? ""}
            onCommit={(v) => set({ pronunciation: v.trim() || null })}
            placeholder="e.g. MOO-weh-zee"
            maxLength={120}
          />
        </SettingsRow>

        <SettingsRow label="Birthday">
          <input
            type="date"
            aria-label="Birthday"
            value={values.birthday ?? ""}
            onChange={(e) => set({ birthday: e.target.value || null })}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-sm outline-none"
          />
        </SettingsRow>

        <SettingsRow label="Occupation">
          <TextField
            label="Occupation"
            className="w-56"
            value={values.occupation ?? ""}
            onCommit={(v) => set({ occupation: v.trim() || null })}
            maxLength={120}
          />
        </SettingsRow>

        <SettingsBlock
          label="Interests"
          description="Separate them with commas. Up to twenty."
        >
          <TextField
            label="Interests"
            value={interests}
            onCommit={(v) => set({ interests: parseInterests(v) })}
            placeholder="e.g. distributed systems, jazz, cycling"
          />
          {values.interests.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {values.interests.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </SettingsBlock>
      </SettingsCard>

      <SettingsCard title="Account">
        <SettingsRow
          label="Password, two-factor and devices"
          description="Managed in Security."
        >
          <SettingsButton onClick={() => setSection("security")}>
            Open Security
          </SettingsButton>
        </SettingsRow>

        <SettingsRow
          label="Delete account"
          description="Permanently removes your account and everything in it."
        >
          <ConfirmButton
            question="Account deletion is handled in Privacy & data, where it asks for your password."
            confirmLabel="Take me there"
            onConfirm={() => setSection("privacy")}
          >
            Delete account
          </ConfirmButton>
        </SettingsRow>
      </SettingsCard>

      {meta?.capabilities?.emailDelivery === false && (
        <Callout title="What isn't connected">
          {String(meta.capabilities.emailDeliveryReason)} That is why changing
          your email address is unavailable rather than merely difficult.
        </Callout>
      )}
    </>
  );
}
