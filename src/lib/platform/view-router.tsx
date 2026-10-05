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

import {
  TradingOverviewPage,
  TradersPage,
  AccountsPage,
  PositionsPage,
  TraderDetailPage,
  OrdersPage,
  ObjectivesProgressPage,
  RulesPage,
  TradingCredentialsPage,
  AccountBreachPage,
  AccountProvisioningPage,
  EvaluationPassedPage,
  PurchaseHistoryPage,
} from "@/modules/trading";
import {
  ChallengesOverviewPage,
  ActiveChallengesPage,
  PassedChallengesPage,
  FailedChallengesPage,
  CompetitionsPage,
  ChallengeMarketplacePage,
  CheckoutPage,
  PurchaseCompletedPage,
} from "@/modules/challenges";
import { RiskOverviewPage, BreachesPage, RiskCasesPage } from "@/modules/risk";
import {
  PayoutsOverviewPage,
  PendingPayoutsPage,
  PayoutHistoryPage,
  PayoutProviderStatusPage,
  PayoutEligibilityPage,
  PayoutRequestFormPage,
} from "@/modules/payouts";
import {
  AnalyticsOverviewPage,
  TraderAnalyticsPage,
  PerformanceAnalyticsPage,
  RiskAnalyticsPage,
  AdvancedAnalyticsPage,
  ReportsPage,
  TraderPerformancePage,
} from "@/modules/analytics";
import {
  AffiliatesOverviewPage,
  AffiliatesListPage,
  AffiliateCampaignsPage,
  AffiliateCommissionsPage,
} from "@/modules/affiliates";
import {
  AccountingOverviewPage,
  TransactionsPage,
  ReconciliationPage,
  DocumentsPage,
} from "@/modules/accounting";
import {
  MarketingOverviewPage,
  MarketingCampaignsPage,
  MarketingPerformancePage,
} from "@/modules/marketing";
import { CrmOverviewPage, CrmContactsPage, CrmPipelinePage } from "@/modules/crm";
import { KycOverviewPage, KycReviewsPage, KycRiskPage, KycDocumentRequestsPage, KycOnboardingPage, KycStatusPage } from "@/modules/kyc";
import {
  SupportOverviewPage,
  SupportTicketsPage,
  SupportKnowledgePage,
} from "@/modules/support";
import {
  AiOverviewPage,
  AiInsightsPage,
  AiAssistantPage,
  AiConfigurePage,
} from "@/modules/ai";

import { OverviewPage } from "@/modules/overview/overview-page";
import { ProfilePage } from "@/modules/profile/profile-page";
import { AuditPage } from "@/modules/audit/audit-page";
import { NotificationsPage } from "@/modules/notifications/notifications-page";
import { HelpPage } from "@/modules/help/help-page";
import { SettingsPage } from "@/modules/settings/settings-page";
import { TermsPoliciesPage } from "@/modules/settings";
import { SuperAdminOverviewPage, TenantsPage, ModuleCatalogPage, PlatformHealthPage } from "@/modules/super-admin/super-admin-pages";
import { PlatformOperationsPage } from "@/modules/super-admin/platform-operations-page";
import { EmergencyControlsPage } from "@/modules/super-admin/emergency-controls-page";
import { CrossTenantQueuesPage } from "@/modules/super-admin/cross-tenant-queues-page";
import { ProviderRegistryPage } from "@/modules/super-admin/provider-registry-page";
import { JobsDashboardPage } from "@/modules/super-admin/jobs-dashboard-page";
import { DeploymentsPage } from "@/modules/super-admin/deployments-page";
import { BackupsDrPage } from "@/modules/super-admin/backups-dr-page";
import { ApprovalCenterPage } from "@/modules/super-admin/approval-center-page";
import { IncidentCenterPage } from "@/modules/super-admin/incident-center-page";
import { FeatureFlagsPage } from "@/modules/super-admin/feature-flags-page";
import { MySessionsPage } from "@/modules/super-admin/my-sessions-page";
import { SecurityOverviewPage } from "@/modules/super-admin/security-overview-page";
import { PlatformFinancialsPage } from "@/modules/super-admin/platform-financials-page";
import { GlobalDefaultsPage } from "@/modules/super-admin/global-defaults-page";
import { ReferenceDataPage } from "@/modules/super-admin/reference-data-page";
import { OperatorDirectoryPage } from "@/modules/super-admin/operator-directory-page";
import { RoleManagementPage } from "@/modules/super-admin/role-management-page";
import { TenantViewAsPage } from "@/modules/super-admin/tenant-view-as-page";
import { AbuseSignalsPage } from "@/modules/super-admin/abuse-signals-page";
import { AnnouncementsPage } from "@/modules/super-admin/announcements-page";
import { PlatformAnalyticsPage } from "@/modules/super-admin/platform-analytics-page";
import { TenantDetailPage } from "@/modules/super-admin/tenant-detail-page";
import { CreateTenantPage } from "@/modules/super-admin/create-tenant-page";
import { TenantLifecyclePage } from "@/modules/super-admin/tenant-lifecycle-page";
import { DashboardManagerPage } from "@/modules/super-admin/dashboard-manager-page";
import { PlatformAuditPage } from "@/modules/super-admin/platform-audit-page";

/* Stitch conversions — trading batch 1 */
import {
  TradingOverviewStitchPage,
  TradersStitchPage,
  AccountsStitchPage,
  PositionsStitchPage,
} from "@/modules/trading/pages/trading-stitch-pages";
import { TraderDetailStitchPage } from "@/modules/trading/pages/trader-detail-stitch-page";
import { AccountWorkspaceStitchPage } from "@/modules/trading/pages/account-workspace-stitch-page";
import {
  AddAccountStitchPage,
  ClosedPositionsStitchPage,
  ClosedPositionDetailStitchPage,
  TradingCredentialsStitchPage,
  TraderComparisonStitchPage,
  BridgeSyncLogStitchPage,
  TraderAuditLogStitchPage,
  ServerCatalogStitchPage,
  BulkAccountOperationsStitchPage,
} from "@/modules/trading/pages/trading-stitch-pages-2";
import {
  ChallengesOverviewStitchPage,
  ActiveChallengesStitchPage,
  PassedChallengesStitchPage,
  FailedChallengesStitchPage,
  ChallengeWizardStitchPage,
  ChallengeTypesStitchPage,
  ChallengeConfigStitchPage,
  PhaseManagementStitchPage,
  ChallengeEditStitchPage,
  PhaseDetailStitchPage,
  ChallengeMarketplacePreviewStitchPage,
  ChallengeComparisonStitchPage,
  ChallengeAnalyticsStitchPage,
  PhaseMigrationToolStitchPage,
  BulkPhaseEditorStitchPage,
} from "@/modules/challenges/pages/challenges-stitch-pages";

/* Generated stitch conversions — prop-admin redesign (PROP_ADMIN_DESIGN_SPEC).
 * All screens in src/modules/stitch/pages are converted from stitch_screens/
 * by tools/stitch2tsx.py and gated to the prop-admin application below so the
 * super-admin + trader dashboards keep their existing components. */
import { stitchViews } from "@/modules/stitch";
import { withPropAdminStitch } from "@/modules/stitch/gate";

/* New flows — imported from subagent-built pages */
import { FirmStatisticsPage } from "@/modules/analytics/pages/firm-statistics-page";
import { DailyHighlightsPage } from "@/modules/analytics/pages/daily-highlights-page";
import { RetentionAnalyticsPage } from "@/modules/analytics/pages/retention-analytics-page";
import { ChallengeWizardPage } from "@/modules/challenges/pages/challenge-wizard-page";
import { ChallengeConfigPage } from "@/modules/challenges/pages/challenge-config-page";
import { PhaseManagementPage } from "@/modules/challenges/pages/phase-management-page";
import { ChallengeTypesPage } from "@/modules/challenges/pages/challenge-types-page";
import { AddAccountPage } from "@/modules/trading/pages/add-account-page";
import { EnhancedTraderDetailPage } from "@/modules/trading/pages/enhanced-trader-detail-page";
import { OfferManagementPage } from "@/modules/affiliates/pages/offer-management-page";
import { EmailTemplatesPage } from "@/modules/settings/pages/email-templates-page";
import { CertificateManagementPage } from "@/modules/settings/pages/certificate-management-page";
import { BannerManagementPage } from "@/modules/settings/pages/banner-management-page";
import { TradingEventsPage } from "@/modules/risk/pages/trading-events-page";
import { RiskStatisticsPage } from "@/modules/risk/pages/risk-statistics-page";
import { UserEventsPage } from "@/modules/audit/user-events-page";
import { ChangeHistoryPage } from "@/modules/audit/change-history-page";
import { UserEventDetailPage } from "@/modules/audit/user-event-detail-page";

/* Batch A: Dashboard tabs */
import { DashboardAccountsTab, DashboardPayoutsTab, DashboardOrdersTab, DashboardPositionsTab } from "@/modules/analytics/pages/dashboard-tabs";

/* Batch B: Risk reports + User/Group/Token management */
import { RiskUnprofitableCountriesPage } from "@/modules/risk/pages/risk-unprofitable-countries-page";
import { RiskRevenueLossPage } from "@/modules/risk/pages/risk-revenue-loss-page";
import { RiskLabelVsPayoutsPage } from "@/modules/risk/pages/risk-label-vs-payouts-page";
import { RiskHighestEarnersPage } from "@/modules/risk/pages/risk-highest-earners-page";
import { UserManagementPage } from "@/modules/settings/pages/user-management-page";
import { GroupManagementPage } from "@/modules/settings/pages/group-management-page";
import { TokenManagementPage } from "@/modules/settings/pages/token-management-page";

/* Batch C: Account detail tabs + Closed positions */
import { AccountBrokerDetailsPage } from "@/modules/trading/pages/account-broker-details-page";
import { AccountKycStatusesPage } from "@/modules/trading/pages/account-kyc-statuses-page";
import { AccountRelatedAccountsPage } from "@/modules/trading/pages/account-related-accounts-page";
import { ClosedPositionsPage } from "@/modules/trading/pages/closed-positions-page";

/* Batch D: Risk report tabs + Marketing dashboard + Pending tasks + Enhanced withdrawals */
import { RiskGroupVsPayoutsPage } from "@/modules/risk/pages/risk-group-vs-payouts-page";
import { RiskCouponVsPayoutsPage } from "@/modules/risk/pages/risk-coupon-vs-payouts-page";
import { RiskAccountLabelAnalysisPage } from "@/modules/risk/pages/risk-account-label-analysis-page";
import { RiskAddonRevenuePage } from "@/modules/risk/pages/risk-addon-revenue-page";
import { MarketingDashboardPage } from "@/modules/marketing/pages/marketing-dashboard-page";
import { PendingTasksPage } from "@/modules/pendings/pages/pending-tasks-page";
import { EnhancedWithdrawalsPage } from "@/modules/payouts/pages/enhanced-withdrawals-page";

/* Batch E: Certificates issued + detail */
import { CertificatesIssuedPage } from "@/modules/settings/pages/certificates-issued-page";
import { CertificateDetailPage } from "@/modules/settings/pages/certificate-detail-page";

/* Batch F: Offer edit + matching users + change history + Notifications mgmt + Utilities */
import { OfferEditPage } from "@/modules/affiliates/pages/offer-edit-page";
import { OfferMatchingUsersPage } from "@/modules/affiliates/pages/offer-matching-users-page";
import { OfferChangeHistoryPage } from "@/modules/affiliates/pages/offer-change-history-page";
import { NotificationsManagementPage } from "@/modules/settings/pages/notifications-management-page";
import { NotificationEditPage } from "@/modules/settings/pages/notification-edit-page";
import { UtilitiesPage } from "@/modules/settings/pages/utilities-page";

/* Batch G: Challenge edit + Phase detail */
import { ChallengeEditPage } from "@/modules/challenges/pages/challenge-edit-page";
import { PhaseDetailPage } from "@/modules/challenges/pages/phase-detail-page";

/* Batch H: Email template editor + Certificate designer + Font upload + Marketing integrations + Banner edit */
import { EmailTemplateEditPage } from "@/modules/settings/pages/email-template-edit-page";
import { CertificateTemplateDesignerPage } from "@/modules/settings/pages/certificate-template-designer-page";
import { CertificateFontUploadPage } from "@/modules/settings/pages/certificate-font-upload-page";
import { MarketingIntegrationsPage } from "@/modules/settings/pages/marketing-integrations-page";
import { MarketingBannerEditPage } from "@/modules/settings/pages/marketing-banner-edit-page";

/* Batch I: Trading event details + IP addresses + Weekend trades */
import { CopyTradingEventsPage } from "@/modules/risk/pages/copy-trading-events-page";
import { CopyTradingAnalysisPage } from "@/modules/risk/pages/copy-trading-analysis-page";
import { InverseTradingEventsPage } from "@/modules/risk/pages/inverse-trading-events-page";
import { AccountIpAddressesPage } from "@/modules/risk/pages/account-ip-addresses-page";
import { WeekendTradesPage } from "@/modules/risk/pages/weekend-trades-page";

/* Batch J: Account configuration + events + version history */
import { AccountConfigurationPage } from "@/modules/trading/pages/account-configuration-page";
import { AccountEventsPage } from "@/modules/trading/pages/account-events-page";
import { AccountVersionHistoryPage } from "@/modules/trading/pages/account-version-history-page";
import { AccountWorkspacePage } from "@/modules/trading/pages/account-workspace-page";

/* Batch K: Closed position detail + Order detail + Social media + Device activities */
import { ClosedPositionDetailPage } from "@/modules/trading/pages/closed-position-detail-page";
import { OrderDetailPage } from "@/modules/trading/pages/order-detail-page";
import { SocialMediaLinksPage } from "@/modules/settings/pages/social-media-links-page";
import { DeviceActivitiesPage } from "@/modules/settings/pages/device-activities-page";

/* Batch L: Token detail + Enhanced user events */
import { TokenDetailPage } from "@/modules/settings/pages/token-detail-page";
import { EnhancedUserEventsPage } from "@/modules/audit/enhanced-user-events-page";

/* Batch M (Group G high-value pages): KYC Providers + Support SLA + AI Predictive/Anomaly/Cost + Accounting Invoices/P&L + Marketing Email/AdSpend + Affiliate Coupons/LinkTracking */
import { KycProvidersPage } from "@/modules/settings/pages/kyc-providers-page";
import { SupportSlaPage } from "@/modules/support/pages/support-sla-page";
import { AiPredictivePage } from "@/modules/ai/pages/ai-predictive-page";
import { AiAnomalyPage } from "@/modules/ai/pages/ai-anomaly-page";
import { AiCostPage } from "@/modules/ai/pages/ai-cost-page";
import { AccountingInvoicesPage } from "@/modules/accounting/pages/accounting-invoices-page";
import { AccountingPlPage } from "@/modules/accounting/pages/accounting-pl-page";
import { MarketingEmailCampaignsPage } from "@/modules/marketing/pages/marketing-email-campaigns-page";
import { MarketingAdSpendPage } from "@/modules/marketing/pages/marketing-ad-spend-page";
import { AffiliateCouponsPage } from "@/modules/affiliates/pages/affiliate-coupons-page";
import { AffiliateLinkTrackingPage } from "@/modules/affiliates/pages/affiliate-link-tracking-page";

export type ViewComponent = ComponentType<{ params: Record<string, string> }>;

export const viewRegistry: Record<string, ViewComponent> = {
  /* platform */
  overview: OverviewPage,
  profile: ProfilePage,
  audit: AuditPage,
  notifications: NotificationsPage,
  help: HelpPage,
  settings: SettingsPage,
  "terms-policies": TermsPoliciesPage,
  "pending-tasks": PendingTasksPage,

  /* super-admin */
  "super-overview": SuperAdminOverviewPage,
  tenants: TenantsPage,
  "module-catalog": ModuleCatalogPage,
  "platform-health": PlatformHealthPage,
  "tenant-detail": TenantDetailPage,
  "create-tenant": CreateTenantPage,
  "tenant-lifecycle": TenantLifecyclePage,
  "dashboard-manager": DashboardManagerPage,
  "platform-audit": PlatformAuditPage,
  /* Round 8: new platform operations screens */
  "platform-operations": PlatformOperationsPage,
  "emergency-controls": EmergencyControlsPage,
  "cross-tenant-queues": CrossTenantQueuesPage,
  "provider-registry": ProviderRegistryPage,
  "jobs-dashboard": JobsDashboardPage,
  deployments: DeploymentsPage,
  "backups-dr": BackupsDrPage,
  "approval-center": ApprovalCenterPage,
  "incident-center": IncidentCenterPage,
  "feature-flags": FeatureFlagsPage,
  "my-sessions": MySessionsPage,
  "security-overview": SecurityOverviewPage,
  "platform-financials": PlatformFinancialsPage,
  "global-defaults": GlobalDefaultsPage,
  "reference-data": ReferenceDataPage,
  "operator-directory": OperatorDirectoryPage,
  "role-management": RoleManagementPage,
  "tenant-view-as": TenantViewAsPage,
  "abuse-signals": AbuseSignalsPage,
  announcements: AnnouncementsPage,
  "platform-analytics": PlatformAnalyticsPage,

  /* trading */
  trading: TradingOverviewStitchPage,
  "trading-traders": TradersStitchPage,
  "trading-accounts": AccountsStitchPage,
  "trading-positions": PositionsStitchPage,
  "trader-detail": TraderDetailStitchPage,
  "trading-add-account": AddAccountStitchPage,
  "closed-positions": ClosedPositionsStitchPage,
  "closed-position-detail": ClosedPositionDetailStitchPage,
  "trading-credentials": TradingCredentialsStitchPage,
  "trader-comparison": TraderComparisonStitchPage,
  "bridge-sync-log": BridgeSyncLogStitchPage,
  "trader-audit-log": TraderAuditLogStitchPage,
  "mt4-dxtrade-server-catalog": ServerCatalogStitchPage,
  "server-catalog": ServerCatalogStitchPage,
  "bulk-account-operations": BulkAccountOperationsStitchPage,
  "account-broker-details": AccountBrokerDetailsPage,
  "account-kyc-statuses": AccountKycStatusesPage,
  "account-related-accounts": AccountRelatedAccountsPage,
  "account-configuration": AccountConfigurationPage,
  "account-events": AccountEventsPage,
  "account-version-history": AccountVersionHistoryPage,
  "account-workspace": AccountWorkspaceStitchPage,
  "order-detail": OrderDetailPage,
  orders: OrdersPage,
  objectives: ObjectivesProgressPage,
  rules: RulesPage,
  "account-breach": AccountBreachPage,
  "account-provisioning": AccountProvisioningPage,
  "evaluation-passed": EvaluationPassedPage,
  "purchase-history": PurchaseHistoryPage,

  /* challenges */
  challenges: ChallengesOverviewStitchPage,
  "challenges-active": ActiveChallengesStitchPage,
  "challenges-passed": PassedChallengesStitchPage,
  "challenges-failed": FailedChallengesStitchPage,
  "challenge-wizard": ChallengeWizardStitchPage,
  "challenge-config": ChallengeConfigStitchPage,
  "challenge-types": ChallengeTypesStitchPage,
  "challenge-marketplace-preview": ChallengeMarketplacePreviewStitchPage,
  "challenge-comparison": ChallengeComparisonStitchPage,
  "challenge-analytics": ChallengeAnalyticsStitchPage,
  "phase-migration-tool": PhaseMigrationToolStitchPage,
  "bulk-phase-editor": BulkPhaseEditorStitchPage,
  competitions: CompetitionsPage,
  "challenge-marketplace": ChallengeMarketplacePage,
  checkout: CheckoutPage,
  "purchase-completed": PurchaseCompletedPage,
  "phase-management": PhaseManagementStitchPage,
  "challenge-edit": ChallengeEditStitchPage,
  "phase-detail": PhaseDetailStitchPage,

  /* risk */
  risk: RiskOverviewPage,
  breaches: BreachesPage,
  "risk-cases": RiskCasesPage,
  "risk-statistics": RiskStatisticsPage,
  "trading-events": TradingEventsPage,
  "copy-trading-events": CopyTradingEventsPage,
  "copy-trading-analysis": CopyTradingAnalysisPage,
  "inverse-trading-events": InverseTradingEventsPage,
  "account-ip-addresses": AccountIpAddressesPage,
  "weekend-trades": WeekendTradesPage,
  "risk-unprofitable-countries": RiskUnprofitableCountriesPage,
  "risk-revenue-loss": RiskRevenueLossPage,
  "risk-label-vs-payouts": RiskLabelVsPayoutsPage,
  "risk-highest-earners": RiskHighestEarnersPage,
  "risk-group-vs-payouts": RiskGroupVsPayoutsPage,
  "risk-coupon-vs-payouts": RiskCouponVsPayoutsPage,
  "risk-account-label-analysis": RiskAccountLabelAnalysisPage,
  "risk-addon-revenue": RiskAddonRevenuePage,

  /* payouts */
  payouts: PayoutsOverviewPage,
  "payouts-pending": PendingPayoutsPage,
  "payouts-history": PayoutHistoryPage,
  "payouts-enhanced-withdrawals": EnhancedWithdrawalsPage,
  "payout-provider-status": PayoutProviderStatusPage,
  "payout-eligibility": PayoutEligibilityPage,
  "payout-request": PayoutRequestFormPage,

  /* analytics */
  analytics: AnalyticsOverviewPage,
  "analytics-traders": TraderAnalyticsPage,
  "analytics-performance": PerformanceAnalyticsPage,
  "analytics-risk": RiskAnalyticsPage,
  "analytics-advanced": AdvancedAnalyticsPage,
  reports: ReportsPage,
  "trader-performance": TraderPerformancePage,
  "analytics-firm-statistics": FirmStatisticsPage,
  "analytics-daily-highlights": DailyHighlightsPage,
  "analytics-retention": RetentionAnalyticsPage,
  "dashboard-accounts": DashboardAccountsTab,
  "dashboard-payouts": DashboardPayoutsTab,
  "dashboard-orders": DashboardOrdersTab,
  "dashboard-positions": DashboardPositionsTab,

  /* affiliates */
  affiliates: AffiliatesOverviewPage,
  "affiliates-list": AffiliatesListPage,
  "affiliates-campaigns": AffiliateCampaignsPage,
  "affiliates-commissions": AffiliateCommissionsPage,
  "offer-management": OfferManagementPage,
  "offer-edit": OfferEditPage,
  "offer-matching-users": OfferMatchingUsersPage,
  "offer-change-history": OfferChangeHistoryPage,
  "affiliate-coupons": AffiliateCouponsPage,
  "affiliate-link-tracking": AffiliateLinkTrackingPage,

  /* accounting */
  accounting: AccountingOverviewPage,
  "accounting-transactions": TransactionsPage,
  "accounting-reconciliation": ReconciliationPage,
  "accounting-invoices": AccountingInvoicesPage,
  "accounting-pl": AccountingPlPage,

  /* marketing */
  marketing: MarketingOverviewPage,
  "marketing-campaigns": MarketingCampaignsPage,
  "marketing-performance": MarketingPerformancePage,
  "marketing-dashboard": MarketingDashboardPage,
  "marketing-email-campaigns": MarketingEmailCampaignsPage,
  "marketing-ad-spend": MarketingAdSpendPage,

  /* crm */
  crm: CrmOverviewPage,
  "crm-contacts": CrmContactsPage,
  "crm-pipeline": CrmPipelinePage,

  /* kyc */
  kyc: KycOverviewPage,
  "kyc-reviews": KycReviewsPage,
  "kyc-risk": KycRiskPage,
  "kyc-document-requests": KycDocumentRequestsPage,
  "kyc-onboarding": KycOnboardingPage,
  "kyc-status": KycStatusPage,

  /* support */
  support: SupportOverviewPage,
  "support-tickets": SupportTicketsPage,
  "support-knowledge": SupportKnowledgePage,
  "support-sla": SupportSlaPage,

  /* ai */
  ai: AiOverviewPage,
  "ai-insights": AiInsightsPage,
  "ai-assistant": AiAssistantPage,
  "ai-configure": AiConfigurePage,
  "ai-predictive": AiPredictivePage,
  "ai-anomaly": AiAnomalyPage,
  "ai-cost": AiCostPage,

  /* audit — new flows */
  "audit-user-events": UserEventsPage,
  "audit-change-history": ChangeHistoryPage,
  "audit-user-event-detail": UserEventDetailPage,

  /* settings — new flows */
  "email-templates": EmailTemplatesPage,
  "certificate-management": CertificateManagementPage,
  "banner-management": BannerManagementPage,
  "user-management": UserManagementPage,
  "group-management": GroupManagementPage,
  "token-management": TokenManagementPage,
  "certificates-issued": CertificatesIssuedPage,
  "certificate-detail": CertificateDetailPage,
  "notifications-management": NotificationsManagementPage,
  "notification-edit": NotificationEditPage,
  "utilities": UtilitiesPage,
  "email-template-edit": EmailTemplateEditPage,
  "certificate-template-designer": CertificateTemplateDesignerPage,
  "certificate-font-upload": CertificateFontUploadPage,
  "marketing-integrations": MarketingIntegrationsPage,
  "marketing-banner-edit": MarketingBannerEditPage,
  "social-media-links": SocialMediaLinksPage,
  "device-activities": DeviceActivitiesPage,
  "token-detail": TokenDetailPage,
  "audit-user-events-enhanced": EnhancedUserEventsPage,
  "kyc-providers": KycProvidersPage,
};

const dynamicViews = new Map<string, ViewComponent>();

/* ══════════════════════════════════════════════════════════════════════
 * Stitch redesign application (prop-admin only)
 *
 * 1. Views already converted in the hand stitch pass fall back to their
 *    pre-stitch legacy component for every non prop-admin application.
 * 2. All generated stitch pages replace the legacy component for the
 *    prop-admin application only.
 * → The super-admin and trader dashboards keep their existing rendering.
 * ══════════════════════════════════════════════════════════════════════ */
const PRE_STITCH_LEGACY: Record<string, ViewComponent> = {
  trading: TradingOverviewPage,
  "trading-traders": TradersPage,
  "trading-accounts": AccountsPage,
  "trading-positions": PositionsPage,
  "trader-detail": EnhancedTraderDetailPage,
  "trading-add-account": AddAccountPage,
  "account-workspace": AccountWorkspacePage,
  "closed-positions": ClosedPositionsPage,
  "closed-position-detail": ClosedPositionDetailPage,
  "trading-credentials": TradingCredentialsPage,
  challenges: ChallengesOverviewPage,
  "challenges-active": ActiveChallengesPage,
  "challenges-passed": PassedChallengesPage,
  "challenges-failed": FailedChallengesPage,
  "challenge-wizard": ChallengeWizardPage,
  "challenge-types": ChallengeTypesPage,
  "challenge-config": ChallengeConfigPage,
  "phase-management": PhaseManagementPage,
  "challenge-edit": ChallengeEditPage,
  "phase-detail": PhaseDetailPage,
};

for (const [vid, legacy] of Object.entries(PRE_STITCH_LEGACY)) {
  const cur = viewRegistry[vid];
  if (cur) viewRegistry[vid] = withPropAdminStitch(cur, legacy);
}
for (const [vid, Stitch] of Object.entries(stitchViews)) {
  const legacy = viewRegistry[vid];
  viewRegistry[vid] = legacy ? withPropAdminStitch(Stitch, legacy) : Stitch;
}

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
