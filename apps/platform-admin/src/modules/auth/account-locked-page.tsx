"use client";

/**
 * Account Locked / Suspended — operator restricted state (audit D #4).
 *
 * The authentication & session flow previously had no failure branch for
 * a locked or suspended operator: sign-in just failed and the operator
 * was left guessing. This screen explains why the restriction exists,
 * how long it lasts, when access is restored, the exact steps to resolve
 * it, and how to appeal if the restriction is wrong.
 *
 * Deterministic: fixed fixture strings — no Math.random(), no Date.now().
 * Rendered from two places:
 *   • `/account-locked` — direct route (inside the authenticated shell)
 *   • ConsoleLogin — an operator signing in with the restricted demo
 *     account (LOCKED_OPERATOR_EMAIL) lands here instead of the 2FA step
 */

import Link from "next/link";
import { ShieldAlert, Clock, ListChecks, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Demo credentials that trigger the restricted state in ConsoleLogin. */
export const LOCKED_OPERATOR_EMAIL = "locked@pfaas.io";

/** Why the account is locked, for how long, and how to resolve it. */
export const operatorLock = {
  email: LOCKED_OPERATOR_EMAIL,
  role: "Platform operator · Support Admin",
  reasons: [
    "Five failed sign-in attempts from an unrecognized device",
    "A write-scoped API key was used from a new region moments later",
  ],
  duration: "24 hours from the time of the restriction",
  lockedAt: "Nov 5, 2026 · 03:12 UTC",
  restoresAt: "Nov 6, 2026 · 03:12 UTC",
  autoRestore: true,
  steps: [
    {
      title: "Complete the identity check",
      note: "Confirm the activity prompt sent to your registered email — it expires in 24 hours.",
    },
    {
      title: "Reset your password",
      note: "Rotate your credentials from a trusted device before signing in again.",
    },
    {
      title: "Review active sessions",
      note: "Sign out every device you don't recognize from the session list.",
    },
    {
      title: "Contact Platform Security",
      note: "Reference your case number below for a faster resolution.",
    },
  ],
  appealAvailable: true,
  caseRef: "CASE-2026-1142",
  supportEmail: "security@pfaas.io",
};

const supportHref = `mailto:${operatorLock.supportEmail}?${new URLSearchParams({
  subject: `Account restriction appeal — ${operatorLock.caseRef}`,
  body: [
    `Operator: ${operatorLock.email}`,
    `Case: ${operatorLock.caseRef}`,
    `Restricted at: ${operatorLock.lockedAt}`,
    "",
    "Describe why this restriction is a mistake:",
  ].join("\n"),
})}`;

export function AccountLockedPage({ onBack }: { onBack?: () => void }) {
  const lock = operatorLock;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Header — status at a glance */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Account restricted
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lock.email} · {lock.role}
            </p>
          </div>
        </div>
        <Badge variant="destructive">Locked</Badge>
      </div>

      {/* Why + when — plain-language explanation with restore time */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-destructive">
            Why this happened
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is a security measure. Your data and configuration are untouched —
            you simply can&apos;t access the console until the restriction is lifted.
          </p>
          <ul className="space-y-2">
            {lock.reasons.map((r) => (
              <li
                key={r}
                className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span className="mt-0.5 font-semibold text-destructive">✕</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 rounded-lg border bg-background p-3 text-xs sm:grid-cols-2">
            <p>
              <span className="font-semibold text-foreground">Duration:</span>{" "}
              <span className="text-muted-foreground">{lock.duration}</span>
            </p>
            <p>
              <span className="font-semibold text-foreground">Applied:</span>{" "}
              <span className="text-muted-foreground">{lock.lockedAt}</span>
            </p>
            <p className="sm:col-span-2">
              <span className="font-semibold text-foreground">Access restored:</span>{" "}
              <span className="text-muted-foreground">
                {lock.autoRestore
                  ? `Automatically on ${lock.restoresAt} — or sooner if Platform Security clears the review.`
                  : lock.restoresAt}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Steps to resolve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4" /> How to regain access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {lock.steps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Appeal + actions */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <LifeBuoy className="h-4 w-4" /> Think this is a mistake?
            </p>
            <p className="text-xs text-muted-foreground">
              Appeal with case <span className="font-mono">{lock.caseRef}</span> —
              misidentifications are cleared in under 4 hours.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={supportHref}>
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Contact security
              </a>
            </Button>
            {onBack ? (
              <Button size="sm" onClick={onBack}>
                Back to sign-in
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">Back to sign-in</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
