"use client";

/**
 * Trader Login — converted from stitch_screens/trader_login
 * Standalone login screen (renders without the app shell header).
 *
 * Validation uses the shared form-field library (`@pfaas/ui`) so the
 * trader, prop admin and platform admin all surface inline errors the
 * same way: validate on blur, re-validate on change once a field has
 * errored, validate everything on submit (audit U #8 / finding #1).
 *
 * R4-01: login validates against the session store and writes the
 * active session on success. Unknown credentials fall through to
 * "continue as demo".
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TerraCard } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";
import { verifyPassword, continueAsDemo, findAccountByEmail, writeSession, recordLogin } from "@/lib/session-store";
import type { ActiveSession } from "@/lib/session-store";

// Canonical field validators — one rule, one message, shared by blur,
// change and submit so the same input always produces the same copy.
const validators = {
  email: (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
    return "";
  },
  password: (v: string) =>
    !v || v.length < 6 ? "Password must be at least 6 characters." : "",
};

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("tom.allen@terra.trader");
  const [password, setPassword] = useState("••••••••");
  const [loading, setLoading] = useState(false);
  // R4-01 AC #4 — invalid credentials surface as an inline error (role=
  // "alert"), never a blocking alert().
  const [loginError, setLoginError] = useState("");
  const { field, validateAll } = useFormValidation(validators);

  // Session-expiry sign-out hands the return path along as `?next=`
  // (audit B #4) — land the user back where they were rather than always
  // on the dashboard. Same-app absolute paths only: a protocol-relative
  // `//host` or an absolute URL is never followed.
  function resolveRedirect(): string {
    const returnTo = searchParams.get("next");
    return returnTo &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.startsWith("/login")
      ? returnTo
      : "/dashboard";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll({ email, password })) return;
    setLoginError("");
    setLoading(true);

    // Check if credentials match a registered account
    const account = findAccountByEmail(email);

    if (account && verifyPassword(password, account.password)) {
      // Valid credentials — write active session and redirect
      const newSession: ActiveSession = {
        accountId: account.id,
        email: account.email,
        displayName: account.displayName,
        isDemo: false,
        loginAt: new Date().toISOString(),
      };
      writeSession(newSession);
      // R5 Wave 0.5 — the sessions page reads this history.
      recordLogin(true);
      setTimeout(() => router.push(resolveRedirect()), 600);
    } else {
      // Unknown credentials — inline error + "continue as demo" path.
      setLoading(false);
      recordLogin(false);
      setLoginError(
        `We couldn't sign you in as ${email}. Check your email and password, or continue as demo.`,
      );
    }
  }

  // R4-01 AC #4 — the demo fallback writes the Tom Allen session
  // (honestly labeled `isDemo`) and lands on the same target.
  function handleContinueDemo() {
    setLoginError("");
    setLoading(true);
    continueAsDemo();
    recordLogin(true);
    setTimeout(() => router.push(resolveRedirect()), 400);
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
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              id="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              {...field("email", email, setEmail)}
              placeholder="you@example.com"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              {...field("password", password, setPassword)}
              labelSuffix={
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot?
                </Link>
              }
            />
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              <input type="checkbox" defaultChecked className="accent-primary" />
              Keep me signed in for 30 days
            </label>
            {loginError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </TerraCard>

        {/* R4-01 AC #4 — "continue as demo" path (Tom Allen persona,
            honestly labeled) — always available on the login screen. */}
        <button
          type="button"
          onClick={handleContinueDemo}
          disabled={loading}
          className="w-full rounded-xl border border-border bg-surface-container-low py-3 text-sm font-bold text-on-surface transition-all hover:bg-surface-container disabled:opacity-60"
        >
          Continue as demo (Tom Allen, demo)
        </button>

        <p className="text-center text-xs text-on-surface-variant">
          New to TerraTrader?{" "}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-center text-xs text-on-surface-variant">
          Account restricted?{" "}
          <Link href="/account-locked" className="font-bold text-primary hover:underline">
            View unlock steps
          </Link>
        </p>
      </div>
    </div>
  );
}
