"use client";

/**
 * R10-A3 — Challenge Commercial Policy (operator-facing).
 *
 * Operator view over `challenge-commercial-policy-store`:
 *   • Free retry, size-change, fee-credit, refund policies.
 *   • Coupon engine (validate/redeem).
 *   • Applied policies keyed by `${subject}:${challengeId}`.
 *   • Free retry issuance with cooldown.
 *   • Fee credit on `challenge.funded`.
 *   • Refund on first payout.
 *
 * Registered in the challenges manifest + view-router; reachable via direct link.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  addCoupon,
  applyRefund,
  checkFreeRetryEligibility,
  checkRefundEligibility,
  checkSizeChangeEligibility,
  checkFeeCreditEligibility,
  getCommercialStats,
  getCommercialPolicies,
  consumeFreeRetry,
  getAppliedPolicy,
  getAppliedPoliciesForSubject,
  redeemCoupon,
  useChallengeCommercialVersion,
} from "@/lib/challenge-commercial-policy-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function ChallengeCommercialPolicyPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useChallengeCommercialVersion(); // re-render on any mutation

  const policies = Object.values(getCommercialPolicies().appliedPolicies);
  const stats = getCommercialStats();

  return (
    <Page>
      <PageHeader
        title="Challenge Commercial Policies"
        description="Free retry, size-change, fee-credit, and refund policies with coupon engine. Applied policies are keyed by ${subject}:${challengeId}. Free retry issuance includes cooldown enforcement."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Coupons" value={stats.totalCoupons} />
          <MetricCard label="Active Coupons" value={stats.activeCoupons} />
          <MetricCard label="Fee Credits Applied" value={stats.feeCreditsApplied} />
          <MetricCard label="Refunds Applied" value={stats.refundsApplied} />
        </div>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Policy Details</h2>
          <DataTable
            columns={[
              { key: "type", header: "Policy", cell: (p) => <span>{p.subject}</span> },
              { key: "subject", header: "Subject", cell: (p) => <span>{p.subject}</span> },
              { key: "challengeId", header: "Challenge", cell: (p) => <span>{p.challengeId}</span> },
              { key: "freeRetries", header: "Free Retries", cell: (p) => <span>{p.freeRetriesUsed}</span> },
              { key: "feeCredit", header: "Fee Credit", cell: (p) => <span>{p.feeCreditAmount}</span> },
              { key: "refund", header: "Refund", cell: (p) => <span>{p.refundAmount}</span> },
            ]}
            data={policies}
            rowKey={(p) => p.challengeId}
            pageSize={8}
          />
        </section>
      </PageContent>
    </Page>
  );
}