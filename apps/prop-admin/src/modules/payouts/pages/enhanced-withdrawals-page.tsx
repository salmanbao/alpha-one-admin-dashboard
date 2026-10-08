"use client";

/**
 * Payouts — Enhanced Withdrawals Page
 *
 * Comprehensive withdrawal management view with batch selection, filters,
 * and contextual actions. Built on top of getTenantPayouts.
 *
 * Includes:
 *   - Summary stat cards: Pending Count, Overall Pending Amount (formatCurrency),
 *     Approved Today, Rejected Today
 *   - DataTable with: Checkbox, Account Login, Full Name, Country, Amount,
 *     Size, Method, KYC Status (ExplainableStateBadge), Created Date,
 *     Status (ExplainableStateBadge)
 *   - Batch action toolbar (Approve Selected / Reject Selected / Export Selected)
 *   - Search + filter by status / method / KYC + date range
 *   - Row click → toast (demo for detail navigation)
 *   - Export CSV button
 *
 * Terra palette — emerald/amber/rose, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantKyc,
  getTenantPayouts,
  getTenantTraders,
  getTraderForUser,
  getTraderPayouts,
  type Payout,
} from "@/lib/platform/mock-data";
import { exportToCsv, type ExportColumn } from "@/lib/platform/export-utils";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  applyPayoutDecision,
  effectivePayoutStatus,
  usePayoutVersion,
} from "@/modules/payouts/payout-store";
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  Calendar,
  ArrowUp,
  ArrowDown,
  Banknote,
  CreditCard,
  Bitcoin,
  ArrowLeftRight,
  Filter,
} from "lucide-react";

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";
type StatusFilter = "all" | "pending" | "approved" | "processing" | "paid" | "rejected";
type MethodFilter = "all" | "bank-transfer" | "crypto" | "paypal" | "skrill";
type KycFilter = "all" | "approved" | "review" | "pending" | "rejected";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

const METHOD_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "All methods" },
  { value: "bank-transfer", label: "Bank transfer" },
  { value: "crypto", label: "Crypto" },
  { value: "paypal", label: "PayPal" },
  { value: "skrill", label: "Skrill" },
];

const KYC_OPTIONS: { value: KycFilter; label: string }[] = [
  { value: "all", label: "All KYC" },
  { value: "approved", label: "Verified" },
  { value: "review", label: "Under review" },
  { value: "pending", label: "Awaiting submission" },
  { value: "rejected", label: "Verification failed" },
];

/** Account size buckets — derived from amount for the demo. */
function sizeForAmount(amount: number): { label: string; tone: "default" | "success" | "warning" } {
  if (amount >= 5000) return { label: "Large", tone: "warning" };
  if (amount >= 1000) return { label: "Medium", tone: "default" };
  return { label: "Small", tone: "success" };
}

/** Method icon helper — picks an icon based on method. */
function methodIcon(method: string): React.ComponentType<{ className?: string }> {
  switch (method) {
    case "bank-transfer": return Banknote;
    case "crypto": return Bitcoin;
    case "paypal": return CreditCard;
    case "skrill": return ArrowLeftRight;
    default: return Wallet;
  }
}

/** Pseudo account login — derived from payout reference. */
function loginForPayout(p: Payout): string {
  // Use the last digits of the reference for a deterministic pseudo login.
  const digits = p.reference.replace(/[^0-9]/g, "").slice(-6).padStart(6, "0");
  return `3388${digits}`;
}

/** Pseudo country — derived from trader if available, else deterministic. */
function countryForPayout(p: Payout, traderCountry?: string): string {
  if (traderCountry) return traderCountry;
  const n = parseInt(p.id.replace(/[^0-9]/g, "").slice(-3) || "0", 10);
  const fallback = ["United States", "United Kingdom", "UAE", "Singapore", "Germany", "India"];
  return fallback[n % fallback.length];
}

export function EnhancedWithdrawalsPage() {
  const { runtime, user } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  // Round 7: trader application users see only THEIR OWN withdrawals.
  const trader = getTraderForUser(user);

  // Subscribe to the payout-store so decisions made on the Pending
  // Payouts page, dashboard widget, or this Enhanced Withdrawals page
  // all reflect instantly — Round 3 wired the other surfaces; Round 4
  // closes the loop here so two payout surfaces never diverge.
  usePayoutVersion();
  const payouts = useMemo(
    () => (trader ? getTraderPayouts(trader.id) : getTenantPayouts(tid)).map((p) => ({ ...p, status: effectivePayoutStatus(p) })),
    [tid, trader],
  );
  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const kyc = useMemo(() => getTenantKyc(tid), [tid]);

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [kycFilter, setKycFilter] = useState<KycFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Build trader lookup for name + country
  const traderById = useMemo(() => {
    const m = new Map<string, { name: string; country: string; fullName: string }>();
    for (const t of traders) {
      m.set(t.id, { name: t.name, country: t.country, fullName: t.name });
    }
    return m;
  }, [traders]);

  // KYC status per trader
  const kycByTrader = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kyc) m.set(k.traderId, k.status);
    return m;
  }, [kyc]);

  // Date cutoff
  const cutoff = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    switch (dateRange) {
      case "24h": return now - dayMs;
      case "7d": return now - 7 * dayMs;
      case "30d": return now - 30 * dayMs;
      case "90d": return now - 90 * dayMs;
      case "all": return 0;
    }
  }, [dateRange]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((p) => {
      if (new Date(p.createdAt).getTime() < cutoff) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      const trader = traderById.get(p.traderId);
      const kycStatus = kycByTrader.get(p.traderId) ?? "pending";
      if (kycFilter !== "all" && kycStatus !== kycFilter) return false;
      if (q) {
        const login = loginForPayout(p);
        const fullName = trader?.fullName ?? p.traderName;
        const country = countryForPayout(p, trader?.country);
        const text = `${p.reference} ${login} ${fullName} ${country} ${p.method} ${p.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [payouts, cutoff, statusFilter, methodFilter, kycFilter, search, traderById, kycByTrader]);

  // Sort
  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case "amount":
          av = a.amount; bv = b.amount;
          break;
        case "created":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "status":
          av = a.status; bv = b.status;
          break;
        case "name":
          av = traderById.get(a.traderId)?.fullName ?? a.traderName;
          bv = traderById.get(b.traderId)?.fullName ?? b.traderName;
          break;
        case "login":
          av = loginForPayout(a); bv = loginForPayout(b);
          break;
        default:
          av = a.reference; bv = b.reference;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [filtered, sortKey, sortDir, traderById]);

  // KPI summary cards
  const pendingCount = payouts.filter((p) => p.status === "pending").length;
  const pendingAmount = payouts
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.amount, 0);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const approvedToday = payouts.filter(
    (p) => p.status === "approved" && p.processedAt && new Date(p.processedAt).getTime() >= startOfDay.getTime(),
  ).length;
  const rejectedToday = payouts.filter(
    (p) => p.status === "rejected" && p.processedAt && new Date(p.processedAt).getTime() >= startOfDay.getTime(),
  ).length;

  // Selection helpers
  const toggleAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((p) => p.id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("created");
      setSortDir("desc");
    }
  };

  const selectedPayouts = sorted.filter((p) => selected.has(p.id));

  const batchApprove = () => {
    // Commit each selected payout's decision to the payout-store so
    // every other payout surface (Pending Payouts queue, dashboard
    // widget, Payout History) reflects the new status instantly.
    for (const p of selectedPayouts) applyPayoutDecision(p.reference, "approved");
    toast({
      title: "Batch approved",
      description: `${selected.size} withdrawal${selected.size === 1 ? "" : "s"} approved.`,
    });
    setSelected(new Set());
  };
  const batchReject = () => {
    for (const p of selectedPayouts) applyPayoutDecision(p.reference, "rejected");
    toast({
      title: "Batch rejected",
      description: `${selected.size} withdrawal${selected.size === 1 ? "" : "s"} rejected.`,
      variant: "destructive",
    });
    setSelected(new Set());
  };
  const batchExport = () => {
    if (selectedPayouts.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Select one or more withdrawals to export.",
        variant: "destructive",
      });
      return;
    }
    const cols: ExportColumn<Payout>[] = [
      { key: "reference", header: "Reference", value: (p) => p.reference },
      { key: "login", header: "Account Login", value: (p) => loginForPayout(p) },
      { key: "traderName", header: "Full Name", value: (p) => p.traderName },
      { key: "amount", header: "Amount", value: (p) => p.amount },
      { key: "currency", header: "Currency", value: (p) => p.currency },
      { key: "method", header: "Method", value: (p) => p.method },
      { key: "status", header: "Status", value: (p) => p.status },
      { key: "createdAt", header: "Created", value: (p) => p.createdAt },
    ];
    exportToCsv(selectedPayouts, cols, `withdrawals-selected-${Date.now()}.csv`);
  };
  const exportAll = () => {
    const cols: ExportColumn<Payout>[] = [
      { key: "reference", header: "Reference", value: (p) => p.reference },
      { key: "login", header: "Account Login", value: (p) => loginForPayout(p) },
      { key: "traderName", header: "Full Name", value: (p) => p.traderName },
      { key: "amount", header: "Amount", value: (p) => p.amount },
      { key: "currency", header: "Currency", value: (p) => p.currency },
      { key: "method", header: "Method", value: (p) => p.method },
      { key: "status", header: "Status", value: (p) => p.status },
      { key: "createdAt", header: "Created", value: (p) => p.createdAt },
    ];
    exportToCsv(sorted, cols, `withdrawals-${Date.now()}.csv`);
  };

  const onRowClick = (p: Payout) => {
    toast({
      title: "Withdrawal detail",
      description: `Opening ${p.reference} (${p.traderName}) — demo only.`,
    });
  };

  // Sort header cell renderer
  const SortHeader = ({ k, label, numeric = false }: { k: string; label: string; numeric?: boolean }) => (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground",
        numeric && "justify-end",
      )}
      onClick={() => toggleSort(k)}
    >
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  const allChecked = sorted.length > 0 && selected.size === sorted.length;
  const someChecked = selected.size > 0 && selected.size < sorted.length;

  return (
    <Page>
      <PageHeader
        title="Enhanced Withdrawals"
        description="Comprehensive withdrawal management — search, filter, batch-approve, and export all in one place."
        icon={Wallet}
        actions={
          <Button size="sm" variant="outline" onClick={exportAll}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pending" value={pendingCount} icon={Clock} tone="warning" />
          <MetricCard
            label="Pending Amount"
            value={formatCurrency(pendingAmount, currency)}
            icon={Wallet}
            tone="warning"
          />
          <MetricCard label="Approved Today" value={approvedToday} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Rejected Today" value={rejectedToday} icon={XCircle} tone={rejectedToday > 0 ? "negative" : "positive"} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, login, name, country…"
              className="pl-8"
              aria-label="Search withdrawals"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as MethodFilter)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {METHOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kycFilter} onValueChange={(v) => setKycFilter(v as KycFilter)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="KYC status" />
            </SelectTrigger>
            <SelectContent>
              {KYC_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-9 w-[140px]">
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
            {sorted.length} of {payouts.length} withdrawals
          </span>
        </div>

        {/* Batch action toolbar */}
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {selected.size} selected · {formatCurrency(selectedPayouts.reduce((s, p) => s + p.amount, 0), currency)}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="default" onClick={batchApprove} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve Selected
              </Button>
              <Button size="sm" variant="outline" onClick={batchReject} className="border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                <XCircle className="mr-1 h-4 w-4" /> Reject Selected
              </Button>
              <Button size="sm" variant="outline" onClick={batchExport}>
                <Download className="mr-1 h-4 w-4" /> Export Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {/* Withdrawals table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-9 px-3" style={{ width: "40px" }}>
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all withdrawals"
                  />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">
                  <SortHeader k="login" label="Account Login" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">
                  <SortHeader k="name" label="Full Name" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Country</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide">
                  <SortHeader k="amount" label="Amount" numeric />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Size</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Method</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">KYC Status</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">
                  <SortHeader k="created" label="Created" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">
                  <SortHeader k="status" label="Status" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No withdrawals match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.slice(0, 50).map((p) => {
                  const trader = traderById.get(p.traderId);
                  const fullName = trader?.fullName ?? p.traderName;
                  const country = countryForPayout(p, trader?.country);
                  const size = sizeForAmount(p.amount);
                  const MethodIcon = methodIcon(p.method);
                  const kycStatus = kycByTrader.get(p.traderId) ?? "pending";
                  const isSelected = selected.has(p.id);
                  return (
                    <TableRow
                      key={p.id}
                      className={cn("cursor-pointer hover:bg-muted/30", isSelected && "bg-emerald-50/50 dark:bg-emerald-950/20")}
                      onClick={() => onRowClick(p)}
                    >
                      <TableCell className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(p.id)}
                          aria-label={`Select withdrawal ${p.reference}`}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs">{loginForPayout(p)}</TableCell>
                      <TableCell className="px-3 py-2.5 font-medium">{fullName}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{country}</Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {formatCurrency(p.amount, p.currency)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            size.tone === "warning"
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                              : size.tone === "success"
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {size.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{p.method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <ExplainableStateBadge status={kycStatus} entityType="kyc" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <ExplainableStateBadge status={p.status} entityType="payout" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {sorted.length > 50 ? (
            <div className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
              Showing 50 of {sorted.length} withdrawals. Refine filters to narrow results.
            </div>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Account logins are derived from payout references for the demo. Country reflects the trader's registered
          country. Use batch selection to approve or reject multiple withdrawals simultaneously.
        </p>
      </PageContent>
    </Page>
  );
}
