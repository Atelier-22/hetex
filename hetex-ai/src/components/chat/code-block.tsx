"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  language,
  code,
}: {
  language?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (rare, e.g. insecure context) — fail silently
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between bg-black/[0.04] px-3 py-1.5 text-xs text-[var(--text-secondary)] dark:bg-white/[0.06]">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
