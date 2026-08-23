"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Square,
  Sparkles,
  Mic,
  MicOff,
  Trash2,
  RotateCcw,
  X,
  Globe,
  FileText,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { ComposerMenu } from "./composer-menu";
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
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition);
    setMicSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => {
    apiFetch<{ enterToSend?: boolean }>("/settings")
      .then((data) => setEnterToSend(data.enterToSend ?? true))
      .catch(() => {});
  }, []);

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
    router.push("/");
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

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center text-[var(--text-secondary)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-hetex-green-500 to-hetex-blue-500 text-white">
                <Sparkles size={22} />
              </span>
              <p className="text-lg font-medium text-[var(--text-primary)]">
                What can I help you with?
              </p>
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

      <div className="border-t border-[var(--border-subtle)] px-4 py-4 md:px-8">
        <div className="mx-auto max-w-3xl">
          {(pendingFiles.length > 0 || webSearchEnabled || selectedProject) && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {selectedProject && (
                <span className="flex items-center gap-1 rounded-full bg-hetex-green-100 px-2.5 py-1 text-xs text-hetex-green-800 dark:bg-white/10 dark:text-white">
                  in {selectedProject.name}
                </span>
              )}
              {webSearchEnabled && (
                <span className="flex items-center gap-1 rounded-full bg-hetex-blue-100 px-2.5 py-1 text-xs text-hetex-blue-800 dark:bg-white/10 dark:text-white">
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
            {micSupported && (
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (enterToSend && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message Hetex AI..."
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-sm outline-none focus:border-hetex-green-500"
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
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-hetex-green-500 to-hetex-blue-500 text-white disabled:opacity-40"
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
