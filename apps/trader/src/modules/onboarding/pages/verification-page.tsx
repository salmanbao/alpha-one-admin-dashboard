"use client";

/**
 * Unified Verification Wizard — SF-01.
 *
 * One /verification route replaces the two competing KYC paths
 * (/account-verification-1 → -2 and /kyc-onboarding), which collected
 * the same identity details 2-3 times and stranded the trader on
 * submit. All entry points — purchase-completed, the getting-started
 * tour, the dashboard KYC card, the lifecycle simulator — converge here.
 *
 * Steps are *derived from the persisted draft* (never local step
 * state), so a returning trader lands on the first incomplete step and
 * never re-sees one they have finished:
 *
 *   identity → documents → review → status
 *
 * Draft persistence reuses the checkout-recovery sessionStorage
 * pattern (see @/lib/verification/verification-store). Two query
 * params keep the old deep links working:
 *
 *   ?step=identity|documents|review|status — jump to a step
 *      (dashboard "View status", resubmission);
 *   ?state=reviewing|rejected|approved     — preview the other KYC
 *      outcomes on demo data (the old /kyc-verification-status
 *      convention).
 *
 * Keyboard support (kept from /kyc-onboarding audit finding #3): the
 * active step's heading receives focus after every step change, the
 * stepper marks it with aria-current="step", and an sr-only live
 * region announces each transition. A disabled Continue is never
 * unexplained — a role="status" hint says what is still required.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@pfaas/ui";
import { TerraBadge, TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";
import { toast } from "@/hooks/use-toast";
import {
  kycSubmission,
  rejectedKycSubmission,
  type KycSubmission,
} from "@/lib/fixtures/terra-fixtures";
import {
  documentsComplete,
  emptyVerificationDraft,
  identityFieldLabels,
  identityFieldOrder,
  identityValidators,
  parseVerificationStep,
  readVerificationDraft,
  stepFromDraft,
  verificationDocs,
  verificationSteps,
  writeVerificationDraft,
  type VerificationDraft,
  type VerificationStepId,
} from "@/lib/verification/verification-store";
import { VerificationStatusView } from "./verification-status-view";

const stepDescriptions: Record<VerificationStepId, string> = {
  identity: "Confirm your details once — they're saved as you go.",
  documents: "Two documents prove your identity. JPG, PNG or PDF.",
  review: "Check everything over before you submit.",
  status: "Track the review and fix anything that gets flagged.",
};

export function VerificationPage() {
  const router = useRouter();
  const params = useSearchParams();

  // ?step= deep link — an explicit jump (dashboard "View status",
  // resubmission) wins over derivation until the trader acts again.
  const [override, setOverride] = useState<VerificationStepId | null>(() =>
    parseVerificationStep(params.get("step")),
  );
  const requested = parseVerificationStep(params.get("step"));
  useEffect(() => setOverride(requested), [requested]);

  // The draft is restored after mount — sessionStorage is client-only,
  // so the server-rendered paint uses the demo defaults (no hydration
  // mismatch on the controlled inputs).
  const [draft, setDraft] = useState<VerificationDraft>(emptyVerificationDraft);
  useEffect(() => {
    setDraft(readVerificationDraft());
  }, []);

  /** Single write path — state and sessionStorage move together. */
  const applyDraft = (next: VerificationDraft) => {
    setDraft(next);
    writeVerificationDraft(next);
  };

  const { field, validateAll } = useFormValidation(identityValidators);

  const step = override ?? stepFromDraft(draft);
  const stepIndex = verificationSteps.findIndex((s) => s.id === step);

  // Focus management (kyc-onboarding audit finding #3): every step
  // change moves focus to the new step heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const missingDocs = verificationDocs.filter((d) => !draft.documents[d.key]);

  /* ── Step actions ──────────────────────────────────────────────── */

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll(draft.identity)) return;
    applyDraft({ ...draft, identityDone: true });
    setOverride(null);
  };

  const setIdentity = (key: keyof typeof draft.identity, value: string) =>
    applyDraft({ ...draft, identity: { ...draft.identity, [key]: value } });

  const attachDoc = (key: keyof typeof draft.documents, file: File) => {
    applyDraft({
      ...draft,
      documents: {
        ...draft.documents,
        [key]: { name: file.name, size: file.size, type: file.type },
      },
    });
    toast({ title: "File selected", description: `${file.name} ready for upload (demo — no network call)` });
  };

  const removeDoc = (key: keyof typeof draft.documents, label: string) => {
    const documents = { ...draft.documents };
    delete documents[key];
    applyDraft({ ...draft, documents });
    toast({ title: "File removed", description: `${label} upload cleared` });
  };

  const confirmDocuments = () => {
    applyDraft({ ...draft, documentsDone: true });
    setOverride(null);
  };

  const submitForReview = () => {
    applyDraft({ ...draft, documentsDone: true, submitted: true, submittedAt: new Date().toISOString() });
    setOverride(null);
    // Drop any ?state= demo preview — a fresh submission reads as
    // "reviewing", not whichever outcome was being previewed.
    router.replace("/verification?step=status");
    toast({
      title: "Submitted for verification",
      description: "Your documents are under review — we'll email you either way (demo — no network call).",
    });
  };

  /** Status step → "Use the full resubmission form": keep the identity
   *  answers, drop back to documents with the previous files attached. */
  const startResubmission = () => {
    applyDraft({ ...draft, submitted: false, documentsDone: false });
    setOverride(null);
    router.replace("/verification");
  };

  /* ── Status resolution (demo fixtures + preview param) ─────────── */

  const preview = params.get("state");
  const submission: KycSubmission =
    preview === "rejected"
      ? rejectedKycSubmission
      : preview === "approved"
        ? { ...kycSubmission, status: "approved" }
        : draft.submittedAt
          ? { ...kycSubmission, submittedAt: draft.submittedAt }
          : kycSubmission;

  const statusTone = submission.status === "rejected" ? "error" : submission.status === "approved" ? "success" : "tertiary";

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Identity verification"
        description={stepDescriptions[step]}
        actions={
          step === "status" ? (
            <TerraBadge tone={statusTone as "error" | "success" | "tertiary"} dot pulse={submission.status === "reviewing"}>
              {submission.status === "reviewing" ? "Reviewing" : submission.status === "rejected" ? "Rejected" : "Approved"}
            </TerraBadge>
          ) : (
            <TerraBadge tone="tertiary">
              Step {stepIndex + 1} of {verificationSteps.length}
            </TerraBadge>
          )
        }
      />

      {/* Stepper — active step exposed to assistive tech */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {verificationSteps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              aria-current={i === stepIndex ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap",
                i < stepIndex
                  ? "bg-primary-fixed text-on-primary-fixed-variant"
                  : i === stepIndex
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant",
              )}
            >
              <span>{i < stepIndex ? "✓" : i + 1}</span>
              <span>{s.label}</span>
            </div>
            {i < verificationSteps.length - 1 && <span className="text-outline-variant">—</span>}
          </div>
        ))}
      </div>

      {/* Screen-reader step announcements */}
      <p role="status" aria-live="polite" className="sr-only">
        Step {stepIndex + 1} of {verificationSteps.length}: {verificationSteps[stepIndex].label}
        {step === "documents" && missingDocs.length > 0
          ? ` — ${missingDocs.length} document${missingDocs.length === 1 ? "" : "s"} still need uploading before you can continue.`
          : ""}
      </p>

      <div className="mx-auto max-w-2xl">
        {/* ── Step 1: identity ─────────────────────────────────────── */}
        {step === "identity" && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-1 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Confirm your identity
            </h2>
            <p className="pb-4 text-xs text-on-surface-variant">
              This must match the details on your payment method. Your answers are saved as you
              type — leave and come back without losing them.
            </p>
            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {identityFieldOrder.map((key) => (
                  <FormField
                    key={key}
                    id={`identity-${key}`}
                    label={identityFieldLabels[key]}
                    required
                    type={key === "phone" ? "tel" : "text"}
                    placeholder={key === "dob" ? "YYYY-MM-DD" : undefined}
                    value={draft.identity[key]}
                    className={key === "address" ? "sm:col-span-2" : undefined}
                    {...field(key, draft.identity[key], (v) => setIdentity(key, v))}
                  />
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                >
                  Continue to documents
                </button>
              </div>
            </form>
          </TerraCard>
        )}

        {/* ── Step 2: documents ────────────────────────────────────── */}
        {step === "documents" && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-4 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Identity documents
            </h2>
            <div className="space-y-3">
              {verificationDocs.map((doc) => {
                const file = draft.documents[doc.key];
                return (
                  <div
                    key={doc.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-outline-variant px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-on-surface">{doc.label}</span>
                      <p className="text-xs text-on-surface-variant">{doc.hint}</p>
                      {file && (
                        <p className="mt-1 text-xs font-bold text-primary">✓ {file.name}</p>
                      )}
                    </div>
                    {file ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.key, doc.label)}
                          className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
                        >
                          Remove
                        </button>
                        <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            aria-label={`Replace ${doc.label}`}
                            onChange={(e) => e.target.files?.[0] && attachDoc(doc.key, e.target.files[0])}
                          />
                          Replace
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          aria-label={`Upload ${doc.label}`}
                          onChange={(e) => e.target.files?.[0] && attachDoc(doc.key, e.target.files[0])}
                        />
                        Upload
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() => setOverride("identity")}
                className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Back
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {/* Never leave a disabled button unexplained */}
                {missingDocs.length > 0 && (
                  <span role="status" className="text-xs text-on-surface-variant">
                    Upload {missingDocs.length} more document{missingDocs.length === 1 ? "" : "s"} to continue
                  </span>
                )}
                <button
                  type="button"
                  onClick={confirmDocuments}
                  disabled={missingDocs.length > 0}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  Continue to review
                </button>
              </div>
            </div>
          </TerraCard>
        )}

        {/* ── Step 3: review & submit ──────────────────────────────── */}
        {step === "review" && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-4 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Review &amp; submit
            </h2>
            <div className="space-y-2 text-sm">
              {identityFieldOrder.map((key) => (
                <div key={key} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                  <span className="text-on-surface-variant">{identityFieldLabels[key]}</span>
                  <span className="font-semibold text-on-surface">{draft.identity[key]}</span>
                </div>
              ))}
              <div className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                <span className="text-on-surface-variant">Documents</span>
                <span className="font-semibold text-on-surface">
                  {documentsComplete(draft)
                    ? "ID + proof of address uploaded"
                    : `${verificationDocs.length - missingDocs.length} of ${verificationDocs.length} uploaded`}
                </span>
              </div>
              <div className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                <span className="text-on-surface-variant">Agreement accepted</span>
                <span className="font-bold text-primary">✓</span>
              </div>
            </div>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() => setOverride("documents")}
                className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Back
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {/* Never leave a disabled button unexplained */}
                {!documentsComplete(draft) && (
                  <span role="status" className="text-xs text-on-surface-variant">
                    Attach both documents before submitting
                  </span>
                )}
                <button
                  type="button"
                  onClick={submitForReview}
                  disabled={!documentsComplete(draft)}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  Submit for verification
                </button>
              </div>
            </div>
          </TerraCard>
        )}

        {/* ── Step 4: status ───────────────────────────────────────── */}
        {step === "status" && (
          <div className="space-y-4">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-headline text-lg font-bold text-on-surface outline-none"
            >
              Verification status
            </h2>
            <VerificationStatusView submission={submission} embedded onResubmit={startResubmission} />
          </div>
        )}
      </div>
    </div>
  );
}
