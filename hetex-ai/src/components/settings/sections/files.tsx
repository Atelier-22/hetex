"use client";

import { Database, FileType, HardDrive } from "lucide-react";
import {
  Callout,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsBlock,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";

/** Human names for the media types the server accepts. */
const TYPE_NAMES: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/gif": "GIF",
  "image/webp": "WebP",
  "application/pdf": "PDF",
  "text/plain": "TXT",
  "text/markdown": "Markdown",
  "text/csv": "CSV",
  "application/json": "JSON",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
};

export function FilesSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("files");

  const limits = meta?.limits;
  const allowed = meta?.allowedFileTypes ?? [];
  const uploadsDisabled = meta?.features?.fileUploads === false;
  const extractionAvailable = meta?.capabilities?.fileTextExtraction === true;

  return (
    <>
      <SectionHeader
        title="Files"
        description="What you can attach, and how long it is kept."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {uploadsDisabled && (
        <Callout tone="warn" title="Uploads are unavailable">
          An administrator has turned file uploads off for this server.
        </Callout>
      )}

      <SettingsCard
        title="Limits"
        description="Set by an administrator and enforced by the server. The composer refuses a file above these before it is uploaded, and the server refuses it again if the browser is bypassed."
      >
        {!meta && (
          <div className="py-4">
            <LoadingRows count={2} />
          </div>
        )}

        {limits && (
          <>
            <SettingsRow label="Maximum file size" icon={FileType}>
              <span className="text-sm tabular-nums">
                {limits.maxUploadMb} MB
              </span>
            </SettingsRow>

            <SettingsRow label="Files per message">
              <span className="text-sm tabular-nums">
                {limits.maxAttachmentsPerMessage}
              </span>
            </SettingsRow>

            <SettingsBlock
              label="Accepted file types"
              description="Anything not listed is refused at upload."
            >
              <div className="flex flex-wrap gap-1.5">
                {allowed.map((type) => (
                  <StatusPill key={type}>
                    {TYPE_NAMES[type] ?? type.split("/").pop()}
                  </StatusPill>
                ))}
              </div>
            </SettingsBlock>
          </>
        )}
      </SettingsCard>

      <SettingsCard title="Handling">
        <SettingsRow
          label="Analyse documents automatically"
          unavailable={
            extractionAvailable
              ? undefined
              : "Text extraction is not built yet, so a PDF or DOCX is stored and listed but its contents are not read. Images are analysed. This preference is stored and will apply when extraction ships."
          }
        >
          <SettingsToggle
            label="Analyse documents automatically"
            checked={values.autoAnalyze}
            onChange={(v) => set({ autoAnalyze: v })}
            disabled={!extractionAvailable}
          />
        </SettingsRow>

        <SettingsRow
          label="Index files for search"
          unavailable="Indexing needs the text extraction above, plus an embedding store. Neither exists on this server."
        >
          <SettingsToggle
            label="Index files for search"
            checked={values.autoIndex}
            onChange={(v) => set({ autoIndex: v })}
            disabled
          />
        </SettingsRow>

        <SettingsRow
          label="Keep uploaded files"
          description="Saves them to your Library. Off uses the file for the message and keeps nothing."
        >
          <SettingsToggle
            label="Keep uploaded files"
            checked={values.keepUploads}
            onChange={(v) => set({ keepUploads: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Delete after the conversation"
          description="Removes attachments once the conversation's reply finishes."
        >
          <SettingsToggle
            label="Delete after the conversation"
            checked={values.deleteAfterConversation}
            onChange={(v) => set({ deleteAfterConversation: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Delete files after"
          description="Swept on the server, alongside conversation retention."
        >
          <SegmentedControl
            label="Delete files after"
            value={String(values.retentionDays)}
            onChange={(v) => set({ retentionDays: Number(v) })}
            options={[
              { value: "0", label: "Keep" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
            disabled={values.deleteAfterConversation}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Where files are stored">
        <SettingsRow
          label="Storage backend"
          icon={Database}
          description="Attachments are held in the Hetex database as data URLs. There is no object store and no persistent disk on the hosting used here, so this is the only backend that exists."
        >
          <StatusPill tone="ok">Database</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Cloud storage"
          icon={HardDrive}
          unavailable="No object store is connected. Connecting one is a server change, not a setting."
        >
          <StatusPill tone="off">Not configured</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Local storage"
          unavailable="A browser cannot write to your file system on its own. Downloading a file puts it wherever your browser is set to save."
        >
          <StatusPill tone="off">Not applicable</StatusPill>
        </SettingsRow>
      </SettingsCard>

      <Callout title="One practical note">
        Files above 1.5 MB are recorded by name only rather than stored, because
        the database holds the bytes inline. A large image therefore appears in
        your Library as a file card without a preview.
      </Callout>
    </>
  );
}
