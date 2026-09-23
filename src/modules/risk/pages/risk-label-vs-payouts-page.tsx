"use client";

/**
 * Risk — Label vs Payouts Page
 *
 * Shows payouts grouped by account label/type (Third Party, Paid, Giveaway,
 * Standard). Each group is expandable to reveal the individual accounts within
 * it. KPI row totals the headline numbers across all labels.
 *
 * Uses a custom table renderer with Collapsible primitives because the shared
 * DataTable wrapper doesn't support grouped/expandable rows.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantPayouts,
  getTenantTraders,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Tags,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Users,
  Wallet,
  TrendingUp,
  Layers,
} from "lucide-react";

type LabelKey = "third-party" | "paid" | "giveaway" | "standard";

interface LabelGroup {
  key: LabelKey;
  label: string;
  description: string;
  accounts: TradingAccount[];
  revenue: number;
  totalPayouts: number;
  profitMargin: number;
  payoutRatio: number;
}

const LABEL_META: Record<LabelKey, { label: string; description: string }> = {
  "third-party": {
    label: "Third Party",
    description: "Accounts introduced by external affiliates and partners.",
  },
  paid: {
    label: "Paid",
    description: "Standard paid challenges purchased directly by traders.",
  },
  giveaway: {
    label: "Giveaway",
    description: "Promotional giveaway accounts — no purchase required.",
  },
  standard: {
    label: "Standard",
    description: "Standard evaluation accounts — the platform default.",
  },
};

/** Revenue per account (entry-fee approximation). */
const REVENUE_PER_ACCOUNT = 220;

/** Assign a label to a trading account — deterministic, based on id hashing. */
function labelForAccount(a: TradingAccount): LabelKey {
  // Use the trailing digits of the account id as a stable hash.
  const n = parseInt(a.id.replace(/[^0-9]/g, "").slice(-3) || "0", 10);
  if (n % 7 === 0) return "giveaway";
  if (n % 5 === 0) return "third-party";
  if (n % 3 === 0) return "paid";
  return "standard";
}

interface AccountRow {
  account: TradingAccount;
  payouts: number;
}

export function RiskLabelVsPayoutsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<LabelKey>>(new Set(["paid"]));

  // Build the label groups.
  const groups = useMemo<LabelGroup[]>(() => {
    const map = new Map<LabelKey, LabelGroup>();
    (Object.keys(LABEL_META) as LabelKey[]).forEach((k) => {
      map.set(k, {
        key: k,
        label: LABEL_META[k].label,
        description: LABEL_META[k].description,
        accounts: [],
        revenue: 0,
        totalPayouts: 0,
        profitMargin: 0,
        payoutRatio: 0,
      });
    });

    // Payouts per account.
    const payoutsByAccount = new Map<string, number>();
    for (const p of payouts) {
      // Find the trader's accounts.
      const traderAccounts = accounts.filter((a) => a.traderId === p.traderId);
      for (const a of traderAccounts) {
        payoutsByAccount.set(a.id, (payoutsByAccount.get(a.id) ?? 0) + p.amount / Math.max(1, traderAccounts.length));
      }
    }

    for (const a of accounts) {
      const key = labelForAccount(a);
      const grp = map.get(key)!;
      grp.accounts.push(a);
      grp.revenue += REVENUE_PER_ACCOUNT;
      grp.totalPayouts += payoutsByAccount.get(a.id) ?? 0;
    }

    for (const g of map.values()) {
      g.profitMargin =
        g.revenue > 0
          ? Math.round(((g.revenue - g.totalPayouts) / g.revenue) * 1000) / 10
          : 0;
      g.payoutRatio =
        g.revenue > 0
          ? Math.round((g.totalPayouts / g.revenue) * 1000) / 10
          : 0;
    }

    // Sort: standard first, then paid, third-party, giveaway.
    const order: LabelKey[] = ["standard", "paid", "third-party", "giveaway"];
    return order.map((k) => map.get(k)!).filter((g) => g.accounts.length > 0);
  }, [accounts, payouts]);

  // KPI totals — across all labels.
  const totalLabels = groups.length;
  const totalAccounts = groups.reduce((s, g) => s + g.accounts.length, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.revenue, 0);
  const totalPayoutsAll = groups.reduce((s, g) => s + g.totalPayouts, 0);
  const overallMargin =
    totalRevenue > 0
      ? Math.round(((totalRevenue - totalPayoutsAll) / totalRevenue) * 1000) / 10
      : 0;

  // Search filter — applies to account rows within groups.
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

  // Auto-expand any group with matching accounts when searching.
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

  const exportCsv = () => {
    toast({
      title: "Export started",
      description: `Exporting ${totalAccounts} labeled accounts as CSV.`,
    });
  };

  // Map account id → trader for table rendering.
  const traderById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) {
      const t = traders.find((tr) => tr.id === a.traderId);
      if (t) m.set(a.id, t.email);
    }
    return m;
  }, [accounts, traders]);

  // Build per-account payout lookup.
  const accountPayouts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts) {
      const traderAccounts = accounts.filter((a) => a.traderId === p.traderId);
      for (const a of traderAccounts) {
        m.set(
          a.id,
          (m.get(a.id) ?? 0) + p.amount / Math.max(1, traderAccounts.length),
        );
      }
    }
    return m;
  }, [payouts, accounts]);

  return (
    <Page>
      <PageHeader
        title="Label vs Payouts"
        description="Payouts grouped by account label — expand any group to see individual accounts."
        icon={Tags}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Total Labels" value={totalLabels} icon={Layers} tone="default" />
          <MetricCard label="Total Accounts" value={totalAccounts} icon={Users} tone="default" />
          <MetricCard label="Total Revenue" value={formatCurrency(totalRevenue, currency)} icon={Wallet} tone="positive" />
          <MetricCard label="Total Payouts" value={formatCurrency(totalPayoutsAll, currency)} icon={Wallet} tone="warning" />
          <MetricCard
            label="Overall Margin"
            value={`${overallMargin}%`}
            icon={TrendingUp}
            tone={overallMargin >= 30 ? "positive" : "warning"}
          />
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account id, trader, or login…"
              className="pl-8"
              aria-label="Search accounts"
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredGroups.reduce((s, g) => s + g.accounts.length, 0)} of {totalAccounts} accounts across {filteredGroups.length} labels
          </span>
        </div>

        {/* Grouped table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" style={{ width: "40px" }} />
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Label</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Accounts</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Revenue</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Total Payouts</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Profit Margin</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">Payout Ratio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                      <Search className="h-5 w-5" />
                      <p className="text-sm">No accounts match your search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((g) => {
                  const isOpen = effectiveExpanded.has(g.key);
                  return (
                    <GroupRow
                      key={g.key}
                      group={g}
                      isOpen={isOpen}
                      onToggle={() => toggleGroup(g.key)}
                      currency={currency}
                      accountPayouts={accountPayouts}
                      traderEmailById={traderById}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Labels are derived deterministically from account identifiers for the demo. Revenue is approximated at {formatCurrency(REVENUE_PER_ACCOUNT, currency)} per account.
        </p>
      </PageContent>
    </Page>
  );
}

/** A label group row with collapsible account details. */
function GroupRow({
  group,
  isOpen,
  onToggle,
  currency,
  accountPayouts,
  traderEmailById,
}: {
  group: LabelGroup;
  isOpen: boolean;
  onToggle: () => void;
  currency: string;
  accountPayouts: Map<string, number>;
  traderEmailById: Map<string, string>;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/30"
        onClick={onToggle}
      >
        <TableCell className="px-3 py-2.5">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
                aria-label={isOpen ? "Collapse group" : "Expand group"}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
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
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          {formatCompact(group.accounts.length)}
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          {formatCurrency(group.revenue, currency)}
        </TableCell>
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          {formatCurrency(group.totalPayouts, currency)}
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
        <TableCell className="px-3 py-2.5 text-right tabular-nums">
          {group.payoutRatio}%
        </TableCell>
      </TableRow>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={7} className="bg-muted/10 p-0">
          <Collapsible open={isOpen}>
            <CollapsibleContent>
              <div className="px-4 py-3">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide" style={{ width: "40px" }} />
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Account ID</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Login</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Trader Email</TableHead>
                      <TableHead className="h-8 px-3 text-[10px] uppercase tracking-wide">Phase</TableHead>
                      <TableHead className="h-8 px-3 text-right text-[10px] uppercase tracking-wide">Balance</TableHead>
                      <TableHead className="h-8 px-3 text-right text-[10px] uppercase tracking-wide">Payouts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.accounts.slice(0, 25).map((a) => (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell />
                        <TableCell className="px-3 py-2 font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="px-3 py-2 font-mono text-xs">{a.login}</TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          {traderEmailById.get(a.id) ?? "—"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{a.phase}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs tabular-nums">
                          {formatCurrency(a.balance, a.currency || currency)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs tabular-nums">
                          {formatCurrency(accountPayouts.get(a.id) ?? 0, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {group.accounts.length > 25 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="px-3 py-2 text-center text-xs text-muted-foreground">
                          +{group.accounts.length - 25} more accounts… (narrow search to see all)
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
