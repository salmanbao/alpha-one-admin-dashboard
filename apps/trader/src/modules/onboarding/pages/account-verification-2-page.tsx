"use client";

/**
 * Account Verification (Step 2) — converted from stitch_screens/account_verification_2
 * Second step: document upload + review, completes into provisioning.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";

export function AccountVerification2Page() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Verification"
        description="Step 2 of 2 — upload documents and review"
        actions={<TerraBadge tone="tertiary">Step 2 of 2</TerraBadge>}
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <TerraCard>
          <TerraSectionTitle title="Upload documents" />
          <div className="space-y-3">
            {["Government-issued photo ID", "Proof of address"].map((doc) => (
              <div
                key={doc}
                className="flex items-center justify-between rounded-xl border border-dashed border-outline-variant px-4 py-5"
              >
                <span className="text-sm font-semibold text-on-surface">{doc}</span>
                <span className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container">
                  Upload
                </span>
              </div>
            ))}
          </div>
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Review" />
          <div className="space-y-2 text-sm">
            {[
              ["Details confirmed", "✓"],
              ["Documents attached", "✓"],
              ["Agreement accepted", "✓"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-2.5">
                <span className="text-on-surface-variant">{k}</span>
                <span className="font-bold text-primary">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between">
            <Link
              href="/account-verification-1"
              className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Back
            </Link>
            <Link
              href="/account-provisioning"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Submit for verification
            </Link>
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
