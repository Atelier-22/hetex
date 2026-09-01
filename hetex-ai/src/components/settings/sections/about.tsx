"use client";

import { useEffect, useState } from "react";
import {
  LinkRow,
  LoadingRows,
  SectionHeader,
  SettingsBlock,
  SettingsCard,
  SettingsRow,
  StatusPill,
} from "../primitives";
import { HetexIcon } from "../../logo";
import { apiFetch } from "@/lib/api-client";
import { APP_VERSION } from "@/lib/version";

type About = {
  name: string;
  version: string;
  build: string;
  builtAt: string | null;
  settingsSchemaVersion: number;
  engine: {
    hostedModels: number;
    hostedConfigured: boolean;
    localRuntime: "ollama" | "llamacpp" | "none";
    localModels: {
      name: string;
      sizeBytes: number | null;
      contextLength: number | null;
    }[];
  };
  database: { version: string | null; migrations: number | null };
  features: Record<string, boolean>;
};

/**
 * The open-source packages Hetex is built on, and their licences.
 *
 * Written out rather than generated: a build-time licence scan would be the
 * right answer, and until that exists this lists the direct dependencies that
 * actually ship, with what they are used for.
 */
const LICENSES = [
  { name: "Next.js", license: "MIT", use: "The web framework." },
  { name: "React", license: "MIT", use: "The interface." },
  { name: "Tailwind CSS", license: "MIT", use: "Styling." },
  { name: "next-auth", license: "ISC", use: "Sign-in and sessions." },
  { name: "next-themes", license: "MIT", use: "Light and dark themes." },
  { name: "lucide-react", license: "ISC", use: "Every icon in this interface." },
  { name: "react-markdown", license: "MIT", use: "Rendering replies." },
  { name: "Express", license: "MIT", use: "The backend HTTP server." },
  { name: "Drizzle ORM", license: "Apache-2.0", use: "Database access and migrations." },
  { name: "PostgreSQL (pg)", license: "MIT", use: "The database driver." },
  { name: "zod", license: "MIT", use: "Validating every setting on the server." },
  { name: "bcryptjs", license: "MIT", use: "Password and recovery-code hashing." },
  { name: "jsonwebtoken", license: "MIT", use: "Bearer tokens." },
  { name: "node-llama-cpp", license: "MIT", use: "Running a model on the server." },
  { name: "cheerio", license: "MIT", use: "Reading search results." },
];

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const RUNTIME_LABEL = {
  ollama: "Ollama",
  llamacpp: "llama.cpp",
  none: "None",
} as const;

export function AboutSection() {
  const [about, setAbout] = useState<About | null>(null);

  useEffect(() => {
    apiFetch<About>("/system/about")
      .then(setAbout)
      .catch(() => setAbout(null));
  }, []);

  return (
    <>
      <SectionHeader title="About Hetex AI" description="What is running, and what it is built on." />

      <div className="settings-card mb-4 flex items-center gap-4 p-5">
        <HetexIcon size={52} />
        <div className="min-w-0">
          <p className="text-lg font-semibold">Hetex AI</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Built in Uganda. Designed for the world.
          </p>
          <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)]">
            Web v{APP_VERSION}
            {about ? ` · API v${about.version} (${about.build})` : ""}
          </p>
        </div>
      </div>

      {!about && <LoadingRows count={3} />}

      {about && (
        <>
          <SettingsCard title="Build">
            <SettingsRow label="Web version">
              <span className="font-mono text-xs">{APP_VERSION}</span>
            </SettingsRow>
            <SettingsRow label="API version">
              <span className="font-mono text-xs">{about.version}</span>
            </SettingsRow>
            <SettingsRow
              label="Build"
              description={
                about.build === "local"
                  ? "Running from a local checkout, so there is no commit hash to report."
                  : undefined
              }
            >
              <span className="font-mono text-xs">{about.build}</span>
            </SettingsRow>
            <SettingsRow label="Settings schema">
              <span className="font-mono text-xs">
                v{about.settingsSchemaVersion}
              </span>
            </SettingsRow>
          </SettingsCard>

          <SettingsCard
            title="AI engine"
            description="Described by capability. The vendor behind a hosted model is not something this product discloses, and the assistant will say the same if you ask it."
          >
            <SettingsRow
              label="Hosted models"
              description={
                about.engine.hostedConfigured
                  ? "A hosted provider is configured on this server."
                  : "No hosted provider is configured. Replies come from the local model, if one exists."
              }
            >
              <StatusPill tone={about.engine.hostedConfigured ? "ok" : "off"}>
                {about.engine.hostedModels} available
              </StatusPill>
            </SettingsRow>

            <SettingsRow label="Local runtime">
              <StatusPill
                tone={about.engine.localRuntime === "none" ? "off" : "ok"}
              >
                {RUNTIME_LABEL[about.engine.localRuntime]}
              </StatusPill>
            </SettingsRow>

            {about.engine.localModels.length > 0 && (
              <SettingsBlock label="Installed locally">
                <div className="flex flex-col gap-1.5">
                  {about.engine.localModels.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate font-mono">{m.name}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                        {formatBytes(m.sizeBytes)}
                        {m.contextLength
                          ? ` · ${m.contextLength.toLocaleString()} ctx`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </SettingsBlock>
            )}
          </SettingsCard>

          <SettingsCard title="System">
            <SettingsRow label="Database">
              <span className="font-mono text-xs">
                {about.database.version ?? "Unknown"}
              </span>
            </SettingsRow>
            <SettingsRow
              label="Migrations applied"
              description="Applied automatically at boot, so a fresh deployment provisions its own schema."
            >
              <span className="font-mono text-xs tabular-nums">
                {about.database.migrations ?? "—"}
              </span>
            </SettingsRow>

            <SettingsBlock
              label="Features on this server"
              description="Set by an administrator. A feature that is off is unavailable everywhere in the app, not merely hidden."
            >
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(about.features).map(([name, on]) => (
                  <StatusPill key={name} tone={on ? "ok" : "off"}>
                    {name}
                  </StatusPill>
                ))}
              </div>
            </SettingsBlock>
          </SettingsCard>
        </>
      )}

      <SettingsCard title="Legal">
        <LinkRow label="Terms of service" href="/terms" />
        <LinkRow label="Privacy policy" href="/privacy" />
      </SettingsCard>

      <SettingsCard
        title="Open source"
        description="Hetex AI is built on the work of others. These are the direct dependencies that ship in the product."
      >
        {LICENSES.map((l) => (
          <SettingsRow key={l.name} label={l.name} description={l.use}>
            <StatusPill>{l.license}</StatusPill>
          </SettingsRow>
        ))}
      </SettingsCard>

      <p className="mt-4 text-center text-xs leading-relaxed text-[var(--text-secondary)]">
        Hetex AI was created by Muhwezi Peter, its founder, in Kampala, Uganda,
        with Alafi Jonathan as co-founder.
      </p>
    </>
  );
}
