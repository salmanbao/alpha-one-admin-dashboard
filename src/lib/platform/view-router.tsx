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
import { SuperAdminOverviewPage } from "@/modules/super-admin/super-admin-pages";
import { TenantsPage } from "@/modules/super-admin/super-admin-pages";
import { ModuleCatalogPage } from "@/modules/super-admin/super-admin-pages";
import { PlatformHealthPage } from "@/modules/super-admin/super-admin-pages";

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

export type ViewComponent = ComponentType<{ params: Record<string, string> }>;

export const viewRegistry: Record<string, ViewComponent> = {
  /* platform */
  overview: OverviewPage,
  profile: ProfilePage,
  audit: AuditPage,
  notifications: NotificationsPage,
  help: HelpPage,
  settings: SettingsPage,

  /* super-admin */
  "super-overview": SuperAdminOverviewPage,
  tenants: TenantsPage,
  "module-catalog": ModuleCatalogPage,
  "platform-health": PlatformHealthPage,

  /* trading */
  trading: TradingOverviewPage,
  "trading-traders": TradersPage,
  "trading-accounts": AccountsPage,
  "trading-positions": PositionsPage,
  "trader-detail": EnhancedTraderDetailPage,
  "trading-add-account": AddAccountPage,

  /* challenges */
  challenges: ChallengesOverviewPage,
  "challenges-active": ActiveChallengesPage,
  "challenges-passed": PassedChallengesPage,
  "challenges-failed": FailedChallengesPage,
  "challenge-wizard": ChallengeWizardPage,
  "challenge-config": ChallengeConfigPage,
  "challenge-types": ChallengeTypesPage,
  "phase-management": PhaseManagementPage,

  /* risk */
  risk: RiskOverviewPage,
  breaches: BreachesPage,
  "risk-statistics": RiskStatisticsPage,
  "trading-events": TradingEventsPage,

  /* payouts */
  payouts: PayoutsOverviewPage,
  "payouts-pending": PendingPayoutsPage,
  "payouts-history": PayoutHistoryPage,

  /* analytics */
  analytics: AnalyticsOverviewPage,
  "analytics-traders": TraderAnalyticsPage,
  "analytics-performance": PerformanceAnalyticsPage,
  "analytics-risk": RiskAnalyticsPage,
  "analytics-advanced": AdvancedAnalyticsPage,
  "analytics-firm-statistics": FirmStatisticsPage,
  "analytics-daily-highlights": DailyHighlightsPage,
  "analytics-retention": RetentionAnalyticsPage,

  /* affiliates */
  affiliates: AffiliatesOverviewPage,
  "affiliates-list": AffiliatesListPage,
  "affiliates-campaigns": AffiliateCampaignsPage,
  "affiliates-commissions": AffiliateCommissionsPage,
  "offer-management": OfferManagementPage,

  /* accounting */
  accounting: AccountingOverviewPage,
  "accounting-transactions": TransactionsPage,
  "accounting-reconciliation": ReconciliationPage,

  /* marketing */
  marketing: MarketingOverviewPage,
  "marketing-campaigns": MarketingCampaignsPage,
  "marketing-performance": MarketingPerformancePage,

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

  /* settings — new flows */
  "email-templates": EmailTemplatesPage,
  "certificate-management": CertificateManagementPage,
  "banner-management": BannerManagementPage,
};

const dynamicViews = new Map<string, ViewComponent>();

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
