"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Square,
  Mic,
  MicOff,
  Trash2,
  RotateCcw,
  X,
  Globe,
  FileText,
  ArrowDown,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { ComposerMenu } from "./composer-menu";
import { HetexIcon } from "../logo";
import { usePreferences } from "../preferences";
import { apiFetch, apiStream } from "@/lib/api-client";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date | string;
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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const { prefs } = usePreferences();
  const enterToSend = prefs.enterToSend;
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  // Only follow the stream while the user is already at the bottom. Scrolling
  // up to re-read something and being yanked back down on every token is the
  // single most irritating thing a chat UI can do.
  useEffect(() => {
    if (pinnedToBottom) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pinnedToBottom]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
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
    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition);
    setMicSupported(Boolean(SpeechRecognition));
  }, []);

  // Dictation is opt-out in settings, and only offered where the browser can
  // actually do it — Chrome and Edge have Web Speech recognition, Firefox
  // does not.
  const showMic = micSupported && prefs.dictationEnabled;

  function toggleListening() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function handleFilesSelected(fileList: FileList) {
    Array.from(fileList).forEach((file) => {
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

    try {
      const res = await apiStream(
        "/chat",
        {
          message: text,
          conversationId,
          projectId: !conversationId ? selectedProject?.id : undefined,
          attachments: files.map((f) => ({
            name: f.name,
            mediaType: f.mediaType,
            base64: f.base64,
          })),
          webSearchEnabled: useWebSearch,
        },
        controller.signal
      );

      if (!res.body) throw new Error("No response stream from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConversationId: string | undefined;

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

          if (eventType === "meta" && data.conversationId && !conversationId) {
            newConversationId = data.conversationId;
          } else if (eventType === "chunk") {
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

  async function sendMessage() {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || isStreaming) return;

    setError(null);
    setLastFailedMessage(null);
    setInput("");
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
      prev.map((m) =>
        m.id === assistantMessageId ? { ...m, content: "" } : m
      )
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
        await apiFetch(`/conversations/${conversationId}`, {
          method: "DELETE",
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not delete the conversation"
        );
        return;
      }
    }

    setMessages([]);
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5 md:px-8">
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          {messages.length > 0 ? `${messages.length} messages` : "New chat"}
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center text-[var(--text-secondary)]">
              <HetexIcon size={80} priority />
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
                    className="hover:border-accent rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors"
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
              timestamp={m.createdAt}
              conversationId={conversationId}
              isStreaming={
                isStreaming && m.id === messages[messages.length - 1]?.id
              }
              onRetry={
                m.role === "assistant" ? () => regenerateResponse(m.id) : undefined
              }
            />
          ))}
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-hetex-red-500/30 bg-hetex-red-500/10 px-4 py-2.5 text-sm text-hetex-red-500">
              <span>{error}</span>
              {lastFailedMessage && (
                <button
                  onClick={retryLastMessage}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-hetex-red-500/40 px-2 py-1 text-xs hover:bg-hetex-red-500/10"
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
            className="absolute -top-11 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-md hover:text-[var(--text-primary)]"
          >
            <ArrowDown size={13} /> Jump to latest
          </button>
        )}
        <div className="mx-auto max-w-3xl">
          {(pendingFiles.length > 0 || webSearchEnabled || selectedProject) && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {selectedProject && (
                <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs">
                  in {selectedProject.name}
                </span>
              )}
              {webSearchEnabled && (
                <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs">
                  <Globe size={11} /> Web search on
                </span>
              )}
              {pendingFiles.map((f) => (
                <span
                  key={f.name}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 pl-1 pr-2 text-xs"
                >
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.previewUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <FileText size={13} className="text-[var(--text-secondary)]" />
                  )}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button
                    onClick={() => removeFile(f.name)}
                    aria-label="Remove attachment"
                  >
                    <X size={12} className="text-[var(--text-secondary)]" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <ComposerMenu
              onFilesSelected={handleFilesSelected}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              showProjectPicker={!conversationId}
            />
            {showMic && (
              <button
                onClick={toggleListening}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                  isListening
                    ? "border-hetex-red-500 text-hetex-red-500"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                }`}
                aria-label={isListening ? "Stop listening" : "Voice input"}
                title={isListening ? "Listening… click to stop" : "Speak your message"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (enterToSend && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                enterToSend
                  ? "Message Hetex AI…  (Enter to send, Shift+Enter for a new line)"
                  : "Message Hetex AI…"
              }
              rows={1}
              className="max-h-[200px] flex-1 resize-none overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-sm outline-none focus-accent"
            />
            {isStreaming ? (
              <button
                onClick={stopGeneration}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]"
                aria-label="Stop generating"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() && pendingFiles.length === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-gradient text-white disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
