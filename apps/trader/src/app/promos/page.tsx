"use client";

/**
 * Promo Wallet — Trader Engagement Suite (M8)
 *
 * Campaign coupons become trader-visible assets:
 * - Active coupons with masked codes and apply-to-checkout
 * - Eligibility hints that explain conditions in plain language
 * - History of used and expired offers closing the attribution loop for M4 campaigns
 *
 * Spec: Section 12.4 — Promo Wallet
 */

import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PromoWalletPage } from "../../modules/promo/promo-wallet-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PromoWalletPage />
    </Suspense>
  );
}