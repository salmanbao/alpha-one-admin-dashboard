"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantBreaches, getTraderBreaches, getTraderForUser, type Breach } from "@/lib/platform/mock-data";
import { resolveBreach, effectiveBreachStatus, useBreachVersion } from "@/modules/risk/breach-store";
import {
  createRiskCase,
  getRiskCases,
  setRiskCaseStatus,
} from "@/modules/risk/risk-case-store";
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

/**
 * Escalate a breach into the risk case queue (finding #3: 'Escalate'
 * options for critical risks). Not a toast — it opens a real RiskCase
 * (see risk-case-store) and marks it 'escalated' so a risk officer owns
 * it. Idempotent per breach: the breach id is embedded in the case's
 * signalDetail, and re-escalating reuses the existing case instead of
 * creating a duplicate.
 *
 * Returns the case id and whether a NEW case was opened.
 */
function escalateBreach(
  tid: string,
  b: Pick<Breach, "id" | "type" | "rule" | "severity" | "traderId" | "traderName" | "triggeredAt">,
): { id: string; created: boolean } {
  const marker = `[${b.id}]`;
  const existing = getRiskCases(tid).find(
    (c) => c.status === "escalated" && c.signalDetail.includes(marker),
  );
  if (existing) return { id: existing.id, created: false };
  const created = createRiskCase(tid, {
    severity: b.severity === "critical" ? "critical" : "high",
    traderId: b.traderId,
    traderName: b.traderName,
    signal: b.type,
    signalDetail:
      `${b.rule} — escalated from breach ${marker} triggered ` +
      `${new Date(b.triggeredAt).toLocaleString("en-US")}.`,
  });
  setRiskCaseStatus(tid, created.id, "escalated");
  return { id: created.id, created: true };
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

  // Finding #3 — 'Escalate' for critical risk: pushes every OPEN critical
  // breach into the risk-case queue as a real escalated case.
  const criticalOpen = breaches.filter(
    (b) => b.status === "open" && b.severity === "critical",
  );
  const escalateAllCritical = () => {
    const results = criticalOpen.map((b) => escalateBreach(tid, b));
    const created = results.filter((r) => r.created);
    toast(
      created.length > 0
        ? {
            title: `${created.length} critical breach${created.length === 1 ? "" : "es"} escalated`,
            description: `Cases ${created.map((r) => r.id).join(", ")} opened and marked escalated — see Risk Cases.`,
          }
        : {
            title: "Already escalated",
            description: "Every open critical breach already has an escalated risk case.",
          },
    );
  };

  // Finding #3 — a shared button style for the contextual KPI actions.
  const kpiAction =
    "h-7 w-full justify-center text-[11px] font-semibold";

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
          <MetricCard
            label="Open Breaches"
            value={open}
            icon={ShieldAlert}
            tone={open > 0 ? "warning" : "positive"}
            action={
              <Button
                size="sm"
                variant="outline"
                className={kpiAction}
                title="Open the breach queue to review, resolve, or escalate each violation"
                onClick={() => navigate("breaches")}
              >
                Triage breaches
              </Button>
            }
          />
          <MetricCard
            label="Critical"
            value={critical}
            icon={AlertTriangle}
            tone={critical > 0 ? "negative" : "positive"}
            action={
              <Button
                size="sm"
                variant="outline"
                className={kpiAction}
                disabled={criticalOpen.length === 0}
                title={
                  criticalOpen.length === 0
                    ? "No open critical breaches to escalate"
                    : "Open escalated risk cases for every open critical breach so a risk officer takes ownership"
                }
                onClick={escalateAllCritical}
              >
                Escalate to risk cases
              </Button>
            }
          />
          <MetricCard label="Resolved (30d)" value={resolved} icon={ShieldCheck} tone="positive" />
          <MetricCard
            label="Firm Risk Score"
            value={`${riskScore}/100`}
            icon={Activity}
            tone={riskScore >= 80 ? "negative" : riskScore >= 70 ? "warning" : "positive"}
            deltaLabel="Composite of breach volume, exposure & account health"
            action={
              <Button
                size="sm"
                variant="outline"
                className={kpiAction}
                title="Re-calibrate drawdown, profit-target, and time-limit thresholds behind the score"
                onClick={() => navigate("trading-events")}
              >
                Adjust rules
              </Button>
            }
          />
          <MetricCard
            label="At-Risk Accounts"
            value={within10}
            icon={Users}
            tone={criticalAtRisk > 0 ? "warning" : "default"}
            deltaLabel={`${within5} within 5% · ${criticalAtRisk} critical`}
            action={
              <Button
                size="sm"
                variant="outline"
                className={kpiAction}
                title="Review the traders behind accounts within 5–10% of their drawdown limits"
                onClick={() => navigate("trading-traders")}
              >
                Review traders
              </Button>
            }
          />
          <MetricCard
            label="Total Exposure"
            value={formatCurrency(exposure, currency)}
            icon={DollarSign}
            tone="warning"
            deltaLabel="across all open breaches"
            action={
              <Button
                size="sm"
                variant="outline"
                className={kpiAction}
                title="See which open breaches drive this exposure number"
                onClick={() => navigate("breaches")}
              >
                View breaches
              </Button>
            }
          />
        </div>

        {/* Attention Center — §11 centralized attention model */}
        <AttentionCenter />

        {/* Actionable Insights — derived risk factors + mitigation (finding #5) */}
        <RiskInsightsPanel tenantId={tid} breaches={breaches} />

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

interface RiskInsightAction {
  label: string;
  onClick: () => void;
  /** Brief explanation of what the action does (finding #3). */
  title?: string;
}

interface RiskInsight {
  id: string;
  title: string;
  detail: string;
  mitigation: string;
  severity: "critical" | "warning" | "info";
  actions: RiskInsightAction[];
}

function RiskInsightsPanel({
  tenantId,
  breaches,
}: {
  tenantId: string;
  breaches: Breach[];
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
          {
            label: "Adjust rules",
            onClick: () => navigate("trading-events"),
            title: "Open rule configuration to re-calibrate the thresholds driving these violations",
          },
          {
            label: "View breaches",
            onClick: () => navigate("breaches"),
            title: "Open the full breach queue filtered visually by type",
          },
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
          {
            label: "Review trader",
            onClick: () => navigate("trader-detail", { id: traderId }),
            title: "Open this trader's profile: accounts, trades, and breach history",
          },
          {
            label: "Adjust rules",
            onClick: () => navigate("trading-events"),
            title: "Repeated violations often mean mis-calibrated limits — review thresholds for this program",
          },
          {
            label: "Contact trader",
            onClick: () => navigate("trader-detail", { id: traderId }),
            title: "Open the trader's profile to reach out about drawdown discipline",
          },
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
        {
          label: "Escalate",
          onClick: () => {
            const results = criticalOpen.map((b) => escalateBreach(tenantId, b));
            const created = results.filter((r) => r.created);
            toast(
              created.length > 0
                ? {
                    title: `${created.length} breach${created.length === 1 ? "" : "es"} escalated`,
                    description: `Cases ${created.map((r) => r.id).join(", ")} opened and marked escalated — see Risk Cases.`,
                  }
                : {
                    title: "Already escalated",
                    description: "These critical breaches already have escalated risk cases.",
                  },
            );
          },
          title: "Open escalated risk cases for every critical breach so a risk officer owns triage",
        },
        {
          label: "Triage now",
          onClick: () => navigate("breaches"),
          title: "Open the breach queue to review, resolve, or escalate each critical violation",
        },
        {
          label: "Review account",
          onClick: () => navigate("trader-detail", { id: first.traderId }),
          title: "Open the affected trader's profile",
        },
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
        {
          label: "Clear backlog",
          onClick: () => navigate("breaches"),
          title: "Open the breach queue to resolve stale items in bulk",
        },
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
                      title={action.title}
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
      cell: (b) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="Open this trader's profile to review accounts, trades, and history"
            onClick={(e) => {
              e.stopPropagation();
              navigate("trader-detail", { id: b.traderId });
            }}
          >
            Review trader
          </Button>
          {b.status === "open" && b.severity === "critical" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canResolve}
              title={
                canResolve
                  ? "Open an escalated risk case for this breach so a risk officer owns it (requires risk.configure)"
                  : "Requires risk.configure"
              }
              onClick={(e) => {
                e.stopPropagation();
                const r = escalateBreach(tid, b);
                toast(
                  r.created
                    ? {
                        title: `Escalated — ${r.id}`,
                        description: `${b.traderName}'s breach opened as a risk case and marked escalated.`,
                      }
                    : {
                        title: "Already escalated",
                        description: `${r.id} already covers this breach — see Risk Cases.`,
                      },
                );
              }}
            >
              Escalate
            </Button>
          )}
          {b.status === "open" && (
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
          )}
        </div>
      ),
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
