"use client";

/**
 * Risk — Group vs Payouts Page
 *
 * Shows payouts grouped by challenge configuration. Each row is a challenge
 * configuration (challenge type × account size). Reveals order revenue,
 * order count, total payouts, and profit margin per group.
 *
 * Includes:
 *   - KPI row: Total Groups, Total Revenue, Total Payouts, Overall Margin
 *   - Date range selector (7d / 30d / 90d / YTD)
 *   - Challenge Type filter dropdown
 *   - Export CSV button
 *   - Totals footer row (sums / averages)
 *
 * Terra palette — emerald/amber/rose, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantChallenges,
  getTenantPayouts,
  getTenantTraders,
  type Challenge,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import {
  formatCurrency,
  formatCompact,
  StatusBadge,
} from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Layers,
  Wallet,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Building2,
} from "lucide-react";

/** Approximate revenue per challenge order — derived from account size. */
function revenueForAccountSize(size: number): number {
  // Tiered entry fee: ~2.2% of account size with a $35 floor.
  return Math.max(35, Math.round(size * 0.022));
}

interface GroupRow {
  /** Composite key: challengeType × accountSize */
  key: string;
  challengeName: string;
  challengeType: string;
  accountSize: number;
  broker: string;
  orderRevenue: number;
  orderCount: number;
  totalPayouts: number;
  profitMargin: number; // %
}

type DateRange = "7d" | "30d" | "90d" | "ytd";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

/** Pseudo-broker names — deterministic per account size + challenge type. */
const BROKERS = ["IC Markets", "Pepperstone", "FTMO Broker", "DXTrade"];

function brokerFor(challengeType: string, accountSize: number): string {
  const n = (challengeType.length + accountSize) % BROKERS.length;
  return BROKERS[n];
}

export function RiskGroupVsPayoutsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const challenges = useMemo(() => getTenantChallenges(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [challengeTypeFilter, setChallengeTypeFilter] = useState<string>("all");

  // Distinct challenge types derived from challenges.
  const challengeTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of challenges) set.add(c.name);
    return Array.from(set).sort();
  }, [challenges]);

  // Compute date cutoff based on range.
  const cutoff = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    switch (dateRange) {
      case "7d": return now - 7 * dayMs;
      case "30d": return now - 30 * dayMs;
      case "90d": return now - 90 * dayMs;
      case "ytd": return new Date(new Date().getFullYear(), 0, 1).getTime();
    }
  }, [dateRange]);

  // Group challenges by (challengeName × accountSize).
  const groups = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>();
    const inRangeChallenges = challenges.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
    const inRangePayouts = payouts.filter((p) => new Date(p.createdAt).getTime() >= cutoff);

    for (const c of inRangeChallenges) {
      const key = `${c.name}::${c.accountSize}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          challengeName: c.name,
          challengeType: c.name,
          accountSize: c.accountSize,
          broker: brokerFor(c.name, c.accountSize),
          orderRevenue: 0,
          orderCount: 0,
          totalPayouts: 0,
          profitMargin: 0,
        });
      }
      const g = map.get(key)!;
      g.orderCount += 1;
      g.orderRevenue += revenueForAccountSize(c.accountSize);
    }

    // Payouts attributed per challenge by trader distribution.
    // Each trader's payouts are spread across their challenge configs.
    const traderToChallenges = new Map<string, Challenge[]>();
    for (const c of inRangeChallenges) {
      const list = traderToChallenges.get(c.traderId) ?? [];
      list.push(c);
      traderToChallenges.set(c.traderId, list);
    }

    for (const p of inRangePayouts) {
      const tc = traderToChallenges.get(p.traderId);
      if (!tc || tc.length === 0) continue;
      const share = p.amount / tc.length;
      for (const c of tc) {
        const key = `${c.name}::${c.accountSize}`;
        const g = map.get(key);
        if (g) g.totalPayouts += share;
      }
    }

    for (const g of map.values()) {
      g.profitMargin = g.orderRevenue > 0
        ? Math.round(((g.orderRevenue - g.totalPayouts) / g.orderRevenue) * 1000) / 10
        : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.orderRevenue - a.orderRevenue);
  }, [challenges, payouts, cutoff]);

  const filteredGroups = useMemo(() => {
    if (challengeTypeFilter === "all") return groups;
    return groups.filter((g) => g.challengeType === challengeTypeFilter);
  }, [groups, challengeTypeFilter]);

  // KPI totals.
  const totalGroups = filteredGroups.length;
  const totalRevenue = filteredGroups.reduce((s, g) => s + g.orderRevenue, 0);
  const totalPayoutsSum = filteredGroups.reduce((s, g) => s + g.totalPayouts, 0);
  const overallMargin = totalRevenue > 0
    ? Math.round(((totalRevenue - totalPayoutsSum) / totalRevenue) * 1000) / 10
    : 0;
  const totalOrders = filteredGroups.reduce((s, g) => s + g.orderCount, 0);
  const avgMargin = totalGroups > 0
    ? Math.round(filteredGroups.reduce((s, g) => s + g.profitMargin, 0) / totalGroups * 10) / 10
    : 0;

  const exportCsv = () => {
    toast({
      title: "Export started",
      description: `Exporting ${totalGroups} challenge groups as CSV.`,
    });
  };

  // Helpful note: total accounts / traders reference.
  const totalAccounts = accounts.length;
  const totalTraders = traders.length;

  return (
    <Page>
      <PageHeader
        title="Group vs Payouts"
        description="Payouts grouped by challenge configuration — order revenue vs payout outflow per challenge type and account size."
        icon={Layers}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Groups" value={totalGroups} icon={Layers} tone="default" />
          <MetricCard
            label="Total Revenue"
            value={formatCurrency(totalRevenue, currency)}
            icon={Wallet}
            tone="positive"
          />
          <MetricCard
            label="Total Payouts"
            value={formatCurrency(totalPayoutsSum, currency)}
            icon={Wallet}
            tone="warning"
          />
          <MetricCard
            label="Overall Margin"
            value={`${overallMargin}%`}
            icon={TrendingUp}
            tone={overallMargin >= 30 ? "positive" : "warning"}
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={challengeTypeFilter} onValueChange={setChallengeTypeFilter}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="All challenge types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All challenge types</SelectItem>
                {challengeTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredGroups.length} of {groups.length} groups · {totalOrders} orders · {totalAccounts} accounts · {totalTraders} traders
          </span>
        </div>

        {/* Grouped table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Challenge Name</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Account Size</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Broker</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Order Revenue</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Order Count</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Total Payouts</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Profit Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No challenge groups match your filters for this date range.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((g) => (
                  <TableRow key={g.key} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{g.challengeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(g.accountSize, currency)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <StatusBadge tone="muted">{g.broker}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {formatCurrency(g.orderRevenue, currency)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right tabular-nums">
                      {formatCompact(g.orderCount)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(g.totalPayouts, currency)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right tabular-nums">
                      <Badge
                        variant="outline"
                        className={cn(
                          g.profitMargin >= 50
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                            : g.profitMargin >= 20
                            ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                            : "border-rose-500/40 text-rose-700 dark:text-rose-400",
                        )}
                      >
                        {g.profitMargin}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell className="px-3 py-2.5 font-semibold">Totals</TableCell>
                <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">—</TableCell>
                <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">All brokers</TableCell>
                <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">
                  {formatCurrency(totalRevenue, currency)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">
                  {formatCompact(totalOrders)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">
                  {formatCurrency(totalPayoutsSum, currency)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">
                  <Badge variant="outline" className="border-foreground/30 text-foreground">
                    {overallMargin}% <span className="ml-1 text-[10px] text-muted-foreground">avg {avgMargin}%</span>
                  </Badge>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Order revenue is approximated from account size (≈2.2% of size, $35 floor). Payouts are distributed
          across each trader's challenge configurations. Use the date range and challenge type filter to narrow scope.
        </p>
      </PageContent>
    </Page>
  );
}
