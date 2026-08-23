"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Download, Trash2, History, GraduationCap } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsBlock,
  SettingsToggle,
  SettingsButton,
  SaveIndicator,
} from "../primitives";
import { usePreferences } from "../../preferences";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";

export function DataControlsSection() {
  const { data: session } = useSession();
  const { prefs, update } = usePreferences();
  const { state, error, run } = useSave();

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  async function exportData() {
    setBusy("export");
    setActionError(null);
    try {
      // The endpoint needs a bearer token, so it cannot be a plain link.
      const res = await fetch(`${API_BASE_URL}/account/export`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) throw new Error("Export failed");

      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `hetex-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Export downloaded.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function eraseData() {
    if (
      !confirm(
        "Delete every conversation, project, memory entry and file? Your account stays. This cannot be undone."
      )
    )
      return;

    setBusy("erase");
    setActionError(null);
    try {
      await apiFetch("/account/erase-data", { method: "POST" });
      setNotice("All data deleted.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setActionError(null);
    try {
      await apiFetch("/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not delete account"
      );
      setBusy(null);
    }
  }

  return (
    <>
      <SectionHeader
        title="Data controls"
        description="What Hetex keeps, and how to take it back or remove it."
      />

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <SettingsRow
        label="Save chat history"
        icon={History}
        description="When off, conversations are deleted as soon as each reply finishes. Nothing new appears in your sidebar, and existing conversations are left alone."
      >
        <SettingsToggle
          label="Save chat history"
          checked={prefs.chatHistoryEnabled}
          onChange={(v) => run(() => update({ chatHistoryEnabled: v }))}
        />
      </SettingsRow>

      <SettingsRow
        label="Improve the model for everyone"
        icon={GraduationCap}
        description="Off, and off by default. Nothing you send is used for training — this switch records your preference for if that ever changes."
      >
        <SettingsToggle
          label="Improve the model for everyone"
          checked={prefs.trainingOptIn}
          onChange={(v) => run(() => update({ trainingOptIn: v }))}
        />
      </SettingsRow>

      <SettingsBlock
        label="Export your data"
        description="Every conversation, project, memory entry and file as one JSON file. Downloads immediately — no waiting for an email."
      >
        <SettingsButton onClick={exportData} busy={busy === "export"}>
          <Download size={13} /> Export all my data
        </SettingsButton>
      </SettingsBlock>

      <SettingsBlock
        label="Delete your data"
        description="Removes everything in the account and keeps the account itself."
      >
        <SettingsButton variant="danger" onClick={eraseData} busy={busy === "erase"}>
          <Trash2 size={13} /> Delete all my data
        </SettingsButton>
      </SettingsBlock>

      <SettingsBlock
        label="Delete account"
        description="Permanent. Removes the account and everything attached to it."
      >
        {!confirmDelete ? (
          <SettingsButton variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </SettingsButton>
        ) : (
          <div className="rounded-xl border border-hetex-red-500/40 bg-hetex-red-500/5 p-4">
            <p className="text-sm font-medium text-hetex-red-500">
              This cannot be undone
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Your account, conversations, projects, files and memory will be
              permanently deleted. Confirm with your password.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="focus-accent mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
            <div className="mt-3 flex gap-2">
              <SettingsButton
                variant="danger"
                onClick={deleteAccount}
                disabled={!deletePassword}
                busy={busy === "delete"}
              >
                Permanently delete
              </SettingsButton>
              <SettingsButton
                onClick={() => {
                  setConfirmDelete(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </SettingsButton>
            </div>
          </div>
        )}
      </SettingsBlock>

      {notice && <p className="text-accent mt-4 text-xs">{notice}</p>}
      {(actionError || error) && (
        <p className="mt-4 text-xs text-hetex-red-500">{actionError ?? error}</p>
      )}
    </>
  );
}
