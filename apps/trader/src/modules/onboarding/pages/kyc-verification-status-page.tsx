"use client";

/**
 * KYC Verification Status — converted from stitch_screens/kyc_verification_status
 * Status timeline with review stages and checklist.
 *
 * Audit fix #1 (CRITICAL): the screen now renders every KYC outcome,
 * not just "reviewing":
 *
 *   reviewing  → stage timeline + checklist (original stitch layout)
 *   rejected   → rejection reasons in plain language, per-check issue
 *                badges, a resubmit CTA (pre-filled from the prior
 *                submission, attempts counter) and support as the
 *                secondary path — no more dead end.
 *   approved   → confirmation with what it unlocks.
 *
 * The state comes from the kycSubmission fixture; ?state=rejected
 * previews the rejection journey on demo data.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import {
  kycSubmission,
  rejectedKycSubmission,
  type KycSubmission,
} from "@/lib/fixtures/terra-fixtures";

const stages = [
  { label: "Documents received", done: true, note: "Submitted 2 days ago" },
  { label: "Automated checks", done: true, note: "ID authenticity & liveness passed" },
  { label: "Compliance review", done: false, note: "In progress — usually under 24h" },
  { label: "Approved", done: false, note: "Unlocks payouts" },
];

function ChecklistCard({ submission }: { submission: KycSubmission }) {
  return (
    <TerraCard>
      <TerraSectionTitle title="Checklist" />
      <div className="space-y-2">
        {submission.checks.map((c) => (
          <div
            key={c.item}
            className="rounded-xl bg-surface-container-low px-3 py-2.5 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-on-surface">{c.item}</span>
              <TerraBadge tone={c.ok ? "success" : c.optional ? "neutral" : "error"}>
                {c.ok ? "Received" : c.optional ? "Optional" : "Needs attention"}
              </TerraBadge>
            </div>
            {c.issue && (
              <p className="mt-1 text-xs text-error">{c.issue}</p>
            )}
          </div>
        ))}
      </div>
    </TerraCard>
  );
}

/* ------------------------------------------------------------------ */
/* Rejected state — reasons, retry path, support fallback              */
/* ------------------------------------------------------------------ */

function RejectedView({ submission }: { submission: KycSubmission }) {
  const attemptsLeft = Math.max(0, submission.maxAttempts - submission.attempts);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification Status"
        description="Your documents need one more pass"
        actions={<TerraBadge tone="error" dot>Rejected</TerraBadge>}
      />

      {/* Rejection reasons — plain language, one row per fix needed */}
      <TerraCard className="border border-error/30 bg-error-container/40">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-error-container">
              Verification was rejected
            </p>
            <p className="text-sm text-on-error-container/80">
              You can fix these and resubmit — attempts {submission.attempts} of{" "}
              {submission.maxAttempts} used. Most resubmissions are approved within 24 hours.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {(submission.rejectionReasons ?? []).map((r) => (
            <li
              key={r}
              className="flex items-start gap-2 rounded-xl bg-surface-container-lowest/70 px-3 py-2.5 text-sm text-on-surface"
            >
              <span className="mt-0.5 font-bold text-error">✕</span>
              {r}
            </li>
          ))}
        </ul>
      </TerraCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChecklistCard submission={submission} />

          <TerraCard className="mt-6">
            <TerraSectionTitle title="What happens next" />
            <ol className="space-y-4">
              {[
                {
                  title: "Resubmit the flagged documents",
                  note: "Your previous answers are pre-filled — only the failed items need new files.",
                },
                {
                  title: "Automated checks run first",
                  note: "Most rejections clear in minutes once the image quality passes.",
                },
                {
                  title: "Compliance reviews the new files",
                  note: "Usually under 24 hours. You'll get an email either way.",
                },
              ].map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{s.title}</p>
                    <p className="text-xs text-on-surface-variant">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TerraCard>
        </div>

        <div className="space-y-6">
          <TerraCard className="flex flex-col gap-2">
            <Link
              href="/kyc-onboarding?resubmit=1"
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Fix & resubmit ({attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left)
            </Link>
            <Link
              href="/support"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Contact support
            </Link>
            <Link
              href="/documents"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              View submitted documents
            </Link>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle title="Rejected on a technicality?" />
            <p className="text-xs text-on-surface-variant">
              If you believe the rejection is wrong (e.g. your address document is recent),
              open a support ticket with the document date — compliance re-reviews flagged
              cases manually.
            </p>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Approved state                                                      */
/* ------------------------------------------------------------------ */

function ApprovedView({ submission }: { submission: KycSubmission }) {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification Status"
        description="Identity verified — you're all set"
        actions={<TerraBadge tone="success" dot>Approved</TerraBadge>}
      />
      <TerraCard className="border border-primary/30 bg-primary-fixed/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-surface">
              Verification complete
            </p>
            <p className="text-sm text-on-surface-variant">
              Payouts are unlocked and your account limits are at their maximum. Keep your
              documents current — if your address changes, resubmit from this page.
            </p>
          </div>
        </div>
      </TerraCard>
      <ChecklistCard submission={submission} />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/payout-request"
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Request a payout
        </Link>
        <Link
          href="/documents"
          className="rounded-xl bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          View verified documents
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function KycVerificationStatusPage() {
  // ?state=rejected / ?state=approved previews the other KYC outcomes
  // on demo data; the default follows the kycSubmission fixture.
  const params = useSearchParams();
  const preview = params.get("state");
  const submission: KycSubmission =
    preview === "rejected"
      ? rejectedKycSubmission
      : preview === "approved"
        ? { ...kycSubmission, status: "approved" }
        : kycSubmission;

  if (submission.status === "rejected") return <RejectedView submission={submission} />;
  if (submission.status === "approved") return <ApprovedView submission={submission} />;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification Status"
        description="Your identity verification is under review"
        actions={<TerraBadge tone="tertiary" dot pulse>Reviewing</TerraBadge>}
      />

      {/* Demo preview links — jump between KYC outcomes on mock data */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
        <span className="font-semibold uppercase tracking-wider">Demo states:</span>
        <Link href="/kyc-verification-status?state=reviewing" className="rounded-full bg-surface-container-low px-3 py-1 font-semibold hover:bg-surface-container">
          Reviewing
        </Link>
        <Link href="/kyc-verification-status?state=rejected" className="rounded-full bg-error-container px-3 py-1 font-semibold text-on-error-container hover:opacity-80">
          Rejected
        </Link>
        <Link href="/kyc-verification-status?state=approved" className="rounded-full bg-primary-fixed px-3 py-1 font-semibold text-on-primary-fixed-variant hover:opacity-80">
          Approved
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title="Review progress" />
          <ol className="space-y-5">
            {stages.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {s.done ? "✓" : "•"}
                </span>
                <div>
                  <p className={`text-sm font-bold ${s.done ? "text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </TerraCard>

        <div className="space-y-6">
          <ChecklistCard submission={submission} />
          <TerraCard className="flex flex-col gap-2">
            <Link
              href="/support"
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Contact support
            </Link>
            <Link
              href="/documents"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              View submitted documents
            </Link>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
