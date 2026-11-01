"use client";

/**
 * KYC Status Card — audit finding #1 (dashboard prominence).
 *
 * The rejected-KYC state and its retry flow live on the dedicated
 * /kyc-verification-status page, but a rejected trader had no reason
 * to visit it — the rejection was invisible from the dashboard.
 * This card surfaces the current verification state in the dashboard's
 * alert strip:
 *
 *   rejected   → prominent error card: rejection reason(s) in plain
 *                language, attempt counter, and a "Retry Verification"
 *                button straight into the status page's inline re-upload
 *                flow (the same one that gates resubmission per document)
 *   reviewing  → quiet status card with a "View status" link
 *   approved   → one-line confirmation (no action needed)
 *
 * State derives from the same fixtures the status page uses
 * (kycSubmission / rejectedKycSubmission), including the same
 * ?state=rejected / ?state=approved demo preview parameter — the two
 * screens can never disagree.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  kycSubmission,
  rejectedKycSubmission,
  type KycSubmission,
} from "@/lib/fixtures/terra-fixtures";

/** Days since a submission date ("2 days ago"). */
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function KycStatusCard() {
  // Same demo-preview convention as the status page (?state=…); read in
  // an effect so the dashboard stays server-render-safe.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get("state"));
  }, []);

  const submission: KycSubmission =
    preview === "rejected"
      ? rejectedKycSubmission
      : preview === "approved"
        ? { ...kycSubmission, status: "approved" }
        : kycSubmission;

  if (submission.status === "approved") {
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

  if (submission.status === "reviewing") {
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
              In review — submitted {daysSince(submission.submittedAt)} day
              {daysSince(submission.submittedAt) === 1 ? "" : "s"} ago
              <span className="ml-1 font-normal text-on-surface-variant">
                (typically 1–2 business days)
              </span>
            </p>
          </div>
        </div>
        <Link
          href="/kyc-verification-status"
          className="shrink-0 rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          View status →
        </Link>
      </div>
    );
  }

  // Rejected — the prominent retry path (audit #1).
  const reasons = submission.rejectionReasons ?? [];
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
              {submission.attempts}/{submission.maxAttempts} attempts used
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
          href="/kyc-verification-status"
          className="rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          What to fix
        </Link>
        <Link
          href="/kyc-verification-status"
          className="rounded-xl bg-error px-4 py-2.5 text-xs font-bold text-on-error transition-opacity hover:opacity-90"
        >
          Retry Verification →
        </Link>
      </div>
    </div>
  );
}
