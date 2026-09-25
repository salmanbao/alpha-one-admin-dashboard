"use client";

/**
 * Risk — Account Label Analysis Page
 *
 * Shows account performance grouped by source label. Each label is a
 * grouping of accounts by acquisition source (e.g. Direct, Affiliate,
 * Giveaway, Third-Party). For each label, surfaces total / active /
 * funded / passed / failed counts plus revenue and profit margin.
 *
 * Rows are expandable to reveal individual accounts.
 *
 * Includes:
 *   - KPI row: Total Labels, Total Accounts, Overall Pass Rate, Overall Revenue
 *   - Search + date range + Export CSV
 *
 * Terra palette — emerald/amber/rose, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantChallenges,
  getTenantPayouts,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  Tags,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Calendar,
  Users,
  Wallet,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

type LabelKey = "direct" | "affiliate" | "giveaway" | "third-party" | "promo";
type DateRange = "7d" | "30d" | "90d" | "ytd";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

const LABEL_META: Record<LabelKey, { label: string; description: string }> = {
  direct: { label: "Direct", description: "Direct purchase — no referral source." },
  affiliate: { label: "Affiliate", description: "Introduced by an affiliate partner." },
  giveaway: { label: "Giveaway", description: "Promotional giveaway account — no purchase required." },
  "third-party": { label: "Third Party", description: "Referred by an external partner." },
  promo: { label: "Promo", description: "Discounted promotional account." },
};

/** Deterministic label assignment per account. */
function labelForAccount(a: TradingAccount): LabelKey {
  const n = parseInt(a.id.replace(/[^0-9]/g, "").slice(-3) || "0", 10);
  if (n % 11 === 0) return "giveaway";
  if (n % 7 === 0) return "third-party";
  if (n % 5 === 0) return "affiliate";
  if (n % 3 === 0) return "promo";
  return "direct";
}

/** Approximate revenue per account — varies by label. */
function revenueForLabel(label: LabelKey, size: number): number {
  const base = Math.max(35, Math.round(size * 0.022));
  switch (label) {
    case "giveaway": return 0;
    case "promo": return Math.round(base * 0.7);
    case "third-party": return Math.round(base * 0.85);
    default: return base;
  }
}

interface LabelGroup {
  key: LabelKey;
  label: string;
  description: string;
  accounts: TradingAccount[];
  total: number;
  active: number;
  funded: number;
  passed: number;
  failed: number;
  passRate: number;
  failRate: number;
  revenue: number;
  payouts: number;
  profitMargin: number;
}

export function RiskAccountLabelAnalysisPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const challenges = useMemo(() => getTenantChallenges(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("90d");
  const [expanded, setExpanded] = useState<Set<LabelKey>>(new Set(["direct"]));

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

  // Build groups
  const groups = useMemo<LabelGroup[]>(() => {
    const map = new Map<LabelKey, LabelGroup>();
    (Object.keys(LABEL_META) as LabelKey[]).forEach((k) => {
      map.set(k, {
        key: k,
        label: LABEL_META[k].label,
        description: LABEL_META[k].description,
        accounts: [],
        total: 0,
        active: 0,
        funded: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
        failRate: 0,
        revenue: 0,
        payouts: 0,
        profitMargin: 0,
      });
    });

    const inRangeAccounts = accounts.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
    const inRangeChallenges = challenges.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
    const inRangePayouts = payouts.filter((p) => new Date(p.createdAt).getTime() >= cutoff);

    // Payouts per trader
    const payoutsByTrader = new Map<string, number>();
    for (const p of inRangePayouts) {
      payoutsByTrader.set(p.traderId, (payoutsByTrader.get(p.traderId) ?? 0) + p.amount);
    }

    for (const a of inRangeAccounts) {
      const k = labelForAccount(a);
      const g = map.get(k)!;
      g.accounts.push(a);
      g.total += 1;
      g.revenue += revenueForLabel(k, a.balance);
      g.payouts += payoutsByTrader.get(a.traderId) ?? 0;
      if (a.status === "active") g.active += 1;
      if (a.status === "passed") g.passed += 1;
      if (a.status === "breached") g.failed += 1;
      if (a.type === "funded" || a.phase === "funded") g.funded += 1;
    }

    // Pass/fail from challenges
    for (const c of inRangeChallenges) {
      // Find label by account id matching the trader
      const traderAccount = inRangeAccounts.find((a) => a.traderId === c.traderId);
      if (!traderAccount) continue;
      const k = labelForAccount(traderAccount);
      const g = map.get(k)!;
      if (c.status === "passed" || c.status === "funded") g.passed += 1;
      if (c.status === "failed") g.failed += 1;
    }

    for (const g of map.values()) {
      g.passRate = g.total > 0 ? Math.round((g.passed / g.total) * 1000) / 10 : 0;
      g.failRate = g.total > 0 ? Math.round((g.failed / g.total) * 1000) / 10 : 0;
      g.profitMargin = g.revenue > 0
        ? Math.round(((g.revenue - g.payouts) / g.revenue) * 1000) / 10
        : 0;
    }

    const order: LabelKey[] = ["direct", "affiliate", "promo", "third-party", "giveaway"];
    return order.map((k) => map.get(k)!).filter((g) => g.accounts.length > 0);
  }, [accounts, challenges, payouts, cutoff]);

  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo<LabelGroup[]>(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        accounts: g.accounts.filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.traderName.toLowerCase().includes(q) ||
            a.login.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.accounts.length > 0);
  }, [groups, q]);

  const effectiveExpanded = useMemo<Set<LabelKey>>(() => {
    if (q && filteredGroups.length > 0) {
      return new Set(filteredGroups.map((g) => g.key));
    }
    return expanded;
  }, [q, filteredGroups, expanded]);

  const toggleGroup = (k: LabelKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // KPI totals
  const totalLabels = groups.length;
  const totalAccountsAll = groups.reduce((s, g) => s + g.accounts.length, 0);
  const totalPassedAll = groups.reduce((s, g) => s + g.passed, 0);
  const totalRevenueAll = groups.reduce((s, g) => s + g.revenue, 0);
  const overallPassRate = totalAccountsAll > 0
    ? Math.round((totalPassedAll / totalAccountsAll) * 1000) / 10
    : 0;

  const exportCsv = () => {
    toast({
      title: "Export started (demo)",
      description: `Would export ${totalAccountsAll} labeled accounts as CSV in production.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Account Label Analysis"
        description="Performance by account source label — pass rates, revenue, and profit margin per acquisition channel."
        icon={Tags}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Labels" value={totalLabels} icon={Tags} tone="default" />
          <MetricCard label="Total Accounts" value={totalAccountsAll} icon={Users} tone="default" />
          <MetricCard
            label="Overall Pass Rate"
            value={`${overallPassRate}%`}
            icon={CheckCircle2}
            tone={overallPassRate >= 30 ? "positive" : "warning"}
          />
          <MetricCard
            label="Overall Revenue"
            value={formatCurrency(totalRevenueAll, currency)}
            icon={Wallet}
            tone="positive"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account, trader, or login…"
              className="pl-8"
              aria-label="Search accounts"
            />
          </div>
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
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredGroups.reduce((s, g) => s + g.accounts.length, 0)} of {totalAccountsAll} accounts across {filteredGroups.length} labels
          </span>
        </div>

        {/* Grouped expandable table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" style={{ width: "40px" }} />
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Account Label</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Total</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Active</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Funded</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Passed</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Failed</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Pass Rate</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Fail Rate</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Revenue</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No accounts match your search for this date range.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((g) => (
                  <GroupRow
                    key={g.key}
                    group={g}
                    isOpen={effectiveExpanded.has(g.key)}
                    onToggle={() => toggleGroup(g.key)}
                    currency={currency}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>
            Labels are derived deterministically from account identifiers for the demo. Revenue and payouts are
            approximated based on label rules — giveaway accounts generate no revenue, promo accounts receive a 30%
            discount.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}

function GroupRow({
  group,
  isOpen,
  onToggle,
  currency,
}: {
  group: LabelGroup;
  isOpen: boolean;
  onToggle: () => void;
  currency: string;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/30" onClick={onToggle}>
        <TableCell className="px-3 py-2.5">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
                aria-label={isOpen ? "Collapse group" : "Expand group"}
                aria-expanded={isOpen}
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell className="px-3 py-2.5">
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{group.label}</span>
            <span className="text-xs text-muted-foreground">{group.description}</span>
          </div>
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">{formatCompact(group.total)}</TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">{formatCompact(group.active)}</TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
            {group.funded}
          </Badge>
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">{formatCompact(group.passed)}</TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">{formatCompact(group.failed)}</TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          <span className={cn(group.passRate >= 30 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
            {group.passRate}%
          </span>
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          <span className={cn(group.failRate >= 30 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground")}>
            {group.failRate}%
          </span>
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums font-medium">
          {formatCurrency(group.revenue, currency)}
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          <Badge
            variant="outline"
            className={cn(
              group.profitMargin >= 50
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                : group.profitMargin >= 20
                ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                : "border-rose-500/40 text-rose-700 dark:text-rose-400",
            )}
          >
            {group.profitMargin}%
          </Badge>
        </TableCell>
      </TableRow>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={11} className="bg-muted/10 p-0">
          <Collapsible open={isOpen}>
            <CollapsibleContent>
              <div className="px-4 py-3">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide" style={{ width: "40px" }} />
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Account ID</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Login</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Trader</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Phase</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Status</TableHead>
                      <TableHead className="h-8 px-3 text-right text-[10px] uppercase tracking-wide">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.accounts.slice(0, 25).map((a) => (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell />
                        <TableCell className="px-3 py-2 font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="px-3 py-2 font-mono text-xs">{a.login}</TableCell>
                        <TableCell className="px-3 py-2 text-xs">{a.traderName}</TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{a.phase}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs tabular-nums">
                          {formatCurrency(a.balance, a.currency || currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {group.accounts.length > 25 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="px-3 py-2 text-center text-xs text-muted-foreground">
                          +{group.accounts.length - 25} more accounts…
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TableCell>
      </TableRow>
    </>
  );
}
