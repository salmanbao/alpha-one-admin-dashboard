"use client";

/**
 * KYC Onboarding — converted from stitch_screens/kyc_onboarding
 * Multi-step KYC form: personal → documents → review.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import { TerraCard, TerraPageHeader, TerraBadge } from "@/components/terra/terra-ui";

const steps = ["Personal info", "Documents", "Review"];

export function KycOnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="KYC Verification"
        description="Required before your first payout"
        actions={<TerraBadge tone="tertiary">Step {step + 1} of {steps.length}</TerraBadge>}
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
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

      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <TerraCard>
            <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">
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
            <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">
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
                    <button
                      type="button"
                      className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
                    >
                      Upload
                    </button>
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
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </TerraCard>
        )}

        {step === 2 && (
          <TerraCard>
            <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">
              Review &amp; submit
            </h2>
            <div className="space-y-2 text-sm">
              {[
                ["Name", "Tom Allen"],
                ["Date of birth", "1990-04-12"],
                ["Nationality", "United States"],
                ["Address", "123 Market St, San Francisco, CA 94103"],
                ["Documents", "ID + proof of address uploaded"],
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
