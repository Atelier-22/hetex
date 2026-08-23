"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * The hero input.
 *
 * It looks like the composer but never sends anything: a logged-out visitor
 * cannot chat, so typing or submitting routes to registration instead. Letting
 * someone write a real question and then discarding it at a login wall would
 * be worse than not offering the box at all — so the text they typed is carried
 * through as a query parameter for the app to pick up after sign-up.
 */
export function HeroPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go() {
    const q = value.trim();
    router.push(q ? `/register?prompt=${encodeURIComponent(q.slice(0, 300))}` : "/register");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="focus-within-accent flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-2 pl-4 pr-2 shadow-sm"
    >
      <label className="sr-only" htmlFor="hero-prompt">
        Ask Hetex AI anything
      </label>
      <input
        id="hero-prompt"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask Hetex AI anything"
        className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-[var(--text-secondary)] sm:text-base"
      />
      <button
        type="submit"
        aria-label="Continue to sign up"
        className="bg-accent-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
      >
        <ArrowUp size={16} />
      </button>
    </form>
  );
}
