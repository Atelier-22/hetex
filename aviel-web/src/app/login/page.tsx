"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AvielLockup } from "@/components/logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The idle timeout signs out with ?reason=idle so the return is explained
  // rather than looking like a session that dropped for no reason.
  useEffect(() => {
    if (params.get("reason") === "idle") {
      setNotice("You were signed out after a period of inactivity.");
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      ...(needsTotp ? { totpCode } : {}),
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      if (res.error.startsWith("TOTP_REQUIRED")) {
        // The password was right. Ask for the second factor rather than
        // reporting a credential failure, which would be untrue and confusing.
        const message = res.error.slice("TOTP_REQUIRED:".length);
        setNeedsTotp(true);
        setError(needsTotp ? message || "That code isn't right." : null);
        setTotpCode("");
        return;
      }
      setError("Invalid email or password");
      return;
    }

    router.push("/chat");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <AvielLockup width={200} priority />
          <h1 className="text-xl font-semibold">Welcome back to Aviel AI</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
              placeholder="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-2.5 pl-3 pr-10 text-sm outline-none focus-accent"
            />
            <button
              // type="button" matters: inside a form, a bare <button> defaults
              // to submit and would try to log in on every reveal.
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {needsTotp && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck size={15} className="text-accent" />
                Two-factor authentication
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Enter the six-digit code from your authenticator app, or one of
                your recovery codes.
              </p>
              <input
                autoFocus
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Authentication code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="focus-accent mt-2.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-center font-mono text-sm tracking-widest outline-none"
              />
            </div>
          )}

          {notice && (
            <p className="text-sm text-[var(--text-secondary)]">{notice}</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-aviel-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || (needsTotp && totpCode.trim().length < 6)}
            className="w-full rounded-lg bg-accent-gradient py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : needsTotp ? "Verify and sign in" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          No account?{" "}
          <Link href="/register" className="text-accent font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
