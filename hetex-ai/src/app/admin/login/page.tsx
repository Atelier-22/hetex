"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { HetexIcon } from "@/components/logo";

/**
 * The admin area's own sign-in.
 *
 * Standalone by design: no sidebar, no chat session, nothing shared with the
 * product. If it fails it says why, rather than rendering a bare 404.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign-in failed");
        setLoading(false);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <HetexIcon size={48} priority />
          <h1 className="text-xl font-semibold">Hetex Admin</h1>
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <ShieldCheck size={12} />
            Restricted to administrators
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus-accent w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-base outline-none sm:text-sm"
          />

          <div className="relative">
            <input
              type={show ? "text" : "password"}
              placeholder="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-accent w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-2.5 pl-3 pr-10 text-base outline-none sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-hetex-red-500/30 bg-hetex-red-500/10 px-3 py-2 text-sm text-hetex-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-accent-gradient w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Checking…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          This is separate from your Hetex account sign-in.
        </p>
      </div>
    </div>
  );
}
