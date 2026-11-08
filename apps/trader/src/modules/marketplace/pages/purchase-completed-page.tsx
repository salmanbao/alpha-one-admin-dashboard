"use client";

/**
 * Purchase Completed — converted from stitch_screens/purchase_completed
 * Success confirmation with the SF-02 journey checklist (Purchased →
 * Verified → Provisioned → Credentialed → First trade).
 *
 * The old "What happens next" list hardcoded its done flags in source.
 * It now renders the shared <JourneyChecklist />, whose ticks come from
 * @/lib/onboarding/journey-store — this page writes "purchased" the
 * moment the order-confirmation screen mounts, so the checklist on the
 * dashboard agrees with the one here.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { TerraCard, TerraPageHeader, formatMoney } from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";
import { markJourney } from "@/lib/onboarding/journey-store";
import { readProvisioningHandoff, writeProvisioningHandoff } from "@/lib/onboarding/provisioning-handoff";
import { JourneyChecklist } from "@/components/onboarding/journey-checklist";

export function PurchaseCompletedPage() {
  const router = useRouter();
  const params = useSearchParams();

  // SF-02 / R2-03: reaching the order-confirmation screen is the purchase
  // event — tick "Purchased" and record purchasedAt for provisioning
  // progress (preserve first timestamp so revisits don't reset progress).
  useEffect(() => {
    markJourney("purchased");
    if (!readProvisioningHandoff()?.purchasedAt) {
      writeProvisioningHandoff({
        purchasedAt: new Date().toISOString(),
        orderId: params.get("orderId") ?? undefined,
      });
    }
  }, [params]);

  // Contextualize order number & challenge from router params (dummy data only).
  const orderId = params.get("orderId") ?? "TT-48210";
  const challengeKey = params.get("challengeId");
  const ch = challengeKey
    ? terraChallenges.find((c) => c.id === challengeKey) ?? terraChallenges[1]
    : terraChallenges[1];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-on-primary">
          ✓
        </div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Purchase completed!
        </h1>
        <p className="text-sm text-on-surface-variant">
          Your {ch.name} {formatMoney(ch.accountSize, "USD").replace(".00", "")} challenge is
          being prepared.
        </p>
      </div>

      <TerraCard>
        <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">What happens next</h2>
        <JourneyChecklist />
      </TerraCard>

      <TerraCard className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">Order #{orderId}</p>
          <p className="text-xs text-on-surface-variant">
            {formatMoney(ch.price)} paid • Receipt sent to your email
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            onClick={() => {
              toast({
                title: "Invoice preview",
                description: `Opening invoice for order #{orderId} (demo — no live data)`,
              });
              router.push(`/invoice-detail?orderId=${orderId}`);
            }}
          >
            View Invoice
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </TerraCard>
    </div>
  );
}
