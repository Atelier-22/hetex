"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  BrainCircuit,
  Cloud,
  FileText,
  Globe,
  HardDrive,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { Composer, type ThinkMode } from "./composer";
import { LiveVoicePanel } from "./live-voice-panel";
import { AvielIcon } from "../logo";
import { useSettingsStore } from "@/lib/settings/store";
import { apiFetch, apiStream } from "@/lib/api-client";
import {
  getSpeechRecognition,
  haptic,
  playCue,
  recognitionLanguage,
  speak,
  stopSpeaking,
  useSpeechVoices,
  type SpeechRecognitionLike,
} from "@/lib/speech";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date | string;
  /** Filled from the stream's meta event, when the setting asks for it. */
  model?: string;
  processedLocally?: boolean;
  routed?: boolean;
  routingReason?: string;
};

type PendingFile = {
  name: string;
  mediaType: string;
  base64: string;
  previewUrl?: string;
};

type Project = { id: string; name: string };

const SUGGESTIONS = [
  "Explain a concept I'm stuck on",
  "Help me draft an email",
  "Review this code and find bugs",
  "Plan a project step by step",
];

export function ChatWindow({
  conversationId,
  initialMessages = [],
}: {
  conversationId?: string;
  initialMessages?: Message[];
}) {
  const router = useRouter();
  const { settings, meta } = useSettingsStore();
  const { voices } = useSpeechVoices();

  const conv = settings.conversation;
  const voice = settings.voice;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micSupported, setMicSupported] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [excludeFromMemory, setExcludeFromMemory] = useState(false);
  const [turnMeta, setTurnMeta] = useState<{
    model?: string;
    processedLocally?: boolean;
  } | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  // Seeded from the account default, then overridable per message from the
  // composer without changing the stored preference.
  const [thinkMode, setThinkMode] = useState<ThinkMode>(settings.ai.thinkMode);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Read by the streaming loop, which is started once and must see the current
  // value rather than the one captured when it began.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Only follow the stream while the user is already at the bottom. Scrolling
  // up to re-read something and being yanked back down on every token is the
  // single most irritating thing a chat UI can do.
  useEffect(() => {
    if (pinnedToBottom && conv.autoScroll) {
      scrollRef.current?.scrollIntoView({
        behavior: settings.appearance.animations === "off" ? "auto" : "smooth",
      });
    }
  }, [messages, pinnedToBottom, conv.autoScroll, settings.appearance.animations]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinnedToBottom(distanceFromBottom < 80);
  }

  // Grow the composer with its content instead of scrolling inside one line,
  // capped so a long paste doesn't swallow the conversation.
  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  useEffect(resizeTextarea, [input]);

  useEffect(() => {
    setMicSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  /**
   * Tell the user a reply landed while they were looking elsewhere.
   *
   * Gated on the setting and on an actual granted permission — the setting
   * cannot be true without one, but the permission can be revoked afterwards.
   */
  const notifyIfHidden = useCallback((text: string) => {
    const n = settingsRef.current.notifications;
    if (!n.desktopCompletion) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;

    if (n.quietHoursEnabled) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = n.quietHoursStart.split(":").map(Number);
      const [eh, em] = n.quietHoursEnd.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      // Quiet hours usually wrap midnight, so the two orderings differ.
      const quiet = start <= end
        ? minutes >= start && minutes < end
        : minutes >= start || minutes < end;
      if (quiet) return;
    }

    try {
      new Notification("Aviel AI", {
        body: text.slice(0, 140),
        silent: !n.sound,
      });
    } catch {
      // Blocked, or unsupported in this context.
    }
  }, []);

  // The mic is shown when the browser supports it and the account wants it.
  const showMic = micSupported && voice.dictationEnabled;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterim("");
  }, []);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const v = settingsRef.current.voice;
    const recognition = new Recognition();
    recognition.lang = recognitionLanguage(v);
    recognition.continuous = v.micMode === "continuous";
    recognition.interimResults = v.liveTranscription;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }

      setInterim(v.liveTranscription ? interimText : "");

      if (finalText) {
        setInput((prev) => (prev ? `${prev} ${finalText}` : finalText).trim());
        // Auto-submit only makes sense when the user has not asked to review
        // the transcript first; the two settings would otherwise contradict.
        if (v.autoSubmit && !v.editTranscript) {
          setTimeout(() => sendRef.current?.(), 60);
        }
      }
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => {
      setIsListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    playCue("start", v);
    haptic(v);
  }, [stopListening]);

  function toggleListening() {
    if (isListening) {
      stopListening();
      playCue("stop", voice);
      return;
    }
    startListening();
  }

  // Accepts a File[] as well as a FileList: a paste and a drop both hand over
  // a plain array, and only a file input gives a FileList.
  function handleFilesSelected(fileList: FileList | File[]) {
    const maxBytes = (meta?.limits?.maxUploadMb ?? 5) * 1_000_000;

    Array.from(fileList).forEach((file) => {
      if (file.size > maxBytes) {
        setError(
          `"${file.name}" is larger than the ${meta?.limits?.maxUploadMb ?? 5} MB limit.`
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        setPendingFiles((prev) => [
          ...prev,
          {
            name: file.name,
            mediaType: file.type || "application/octet-stream",
            base64,
            previewUrl: file.type.startsWith("image/") ? result : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(name: string) {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function streamReply(
    text: string,
    assistantId: string,
    files: PendingFile[] = [],
    useWebSearch = false
  ) {
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const body = {
      message: text,
      conversationId,
      projectId: !conversationId ? selectedProject?.id : undefined,
      attachments: files.map((f) => ({
        name: f.name,
        mediaType: f.mediaType,
        base64: f.base64,
      })),
      webSearchEnabled: useWebSearch,
      excludeFromMemory,
      // Per-message, so choosing Deep for one hard question does not change
      // the account's standing preference.
      thinkMode,
    };

    if (settingsRef.current.advanced.debugMode) {
      console.info("[Aviel] sending", { ...body, attachments: files.length });
    }

    try {
      // Non-streaming is a real setting, not a cosmetic one: without the
      // event-stream Accept header the server answers with one JSON body.
      if (!conv.streamResponses || !settingsRef.current.advanced.streaming) {
        const result = await apiFetch<{
          conversationId: string;
          reply: string;
          model?: string;
          processedLocally?: boolean;
          sources?: { title: string; url: string }[];
        }>("/chat", { method: "POST", body: JSON.stringify(body) });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.reply,
                  model: result.model,
                  processedLocally: result.processedLocally,
                }
              : m
          )
        );
        setTurnMeta({
          model: result.model,
          processedLocally: result.processedLocally,
        });
        if (result.sources?.length) setSources(result.sources);
        afterReply(result.reply);

        if (!conversationId && result.conversationId) {
          router.push(`/chat/${result.conversationId}`);
          router.refresh();
        }
        return;
      }

      const res = await apiStream("/chat", body, controller.signal);
      if (!res.body) throw new Error("No response stream from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConversationId: string | undefined;
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const eventLine = raw.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine.replace("event: ", "");
          const data = JSON.parse(dataLine.replace("data: ", ""));

          if (eventType === "meta") {
            if (data.conversationId && !conversationId) {
              newConversationId = data.conversationId;
            }
            setTurnMeta({
              model: data.model,
              processedLocally: data.processedLocally,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      model: data.model,
                      processedLocally: data.processedLocally,
                      routed: data.routed,
                      routingReason: data.routingReason,
                    }
                  : m
              )
            );
            if (settingsRef.current.advanced.debugMode) {
              console.info("[Aviel] turn meta", data);
            }
          } else if (eventType === "searching") {
            setSearching(true);
          } else if (eventType === "sources") {
            setSearching(false);
            setSources(data.sources ?? []);
          } else if (eventType === "chunk") {
            // The first token means searching is over, whether or not a
            // sources event arrives.
            setSearching(false);
            fullText += data.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.text }
                  : m
              )
            );
          } else if (eventType === "error") {
            setError(data.message);
            setLastFailedMessage(text);
          }
        }
      }

      afterReply(fullText);

      if (newConversationId) {
        router.push(`/chat/${newConversationId}`);
        router.refresh();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLastFailedMessage(text);
      }
    } finally {
      setIsStreaming(false);
    }
  }

  /** Everything that happens once a reply is complete. */
  function afterReply(text: string) {
    if (!text.trim()) return;

    notifyIfHidden(text);

    const v = settingsRef.current.voice;
    if (v.autoReadReplies) {
      speak(text, v, voices, undefined, settingsRef.current.language.voiceOutput);
    }

    // Continuous mode listens again for the next thing you say.
    if (v.micMode === "continuous" && isListening === false && showMic) {
      startListening();
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || isStreaming) return;

    // "Ask before analysing" is a privacy check, so it only asks when the image
    // would actually leave this machine — with local-only processing on, or
    // analysis off, there is nothing to warn about.
    const images = pendingFiles.filter((f) => f.mediaType.startsWith("image/"));
    if (
      images.length > 0 &&
      settings.images.askBeforeAnalyzing &&
      settings.images.analysisEnabled &&
      !settings.privacy.localOnly &&
      turnMeta?.processedLocally !== true
    ) {
      const ok = window.confirm(
        `${images.length === 1 ? "This image" : `These ${images.length} images`} will be sent to a hosted AI service to be read. Continue?`
      );
      if (!ok) return;
    }

    setError(null);
    setLastFailedMessage(null);
    setSources([]);
    setInput("");
    setInterim("");
    const filesToSend = pendingFiles;
    setPendingFiles([]);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content:
        text +
        (filesToSend.length > 0
          ? `${text ? "\n\n" : ""}[Attached: ${filesToSend
              .map((f) => f.name)
              .join(", ")}]`
          : ""),
      createdAt: new Date(),
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", createdAt: new Date() },
    ]);

    await streamReply(text, assistantId, filesToSend, webSearchEnabled);
  }

  // Held in a ref so speech recognition's callback can send without being
  // rebuilt on every keystroke.
  const sendRef = useRef<() => void>();
  sendRef.current = () => void sendMessage();

  async function retryLastMessage() {
    const text = lastFailedMessage;
    if (!text) return;
    setError(null);
    setLastFailedMessage(null);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", createdAt: new Date() },
    ]);
    await streamReply(text, assistantId);
  }

  async function regenerateResponse(assistantMessageId: string) {
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx <= 0) return;
    const priorUser = [...messages.slice(0, idx)]
      .reverse()
      .find((m) => m.role === "user");
    if (!priorUser) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === assistantMessageId ? { ...m, content: "" } : m))
    );
    await streamReply(priorUser.content, assistantMessageId);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  async function clearConversation() {
    if (!confirm("Delete this conversation? This can't be undone.")) return;

    // A conversation that was never sent has no id on the server yet, so there
    // is nothing to delete — just clear the screen.
    if (conversationId) {
      try {
        await apiFetch(`/conversations/${conversationId}`, { method: "DELETE" });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not delete the conversation"
        );
        return;
      }
    }

    setMessages([]);
    router.push("/chat");
    router.refresh();
  }

  const sendOnEnter = conv.sendKey === "enter";
  const showProcessing =
    settings.privacy.showProcessingLocation && turnMeta !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5 md:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {messages.length > 0 ? `${messages.length} messages` : "New chat"}
          </span>

          {conv.showUsage && messages.length > 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              ·{" "}
              {messages
                .reduce((n, m) => n + m.content.length, 0)
                .toLocaleString()}{" "}
              characters
            </span>
          )}

          {showProcessing && (
            <span
              className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
              title={
                turnMeta?.processedLocally
                  ? "Answered by a model running on the Aviel server. Nothing was sent to an external provider."
                  : "Answered by a hosted AI service. Your message was sent to it."
              }
            >
              {turnMeta?.processedLocally ? (
                <>
                  <HardDrive size={11} /> Processed locally
                </>
              ) : (
                <>
                  <Cloud size={11} /> Hosted
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {settings.memory.enabled && (
            <button
              onClick={() => setExcludeFromMemory((v) => !v)}
              aria-pressed={excludeFromMemory}
              title={
                excludeFromMemory
                  ? "Nothing from this conversation will be remembered"
                  : "Don't remember this conversation"
              }
              className={`focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                excludeFromMemory
                  ? "bg-accent-soft"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <BrainCircuit size={13} />
              {excludeFromMemory ? "Not remembered" : "Remember"}
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
      >
        <div className="chat-stack mx-auto flex max-w-3xl flex-col">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center text-[var(--text-secondary)]">
              <AvielIcon size={80} priority />
              <p className="text-lg font-medium text-[var(--text-primary)]">
                What can I help you with?
              </p>
              <div className="mt-3 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="hover:border-accent focus-ring rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              id={m.id}
              role={m.role}
              content={m.content}
              timestamp={conv.showTimestamps ? m.createdAt : undefined}
              conversationId={conversationId}
              model={conv.showModelUsed ? m.model : undefined}
              processedLocally={m.processedLocally}
              routingReason={
                settings.advanced.developerMode ? m.routingReason : undefined
              }
              showTypingIndicator={conv.showTypingIndicator}
              isStreaming={
                isStreaming && m.id === messages[messages.length - 1]?.id
              }
              onRetry={
                m.role === "assistant" ? () => regenerateResponse(m.id) : undefined
              }
            />
          ))}

          {searching && (
            <div className="flex items-center gap-2 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              <Globe size={12} className="animate-pulse" />
              Searching the web…
            </div>
          )}

          {sources.length > 0 && (
            <div className="self-start rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <Globe size={11} /> Sources
              </p>
              <ul className="flex flex-col gap-1">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent line-clamp-1 text-xs hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-aviel-red-500/30 bg-aviel-red-500/10 px-4 py-2.5 text-sm text-aviel-red-500"
            >
              <span>{error}</span>
              {lastFailedMessage && (
                <button
                  onClick={retryLastMessage}
                  className="focus-ring flex shrink-0 items-center gap-1 rounded-md border border-aviel-red-500/40 px-2 py-1 text-xs hover:bg-aviel-red-500/10"
                >
                  <RotateCcw size={12} /> Retry
                </button>
              )}
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="relative border-t border-[var(--border-subtle)] px-4 py-4 md:px-8">
        {!pinnedToBottom && messages.length > 0 && (
          <button
            onClick={() => {
              setPinnedToBottom(true);
              scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="av-btn av-btn--default absolute -top-11 left-1/2 h-8 -translate-x-1/2 px-3 text-xs shadow-[var(--e-2)]"
          >
            <ArrowDown size={13} /> Jump to latest
          </button>
        )}

        {liveVoiceOpen && (
          <div className="mx-auto w-full max-w-3xl">
            <LiveVoicePanel
              conversationId={conversationId}
              onClose={() => setLiveVoiceOpen(false)}
              onTurn={(turn) =>
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: turn.role,
                    content: turn.text,
                    createdAt: new Date(),
                  },
                ])
              }
            />
          </div>
        )}

        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void sendMessage()}
          onStop={stopGeneration}
          isStreaming={isStreaming}
          attachments={pendingFiles}
          onAttach={handleFilesSelected}
          onRemoveAttachment={removeFile}
          webSearchEnabled={webSearchEnabled}
          onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          showProjectPicker={!conversationId}
          voiceState={isListening ? "listening" : "idle"}
          onToggleVoice={toggleListening}
          interimTranscript={voice.showTranscript ? interim : ""}
          onCancelVoice={stopListening}
          micSupported={micSupported}
          thinkMode={thinkMode}
          onThinkModeChange={setThinkMode}
        />
      </div>
    </div>
  );
}
