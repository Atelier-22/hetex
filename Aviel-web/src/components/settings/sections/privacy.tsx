"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Cloud,
  Download,
  GraduationCap,
  HardDrive,
  Trash2,
} from "lucide-react";
import {
  Callout,
  ConfirmButton,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { useSettingsUi } from "../settings-context";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";

export function PrivacySection() {
  const { values, set, reset, resetting, saveState, error, meta, settings } =
    useSection("privacy");
  const { data: session } = useSession();
  const { setSection } = useSettingsUi();

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const localAvailable = meta?.localAI?.available === true;
  const activeModel = (meta?.models ?? []).find(
    (m) => m.value === settings.ai.defaultModel
  );
  const processedLocally = values.localOnly || activeModel?.local === true;

  async function download(path: string, filename: string, key: string) {
    setBusy(key);
    setActionError(null);
    try {
      // These endpoints need a bearer token, so they cannot be a plain link.
      const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(`${filename} downloaded.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function eraseData() {
    setBusy("erase");
    setActionError(null);
    try {
      await apiFetch("/account/erase-data", { method: "POST" });
      setNotice("Everything in your account has been deleted.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete.");
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
        err instanceof Error ? err.message : "Couldn't delete the account."
      );
      setBusy(null);
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <>
      <SectionHeader
        title="Privacy & data"
        description="Where your messages are processed, what is kept, and how to take it back."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {/* ---- Processing location: the honest answer, computed ---- */}
      <div className="settings-card mb-4 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]">
            {processedLocally ? <HardDrive size={16} /> : <Cloud size={16} />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {processedLocally ? "Processing locally" : "Processed by a hosted service"}
              <StatusPill tone={processedLocally ? "ok" : "warn"}>
                {processedLocally ? "On this server" : "Leaves this server"}
              </StatusPill>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              {processedLocally
                ? "Your messages are answered by a model running on the Aviel server itself. Nothing is sent to an external AI provider."
                : "Some requests are processed by an external AI provider. Your messages, and any images you attach, are sent to it to be answered. It is not told who you are."}
            </p>
            {!processedLocally && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                Voice is the exception either way: speech recognition and speech
                synthesis run entirely in your browser, and no audio is ever
                uploaded.
              </p>
            )}
          </div>
        </div>
      </div>

      <SettingsCard title="Where processing happens">
        <SettingsRow
          label="Process everything on this server"
          description="Overrides your model choice and answers every message with the local model. Slower and less capable — no web search, no image reading — and nothing leaves the machine."
          unavailable={
            localAvailable
              ? undefined
              : (meta?.localAI?.requirement ??
                "No local AI runtime is available on this server, so there is nothing to process locally with.")
          }
        >
          <SettingsToggle
            label="Process everything on this server"
            checked={values.localOnly}
            onChange={(v) => set({ localOnly: v })}
            disabled={!localAvailable}
          />
        </SettingsRow>

        <SettingsRow
          label="Warn me before a message leaves"
          description="Shows the badge above in the chat header whenever a hosted provider is answering."
        >
          <SettingsToggle
            label="Warn me before a message leaves"
            checked={values.showProcessingLocation}
            onChange={(v) => set({ showProcessingLocation: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="What is kept">
        <SettingsRow
          label="Conversations and retention"
          description="Saving history and auto-delete periods are set in Conversations."
        >
          <SettingsButton onClick={() => setSection("conversations")}>
            Open Conversations
          </SettingsButton>
        </SettingsRow>

        <SettingsRow
          label="Images and files"
          description="What is stored and for how long is set in Images and Files."
        >
          <SettingsButton onClick={() => setSection("files")}>
            Open Files
          </SettingsButton>
        </SettingsRow>

        <SettingsRow
          label="Memory"
          description="What Aviel remembers about you, and how to see or delete it."
        >
          <SettingsButton onClick={() => setSection("memory")}>
            Open Memory
          </SettingsButton>
        </SettingsRow>

        <SettingsRow
          label="Voice recordings"
          unavailable="Aviel never records audio. Speech recognition runs in your browser and produces text; the audio is never uploaded and there is nowhere to store it."
        >
          <StatusPill tone="ok">Never stored</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Keep voice transcripts"
          description="Dictated text becomes a normal message and is kept like any other. Off is only meaningful with conversation history on."
        >
          <SettingsToggle
            label="Keep voice transcripts"
            checked={values.saveVoiceTranscripts}
            onChange={(v) => set({ saveVoiceTranscripts: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Improve the model for everyone"
          icon={GraduationCap}
          description="Off, and off by default. Nothing you send is used for training. This records your preference for if that ever changes."
        >
          <SettingsToggle
            label="Improve the model for everyone"
            checked={values.trainingOptIn}
            onChange={(v) => set({ trainingOptIn: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Your data"
        description="Everything downloads immediately. Nothing waits for an email, because there is no mail transport to send one."
      >
        <SettingsBlock>
          <div className="flex flex-wrap gap-2">
            <SettingsButton
              busy={busy === "all"}
              onClick={() =>
                download("/account/export", `Aviel-export-${stamp}.json`, "all")
              }
            >
              <Download size={13} /> Download everything
            </SettingsButton>
            <SettingsButton
              busy={busy === "settings"}
              onClick={() =>
                download(
                  "/settings/export",
                  `Aviel-settings-${stamp}.json`,
                  "settings"
                )
              }
            >
              <Download size={13} /> Settings only
            </SettingsButton>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            The full export contains your account details, every conversation
            and message, projects, memory entries, file metadata, usage records
            and feedback, as one JSON file.
          </p>
        </SettingsBlock>

        <SettingsRow
          label="Delete all my data"
          description="Removes every conversation, project, memory entry and file. Your account and settings stay."
        >
          <ConfirmButton
            question="Delete every conversation, project, memory entry and file? This cannot be undone."
            confirmLabel="Delete everything"
            busy={busy === "erase"}
            onConfirm={eraseData}
          >
            <Trash2 size={13} /> Delete all data
          </ConfirmButton>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Delete account">
        <SettingsBlock description="Permanent. Removes the account and everything attached to it.">
          {!confirmDelete ? (
            <SettingsButton variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </SettingsButton>
          ) : (
            <div className="rounded-xl border border-Aviel-red-500/40 bg-Aviel-red-500/5 p-4">
              <p className="text-sm font-medium text-Aviel-red-500">
                This cannot be undone
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Your account, conversations, projects, files and memory will be
                permanently deleted. Confirm with your password.
              </p>
              <input
                type="password"
                aria-label="Your password"
                autoComplete="current-password"
                placeholder="Your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="focus-ring mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
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
      </SettingsCard>

      {notice && <p className="text-accent mt-4 text-xs">{notice}</p>}
      {actionError && (
        <p role="alert" className="mt-4 text-xs text-Aviel-red-500">
          {actionError}
        </p>
      )}

      <Callout title="What Aviel never does">
        Your conversations are not read by the Aviel team. The admin dashboard
        deliberately holds counts and trends only — no message content and no
        conversation titles, because titles are made from your first message.
      </Callout>
    </>
  );
}
