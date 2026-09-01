"use client";

import { Clock, History, Trash2 } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
} from "../primitives";
import { useSection } from "../use-section";

export function ConversationsSection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("conversation");

  return (
    <>
      <SectionHeader
        title="Conversations"
        description="What is kept, for how long, and how the chat behaves while you use it."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="History">
        <SettingsRow
          label="Save conversations"
          icon={History}
          description="When off, each conversation is deleted the moment its reply finishes. Nothing new appears in your sidebar; conversations you already have are left alone."
        >
          <SettingsToggle
            label="Save conversations"
            checked={values.saveConversations}
            onChange={(v) => set({ saveConversations: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Save as you go"
          description="Each message is written as it is sent, so a closed tab loses nothing."
        >
          <SettingsToggle
            label="Save as you go"
            checked={values.autoSave}
            onChange={(v) => set({ autoSave: v })}
            disabled={!values.saveConversations}
          />
        </SettingsRow>

        <SettingsRow
          label="Delete conversations after"
          icon={Trash2}
          description="Applied by the server, not the browser. Pinned conversations are never swept — pinning is how you keep one."
        >
          <SegmentedControl
            label="Delete conversations after"
            value={String(values.retentionDays)}
            onChange={(v) =>
              set({ retentionDays: Number(v) as 0 | 30 | 90 | 365 })
            }
            options={[
              { value: "0", label: "Never" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "365", label: "1 year" },
            ]}
            disabled={!values.saveConversations}
          />
        </SettingsRow>

        <SettingsRow
          label="Name conversations automatically"
          description="Uses your first message as the title. Off leaves them as 'New Chat' until you rename one."
        >
          <SettingsToggle
            label="Name conversations automatically"
            checked={values.autoTitle}
            onChange={(v) => set({ autoTitle: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="In the chat">
        <SettingsRow label="Show timestamps" icon={Clock}>
          <SettingsToggle
            label="Show timestamps"
            checked={values.showTimestamps}
            onChange={(v) => set({ showTimestamps: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Show which model answered"
          description="Adds a label under each reply, including whether it was answered on this server or by a hosted service."
        >
          <SettingsToggle
            label="Show which model answered"
            checked={values.showModelUsed}
            onChange={(v) => set({ showModelUsed: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Show usage information"
          description="Message and character counts for the conversation. Token counts are not shown, because the server does not report them yet."
        >
          <SettingsToggle
            label="Show usage information"
            checked={values.showUsage}
            onChange={(v) => set({ showUsage: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Stream replies"
          description="Words appear as they are generated. Off waits for the whole reply, which can feel slower but arrives in one piece."
        >
          <SettingsToggle
            label="Stream replies"
            checked={values.streamResponses}
            onChange={(v) => set({ streamResponses: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Show the typing indicator"
          description="The three dots while waiting for the first word."
        >
          <SettingsToggle
            label="Show the typing indicator"
            checked={values.showTypingIndicator}
            onChange={(v) => set({ showTypingIndicator: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Follow the reply as it arrives"
          description="Scrolls with the stream. Scrolling up always pauses it, whatever this is set to."
        >
          <SettingsToggle
            label="Follow the reply as it arrives"
            checked={values.autoScroll}
            onChange={(v) => set({ autoScroll: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Send with"
          description="The other combination inserts a new line."
        >
          <SegmentedControl
            label="Send with"
            value={values.sendKey}
            onChange={(v) => set({ sendKey: v })}
            options={[
              { value: "enter", label: "Enter" },
              { value: "ctrl_enter", label: "Ctrl + Enter" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      {!values.saveConversations && (
        <Callout tone="warn" title="History is off">
          Replies still work, but each conversation is removed as soon as it
          finishes — including its attachments. Nothing is recoverable
          afterwards.
        </Callout>
      )}
    </>
  );
}
