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
} from "@/modules/trading";
import {
  ChallengesOverviewPage,
  ActiveChallengesPage,
  PassedChallengesPage,
  FailedChallengesPage,
} from "@/modules/challenges";
import { RiskOverviewPage, BreachesPage } from "@/modules/risk";
import {
  PayoutsOverviewPage,
  PendingPayoutsPage,
  PayoutHistoryPage,
} from "@/modules/payouts";
import {
  AnalyticsOverviewPage,
  TraderAnalyticsPage,
  PerformanceAnalyticsPage,
  RiskAnalyticsPage,
  AdvancedAnalyticsPage,
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
} from "@/modules/accounting";
import {
  MarketingOverviewPage,
  MarketingCampaignsPage,
  MarketingPerformancePage,
} from "@/modules/marketing";
import { CrmOverviewPage, CrmContactsPage, CrmPipelinePage } from "@/modules/crm";
import { KycOverviewPage, KycReviewsPage, KycRiskPage } from "@/modules/kyc";
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
import { SuperAdminOverviewPage, TenantsPage, ModuleCatalogPage, PlatformHealthPage } from "@/modules/super-admin/super-admin-pages";
import { TenantDetailPage } from "@/modules/super-admin/tenant-detail-page";
import { CreateTenantPage } from "@/modules/super-admin/create-tenant-page";
import { TenantLifecyclePage } from "@/modules/super-admin/tenant-lifecycle-page";
import { DashboardManagerPage } from "@/modules/super-admin/dashboard-manager-page";

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

export type ViewComponent = ComponentType<{ params: Record<string, string> }>;

export const viewRegistry: Record<string, ViewComponent> = {
  /* platform */
  overview: OverviewPage,
  profile: ProfilePage,
  audit: AuditPage,
  notifications: NotificationsPage,
  help: HelpPage,
  settings: SettingsPage,
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

  /* trading */
  trading: TradingOverviewPage,
  "trading-traders": TradersPage,
  "trading-accounts": AccountsPage,
  "trading-positions": PositionsPage,
  "trader-detail": EnhancedTraderDetailPage,
  "trading-add-account": AddAccountPage,
  "account-broker-details": AccountBrokerDetailsPage,
  "account-kyc-statuses": AccountKycStatusesPage,
  "account-related-accounts": AccountRelatedAccountsPage,
  "closed-positions": ClosedPositionsPage,

  /* challenges */
  challenges: ChallengesOverviewPage,
  "challenges-active": ActiveChallengesPage,
  "challenges-passed": PassedChallengesPage,
  "challenges-failed": FailedChallengesPage,
  "challenge-wizard": ChallengeWizardPage,
  "challenge-config": ChallengeConfigPage,
  "challenge-types": ChallengeTypesPage,
  "phase-management": PhaseManagementPage,
  "challenge-edit": ChallengeEditPage,
  "phase-detail": PhaseDetailPage,

  /* risk */
  risk: RiskOverviewPage,
  breaches: BreachesPage,
  "risk-statistics": RiskStatisticsPage,
  "trading-events": TradingEventsPage,
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

  /* analytics */
  analytics: AnalyticsOverviewPage,
  "analytics-traders": TraderAnalyticsPage,
  "analytics-performance": PerformanceAnalyticsPage,
  "analytics-risk": RiskAnalyticsPage,
  "analytics-advanced": AdvancedAnalyticsPage,
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

  /* accounting */
  accounting: AccountingOverviewPage,
  "accounting-transactions": TransactionsPage,
  "accounting-reconciliation": ReconciliationPage,

  /* marketing */
  marketing: MarketingOverviewPage,
  "marketing-campaigns": MarketingCampaignsPage,
  "marketing-performance": MarketingPerformancePage,
  "marketing-dashboard": MarketingDashboardPage,

  /* crm */
  crm: CrmOverviewPage,
  "crm-contacts": CrmContactsPage,
  "crm-pipeline": CrmPipelinePage,

  /* kyc */
  kyc: KycOverviewPage,
  "kyc-reviews": KycReviewsPage,
  "kyc-risk": KycRiskPage,

  /* support */
  support: SupportOverviewPage,
  "support-tickets": SupportTicketsPage,
  "support-knowledge": SupportKnowledgePage,

  /* ai */
  ai: AiOverviewPage,
  "ai-insights": AiInsightsPage,
  "ai-assistant": AiAssistantPage,
  "ai-configure": AiConfigurePage,

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
};

const dynamicViews = new Map<string, ViewComponent>();

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
