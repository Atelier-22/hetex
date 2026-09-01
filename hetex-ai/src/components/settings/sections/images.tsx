"use client";

import { Eye, ScanText, Sparkles } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";

const RETENTION = [
  { value: "0", label: "Keep" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export function ImagesSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("images");

  const visionModels = (meta?.models ?? []).filter(
    (m) => m.capabilities.images
  );
  const analysisDisabledByAdmin = meta?.features?.imageAnalysis === false;
  const generationReason =
    typeof meta?.capabilities?.imageGenerationReason === "string"
      ? meta.capabilities.imageGenerationReason
      : "No image generation provider is connected to this server.";

  return (
    <>
      <SectionHeader
        title="Images"
        description="Reading images you attach, and what happens to them afterwards."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {analysisDisabledByAdmin && (
        <Callout tone="warn" title="Image analysis is unavailable">
          An administrator has turned it off for this server.
        </Callout>
      )}

      <SettingsCard title="Reading images">
        <SettingsRow
          label="Analyse images"
          icon={Eye}
          description="When off, an attached image is stored but never looked at, and Hetex says so instead of ignoring it silently."
        >
          <SettingsToggle
            label="Analyse images"
            checked={values.analysisEnabled}
            onChange={(v) => set({ analysisEnabled: v })}
            disabled={analysisDisabledByAdmin}
          />
        </SettingsRow>

        <SettingsRow
          label="Analyse uploads automatically"
          description="Off means an attached image is sent along with your message but not examined unless you ask about it."
        >
          <SettingsToggle
            label="Analyse uploads automatically"
            checked={values.autoAnalyzeUploads}
            onChange={(v) => set({ autoAnalyzeUploads: v })}
            disabled={!values.analysisEnabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Ask before analysing"
          description="Confirms before an image leaves this device for a hosted model. Ignored when everything is processed locally."
        >
          <SettingsToggle
            label="Ask before analysing"
            checked={values.askBeforeAnalyzing}
            onChange={(v) => set({ askBeforeAnalyzing: v })}
            disabled={!values.analysisEnabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Model used for images"
          description="Only models that can actually see are listed. Used when automatic model selection is on."
          unavailable={
            visionModels.length === 0
              ? "No model on this server can read images."
              : undefined
          }
        >
          <SettingsDropdown
            label="Model used for images"
            value={values.visionModel ?? ""}
            disabled={visionModels.length === 0 || !values.analysisEnabled}
            onChange={(v) => set({ visionModel: v || null })}
            options={[
              { value: "", label: "Use the default model" },
              ...visionModels.map((m) => ({ value: m.value, label: m.label })),
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Screenshots"
          description="Reads interface screenshots — error dialogs, designs, spreadsheets."
        >
          <SettingsToggle
            label="Screenshots"
            checked={values.screenshotAnalysis}
            onChange={(v) => set({ screenshotAnalysis: v })}
            disabled={!values.analysisEnabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Photographed documents"
          description="Reads a page or receipt captured as an image."
        >
          <SettingsToggle
            label="Photographed documents"
            checked={values.documentImageAnalysis}
            onChange={(v) => set({ documentImageAnalysis: v })}
            disabled={!values.analysisEnabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Dedicated OCR"
          icon={ScanText}
          unavailable="No OCR engine is installed. Text in an image is read by the vision model rather than extracted character by character, which is good enough for most pages but not for dense scans."
        >
          <StatusPill tone="off">Unavailable</StatusPill>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Storing images">
        <SettingsRow
          label="Keep images you upload"
          description="Saves them to your Library. Off means the image is used for the message and then discarded."
        >
          <SettingsToggle
            label="Keep images you upload"
            checked={values.saveUploads}
            onChange={(v) => set({ saveUploads: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Delete after the conversation"
          description="Removes an image once its conversation's reply finishes."
        >
          <SettingsToggle
            label="Delete after the conversation"
            checked={values.deleteAfterConversation}
            onChange={(v) => set({ deleteAfterConversation: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Delete images after"
          description="Applied on the server by the same sweep that handles conversation retention."
        >
          <SegmentedControl
            label="Delete images after"
            value={String(values.retentionDays)}
            onChange={(v) => set({ retentionDays: Number(v) })}
            options={RETENTION}
            disabled={values.deleteAfterConversation}
          />
        </SettingsRow>

        <SettingsRow
          label="Keep image history"
          description="Shows previously attached images in your Library."
        >
          <SettingsToggle
            label="Keep image history"
            checked={values.keepHistory}
            onChange={(v) => set({ keepHistory: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Generating images"
        description={generationReason}
      >
        <SettingsRow
          label="Image generation"
          icon={Sparkles}
          unavailable="The controls below are stored and will apply the moment a provider is connected. Until then nothing here can produce an image, and asking for one says so."
        >
          <StatusPill tone="off">Not configured</StatusPill>
        </SettingsRow>

        <SettingsRow label="Default aspect ratio">
          <SettingsDropdown
            label="Default aspect ratio"
            value={values.aspectRatio}
            disabled
            onChange={(v) => set({ aspectRatio: v })}
            options={[
              { value: "1:1", label: "Square (1:1)" },
              { value: "16:9", label: "Landscape (16:9)" },
              { value: "9:16", label: "Portrait (9:16)" },
              { value: "4:3", label: "4:3" },
              { value: "3:2", label: "3:2" },
            ]}
          />
        </SettingsRow>

        <SettingsRow label="Default resolution">
          <SegmentedControl
            label="Default resolution"
            value={values.generationResolution}
            onChange={(v) => set({ generationResolution: v })}
            options={[
              { value: "512", label: "512" },
              { value: "768", label: "768" },
              { value: "1024", label: "1024" },
            ]}
            disabled
          />
        </SettingsRow>

        <SettingsRow label="Quality">
          <SegmentedControl
            label="Generation quality"
            value={values.generationQuality}
            onChange={(v) => set({ generationQuality: v })}
            options={[
              { value: "draft", label: "Draft" },
              { value: "standard", label: "Standard" },
              { value: "high", label: "High" },
            ]}
            disabled
          />
        </SettingsRow>
      </SettingsCard>
    </>
  );
}
