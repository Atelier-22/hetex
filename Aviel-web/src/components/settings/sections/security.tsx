"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Fingerprint,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Callout,
  ConfirmButton,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { apiFetch } from "@/lib/api-client";

type Session = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
};

type TotpStatus = {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
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
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("security");

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [totp, setTotp] = useState<TotpStatus | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const [enrolment, setEnrolment] = useState<{ secret: string; uri: string } | null>(
    null
  );
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    apiFetch<Session[]>("/security/sessions")
      .then(setSessions)
      .catch(() => setSessions([]));
    apiFetch<TotpStatus>("/security/2fa")
      .then(setTotp)
      .catch(() => setTotp(null));
  }, []);

  useEffect(load, [load]);

  async function changePassword() {
    setBusy("password");
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
      setPwError(
        err instanceof Error ? err.message : "Couldn't change the password."
      );
    } finally {
      setBusy(null);
    }
  }

  async function startEnrolment() {
    setBusy("2fa-start");
    setTotpError(null);
    try {
      setEnrolment(
        await apiFetch<{ secret: string; uri: string }>("/security/2fa/start", {
          method: "POST",
        })
      );
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Couldn't start setup.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmEnrolment() {
    setBusy("2fa-confirm");
    setTotpError(null);
    try {
      const result = await apiFetch<{ recoveryCodes: string[] }>(
        "/security/2fa/confirm",
        { method: "POST", body: JSON.stringify({ code: totpCode.trim() }) }
      );
      setRecoveryCodes(result.recoveryCodes);
      setEnrolment(null);
      setTotpCode("");
      load();
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "That code wasn't right.");
    } finally {
      setBusy(null);
    }
  }

  async function disableTotp() {
    setBusy("2fa-disable");
    setTotpError(null);
    try {
      await apiFetch("/security/2fa/disable", {
        method: "POST",
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.trim() || undefined,
        }),
      });
      setDisablePassword("");
      setDisableCode("");
      load();
    } catch (err) {
      setTotpError(
        err instanceof Error ? err.message : "Couldn't turn two-factor off."
      );
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    const previous = sessions;
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    try {
      await apiFetch(`/security/sessions/${id}`, { method: "DELETE" });
      load();
    } catch {
      setSessions(previous);
    }
  }

  async function revokeOthers() {
    setBusy("revoke");
    try {
      await apiFetch("/security/sessions/revoke-others", { method: "POST" });
      load();
    } finally {
      setBusy(null);
    }
  }

  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <>
      <SectionHeader
        title="Security"
        description="Your password, your second factor, and every device signed in to this account."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard
        title="Password"
        description="Your current password is required, so someone with access to an open tab still cannot lock you out."
      >
        <SettingsBlock>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              aria-label="Current password"
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="focus-ring rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
            <input
              type="password"
              aria-label="New password"
              autoComplete="new-password"
              placeholder="New password (at least 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="focus-ring rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <SettingsButton
                variant="primary"
                onClick={changePassword}
                busy={busy === "password"}
                disabled={!currentPassword || newPassword.length < 8}
              >
                Change password
              </SettingsButton>
              {pwMessage && <span className="text-accent text-xs">{pwMessage}</span>}
              {pwError && (
                <span role="alert" className="text-xs text-Aviel-red-500">
                  {pwError}
                </span>
              )}
            </div>
          </div>
        </SettingsBlock>
      </SettingsCard>

      {/* ---- Two-factor ---- */}
      <SettingsCard
        title="Two-factor authentication"
        description="A six-digit code from an authenticator app, required alongside your password at every sign-in."
      >
        <SettingsRow
          label="Authenticator app"
          icon={ShieldCheck}
          description={
            totp?.enabled
              ? `On since ${totp.confirmedAt ? new Date(totp.confirmedAt).toLocaleDateString() : "recently"}. ${totp.recoveryCodesRemaining} recovery code${totp.recoveryCodesRemaining === 1 ? "" : "s"} left.`
              : "Works with Google Authenticator, 1Password, Authy, or any app that supports TOTP."
          }
        >
          <div className="flex items-center gap-2">
            <StatusPill tone={totp?.enabled ? "ok" : "neutral"}>
              {totp?.enabled ? "On" : "Off"}
            </StatusPill>
            {!totp?.enabled && !enrolment && (
              <SettingsButton
                variant="primary"
                onClick={startEnrolment}
                busy={busy === "2fa-start"}
              >
                Set up
              </SettingsButton>
            )}
          </div>
        </SettingsRow>

        {enrolment && (
          <SettingsBlock
            label="Add Aviel to your authenticator app"
            description="Enter this key by hand, or paste the setup link into an app that accepts one. Then type the six-digit code it shows."
          >
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Setup key
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-sm">
                  {enrolment.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(enrolment.secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  aria-label="Copy setup key"
                  className="focus-ring shrink-0 rounded p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Copy size={14} />
                </button>
              </div>
              {copied && <p className="text-accent mt-1 text-xs">Copied.</p>}
              <p className="mt-2 break-all text-[11px] text-[var(--text-secondary)]">
                {enrolment.uri}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                No QR code is shown, because generating one would mean adding an
                image library for a string every authenticator accepts typed.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={totpCode}
                aria-label="Six-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="focus-ring w-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-center font-mono text-sm tracking-widest outline-none"
              />
              <SettingsButton
                variant="primary"
                onClick={confirmEnrolment}
                busy={busy === "2fa-confirm"}
                disabled={totpCode.length !== 6}
              >
                Turn on
              </SettingsButton>
              <SettingsButton onClick={() => setEnrolment(null)}>
                Cancel
              </SettingsButton>
            </div>
          </SettingsBlock>
        )}

        {recoveryCodes && (
          <SettingsBlock
            label="Save your recovery codes"
            description="Each works once, in place of a code from your app. This is the only time they are shown — they are stored hashed and cannot be displayed again."
          >
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <div className="grid grid-cols-2 gap-1.5 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <SettingsButton
                onClick={() => {
                  void navigator.clipboard.writeText(recoveryCodes.join("\n"));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Copy size={13} /> Copy all
              </SettingsButton>
              <SettingsButton
                variant="primary"
                onClick={() => setRecoveryCodes(null)}
              >
                I have saved them
              </SettingsButton>
            </div>
          </SettingsBlock>
        )}

        {totp?.enabled && (
          <SettingsBlock
            label="Turn off two-factor authentication"
            description="Requires your password and a current code."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                aria-label="Your password"
                autoComplete="current-password"
                placeholder="Your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="focus-ring flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              />
              <input
                aria-label="Six-digit code"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="focus-ring w-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-center font-mono text-sm tracking-widest outline-none"
              />
              <ConfirmButton
                question="Turn off two-factor authentication for this account?"
                confirmLabel="Turn off"
                busy={busy === "2fa-disable"}
                disabled={!disablePassword || disableCode.length !== 6}
                onConfirm={disableTotp}
              >
                Turn off
              </ConfirmButton>
            </div>
          </SettingsBlock>
        )}

        {totpError && (
          <p role="alert" className="pb-3 text-xs text-Aviel-red-500">
            {totpError}
          </p>
        )}

        <SettingsRow
          label="Passkeys"
          icon={KeyRound}
          unavailable={
            typeof meta?.capabilities?.passkeysReason === "string"
              ? meta.capabilities.passkeysReason
              : "WebAuthn is not implemented on this server."
          }
        >
          <StatusPill tone="off">Not built</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Fingerprint or face"
          icon={Fingerprint}
          unavailable="A web page cannot read a fingerprint or a face directly. On the web this is only possible through passkeys, which is the row above — anything else claiming biometric login in a browser is not doing what it says."
        >
          <StatusPill tone="off">Not possible here</StatusPill>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Alerts and session">
        <SettingsRow
          label="Alert me about new sign-ins"
          unavailable="No mail transport is configured, so no alert can be sent yet. Your preference is stored and is checked by the notification gate every future sender has to pass."
        >
          <SettingsToggle
            label="Alert me about new sign-ins"
            checked={values.loginAlerts}
            onChange={(v) => set({ loginAlerts: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Security notifications"
          description="Password changes, two-factor changes, and device revocations."
        >
          <SettingsToggle
            label="Security notifications"
            checked={values.securityNotifications}
            onChange={(v) => set({ securityNotifications: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Sign out after inactivity"
          description="Ends the session in this browser after a period with no interaction. A convenience, not a security boundary — a stolen token stays valid until it is revoked below."
        >
          <SegmentedControl
            label="Sign out after inactivity"
            value={String(values.sessionTimeoutMinutes)}
            onChange={(v) => set({ sessionTimeoutMinutes: Number(v) })}
            options={[
              { value: "0", label: "Never" },
              { value: "15", label: "15 min" },
              { value: "60", label: "1 hr" },
              { value: "480", label: "8 hr" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Where you are signed in"
        description="Each sign-in is its own session. Revoking one takes effect on that device's next request."
      >
        <SettingsBlock>
          {sessions === null && <LoadingRows count={2} />}

          {sessions?.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              No active sessions recorded. Sign out and back in to see this
              device listed.
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
                      <p className="flex items-center gap-2 truncate text-sm">
                        {label}
                        {s.current && <StatusPill tone="accent">This device</StatusPill>}
                      </p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">
                        {s.ipAddress ?? "Unknown IP"} · active {timeAgo(s.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  {!s.current && (
                    <button
                      onClick={() => revoke(s.id)}
                      className="focus-ring shrink-0 rounded-lg px-2 py-1 text-xs text-Aviel-red-500 hover:bg-Aviel-red-500/10"
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
              <ConfirmButton
                question="Sign out of every other device?"
                confirmLabel="Sign them out"
                busy={busy === "revoke"}
                onConfirm={revokeOthers}
              >
                <LogOut size={13} /> Sign out of all other devices
              </ConfirmButton>
            </div>
          )}
        </SettingsBlock>
      </SettingsCard>

      <Callout title="How sessions are revoked">
        Bearer tokens are normally valid until they expire, with no server-side
        handle to pull. Aviel records every issued token and checks it on each
        request, which is what makes revoking a device real rather than
        cosmetic.
      </Callout>
    </>
  );
}
