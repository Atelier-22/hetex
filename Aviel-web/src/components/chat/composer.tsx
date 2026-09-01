"use client";

// Aviel — the composer.
//
// Structure follows the reference exactly: one large rounded glass pane, the
// field sitting at the top-left rather than vertically centred, and the
// controls pinned along the bottom — plus on the left, microphone then the
// blue circular action on the right.
//
// It is positioned rather than laid out as a flex row on purpose. The field
// grows downward as it fills, and absolute corners mean nothing else moves
// when it does; a flex row would drift every control as the text wrapped.
//
// The blue action is a waveform while the field is empty and a send arrow once
// there is something to send, so the primary button always describes what it
// will actually do.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Camera,
  Check,
  FileText,
  FolderKanban,
  Globe,
  ImagePlus,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useSettingsStore } from "@/lib/settings/store";
import { composerPlaceholder } from "./composer-placeholder";
import { LiveVoiceIcon } from "@/components/voice/live-voice-icon";

export type ThinkMode = "fast" | "balanced" | "deep";
export type VoiceState = "idle" | "listening" | "transcribing";

export type ComposerAttachment = {
  name: string;
  mediaType: string;
  base64: string;
  previewUrl?: string;
};

type Project = { id: string; name: string };

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  attachments,
  onAttach,
  onRemoveAttachment,
  webSearchEnabled,
  onToggleWebSearch,
  selectedProject,
  onSelectProject,
  showProjectPicker,
  voiceState,
  onToggleVoice,
  interimTranscript,
  onCancelVoice,
  micSupported,
  thinkMode,
  onThinkModeChange,
  onOpenLiveVoice,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  attachments: ComposerAttachment[];
  onAttach: (files: FileList | File[]) => void;
  onRemoveAttachment: (name: string) => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  selectedProject: Project | null;
  onSelectProject: (p: Project | null) => void;
  showProjectPicker: boolean;
  voiceState: VoiceState;
  onToggleVoice: () => void;
  interimTranscript: string;
  onCancelVoice: () => void;
  micSupported: boolean;
  thinkMode: ThinkMode;
  onThinkModeChange: (m: ThinkMode) => void;
  /** Omitted where live voice does not apply, such as the marketing page. */
  onOpenLiveVoice?: () => void;
  autoFocus?: boolean;
}) {
  const { settings, meta } = useSettingsStore();

  const [menu, setMenu] = useState<null | "add" | "projects" | "think">(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dropping, setDropping] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const hasContent = value.trim().length > 0 || attachments.length > 0;
  const canSend = hasContent && !isStreaming;
  const sendOnEnter = settings.conversation.sendKey === "enter";
  const listening = voiceState === "listening";
  const transcribing = voiceState === "transcribing";

  const features = meta?.features ?? {};
  const uploadsOn = features.fileUploads !== false;
  const imagesOn = features.imageAnalysis !== false;
  const webSearchOn = features.webSearch !== false && settings.ai.webSearch;
  const projectsOn = features.projects !== false;
  const generationOn = features.imageGeneration === true;
  const thinkModes = meta?.thinkModes ?? null;

  useEffect(() => {
    if (autoFocus) fieldRef.current?.focus();
  }, [autoFocus]);

  // Grow with the content. The shell's min-height holds the reference
  // proportions until the text actually needs more room.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenu(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (menu !== "projects") return;
    apiFetch<Project[]>("/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [menu]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files);
      if (files.length === 0) return;
      // A pasted screenshot should attach, not drop its filename in as text.
      e.preventDefault();
      onAttach(files);
    },
    [onAttach]
  );

  // Depth-counted: dragging over a child fires dragleave on the parent, so a
  // plain boolean flickers the highlight off mid-drag.
  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDropping(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    onAttach(e.dataTransfer.files);
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const wantsSend = sendOnEnter
      ? !e.shiftKey && !e.ctrlKey && !e.metaKey
      : e.ctrlKey || e.metaKey;
    if (wantsSend) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  const liveVoiceAvailable = Boolean(
    onOpenLiveVoice && settings.liveVoice.enabled && micSupported
  );

  /**
   * The blue button.
   *
   * Send when there is something to send, stop while a reply streams, and go
   * live when the field is empty. It never dictates — that is the microphone
   * beside it, and giving one button both jobs is what made the two
   * indistinguishable.
   */
  function primaryAction() {
    if (isStreaming) return onStop();
    if (canSend) return onSend();
    if (liveVoiceAvailable) return onOpenLiveVoice?.();
  }

  const primaryDisabled = !isStreaming && !canSend && !liveVoiceAvailable;

  const primaryLabel = isStreaming
    ? "Stop generating"
    : canSend
      ? "Send message"
      : liveVoiceAvailable
        ? "Start a live voice conversation"
        : "Type a message to send";

  return (
    <div className="mx-auto w-full max-w-[820px]">
      {/* ---- Context chips, above the pane ---- */}
      {(attachments.length > 0 || selectedProject || webSearchEnabled) && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5 px-2">
          {selectedProject && (
            <Chip onRemove={() => onSelectProject(null)} label={`Remove ${selectedProject.name}`}>
              <FolderKanban size={12} />
              {selectedProject.name}
            </Chip>
          )}
          {webSearchEnabled && (
            <Chip onRemove={onToggleWebSearch} label="Turn web search off">
              <Globe size={12} />
              Web search
            </Chip>
          )}
          {attachments.map((a) => (
            <Chip
              key={a.name}
              onRemove={() => onRemoveAttachment(a.name)}
              label={`Remove ${a.name}`}
            >
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.previewUrl} alt="" className="h-4 w-4 rounded object-cover" />
              ) : (
                <Paperclip size={12} />
              )}
              <span className="max-w-[10rem] truncate">{a.name}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="relative" ref={rootRef}>
        {/* ---- Attachment menu, above the pane ---- */}
        {menu === "add" && (
          <div className="hx-menu" role="menu">
            <MenuItem
              icon={ImagePlus}
              onClick={() => { imageRef.current?.click(); setMenu(null); }}
              disabled={!uploadsOn || !imagesOn}
              reason={
                !imagesOn
                  ? "Image analysis is off, so an image would be stored but not read."
                  : undefined
              }
            >
              Upload image
            </MenuItem>
            <MenuItem
              icon={FileText}
              onClick={() => { fileRef.current?.click(); setMenu(null); }}
              disabled={!uploadsOn}
              reason={!uploadsOn ? "Uploads are off for this server." : undefined}
            >
              Upload document
            </MenuItem>
            <MenuItem
              icon={Camera}
              onClick={() => { cameraRef.current?.click(); setMenu(null); }}
              disabled={!uploadsOn || !imagesOn}
            >
              Take photo
            </MenuItem>

            {generationOn && (
              <MenuItem icon={Sparkles} onClick={() => setMenu(null)}>
                Create image
              </MenuItem>
            )}

            {webSearchOn && (
              <MenuItem
                icon={Globe}
                onClick={() => { onToggleWebSearch(); setMenu(null); }}
                trailing={
                  webSearchEnabled ? <Check size={15} className="text-[var(--bright-blue)]" /> : undefined
                }
              >
                Search the web
              </MenuItem>
            )}

            {showProjectPicker && projectsOn && (
              <MenuItem icon={FolderKanban} onClick={() => setMenu("projects")}>
                Add to a project
              </MenuItem>
            )}
          </div>
        )}

        {menu === "projects" && (
          <div className="hx-menu" role="menu">
            <MenuItem icon={X} onClick={() => { onSelectProject(null); setMenu(null); }}>
              No project
            </MenuItem>
            {projects.map((p) => (
              <MenuItem
                key={p.id}
                icon={FolderKanban}
                onClick={() => { onSelectProject(p); setMenu(null); }}
                trailing={
                  selectedProject?.id === p.id ? <Check size={15} className="text-[var(--bright-blue)]" /> : undefined
                }
              >
                {p.name}
              </MenuItem>
            ))}
            {projects.length === 0 && (
              <p className="px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                No projects yet. Create one from the sidebar to give Aviel a
                workspace.
              </p>
            )}
          </div>
        )}

        {menu === "think" && (
          <div className="hx-menu" style={{ left: 62 }} role="menu">
            {(["fast", "balanced", "deep"] as const).map((mode) => {
              const note = thinkModes?.find((m) => m.mode === mode)?.note;
              const label =
                mode === "fast" ? "Fast" : mode === "deep" ? "Deep think" : "Balanced";
              return (
                <button
                  key={mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={thinkMode === mode}
                  onClick={() => { onThinkModeChange(mode); setMenu(null); }}
                  className="hx-menu-item items-start"
                >
                  <Sparkles size={15} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {label}
                      {thinkMode === mode && (
                        <Check size={13} className="text-[var(--bright-blue)]" />
                      )}
                    </span>
                    {note && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
                        {note}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ---- The pane ---- */}
        <div
          className="hx-composer"
          data-dropping={dropping}
          data-listening={listening || transcribing}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
          onDrop={onDrop}
        >
          {(listening || transcribing) && (
            <div className="hx-listening">
              <span>{transcribing ? "Transcribing…" : "Listening…"}</span>
              <span className="hx-listening-bars" aria-hidden>
                {Array.from({ length: 28 }, (_, i) => (
                  <i key={i} style={{ animationDelay: `${(i % 7) * 90}ms` }} />
                ))}
              </span>
              <button
                type="button"
                onClick={onCancelVoice}
                className="shrink-0 rounded-full px-2 py-1 text-xs text-[var(--composer-icon)] hover:text-[var(--composer-icon-hover)]"
              >
                Cancel
              </button>
            </div>
          )}

          <label className="sr-only" htmlFor="composer-input">
            Message Aviel
          </label>
          <textarea
            id="composer-input"
            ref={fieldRef}
            className="hx-composer-field"
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              dropping
                ? "Drop files to attach"
                : interimTranscript || composerPlaceholder(settings)
            }
          />

          {/* Bottom-left */}
          <div className="hx-rail hx-rail--left">
            <button
              type="button"
              onClick={() => setMenu(menu === "add" || menu === "projects" ? null : "add")}
              aria-label="Add attachment or action"
              aria-expanded={menu === "add" || menu === "projects"}
              aria-haspopup="menu"
              className="hx-icon-btn hx-icon-btn--plus"
            >
              <Plus
                size={19}
                style={{
                  transform: menu === "add" ? "rotate(45deg)" : undefined,
                  transition: "transform var(--t-base) var(--ease)",
                }}
              />
            </button>

            <button
              type="button"
              onClick={() => setMenu(menu === "think" ? null : "think")}
              aria-label={`Thinking mode: ${thinkMode}`}
              aria-expanded={menu === "think"}
              aria-haspopup="menu"
              className="hx-icon-btn"
              style={{
                width: "auto",
                paddingInline: 12,
                fontSize: 13,
                gap: 6,
                color: thinkMode === "balanced" ? undefined : "var(--bright-blue)",
              }}
            >
              <Sparkles size={15} />
              <span className="hidden sm:inline">
                {thinkMode === "fast" ? "Fast" : thinkMode === "deep" ? "Deep" : "Think"}
              </span>
            </button>
          </div>

          {/* Bottom-right.
              Two controls, not three. The microphone dictates into this box;
              the blue button goes live. They were previously three because the
              blue one also started dictation, which made it and the microphone
              the same action wearing two icons. */}
          <div className="hx-rail hx-rail--right">
            {micSupported && settings.voice.dictationEnabled && (
              <button
                type="button"
                onClick={onToggleVoice}
                aria-label={listening ? "Stop dictating" : "Dictate instead of typing"}
                title="Speak instead of typing"
                aria-pressed={listening}
                className="hx-icon-btn"
              >
                <Mic size={19} strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              onClick={primaryAction}
              disabled={primaryDisabled}
              aria-label={primaryLabel}
              title={primaryLabel}
              className={`hx-action ${isStreaming ? "hx-action--stop" : ""}`}
            >
              {isStreaming ? (
                <Square size={15} fill="currentColor" />
              ) : canSend ? (
                <ArrowUp size={20} strokeWidth={2.4} />
              ) : (
                <LiveVoiceIcon size={22} />
              )}
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={(meta?.allowedFileTypes ?? []).join(",") || undefined}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAttach(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={imageRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAttach(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          // `capture` asks a phone for the camera directly. A desktop browser
          // ignores it and shows the normal picker, which is the right
          // fallback rather than a dead entry.
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAttach(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Chip({
  children,
  onRemove,
  label,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[var(--composer-border)] bg-[var(--composer-bg)] py-1 pl-2.5 pr-1.5 text-xs backdrop-blur">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        className="rounded-full p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <X size={11} />
      </button>
    </span>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  reason,
  trailing,
}: {
  icon: typeof Plus;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="hx-menu-item items-start"
    >
      <Icon size={17} strokeWidth={1.75} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        {children}
        {reason && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
            {reason}
          </span>
        )}
      </span>
      {trailing}
    </button>
  );
}
