"use client";

/**
 * KYC Verification Status — converted from stitch_screens/kyc_verification_status
 * Status timeline with review stages and checklist.
 *
 * Audit fix #1 (CRITICAL): the screen now renders every KYC outcome,
 * not just "reviewing":
 *
 *   reviewing  → stage timeline + checklist (original stitch layout)
 *   rejected   → 'What to fix' reasons in plain language, per-check issue
 *                badges, an inline 'Update documents' re-upload card
 *                (finding #1 — replace flagged files right on this
 *                screen, required items gate the resubmit button), the
 *                'How to resubmit' steps, a full-form fallback and
 *                support as the secondary path — no more dead end.
 *   approved   → confirmation with what it unlocks.
 *
 * The state comes from the kycSubmission fixture; ?state=rejected
 * previews the rejection journey on demo data.
 */

import Link from "next/link";
import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";

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

/**
 * Inline re-upload (finding #1): flagged documents can be replaced
 * directly on the rejection screen — no trip through the full
 * resubmission form. Required items gate the button; optional items
 * (e.g. source of funds) attach without blocking. Frontend-only demo:
 * chosen filenames are held in component state and "submitting" flips
 * the parent into a resubmitted state.
 */
function UpdateDocumentsCard({
  submission,
  submitted,
  onSubmit,
}: {
  submission: KycSubmission;
  submitted: boolean;
  onSubmit: () => void;
}) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const failed = submission.checks.filter((c) => !c.ok);
  const required = failed.filter((c) => !c.optional);
  const passed = submission.checks.filter((c) => c.ok);
  const missingRequired = required.filter((c) => !files[c.item]);
  const requiredReady = failed.length > 0 && missingRequired.length === 0;
  const chosenCount = failed.filter((c) => files[c.item]).length;

  if (submitted) {
    return (
      <TerraCard className="border border-primary/30 bg-primary-fixed/30">
        <TerraSectionTitle title="Documents updated" />
        <p className="text-sm text-on-surface">
          ✓ Resubmission received — attempt {submission.attempts + 1} of{" "}
          {submission.maxAttempts} is now under review. Automated checks run first
          (usually minutes), then compliance reviews the new files (usually under
          24 hours). You&apos;ll get an email either way.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/kyc-verification-status?state=reviewing"
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            View review progress
          </Link>
          <Link
            href="/support"
            className="rounded-xl bg-surface-container-low px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
          >
            Questions? Contact support
          </Link>
        </div>
      </TerraCard>
    );
  }

  return (
    <TerraCard className="border border-primary/30">
      <TerraSectionTitle
        title="Update documents"
        description="Re-upload the flagged files right here — no need to complete the full form again."
      />
      <div className="space-y-2">
        {failed.map((c) => (
          <div
            key={c.item}
            className="rounded-xl bg-surface-container-low px-3 py-2.5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-semibold text-on-surface">{c.item}</span>
                {c.issue ? (
                  <p className="text-xs text-error">{c.issue}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TerraBadge tone={c.optional ? "neutral" : "error"}>
                  {c.optional ? "Optional" : "Required"}
                </TerraBadge>
                <label className="cursor-pointer rounded-lg bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high">
                  {files[c.item] ? "Change file" : "Choose file"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    aria-label={`Upload a new ${c.item} document`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFiles((prev) => ({ ...prev, [c.item]: f.name }));
                        toast({
                          title: `${c.item} attached`,
                          description: f.name,
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            {files[c.item] ? (
              <p className="mt-1 text-xs font-semibold text-primary">
                ✓ {files[c.item]} ready to send
              </p>
            ) : (
              <p className="mt-1 text-xs text-on-surface-variant">
                No new file chosen yet
              </p>
            )}
          </div>
        ))}
        {passed.map((c) => (
          <p
            key={c.item}
            className="flex items-center gap-2 px-3 text-xs text-on-surface-variant"
          >
            <span className="font-bold text-primary" aria-hidden>✓</span>
            {c.item} — received, no change needed
          </p>
        ))}
      </div>
      <button
        type="button"
        disabled={!requiredReady}
        onClick={() => {
          onSubmit();
          toast({
            title: "Documents resubmitted",
            description: `${chosenCount} new file${chosenCount === 1 ? "" : "s"} sent — attempt ${submission.attempts + 1} of ${submission.maxAttempts} is now in review.`,
          });
        }}
        className="mt-4 w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requiredReady
          ? "Update documents & resubmit"
          : `Attach ${missingRequired.length} required file${missingRequired.length === 1 ? "" : "s"} to continue`}
      </button>
      <p className="mt-2 text-center text-[11px] text-on-surface-variant">
        JPG, PNG or PDF • {chosenCount} of {failed.length} flagged items have a new
        file • {Math.max(0, submission.maxAttempts - submission.attempts)} attempt
        {Math.max(0, submission.maxAttempts - submission.attempts) === 1 ? "" : "s"}{" "}
        left
      </p>
    </TerraCard>
  );
}

function RejectedView({ submission }: { submission: KycSubmission }) {
  const [resubmitted, setResubmitted] = useState(false);
  const attemptsUsed = submission.attempts + (resubmitted ? 1 : 0);
  const attemptsLeft = Math.max(0, submission.maxAttempts - attemptsUsed);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification Status"
        description={
          resubmitted
            ? "New documents received — back in review"
            : "Your documents need one more pass"
        }
        actions={
          <TerraBadge tone={resubmitted ? "tertiary" : "error"} dot pulse={resubmitted}>
            {resubmitted ? "Reviewing" : "Rejected"}
          </TerraBadge>
        }
      />

      {/* Rejection reasons — plain language, one row per fix needed */}
      <TerraCard className="border border-error/30 bg-error-container/40">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-error-container">
              {resubmitted ? "Resubmission received" : "Verification was rejected"}
            </p>
            <p className="text-sm text-on-error-container/80">
              {resubmitted
                ? `Attempt ${attemptsUsed} of ${submission.maxAttempts} is under review with your new files — decisions usually land within 24 hours.`
                : `You can fix these and resubmit — attempts ${attemptsUsed} of ${submission.maxAttempts} used. Most resubmissions are approved within 24 hours.`}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-on-error-container/70">
          What to fix
        </p>
        <ul className="mt-2 space-y-2">
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
          {/* Inline re-upload — the retry path, right on this screen */}
          <UpdateDocumentsCard
            submission={submission}
            submitted={resubmitted}
            onSubmit={() => setResubmitted(true)}
          />

          <div className="mt-6">
            <ChecklistCard submission={submission} />
          </div>

          <TerraCard className="mt-6">
            <TerraSectionTitle title="How to resubmit" />
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
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Use the full resubmission form
            </Link>
            <p className="text-center text-[11px] text-on-surface-variant">
              Pre-filled from your previous answers • {attemptsLeft} attempt
              {attemptsLeft === 1 ? "" : "s"} left
            </p>
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
