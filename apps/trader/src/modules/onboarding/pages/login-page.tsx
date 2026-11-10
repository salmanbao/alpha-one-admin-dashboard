"use client";

/**
 * Trader Login — converted from stitch_screens/trader_login
 * Standalone login screen (renders without the app shell header).
 *
 * Validation uses the shared form-field library (`@pfaas/ui`) so the
 * trader, prop admin and platform admin all surface inline errors the
 * same way: validate on blur, re-validate on change once a field has
 * errored, validate everything on submit (audit U #8 / finding #1).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TerraCard } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";

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
  const { field, validateAll } = useFormValidation(validators);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll({ email, password })) return;
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
