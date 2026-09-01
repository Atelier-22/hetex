"use client";

import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, MessagesSquare } from "lucide-react";
import {
  Callout,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  Stat,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
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

export function LibrarySection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("library");
  const [storage, setStorage] = useState<Storage | null>(null);

  useEffect(() => {
    apiFetch<Storage>("/account/storage")
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  const libraryDisabled = meta?.features?.library === false;
  const generationAvailable = meta?.features?.imageGeneration === true;

  return (
    <>
      <SectionHeader
        title="Library"
        description="What is kept in your Library, and how it is ordered."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="What is saved">
        <SettingsRow
          label="Save chats"
          icon={MessagesSquare}
          description="Conversations appear in your Library alongside files."
          unavailable={
            libraryDisabled
              ? "An administrator has turned the Library off for this server."
              : undefined
          }
        >
          <SettingsToggle
            label="Save chats"
            checked={values.autoSaveChats}
            onChange={(v) => set({ autoSaveChats: v })}
            disabled={libraryDisabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Save files"
          icon={FileText}
          description="Attachments are added to your Library when you upload them."
        >
          <SettingsToggle
            label="Save files"
            checked={values.autoSaveGeneratedFiles}
            onChange={(v) => set({ autoSaveGeneratedFiles: v })}
            disabled={libraryDisabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Save generated images"
          icon={ImageIcon}
          unavailable={
            generationAvailable
              ? undefined
              : "Nothing generates images on this server yet, so nothing is produced to save. The preference is stored and will apply when a provider is connected."
          }
        >
          <SettingsToggle
            label="Save generated images"
            checked={values.autoSaveGeneratedImages}
            onChange={(v) => set({ autoSaveGeneratedImages: v })}
            disabled={!generationAvailable}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Ordering">
        <SettingsRow
          label="Sort by"
          description={
            values.sort === "most_used"
              ? "Applied when your Library loads. Per-file usage isn't recorded yet, so this currently falls back to newest first — the Library says so when it does."
              : "Applied when your Library loads."
          }
        >
          <SegmentedControl
            label="Sort by"
            value={values.sort}
            onChange={(v) => set({ sort: v })}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "alphabetical", label: "A–Z" },
              { value: "most_used", label: "Most used" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Bookmarks, folders and collections"
          unavailable="The Library is a flat list today. Grouping needs a schema change, so these are named here as what is missing rather than shown as controls that do nothing."
        >
          <StatusPill tone="off">Not built</StatusPill>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="What you are storing"
        description="Measured from the database, not estimated."
      >
        <div className="py-4">
          {!storage && <LoadingRows count={2} />}

          {storage && (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Stat label="Conversations" value={storage.conversations} />
                <Stat label="Messages" value={storage.messages} />
                <Stat label="Projects" value={storage.projects} />
                <Stat label="Memories" value={storage.memoryEntries} />
                <Stat label="Files" value={storage.assets} />
                <Stat
                  label="Total size"
                  value={formatBytes(storage.totalBytes)}
                />
              </div>

              {storage.totalBytes > 0 && (
                <>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="bg-accent-gradient h-full"
                      style={{
                        width: `${Math.round(
                          (storage.messageBytes / storage.totalBytes) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <span className="bg-accent-gradient h-2 w-2 rounded-full" />
                      Conversations {formatBytes(storage.messageBytes)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-black/20 dark:bg-white/20" />
                      Files {formatBytes(storage.assetBytes)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SettingsCard>

      <Callout title="No quota">
        The bar above shows the split of what you are storing, not usage against
        a limit. There is no storage limit on the free plan, and drawing one
        would invent a boundary that does not exist.
      </Callout>
    </>
  );
}
