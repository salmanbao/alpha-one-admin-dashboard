"use client";

/**
 * Account Locked / Suspended — audit finding (missing screen).
 *
 * Informs the trader that their account has been restricted, why,
 * for how long, and the exact steps to regain access. Mirrors the
 * AccountBreachPage pattern: a prominent status card, plain-language
 * explanation, a numbered action list, and support fallback with a
 * case reference for faster resolution.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { accountLock } from "@/lib/fixtures/terra-fixtures";

export function AccountLockedPage() {
  const lock = accountLock;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Restricted"
        description={`${lock.challenge} • Account #${lock.login}`}
        actions={
          <TerraBadge tone="error" dot>
            Locked
          </TerraBadge>
        }
      />

      {/* Why — plain-language explanation */}
      <TerraCard className="border border-error/30 bg-error-container/40">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-error-container">
              Your account has been temporarily restricted
            </p>
            <p className="text-sm text-on-error-container/80">
              This is a security measure. Your funds and open positions are safe — you
              simply can't trade until the restriction is lifted.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-on-error-container/70">
          Why this happened
        </p>
        <ul className="mt-2 space-y-2">
          {lock.reasons.map((r) => (
            <li
              key={r}
              className="flex items-start gap-2 rounded-xl bg-surface-container-lowest/70 px-3 py-2.5 text-sm text-on-surface"
            >
              <span className="mt-0.5 font-bold text-error">✕</span>
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-on-error-container/80">
          <span>
            <strong>Duration:</strong> {lock.duration}
          </span>
          <span>
            <strong>Applied:</strong> {lock.lockedAt}
          </span>
          <span>
            <strong>Case:</strong> {lock.caseRef}
          </span>
        </div>
      </TerraCard>

      {/* What to do — numbered resolution steps */}
      <TerraCard>
        <TerraSectionTitle title="How to regain access" />
        <ol className="mt-4 space-y-4">
          {lock.steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                {i + 1}
              </span>
              <div className="flex flex-col">
                {s.href ? (
                  <Link
                    href={s.href}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    {s.title}
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-on-surface">{s.title}</span>
                )}
                <span className="text-xs text-on-surface-variant">{s.note}</span>
              </div>
            </li>
          ))}
        </ol>
      </TerraCard>

      {/* Appeal + support fallback */}
      <TerraCard className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">
            {lock.appealAvailable ? "Think this is a mistake?" : "Need help?"}
          </p>
          <p className="text-xs text-on-surface-variant">
            {lock.appealAvailable
              ? "You can appeal this restriction — reference your case number below."
              : "Our support team can help you resolve this faster."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/help-center"
            className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
          >
            Contact Support
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            Back to Dashboard
          </Link>
        </div>
      </TerraCard>
    </div>
  );
}
