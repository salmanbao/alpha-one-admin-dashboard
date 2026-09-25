"use client";

/**
 * Account Events Page — immutable audit trail of account events.
 *
 * Surfaces every meaningful lifecycle event for a single trading account:
 * ACCOUNT_CREATED, PHASE_UPGRADED, PAYOUT_REQUESTED, PAYOUT_APPROVED,
 * BREACH_DETECTED, STATUS_CHANGED, KYC_COMPLETED, RULE_WARNING,
 * DRAWDOWN_ALERT.
 *
 * Each event type has its own color-coded badge (Terra palette only — no
 * blue/indigo), is filterable by type + date range, and links to the
 * relevant downstream view. Mock data is deterministically derived
 * from the account id so the demo is stable across reloads.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Activity,
  RotateCcw,
  ShieldAlert,
  Trophy,
  Wallet,
  FileCheck,
  Bell,
  TrendingDown,
  RefreshCw,
  Filter,
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  History,
  CircleUserRound,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Event model                                                         */
/* ------------------------------------------------------------------ */

type EventType =
  | "ACCOUNT_CREATED"
  | "PHASE_UPGRADED"
  | "PAYOUT_REQUESTED"
  | "PAYOUT_APPROVED"
  | "BREACH_DETECTED"
  | "STATUS_CHANGED"
  | "KYC_COMPLETED"
  | "RULE_WARNING"
  | "DRAWDOWN_ALERT";

interface AccountEvent {
  id: string;
  type: EventType;
  description: string;
  createdAt: string;
  actor: string;
}

const EVENT_META: Record<EventType, { label: string; tone: "success" | "info" | "warning" | "danger" | "muted" | "default"; icon: React.ComponentType<{ className?: string }> }> = {
  ACCOUNT_CREATED: { label: "Account Created", tone: "info", icon: CircleUserRound },
  PHASE_UPGRADED: { label: "Phase Upgraded", tone: "success", icon: Trophy },
  PAYOUT_REQUESTED: { label: "Payout Requested", tone: "info", icon: Wallet },
  PAYOUT_APPROVED: { label: "Payout Approved", tone: "success", icon: CheckCircle2 },
  BREACH_DETECTED: { label: "Breach Detected", tone: "danger", icon: ShieldAlert },
  STATUS_CHANGED: { label: "Status Changed", tone: "warning", icon: RefreshCw },
  KYC_COMPLETED: { label: "KYC Completed", tone: "success", icon: FileCheck },
  RULE_WARNING: { label: "Rule Warning", tone: "warning", icon: AlertTriangle },
  DRAWDOWN_ALERT: { label: "Drawdown Alert", tone: "danger", icon: TrendingDown },
};

const EVENT_TYPES = Object.keys(EVENT_META) as EventType[];

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "180d": 180 * 24 * 60 * 60 * 1000,
};

/* ------------------------------------------------------------------ */
/* Deterministic event seed                                           */
/* ------------------------------------------------------------------ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const ACTORS = [
  "Sarah Chen",
  "Marcus Webb",
  "Priya Nair",
  "System",
  "AI Engine",
  "Risk Engine",
];

const DESCRIPTIONS: Record<EventType, string[]> = {
  ACCOUNT_CREATED: [
    "Account provisioned via Webhook from order ORD-12345. Initial balance deposited to broker login.",
    "New trading account created from challenge purchase. Welcome email dispatched.",
  ],
  PHASE_UPGRADED: [
    "Profit target reached (8%). Account promoted from Phase 1 → Phase 2 automatically.",
    "Phase 2 verification passed. Account marked as Funded. Trader notified.",
  ],
  PAYOUT_REQUESTED: [
    "Trader requested $4,250 withdrawal. Pending risk review.",
    "Withdrawal request submitted for $1,820 to bank account ending 4421.",
  ],
  PAYOUT_APPROVED: [
    "Payout approved by Sarah Chen. Funds dispatched to trader.",
    "Payout approved. Wire transfer initiated via payment gateway.",
  ],
  BREACH_DETECTED: [
    "Maximum drawdown exceeded by $312. Account marked BREACHED.",
    "Daily loss limit hit. Trading halted pending review.",
  ],
  STATUS_CHANGED: [
    "Status changed from Active → Manual Review by Risk team.",
    "Status changed from Manual Review → Active after compliance sign-off.",
  ],
  KYC_COMPLETED: [
    "KYC verification completed through SUMSUB. Documents approved.",
    "Identity verification confirmed via VERIFF provider.",
  ],
  RULE_WARNING: [
    "Daily loss approached 70% threshold. Trader notified by email.",
    "Approaching weekend-trading rule violation. Soft warning issued.",
  ],
  DRAWDOWN_ALERT: [
    "Drawdown crossed 5% global limit. Auto-liquidation armed.",
    "Daily drawdown at 4.2% — within tolerance. Monitoring continues.",
  ],
};

function generateEvents(accountId: string, accountLogin: string): AccountEvent[] {
  const seed = hashStr(accountId) || 7;
  const events: AccountEvent[] = [];
  // Always start with ACCOUNT_CREATED on day 0
  const createdAt = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString();
  events.push({
    id: `evt-${accountId}-0`,
    type: "ACCOUNT_CREATED",
    description: DESCRIPTIONS.ACCOUNT_CREATED[0],
    createdAt,
    actor: "System",
  });

  // Generate 14-22 follow-up events deterministically
  const followCount = 14 + (seed % 9);
  for (let i = 1; i <= followCount; i++) {
    const t = EVENT_TYPES[(seed + i * 7) % EVENT_TYPES.length];
    // Skip duplicate ACCOUNT_CREATED
    if (t === "ACCOUNT_CREATED") {
      events.push({
        id: `evt-${accountId}-${i}`,
        type: "STATUS_CHANGED",
        description: DESCRIPTIONS.STATUS_CHANGED[i % DESCRIPTIONS.STATUS_CHANGED.length],
        createdAt: new Date(Date.now() - (followCount - i) * 3 * 24 * 60 * 60 * 1000 - (seed % 12) * 60 * 60 * 1000).toISOString(),
        actor: ACTORS[(seed + i) % ACTORS.length],
      });
      continue;
    }
    const descArr = DESCRIPTIONS[t];
    const desc = descArr[i % descArr.length].replace(/\$4,250|\$1,820/g, (m) =>
      m === "$4,250" ? `$${(2000 + ((seed + i * 113) % 6000))}` : `$${(500 + ((seed + i * 97) % 2500))}`,
    );
    events.push({
      id: `evt-${accountId}-${i}`,
      type: t,
      description: desc,
      createdAt: new Date(
        Date.now() - (followCount - i) * 3 * 24 * 60 * 60 * 1000 - (seed + i) % 24 * 60 * 60 * 1000,
      ).toISOString(),
      actor: ACTORS[(seed + i) % ACTORS.length],
    });
  }
  return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountEventsPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const events = useMemo(
    () => (account ? generateEvents(account.id, account.login) : []),
    [account],
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return events.filter((e) => {
      if (cutoff > 0 && new Date(e.createdAt).getTime() < cutoff) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (q && !`${e.type} ${e.description} ${e.actor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, typeFilter, dateRange]);

  const totalEvents = events.length;
  const statusChanges = events.filter((e) => e.type === "STATUS_CHANGED").length;
  const phaseTransitions = events.filter((e) => e.type === "PHASE_UPGRADED").length;
  const payoutEvents = events.filter(
    (e) => e.type === "PAYOUT_REQUESTED" || e.type === "PAYOUT_APPROVED",
  ).length;
  const breachEvents = events.filter(
    (e) => e.type === "BREACH_DETECTED" || e.type === "DRAWDOWN_ALERT" || e.type === "RULE_WARNING",
  ).length;

  const activeFilters =
    (search ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (dateRange !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setDateRange("all");
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Event ID", value: (e) => e.id },
        { key: "type", header: "Event Type", value: (e) => e.type },
        { key: "description", header: "Description", value: (e) => e.description },
        { key: "actor", header: "Actor", value: (e) => e.actor },
        { key: "createdAt", header: "Created", value: (e) => e.createdAt },
      ],
      `account-events-${account?.login ?? accountId}.csv`,
    );
  };

  const handleRowClick = (e: AccountEvent) => {
    const meta = EVENT_META[e.type];
    toast({
      title: meta.label,
      description: `${e.description} · ${new Date(e.createdAt).toLocaleString()}`,
    });
  };

  const columns: Column<AccountEvent>[] = [
    {
      key: "type",
      header: "Event Type",
      cell: (e) => {
        const meta = EVENT_META[e.type];
        const Icon = meta.icon;
        return (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              handleRowClick(e);
            }}
            className="inline-flex items-center gap-1.5 rounded-md text-left hover:underline"
          >
            <Icon className={cn("h-3.5 w-3.5", toneText(meta.tone))} />
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </button>
        );
      },
      sortValue: (e) => e.type,
      width: "200px",
    },
    {
      key: "description",
      header: "Description",
      cell: (e) => (
        <span className="text-xs text-foreground">{e.description}</span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      cell: (e) => (
        <span className="text-[11px] text-muted-foreground">
          {e.actor === "System" || e.actor === "AI Engine" || e.actor === "Risk Engine" ? (
            <Badge variant="outline" className="text-[9px]">{e.actor}</Badge>
          ) : (
            e.actor
          )}
        </span>
      ),
      sortValue: (e) => e.actor,
      width: "140px",
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (e) => (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {new Date(e.createdAt).toLocaleString()}
        </span>
      ),
      sortValue: (e) => e.createdAt,
      width: "180px",
    },
  ];

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

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("trader-detail", { id: account.traderId })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to trader
      </Button>

      <PageHeader
        title="Account Events"
        description={`Immutable audit trail of account events — login ${account.login}`}
        icon={History}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              // "Back to Account" now actually navigates to the account
              // workspace (the parent view of this sub-page) — previously
              // mislabeled and went to trader-detail (a different entity).
              onClick={() => navigate("account-workspace", { id: account.id })}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total Events" value={totalEvents} icon={Activity} />
        <MetricCard
          label="Status Changes"
          value={statusChanges}
          tone={statusChanges > 0 ? "warning" : "default"}
          icon={RefreshCw}
        />
        <MetricCard
          label="Phase Transitions"
          value={phaseTransitions}
          tone={phaseTransitions > 0 ? "positive" : "default"}
          icon={Trophy}
        />
        <MetricCard
          label="Payout Events"
          value={payoutEvents}
          tone={payoutEvents > 0 ? "positive" : "default"}
          icon={Wallet}
        />
        <MetricCard
          label="Breach Events"
          value={breachEvents}
          tone={breachEvents > 0 ? "negative" : "default"}
          icon={ShieldAlert}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {activeFilters}
            </Badge>
          ) : null}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search event type, description, actor…"
          className="h-8 w-64 text-xs"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by event type"
        >
          <option value="all">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_META[t].label}
            </option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="180d">Last 180 days</option>
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {events.length} events
        </span>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(e) => e.id}
            onRowClick={handleRowClick}
            pageSize={12}
            emptyTitle="No events match your filters"
            emptyDescription="Try widening the date range or clearing some filters."
          />
        </div>

        {/* Footer help */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground">
          <Bell className="h-3.5 w-3.5" />
          <span>
            This audit trail is immutable. Edits are recorded as new events with
            the previous state preserved. Export to CSV for compliance archives.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function toneText(tone: "success" | "info" | "warning" | "danger" | "muted" | "default"): string {
  switch (tone) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "info":
      return "text-teal-600 dark:text-teal-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "danger":
      return "text-rose-600 dark:text-rose-400";
    case "muted":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}
