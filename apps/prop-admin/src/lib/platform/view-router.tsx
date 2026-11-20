import dynamic from "next/dynamic";

/**
 * Minimal view router - only includes views that have actual page components.
 * Includes R10 gap-closure P0 operator pages and a few core views.
 */

const VIEWS = {
  // R10 gap-closure operator pages (P0 stores)
  "scaling-plan": dynamic(() => import("@/modules/challenges/pages/scaling-plan-page").then(m => ({ default: m.ScalingPlanPage }))),
  "profit-split-tiers": dynamic(() => import("@/modules/challenges/pages/profit-split-tiers-page").then(m => ({ default: m.ProfitSplitTiersPage }))),
  "challenge-commercial-policy": dynamic(() => import("@/modules/challenges/pages/challenge-commercial-policy-page").then(m => ({ default: m.ChallengeCommercialPolicyPage }))),
  
  // Risk pages
  "drawdown-model": dynamic(() => import("@/modules/risk/pages/drawdown-model-page").then(m => ({ default: m.DrawdownModelPage }))),
  "pre-trade-restrictions": dynamic(() => import("@/modules/risk/pages/pre-trade-restriction-page").then(m => ({ default: m.PreTradeRestrictionsPage }))),
  "risk-rule-engine": dynamic(() => import("@/modules/risk/pages/risk-rule-engine-page").then(m => ({ default: m.RiskRuleEnginePage }))),
  "appeals-queue": dynamic(() => import("@/modules/risk/pages/appeals-queue-page").then(m => ({ default: m.AppealsQueuePage }))),
  
  // KYC pages
  "portfolio-screening": dynamic(() => import("@/modules/kyc/pages/portfolio-screening-page").then(m => ({ default: m.PortfolioScreeningPage }))),
  
  // Payouts pages
  "payouts-fraud-queue": dynamic(() => import("@/modules/payouts/pages/payout-fraud-queue-page").then(m => ({ default: m.PayoutFraudQueuePage }))),
  
    "settings-payouts": dynamic(() => import("@/modules/payouts/pages/payout-policy-settings-page").then(m => ({ default: m.PayoutPolicySettingsPage }))),
  "failed-payouts-queue": dynamic(() => import("@/modules/payouts/pages/failed-payouts-queue-page").then(m => ({ default: m.FailedPayoutsQueuePage }))),
  // Economics pages
  "add-on-entitlements": dynamic(() => import("@/modules/economics/pages/add-on-entitlements-page").then(m => ({ default: m.AddOnEntitlementsPage }))),
};

export function resolveView(viewId: string) {
  return VIEWS[viewId];
}

export type ViewComponent = React.ComponentType<any>;
