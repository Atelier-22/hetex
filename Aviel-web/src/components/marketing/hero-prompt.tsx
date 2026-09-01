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
      // The same glass shell as the signed-in composer, so the landing page is
      // showing the real thing rather than a lookalike. It cannot send — a
      // logged-out visitor has nowhere to send to — so the primary button
      // carries the visitor and their text through to registration.
      className="hx-composer"
    >
      <label className="sr-only" htmlFor="hero-prompt">
        Ask Aviel anything
      </label>
      <textarea
        id="hero-prompt"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            go();
          }
        }}
        placeholder={EXAMPLES[example]}
        className="hx-composer-field"
      />

      <div className="hx-rail hx-rail--left">
        <button
          type="button"
          onClick={() => router.push("/register")}
          aria-label="Sign up to attach files"
          title="Attach files — sign up to use"
          className="hx-icon-btn hx-icon-btn--plus"
        >
          <Plus size={19} />
        </button>
      </div>

      <div className="hx-rail hx-rail--right">
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Stop dictating" : "Dictate"}
            aria-pressed={listening}
            className="hx-icon-btn"
          >
            {listening ? <MicOff size={19} strokeWidth={1.75} /> : <Mic size={19} strokeWidth={1.75} />}
          </button>
        )}

        <button type="submit" aria-label="Continue" className="hx-action">
          <ArrowUp size={20} strokeWidth={2.4} />
        </button>
      </div>
    </form>
  );
}
