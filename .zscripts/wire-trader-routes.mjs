/**
 * Generates App Router route pages for the converted Terra stitch screens.
 * Each route wraps the client page in Suspense (useSearchParams-safe).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../apps/trader/src/app/", import.meta.url).pathname;

/** route path -> { mod, name } (mod = module page import path relative to src) */
const routes = {
  dashboard: { mod: "modules/dashboard/pages/dashboard-page", name: "DashboardPage" },
  "state-adaptive": {
    mod: "modules/dashboard/pages/state-adaptive-dashboard-page",
    name: "StateAdaptiveDashboardPage",
  },
  "my-accounts": { mod: "modules/accounts/pages/my-accounts-page", name: "MyAccountsPage" },
  "account-detail": { mod: "modules/accounts/pages/account-detail-page", name: "AccountDetailPage" },
  objectives: { mod: "modules/accounts/pages/objectives-page", name: "ObjectivesPage" },
  rules: { mod: "modules/accounts/pages/rules-page", name: "RulesPage" },

  marketplace: { mod: "modules/marketplace/pages/marketplace-page", name: "MarketplacePage" },
  "challenge-detail": {
    mod: "modules/marketplace/pages/challenge-detail-page",
    name: "ChallengeDetailPage",
  },
  "challenge-comparison": {
    mod: "modules/marketplace/pages/challenge-comparison-page",
    name: "ChallengeComparisonPage",
  },
  checkout: { mod: "modules/marketplace/pages/checkout-page", name: "CheckoutPage" },
  "purchase-completed": {
    mod: "modules/marketplace/pages/purchase-completed-page",
    name: "PurchaseCompletedPage",
  },
  "purchase-history": {
    mod: "modules/marketplace/pages/purchase-history-page",
    name: "PurchaseHistoryPage",
  },
  "my-challenges": { mod: "modules/marketplace/pages/my-challenges-page", name: "MyChallengesPage" },

  "trading-positions": { mod: "modules/trading/pages/open-positions-page", name: "OpenPositionsPage" },
  "trade-history": { mod: "modules/trading/pages/trade-history-page", name: "TradeHistoryPage" },
  "trade-detail": { mod: "modules/trading/pages/trade-detail-page", name: "TradeDetailPage" },
  "trade-replay": { mod: "modules/trading/pages/trade-replay-page", name: "TradeReplayPage" },
  "order-ticket": { mod: "modules/trading/pages/order-ticket-page", name: "OrderTicketPage" },
  "order-detail": { mod: "modules/trading/pages/order-detail-page", name: "OrderDetailPage" },
  "market-watch": { mod: "modules/trading/pages/market-watch-page", name: "MarketWatchPage" },
  "web-terminal": { mod: "modules/trading/pages/web-terminal-page", name: "WebTerminalPage" },
  "trading-calendar": { mod: "modules/trading/pages/trading-calendar-page", name: "TradingCalendarPage" },
  "economic-calendar": {
    mod: "modules/trading/pages/economic-calendar-page",
    name: "EconomicCalendarPage",
  },
  "trading-journal": { mod: "modules/trading/pages/trading-journal-page", name: "TradingJournalPage" },
  "trading-plan-builder": {
    mod: "modules/trading/pages/trading-plan-builder-page",
    name: "TradingPlanBuilderPage",
  },
  "risk-dashboard": { mod: "modules/trading/pages/risk-dashboard-page", name: "RiskDashboardPage" },
  "performance-analytics": {
    mod: "modules/trading/pages/performance-analytics-page",
    name: "PerformanceAnalyticsPage",
  },

  "payout-request": { mod: "modules/payouts/pages/payout-request-page", name: "PayoutRequestPage" },
  "payout-eligibility": {
    mod: "modules/payouts/pages/payout-eligibility-page",
    name: "PayoutEligibilityPage",
  },
  "payout-history": { mod: "modules/payouts/pages/payout-history-page", name: "PayoutHistoryPage" },
  payouts: { mod: "modules/payouts/pages/payout-history-page", name: "PayoutHistoryPage" },
  "payout-detail": { mod: "modules/payouts/pages/payout-detail-page", name: "PayoutDetailPage" },
  "withdrawal-methods": {
    mod: "modules/payouts/pages/withdrawal-methods-page",
    name: "WithdrawalMethodsPage",
  },

  "account-statement": {
    mod: "modules/finance/pages/account-statement-page",
    name: "AccountStatementPage",
  },
  documents: { mod: "modules/finance/pages/documents-page", name: "DocumentsPage" },
  "document-viewer": {
    mod: "modules/finance/pages/document-viewer-page",
    name: "DocumentViewerPage",
  },
  "tax-documents": { mod: "modules/finance/pages/tax-documents-page", name: "TaxDocumentsPage" },
  "tax-statement-detail": {
    mod: "modules/finance/pages/tax-statement-detail-page",
    name: "TaxStatementDetailPage",
  },
  "invoice-detail": { mod: "modules/finance/pages/invoice-detail-page", name: "InvoiceDetailPage" },

  "account-settings": {
    mod: "modules/account/pages/account-settings-page",
    name: "AccountSettingsPage",
  },
  "profile-security": {
    mod: "modules/account/pages/profile-security-page",
    name: "ProfileSecurityPage",
  },
  "2fa-setup": { mod: "modules/account/pages/two-factor-setup-page", name: "TwoFactorSetupPage" },
  sessions: { mod: "modules/account/pages/sessions-page", name: "SessionsPage" },
  "api-tokens": { mod: "modules/account/pages/api-tokens-page", name: "ApiTokensPage" },
  "trading-credentials": {
    mod: "modules/account/pages/trading-credentials-page",
    name: "TradingCredentialsPage",
  },
  "notification-center": {
    mod: "modules/account/pages/notification-center-page",
    name: "NotificationCenterPage",
  },
  "notification-preferences": {
    mod: "modules/account/pages/notification-preferences-page",
    name: "NotificationPreferencesPage",
  },

  login: { mod: "modules/onboarding/pages/login-page", name: "LoginPage" },
  "kyc-onboarding": { mod: "modules/onboarding/pages/kyc-onboarding-page", name: "KycOnboardingPage" },
  "kyc-verification-status": {
    mod: "modules/onboarding/pages/kyc-verification-status-page",
    name: "KycVerificationStatusPage",
  },
  "account-verification-1": {
    mod: "modules/onboarding/pages/account-verification-1-page",
    name: "AccountVerification1Page",
  },
  "account-verification-2": {
    mod: "modules/onboarding/pages/account-verification-2-page",
    name: "AccountVerification2Page",
  },
  "account-provisioning": {
    mod: "modules/onboarding/pages/account-provisioning-page",
    name: "AccountProvisioningPage",
  },
  "evaluation-passed": {
    mod: "modules/onboarding/pages/evaluation-passed-page",
    name: "EvaluationPassedPage",
  },
  "account-breach": { mod: "modules/onboarding/pages/account-breach-page", name: "AccountBreachPage" },

  leaderboard: { mod: "modules/community/pages/leaderboard-page", name: "LeaderboardPage" },
  competitions: { mod: "modules/community/pages/competitions-page", name: "CompetitionsPage" },
  referrals: { mod: "modules/community/pages/referral-dashboard-page", name: "ReferralDashboardPage" },

  support: { mod: "modules/support/pages/support-page", name: "SupportPage" },
  "ticket-detail": { mod: "modules/support/pages/ticket-detail-page", name: "TicketDetailPage" },
  "help-center": { mod: "modules/support/pages/help-center-page", name: "HelpCenterPage" },
  "risk-consultation": {
    mod: "modules/support/pages/risk-consultation-page",
    name: "RiskConsultationPage",
  },
  terms: { mod: "modules/support/pages/terms-page", name: "TermsPage" },
};

let count = 0;
for (const [route, { mod, name }] of Object.entries(routes)) {
  const dir = join(root, route);
  mkdirSync(dir, { recursive: true });
  const depth = route.split("/").length + 1;
  const prefix = "../".repeat(depth);
  const content = `import { Suspense } from "react";
import { ${name} } from "${prefix}${mod}";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <${name} />
    </Suspense>
  );
}
`;
  writeFileSync(join(dir, "page.tsx"), content);
  count++;
}
console.log(`Wired ${count} routes.`);
