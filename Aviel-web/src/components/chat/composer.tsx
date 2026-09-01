"use client";

// Aviel — the chat composer.
//
// One rounded surface holding every control, rather than a row of separate
// circular buttons. Layout, top row then bottom row:
//
//   [ textarea, auto-growing                                   ]
//   [ +   Think ▾   web?  project?              mic     send/stop ]
//
// The `+` menu, the Think control and the microphone all reflect what this
// server and this account can actually do: an action with nothing behind it is
// shown disabled with the reason, never hidden and never left looking live.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  Check,
  FolderKanban,
  Globe,
  ImagePlus,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useSettingsStore } from "@/lib/settings/store";
import { composerPlaceholder } from "./composer-placeholder";

export type ThinkMode = "fast" | "balanced" | "deep";

export type ComposerAttachment = {
  name: string;
  mediaType: string;
  base64: string;
  previewUrl?: string;
};

type Project = { id: string; name: string };

export type VoiceState = "idle" | "listening" | "transcribing";

const THINK_ICON: Record<ThinkMode, typeof Zap> = {
  fast: Zap,
  balanced: Brain,
  deep: Sparkles,
};

const THINK_LABEL: Record<ThinkMode, string> = {
  fast: "Fast",
  balanced: "Balanced",
  deep: "Deep think",
};

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
  autoFocus?: boolean;
}) {
  const { settings, meta } = useSettingsStore();

  const [menu, setMenu] = useState<null | "add" | "projects" | "think">(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dropping, setDropping] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming;
  const sendOnEnter = settings.conversation.sendKey === "enter";

  // Capability flags, read from the server rather than assumed.
  const features = meta?.features ?? {};
  const uploadsOn = features.fileUploads !== false;
  const imagesOn = features.imageAnalysis !== false;
  const webSearchOn = features.webSearch !== false && settings.ai.webSearch;
  const projectsOn = features.projects !== false;
  const generationOn = features.imageGeneration === true;
  const thinkModes = meta?.thinkModes ?? null;

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Grow with the content instead of scrolling inside one line, capped so a
  // long paste does not swallow the conversation.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
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

  /* ---- Paste and drop -------------------------------------------------- */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files);
      if (files.length === 0) return;
      // A screenshot pasted into the composer should attach, not paste its
      // filename as text.
      e.preventDefault();
      onAttach(files);
    },
    [onAttach]
  );

  // Depth-counted: dragging over a child fires dragleave on the parent, so a
  // naive boolean flickers the highlight off mid-drag.
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

  const ThinkIcon = THINK_ICON[thinkMode];
  const listening = voiceState === "listening";
  const transcribing = voiceState === "transcribing";

  return (
    <div className="mx-auto w-full max-w-3xl" ref={rootRef}>
      {/* ---- Attachment and context chips ---- */}
      {(attachments.length > 0 || selectedProject || webSearchEnabled) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
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

      {/* ---- Voice banner ---- */}
      {(listening || transcribing) && (
        <div className="mb-2 flex items-center gap-2.5 rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm">
          <span className="av-bars text-accent" aria-hidden>
            <span /><span /><span />
          </span>
          <span className={transcribing ? "av-thinking" : ""}>
            {transcribing ? "Transcribing…" : "Listening…"}
          </span>
          {interimTranscript && (
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
              {interimTranscript}
            </span>
          )}
          <button
            type="button"
            onClick={onCancelVoice}
            className="av-btn av-btn--ghost ml-auto h-7 px-2 text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ---- The composer ---- */}
      <div
        className="av-composer px-2.5 pb-2 pt-2.5"
        data-dropping={dropping}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={onDrop}
      >
        <label className="sr-only" htmlFor="composer-input">
          Message Aviel
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            dropping ? "Drop files to attach" : composerPlaceholder(settings)
          }
          className="max-h-[240px] overflow-y-auto px-1.5 py-1"
        />

        <div className="mt-1.5 flex items-center gap-1">
          {/* ---- + menu ---- */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === "add" || menu === "projects" ? null : "add")}
              aria-label="Add attachment or action"
              aria-expanded={menu === "add" || menu === "projects"}
              aria-haspopup="menu"
              className="av-btn av-btn--ghost av-btn--round"
            >
              <Plus
                size={18}
                className="transition-transform duration-200"
                style={{ transform: menu === "add" ? "rotate(45deg)" : undefined }}
              />
            </button>

            {menu === "add" && (
              <div className="av-menu absolute bottom-full left-0 z-30 mb-2" role="menu">
                <MenuItem
                  icon={Paperclip}
                  onClick={() => { fileRef.current?.click(); setMenu(null); }}
                  disabled={!uploadsOn}
                  reason={!uploadsOn ? "Uploads are turned off for this server." : undefined}
                >
                  Upload a file
                </MenuItem>

                <MenuItem
                  icon={ImagePlus}
                  onClick={() => { imageRef.current?.click(); setMenu(null); }}
                  disabled={!uploadsOn || !imagesOn}
                  reason={
                    !imagesOn
                      ? "Image analysis is turned off, so an image would be stored but not read."
                      : undefined
                  }
                >
                  Upload an image
                </MenuItem>

                {webSearchOn && (
                  <MenuItem
                    icon={Globe}
                    onClick={() => { onToggleWebSearch(); setMenu(null); }}
                    trailing={webSearchEnabled ? <Check size={14} className="text-accent" /> : undefined}
                  >
                    Search the web
                  </MenuItem>
                )}

                {showProjectPicker && projectsOn && (
                  <MenuItem icon={FolderKanban} onClick={() => setMenu("projects")}>
                    Add to a project
                  </MenuItem>
                )}

                {/* Shown only when a provider exists. Nothing generates images
                    on this server, so listing it would be a dead entry. */}
                {generationOn && (
                  <MenuItem icon={Sparkles} onClick={() => setMenu(null)}>
                    Generate an image
                  </MenuItem>
                )}

                <div className="av-menu-sep" />
                <p className="px-2.5 pb-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  You can also paste an image, or drop files onto the composer.
                </p>
              </div>
            )}

            {menu === "projects" && (
              <div className="av-menu absolute bottom-full left-0 z-30 mb-2" role="menu">
                <p className="av-menu-label">Add to a project</p>
                <MenuItem
                  icon={X}
                  onClick={() => { onSelectProject(null); setMenu(null); }}
                >
                  No project
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    icon={FolderKanban}
                    onClick={() => { onSelectProject(p); setMenu(null); }}
                    trailing={
                      selectedProject?.id === p.id ? <Check size={14} className="text-accent" /> : undefined
                    }
                  >
                    {p.name}
                  </MenuItem>
                ))}
                {projects.length === 0 && (
                  <p className="px-2.5 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    No projects yet. Create one from the sidebar to give Aviel a
                    workspace.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ---- Think ---- */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === "think" ? null : "think")}
              aria-label={`Thinking mode: ${THINK_LABEL[thinkMode]}`}
              aria-expanded={menu === "think"}
              aria-haspopup="menu"
              className={`av-btn h-8 px-2.5 text-[13px] ${
                thinkMode === "balanced" ? "av-btn--ghost" : "av-btn--default"
              }`}
            >
              <ThinkIcon size={14} />
              <span className="hidden sm:inline">{THINK_LABEL[thinkMode]}</span>
            </button>

            {menu === "think" && (
              <div className="av-menu absolute bottom-full left-0 z-30 mb-2 w-72" role="menu">
                <p className="av-menu-label">How much thought</p>
                {(["fast", "balanced", "deep"] as const).map((mode) => {
                  const Icon = THINK_ICON[mode];
                  // The note comes from the server, computed for this account,
                  // so Deep says plainly when no reasoning tier is answering.
                  const note = thinkModes?.find((m) => m.mode === mode)?.note;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={thinkMode === mode}
                      onClick={() => { onThinkModeChange(mode); setMenu(null); }}
                      className="av-menu-item items-start"
                    >
                      <Icon size={15} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {THINK_LABEL[mode]}
                          {thinkMode === mode && (
                            <Check size={13} className="text-accent" />
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
          </div>

          <div className="flex-1" />

          {/* ---- Microphone ---- */}
          {micSupported && settings.voice.dictationEnabled && (
            <button
              type="button"
              onClick={onToggleVoice}
              aria-label={listening ? "Stop listening" : "Dictate a message"}
              aria-pressed={listening}
              className={`av-btn av-btn--round ${
                listening ? "av-btn--default text-accent" : "av-btn--ghost"
              }`}
            >
              {listening ? (
                <span className="av-bars" aria-hidden>
                  <span /><span /><span />
                </span>
              ) : (
                <Mic size={17} />
              )}
            </button>
          )}

          {/* ---- Send / Stop ---- */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="av-btn av-btn--round bg-[var(--text-primary)] text-[var(--bg-primary)]"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              className={`av-btn av-btn--round ${
                canSend ? "av-btn--primary" : "av-btn--default"
              }`}
            >
              <ArrowUp size={17} />
            </button>
          )}
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
      </div>

      <p className="mt-2 text-center text-[11px] text-[var(--text-secondary)]">
        {sendOnEnter ? "Enter to send, Shift+Enter for a new line" : "Ctrl+Enter to send"}
        {" · "}
        Aviel can make mistakes. Check anything important.
      </p>
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
    <span className="flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 pl-2.5 pr-1.5 text-xs">
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
  /** Why it is unavailable. Shown under the label rather than as a tooltip. */
  reason?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="av-menu-item items-start"
    >
      <Icon size={15} className="mt-0.5" />
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
