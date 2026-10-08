"use client";

/**
 * Account Related Accounts Page — shows every trading account owned by
 * the same trader as the currently selected account.
 *
 * Useful when a trader has multiple parallel evaluation phases or has
 * migrated between broker platforms. Operators can quickly compare the
 * trader's full account portfolio without leaving the broker details
 * workspace.
 *
 * Status badges use `ExplainableStateBadge` so a status like "breached"
 * surfaces its meaning on hover (§17-19).
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts, type TradingAccount } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard, EntityHeader } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { formatCurrency } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Link2,
  Link2Off,
  Users,
  Trophy,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

type AccountSource = "Challenge" | "Manual" | "Migration";

const SOURCES: AccountSource[] = ["Challenge", "Manual", "Migration"];

interface RelatedAccountRow extends TradingAccount {
  profitSplit: number;
  source: AccountSource;
}

/**
 * Derive a deterministic profit-split % and source per account so the
 * demo is stable. The seed is the numeric suffix of the account id.
 */
function decorateAccount(account: TradingAccount): RelatedAccountRow {
  const m = account.id.match(/(\d+)$/);
  const seed = m ? parseInt(m[1], 10) : 1;
  // Profit split ranges 70-95 in steps of 5
  const profitSplit = 70 + (seed % 6) * 5;
  // Source: most accounts are Challenge, some Manual, few Migration
  const source: AccountSource =
    seed % 7 === 0 ? "Migration" : seed % 3 === 0 ? "Manual" : "Challenge";
  return { ...account, profitSplit, source };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountRelatedAccountsPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const relatedAccounts = useMemo(() => {
    if (!account) return [];
    return getTenantAccounts(tid)
      .filter((a) => a.traderId === account.traderId)
      .map(decorateAccount);
  }, [tid, account]);

  if (!account) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-accounts")} className="w-fit">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </Page>
    );
  }

  // KPI roll-ups
  const total = relatedAccounts.length;
  const funded = relatedAccounts.filter((a) => a.phase === "funded").length;
  const active = relatedAccounts.filter((a) => a.status === "active").length;
  const breached = relatedAccounts.filter((a) => a.status === "breached").length;

  const linkAccount = () => {
    toast({
      title: "Link account",
      description: "Open the broker login lookup to link another trading account to this trader.",
    });
  };

  const unlinkAccount = (row: RelatedAccountRow) => {
    toast({
      title: "Unlink account",
      description: `Login ${row.login} (${row.platform}) will be detached from ${row.traderName}.`,
      variant: "destructive",
    });
  };

  const columns: Column<RelatedAccountRow>[] = [
    {
      key: "login",
      header: "Login",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{row.login}</span>
          {row.id === account.id ? (
            <Badge variant="secondary" className="text-[9px]">current</Badge>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.login,
    },
    {
      key: "phase",
      header: "Phase",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px]">
          {row.phase}
        </Badge>
      ),
      sortValue: (row) => row.phase,
    },
    {
      key: "platform",
      header: "Broker Type",
      cell: (row) => (
        <Badge variant="secondary" className="text-[10px]">
          {row.platform}
        </Badge>
      ),
      sortValue: (row) => row.platform,
    },
    {
      key: "balance",
      header: "Initial Balance",
      cell: (row) => formatCurrency(row.balance, row.currency),
      sortValue: (row) => row.balance,
      numeric: true,
    },
    {
      key: "equity",
      header: "Current Equity",
      cell: (row) => formatCurrency(row.equity, row.currency),
      sortValue: (row) => row.equity,
      numeric: true,
    },
    {
      key: "profitSplit",
      header: "Profit Split",
      cell: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.profitSplit}% / {100 - row.profitSplit}%
        </span>
      ),
      sortValue: (row) => row.profitSplit,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <ExplainableStateBadge status={row.status} entityType="account" />,
      sortValue: (row) => row.status,
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px]">
          {row.source}
        </Badge>
      ),
      sortValue: (row) => row.source,
    },
    {
      key: "actions",
      header: "",
      cell: (row) =>
        row.id === account.id ? (
          <span />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              unlinkAccount(row);
            }}
          >
            <Link2Off className="h-3 w-3" /> Unlink
          </Button>
        ),
      width: "120px",
    },
  ];

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("account-workspace", { id: account.id })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Account
      </Button>

      <PageHeader
        title="Related Accounts"
        description={`All trading accounts owned by ${account.traderName}.`}
        icon={Link2}
        actions={
          <Button size="sm" onClick={linkAccount} className="gap-1.5">
            <Link2 className="h-4 w-4" /> Link Account
          </Button>
        }
      />

      <EntityHeader
        title={account.traderName}
        subtitle={`Showing ${relatedAccounts.length} account${relatedAccounts.length === 1 ? "" : "s"} · current login ${account.login}`}
        badges={
          <Badge variant="outline" className="text-[10px]">
            {relatedAccounts.length} linked
          </Badge>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total Related Accounts"
          value={total}
          icon={Users}
        />
        <MetricCard
          label="Funded"
          value={funded}
          tone="positive"
          icon={Trophy}
        />
        <MetricCard
          label="Active"
          value={active}
          tone="positive"
          icon={Activity}
        />
        <MetricCard
          label="Breached"
          value={breached}
          tone={breached > 0 ? "negative" : "default"}
          icon={AlertTriangle}
        />
      </div>

      <PageContent>
        <div className={cn("rounded-lg border bg-card p-4")}>
          <DataTable
            columns={columns}
            data={relatedAccounts}
            rowKey={(row) => row.id}
            onRowClick={(row) =>
              navigate("account-workspace", { id: row.id })
            }
            searchableText={(row) =>
              `${row.login} ${row.platform} ${row.phase} ${row.source} ${row.status}`
            }
            searchPlaceholder="Search related accounts…"
            pageSize={10}
            emptyTitle="No related accounts"
            emptyDescription="This trader has no other trading accounts yet."
          />
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span>{" "}
          Row click opens the account workspace. Use the "Link Account"
          action to attach a new broker login to this trader — you'll need
          the broker login id and the trader's verified email.
        </div>
      </PageContent>
    </Page>
  );
}
