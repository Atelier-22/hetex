"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "../primitives";
import { apiFetch } from "@/lib/api-client";

type Storage = {
  conversations: number;
  messages: number;
  projects: number;
  memoryEntries: number;
  assets: number;
  messageBytes: number;
  assetBytes: number;
  totalBytes: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageSection() {
  const [data, setData] = useState<Storage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Storage>("/account/storage")
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load storage")
      );
  }, []);

  // Percentages describe the split of what is stored, not usage against a
  // quota — there is no quota, and drawing one would invent a limit.
  const messageShare = data?.totalBytes
    ? Math.round((data.messageBytes / data.totalBytes) * 100)
    : 0;

  return (
    <>
      <SectionHeader
        title="Storage"
        description="What this account is actually storing, measured from the database."
      />

      {error && <p className="text-xs text-hetex-red-500">{error}</p>}

      {!data && !error && (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
          <div className="h-28 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
        </div>
      )}

      {data && (
        <>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
            <p className="text-3xl font-semibold">
              {formatBytes(data.totalBytes)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Total stored. There is no storage limit on the free plan.
            </p>

            {data.totalBytes > 0 && (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="bg-accent-gradient h-full"
                    style={{ width: `${messageShare}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <span className="bg-accent-gradient h-2 w-2 rounded-full" />
                    Conversations {formatBytes(data.messageBytes)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-black/20 dark:bg-white/20" />
                    Files {formatBytes(data.assetBytes)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Conversations" value={data.conversations} />
            <Stat label="Messages" value={data.messages} />
            <Stat label="Projects" value={data.projects} />
            <Stat label="Memories" value={data.memoryEntries} />
            <Stat label="Files" value={data.assets} />
            <Stat label="Total size" value={formatBytes(data.totalBytes)} />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Attachments are stored in the database rather than object storage,
            so a large image counts fully against the figure above. Files over
            1.5 MB are recorded by name only.
          </p>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
