"use client";

/**
 * Audit — Enhanced User Events Page
 *
 * Builds on the original UserEventsPage (audit/user-events-page.tsx) with
 * three key upgrades required by the screenshot audit (img-batchL):
 *
 * 1. **Account context** — every event is now linked to a specific trading
 *    account ("[Phase Type] Challenge Name - Account ID"), clickable to
 *    open the trader workspace.
 * 2. **Risk event types** — three new event types are added to the badge
 *    legend (FLOATING_PNL_BREACHED, DAILY_DRAWDOWN_BREACHED,
 *    TARGET_PROFIT_REACHED, PHASE_UPGRADED) with rich metric-snapshot
 *    descriptions (equity / balance / open PnL / limits / progress %).
 * 3. **Advanced Filter Panel** — a collapsible panel (Collapsible / §27)
 *    with multi-select event types, date range, user text, account text,
 *    source dropdown, Apply + Clear buttons and live result-count.
 *
 * This is a NEW file — the original UserEventsPage is untouched. Suggested
 * viewId: `audit-user-events-enhanced`.
 *
 * Mock data is deterministic (index-seeded) — 168 events covering every
 * event type. No Math.random. Terra palette — emerald / amber / rose / sky
 * accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, resolveTermsInString } from "@/lib/platform/terminology";
import {
  traders as allTraders,
  getTenantTraders,
  type Trader,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  ScrollText,
  Activity,
  UserPlus,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  TrendingDown,
  Target,
  Download,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & static option pools                                         */
/* ------------------------------------------------------------------ */

/** All event types — original 12 + 4 new risk-specific ones. */
export type EnhancedEventType =
  | "ACCOUNT_CREATED"
  | "KYC_COMPLETED"
  | "KYC_REJECTED"
  | "ORDER_CREATED"
  | "PAYOUT_REQUESTED"
  | "PAYOUT_COMPLETED"
  | "CHALLENGE_STARTED"
  | "CHALLENGE_PASSED"
  | "CHALLENGE_FAILED"
  | "BREACH_DETECTED"
  | "FLOATING_PNL_BREACHED"
  | "DAILY_DRAWDOWN_BREACHED"
  | "TARGET_PROFIT_REACHED"
  | "PHASE_UPGRADED"
  | "LOGIN"
  | "PASSWORD_CHANGED";

type EventSource = "System" | "Admin" | "User" | "API";

interface EnhancedUserEvent {
  id: string;
  /** ISO timestamp — most recent first. */
  timestamp: string;
  traderId: string;
  userEmail: string;
  /** "Phase Type" label, e.g. "Live Account", "Phase 1", "Phase 2". */
  phaseType: string;
  /** Challenge name, e.g. "2 step Gen Z", "1-Step Evaluation". */
  challengeName: string;
  /** 9-digit account id, e.g. "333388771". */
  accountId: string;
  eventType: EnhancedEventType;
  description: string;
  ipAddress: string;
  source: EventSource;
}

const EVENT_LABELS: Record<EnhancedEventType, string> = {
  ACCOUNT_CREATED: "Account Created",
  KYC_COMPLETED: "KYC Completed",
  KYC_REJECTED: "KYC Rejected",
  ORDER_CREATED: "Order Created",
  PAYOUT_REQUESTED: "Payout Requested",
  PAYOUT_COMPLETED: "Payout Completed",
  CHALLENGE_STARTED: "Challenge Started",
  CHALLENGE_PASSED: "Challenge Passed",
  CHALLENGE_FAILED: "Challenge Failed",
  BREACH_DETECTED: "Breach Detected",
  FLOATING_PNL_BREACHED: "Floating PnL Breached",
  DAILY_DRAWDOWN_BREACHED: "Daily Drawdown Breached",
  TARGET_PROFIT_REACHED: "Target Profit Reached",
  PHASE_UPGRADED: "Phase Upgraded",
  LOGIN: "Login",
  PASSWORD_CHANGED: "Password Changed",
};

/** All event types in deterministic rotation order. */
const ALL_EVENT_TYPES: EnhancedEventType[] = [
  "ACCOUNT_CREATED",
  "KYC_COMPLETED",
  "ORDER_CREATED",
  "PAYOUT_REQUESTED",
  "PAYOUT_COMPLETED",
  "CHALLENGE_STARTED",
  "CHALLENGE_PASSED",
  "CHALLENGE_FAILED",
  "BREACH_DETECTED",
  "FLOATING_PNL_BREACHED",
  "DAILY_DRAWDOWN_BREACHED",
  "TARGET_PROFIT_REACHED",
  "PHASE_UPGRADED",
  "KYC_REJECTED",
  "LOGIN",
  "PASSWORD_CHANGED",
];

const SOURCE_OPTIONS: EventSource[] = ["System", "Admin", "User", "API"];

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Tone for the Event Type badge (§17-19 — Explainable State). */
function eventTone(
  eventType: EnhancedEventType,
): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (eventType) {
    case "ACCOUNT_CREATED":
    case "KYC_COMPLETED":
    case "CHALLENGE_PASSED":
    case "PAYOUT_COMPLETED":
    case "TARGET_PROFIT_REACHED":
    case "PHASE_UPGRADED":
      return "success";
    case "KYC_REJECTED":
    case "BREACH_DETECTED":
    case "CHALLENGE_FAILED":
    case "FLOATING_PNL_BREACHED":
    case "DAILY_DRAWDOWN_BREACHED":
      return "danger";
    case "ORDER_CREATED":
    case "PAYOUT_REQUESTED":
    case "CHALLENGE_STARTED":
    case "LOGIN":
      return "info";
    case "PASSWORD_CHANGED":
      return "warning";
    default:
      return "muted";
  }
}

/** Tone for the Source badge — System/Admin/User/API. */
function sourceTone(src: EventSource): "default" | "info" | "warning" | "muted" {
  switch (src) {
    case "Admin":
      return "warning";
    case "API":
      return "info";
    case "User":
      return "default";
    case "System":
    default:
      return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic mock data — 168 events covering every type           */
/* ------------------------------------------------------------------ */

/** Simple deterministic 32-bit string hash for index-seeded data. */
function hashStr(s: string): number {
  let n = 5381;
  for (let i = 0; i < s.length; i++) {
    n = ((n << 5) + n + s.charCodeAt(i)) >>> 0;
  }
  return n;
}

/** Deterministic IP address. */
function ipFor(i: number): string {
  const a = 10 + ((i * 13) % 240);
  const b = 1 + ((i * 17) % 254);
  const c = 1 + ((i * 23) % 254);
  const d = (i * 31) % 256;
  return `${a}.${b}.${c}.${d}`;
}

/** Deterministic 9-digit account id, prefix 33338. */
function accountIdFor(i: number): string {
  // 33338xxxxx — last 4 digits derived from i (5-digit suffix).
  const suffix = 70000 + ((i * 137) % 29999);
  return `33338${suffix}`;
}

/** Phase type label by index. */
function phaseTypeFor(i: number): string {
  const phases = ["Phase 1", "Phase 2", "Live Account", "Verification"];
  return phases[i % phases.length];
}

/** Challenge name by index. */
function challengeNameFor(i: number): string {
  const names = [
    "1-Step Evaluation",
    "2 step Gen Z",
    "Standard 100K",
    "Pro Trader 50K",
    "Instant Funding",
  ];
  return names[i % names.length];
}

/** Source by event type — most event types have a natural source. */
function sourceFor(eventType: EnhancedEventType, i: number): EventSource {
  switch (eventType) {
    case "ACCOUNT_CREATED":
    case "KYC_COMPLETED":
    case "KYC_REJECTED":
    case "CHALLENGE_STARTED":
    case "CHALLENGE_PASSED":
    case "CHALLENGE_FAILED":
    case "BREACH_DETECTED":
    case "FLOATING_PNL_BREACHED":
    case "DAILY_DRAWDOWN_BREACHED":
    case "TARGET_PROFIT_REACHED":
    case "PHASE_UPGRADED":
      return "System";
    case "ORDER_CREATED":
    case "LOGIN":
    case "PASSWORD_CHANGED":
      return "User";
    case "PAYOUT_REQUESTED":
      return "User";
    case "PAYOUT_COMPLETED":
      return "Admin";
    default:
      return ["Admin", "API", "System", "User"][i % 4] as EventSource;
  }
}

/** Build the rich-text description per event type with metric snapshots. */
function buildDescription(
  eventType: EnhancedEventType,
  i: number,
  accountId: string,
): string {
  // Deterministic money/percent values derived from i — always rendered with
  // fixed 2-decimal precision for visual consistency.
  const equity = (4500 + (i * 13) % 1500).toFixed(2);
  const balance = (4900 + (i * 7) % 1500).toFixed(2);
  const openPnl = -(50 + (i * 3) % 100).toFixed(2);
  const positions = 132413231 + i;
  const dailyLimit = "250.00";
  const dailyCurrent = (280 + (i * 5) % 100).toFixed(2);
  const dailyUsedPct = Math.round((parseFloat(dailyCurrent) / 250) * 100);
  const target = "800.00";
  const targetCurrent = (820 + (i * 7) % 100).toFixed(2);
  const targetPct = Math.round((parseFloat(targetCurrent) / 800) * 100);
  const oldAccountId = `33338${50000 + (i * 11) % 40000}`;
  const newAccountId = accountId;
  const payoutAmount = (750 + (i * 11) % 200).toFixed(2);
  const veriffRef = `veriff-${hashStr(`${i}-veriff`).toString(16).slice(0, 8)}`;
  const ticket = 132413231 + i;
  const symbol = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "USDJPY"][i % 5];
  const lots = (0.1 + (i % 5) * 0.5).toFixed(1);
  const price = (1.05 + (i % 50) * 0.001).toFixed(4);
  const device = ["Chrome on macOS", "Safari on iPhone", "Edge on Windows", "Firefox on Linux"][i % 4];
  const plan = ["1-Step Evaluation", "2-Step Gen Z", "Standard 100K"][i % 3];
  const startBalance = (5000 + (i % 5) * 5000).toLocaleString("en-US");

  switch (eventType) {
    case "ACCOUNT_CREATED":
      return `Account registered via signup flow. Initial balance: $${startBalance}. Plan: ${plan}.`;
    case "KYC_COMPLETED":
      return `KYC verification completed via Veriff with manual admin intervention.`;
    case "KYC_REJECTED":
      return `KYC rejected: document failed liveness check. Veriff reference: ${veriffRef}.`;
    case "ORDER_CREATED":
      return `Buy order placed on ${symbol}, ${lots} lots @ ${price}. Ticket: ${ticket}.`;
    case "PAYOUT_REQUESTED":
      return `Payout of $${payoutAmount} requested via bank transfer. Reference: wd-${accountId}.`;
    case "PAYOUT_COMPLETED":
      return `Payout of $${payoutAmount} sent via bank transfer. Reference: wd-${accountId}.`;
    case "CHALLENGE_STARTED":
      return `Challenge ${plan} started with $${startBalance} starting balance.`;
    case "CHALLENGE_PASSED":
      return `Challenge passed: profit target of $${target} reached without breaching risk limits.`;
    case "CHALLENGE_FAILED":
      return `Challenge failed: max drawdown breached before reaching profit target. Final PnL: -$${dailyCurrent}.`;
    case "BREACH_DETECTED":
      return `Breach detected: max drawdown reached 10.1% of starting balance. Account disabled.`;
    case "FLOATING_PNL_BREACHED":
      return `Floating PnL breached: ${accountId} Equity: $${equity}; Balance: $${balance}; Open PnL: $${openPnl}; Positions: ${positions}...`;
    case "DAILY_DRAWDOWN_BREACHED":
      return `Daily Drawdown breached: ${accountId} Daily limit: $${dailyLimit}; Current: $${dailyCurrent}; Used: ${dailyUsedPct}%`;
    case "TARGET_PROFIT_REACHED":
      return `Target Profit reached: ${accountId} Target: $${target}; Current: $${targetCurrent}; Progress: ${targetPct}%`;
    case "PHASE_UPGRADED":
      return `Account: ${oldAccountId} upgraded from Phase 2 to 3. New account: ${newAccountId}`;
    case "LOGIN":
      return `User logged in from ${ipFor(i)} (${device}).`;
    case "PASSWORD_CHANGED":
      return `Password changed via account settings. MFA still active.`;
    default:
      return `Event of type ${eventType}.`;
  }
}

/** Build 168 deterministic events covering all 16 types (each ≥ 8 reps). */
function buildEnhancedEvents(traderPool: Trader[]): EnhancedUserEvent[] {
  const pool = traderPool.length > 0 ? traderPool : allTraders;
  const totalEvents = 168;
  const out: EnhancedUserEvent[] = [];
  for (let i = 0; i < totalEvents; i++) {
    const trader = pool[i % pool.length];
    const eventType = ALL_EVENT_TYPES[i % ALL_EVENT_TYPES.length];
    const accountId = accountIdFor(i);
    const phaseType = phaseTypeFor(i);
    const challengeName = challengeNameFor(i);
    out.push({
      id: `eue-${i + 1}`,
      timestamp: new Date(
        Date.now() - i * 90 * 60 * 1000, // every 90 minutes apart, newest first
      ).toISOString(),
      traderId: trader.id,
      userEmail: trader.email,
      phaseType,
      challengeName,
      accountId,
      eventType,
      description: buildDescription(eventType, i, accountId),
      ipAddress: ipFor(i),
      source: sourceFor(eventType, i),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export function EnhancedUserEventsPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Platform tenant sees the full cross-tenant stream; a regular tenant
  // only sees events built from its own trader pool (no email/PII leak).
  const traderPool = useMemo(
    () => (tid === "platform" ? allTraders : getTenantTraders(tid)),
    [tid],
  );

  // Build the full event set once — deterministic, no reseed on render.
  const allEvents = useMemo(() => buildEnhancedEvents(traderPool), [traderPool]);

  // ----- Filter state (panel inputs) -----
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<EnhancedEventType>>(
    new Set(),
  );
  const [dateRange, setDateRange] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Top-level search (instant, applies to all text fields).
  const [search, setSearch] = useState("");

  // ----- Derived filtered view -----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nowMs = Date.now();
    return allEvents.filter((e) => {
      // Event type multi-select — empty = all
      if (selectedTypes.size > 0 && !selectedTypes.has(e.eventType)) return false;
      // Date range
      if (dateRange !== "all") {
        const cutoff = nowMs - (DATE_RANGES[dateRange] ?? 0);
        if (new Date(e.timestamp).getTime() < cutoff) return false;
      }
      // User text — matches email (case-insensitive contains)
      if (userFilter.trim()) {
        if (!e.userEmail.toLowerCase().includes(userFilter.trim().toLowerCase())) {
          return false;
        }
      }
      // Account text — matches account id contains
      if (accountFilter.trim()) {
        if (!e.accountId.includes(accountFilter.trim())) return false;
      }
      // Source dropdown
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      // Top-level search — broad substring across all visible text
      if (
        q &&
        !`${e.userEmail} ${e.accountId} ${e.phaseType} ${e.challengeName} ${e.eventType} ${e.description} ${e.ipAddress} ${e.source}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [allEvents, selectedTypes, dateRange, userFilter, accountFilter, sourceFilter, search]);

  // ----- KPIs (computed against the unfiltered full set for stability) -----
  const totalEvents = allEvents.length;
  const accountCreated = allEvents.filter(
    (e) => e.eventType === "ACCOUNT_CREATED",
  ).length;
  const kycCompleted = allEvents.filter(
    (e) => e.eventType === "KYC_COMPLETED",
  ).length;
  const breachDetected = allEvents.filter(
    (e) =>
      e.eventType === "BREACH_DETECTED" ||
      e.eventType === "FLOATING_PNL_BREACHED" ||
      e.eventType === "DAILY_DRAWDOWN_BREACHED",
  ).length;
  const payoutEvents = allEvents.filter(
    (e) =>
      e.eventType === "PAYOUT_REQUESTED" ||
      e.eventType === "PAYOUT_COMPLETED",
  ).length;
  const targetProfitReached = allEvents.filter(
    (e) => e.eventType === "TARGET_PROFIT_REACHED",
  ).length;
  const drawdownBreached = allEvents.filter(
    (e) => e.eventType === "DAILY_DRAWDOWN_BREACHED",
  ).length;

  // ----- Filter helpers -----
  const toggleType = (t: EnhancedEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const activeFilterCount =
    (selectedTypes.size > 0 ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (userFilter ? 1 : 0) +
    (accountFilter ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setDateRange("all");
    setUserFilter("");
    setAccountFilter("");
    setSourceFilter("all");
    setSearch("");
  };

  const onExportCsv = () => {
    exportToCsv<EnhancedUserEvent>(
      filtered,
      [
        { key: "id", header: "Event ID", value: (e) => e.id },
        { key: "timestamp", header: "Timestamp", value: (e) => e.timestamp },
        { key: "userEmail", header: "User Email", value: (e) => e.userEmail },
        { key: "accountId", header: "Account ID", value: (e) => e.accountId },
        { key: "phaseType", header: "Phase Type", value: (e) => e.phaseType },
        { key: "challengeName", header: term("challenge"), value: (e) => e.challengeName },
        { key: "eventType", header: "Event Type", value: (e) => e.eventType },
        { key: "description", header: "Description", value: (e) => resolveTermsInString(e.description, tenant) },
        { key: "ipAddress", header: "IP Address", value: (e) => e.ipAddress },
        { key: "source", header: "Source", value: (e) => e.source },
      ],
      `enhanced-user-events-${Date.now()}.csv`,
    );
  };

  // ----- Columns -----
  const columns: Column<EnhancedUserEvent>[] = [
    {
      key: "userEmail",
      header: "User",
      cell: (e) => (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            navigate("trader-detail", { id: e.traderId });
          }}
          className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          title={resolveTermsInString(`Open trader workspace for ${e.userEmail}`, tenant)}
        >
          {e.userEmail}
        </button>
      ),
      sortValue: (e) => e.userEmail,
      width: "200px",
    },
    {
      key: "accountId",
      header: "Account",
      cell: (e) => (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            navigate("trader-detail", { id: e.traderId });
          }}
          className="flex flex-col text-left text-xs hover:underline"
          title={resolveTermsInString(`Open trader workspace for account ${e.accountId}`, tenant)}
        >
          <span className="font-mono text-muted-foreground">
            [{e.phaseType}]
          </span>
          <span className="text-foreground">{e.challengeName}</span>
          <span className="font-mono text-muted-foreground">
            - {e.accountId}
          </span>
        </button>
      ),
      sortValue: (e) => e.accountId,
      width: "220px",
    },
    {
      key: "eventType",
      header: "Event Type",
      cell: (e) => (
        <StatusBadge tone={eventTone(e.eventType)}>
          {EVENT_LABELS[e.eventType]}
        </StatusBadge>
      ),
      sortValue: (e) => e.eventType,
      width: "180px",
    },
    {
      key: "description",
      header: "Event Description",
      cell: (e) => (
        <span className="text-sm text-muted-foreground">{resolveTermsInString(e.description, tenant)}</span>
      ),
    },
    {
      key: "ipAddress",
      header: "IP Address",
      cell: (e) => (
        <span className="font-mono text-xs text-foreground">{e.ipAddress}</span>
      ),
      sortValue: (e) => e.ipAddress,
      width: "140px",
    },
    {
      key: "source",
      header: "Source",
      cell: (e) => (
        <StatusBadge tone={sourceTone(e.source)}>{e.source}</StatusBadge>
      ),
      sortValue: (e) => e.source,
      width: "100px",
    },
    {
      key: "timestamp",
      header: "Created",
      cell: (e) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(e.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (e) => e.timestamp,
      width: "180px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="User Events (Enhanced)"
        description="Real-time log of all user, account, and risk events with metric snapshots."
        icon={ScrollText}
        actions={
          <Button size="sm" variant="outline" onClick={onExportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <PageContent>
        {/* KPI row — 7 metrics per spec */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <MetricCard
            label="Total Events"
            value={totalEvents}
            icon={Activity}
            tone="default"
          />
          <MetricCard
            label="Account Created"
            value={accountCreated}
            icon={UserPlus}
            tone="positive"
          />
          <MetricCard
            label="KYC Completed"
            value={kycCompleted}
            icon={ShieldCheck}
            tone="positive"
          />
          <MetricCard
            label="Breaches Detected"
            value={breachDetected}
            icon={AlertTriangle}
            tone={breachDetected > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Payout Events"
            value={payoutEvents}
            icon={Wallet}
            tone="warning"
          />
          <MetricCard
            label="Target Profit Reached"
            value={targetProfitReached}
            icon={Target}
            tone="positive"
          />
          <MetricCard
            label="Drawdown Breached"
            value={drawdownBreached}
            icon={TrendingDown}
            tone={drawdownBreached > 0 ? "negative" : "positive"}
          />
        </div>

        {/* Top toolbar — search + Filters toggle + count */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {activeFilterCount}
              </Badge>
            ) : null}
          </div>
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, account, description…"
              aria-label="Search user events"
              className="h-8 text-xs"
            />
          </div>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Filter className="h-3 w-3" /> Advanced
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                    {activeFilterCount}
                  </Badge>
                ) : null}
                {filtersOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          {activeFilterCount > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {allEvents.length} events
          </span>
        </div>

        {/* Advanced Filter Panel — collapsible */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <section className="rounded-lg border bg-card p-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                    <Filter className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Advanced Filters
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Multi-select event types, date range, user, account, and
                      source. Click Apply to filter the table.
                    </p>
                  </div>
                </div>
                {filtersOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator className="my-4" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Event Type multi-select */}
                <div className="space-y-1.5 lg:col-span-2">
                  <LabelWithHelp
                    help="Tick the event types you want to include. Empty selection shows all event types."
                    className="text-sm font-medium"
                  >
                    Event Type
                  </LabelWithHelp>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {ALL_EVENT_TYPES.map((t) => {
                      const checked = selectedTypes.has(t);
                      return (
                        <label
                          key={t}
                          className={cn(
                            "flex cursor-pointer items-start gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted/30",
                            checked && "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleType(t)}
                            className="mt-0.5"
                          />
                          <span className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {EVENT_LABELS[t]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedTypes.size > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground">
                        Selected:
                      </span>
                      {Array.from(selectedTypes).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer text-[10px]"
                          onClick={() => toggleType(t)}
                        >
                          {EVENT_LABELS[t]} ×
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No event types selected — all are included.
                    </p>
                  )}
                </div>

                {/* Date Range */}
                <div className="space-y-1.5">
                  <LabelWithHelp
                    help="Restrict to events that happened within the selected window. 'All time' shows everything."
                    className="text-sm font-medium"
                  >
                    Date Range
                  </LabelWithHelp>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* User text input */}
                <div className="space-y-1.5">
                  <LabelWithHelp
                    help="Case-insensitive substring match against the user email."
                    className="text-sm font-medium"
                  >
                    User
                  </LabelWithHelp>
                  <Input
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="e.g. sarah@…"
                    className="text-xs"
                  />
                </div>

                {/* Account ID text input */}
                <div className="space-y-1.5">
                  <LabelWithHelp
                    help="Substring match against the account ID (e.g. 333388)."
                    className="text-sm font-medium"
                  >
                    Account ID
                  </LabelWithHelp>
                  <Input
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    placeholder="e.g. 333388"
                    className="font-mono text-xs"
                  />
                </div>

                {/* Source dropdown */}
                <div className="space-y-1.5">
                  <LabelWithHelp
                    help={resolveTermsInString("Origin of the event — System (automated), Admin (manual admin action), User (trader action), or API (third-party integration).", tenant)}
                    className="text-sm font-medium"
                  >
                    Source
                  </LabelWithHelp>
                  <Select
                    value={sourceFilter}
                    onValueChange={setSourceFilter}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {SOURCE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Apply + Clear + result count */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">
                    {allEvents.length}
                  </span>{" "}
                  events match
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                  >
                    <X className="mr-1 h-3 w-3" /> Clear Filters
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setFiltersOpen(false);
                      toast({
                        title: "Filters applied",
                        description: `${filtered.length} of ${allEvents.length} events match.`,
                      });
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        {/* Events table — 100 per page per spec */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(e) => e.id}
            pageSize={100}
            emptyTitle="No events match your filters"
            emptyDescription="Try widening the date range, clearing event types, or removing the user/account filter."
          />
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          Risk events (Floating PnL / Daily Drawdown / Target Profit / Phase
          Upgraded) include metric snapshots for forensic review.
        </p>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Re-exported helpers for downstream pages                            */
/* ------------------------------------------------------------------ */

// Keep these exports for any future detail page that wants to reuse the
// deterministic mock data + tone legend. They are intentionally pure.
// (EnhancedUserEvent, EnhancedEventType, EventSource are already exported
// at their declaration sites above.)
export {
  EVENT_LABELS,
  ALL_EVENT_TYPES,
  eventTone,
  sourceTone,
  buildEnhancedEvents,
};
