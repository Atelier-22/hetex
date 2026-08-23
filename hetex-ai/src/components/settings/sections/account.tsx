"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Mail, ShieldCheck } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsBlock,
  SettingsButton,
  SaveIndicator,
} from "../primitives";
import { HetexIcon } from "../../logo";
import { useSave } from "../use-save";
import { useSettings } from "../settings-context";
import { apiFetch } from "@/lib/api-client";

export function AccountSection() {
  const { data: session, update: updateSession } = useSession();
  const { setSection } = useSettings();
  const { state, error, run } = useSave();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setDisplayName(session?.user?.name ?? "");
  }, [session?.user?.name]);

  const dirty = displayName.trim() !== (session?.user?.name ?? "");

  async function saveName() {
    if (!dirty || !displayName.trim()) return;
    await run(async () => {
      await apiFetch("/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      await updateSession({ name: displayName.trim() });
    });
  }

  const initials = (
    (session?.user?.name || session?.user?.email || "?").match(/\b\w/g) ?? ["?"]
  )
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <SectionHeader title="Account" description="Your profile and how you sign in." />

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] pb-5">
        {/* No avatar upload exists, so the account falls back to the Hetex mark
            with the user's initials beside it rather than an empty circle. */}
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <HetexIcon size={34} />
          <span className="bg-accent-gradient absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white">
            {initials}
          </span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {session?.user?.name || "Your account"}
          </p>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {session?.user?.email}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Custom profile pictures aren&apos;t supported yet.
          </p>
        </div>
      </div>

      <SettingsBlock label="Display name" description="What Hetex calls you.">
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            onBlur={saveName}
            className="focus-accent flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          <SettingsButton
            variant="primary"
            onClick={saveName}
            disabled={!dirty || !displayName.trim()}
            busy={state === "saving"}
          >
            Save
          </SettingsButton>
        </div>
      </SettingsBlock>

      <SettingsRow
        label="Email"
        icon={Mail}
        description="Changing your email isn't supported yet."
      >
        <span className="text-sm text-[var(--text-secondary)]">
          {session?.user?.email}
        </span>
      </SettingsRow>

      <SettingsRow
        label="Sign-in method"
        icon={ShieldCheck}
        description="Email and password. Social sign-in isn't set up — there are no connected providers to manage."
      >
        <span className="text-sm text-[var(--text-secondary)]">Password</span>
      </SettingsRow>

      <SettingsRow
        label="Delete account"
        description="Permanently removes your account and everything in it."
      >
        <SettingsButton variant="danger" onClick={() => setSection("data-controls")}>
          Go to Data controls
        </SettingsButton>
      </SettingsRow>

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
