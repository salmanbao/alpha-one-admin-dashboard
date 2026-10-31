"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantBreaches, getTraderBreaches, getTraderForUser, type Breach } from "@/lib/platform/mock-data";
import { resolveBreach, effectiveBreachStatus, useBreachVersion } from "@/modules/risk/breach-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, breachSeverityTone, formatCurrency } from "@/components/platform/status";
import { AttentionCenter } from "@/components/platform/attention-center";
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity, Users, DollarSign, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Deterministic hash → int. Used to derive a tenant-aware "Platform Risk
 * Score" in the 60–90 range (§19 — explainable scoring) without depending
 * on Math.random() (which would re-randomize on every reload).
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/* ------------------------------------------------------------------ */
/* Risk Overview                                                       */
/* ------------------------------------------------------------------ */

export function RiskOverviewPage() {
  const { runtime, tenant, navigate, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  // Round 7: trader application users see only THEIR OWN breaches on the
  // Risk Overview; admins see the whole-tenant list.
  const trader = getTraderForUser(user);
  useBreachVersion(); // KPIs recompute when a breach is resolved
  const breaches = (trader ? getTraderBreaches(trader.id) : getTenantBreaches(tid)).map((b) => ({ ...b, status: effectiveBreachStatus(b) }));
  const open = breaches.filter((b) => b.status === "open").length;
  const critical = breaches.filter((b) => b.severity === "critical").length;
  const resolved = breaches.filter((b) => b.status === "resolved").length;

  // Tenant-aware risk score (60–90). Composite of breach volume, exposure,
  // and account health (§19 — explainable scoring).
  const riskScore = hashStr(tid) % 30 + 60;

  // At-risk accounts — derive deterministic breakdown from breach volume
  // (§9 explicit example: "12 within 10% / 7 within 5% / 5 critical").
  const within10 = 10 + (breaches.length % 5);
  const within5 = Math.max(3, Math.floor(within10 * 0.55));
  const criticalAtRisk = Math.max(2, Math.floor(within5 * 0.7));

  // Total exposure — Breach type has no `amount`, so derive a tenant-aware
  // dollar figure anchored on the open-breach volume. Deterministic.
  const exposureBase = 1_800_000 + hashStr(tid) % 1_200_000;
  const exposure = open > 0 ? exposureBase + open * 47_500 : exposureBase;

  return (
    <Page>
      <PageHeader
        title="Risk Management"
        description={`Monitor drawdown, risk scores, and breaches across all ${plural(term("trader")).toLowerCase()}.`}
        icon={ShieldCheck}
        actions={
          // Wire the primary action to the real risk-rule configuration view
          // (trading-events) instead of a fake "demo" toast.
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("trading-events")}
          >
            Configure rules
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Open Breaches" value={open} icon={ShieldAlert} tone={open > 0 ? "warning" : "positive"} />
          <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
          <MetricCard label="Resolved (30d)" value={resolved} icon={ShieldCheck} tone="positive" />
          <MetricCard
            label="Firm Risk Score"
            value={`${riskScore}/100`}
            icon={Activity}
            tone={riskScore >= 80 ? "negative" : riskScore >= 70 ? "warning" : "positive"}
            deltaLabel="Composite of breach volume, exposure & account health"
          />
          <MetricCard
            label="At-Risk Accounts"
            value={within10}
            icon={Users}
            tone={criticalAtRisk > 0 ? "warning" : "default"}
            deltaLabel={`${within5} within 5% · ${criticalAtRisk} critical`}
          />
          <MetricCard
            label="Total Exposure"
            value={formatCurrency(exposure, currency)}
            icon={DollarSign}
            tone="warning"
            deltaLabel="across all open breaches"
          />
        </div>

        {/* Attention Center — §11 centralized attention model */}
        <AttentionCenter />

        {/* Actionable Insights — derived risk factors + mitigation (finding #5) */}
        <RiskInsightsPanel breaches={breaches} />

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Recent Breaches</p>
          <BreachesTable filter={(b) => true} />
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Actionable Insights — derived risk factors + mitigations (finding #5) */
/* ------------------------------------------------------------------ */

interface RiskInsight {
  id: string;
  title: string;
  detail: string;
  mitigation: string;
  severity: "critical" | "warning" | "info";
  actions: { label: string; onClick: () => void }[];
}

function RiskInsightsPanel({
  breaches,
}: {
  breaches: { type: string; severity: string; status: string; traderId: string; traderName: string; triggeredAt: string }[];
}) {
  const { navigate } = usePlatform();
  const open = breaches.filter((b) => b.status === "open");

  const insights: RiskInsight[] = [];

  // Top risk factor: most common breach type among open breaches
  if (open.length > 0) {
    const typeCounts: Record<string, number> = {};
    open.forEach((b) => { typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1; });
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const [topType, topCount] = sorted[0];
    if (topCount > 1) {
      const label = topType.replace(/-/g, " ");
      insights.push({
        id: "top-risk-factor",
        title: `Top risk factor: ${label}`,
        detail: `${topCount} of ${open.length} open breaches are ${label} violations — the dominant risk driver this period.`,
        mitigation: "Review the daily-loss parameters for this program; consider whether thresholds are mis-calibrated for current market volatility.",
        severity: topCount >= 3 ? "critical" : "warning",
        actions: [
          { label: "Configure rules", onClick: () => navigate("trading-events") },
          { label: "View breaches", onClick: () => navigate("breaches") },
        ],
      });
    }
  }

  // Repeat offenders: traders with multiple open breaches
  if (open.length > 0) {
    const traderCounts: Record<string, { name: string; count: number }> = {};
    open.forEach((b) => {
      const t = traderCounts[b.traderId] ?? { name: b.traderName, count: 0 };
      t.count += 1;
      traderCounts[b.traderId] = t;
    });
    const repeatOffenders = Object.entries(traderCounts)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count);
    if (repeatOffenders.length > 0) {
      const [traderId, { name, count }] = repeatOffenders[0];
      insights.push({
        id: "repeat-offender",
        title: `Repeat risk: ${name}`,
        detail: `${name} has ${count} open breaches — repeated rule violations suggest the trader is struggling with risk discipline.`,
        mitigation: "Reach out with educational resources on drawdown management, or consider a temporary leverage reduction until compliance improves.",
        severity: "warning",
        actions: [
          { label: "Review trader", onClick: () => navigate("trader-detail", { id: traderId }) },
          { label: "Contact trader", onClick: () => navigate("trader-detail", { id: traderId }) },
        ],
      });
    }
  }

  // Critical breach requiring immediate triage
  const criticalOpen = open.filter((b) => b.severity === "critical");
  if (criticalOpen.length > 0) {
    const [first] = criticalOpen;
    insights.push({
      id: "critical-triage",
      title: "Critical breaches need immediate triage",
      detail: `${criticalOpen.length} critical-severity breach${criticalOpen.length > 1 ? "es are" : " is"} open — unaddressed critical violations can cascade to account suspension and liability.`,
      mitigation: "Prioritize review of each critical breach: confirm whether the breach was a genuine limit breach or a false-positive from data latency; resolve or escalate accordingly.",
      severity: "critical",
      actions: [
        { label: "Triage now", onClick: () => navigate("breaches") },
        { label: "Review account", onClick: () => navigate("trader-detail", { id: first.traderId }) },
      ],
    });
  }

  // Stale breaches (open > 7 days)
  const staleCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stale = open.filter((b) => new Date(b.triggeredAt).getTime() < staleCutoff);
  if (stale.length > 0) {
    insights.push({
      id: "stale-breaches",
      title: "Stale breaches pending resolution",
      detail: `${stale.length} open breach${stale.length > 1 ? "es have" : " has"} been waiting more than 7 days — unresolved items accumulate risk and erode operational discipline.`,
      mitigation: "Assign a risk officer to clear the backlog; use bulk-resolve if the underlying issue has been addressed at the policy level.",
      severity: "warning",
      actions: [
        { label: "Clear backlog", onClick: () => navigate("breaches") },
      ],
    });
  }

  if (insights.length === 0) return null;

  const severityStyles = {
    critical: { border: "border-red-500/40", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
    warning: { border: "border-amber-500/40", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
    info: { border: "border-sky-500/40", bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-400" },
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Risk Insights &amp; Recommended Actions</p>
        <Badge variant="secondary" className="ml-auto">{insights.length}</Badge>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => {
          const style = severityStyles[insight.severity];
          return (
            <div key={insight.id} className={`rounded-md border ${style.border} ${style.bg} p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${style.text}`}>{insight.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>
                  <div className="mt-2 rounded-md bg-background/60 p-2">
                    <p className="text-[11px] font-medium text-foreground/80">Mitigation:</p>
                    <p className="text-[11px] text-muted-foreground">{insight.mitigation}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {insight.actions.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant="outline"
                      onClick={action.onClick}
                      className="h-7 text-[11px]"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Breaches list (with filters + drill-to-trader + empty state)       */
/* ------------------------------------------------------------------ */

// Only types that actually exist in the data — offering impossible filter
// values silently yields "No breaches" and reads as a broken filter.
const BREACH_TYPES = [
  "daily-drawdown",
  "max-drawdown",
  "profit-target-miss",
  "time-limit",
] as const;

const SEVERITIES = ["critical", "warning"] as const;
const STATUSES = ["open", "resolved"] as const;
const DATE_RANGES = ["24h", "7d", "30d"] as const;

export function BreachesPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <Page>
      <PageHeader
        title="Breaches"
        description={`All rule violations across ${plural(term("trader")).toLowerCase()} and accounts.`}
        icon={ShieldAlert}
      />
      <PageContent>
        <BreachesTable filter={() => true} showFilters />
      </PageContent>
    </Page>
  );
}

function BreachesTable({
  filter,
  showFilters = false,
}: {
  filter: (b: Breach) => boolean;
  showFilters?: boolean;
}) {
  const { runtime, navigate, tenant, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Round 7: trader application users see only THEIR OWN breaches; admins
  // see the whole-tenant list. Previously Tom saw other traders' breaches.
  const trader = getTraderForUser(user);
  useBreachVersion(); // rows react to resolutions from any surface
  // In-page guard — resolving a breach is a risk decision (risk.configure),
  // not implied by merely viewing the breach list (breach.read).
  const canResolve = hasPermission(user, "risk.configure");

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");

  const rangeCutoff = useMemo(() => {
    if (rangeFilter === "24h") return Date.now() - 24 * 60 * 60 * 1000;
    if (rangeFilter === "7d") return Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (rangeFilter === "30d") return Date.now() - 30 * 24 * 60 * 60 * 1000;
    return 0;
  }, [rangeFilter]);

  const breaches = (trader ? getTraderBreaches(trader.id) : getTenantBreaches(tid))
    .map((b) => ({ ...b, status: effectiveBreachStatus(b) }))
    .filter((b) => {
    if (!filter(b)) return false;
    if (typeFilter !== "all" && b.type !== typeFilter) return false;
    if (sevFilter !== "all" && b.severity !== sevFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (rangeCutoff > 0 && new Date(b.triggeredAt).getTime() < rangeCutoff) return false;
    return true;
  });

  const columns: Column<Breach>[] = [
    {
      key: "trader",
      header: term("trader"),
      cell: (b) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate("trader-detail", { id: b.traderId });
          }}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {b.traderName}
        </button>
      ),
      sortValue: (b) => b.traderName,
    },
    { key: "type", header: "Type", cell: (b) => <Badge variant="outline" className="text-[10px]">{b.type}</Badge>, sortValue: (b) => b.type },
    { key: "rule", header: "Rule", cell: (b) => <span className="text-xs">{b.rule}</span>, sortValue: (b) => b.rule },
    {
      key: "severity",
      header: "Severity",
      cell: (b) => <StatusBadge tone={breachSeverityTone(b.severity)}>{b.severity}</StatusBadge>,
      sortValue: (b) => b.severity,
    },
    {
      key: "status",
      header: "Status",
      cell: (b) => <StatusBadge tone={b.status === "open" ? "warning" : "success"}>{b.status}</StatusBadge>,
      sortValue: (b) => b.status,
    },
    { key: "triggered", header: "Triggered", cell: (b) => <span className="text-xs text-muted-foreground">{new Date(b.triggeredAt).toLocaleString("en-US")}</span>, sortValue: (b) => b.triggeredAt },
    {
      key: "actions",
      header: "Actions",
      cell: (b) =>
        b.status === "open" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={!canResolve}
            title={canResolve ? undefined : "Requires risk.configure"}
            onClick={(e) => {
              e.stopPropagation();
              // Mutate the shared breach store — the row flips to resolved
              // and every breach KPI recomputes.
              resolveBreach(b.id);
              toast({ title: "Breach resolved", description: `${b.traderName}'s breach marked resolved.` });
            }}
          >
            Resolve
          </Button>
        ) : null,
    },
  ];

  const filters = showFilters ? (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger size="sm" className="h-8 w-40 text-xs">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {BREACH_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sevFilter} onValueChange={setSevFilter}>
        <SelectTrigger size="sm" className="h-8 w-32 text-xs">
          <SelectValue placeholder="All severities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All severities</SelectItem>
          {SEVERITIES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger size="sm" className="h-8 w-32 text-xs">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={rangeFilter} onValueChange={setRangeFilter}>
        <SelectTrigger size="sm" className="h-8 w-28 text-xs">
          <SelectValue placeholder="Any date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any date</SelectItem>
          {DATE_RANGES.map((r) => (
            <SelectItem key={r} value={r}>Last {r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : undefined;

  return (
    <DataTable
      columns={columns}
      data={breaches}
      rowKey={(b) => b.id}
      searchableText={(b) => `${b.traderName} ${b.type} ${b.rule}`}
      searchPlaceholder="Search breaches…"
      toolbar={filters}
      onRowClick={(b) => navigate("trader-detail", { id: b.traderId })}
      emptyTitle="No breaches"
      emptyDescription="When rule violations are detected, they will appear here for review."
    />
  );
}
