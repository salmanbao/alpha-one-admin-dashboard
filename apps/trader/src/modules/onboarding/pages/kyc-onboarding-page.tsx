"use client";

/**
 * KYC Onboarding — converted from stitch_screens/kyc_onboarding
 * Multi-step KYC form: personal → documents → review.
 *
 * Keyboard support (audit finding #3):
 *   • Each step change moves focus to the new step's heading (no focus
 *     loss when the step card swaps out) and announces the step through
 *     an sr-only aria-live region.
 *   • The stepper marks the active step with aria-current="step".
 *   • The disabled Continue button on Documents is never unexplained —
 *     a role="status" hint says what is still required.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import { TerraCard, TerraPageHeader, TerraBadge } from "@/components/terra/terra-ui";

const steps = ["Personal info", "Documents", "Review"] as const;

export function KycOnboardingPage() {
  const [step, setStep] = useState(0);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  // Focus management: the active step's heading receives focus after
  // every step change (skipping the initial render).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const handleUpload = (doc: string) => {
    setUploaded((u) => ({ ...u, [doc]: true }));
  };

  const missingDocs = 2 - Object.keys(uploaded).length;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification"
        description="Required before your first payout"
        actions={<TerraBadge tone="tertiary">Step {step + 1} of {steps.length}</TerraBadge>}
      />

      {/* Stepper — active step exposed to assistive tech */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap",
                i < step
                  ? "bg-primary-fixed text-on-primary-fixed-variant"
                  : i === step
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant",
              )}
            >
              <span>{i < step ? "✓" : i + 1}</span>
              <span>{s}</span>
            </div>
            {i < steps.length - 1 && <span className="text-outline-variant">—</span>}
          </div>
        ))}
      </div>

      {/* Screen-reader step announcements (finding #3) */}
      <p role="status" aria-live="polite" className="sr-only">
        Step {step + 1} of {steps.length}: {steps[step]}
        {step === 1 && missingDocs > 0
          ? ` — ${missingDocs} document${missingDocs === 1 ? "" : "s"} still need uploading before you can continue.`
          : ""}
      </p>

      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-4 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Personal information
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["Legal first name", "Tom"],
                ["Legal last name", "Allen"],
                ["Date of birth", "1990-04-12"],
                ["Nationality", "United States"],
                ["Residential address", "123 Market St, San Francisco"],
                ["Postal code", "94103"],
              ].map(([label, value]) => (
                <label key={label} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {label}
                  </span>
                  <input
                    defaultValue={value}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </TerraCard>
        )}

        {step === 1 && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-4 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Identity documents
            </h2>
            <div className="space-y-3">
              {["Government ID (passport or driver's license)", "Proof of address (utility bill < 90 days)"].map(
                (doc) => (
                  <div
                    key={doc}
                    className="flex items-center justify-between rounded-xl border border-dashed border-outline-variant px-4 py-5"
                  >
                    <span className="text-sm font-semibold text-on-surface">{doc}</span>
                    {uploaded[doc] ? (
                      <span className="flex items-center gap-2 rounded-xl bg-primary-fixed/50 px-4 py-2 text-xs font-bold text-on-primary-fixed-variant">
                        ✓ Uploaded
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpload(doc)}
                        className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
                      >
                        Upload
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Back
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {/* Never leave a disabled button unexplained (finding #3) */}
                {missingDocs > 0 && (
                  <span role="status" className="text-xs text-on-surface-variant">
                    Upload {missingDocs} more document{missingDocs === 1 ? "" : "s"} to continue
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={missingDocs > 0}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </TerraCard>
        )}

        {step === 2 && (
          <TerraCard>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="pb-4 font-headline text-lg font-bold text-on-surface outline-none"
            >
              Review &amp; submit
            </h2>
            <div className="space-y-2 text-sm">
              {[
                ["Name", "Tom Allen"],
                ["Date of birth", "1990-04-12"],
                ["Nationality", "United States"],
                ["Address", "123 Market St, San Francisco, CA 94103"],
                ["Documents", Object.keys(uploaded).length >= 2 ? "ID + proof of address uploaded" : `${Object.keys(uploaded).length} of 2 uploaded`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                  <span className="text-on-surface-variant">{k}</span>
                  <span className="font-semibold text-on-surface">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Back
              </button>
              <Link
                href="/kyc-verification-status"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Submit verification
              </Link>
            </div>
          </TerraCard>
        )}
      </div>
    </div>
  );
}
