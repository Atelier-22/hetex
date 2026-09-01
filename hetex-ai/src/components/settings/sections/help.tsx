"use client";

import { useState } from "react";
import {
  Activity,
  Bug,
  CircleHelp,
  MessageSquareWarning,
  Send,
  ShieldAlert,
} from "lucide-react";
import {
  Callout,
  LinkRow,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  StatusPill,
} from "../primitives";
import { useSectionShell } from "../use-section";
import { apiFetch } from "@/lib/api-client";

type ReportKind = "bug" | "ai_response" | "safety" | "feedback" | "contact";

type Diagnostics = {
  generatedAt: string;
  version: string;
  build: string;
  runtime: {
    node: string;
    platform: string;
    uptimeSeconds: number;
    memoryMb: number;
  };
  checks: {
    id: string;
    label: string;
    status: "ok" | "degraded" | "unavailable";
    detail: string;
    ms?: number;
  }[];
};

const KINDS: { value: ReportKind; label: string }[] = [
  { value: "bug", label: "Report a bug" },
  { value: "ai_response", label: "Report an AI response" },
  { value: "safety", label: "Report a safety issue" },
  { value: "feedback", label: "Send feedback" },
  { value: "contact", label: "Contact support" },
];

const FAQS = [
  {
    q: "Why does Hetex not tell me which model it uses?",
    a: "The underlying model and its vendor are not public information about this product. You can see whether a reply was answered on this server or by a hosted service, which is the part that affects your privacy.",
  },
  {
    q: "Is my conversation used for training?",
    a: "No. The training preference in Privacy & data is off and off by default, and nothing you send is used to train anything.",
  },
  {
    q: "Can the Hetex team read my conversations?",
    a: "No. The admin dashboard holds counts and trends only — no message content and no conversation titles, because titles are generated from your first message.",
  },
  {
    q: "Why can I not generate an image?",
    a: "No image generation provider is connected to this server. The controls exist in Images and are disabled rather than failing when used.",
  },
  {
    q: "Why did I not receive an email notification?",
    a: "There is no mail transport configured, so no email has ever been sent. Your notification preferences are stored and will be honoured when one exists.",
  },
];

export function HelpSection() {
  const { meta } = useSectionShell();

  const [kind, setKind] = useState<ReportKind>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  async function runDiagnostics() {
    setBusy("diagnostics");
    setError(null);
    try {
      setDiagnostics(await apiFetch<Diagnostics>("/system/diagnostics"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't run diagnostics."
      );
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!subject.trim() || !body.trim()) return;
    setBusy("submit");
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ note: string }>("/system/reports", {
        method: "POST",
        body: JSON.stringify({
          kind,
          subject: subject.trim(),
          body: body.trim(),
          meta: attachDiagnostics
            ? {
                userAgent:
                  typeof navigator !== "undefined" ? navigator.userAgent : null,
                diagnostics: diagnostics ?? null,
              }
            : undefined,
        }),
      });
      setSubject("");
      setBody("");
      setNotice(result.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SectionHeader
        title="Help & support"
        description="Answers to the questions people actually ask, and a way to reach us."
      />

      <SettingsCard title="Help centre">
        <LinkRow
          label="Help centre"
          description="Guides and how-tos."
          icon={CircleHelp}
          href="/help"
        />
        <LinkRow label="Status" description="Whether Hetex is up." href="/status" />
        <LinkRow label="Changelog" description="What has shipped." href="/changelog" />
      </SettingsCard>

      <SettingsCard title="Frequently asked">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="border-b border-[var(--border-subtle)] py-3 last:border-b-0"
          >
            <summary className="focus-ring cursor-pointer rounded text-sm font-medium">
              {f.q}
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {f.a}
            </p>
          </details>
        ))}
      </SettingsCard>

      <SettingsCard
        title="System diagnostics"
        description="What is reachable from the server right now. Contains no message content and no secrets — a key is reported as present or absent, never shown."
      >
        <SettingsRow
          label="Run diagnostics"
          icon={Activity}
          description={
            diagnostics
              ? `Last run ${new Date(diagnostics.generatedAt).toLocaleTimeString()}`
              : undefined
          }
        >
          <SettingsButton onClick={runDiagnostics} busy={busy === "diagnostics"}>
            Run
          </SettingsButton>
        </SettingsRow>

        {diagnostics && (
          <SettingsBlock>
            <div className="flex flex-col gap-2">
              {diagnostics.checks.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{c.label}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {c.detail}
                      {c.ms !== undefined ? ` · ${c.ms} ms` : ""}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      c.status === "ok"
                        ? "ok"
                        : c.status === "degraded"
                          ? "warn"
                          : "off"
                    }
                  >
                    {c.status}
                  </StatusPill>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-xs text-[var(--text-secondary)]">
              Hetex {diagnostics.version} ({diagnostics.build}) · Node{" "}
              {diagnostics.runtime.node} · {diagnostics.runtime.platform} ·{" "}
              {diagnostics.runtime.memoryMb} MB resident · up{" "}
              {Math.round(diagnostics.runtime.uptimeSeconds / 60)} min
            </p>
          </SettingsBlock>
        )}
      </SettingsCard>

      <SettingsCard
        title="Get in touch"
        description="Reports are stored and reviewed by the Hetex team in the admin dashboard."
      >
        <SettingsRow
          label="What is this about?"
          icon={
            kind === "bug"
              ? Bug
              : kind === "safety"
                ? ShieldAlert
                : kind === "ai_response"
                  ? MessageSquareWarning
                  : Send
          }
        >
          <SettingsDropdown
            label="Report kind"
            value={kind}
            onChange={(v) => setKind(v as ReportKind)}
            options={KINDS}
          />
        </SettingsRow>

        <SettingsBlock>
          <input
            value={subject}
            aria-label="Subject"
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A one-line summary"
            maxLength={200}
            className="focus-ring w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={body}
            aria-label="Details"
            onChange={(e) => setBody(e.target.value.slice(0, 5000))}
            rows={5}
            placeholder={
              kind === "bug"
                ? "What did you do, what did you expect, and what happened instead?"
                : kind === "safety"
                  ? "What did Hetex say, and why was it harmful? Paste the reply if you can."
                  : "Tell us what is on your mind."
            }
            className="focus-ring mt-2 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm leading-relaxed outline-none"
          />

          <label className="mt-2.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={attachDiagnostics}
              onChange={(e) => setAttachDiagnostics(e.target.checked)}
              className="focus-ring h-4 w-4 rounded border-[var(--border-subtle)]"
            />
            Attach my browser details and the diagnostics above
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">
              {body.length} / 5000
            </span>
            <SettingsButton
              variant="primary"
              onClick={submit}
              busy={busy === "submit"}
              disabled={!subject.trim() || !body.trim()}
            >
              <Send size={13} /> Send
            </SettingsButton>
          </div>
        </SettingsBlock>
      </SettingsCard>

      {notice && <p className="text-accent mt-3 text-xs leading-relaxed">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 text-xs text-hetex-red-500">
          {error}
        </p>
      )}

      {meta?.capabilities?.emailDelivery === false && (
        <Callout tone="warn" title="No email reply">
          There is no mail transport on this server, so nothing you send here is
          emailed anywhere and you will not receive a reply by email. Your report
          is stored and is visible to the team. Saying otherwise would leave you
          waiting for a message that was never going to arrive.
        </Callout>
      )}
    </>
  );
}
