"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, LogOut } from "lucide-react";
import {
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SaveIndicator,
} from "../primitives";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";

type Session = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
};

/** Turns a user-agent string into something a person can recognise. */
function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unknown device", mobile: false };

  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";

  // Order matters: Edge and Chrome both contain "Chrome", Chrome contains
  // "Safari".
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Unknown browser";

  return { label: `${browser} on ${os}`, mobile };
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function SecuritySection() {
  const { state, error, run } = useSave();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<Session[]>("/security/sessions")
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  useEffect(load, [load]);

  async function revoke(id: string) {
    const previous = sessions;
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    const ok = await run(
      () => apiFetch(`/security/sessions/${id}`, { method: "DELETE" }),
      () => setSessions(previous)
    );
    if (ok) load();
  }

  async function revokeOthers() {
    if (!confirm("Sign out of every other device?")) return;
    const ok = await run(() =>
      apiFetch("/security/sessions/revoke-others", { method: "POST" })
    );
    if (ok) load();
  }

  async function changePassword() {
    setBusy(true);
    setPwError(null);
    setPwMessage(null);
    try {
      await apiFetch("/account/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPwMessage("Password changed.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <>
      <SectionHeader
        title="Security and login"
        description="Your password and the devices signed in to this account."
      />

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <SettingsBlock
        label="Change password"
        description="Your current password is required, so someone with access to an open tab still cannot lock you out."
      >
        <div className="flex flex-col gap-2">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="focus-accent rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min. 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="focus-accent rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          <div className="flex items-center gap-3">
            <SettingsButton
              variant="primary"
              onClick={changePassword}
              busy={busy}
              disabled={!currentPassword || newPassword.length < 8}
            >
              Change password
            </SettingsButton>
            {pwMessage && <span className="text-accent text-xs">{pwMessage}</span>}
            {pwError && (
              <span className="text-xs text-hetex-red-500">{pwError}</span>
            )}
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock
        label="Where you're signed in"
        description="Each sign-in is its own session. Revoking one takes effect on that device's next request."
      >
        {sessions === null && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-black/5 dark:bg-white/5"
              />
            ))}
          </div>
        )}

        {sessions?.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">
            No active sessions recorded. Sessions began being tracked recently —
            sign out and back in to see this device listed.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {sessions?.map((s) => {
            const { label, mobile } = describeDevice(s.userAgent);
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Icon size={16} className="shrink-0 text-[var(--text-secondary)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {label}
                      {s.current && (
                        <span className="bg-accent-soft ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {s.ipAddress ?? "Unknown IP"} · active {timeAgo(s.lastActiveAt)}
                    </p>
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => revoke(s.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-hetex-red-500 hover:bg-hetex-red-500/10"
                  >
                    Sign out
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {others.length > 0 && (
          <div className="mt-3">
            <SettingsButton variant="danger" onClick={revokeOthers}>
              <LogOut size={13} /> Sign out of all other devices
            </SettingsButton>
          </div>
        )}
      </SettingsBlock>

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
