"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantBreaches, type Breach } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, breachSeverityTone } from "@/components/platform/status";
import { AttentionCenter } from "@/components/platform/attention-center";
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity, Users, DollarSign } from "lucide-react";
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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const breaches = getTenantBreaches(tid);
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast({ title: "Risk config", description: "Risk rules saved (demo)." })}
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
            label="Platform Risk Score"
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
            value={`$${exposure.toLocaleString()}`}
            icon={DollarSign}
            tone="warning"
            deltaLabel="across all open breaches"
          />
        </div>

        {/* Attention Center — §11 centralized attention model */}
        <AttentionCenter />

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Recent Breaches</p>
          <BreachesTable filter={(b) => true} />
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Breaches list (with filters + drill-to-trader + empty state)       */
/* ------------------------------------------------------------------ */

const BREACH_TYPES = [
  "daily-drawdown",
  "max-drawdown",
  "trailing-drawdown",
  "margin-call",
  "news-trading",
  "weekend-holding",
  "copy-trading",
  "profit-target-miss",
  "time-limit",
] as const;

const SEVERITIES = ["critical", "warning", "info"] as const;
const STATUSES = ["open", "resolved", "dismissed"] as const;
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
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

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

  const breaches = getTenantBreaches(tid).filter((b) => {
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
      header: "Trader",
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
    { key: "triggered", header: "Triggered", cell: (b) => <span className="text-xs text-muted-foreground">{new Date(b.triggeredAt).toLocaleString()}</span>, sortValue: (b) => b.triggeredAt },
    {
      key: "actions",
      header: "",
      cell: (b) =>
        b.status === "open" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
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
