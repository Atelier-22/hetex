"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, RotateCcw, Upload } from "lucide-react";
import {
  Callout,
  ConfirmButton,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsSlider,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { useSettingsStore } from "@/lib/settings/store";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";

export function AdvancedSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("advanced");
  const store = useSettingsStore();
  const { data: session } = useSession();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const models = meta?.models ?? [];
  const tokenCeiling = meta?.limits?.maxOutputTokens ?? 8192;
  // Temperature is only sent to providers that accept one; saying which is more
  // useful than a slider that silently does nothing on the selected model.
  const temperatureModels = models.filter((m) => m.capabilities.temperature);

  async function exportSettings() {
    setBusy("export");
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/export`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Aviel-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Settings exported.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function importSettings(file: File) {
    setBusy("import");
    setActionError(null);
    setNotice(null);
    setSkipped([]);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("That file is not valid JSON.");
      }

      const result = await apiFetch<{ imported: string[]; skipped: string[] }>(
        "/settings/import",
        { method: "POST", body: JSON.stringify(parsed) }
      );

      setNotice(
        `Imported ${result.imported.length} section${result.imported.length === 1 ? "" : "s"}.`
      );
      setSkipped(result.skipped);
      await store.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function resetEverything() {
    setBusy("reset-all");
    setActionError(null);
    try {
      await store.reset();
      setNotice("Every setting is back to its default.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SectionHeader
        title="Advanced"
        description="Generation parameters, developer tools, and moving your settings between accounts."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard
        title="Generation"
        description="Sent with every request, and clamped by the server before it reaches a provider."
      >
        <SettingsRow
          label="Temperature"
          description="Lower is more predictable, higher is more varied. Personality → Creativity is the plain-language version of this."
          unavailable={
            temperatureModels.length === 0
              ? "None of the models on this server accept a temperature — some vendors reject the parameter outright on their current models, so sending it would fail the request rather than change the answer. Personality → Creativity works on every model, because it goes into the prompt."
              : temperatureModels.length < (meta?.models.length ?? 0)
                ? `Applies to ${temperatureModels.map((m) => m.label).join(", ")}. The other models reject the parameter, so it is not sent to them.`
                : undefined
          }
        >
          <SettingsSlider
            label="Temperature"
            value={values.temperature}
            min={0}
            max={2}
            step={0.1}
            onCommit={(v) => set({ temperature: v })}
            format={(v) => v.toFixed(1)}
          />
        </SettingsRow>

        <SettingsRow
          label="Maximum output"
          description={`Tokens in a single reply. This server allows up to ${tokenCeiling.toLocaleString()}; anything above is clamped rather than accepted.`}
        >
          <SettingsSlider
            label="Maximum output tokens"
            value={values.maxOutputTokens}
            min={256}
            max={Math.min(32000, tokenCeiling)}
            step={256}
            onCommit={(v) => set({ maxOutputTokens: v })}
            format={(v) => v.toLocaleString()}
          />
        </SettingsRow>

        <SettingsRow
          label="Stream responses"
          description="Server-sent events, word by word. Off waits for the whole reply. Also settable in Conversations."
        >
          <SettingsToggle
            label="Stream responses"
            checked={values.streaming}
            onChange={(v) => set({ streaming: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Fallback model"
          description="Tried on the server when your chosen model returns nothing at all. If it also fails, the local model answers — unless you have turned that off in AI & models. A reply that had already started is never handed to a second model, because it would change voice mid-sentence."
        >
          <SettingsDropdown
            label="Fallback model"
            value={values.fallbackModel ?? ""}
            onChange={(v) => set({ fallbackModel: v || null })}
            options={[
              { value: "", label: "Local model" },
              ...models.map((m) => ({ value: m.value, label: m.label })),
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Developer">
        <SettingsRow
          label="Debug mode"
          description="Logs request and streaming detail to the browser console."
        >
          <SettingsToggle
            label="Debug mode"
            checked={values.debugMode}
            onChange={(v) => set({ debugMode: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Developer mode"
          description="Shows raw routing decisions and provider identifiers in the chat."
        >
          <SettingsToggle
            label="Developer mode"
            checked={values.developerMode}
            onChange={(v) => set({ developerMode: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Experimental features"
          description="Opts this account into features that are still being built. There are none right now, so this currently changes nothing."
        >
          <SettingsToggle
            label="Experimental features"
            checked={values.experimentalFeatures}
            onChange={(v) => set({ experimentalFeatures: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="API keys"
          unavailable="Provider keys live in the server environment and are never sent to a browser. There is deliberately no field here to put one in — a key entered in a web page is a key in a web page."
        >
          <StatusPill tone="ok">Server-side only</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Launch at login"
          unavailable="Meaningless in a browser. Stored so a future desktop build inherits the preference rather than asking again."
        >
          <SettingsToggle
            label="Launch at login"
            checked={values.launchAtLogin}
            onChange={(v) => set({ launchAtLogin: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Move your settings"
        description="A validated JSON file. Importing cannot grant anything the interface could not: a username, a phone number, and the output ceiling are dropped, and every value is re-checked by the server."
      >
        <SettingsBlock>
          <div className="flex flex-wrap gap-2">
            <SettingsButton onClick={exportSettings} busy={busy === "export"}>
              <Download size={13} /> Export settings
            </SettingsButton>
            <SettingsButton
              onClick={() => fileRef.current?.click()}
              busy={busy === "import"}
            >
              <Upload size={13} /> Import settings
            </SettingsButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importSettings(file);
              }}
            />
          </div>

          {skipped.length > 0 && (
            <div className="mt-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
              <p className="text-xs font-medium">
                {skipped.length} value{skipped.length === 1 ? "" : "s"} were not
                imported
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Either they are not allowed to come from a file, or they are not
                valid on this server.
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {skipped.map((s) => (
                  <li key={s}>
                    <StatusPill>{s}</StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SettingsBlock>
      </SettingsCard>

      <SettingsCard title="Reset">
        <SettingsRow
          label="Reset all settings"
          description="Returns every section to its default. Your conversations, files, projects, memory and account are untouched — deleting data is a separate action in Privacy & data."
        >
          <ConfirmButton
            question="Reset every setting to its default? Your data is not affected."
            confirmLabel="Reset everything"
            busy={busy === "reset-all"}
            onConfirm={resetEverything}
          >
            <RotateCcw size={13} /> Reset all settings
          </ConfirmButton>
        </SettingsRow>
      </SettingsCard>

      {notice && <p className="text-accent mt-3 text-xs">{notice}</p>}
      {actionError && (
        <p role="alert" className="mt-3 text-xs text-aviel-red-500">
          {actionError}
        </p>
      )}

      <Callout title="Where these apply">
        The output ceiling is sent with every request and clamped against the
        platform limit before it reaches a provider, so a value edited in a
        request body cannot exceed what an administrator allows. Temperature is
        sent only to providers that accept one, as noted above.
      </Callout>
    </>
  );
}
