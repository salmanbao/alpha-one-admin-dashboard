"use client";

/**
 * Account Workspace — unified entity workspace (UX §28) for a single
 * trading account. Wraps the 6 existing account-* sub-pages in a single
 * tabbed surface so operators can move between Configuration, Events,
 * Version History, Broker Details, KYC Statuses, and Related Accounts
 * without repeatedly returning to the sidebar.
 *
 * Layout:
 *  - Back to Accounts button + PageHeader (login + trader + platform)
 *  - KPI row: 4 cards summarizing balance / equity / status / phase
 *  - Tabs with 6 tabs; each TabsContent renders the corresponding
 *    existing account-* page as-is (option (b) — duplicated PageHeader
 *    inside the tab is acceptable for this iteration).
 *
 * The existing account-* sub-pages each call `usePlatform()` and read
 * `router.params.id` themselves, so embedding them with no props works.
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts } from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountConfigurationPage } from "./account-configuration-page";
import { AccountEventsPage } from "./account-events-page";
import { AccountVersionHistoryPage } from "./account-version-history-page";
import { AccountBrokerDetailsPage } from "./account-broker-details-page";
import { AccountKycStatusesPage } from "./account-kyc-statuses-page";
import { AccountRelatedAccountsPage } from "./account-related-accounts-page";
import {
  ArrowLeft,
  Settings,
  History,
  GitBranch,
  Building2,
  ShieldCheck,
  Users,
  Wallet,
  TrendingUp,
  Activity,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";

const TABS = [
  { value: "configuration", label: "Configuration", icon: Settings },
  { value: "events", label: "Events", icon: History },
  { value: "version", label: "Version History", icon: GitBranch },
  { value: "broker", label: "Broker Details", icon: Building2 },
  { value: "kyc", label: "KYC Statuses", icon: ShieldCheck },
  { value: "related", label: "Related Accounts", icon: Users },
] as const;

export function AccountWorkspacePage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;
  const currency = runtime.tenant?.currency ?? "USD";

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const [activeTab, setActiveTab] = useState<string>("configuration");

  if (!account) {
    return (
      <Page>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate("trading-accounts")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Accounts
        </Button>
        <EmptyState
          icon={CreditCard}
          title="Account not found"
          description={`No trading account exists with id "${accountId ?? "—"}". It may have been deleted, or the link may be stale.`}
          hint="Return to the Accounts list and pick an active account."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("trading-accounts")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Accounts
            </Button>
          }
        />
      </Page>
    );
  }

  const statusTone:
    | "success"
    | "danger"
    | "warning"
    | "info" =
    account.status === "active"
      ? "success"
      : account.status === "breached"
        ? "danger"
        : account.status === "passed"
          ? "info"
          : "warning";

  const pnl = account.equity - account.balance;
  const pnlTone: "positive" | "negative" =
    pnl >= 0 ? "positive" : "negative";

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("trading-accounts")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Accounts
      </Button>

      <PageHeader
        title={`Account ${account.login}`}
        description={`${account.platform} · ${account.traderName} · ${account.type}`}
        icon={CreditCard}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("trader-detail", { id: account.traderId })}
          >
            View Trader <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        }
      />

      {/* KPI row — 4 cards summarizing the account */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Balance"
          value={formatCurrency(account.balance, account.currency || currency)}
          icon={Wallet}
        />
        <MetricCard
          label="Equity"
          value={formatCurrency(account.equity, account.currency || currency)}
          icon={TrendingUp}
          tone={pnlTone}
        />
        <MetricCard
          label="Status"
          value={account.status}
          icon={Activity}
          tone={
            statusTone === "success"
              ? "positive"
              : statusTone === "danger"
                ? "negative"
                : statusTone === "warning"
                  ? "warning"
                  : "default"
          }
        />
        <MetricCard
          label="Phase"
          value={account.phase}
          icon={CreditCard}
        />
      </div>

      {/* Status badge row — quick at-a-glance indicators */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="text-[11px] font-medium uppercase tracking-wide">
          Account ID
        </span>
        <Badge variant="outline" className="font-mono text-[10px]">
          {account.id}
        </Badge>
        <span aria-hidden>·</span>
        <StatusBadge tone={statusTone}>{account.status}</StatusBadge>
        <Badge variant="secondary" className="text-[10px]">
          {account.platform}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {account.type}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {account.phase}
        </Badge>
      </div>

      <PageContent>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="flex-wrap">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Each TabsContent renders the corresponding existing account-*
              sub-page as-is. They each call usePlatform() to read
              router.params.id, so they resolve the same accountId. */}
          <TabsContent value="configuration" className="mt-4">
            <AccountConfigurationPage />
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <AccountEventsPage />
          </TabsContent>
          <TabsContent value="version" className="mt-4">
            <AccountVersionHistoryPage />
          </TabsContent>
          <TabsContent value="broker" className="mt-4">
            <AccountBrokerDetailsPage />
          </TabsContent>
          <TabsContent value="kyc" className="mt-4">
            <AccountKycStatusesPage />
          </TabsContent>
          <TabsContent value="related" className="mt-4">
            <AccountRelatedAccountsPage />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
