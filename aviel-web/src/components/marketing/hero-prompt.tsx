"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Plus } from "lucide-react";

const EXAMPLES = [
  "Explain a concept I'm stuck on",
  "Help me draft a message",
  "Review this code and find the bug",
  "Plan a project step by step",
];

/**
 * The hero input.
 *
 * It looks like the composer but never sends anything — a logged-out visitor
 * cannot chat, so anything typed is carried through to registration rather than
 * discarded at a login wall.
 *
 * The microphone is real: it dictates into this box using the browser's own
 * speech recognition. A decorative mic here would be the same defect as the
 * fake search box that used to sit in the sidebar.
 */
export function HeroPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [example, setExample] = useState(0);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMicSupported(
      Boolean(
        (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
      )
    );
  }, []);

  // Cycle the placeholder so the box suggests what it is for, rather than
  // sitting empty and asking the visitor to invent something.
  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, [value]);

  function go() {
    const q = value.trim();
    router.push(
      q ? `/register?prompt=${encodeURIComponent(q.slice(0, 300))}` : "/register"
    );
  }

  function toggleMic() {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const said = e.results[0][0].transcript;
      setValue((prev) => (prev ? `${prev} ${said}` : said));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="focus-within-accent flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-2 pl-2 pr-2 shadow-sm sm:gap-2 sm:pl-3"
    >
      <button
        type="button"
        onClick={() => router.push("/register")}
        aria-label="Sign up to attach files"
        title="Attach files — sign up to use"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-black/5 sm:flex dark:hover:bg-white/10"
      >
        <Plus size={18} />
      </button>

      <label className="sr-only" htmlFor="hero-prompt">
        Ask Aviel AI anything
      </label>
      <input
        id="hero-prompt"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={EXAMPLES[example]}
        // 16px: below that, iOS Safari zooms the page in on focus.
        className="w-full min-w-0 bg-transparent px-2 py-2 text-base outline-none placeholder:text-[var(--text-secondary)]"
      />

      {micSupported && (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Stop dictating" : "Dictate"}
          title={listening ? "Listening…" : "Speak instead of typing"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            listening
              ? "animate-pulse text-aviel-red-500"
              : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
      )}

      <button
        type="submit"
        aria-label="Continue"
        className="bg-accent-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
      >
        <ArrowUp size={17} />
      </button>
    </form>
  );
}
