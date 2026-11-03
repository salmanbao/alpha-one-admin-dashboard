"use client";

/**
 * Trader Login — converted from stitch_screens/trader_login
 * Standalone login screen (renders without the app shell header).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TerraCard } from "@/components/terra/terra-ui";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("tom.allen@terra.trader");
  const [password, setPassword] = useState("••••••••");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Canonical field validators — shared by blur, change and submit so the
  // same rule always produces the same message (audit U #8).
  const emailError = (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
    return "";
  };
  const passwordError = (v: string) =>
    !v || v.length < 6 ? "Password must be at least 6 characters." : "";

  // Canonical validation timing (audit U #8): validate on blur for
  // real-time feedback, keep re-validating on change once a field has
  // errored, and validate everything on submit. Messages are announced
  // with role="alert" and linked via aria-describedby.
  const onEmailChange = (v: string) => {
    setEmail(v);
    setErrors((prev) => ("email" in prev ? { ...prev, email: emailError(v) } : prev));
  };
  const onPasswordChange = (v: string) => {
    setPassword(v);
    setErrors((prev) => ("password" in prev ? { ...prev, password: passwordError(v) } : prev));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = { email: emailError(email), password: passwordError(password) };
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    // Session-expiry sign-out hands the return path along as `?next=`
    // (audit B #4) — land the user back where they were rather than always
    // on the dashboard. Same-app absolute paths only: a protocol-relative
    // `//host` or an absolute URL is never followed.
    const returnTo = searchParams.get("next");
    const target =
      returnTo &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.startsWith("/login")
        ? returnTo
        : "/dashboard";
    setTimeout(() => router.push(target), 600);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-headline text-lg font-bold text-on-primary">
            TT
          </span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">TerraTrader</h1>
          <p className="text-sm text-on-surface-variant">
            Sign in to your trading workspace
          </p>
        </div>

        <TerraCard className="p-7">
          <form onSubmit={submit} className="space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onBlur={() => setErrors((prev) => ({ ...prev, email: emailError(email) }))}
                aria-invalid={!!errors.email}
                aria-describedby="email-error"
                className={`rounded-lg border bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary ${errors.email ? "border-error" : "border-outline-variant"}`}
              />
              {errors.email ? (
                <p id="email-error" role="alert" className="text-xs text-error">
                  {errors.email}
                </p>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Password
                <Link href="/help-center" className="font-semibold normal-case text-primary hover:underline">
                  Forgot?
                </Link>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                onBlur={() => setErrors((prev) => ({ ...prev, password: passwordError(password) }))}
                aria-invalid={!!errors.password}
                aria-describedby="password-error"
                className={`rounded-lg border bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary ${errors.password ? "border-error" : "border-outline-variant"}`}
              />
              {errors.password ? (
                <p id="password-error" role="alert" className="text-xs text-error">
                  {errors.password}
                </p>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              <input type="checkbox" defaultChecked className="accent-primary" />
              Keep me signed in for 30 days
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </TerraCard>

        <p className="text-center text-xs text-on-surface-variant">
          New to TerraTrader?{" "}
          <Link href="/marketplace" className="font-bold text-primary hover:underline">
            Start a challenge
          </Link>
        </p>
      </div>
    </div>
  );
}
