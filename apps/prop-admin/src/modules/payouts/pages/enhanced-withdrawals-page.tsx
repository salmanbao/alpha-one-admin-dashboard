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
import { hasPermission } from "@/lib/platform/permission-engine";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  payoutAmlBlock,
  usePayoutVersion,
} from "@/modules/payouts/payout-store";
import {
  PayoutRejectDialog,
  type PayoutRejectTarget,
  type PayoutRejectResult,
} from "@/components/platform/payout-reject-dialog";
import { TraderPerformanceChip } from "@/components/platform/trader-performance-chip";
import {
  RiskContextPanel,
  payoutRiskBandLabel,
} from "@pfaas/ui/platform-risk-context";
import { buildPayoutRisk, worstPayoutRisk } from "@/lib/platform/payout-risk";
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
  ArrowUpDown,
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

const DAY_MS = 86_400_000;

/** Processing SLA per method (business days from request → decision) —
 *  drives the queue ETA column and the "Processing timeframes" card so
 *  admins can answer "when will it arrive?" without leaving the queue
 *  (audit finding #4). Deterministic fixture, no runtime sampling. */
const METHOD_SLA_DAYS: Record<Payout["method"], number> = {
  "bank-transfer": 5,
  crypto: 1,
  paypal: 2,
  skrill: 3,
};

/** Average request → paid days per method over the last 12 months,
 *  with the SLA target the firm commits to. */
const METHOD_AVG_DAYS: Record<Payout["method"], { avg: number; target: number }> = {
  "bank-transfer": { avg: 5.4, target: 5 },
  crypto: { avg: 1.2, target: 1 },
  paypal: { avg: 2.3, target: 2 },
  skrill: { avg: 3.6, target: 3 },
};

/** Firm-wide average processing days per month (oldest → newest) —
 *  the historical view used to spot bottlenecks. Fixed fixture so the
 *  chart is stable across renders and screenshots. */
const MONTHLY_PROCESSING_DAYS = [4.9, 4.7, 5.2, 5.0, 4.6, 4.3, 4.5, 4.2, 4.0, 4.1, 3.9, 3.8];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month label for the trend bars — `back` months before the current one. */
function monthLabel(back: number): string {
  return MONTH_ABBR[(new Date().getMonth() - back + 24) % 12];
}

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

/**
 * Trader performance for payout decisions comes from the shared
 * TraderPerformanceChip (audit #3 fix #2) so every payout surface —
 * pending queue, table, this withdrawals queue — renders identical context.
 */

export function EnhancedWithdrawalsPage() {
  const { runtime, user, pushNotification } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  // In-page guard — batch approve/reject are payout decisions; a trader
  // viewing their own withdrawals (or any user without payout.approve)
  // sees the buttons disabled rather than acting on their own request.
  const canDecide = hasPermission(user, "payout.approve");
  const decideTitle = canDecide ? undefined : "Requires payout.approve";
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
  // Audit fix #3: batch reject target for the shared PayoutRejectDialog.
  const [rejectTarget, setRejectTarget] = useState<PayoutRejectTarget | null>(null);
  // Approve confirmation with profit-split preview (audit W #2) — the
  // operator sees trader vs firm share before the batch is committed.
  const [approveOpen, setApproveOpen] = useState(false);
  // Risk acknowledgment (audit #3) — approval is gated on the reviewer
  // explicitly confirming they read the risk context, so a payout can't
  // be approved blind.
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  // Build trader lookup for name + country + performance metrics
  const traderById = useMemo(() => {
    const m = new Map<string, { name: string; country: string; fullName: string; totalPnl: number; accountBalance: number; winRate: number; trades: number; challengePhase?: string }>();
    for (const t of traders) {
      m.set(t.id, { 
        name: t.name, 
        country: t.country, 
        fullName: t.name,
        totalPnl: t.totalPnl,
        accountBalance: t.accountBalance,
        winRate: t.winRate,
        trades: t.trades,
        challengePhase: t.challengePhase,
      });
    }
    return m;
  }, [traders]);

  // KYC status per trader
  const kycByTrader = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kyc) m.set(k.traderId, k.status);
    return m;
  }, [kyc]);

  // Risk context per trader (audit #3) — feeds both the reject dialog
  // and the approval acknowledgment gate. Derived from the fixtures, so
  // the same trader always shows the same rating.
  const riskByTrader = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildPayoutRisk>>();
    for (const t of traders) m.set(t.id, buildPayoutRisk(tid, t.id));
    return m;
  }, [traders, tid]);

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

  // Pending queue position (audit finding #4) — oldest request first,
  // so the admin can tell a trader exactly where their payout sits.
  const pendingQueue = useMemo(() => {
    const q = payouts
      .filter((p) => p.status === "pending")
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return new Map(q.map((p, i) => [p.id, i + 1]));
  }, [payouts]);

  /** Timing cell — queue position + ETA for in-flight requests, actual
   *  turnaround for completed ones (audit finding #4). */
  const renderTiming = (p: Payout) => {
    if (p.status === "paid" && p.processedAt) {
      const days = Math.max(
        0,
        Math.round((new Date(p.processedAt).getTime() - new Date(p.createdAt).getTime()) / DAY_MS),
      );
      return <span className="text-xs text-muted-foreground">Completed in {days}d</span>;
    }
    if (p.status === "rejected") {
      return <span className="text-xs text-muted-foreground">Decided, not paid</span>;
    }
    const sla = METHOD_SLA_DAYS[p.method] ?? 3;
    const eta = new Date(new Date(p.createdAt).getTime() + sla * DAY_MS);
    const overdueBy = Math.ceil((Date.now() - eta.getTime()) / DAY_MS);
    const queuePos = pendingQueue.get(p.id);
    return (
      <div className="flex flex-col gap-0.5">
        {queuePos ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Queue #{queuePos} of {pendingCount}
          </span>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {sla}d method SLA
          </span>
        )}
        {overdueBy > 0 ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Overdue by {overdueBy}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            ETA {eta.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    );
  };

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

  // The approval is gated on the *riskiest* trader in the selection —
  // approving a batch is only as safe as its weakest member (audit #3).
  const approveRisk = useMemo(
    () =>
      selectedPayouts.length > 0
        ? worstPayoutRisk(
            tid,
            selectedPayouts.map((p) => p.traderId),
          )
        : undefined,
    [selectedPayouts, tid],
  );

  const batchApprove = () => {
    // Commit each selected payout's decision to the payout-store so
    // every other payout surface (Pending Payouts queue, dashboard
    // widget, Payout History) reflects the new status instantly.
    //
    // R3-F02 — a frozen AML case blocks money-moving decisions: the store
    // would refuse them silently, so pre-check the batch and report which
    // trader froze it (same pattern as the single-row decision surfaces).
    for (const p of selectedPayouts) {
      const aml = payoutAmlBlock(p.reference);
      if (aml) {
        toast({
          title: "Batch approve blocked",
          description: `${p.traderName} is on AML hold ${aml.caseId} (${aml.typology}). Release it on the case — compliance.aml.approve — or exclude the withdrawal.`,
          variant: "destructive",
        });
        return;
      }
    }
    for (const p of selectedPayouts) applyPayoutDecision(p.reference, "approved");
    toast({
      title: "Batch approved",
      description: `${selected.size} withdrawal${selected.size === 1 ? "" : "s"} approved.`,
    });
    setSelected(new Set());
  };
  // Audit fix #3: batch reject collects a structured reason + detail
  // (same dialog as single-row rejects) instead of rejecting silently.
  const confirmBatchReject = (result: PayoutRejectResult) => {
    for (const p of selectedPayouts) {
      applyPayoutDecision(p.reference, "rejected", { reason: result.reason });
      if (result.notifyTrader) {
        pushNotification({
          title: "Payout rejected",
          message: `Your payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) was rejected: ${result.reason}`,
          severity: "critical",
          module: "payouts",
        });
      }
    }
    toast({
      title: "Batch rejected",
      description: `${selected.size} withdrawal${selected.size === 1 ? "" : "s"} rejected — ${result.reason}`,
      variant: "destructive",
    });
    setSelected(new Set());
    setRejectTarget(null);
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
      { key: "traderPnl", header: "Trader PnL", value: (p) => traderById.get(p.traderId)?.totalPnl ?? "—" },
      { key: "winRate", header: "Win Rate %", value: (p) => traderById.get(p.traderId)?.winRate ?? "—" },
      { key: "trades", header: "Trades", value: (p) => traderById.get(p.traderId)?.trades ?? "—" },
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
      { key: "traderPnl", header: "Trader PnL", value: (p) => traderById.get(p.traderId)?.totalPnl ?? "—" },
      { key: "winRate", header: "Win Rate %", value: (p) => traderById.get(p.traderId)?.winRate ?? "—" },
      { key: "trades", header: "Trades", value: (p) => traderById.get(p.traderId)?.trades ?? "—" },
    ];
    exportToCsv(sorted, cols, `withdrawals-${Date.now()}.csv`);
  };

  const onRowClick = (p: Payout) => {
    toast({
      title: "Withdrawal detail",
      description: `Opening ${p.reference} (${p.traderName}) — demo only.`,
    });
  };

  // Sort header cell renderer — same visual language as the shared
  // DataTable (audit finding #9): ArrowUpDown = sortable but inactive,
  // ArrowUp/ArrowDown = active direction, and the button always says
  // the current state for screen readers.
  const SortHeader = ({ k, label, numeric = false }: { k: string; label: string; numeric?: boolean }) => {
    const active = sortKey === k;
    return (
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground",
          numeric && "justify-end",
        )}
        onClick={() => toggleSort(k)}
        aria-label={`Sort by ${label}${active ? ` (currently ${sortDir === "asc" ? "ascending" : "descending"})` : ""}`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    );
  };

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
              <Button size="sm" variant="default" onClick={() => setApproveOpen(true)} disabled={!canDecide} title={decideTitle} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedPayouts.length === 0) return;
                  // Batch target carries the amount-weighted split blend
                  // and (for a single payout) the trader snapshot, so the
                  // shared dialog renders the payout calculation preview
                  // (audit X #1/#5).
                  const totalAmt = selectedPayouts.reduce((s, p) => s + p.amount, 0);
                  const blended =
                    totalAmt > 0
                      ? Math.round(
                          selectedPayouts.reduce((s, p) => s + (p.amount * p.profitSplit) / 100, 0) /
                            totalAmt,
                        )
                      : undefined;
                  setRejectTarget({
                    reference: selectedPayouts[0].reference,
                    traderName: selectedPayouts[0].traderName,
                    amount: totalAmt,
                    currency: selectedPayouts[0].currency,
                    count: selectedPayouts.length,
                    profitSplit: blended,
                    // Risk context (audit #3) — the batch is gated by its
                    // riskiest member, so the reject dialog shows that
                    // trader's breaches, score and account health.
                    risk: worstPayoutRisk(
                      tid,
                      selectedPayouts.map((p) => p.traderId),
                    ),
                    performance:
                      selectedPayouts.length === 1
                        ? traderById.get(selectedPayouts[0].traderId)
                        : undefined,
                  });
                }}
                disabled={!canDecide || selected.size === 0}
                title={decideTitle}
                className="border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
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
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" aria-sort={sortKey === "login" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader k="login" label="Account Login" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader k="name" label="Full Name" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Country</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-wide" aria-sort={sortKey === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader k="amount" label="Amount" numeric />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Size</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Method</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">KYC Status</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" aria-sort={sortKey === "created" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader k="created" label="Created" />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">
                  Timing
                  <span className="sr-only"> — queue position and expected completion date</span>
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Performance</TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-wide" aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <SortHeader k="status" label="Status" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                      <TableCell className="px-3 py-2.5">{renderTiming(p)}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <TraderPerformanceChip trader={traderById.get(p.traderId)} />
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

        {/* Processing timeframes (audit finding #4) — per-method averages
            vs SLA target plus a 12-month trend, so admins can set exact
            expectations ("crypto lands next day, bank transfer ~5 days")
            and spot the method that is becoming the bottleneck. */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">Processing timeframes</h3>
              <p className="text-xs text-muted-foreground">
                Average request → paid per method, last 12 months. ETAs above use the same SLA.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {MONTHLY_PROCESSING_DAYS[MONTHLY_PROCESSING_DAYS.length - 1]}d current average
            </Badge>
          </div>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            {/* Per-method averages vs target */}
            <div className="space-y-2" role="list" aria-label="Average processing days by method">
              {(["bank-transfer", "crypto", "paypal", "skrill"] as const).map((m) => {
                const Icon = methodIcon(m);
                const { avg, target } = METHOD_AVG_DAYS[m];
                const pct = Math.min(100, Math.round((avg / 6) * 100));
                const overTarget = avg > target;
                return (
                  <div key={m} className="flex items-center gap-2 text-xs" role="listitem">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="w-24 shrink-0 capitalize text-foreground">{m.replace("-", " ")}</span>
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={avg}
                      aria-valuemin={0}
                      aria-valuemax={6}
                      aria-label={`${m.replace("-", " ")}: ${avg} day average, ${target} day target`}
                    >
                      <div
                        className={cn("h-full rounded-full", overTarget ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                      {avg}d avg · {target}d target
                    </span>
                  </div>
                );
              })}
            </div>
            {/* 12-month firm-wide trend */}
            <div>
              <p className="text-xs text-muted-foreground">
                Firm-wide average days per month
              </p>
              <div
                className="mt-2 flex h-24 items-end gap-1"
                role="img"
                aria-label={`12-month processing trend, improving from ${MONTHLY_PROCESSING_DAYS[0]} days to ${MONTHLY_PROCESSING_DAYS[MONTHLY_PROCESSING_DAYS.length - 1]} days: ${MONTHLY_PROCESSING_DAYS.join(", ")}`}
              >
                {MONTHLY_PROCESSING_DAYS.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-t",
                      i === MONTHLY_PROCESSING_DAYS.length - 1 ? "bg-emerald-500" : "bg-emerald-500/50",
                    )}
                    style={{ height: `${Math.min(100, Math.round((d / 6) * 100))}%` }}
                    title={`${monthLabel(MONTHLY_PROCESSING_DAYS.length - 1 - i)}: ${d} days`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{monthLabel(MONTHLY_PROCESSING_DAYS.length - 1)}</span>
                <span>{monthLabel(0)}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Account logins are derived from payout references for the demo. Country reflects the trader's registered
          country. Use batch selection to approve or reject multiple withdrawals simultaneously.
        </p>
      </PageContent>
      {/* Shared reject dialog (audit fix #3) — structured reason for batch rejects */}
      <PayoutRejectDialog
        target={rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        onConfirm={confirmBatchReject}
      />
      {/* Approve confirmation with profit-split preview (audit W #2) —
          trader share vs firm retention per payout and in total, shown
          before the batch is committed instead of after.
          Audit #3 adds contextual risk assessment: the riskiest trader
          in the selection, their breach history and account health, a
          plain-language risk rating, and an acknowledgment that gates
          the Approve button so no payout can be approved blind. */}
      <Dialog
        open={approveOpen}
        onOpenChange={(o) => {
          setApproveOpen(o);
          // Acknowledgment is per-invocation — reopening starts clean.
          if (!o) setRiskAcknowledged(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Approve {selectedPayouts.length} withdrawal{selectedPayouts.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Profit-split preview at each payout&apos;s configured split — what the trader receives
              versus what the firm retains.
            </DialogDescription>
          </DialogHeader>

          {/* Risk assessment (audit #3) — the context the reviewer must
              read before the approve button unlocks. */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">Risk assessment</span>
              {approveRisk && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    approveRisk.riskScore < 30
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : approveRisk.riskScore < 50
                        ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                        : approveRisk.riskScore < 70
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {payoutRiskBandLabel(approveRisk.riskScore)} · {approveRisk.riskScore}/100
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {approveRisk
                ? `Showing the riskiest trader in this selection${
                    selectedPayouts.length > 1 ? ` (${selectedPayouts.length} payouts)` : ""
                  } — approving a batch is only as safe as its weakest member.`
                : "No risk profile is available for the selected traders; approve with the performance context below."}
            </p>
            <RiskContextPanel risk={approveRisk} currency={currency} />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto">
            {selectedPayouts.map((p) => {
              const traderShare = Math.round((p.amount * p.profitSplit) / 100);
              const firmShare = p.amount - traderShare;
              const rowRisk = riskByTrader.get(p.traderId);
              return (
                <div key={p.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.reference} · {p.traderName}</span>
                    <span className="tabular-nums font-semibold">{formatCurrency(p.amount, p.currency)}</span>
                  </div>
                  {/* Performance snapshot (audit X #5) — same chip as the
                      table rows, so the approval carries full context. */}
                  <div className="mt-1">
                    <TraderPerformanceChip trader={traderById.get(p.traderId)} compact />
                  </div>
                  {/* Per-payout risk line (audit #3) — score + open
                      breaches at a glance, before the full panel. */}
                  {rowRisk && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        Risk {rowRisk.riskScore}/100 · {payoutRiskBandLabel(rowRisk.riskScore)}
                      </span>
                      <span className={rowRisk.breaches.open > 0 ? "font-medium text-rose-700 dark:text-rose-400" : undefined}>
                        {rowRisk.breaches.open > 0
                          ? `${rowRisk.breaches.open} open breach${rowRisk.breaches.open === 1 ? "" : "es"}`
                          : "No open breaches"}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Split {p.profitSplit}% trader / {100 - p.profitSplit}% firm</span>
                    <span className="tabular-nums">
                      {formatCurrency(traderShare, p.currency)} to trader · {formatCurrency(firmShare, p.currency)} to firm
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Totals</span>
            <span className="tabular-nums">
              {formatCurrency(
                selectedPayouts.reduce((s, p) => s + Math.round((p.amount * p.profitSplit) / 100), 0),
                currency,
              )}{" "}
              to traders ·{" "}
              {formatCurrency(
                selectedPayouts.reduce((s, p) => s + p.amount - Math.round((p.amount * p.profitSplit) / 100), 0),
                currency,
              )}{" "}
              to firm
            </span>
          </div>

          {/* Acknowledgment gate (audit #3) — the reviewer confirms they
              read the risk context; Approve stays disabled until then. */}
          <label
            htmlFor="payout-risk-ack"
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
          >
            <Checkbox
              id="payout-risk-ack"
              checked={riskAcknowledged}
              onCheckedChange={(v) => setRiskAcknowledged(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">I have reviewed the risk context above</span> — recent
              breaches, account health and the profit-split math — and approve this payout
              knowingly.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!riskAcknowledged}
              title={riskAcknowledged ? undefined : "Acknowledge the risk context to approve"}
              onClick={() => {
                setApproveOpen(false);
                setRiskAcknowledged(false);
                batchApprove();
              }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
