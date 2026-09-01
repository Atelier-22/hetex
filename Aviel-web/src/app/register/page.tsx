"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AvielLockup } from "@/components/logo";
import { API_BASE_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Independent per field: revealing one should not reveal the other, or
  // confirming the password stops proving anything.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmError(null);

    // Checked before the request so a mismatch costs nothing and the account
    // is never created with a password the user did not mean to type.
    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match");
      return;
    }

    setLoading(true);

    // Registration goes straight to the Aviel API. The sign-in that follows
    // goes through NextAuth so the browser ends up with a session cookie
    // rather than a token sitting in JavaScript.
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (signInRes?.error) {
      router.push("/login");
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <AvielLockup height={46} align="center" priority />
          <h1 className="text-xl font-semibold">Create your Aviel AI account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm outline-none focus-accent"
          />
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm outline-none focus-accent"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min. 8 characters)"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-2.5 pl-3 pr-10 text-sm outline-none focus-accent"
            />
            <button
              // type="button": a bare button inside a form submits it, which
              // would fire registration on every reveal.
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmError) setConfirmError(null);
                }}
                aria-invalid={Boolean(confirmError)}
                aria-describedby={confirmError ? "confirm-error" : undefined}
                className={`w-full rounded-lg border bg-[var(--bg-secondary)] py-2.5 pl-3 pr-10 text-sm outline-none focus-accent ${
                  confirmError
                    ? "border-Aviel-red-500"
                    : "border-[var(--border-subtle)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm ? "Hide confirmed password" : "Show confirmed password"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmError && (
              <p id="confirm-error" className="mt-1.5 text-xs text-Aviel-red-500">
                {confirmError}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-Aviel-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-gradient py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
