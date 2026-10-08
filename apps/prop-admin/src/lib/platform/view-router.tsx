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
};

const dynamicViews = new Map<string, ViewComponent>();

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
