"use client";

/**
 * KYC Status Card — W1-02 (single KYC/payout status truth).
 *
 * Reads the verification lifecycle from @/lib/verification/verification-store
 * (sessionStorage, survives reload) instead of a fixture frozen at
 * "reviewing — submitted 2 days ago". A trader who never opened KYC now
 * sees "Not started" rather than a misleading "in review" card.
 *
 * The dashboard surface never drifts from the wizard: submitting on
 * /verification flips reviewStatus, and this card remounts on return to
 * the dashboard showing the same state.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraSectionTitle,
  type TerraTone,
} from "@/components/terra/terra-ui";
import {
  isVerificationSubmitted,
  readVerificationDraft,
  type VerificationReviewStatus,
} from "@/lib/verification/verification-store";
import { useLifecycleLog } from "@pfaas/lifecycle";

/** Days since a submission date ("2 days ago"). */
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const statusBadge = (status: VerificationReviewStatus) => {
  const conf: Record<
    VerificationReviewStatus,
    { tone: TerraTone; label: string; dot?: boolean; pulse?: boolean }
  > = {
    "not-started": { tone: "tertiary", label: "Not started" },
    draft: { tone: "primary", label: "In progress" },
    submitted: { tone: "tertiary", label: "Submitted" },
    "in-review": { tone: "tertiary", label: "In review", dot: true, pulse: true },
    approved: { tone: "success", label: "Approved", dot: true },
    rejected: { tone: "error", label: "Rejected", dot: true },
  };
  const { tone, label, dot, pulse } = conf[status];
  return <TerraBadge tone={tone} dot={dot} pulse={pulse}>{label}</TerraBadge>;
};

export function KycStatusCard() {
  // R2-W3-01 — the lifecycle log is the bus: every KYC transition (wizard
  // submit, seeded reviewer verdict, prop-admin decision) emits one event,
  // and this card re-derives from the draft the moment it lands.
  useLifecycleLog();
  const draft = readVerificationDraft();
  const { reviewStatus, submittedAt, attempts, maxAttempts, rejectionReasons } = draft;

  /* ── Not started ───────────────────────────────────────────────── */
  if (reviewStatus === "not-started") {
    return (
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-surface-container-low/70 p-4 shadow-sm sm:flex-row sm:items-center md:col-span-12">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface">
            <span aria-hidden>🪪</span>
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Identity verification
            </p>
            <p className="text-sm font-bold text-on-surface">Not started</p>
          </div>
        </div>
        <Link
          href="/verification"
          className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
        >
          Start verification →
        </Link>
      </div>
    );
  }

  /* ── Approved ──────────────────────────────────────────────────── */
  if (reviewStatus === "approved") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-primary-fixed/40 px-4 py-3 shadow-sm md:col-span-12">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <span aria-hidden>✓</span>
        </span>
        <p className="text-sm font-bold text-on-surface">
          Identity verified — your account is fully verified for payouts.
        </p>
      </div>
    );
  }

  /* ── Rejected — prominent retry path ───────────────────────────── */
  if (reviewStatus === "rejected") {
    const reasons = rejectionReasons ?? [];
    const attemptsUsed = attempts;
    return (
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-error-container/60 p-4 shadow-sm sm:flex-row sm:items-center md:col-span-12">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error text-on-error">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-error-container">
              Identity verification rejected
              <span className="ml-2 font-normal normal-case">
                {attemptsUsed}/{maxAttempts} attempts used
              </span>
            </p>
            <p className="text-sm font-bold text-on-surface">
              {reasons[0] ?? "Verification was rejected — see what to fix and resubmit."}
            </p>
            {reasons.length > 1 && (
              <p className="text-xs text-on-surface-variant">
                +{reasons.length - 1} more issue{reasons.length === 2 ? "" : "s"} — all listed on
                the status page.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/verification?step=status"
            className="rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            What to fix
          </Link>
          <Link
            href="/verification?step=status"
            className="rounded-xl bg-error px-4 py-2.5 text-xs font-bold text-on-error transition-opacity hover:opacity-90"
          >
            Retry Verification →
          </Link>
        </div>
      </div>
    );
  }

  /* ── Submitted / in-review / draft — reviewing ─────────────────── */
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-surface-container-low/70 p-4 shadow-sm sm:flex-row sm:items-center md:col-span-12">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface">
          <span aria-hidden>🪪</span>
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Identity verification
          </p>
          <p className="text-sm font-bold text-on-surface">
            {reviewStatus === "draft" ? "In progress" : "In review"}
            {reviewStatus !== "draft" && submittedAt
              ? ` — submitted ${daysSince(submittedAt)} day${daysSince(submittedAt) === 1 ? "" : "s"} ago`
              : ""}
            <span className="ml-1 font-normal text-on-surface-variant">
              {reviewStatus === "draft" ? "Finish your documents" : "(typically 1–2 business days)"}
            </span>
          </p>
        </div>
      </div>
      {statusBadge(reviewStatus)}
      <Link
        href="/verification?step=status"
        className="shrink-0 rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
      >
        View status →
      </Link>
    </div>
  );
}
