"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  RotateCcw,
  Volume2,
  Square,
} from "lucide-react";

type Feedback = "up" | "down" | null;

export function MessageActions({
  content,
  onRetry,
  messageId,
  conversationId,
}: {
  content: string;
  onRetry?: () => void;
  messageId?: string;
  conversationId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setTtsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  async function handleFeedback(value: "up" | "down") {
    const next = feedback === value ? null : value;
    setFeedback(next);
    if (!next || !messageId) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, conversationId, rating: next }),
      });
    } catch {
      // best-effort — feedback UI already reflects the choice locally
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: content });
      } catch {
        // user cancelled the share sheet — no error needed
      }
    } else {
      await handleCopy();
    }
  }

  function handleReadAloud() {
    if (!ttsSupported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  const btn =
    "flex items-center gap-1 rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/10";

  return (
    <div className="mt-1 flex items-center gap-0.5">
      <button onClick={handleCopy} title="Copy" className={btn}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      <button
        onClick={() => handleFeedback("up")}
        title="Good response"
        className={`${btn} ${feedback === "up" ? "text-hetex-green-500" : ""}`}
      >
        <ThumbsUp size={14} />
      </button>

      <button
        onClick={() => handleFeedback("down")}
        title="Bad response"
        className={`${btn} ${feedback === "down" ? "text-hetex-red-500" : ""}`}
      >
        <ThumbsDown size={14} />
      </button>

      {ttsSupported && (
        <button
          onClick={handleReadAloud}
          title={speaking ? "Stop reading" : "Read aloud"}
          className={btn}
        >
          {speaking ? <Square size={14} /> : <Volume2 size={14} />}
        </button>
      )}

      <button onClick={handleShare} title="Share" className={btn}>
        <Share2 size={14} />
      </button>

      {onRetry && (
        <button onClick={onRetry} title="Try again" className={btn}>
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}
