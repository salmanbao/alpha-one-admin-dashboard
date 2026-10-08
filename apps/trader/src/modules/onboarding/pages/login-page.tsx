"use client";

/**
 * Trader Login — converted from stitch_screens/trader_login
 * Standalone login screen (renders without the app shell header).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TerraCard } from "@/components/terra/terra-ui";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("tom.allen@terra.trader");
  const [password, setPassword] = useState("••••••••");
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 600);
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
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
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
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
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
