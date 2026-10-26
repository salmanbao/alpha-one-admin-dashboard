"use client";

/** 
 * PFaaS Platform — Trader Management Page
 * Displays a paginated, searchable, sortable table of all traders
 * across tenants with status badges and quick actions.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { Trader } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTranslation } from "next-intl";

export function TradersPage() {
  const { runtime, tenant, user } = usePlatform();
  const { t } = useTranslation();

  // Fetch traders for this tenant using seeded mock data
  const { data: tenantsTraders = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["traders", tenant.id],
        queryFn: async () => {
          // Get traders for this tenant from mock data
          const allTraders = [];
          // Import and filter from mock-data
          return allTraders.filter((t: any) => t.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded trader data directly
  const traders = useMemo(() => {
    // Seed traders based on tenant
    const seeds: Trader[] = [];
    // Get traders from the seeded data
    const tenantTraders = []; // Would pull from mock-data
    return tenantTraders.filter((t: any) => t.tenantId === tenant.id || t.tenantId === "platform");
  }, [tenant.id]);

  // Fallback seeded data if none fetched
  const fallbackTraders = useMemo(() => {
    const all: Trader[] = [
      {
        id: "trader-tenant-alpha-1",
        tenantId: "tenant-alpha",
        name: "Sarah Chen",
        email: "sarah@alphacapital.io",
        country: "US",
        status: "active",
        joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        challengePhase: "phase-2",
        accountBalance: 25000,
        equity: 28500,
        totalPnl: 3500,
        winRate: 45,
        trades: 128,
      },
      {
        id: "trader-tenant-alpha-2",
        tenantId: "tenant-alpha",
        name: "Marcus Webb",
        email: "marcus@alphacapital.io",
        country: "GB",
        status: "breached",
        joinedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        challengePhase: "phase-1",
        accountBalance: 10000,
        equity: 8900,
        totalPnl: -4200,
        winRate: 32,
        trades: 89,
      },
      {
        id: "trader-tenant-beta-1",
        tenantId: "tenant-beta",
        name: "Tom Allen",
        email: "tom@example.com",
        country: "AE",
        status: "active",
        joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        challengePhase: "funded",
        accountBalance: 50000,
        equity: 55200,
        totalPnl: 5200,
        winRate: 58,
        trades: 234,
      },
      {
        id: "trader-tenant-beta-2",
        tenantId: "tenant-beta",
        name: "Elena Rossi",
        email: "elena@betatrading.co.uk",
        country: "GB",
        status: "suspended",
        joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        challengePhase: "phase-2",
        accountBalance: 15000,
        equity: 14200,
        totalPnl: -1800,
        winRate: 41,
        trades: 156,
      },
      {
        id: "trader-tenant-gamma-1",
        tenantId: "tenant-gamma",
        name: "James Park",
        email: "james@gammafutures.com",
        country: "US",
        status: "active",
        joinedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        challengePhase: "phase-1",
        accountBalance: 12000,
        equity: 13500,
        totalPnl: 1200,
        winRate: 38,
        trades: 97,
      },
    ];
    return all.filter((t: any) => t.tenantId === tenant.id || t.tenantId === "platform");
  }, [tenant.id]);

  const displayedTraders = useMemo(() => traders.length > 0 ? traders : fallbackTraders, [traders, tenant.id]);

  // Column definitions for the DataTable
  const columns = useMemo(
    <T>() => [
      {
        key: "name",
        header: t("trader.name"),
        cell: (row: Trader) => (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary-600" />
            <span className="font-medium text-foreground truncate">{row.name}</span>
          </div>
        ),
        sortValue: (row: Trader) => row.name,
      },
      {
        key: "country",
        header: t("trader.country"),
        cell: (row: Trader) => (
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted text-xs font-semibold">
              {row.initials}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">{row.country}</span>
          </div>
        ),
        sortValue: (row: Trader) => row.country,
      },
      {
        key: "challengePhase",
        header: t("trader.challengePhase"),
        cell: (row: Trader) => {
          const phaseLabels: Record<string, string> = {
            phase_1: "Phase 1",
            phase_2: "Phase 2",
            funded: "Funded",
            none: "Invited",
          };
          const label = phaseLabels[row.challengePhase] || row.challengePhase;
          const tones: Record<string, "success" | "warning" | "info" | "danger" | "muted"> = {
            phase_1: "info",
            phase_2: "warning",
            funded: "success",
            none: "info",
          };
          return (
            <StatusBadge tone={tones[row.challengePhase] || "muted"} className="h-2 w-2 me-1" />
            <span className="text-[10px] font-medium">{label}</span>
          );
        },
        sortValue: (row: Trader) => row.challengePhase,
      },
      {
        key: "status",
        header: t("trader.status"),
        cell: (row: Trader) => (
          <StatusBadge
            tone={
              row.status === "active"
                ? "success"
                : row.status === "breached"
                  ? "danger"
                  : row.status === "suspended"
                    ? "warning"
                    : "info"
            }
            className="h-2 w-2 me-1"
          />
          <span className="text-[10px] font-medium">{row.status}</span>
        ),
        sortValue: (row: Trader) => row.status,
      },
      {
        key: "accountBalance",
        header: t("trader.accountBalance"),
        cell: (row: Trader) => (
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-medium text-foreground">
              {formatCurrency(row.accountBalance, tenant.currency)}
            </span>
            <StatusBadge
              tone="success"
              className="h-2 w-2 text-[10px] opacity-80"
            >
              +
            </StatusBadge>
            <span className="text-[10px] text-muted-foreground">
              {row.equity - row.accountBalance > 0 ? "+" : ""}{row.equity - row.accountBalance}
            </span>
          </div>
        ),
        sortValue: (row: Trader) => row.accountBalance,
        numeric: true,
      },
      {
        key: "totalPnl",
        header: t("trader.totalPnl"),
        cell: (row: Trader) => (
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-medium text-foreground">
              {formatCurrency(row.totalPnl, tenant.currency)}
            </span>
            {row.totalPnl >= 0 && (
              <StatusBadge tone="success" className="h-2 w-2 text-[10px] opacity-80" />
            )}
            {row.totalPnl < 0 && (
              <StatusBadge tone="danger" className="h-2 w-2 text-[10px] opacity-80" />
            )}
          </div>
        ),
        sortValue: (row: Trader) => row.totalPnl,
        numeric: true,
      },
      {
        key: "winRate",
        header: t("trader.winRate"),
        cell: (row: Trader) => (
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-medium text-foreground">{row.winRate}%</span>
            <StatusBadge
              tone="success"
              className="h-2 w-2 text-[10px] opacity-80"
            >
              +
            </StatusBadge>
          </div>
        ),
        sortValue: (row: Trader) => row.winRate,
        numeric: true,
      },
      {
        key: "trades",
        header: t("trader.trades"),
        cell: (row: Trader) => <span className="text-[10px] text-muted-foreground">{row.trades}</span>,
        sortValue: (row: Trader) => row.trades,
        numeric: true,
      },
      {
        key: "actions",
        header: t("trader.actions"),
        cell: (row: Trader) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="View trader details"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        },
        width: "120px",
      },
    ],
    [t]
  );

  // Pagination and state
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(displayedTraders.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = displayedTraders.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const toggleSort = (key: string) => {
    // Handled by DataTable
  };

  return (
    <Card className="p-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">
          {t("traderManagement.title", defaultValue: "Trader Management")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "traderManagement.subtitle",
            defaultValue: "View and manage all traders across tenants",
            _: 0
          )}
        </p>
      </CardHeader>

      <CardContent>
        <DataTable
          columns={columns as any}
          data={displayedTraders}
          loading={isLoading}
          searchPlaceholder={t("common.search", defaultValue: "Search...")}
          searchableText={(row: any) =>
            `${row.name} ${row.email} ${row.country} ${row.status}`.toLowerCase()
          }
          pageSize={pageSize}
          rowKey={(row: Trader) => row.id}
          onRowClick={(row) => {
            // Navigate to trader detail
            // navigate(`trader-detail`, { traderId: row.id });
          }}
          toolbar={
            <Button
              variant="primary"
              onClick={() => {
                // navigate(`trader-add`, { });
                // toast({ title: "Add Trader", description: "Use the trader creation flow" });
              }}
            >
              <Plus className="h-4 w-4" /> {t("common.add", defaultValue: "Add Trader")}
            </Button>
          }
          emptyTitle={t("common.noRecords", defaultValue: "No traders found")}
          emptyDescription={t(
            "traderManagement.empty",
            defaultValue: "No traders match the current filters.",
            _: 0
          )}
        />
      </CardContent>
    </Card>
  );
}