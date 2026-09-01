"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleCheck,
  Cpu,
  Download,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Callout,
  ConfirmButton,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  SettingsSlider,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { apiFetch } from "@/lib/api-client";

type LocalModel = {
  id: string;
  name: string;
  sizeBytes: number | null;
  parameterSize: string | null;
  quantization: string | null;
  contextLength: number | null;
  capabilities: { text: boolean; vision: boolean; embedding: boolean };
  estimatedRamBytes: number | null;
  estimatedVramBytes: number | null;
  installedAt: string | null;
};

type LocalStatus = {
  runtime: "ollama" | "llamacpp" | "none";
  available: boolean;
  manageable: boolean;
  endpoint: string | null;
  version: string | null;
  models: LocalModel[];
  requirement: string | null;
  disabledByAdmin?: boolean;
};

type PullJob = {
  id: string;
  model: string;
  status: string;
  completedBytes: number;
  totalBytes: number;
  done: boolean;
  error: string | null;
};

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const RUNTIME_LABEL: Record<LocalStatus["runtime"], string> = {
  ollama: "Ollama",
  llamacpp: "llama.cpp",
  none: "None",
};

export function OfflineSection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("offline");

  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [online, setOnline] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pullName, setPullName] = useState("");
  const [job, setJob] = useState<PullJob | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);

  const load = useCallback(() => {
    apiFetch<LocalStatus>("/local-ai/status")
      .then(setStatus)
      .catch(() =>
        setStatus({
          runtime: "none",
          available: false,
          manageable: false,
          endpoint: null,
          version: null,
          models: [],
          requirement: "The server could not be reached.",
        })
      );
  }, []);

  useEffect(load, [load]);

  // Real connectivity, from the browser rather than assumed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => setOnline(navigator.onLine);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  // How much this browser is storing for Hetex, and what it is allowed.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((e) =>
        setStorageEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 })
      )
      .catch(() => setStorageEstimate(null));
  }, []);

  // Poll an in-flight install. A pull is minutes long, so this is the only way
  // to show real progress rather than a spinner that means nothing.
  useEffect(() => {
    if (!job || job.done) return;
    const timer = setInterval(() => {
      apiFetch<PullJob>(`/local-ai/pulls/${job.id}`)
        .then((next) => {
          setJob(next);
          if (next.done) {
            load();
            if (next.error) setActionError(next.error);
          }
        })
        .catch(() => setJob((j) => (j ? { ...j, done: true } : j)));
    }, 1500);
    return () => clearInterval(timer);
  }, [job, load]);

  async function testModel(model?: string) {
    setBusy("test");
    setActionError(null);
    setTestResult(null);
    try {
      const result = await apiFetch<{ reply: string; ms: number }>(
        "/local-ai/test",
        { method: "POST", body: JSON.stringify(model ? { model } : {}) }
      );
      setTestResult(`Answered in ${result.ms} ms: “${result.reply}”`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "The model did not answer."
      );
    } finally {
      setBusy(null);
    }
  }

  async function installModel() {
    const model = pullName.trim();
    if (!model) return;
    setBusy("install");
    setActionError(null);
    try {
      setJob(
        await apiFetch<PullJob>("/local-ai/models", {
          method: "POST",
          body: JSON.stringify({ model }),
        })
      );
      setPullName("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't start the install."
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeModel(model: string) {
    setBusy(model);
    setActionError(null);
    try {
      await apiFetch(`/local-ai/models/${encodeURIComponent(model)}`, {
        method: "DELETE",
      });
      load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't remove that model."
      );
    } finally {
      setBusy(null);
    }
  }

  const progress =
    job && job.totalBytes > 0
      ? Math.round((job.completedBytes / job.totalBytes) * 100)
      : 0;

  return (
    <>
      <SectionHeader
        title="Offline & local AI"
        description="What runs on the Hetex server itself, and what this browser keeps when there is no connection."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {/* ---- Connectivity ---- */}
      <SettingsCard title="Connection">
        <SettingsRow
          label="This device"
          icon={online ? Wifi : WifiOff}
          description={
            online
              ? "Your browser reports a connection. It cannot tell you the connection is working, only that one exists."
              : "Your browser reports no connection. Sending a message will fail until it returns."
          }
        >
          <StatusPill tone={online ? "ok" : "off"}>
            {online ? "Online" : "Offline"}
          </StatusPill>
        </SettingsRow>
      </SettingsCard>

      {/* ---- Runtime ---- */}
      <SettingsCard
        title="Local AI runtime"
        description="Detected on the server, not configured. Local AI needs no API key and sends nothing off the machine it runs on."
      >
        {!status && (
          <div className="py-4">
            <LoadingRows count={2} />
          </div>
        )}

        {status && (
          <>
            <SettingsRow
              label="Runtime"
              icon={Cpu}
              description={
                status.available
                  ? status.runtime === "ollama"
                    ? `An Ollama daemon at ${status.endpoint}. Models can be installed and removed from here.`
                    : "The bundled model file, loaded through node-llama-cpp. It is a file on the server, so it is managed on the host rather than through this page."
                  : (status.requirement ?? "No local runtime was found.")
              }
            >
              <div className="flex items-center gap-2">
                <StatusPill tone={status.available ? "ok" : "off"}>
                  {status.available ? RUNTIME_LABEL[status.runtime] : "Unavailable"}
                </StatusPill>
                <SettingsButton onClick={load}>
                  <RefreshCw size={13} /> Refresh
                </SettingsButton>
              </div>
            </SettingsRow>

            {status.disabledByAdmin && (
              <SettingsRow
                label="Turned off"
                description="A runtime is present, but an administrator has disabled local AI for this server."
              >
                <StatusPill tone="warn">Disabled</StatusPill>
              </SettingsRow>
            )}

            {status.version && (
              <SettingsRow label="Version">
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {status.version}
                </span>
              </SettingsRow>
            )}

            <SettingsRow
              label="Test the runtime"
              description={testResult ?? "Sends one short prompt and reports what came back."}
            >
              <SettingsButton
                onClick={() => testModel()}
                busy={busy === "test"}
                disabled={!status.available}
              >
                <CircleCheck size={13} /> Test
              </SettingsButton>
            </SettingsRow>
          </>
        )}
      </SettingsCard>

      {/* ---- Installed models ---- */}
      <SettingsCard
        title="Installed models"
        description="Memory figures are estimates derived from the file size — the runtimes do not report a requirement, and a precise-looking number would be invented."
      >
        {status?.models.length === 0 && (
          <SettingsBlock>
            <p className="text-xs text-[var(--text-secondary)]">
              No local model is installed.
            </p>
          </SettingsBlock>
        )}

        {status?.models.map((m) => (
          <div
            key={m.id}
            className="flex flex-col gap-3 border-b border-[var(--border-subtle)] py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {m.name}
                {m.capabilities.vision && <StatusPill tone="ok">Vision</StatusPill>}
                {m.capabilities.embedding && <StatusPill>Embeddings</StatusPill>}
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
                <div>
                  <dt className="inline">Size: </dt>
                  <dd className="inline tabular-nums">{formatBytes(m.sizeBytes)}</dd>
                </div>
                {m.parameterSize && (
                  <div>
                    <dt className="inline">Parameters: </dt>
                    <dd className="inline">{m.parameterSize}</dd>
                  </div>
                )}
                {m.quantization && (
                  <div>
                    <dt className="inline">Quantisation: </dt>
                    <dd className="inline">{m.quantization}</dd>
                  </div>
                )}
                {m.contextLength && (
                  <div>
                    <dt className="inline">Context: </dt>
                    <dd className="inline tabular-nums">
                      {m.contextLength.toLocaleString()}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="inline">RAM (est.): </dt>
                  <dd className="inline tabular-nums">
                    {formatBytes(m.estimatedRamBytes)}
                  </dd>
                </div>
                <div>
                  <dt className="inline">VRAM (est.): </dt>
                  <dd className="inline tabular-nums">
                    {formatBytes(m.estimatedVramBytes)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex shrink-0 gap-2">
              <SettingsButton
                onClick={() => testModel(m.id)}
                busy={busy === "test"}
              >
                Test
              </SettingsButton>
              {status.manageable && (
                <ConfirmButton
                  question={`Remove ${m.name} from the server?`}
                  confirmLabel="Remove"
                  busy={busy === m.id}
                  onConfirm={() => removeModel(m.id)}
                >
                  <Trash2 size={13} />
                </ConfirmButton>
              )}
            </div>
          </div>
        ))}

        {status?.manageable && (
          <SettingsBlock
            label="Install a model"
            description="Pulled by the Ollama daemon on the server. Installing writes gigabytes to the server's disk and affects every account, so it requires administrator access."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={pullName}
                aria-label="Model name"
                placeholder="e.g. llama3.2:3b"
                onChange={(e) => setPullName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && installModel()}
                className="focus-ring flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm outline-none"
              />
              <SettingsButton
                variant="primary"
                onClick={installModel}
                busy={busy === "install"}
                disabled={!pullName.trim()}
              >
                <Download size={13} /> Install
              </SettingsButton>
            </div>

            {job && (
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono">{job.model}</span>
                  <span className="text-[var(--text-secondary)]">{job.status}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="bg-accent-gradient h-full transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs tabular-nums text-[var(--text-secondary)]">
                  {formatBytes(job.completedBytes)} of {formatBytes(job.totalBytes)}
                  {job.error ? ` — ${job.error}` : ""}
                </p>
              </div>
            )}
          </SettingsBlock>
        )}

        {status && !status.manageable && status.available && (
          <SettingsBlock>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              This runtime loads a model file from disk, so models are added and
              removed on the server rather than from here. Running an Ollama
              daemon on the API host would make installing from this page
              possible.
            </p>
          </SettingsBlock>
        )}
      </SettingsCard>

      {/* ---- Downloads and cache ---- */}
      <SettingsCard title="This device">
        <SettingsRow
          label="Keep your conversation list offline"
          description="Caches the titles of your most recent conversations in this browser, so the sidebar still lists them when the server cannot be reached. The list is marked as cached when that happens. Message contents are not cached, and sending always needs a connection."
        >
          <SettingsToggle
            label="Keep your conversation list offline"
            checked={values.cacheConversations}
            onChange={(v) => set({ cacheConversations: v })}
          />
        </SettingsRow>

        <SettingsRow label="How many to keep">
          <SettingsSlider
            label="Conversations cached"
            value={values.cacheLimit}
            min={0}
            max={100}
            step={5}
            disabled={!values.cacheConversations}
            onCommit={(v) => set({ cacheLimit: v })}
            format={(v) => String(v)}
          />
        </SettingsRow>

        <SettingsRow
          label="Download over Wi-Fi only"
          description="Applies to model and asset downloads on a device that reports its connection type. Desktop browsers do not, so this has no effect there."
        >
          <SettingsToggle
            label="Download over Wi-Fi only"
            checked={values.downloadOverWifiOnly}
            onChange={(v) => set({ downloadOverWifiOnly: v })}
          />
        </SettingsRow>

        <SettingsRow label="Allow downloads on mobile data">
          <SettingsToggle
            label="Allow downloads on mobile data"
            checked={values.allowMobileData}
            onChange={(v) => set({ allowMobileData: v })}
            disabled={values.downloadOverWifiOnly}
          />
        </SettingsRow>

        <SettingsRow
          label="Update models automatically"
          description="Checks for a newer version of each installed model. Only meaningful with a manageable runtime."
        >
          <SettingsToggle
            label="Update models automatically"
            checked={values.autoUpdateModels}
            onChange={(v) => set({ autoUpdateModels: v })}
            disabled={!status?.manageable}
          />
        </SettingsRow>

        <SettingsRow
          label="Prefer the local model when offline"
          description="Answers from the server's own model rather than failing, whenever the hosted service cannot be reached."
        >
          <SettingsToggle
            label="Prefer the local model when offline"
            checked={values.preferLocalWhenOffline}
            onChange={(v) => set({ preferLocalWhenOffline: v })}
            disabled={!status?.available}
          />
        </SettingsRow>

        <SettingsRow
          label="Browser storage"
          description={
            storageEstimate
              ? `${formatBytes(storageEstimate.usage)} used of ${formatBytes(storageEstimate.quota)} available to this site.`
              : "Your browser does not report a storage estimate."
          }
        >
          <StatusPill>
            {storageEstimate
              ? `${formatBytes(storageEstimate.usage)}`
              : "Unknown"}
          </StatusPill>
        </SettingsRow>
      </SettingsCard>

      {actionError && (
        <p role="alert" className="mt-3 text-xs text-hetex-red-500">
          {actionError}
        </p>
      )}

      <Callout title="What offline really means here">
        Hetex is a web app, so an offline session can read what this browser has
        cached but cannot send a message — the model runs on the server, not in
        your browser. &ldquo;Local AI&rdquo; means the model runs on the Hetex
        server instead of at an external provider, which is a privacy property
        rather than an offline one.
      </Callout>
    </>
  );
}
