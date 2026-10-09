/**
 * PFaaS Platform — Dashboard View Router
 *
 * Resolves a view id (from router state) to a React component.
 * Each module contributes its pages to a central view map. This is
 * the single source of truth for client-side view rendering, since
 * only the `/` route is user-visible.
 *
 * Guarded at runtime by the module/permission engines.
 */

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@pfaas/ui";

const ViewSkeleton = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
    <Skeleton className="h-48 w-full max-w-xl" />
  </div>
);

export type ViewComponent = ComponentType<{ params: Record<string, string> }>;

export const viewRegistry: Record<string, ViewComponent> = {
  /* platform */
  overview: dynamic(() => import("@/modules/overview/overview-page").then((m) => ({ default: m.OverviewPage })), { loading: ViewSkeleton }),
  profile: dynamic(() => import("@/modules/profile/profile-page").then((m) => ({ default: m.ProfilePage })), { loading: ViewSkeleton }),
  audit: dynamic(() => import("@/modules/audit/audit-page").then((m) => ({ default: m.AuditPage })), { loading: ViewSkeleton }),
  notifications: dynamic(() => import("@/modules/notifications/notifications-page").then((m) => ({ default: m.NotificationsPage })), { loading: ViewSkeleton }),
  help: dynamic(() => import("@/modules/help/help-page").then((m) => ({ default: m.HelpPage })), { loading: ViewSkeleton }),
  settings: dynamic(() => import("@/modules/settings/settings-page").then((m) => ({ default: m.SettingsPage })), { loading: ViewSkeleton }),
  "terms-policies": dynamic(() => import("@/modules/settings/pages/terms-policies-page").then((m) => ({ default: m.TermsPoliciesPage })), { loading: ViewSkeleton }),
  "pending-tasks": dynamic(() => import("@/modules/pendings/pages/pending-tasks-page").then((m) => ({ default: m.PendingTasksPage })), { loading: ViewSkeleton }),

  /* trading */
  trading: dynamic(() => import("@/modules/trading/pages/trading-stitch-pages").then((m) => ({ default: m.TradingOverviewStitchPage })), { loading: ViewSkeleton }),
  "trading-traders": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages").then((m) => ({ default: m.TradersStitchPage })), { loading: ViewSkeleton }),
  "trading-accounts": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages").then((m) => ({ default: m.AccountsStitchPage })), { loading: ViewSkeleton }),
  "trading-positions": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages").then((m) => ({ default: m.PositionsStitchPage })), { loading: ViewSkeleton }),
  "trader-detail": dynamic(() => import("@/modules/trading/pages/trader-detail-stitch-page").then((m) => ({ default: m.TraderDetailStitchPage })), { loading: ViewSkeleton }),
  "trading-add-account": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.AddAccountStitchPage })), { loading: ViewSkeleton }),
  "closed-positions": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.ClosedPositionsStitchPage })), { loading: ViewSkeleton }),
  "closed-position-detail": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.ClosedPositionDetailStitchPage })), { loading: ViewSkeleton }),
  "trading-credentials": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.TradingCredentialsStitchPage })), { loading: ViewSkeleton }),
  "trader-comparison": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.TraderComparisonStitchPage })), { loading: ViewSkeleton }),
  "bridge-sync-log": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.BridgeSyncLogStitchPage })), { loading: ViewSkeleton }),
  "trader-audit-log": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.TraderAuditLogStitchPage })), { loading: ViewSkeleton }),
  "mt4-dxtrade-server-catalog": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.ServerCatalogStitchPage })), { loading: ViewSkeleton }),
  "server-catalog": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.ServerCatalogStitchPage })), { loading: ViewSkeleton }),
  "bulk-account-operations": dynamic(() => import("@/modules/trading/pages/trading-stitch-pages-2").then((m) => ({ default: m.BulkAccountOperationsStitchPage })), { loading: ViewSkeleton }),
  "account-broker-details": dynamic(() => import("@/modules/trading/pages/account-broker-details-page").then((m) => ({ default: m.AccountBrokerDetailsPage })), { loading: ViewSkeleton }),
  "account-kyc-statuses": dynamic(() => import("@/modules/trading/pages/account-kyc-statuses-page").then((m) => ({ default: m.AccountKycStatusesPage })), { loading: ViewSkeleton }),
  "account-related-accounts": dynamic(() => import("@/modules/trading/pages/account-related-accounts-page").then((m) => ({ default: m.AccountRelatedAccountsPage })), { loading: ViewSkeleton }),
  "account-configuration": dynamic(() => import("@/modules/trading/pages/account-configuration-page").then((m) => ({ default: m.AccountConfigurationPage })), { loading: ViewSkeleton }),
  "account-events": dynamic(() => import("@/modules/trading/pages/account-events-page").then((m) => ({ default: m.AccountEventsPage })), { loading: ViewSkeleton }),
  "account-version-history": dynamic(() => import("@/modules/trading/pages/account-version-history-page").then((m) => ({ default: m.AccountVersionHistoryPage })), { loading: ViewSkeleton }),
  "account-workspace": dynamic(() => import("@/modules/trading/pages/account-workspace-stitch-page").then((m) => ({ default: m.AccountWorkspaceStitchPage })), { loading: ViewSkeleton }),
  "order-detail": dynamic(() => import("@/modules/trading/pages/order-detail-page").then((m) => ({ default: m.OrderDetailPage })), { loading: ViewSkeleton }),
  orders: dynamic(() => import("@/modules/trading/pages/orders-page").then((m) => ({ default: m.OrdersPage })), { loading: ViewSkeleton }),
  objectives: dynamic(() => import("@/modules/trading/pages/objectives-progress-page").then((m) => ({ default: m.ObjectivesProgressPage })), { loading: ViewSkeleton }),
  rules: dynamic(() => import("@/modules/trading/pages/rules-page").then((m) => ({ default: m.RulesPage })), { loading: ViewSkeleton }),
  "account-breach": dynamic(() => import("@/modules/trading/pages/account-breach-page").then((m) => ({ default: m.AccountBreachPage })), { loading: ViewSkeleton }),
  "account-provisioning": dynamic(() => import("@/modules/trading/pages/account-provisioning-page").then((m) => ({ default: m.AccountProvisioningPage })), { loading: ViewSkeleton }),
  "evaluation-passed": dynamic(() => import("@/modules/trading/pages/evaluation-passed-page").then((m) => ({ default: m.EvaluationPassedPage })), { loading: ViewSkeleton }),
  "purchase-history": dynamic(() => import("@/modules/trading/pages/purchase-history-page").then((m) => ({ default: m.PurchaseHistoryPage })), { loading: ViewSkeleton }),

  /* challenges */
  challenges: dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengesOverviewStitchPage })), { loading: ViewSkeleton }),
  "challenges-active": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ActiveChallengesStitchPage })), { loading: ViewSkeleton }),
  "challenges-passed": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.PassedChallengesStitchPage })), { loading: ViewSkeleton }),
  "challenges-failed": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.FailedChallengesStitchPage })), { loading: ViewSkeleton }),
  "challenge-wizard": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeWizardStitchPage })), { loading: ViewSkeleton }),
  "challenge-config": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeConfigStitchPage })), { loading: ViewSkeleton }),
  "challenge-types": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeTypesStitchPage })), { loading: ViewSkeleton }),
  "challenge-marketplace-preview": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeMarketplacePreviewStitchPage })), { loading: ViewSkeleton }),
  "challenge-comparison": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeComparisonStitchPage })), { loading: ViewSkeleton }),
  "challenge-analytics": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeAnalyticsStitchPage })), { loading: ViewSkeleton }),
  "phase-migration-tool": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.PhaseMigrationToolStitchPage })), { loading: ViewSkeleton }),
  "bulk-phase-editor": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.BulkPhaseEditorStitchPage })), { loading: ViewSkeleton }),
  competitions: dynamic(() => import("@/modules/challenges/pages/competitions-page").then((m) => ({ default: m.CompetitionsPage })), { loading: ViewSkeleton }),
  "challenge-marketplace": dynamic(() => import("@/modules/challenges/pages/challenge-marketplace-page").then((m) => ({ default: m.ChallengeMarketplacePage })), { loading: ViewSkeleton }),
  checkout: dynamic(() => import("@/modules/challenges/pages/checkout-page").then((m) => ({ default: m.CheckoutPage })), { loading: ViewSkeleton }),
  "purchase-completed": dynamic(() => import("@/modules/challenges/pages/purchase-completed-page").then((m) => ({ default: m.PurchaseCompletedPage })), { loading: ViewSkeleton }),
  "phase-management": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.PhaseManagementStitchPage })), { loading: ViewSkeleton }),
  "challenge-edit": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.ChallengeEditStitchPage })), { loading: ViewSkeleton }),
  "phase-detail": dynamic(() => import("@/modules/challenges/pages/challenges-stitch-pages").then((m) => ({ default: m.PhaseDetailStitchPage })), { loading: ViewSkeleton }),

  /* risk */
  risk: dynamic(() => import("@/modules/risk/pages/risk-pages").then((m) => ({ default: m.RiskOverviewPage })), { loading: ViewSkeleton }),
  breaches: dynamic(() => import("@/modules/risk/pages/risk-pages").then((m) => ({ default: m.BreachesPage })), { loading: ViewSkeleton }),
  "risk-cases": dynamic(() => import("@/modules/risk/pages/risk-cases-page").then((m) => ({ default: m.RiskCasesPage })), { loading: ViewSkeleton }),
  "risk-statistics": dynamic(() => import("@/modules/risk/pages/risk-statistics-page").then((m) => ({ default: m.RiskStatisticsPage })), { loading: ViewSkeleton }),
  "trading-events": dynamic(() => import("@/modules/risk/pages/trading-events-page").then((m) => ({ default: m.TradingEventsPage })), { loading: ViewSkeleton }),
  "copy-trading-events": dynamic(() => import("@/modules/risk/pages/copy-trading-events-page").then((m) => ({ default: m.CopyTradingEventsPage })), { loading: ViewSkeleton }),
  "copy-trading-analysis": dynamic(() => import("@/modules/risk/pages/copy-trading-analysis-page").then((m) => ({ default: m.CopyTradingAnalysisPage })), { loading: ViewSkeleton }),
  "inverse-trading-events": dynamic(() => import("@/modules/risk/pages/inverse-trading-events-page").then((m) => ({ default: m.InverseTradingEventsPage })), { loading: ViewSkeleton }),
  "account-ip-addresses": dynamic(() => import("@/modules/risk/pages/account-ip-addresses-page").then((m) => ({ default: m.AccountIpAddressesPage })), { loading: ViewSkeleton }),
  "weekend-trades": dynamic(() => import("@/modules/risk/pages/weekend-trades-page").then((m) => ({ default: m.WeekendTradesPage })), { loading: ViewSkeleton }),
  "risk-unprofitable-countries": dynamic(() => import("@/modules/risk/pages/risk-unprofitable-countries-page").then((m) => ({ default: m.RiskUnprofitableCountriesPage })), { loading: ViewSkeleton }),
  "risk-revenue-loss": dynamic(() => import("@/modules/risk/pages/risk-revenue-loss-page").then((m) => ({ default: m.RiskRevenueLossPage })), { loading: ViewSkeleton }),
  "risk-label-vs-payouts": dynamic(() => import("@/modules/risk/pages/risk-label-vs-payouts-page").then((m) => ({ default: m.RiskLabelVsPayoutsPage })), { loading: ViewSkeleton }),
  "risk-highest-earners": dynamic(() => import("@/modules/risk/pages/risk-highest-earners-page").then((m) => ({ default: m.RiskHighestEarnersPage })), { loading: ViewSkeleton }),
  "risk-group-vs-payouts": dynamic(() => import("@/modules/risk/pages/risk-group-vs-payouts-page").then((m) => ({ default: m.RiskGroupVsPayoutsPage })), { loading: ViewSkeleton }),
  "risk-coupon-vs-payouts": dynamic(() => import("@/modules/risk/pages/risk-coupon-vs-payouts-page").then((m) => ({ default: m.RiskCouponVsPayoutsPage })), { loading: ViewSkeleton }),
  "risk-account-label-analysis": dynamic(() => import("@/modules/risk/pages/risk-account-label-analysis-page").then((m) => ({ default: m.RiskAccountLabelAnalysisPage })), { loading: ViewSkeleton }),
  "risk-addon-revenue": dynamic(() => import("@/modules/risk/pages/risk-addon-revenue-page").then((m) => ({ default: m.RiskAddonRevenuePage })), { loading: ViewSkeleton }),

  /* payouts */
  payouts: dynamic(() => import("@/modules/payouts/pages/payout-pages").then((m) => ({ default: m.PayoutsOverviewPage })), { loading: ViewSkeleton }),
  "payouts-pending": dynamic(() => import("@/modules/payouts/pages/payout-pages").then((m) => ({ default: m.PendingPayoutsPage })), { loading: ViewSkeleton }),
  "payouts-history": dynamic(() => import("@/modules/payouts/pages/payout-pages").then((m) => ({ default: m.PayoutHistoryPage })), { loading: ViewSkeleton }),
  "payouts-enhanced-withdrawals": dynamic(() => import("@/modules/payouts/pages/enhanced-withdrawals-page").then((m) => ({ default: m.EnhancedWithdrawalsPage })), { loading: ViewSkeleton }),
  "payout-provider-status": dynamic(() => import("@/modules/payouts/pages/payout-provider-status-page").then((m) => ({ default: m.PayoutProviderStatusPage })), { loading: ViewSkeleton }),
  "payout-eligibility": dynamic(() => import("@/modules/payouts/pages/payout-request-page").then((m) => ({ default: m.PayoutEligibilityPage })), { loading: ViewSkeleton }),
  "payout-request": dynamic(() => import("@/modules/payouts/pages/payout-request-form-page").then((m) => ({ default: m.PayoutRequestFormPage })), { loading: ViewSkeleton }),

  /* analytics */
  analytics: dynamic(() => import("@/modules/analytics/pages/analytics-pages").then((m) => ({ default: m.AnalyticsOverviewPage })), { loading: ViewSkeleton }),
  "analytics-traders": dynamic(() => import("@/modules/analytics/pages/analytics-pages").then((m) => ({ default: m.TraderAnalyticsPage })), { loading: ViewSkeleton }),
  "analytics-performance": dynamic(() => import("@/modules/analytics/pages/analytics-pages").then((m) => ({ default: m.PerformanceAnalyticsPage })), { loading: ViewSkeleton }),
  "analytics-risk": dynamic(() => import("@/modules/analytics/pages/analytics-pages").then((m) => ({ default: m.RiskAnalyticsPage })), { loading: ViewSkeleton }),
  "analytics-advanced": dynamic(() => import("@/modules/analytics/pages/analytics-pages").then((m) => ({ default: m.AdvancedAnalyticsPage })), { loading: ViewSkeleton }),
  reports: dynamic(() => import("@/modules/analytics/pages/reports-page").then((m) => ({ default: m.ReportsPage })), { loading: ViewSkeleton }),
  "trader-performance": dynamic(() => import("@/modules/analytics/pages/performance-analytics-page").then((m) => ({ default: m.TraderPerformancePage })), { loading: ViewSkeleton }),
  "analytics-firm-statistics": dynamic(() => import("@/modules/analytics/pages/firm-statistics-page").then((m) => ({ default: m.FirmStatisticsPage })), { loading: ViewSkeleton }),
  "analytics-daily-highlights": dynamic(() => import("@/modules/analytics/pages/daily-highlights-page").then((m) => ({ default: m.DailyHighlightsPage })), { loading: ViewSkeleton }),
  "analytics-retention": dynamic(() => import("@/modules/analytics/pages/retention-analytics-page").then((m) => ({ default: m.RetentionAnalyticsPage })), { loading: ViewSkeleton }),
  "dashboard-accounts": dynamic(() => import("@/modules/analytics/pages/dashboard-tabs").then((m) => ({ default: m.DashboardAccountsTab })), { loading: ViewSkeleton }),
  "dashboard-payouts": dynamic(() => import("@/modules/analytics/pages/dashboard-tabs").then((m) => ({ default: m.DashboardPayoutsTab })), { loading: ViewSkeleton }),
  "dashboard-orders": dynamic(() => import("@/modules/analytics/pages/dashboard-tabs").then((m) => ({ default: m.DashboardOrdersTab })), { loading: ViewSkeleton }),
  "dashboard-positions": dynamic(() => import("@/modules/analytics/pages/dashboard-tabs").then((m) => ({ default: m.DashboardPositionsTab })), { loading: ViewSkeleton }),

  /* affiliates */
  affiliates: dynamic(() => import("@/modules/affiliates/pages/affiliate-pages").then((m) => ({ default: m.AffiliatesOverviewPage })), { loading: ViewSkeleton }),
  "affiliates-list": dynamic(() => import("@/modules/affiliates/pages/affiliate-pages").then((m) => ({ default: m.AffiliatesListPage })), { loading: ViewSkeleton }),
  "affiliates-campaigns": dynamic(() => import("@/modules/affiliates/pages/affiliate-pages").then((m) => ({ default: m.AffiliateCampaignsPage })), { loading: ViewSkeleton }),
  "affiliates-commissions": dynamic(() => import("@/modules/affiliates/pages/affiliate-pages").then((m) => ({ default: m.AffiliateCommissionsPage })), { loading: ViewSkeleton }),
  "offer-management": dynamic(() => import("@/modules/affiliates/pages/offer-management-page").then((m) => ({ default: m.OfferManagementPage })), { loading: ViewSkeleton }),
  "offer-edit": dynamic(() => import("@/modules/affiliates/pages/offer-edit-page").then((m) => ({ default: m.OfferEditPage })), { loading: ViewSkeleton }),
  "offer-matching-users": dynamic(() => import("@/modules/affiliates/pages/offer-matching-users-page").then((m) => ({ default: m.OfferMatchingUsersPage })), { loading: ViewSkeleton }),
  "offer-change-history": dynamic(() => import("@/modules/affiliates/pages/offer-change-history-page").then((m) => ({ default: m.OfferChangeHistoryPage })), { loading: ViewSkeleton }),
  "affiliate-coupons": dynamic(() => import("@/modules/affiliates/pages/affiliate-coupons-page").then((m) => ({ default: m.AffiliateCouponsPage })), { loading: ViewSkeleton }),
  "affiliate-link-tracking": dynamic(() => import("@/modules/affiliates/pages/affiliate-link-tracking-page").then((m) => ({ default: m.AffiliateLinkTrackingPage })), { loading: ViewSkeleton }),

  /* accounting */
  accounting: dynamic(() => import("@/modules/accounting/pages/accounting-pages").then((m) => ({ default: m.AccountingOverviewPage })), { loading: ViewSkeleton }),
  "accounting-transactions": dynamic(() => import("@/modules/accounting/pages/accounting-pages").then((m) => ({ default: m.TransactionsPage })), { loading: ViewSkeleton }),
  "accounting-reconciliation": dynamic(() => import("@/modules/accounting/pages/accounting-pages").then((m) => ({ default: m.ReconciliationPage })), { loading: ViewSkeleton }),
  "accounting-invoices": dynamic(() => import("@/modules/accounting/pages/accounting-invoices-page").then((m) => ({ default: m.AccountingInvoicesPage })), { loading: ViewSkeleton }),
  "accounting-pl": dynamic(() => import("@/modules/accounting/pages/accounting-pl-page").then((m) => ({ default: m.AccountingPlPage })), { loading: ViewSkeleton }),

  /* marketing */
  marketing: dynamic(() => import("@/modules/marketing/pages/marketing-pages").then((m) => ({ default: m.MarketingOverviewPage })), { loading: ViewSkeleton }),
  "marketing-campaigns": dynamic(() => import("@/modules/marketing/pages/marketing-pages").then((m) => ({ default: m.MarketingCampaignsPage })), { loading: ViewSkeleton }),
  "marketing-performance": dynamic(() => import("@/modules/marketing/pages/marketing-pages").then((m) => ({ default: m.MarketingPerformancePage })), { loading: ViewSkeleton }),
  "marketing-dashboard": dynamic(() => import("@/modules/marketing/pages/marketing-dashboard-page").then((m) => ({ default: m.MarketingDashboardPage })), { loading: ViewSkeleton }),
  "marketing-email-campaigns": dynamic(() => import("@/modules/marketing/pages/marketing-email-campaigns-page").then((m) => ({ default: m.MarketingEmailCampaignsPage })), { loading: ViewSkeleton }),
  "marketing-ad-spend": dynamic(() => import("@/modules/marketing/pages/marketing-ad-spend-page").then((m) => ({ default: m.MarketingAdSpendPage })), { loading: ViewSkeleton }),

  /* crm */
  crm: dynamic(() => import("@/modules/crm/pages/crm-pages").then((m) => ({ default: m.CrmOverviewPage })), { loading: ViewSkeleton }),
  "crm-contacts": dynamic(() => import("@/modules/crm/pages/crm-pages").then((m) => ({ default: m.CrmContactsPage })), { loading: ViewSkeleton }),
  "crm-pipeline": dynamic(() => import("@/modules/crm/pages/crm-pages").then((m) => ({ default: m.CrmPipelinePage })), { loading: ViewSkeleton }),

  /* kyc */
  kyc: dynamic(() => import("@/modules/kyc/pages/kyc-pages").then((m) => ({ default: m.KycOverviewPage })), { loading: ViewSkeleton }),
  "kyc-reviews": dynamic(() => import("@/modules/kyc/pages/kyc-pages").then((m) => ({ default: m.KycReviewsPage })), { loading: ViewSkeleton }),
  "kyc-risk": dynamic(() => import("@/modules/kyc/pages/kyc-pages").then((m) => ({ default: m.KycRiskPage })), { loading: ViewSkeleton }),
  "kyc-document-requests": dynamic(() => import("@/modules/kyc/pages/kyc-document-requests-page").then((m) => ({ default: m.KycDocumentRequestsPage })), { loading: ViewSkeleton }),
  "kyc-onboarding": dynamic(() => import("@/modules/kyc/pages/kyc-onboarding-page").then((m) => ({ default: m.KycOnboardingPage })), { loading: ViewSkeleton }),
  "kyc-status": dynamic(() => import("@/modules/kyc/pages/kyc-status-page").then((m) => ({ default: m.KycStatusPage })), { loading: ViewSkeleton }),

  /* support */
  support: dynamic(() => import("@/modules/support/pages/support-pages").then((m) => ({ default: m.SupportOverviewPage })), { loading: ViewSkeleton }),
  "support-tickets": dynamic(() => import("@/modules/support/pages/support-pages").then((m) => ({ default: m.SupportTicketsPage })), { loading: ViewSkeleton }),
  "support-knowledge": dynamic(() => import("@/modules/support/pages/support-pages").then((m) => ({ default: m.SupportKnowledgePage })), { loading: ViewSkeleton }),
  "support-sla": dynamic(() => import("@/modules/support/pages/support-sla-page").then((m) => ({ default: m.SupportSlaPage })), { loading: ViewSkeleton }),

  /* ai */
  ai: dynamic(() => import("@/modules/ai/pages/ai-pages").then((m) => ({ default: m.AiOverviewPage })), { loading: ViewSkeleton }),
  "ai-insights": dynamic(() => import("@/modules/ai/pages/ai-pages").then((m) => ({ default: m.AiInsightsPage })), { loading: ViewSkeleton }),
  "ai-assistant": dynamic(() => import("@/modules/ai/pages/ai-pages").then((m) => ({ default: m.AiAssistantPage })), { loading: ViewSkeleton }),
  "ai-configure": dynamic(() => import("@/modules/ai/pages/ai-pages").then((m) => ({ default: m.AiConfigurePage })), { loading: ViewSkeleton }),
  "ai-predictive": dynamic(() => import("@/modules/ai/pages/ai-predictive-page").then((m) => ({ default: m.AiPredictivePage })), { loading: ViewSkeleton }),
  "ai-anomaly": dynamic(() => import("@/modules/ai/pages/ai-anomaly-page").then((m) => ({ default: m.AiAnomalyPage })), { loading: ViewSkeleton }),
  "ai-cost": dynamic(() => import("@/modules/ai/pages/ai-cost-page").then((m) => ({ default: m.AiCostPage })), { loading: ViewSkeleton }),

  /* audit — new flows */
  "audit-user-events": dynamic(() => import("@/modules/audit/user-events-page").then((m) => ({ default: m.UserEventsPage })), { loading: ViewSkeleton }),
  "audit-change-history": dynamic(() => import("@/modules/audit/change-history-page").then((m) => ({ default: m.ChangeHistoryPage })), { loading: ViewSkeleton }),
  "audit-user-event-detail": dynamic(() => import("@/modules/audit/user-event-detail-page").then((m) => ({ default: m.UserEventDetailPage })), { loading: ViewSkeleton }),

  /* settings — new flows */
  "email-templates": dynamic(() => import("@/modules/settings/pages/email-templates-page").then((m) => ({ default: m.EmailTemplatesPage })), { loading: ViewSkeleton }),
  "certificate-management": dynamic(() => import("@/modules/settings/pages/certificate-management-page").then((m) => ({ default: m.CertificateManagementPage })), { loading: ViewSkeleton }),
  "banner-management": dynamic(() => import("@/modules/settings/pages/banner-management-page").then((m) => ({ default: m.BannerManagementPage })), { loading: ViewSkeleton }),
  "user-management": dynamic(() => import("@/modules/settings/pages/user-management-page").then((m) => ({ default: m.UserManagementPage })), { loading: ViewSkeleton }),
  "group-management": dynamic(() => import("@/modules/settings/pages/group-management-page").then((m) => ({ default: m.GroupManagementPage })), { loading: ViewSkeleton }),
  "token-management": dynamic(() => import("@/modules/settings/pages/token-management-page").then((m) => ({ default: m.TokenManagementPage })), { loading: ViewSkeleton }),
  "certificates-issued": dynamic(() => import("@/modules/settings/pages/certificates-issued-page").then((m) => ({ default: m.CertificatesIssuedPage })), { loading: ViewSkeleton }),
  "certificate-detail": dynamic(() => import("@/modules/settings/pages/certificate-detail-page").then((m) => ({ default: m.CertificateDetailPage })), { loading: ViewSkeleton }),
  "notifications-management": dynamic(() => import("@/modules/settings/pages/notifications-management-page").then((m) => ({ default: m.NotificationsManagementPage })), { loading: ViewSkeleton }),
  "notification-edit": dynamic(() => import("@/modules/settings/pages/notification-edit-page").then((m) => ({ default: m.NotificationEditPage })), { loading: ViewSkeleton }),
  "utilities": dynamic(() => import("@/modules/settings/pages/utilities-page").then((m) => ({ default: m.UtilitiesPage })), { loading: ViewSkeleton }),
  "email-template-edit": dynamic(() => import("@/modules/settings/pages/email-template-edit-page").then((m) => ({ default: m.EmailTemplateEditPage })), { loading: ViewSkeleton }),
  "certificate-template-designer": dynamic(() => import("@/modules/settings/pages/certificate-template-designer-page").then((m) => ({ default: m.CertificateTemplateDesignerPage })), { loading: ViewSkeleton }),
  "certificate-font-upload": dynamic(() => import("@/modules/settings/pages/certificate-font-upload-page").then((m) => ({ default: m.CertificateFontUploadPage })), { loading: ViewSkeleton }),
  "marketing-integrations": dynamic(() => import("@/modules/settings/pages/marketing-integrations-page").then((m) => ({ default: m.MarketingIntegrationsPage })), { loading: ViewSkeleton }),
  "marketing-banner-edit": dynamic(() => import("@/modules/settings/pages/marketing-banner-edit-page").then((m) => ({ default: m.MarketingBannerEditPage })), { loading: ViewSkeleton }),
  "social-media-links": dynamic(() => import("@/modules/settings/pages/social-media-links-page").then((m) => ({ default: m.SocialMediaLinksPage })), { loading: ViewSkeleton }),
  "device-activities": dynamic(() => import("@/modules/settings/pages/device-activities-page").then((m) => ({ default: m.DeviceActivitiesPage })), { loading: ViewSkeleton }),
  "token-detail": dynamic(() => import("@/modules/settings/pages/token-detail-page").then((m) => ({ default: m.TokenDetailPage })), { loading: ViewSkeleton }),
  "audit-user-events-enhanced": dynamic(() => import("@/modules/audit/enhanced-user-events-page").then((m) => ({ default: m.EnhancedUserEventsPage })), { loading: ViewSkeleton }),
  "kyc-providers": dynamic(() => import("@/modules/settings/pages/kyc-providers-page").then((m) => ({ default: m.KycProvidersPage })), { loading: ViewSkeleton }),
  /* stitch — screens wired from modules/stitch/pages */
  "2fa-setup-dialog": dynamic(() => import("@/modules/stitch/pages/2fa-setup-dialog").then((m) => ({ default: m.Screen2faSetupDialogStitchPage })), { loading: ViewSkeleton }),
  "notification-center": dynamic(() => import("@/modules/stitch/pages/notification-center").then((m) => ({ default: m.NotificationCenterStitchPage })), { loading: ViewSkeleton }),
  "audit-log": dynamic(() => import("@/modules/stitch/pages/audit-log").then((m) => ({ default: m.AuditLogStitchPage })), { loading: ViewSkeleton }),
  "enhanced-user-events": dynamic(() => import("@/modules/stitch/pages/enhanced-user-events-page").then((m) => ({ default: m.EnhancedUserEventsPageStitchPage })), { loading: ViewSkeleton }),
  "transactions": dynamic(() => import("@/modules/stitch/pages/transactions").then((m) => ({ default: m.TransactionsStitchPage })), { loading: ViewSkeleton }),
  "reviewer-audit-trail": dynamic(() => import("@/modules/stitch/pages/reviewer-audit-trail").then((m) => ({ default: m.ReviewerAuditTrailStitchPage })), { loading: ViewSkeleton }),
  "account-linkage-graph": dynamic(() => import("@/modules/stitch/pages/account-linkage-graph").then((m) => ({ default: m.AccountLinkageGraphStitchPage })), { loading: ViewSkeleton }),
  "add-group-sheet": dynamic(() => import("@/modules/stitch/pages/add-group-sheet").then((m) => ({ default: m.AddGroupSheetStitchPage })), { loading: ViewSkeleton }),
  "affiliate-commission-payout": dynamic(() => import("@/modules/stitch/pages/affiliate-commission-payout").then((m) => ({ default: m.AffiliateCommissionPayoutStitchPage })), { loading: ViewSkeleton }),
  "affiliate-comparison": dynamic(() => import("@/modules/stitch/pages/affiliate-comparison").then((m) => ({ default: m.AffiliateComparisonStitchPage })), { loading: ViewSkeleton }),
  "affiliate-detail": dynamic(() => import("@/modules/stitch/pages/affiliate-detail").then((m) => ({ default: m.AffiliateDetailStitchPage })), { loading: ViewSkeleton }),
  "affiliate-onboarding": dynamic(() => import("@/modules/stitch/pages/affiliate-onboarding").then((m) => ({ default: m.AffiliateOnboardingStitchPage })), { loading: ViewSkeleton }),
  "ai-finetuning": dynamic(() => import("@/modules/stitch/pages/ai-finetuning").then((m) => ({ default: m.AiFinetuningStitchPage })), { loading: ViewSkeleton }),
  "ai-model-audit": dynamic(() => import("@/modules/stitch/pages/ai-model-audit").then((m) => ({ default: m.AiModelAuditStitchPage })), { loading: ViewSkeleton }),
  "ai-prompt-library": dynamic(() => import("@/modules/stitch/pages/ai-prompt-library").then((m) => ({ default: m.AiPromptLibraryStitchPage })), { loading: ViewSkeleton }),
  "ai-quota": dynamic(() => import("@/modules/stitch/pages/ai-quota").then((m) => ({ default: m.AiQuotaStitchPage })), { loading: ViewSkeleton }),
  "ai-training-export": dynamic(() => import("@/modules/stitch/pages/ai-training-export").then((m) => ({ default: m.AiTrainingExportStitchPage })), { loading: ViewSkeleton }),
  "audit-compliance-report": dynamic(() => import("@/modules/stitch/pages/audit-compliance-report").then((m) => ({ default: m.AuditComplianceReportStitchPage })), { loading: ViewSkeleton }),
  "audit-retention": dynamic(() => import("@/modules/stitch/pages/audit-retention").then((m) => ({ default: m.AuditRetentionStitchPage })), { loading: ViewSkeleton }),
  "audit-severity-policy": dynamic(() => import("@/modules/stitch/pages/audit-severity-policy").then((m) => ({ default: m.AuditSeverityPolicyStitchPage })), { loading: ViewSkeleton }),
  "audit-siem": dynamic(() => import("@/modules/stitch/pages/audit-siem").then((m) => ({ default: m.AuditSiemStitchPage })), { loading: ViewSkeleton }),
  "bank-statement-import": dynamic(() => import("@/modules/stitch/pages/bank-statement-import").then((m) => ({ default: m.BankStatementImportStitchPage })), { loading: ViewSkeleton }),
  "breach-detail": dynamic(() => import("@/modules/stitch/pages/breach-detail").then((m) => ({ default: m.BreachDetailStitchPage })), { loading: ViewSkeleton }),
  "certificatesissued": dynamic(() => import("@/modules/stitch/pages/certificatesissued").then((m) => ({ default: m.CertificatesIssuedStitchPage })), { loading: ViewSkeleton }),
  "change-password-dialog": dynamic(() => import("@/modules/stitch/pages/change-password-dialog").then((m) => ({ default: m.ChangePasswordDialogStitchPage })), { loading: ViewSkeleton }),
  "chart-of-accounts": dynamic(() => import("@/modules/stitch/pages/chart-of-accounts").then((m) => ({ default: m.ChartOfAccountsStitchPage })), { loading: ViewSkeleton }),
  "checkout-external": dynamic(() => import("@/modules/stitch/pages/checkout-external").then((m) => ({ default: m.CheckoutExternalStitchPage })), { loading: ViewSkeleton }),
  "checkout-providers": dynamic(() => import("@/modules/stitch/pages/checkout-providers").then((m) => ({ default: m.CheckoutProvidersStitchPage })), { loading: ViewSkeleton }),
  "checkout-psp-onboarding": dynamic(() => import("@/modules/stitch/pages/checkout-psp-onboarding").then((m) => ({ default: m.CheckoutPspOnboardingStitchPage })), { loading: ViewSkeleton }),
  "checkout-refund-dispute": dynamic(() => import("@/modules/stitch/pages/checkout-refund-dispute").then((m) => ({ default: m.CheckoutRefundDisputeStitchPage })), { loading: ViewSkeleton }),
  "checkout-settlement": dynamic(() => import("@/modules/stitch/pages/checkout-settlement").then((m) => ({ default: m.CheckoutSettlementStitchPage })), { loading: ViewSkeleton }),
  "checkout-transactions": dynamic(() => import("@/modules/stitch/pages/checkout-transactions").then((m) => ({ default: m.CheckoutTransactionsStitchPage })), { loading: ViewSkeleton }),
  "checkout-webhook-log": dynamic(() => import("@/modules/stitch/pages/checkout-webhook-log").then((m) => ({ default: m.CheckoutWebhookLogStitchPage })), { loading: ViewSkeleton }),
  "cohort-builder": dynamic(() => import("@/modules/stitch/pages/cohort-builder").then((m) => ({ default: m.CohortBuilderStitchPage })), { loading: ViewSkeleton }),
  "connected-sessions-detail": dynamic(() => import("@/modules/stitch/pages/connected-sessions-detail").then((m) => ({ default: m.ConnectedSessionsDetailStitchPage })), { loading: ViewSkeleton }),
  "cookie-attribution": dynamic(() => import("@/modules/stitch/pages/cookie-attribution").then((m) => ({ default: m.CookieAttributionStitchPage })), { loading: ViewSkeleton }),
  "crm-activity-log": dynamic(() => import("@/modules/stitch/pages/crm-activity-log").then((m) => ({ default: m.CrmActivityLogStitchPage })), { loading: ViewSkeleton }),
  "crm-contact-create": dynamic(() => import("@/modules/stitch/pages/crm-contact-create").then((m) => ({ default: m.CrmContactCreateStitchPage })), { loading: ViewSkeleton }),
  "crm-lead-scoring": dynamic(() => import("@/modules/stitch/pages/crm-lead-scoring").then((m) => ({ default: m.CrmLeadScoringStitchPage })), { loading: ViewSkeleton }),
  "csv-import-dialog": dynamic(() => import("@/modules/stitch/pages/csv-import-dialog").then((m) => ({ default: m.CsvImportDialogStitchPage })), { loading: ViewSkeleton }),
  "custom-segmentation": dynamic(() => import("@/modules/stitch/pages/custom-segmentation").then((m) => ({ default: m.CustomSegmentationStitchPage })), { loading: ViewSkeleton }),
  "dashboard-template-library": dynamic(() => import("@/modules/stitch/pages/dashboard-template-library").then((m) => ({ default: m.DashboardTemplateLibraryStitchPage })), { loading: ViewSkeleton }),
  "device-detail": dynamic(() => import("@/modules/stitch/pages/device-detail").then((m) => ({ default: m.DeviceDetailStitchPage })), { loading: ViewSkeleton }),
  "financial-reports-library": dynamic(() => import("@/modules/stitch/pages/financial-reports-library").then((m) => ({ default: m.FinancialReportsLibraryStitchPage })), { loading: ViewSkeleton }),
  "help-changelog": dynamic(() => import("@/modules/stitch/pages/help-changelog").then((m) => ({ default: m.HelpChangelogStitchPage })), { loading: ViewSkeleton }),
  "help-module-detail": dynamic(() => import("@/modules/stitch/pages/help-module-detail").then((m) => ({ default: m.HelpModuleDetailStitchPage })), { loading: ViewSkeleton }),
  "journal-entries": dynamic(() => import("@/modules/stitch/pages/journal-entries").then((m) => ({ default: m.JournalEntriesStitchPage })), { loading: ViewSkeleton }),
  "kyc-aml-cases": dynamic(() => import("@/modules/stitch/pages/kyc-aml-cases").then((m) => ({ default: m.KycAmlCasesStitchPage })), { loading: ViewSkeleton }),
  "kyc-provider-marketplace": dynamic(() => import("@/modules/stitch/pages/kyc-provider-marketplace").then((m) => ({ default: m.KycProviderMarketplaceStitchPage })), { loading: ViewSkeleton }),
  "kyc-record-detail": dynamic(() => import("@/modules/stitch/pages/kyc-record-detail").then((m) => ({ default: m.KycRecordDetailStitchPage })), { loading: ViewSkeleton }),
  "kyc-reviewer-trail": dynamic(() => import("@/modules/stitch/pages/kyc-reviewer-trail").then((m) => ({ default: m.KycReviewerTrailStitchPage })), { loading: ViewSkeleton }),
  "marketing-ad-accounts": dynamic(() => import("@/modules/stitch/pages/marketing-ad-accounts").then((m) => ({ default: m.MarketingAdAccountsStitchPage })), { loading: ViewSkeleton }),
  "marketing-audience-builder": dynamic(() => import("@/modules/stitch/pages/marketing-audience-builder").then((m) => ({ default: m.MarketingAudienceBuilderStitchPage })), { loading: ViewSkeleton }),
  "marketing-campaign-detail": dynamic(() => import("@/modules/stitch/pages/marketing-campaign-detail").then((m) => ({ default: m.MarketingCampaignDetailStitchPage })), { loading: ViewSkeleton }),
  "marketing-template-editor": dynamic(() => import("@/modules/stitch/pages/marketing-template-editor").then((m) => ({ default: m.MarketingTemplateEditorStitchPage })), { loading: ViewSkeleton }),
  "my-tasks": dynamic(() => import("@/modules/stitch/pages/my-tasks").then((m) => ({ default: m.MyTasksStitchPage })), { loading: ViewSkeleton }),
  "notification-detail-dialog": dynamic(() => import("@/modules/stitch/pages/notification-detail-dialog").then((m) => ({ default: m.NotificationDetailDialogStitchPage })), { loading: ViewSkeleton }),
  "notification-preferences-matrix": dynamic(() => import("@/modules/stitch/pages/notification-preferences-matrix").then((m) => ({ default: m.NotificationPreferencesMatrixStitchPage })), { loading: ViewSkeleton }),
  "notifications-archived": dynamic(() => import("@/modules/stitch/pages/notifications-archived").then((m) => ({ default: m.NotificationsArchivedStitchPage })), { loading: ViewSkeleton }),
  "overview-onboarding-tour": dynamic(() => import("@/modules/stitch/pages/overview-onboarding-tour").then((m) => ({ default: m.OverviewOnboardingTourStitchPage })), { loading: ViewSkeleton }),
  "overview-saved-views": dynamic(() => import("@/modules/stitch/pages/overview-saved-views").then((m) => ({ default: m.OverviewSavedViewsStitchPage })), { loading: ViewSkeleton }),
  "payout-compliance": dynamic(() => import("@/modules/stitch/pages/payout-compliance").then((m) => ({ default: m.PayoutComplianceStitchPage })), { loading: ViewSkeleton }),
  "payout-detail": dynamic(() => import("@/modules/stitch/pages/payout-detail").then((m) => ({ default: m.PayoutDetailStitchPage })), { loading: ViewSkeleton }),
  "payout-methods-config": dynamic(() => import("@/modules/stitch/pages/payout-methods-config").then((m) => ({ default: m.PayoutMethodsConfigStitchPage })), { loading: ViewSkeleton }),
  "payout-reversal": dynamic(() => import("@/modules/stitch/pages/payout-reversal").then((m) => ({ default: m.PayoutReversalStitchPage })), { loading: ViewSkeleton }),
  "payout-schedule": dynamic(() => import("@/modules/stitch/pages/payout-schedule").then((m) => ({ default: m.PayoutScheduleStitchPage })), { loading: ViewSkeleton }),
  "payouts-bulk-approval": dynamic(() => import("@/modules/stitch/pages/payouts-bulk-approval").then((m) => ({ default: m.PayoutsBulkApprovalStitchPage })), { loading: ViewSkeleton }),
  "pending-snoozed-resolved": dynamic(() => import("@/modules/stitch/pages/pending-snoozed-resolved").then((m) => ({ default: m.PendingSnoozedResolvedStitchPage })), { loading: ViewSkeleton }),
  "pending-task-detail": dynamic(() => import("@/modules/stitch/pages/pending-task-detail").then((m) => ({ default: m.PendingTaskDetailStitchPage })), { loading: ViewSkeleton }),
  "position-detail-live": dynamic(() => import("@/modules/stitch/pages/position-detail-live").then((m) => ({ default: m.PositionDetailLiveStitchPage })), { loading: ViewSkeleton }),
  "profile-api-tokens": dynamic(() => import("@/modules/stitch/pages/profile-api-tokens").then((m) => ({ default: m.ProfileApiTokensStitchPage })), { loading: ViewSkeleton }),
  "reconciled-transactions": dynamic(() => import("@/modules/stitch/pages/reconciled-transactions").then((m) => ({ default: m.ReconciledTransactionsStitchPage })), { loading: ViewSkeleton }),
  "recurring-invoices": dynamic(() => import("@/modules/stitch/pages/recurring-invoices").then((m) => ({ default: m.RecurringInvoicesStitchPage })), { loading: ViewSkeleton }),
  "refunds-credit-notes": dynamic(() => import("@/modules/stitch/pages/refunds-credit-notes").then((m) => ({ default: m.RefundsCreditNotesStitchPage })), { loading: ViewSkeleton }),
  "risk-alert-subscription": dynamic(() => import("@/modules/stitch/pages/risk-alert-subscription").then((m) => ({ default: m.RiskAlertSubscriptionStitchPage })), { loading: ViewSkeleton }),
  "risk-rules-editor": dynamic(() => import("@/modules/stitch/pages/risk-rules-editor").then((m) => ({ default: m.RiskRulesEditorStitchPage })), { loading: ViewSkeleton }),
  "roles-management": dynamic(() => import("@/modules/stitch/pages/roles-management").then((m) => ({ default: m.RolesManagementStitchPage })), { loading: ViewSkeleton }),
  "saved-reports": dynamic(() => import("@/modules/stitch/pages/saved-reports").then((m) => ({ default: m.SavedReportsStitchPage })), { loading: ViewSkeleton }),
  "scheduled-exports": dynamic(() => import("@/modules/stitch/pages/scheduled-exports").then((m) => ({ default: m.ScheduledExportsStitchPage })), { loading: ViewSkeleton }),
  "settings-module-detail": dynamic(() => import("@/modules/stitch/pages/settings-module-detail").then((m) => ({ default: m.SettingsModuleDetailStitchPage })), { loading: ViewSkeleton }),
  "support-agent-detail": dynamic(() => import("@/modules/stitch/pages/support-agent-detail").then((m) => ({ default: m.SupportAgentDetailStitchPage })), { loading: ViewSkeleton }),
  "support-canned-responses": dynamic(() => import("@/modules/stitch/pages/support-canned-responses").then((m) => ({ default: m.SupportCannedResponsesStitchPage })), { loading: ViewSkeleton }),
  "support-contact": dynamic(() => import("@/modules/stitch/pages/support-contact").then((m) => ({ default: m.SupportContactStitchPage })), { loading: ViewSkeleton }),
  "support-csat": dynamic(() => import("@/modules/stitch/pages/support-csat").then((m) => ({ default: m.SupportCsatStitchPage })), { loading: ViewSkeleton }),
  "support-knowledge-editor": dynamic(() => import("@/modules/stitch/pages/support-knowledge-editor").then((m) => ({ default: m.SupportKnowledgeEditorStitchPage })), { loading: ViewSkeleton }),
  "tax-vat-config": dynamic(() => import("@/modules/stitch/pages/tax-vat-config").then((m) => ({ default: m.TaxVatConfigStitchPage })), { loading: ViewSkeleton }),
  "team-members": dynamic(() => import("@/modules/stitch/pages/team-members").then((m) => ({ default: m.TeamMembersStitchPage })), { loading: ViewSkeleton }),
  "trader-risk-score-detail": dynamic(() => import("@/modules/stitch/pages/trader-risk-score-detail").then((m) => ({ default: m.TraderRiskScoreDetailStitchPage })), { loading: ViewSkeleton }),
  "transaction-detail": dynamic(() => import("@/modules/stitch/pages/transaction-detail").then((m) => ({ default: m.TransactionDetailStitchPage })), { loading: ViewSkeleton }),
  "user-audit-timeline": dynamic(() => import("@/modules/stitch/pages/user-audit-timeline").then((m) => ({ default: m.UserAuditTimelineStitchPage })), { loading: ViewSkeleton }),
  "vpn-proxy-detection-dashboard": dynamic(() => import("@/modules/stitch/pages/vpn-proxy-detection-dashboard").then((m) => ({ default: m.VpnProxyDetectionDashboardStitchPage })), { loading: ViewSkeleton }),

};

const dynamicViews = new Map<string, ViewComponent>();

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
