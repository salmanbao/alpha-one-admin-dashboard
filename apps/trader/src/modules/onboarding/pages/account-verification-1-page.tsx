"use client";

/**
 * Account Verification (Step 1) — converted from stitch_screens/account_verification_1
 * First step of post-purchase verification: confirm identity basics.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";

export function AccountVerification1Page() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Verification"
        description="Step 1 of 2 — confirm your details"
        actions={<TerraBadge tone="tertiary">Step 1 of 2</TerraBadge>}
      />

      <div className="mx-auto max-w-2xl">
        <TerraCard>
          <TerraSectionTitle
            title="Confirm your identity"
            description="This must match the details on your payment method."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Full legal name", "Tom Allen"],
              ["Date of birth", "1990-04-12"],
              ["Country of residence", "United States"],
              ["Phone number", "+1 (415) 555-0142"],
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
            <Link
              href="/account-verification-2"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Continue to step 2
            </Link>
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
