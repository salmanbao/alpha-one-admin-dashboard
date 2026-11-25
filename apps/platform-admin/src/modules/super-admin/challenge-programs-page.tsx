"use client";

/**
 * Challenge Programs — platform-admin super-admin view.
 *
 * Compliance-review surface for the challenge program catalog: phase
 * configurations (min trading days, targets, drawdowns, splits), coverage
 * of declared challenge types, drift vs platform risk defaults, and the
 * audit evidence (who/what/when) behind each row.
 *
 * Labels and coverage come from `lib/platform/challenge-catalog.ts`
 * (seed-derived) — never from local maps. The catalog is review-only
 * until the prop-admin editor lands (edits happen in prop-firm admin).
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Progress } from "@/components/ui/progress";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getChallengePhaseConfigs,
  getChangeHistory,
  tradingAccounts,
  tenants,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import {
  challengeTypeLabel,
  typeCoverage,
  phaseRowStatus,
  matchesRiskDefaults,
  sortPhaseConfigs,
} from "@/lib/platform/challenge-catalog";
import {
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  History,
  Users,
  Layers,
} from "lucide-react";

interface PhaseRow extends ChallengePhaseConfig {
  challengeTypeName: string;
}

type RowStatus = "funded" | "no-min-days" | "min-days";

const STATUS_FILTERS: Array<{ value: RowStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "min-days", label: "Requires min days" },
  { value: "no-min-days", label: "No min days required" },
  { value: "funded", label: "Funded" },
];

function parseParams(params: Record<string, string>): { type: string; status: string } {
  return {
    type: params.type ?? "all",
    status: params.status ?? "all",
  };
}

export function ChallengeProgramsPage() {
  const { router, navigate } = usePlatform();
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 500 }), []);

  const { type: typeFilter, status: statusFilter } = useMemo(
    () => parseParams(router.params),
    [router.params]
  );

  const setFilter = (key: "type" | "status", value: string) => {
    const next: Record<string, string> = { ...router.params };
    if (value === "all") delete next[key];
    else next[key] = value;
    navigate("challenge-programs", next, { replace: true });
  };

  const coverage = useMemo(() => typeCoverage(), []);
  const incompleteTypes = coverage.filter((c) => !c.complete);
  const completeCount = coverage.length - incompleteTypes.length;

  const phases = useMemo((): PhaseRow[] => {
    const cfgs = sortPhaseConfigs(getChallengePhaseConfigs());
    return cfgs.map((p) => ({
      ...p,
      challengeTypeName: challengeTypeLabel(p.challengeTypeId),
    }));
  }, []);

  const filteredPhases = useMemo(
    () =>
      phases.filter((p) => {
        if (typeFilter !== "all" && p.challengeTypeId !== typeFilter) return false;
        if (statusFilter !== "all" && phaseRowStatus(p) !== statusFilter) return false;
        return true;
      }),
    [phases, typeFilter, statusFilter]
  );

  const phasesWithMinDays = phases.filter((p) => p.minTradingDays > 0);
  const zeroMinDaysEval = phases.filter((p) => p.minTradingDays === 0 && !p.isFunded);
  const fundedPhases = phases.filter((p) => p.isFunded);

  const minDaysDistribution = useMemo(() => {
    const daysMap = new Map<number, number>();
    phasesWithMinDays.forEach((p) => {
      daysMap.set(p.minTradingDays, (daysMap.get(p.minTradingDays) ?? 0) + 1);
    });
    return Array.from(daysMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([days, count]) => ({
        days,
        count,
        // Single denominator (all config rows) so bars are comparable (P1-4).
        pct: phases.length ? Math.round((count / phases.length) * 100) : 0,
      }));
  }, [phases]);

  const zeroPct = phases.length
    ? Math.round((zeroMinDaysEval.length / phases.length) * 100)
    : 0;

  const columns: Column<PhaseRow>[] = [
    {
      key: "challengeTypeName",
      header: "Challenge Type",
      cell: (r) => (
        <span className="font-medium text-sm">{r.challengeTypeName}</span>
      ),
      sortValue: (r) => r.challengeTypeName,
    },
    {
      key: "phaseName",
      header: "Phase",
      cell: (r) => (
        <span className="text-sm">{r.phaseName} (#{r.phaseOrder})</span>
      ),
      // Two-key numeric sort: type index, then phase order (P2-2).
      sortValue: (r) =>
        Number(r.challengeTypeId.replace(/\D/g, "")) * 1000 + r.phaseOrder,
    },
    {
      key: "accountSize",
      header: "Account Size",
      numeric: true,
      cell: (r) => (
        <span className="font-mono tabular-nums text-sm">
          ${r.accountSize.toLocaleString()}
        </span>
      ),
      sortValue: (r) => r.accountSize,
    },
    {
      key: "minTradingDays",
      header: "Min Trading Days",
      numeric: true,
      cell: (r) => {
        if (r.isFunded) {
          return (
            <Badge variant="outline" className="text-[10px] text-emerald-600">
              <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Funded
            </Badge>
          );
        }
        if (r.minTradingDays === 0) {
          return (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not required
            </Badge>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-teal-500" aria-hidden />
            <span className="font-medium tabular-nums text-sm">
              {r.minTradingDays}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        );
      },
      sortValue: (r) => r.minTradingDays,
    },
    {
      key: "dailyDrawdownPct",
      header: "Daily DD",
      numeric: true,
      cell: (r) => (
        <span className="font-mono tabular-nums text-sm">
          {r.dailyDrawdownPct}%
        </span>
      ),
      sortValue: (r) => r.dailyDrawdownPct,
    },
    {
      key: "maxDays",
      header: "Max Days",
      numeric: true,
      cell: (r) =>
        r.maxDays > 0 ? (
          <span className="text-sm tabular-nums">{r.maxDays} days</span>
        ) : (
          <Badge variant="outline" className="text-[10px]">No limit</Badge>
        ),
      sortValue: (r) => r.maxDays,
    },
    {
      key: "profitTargetPct",
      header: "Profit Target",
      numeric: true,
      cell: (r) =>
        r.profitTargetPct > 0 ? (
          <span className="font-mono tabular-nums text-sm">
            {r.profitTargetPct}%
          </span>
        ) : (
          <Badge variant="outline" className="text-[10px]">—</Badge>
        ),
      sortValue: (r) => r.profitTargetPct,
    },
    {
      key: "maxDrawdownPct",
      header: "Max Drawdown",
      numeric: true,
      cell: (r) =>
        <span className="font-mono tabular-nums text-sm">{r.maxDrawdownPct}%</span>,
      sortValue: (r) => r.maxDrawdownPct,
    },
    {
      key: "profitSplit",
      header: "Profit Split",
      numeric: true,
      cell: (r) =>
        r.profitSplit > 0 ? (
          <span className="font-mono tabular-nums text-sm text-emerald-600">
            {r.profitSplit}% to trader
          </span>
        ) : (
          <Badge variant="outline" className="text-[10px]">—</Badge>
        ),
      sortValue: (r) => r.profitSplit,
    },
    {
      key: "updatedAt",
      header: "Updated",
      cell: (r) => (
        <div className="text-xs text-muted-foreground">
          <div>{r.updatedAt ?? "—"}</div>
          {r.updatedBy ? <div className="text-[10px]">by {r.updatedBy}</div> : null}
        </div>
      ),
      sortValue: (r) => r.updatedAt ?? "",
    },
  ];

  const selectedId = router.params.config;
  const selected = selectedId
    ? phases.find((p) => p.id === selectedId)
    : undefined;

  const openConfig = (id: string) => {
    navigate("challenge-programs", { ...router.params, config: id });
  };
  const closeConfig = () => {
    const next = { ...router.params };
    delete next.config;
    navigate("challenge-programs", next, { replace: true });
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant={typeFilter === "all" ? "default" : "outline"}
        className="h-8 text-xs"
        onClick={() => setFilter("type", "all")}
      >
        All types
      </Button>
      {coverage.map(({ type, complete }) => (
        <Button
          key={type.id}
          size="sm"
          variant={typeFilter === type.id ? "default" : "outline"}
          className="h-8 gap-1 text-xs"
          onClick={() => setFilter("type", type.id)}
          title={complete ? undefined : `${type.name}: missing phase configs`}
        >
          {type.name}
          {!complete ? (
            <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />
          ) : null}
        </Button>
      ))}
      <Select
        value={statusFilter}
        onValueChange={(v) => setFilter("status", v)}
      >
        <SelectTrigger className="ml-auto h-8 w-44 text-xs" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const drawerHistory = selected
    ? getChangeHistory(undefined, selected.id).filter(
        (c) => c.entityType === "Phase" || c.entityType === "Challenge"
      )
    : [];
  const usageAccounts = selected
    ? tradingAccounts.filter((a) => a.phaseConfigId === selected.id)
    : [];
  const usageTenants = new Set(usageAccounts.map((a) => a.tenantId));
  const gateTenants = tenants.filter((t) =>
    (t.enabledFeatures ?? []).includes("challenges.two-phase")
  );

  return (
    <Page>
      <PageHeader
        title="Challenge Programs"
        description="Phase configurations across the challenge catalog — minimum trading days, profit targets, drawdown limits, profit splits, and per-type coverage. Review-only: edits happen in prop-firm admin."
        icon={Target}
        actions={
          <div className="flex gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] items-center gap-1 ${
                incompleteTypes.length > 0
                  ? "border-amber-500/50 text-amber-600"
                  : "border-emerald-500/50 text-emerald-600"
              }`}
            >
              {incompleteTypes.length > 0 ? (
                <AlertTriangle className="h-2.5 w-2.5" />
              ) : (
                <CheckCircle2 className="h-2.5 w-2.5" />
              )}
              {completeCount} of {coverage.length} types fully configured
            </Badge>
            <Badge variant="outline" className="text-[10px] items-center gap-1">
              <Info className="h-2.5 w-2.5" /> Review-only catalog
            </Badge>
          </div>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading challenge programs…"
        >
          {/* Coverage strip — surfaces types with missing configs (P0-2) */}
          {incompleteTypes.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Coverage gaps
                </span>
                {incompleteTypes.map(({ type, configured, expected }) => (
                  <button
                    key={type.id}
                    type="button"
                    className="rounded-md border border-amber-500/40 bg-background px-2 py-1 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    onClick={() => setFilter("type", type.id)}
                  >
                    {type.name}: <span className="font-mono">{configured}/{expected}</span>{" "}
                    configs
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* KPI strip — every metric carries a meaning subtitle (P2-1) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Configured Phase Rows"
              value={phases.length}
              icon={Target}
              deltaLabel={`across ${coverage.length} challenge types`}
            />
            <MetricCard
              label="Types Fully Configured"
              value={`${completeCount}/${coverage.length}`}
              icon={Layers}
              tone={incompleteTypes.length > 0 ? "warning" : "positive"}
              deltaLabel="declared phases vs config rows"
            />
            <MetricCard
              label="Phases with Min Days"
              value={phasesWithMinDays.length}
              icon={Calendar}
              tone="positive"
              deltaLabel="evaluation phases with a day floor"
            />
            <MetricCard
              label="Zero Min Days (eval)"
              value={zeroMinDaysEval.length}
              icon={AlertTriangle}
              tone={zeroMinDaysEval.length > 0 ? "warning" : "positive"}
              deltaLabel="eval phases with no day floor"
            />
          </div>

          {/* Data table — AGENTS §26 capabilities wired (P1-2, P1-3) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Phase Configurations</span>
              <p className="text-xs text-muted-foreground">
                Minimum trading days shown in teal, no-requirement phases flagged amber,
                funded phases emerald. Click a row for full detail, history, and usage.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={filteredPhases}
                rowKey={(r) => r.id}
                toolbar={toolbar}
                onRowClick={(r) => openConfig(r.id)}
                searchableText={(r) =>
                  `${r.challengeTypeName} ${r.phaseName} ${r.minTradingDays} ${r.maxDays} ${r.profitTargetPct} ${r.maxDrawdownPct} ${r.dailyDrawdownPct} ${r.profitSplit} ${r.accountSize}`
                }
                searchPlaceholder="Search phases by type, name, or parameters…"
                pageSize={15}
                emptyTitle={
                  typeFilter !== "all"
                    ? `No phase configurations for ${challengeTypeLabel(typeFilter)}`
                    : statusFilter !== "all"
                      ? "No phases match this status"
                      : "No phase configurations"
                }
                emptyDescription={
                  typeFilter !== "all"
                    ? "This type has no phase rows matching the current filters."
                    : "Challenge phase configs will appear here."
                }
                emptyAction={
                  typeFilter !== "all" || statusFilter !== "all" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("challenge-programs", {})}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
                exportCsv={{
                  filename: "challenge-phase-configs",
                  toRow: (r) => [
                    r.challengeTypeName,
                    r.phaseName,
                    String(r.phaseOrder),
                    String(r.accountSize),
                    String(r.profitTargetPct),
                    String(r.maxDrawdownPct),
                    String(r.dailyDrawdownPct),
                    String(r.minTradingDays),
                    String(r.maxDays),
                    String(r.profitSplit),
                    r.isFunded ? "funded" : phaseRowStatus(r),
                    r.updatedAt ?? "",
                    r.updatedBy ?? "",
                  ],
                }}
              />
            </CardContent>
          </Card>

          {/* Min days distribution — one denominator, collapse, empty state (P1-4) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Minimum Trading Days Distribution</span>
              <p className="text-xs text-muted-foreground">
                Share of all {phases.length} config rows per minimum-days bucket — click a
                row to filter the table.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {phases.length === 0 ? (
                <EmptyState
                  title="No config rows to distribute"
                  description="The minimum-days distribution appears once phase configurations exist."
                  icon={Calendar}
                />
              ) : minDaysDistribution.length === 0 && zeroMinDaysEval.length === 0 ? (
                <EmptyState
                  title="No minimum-days data"
                  description="No config rows qualify for the distribution yet."
                  icon={Calendar}
                />
              ) : minDaysDistribution.length === 1 && zeroMinDaysEval.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All {minDaysDistribution[0].count} min-days phase
                  {minDaysDistribution[0].count === 1 ? "" : "s"} require{" "}
                  <span className="font-medium text-foreground">
                    {minDaysDistribution[0].days} days
                  </span>
                  .
                </p>
              ) : (
                <>
                  {minDaysDistribution.map(({ days, count, pct }) => (
                    <button
                      key={days}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-muted/50"
                      onClick={() => {
                        setFilter("status", "min-days");
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-[100px]">
                        <Calendar className="h-4 w-4 text-teal-500" aria-hidden />
                        <span className="font-medium tabular-nums">{days} days</span>
                      </div>
                      <div className="flex-1 max-w-md">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="text-sm font-mono tabular-nums text-muted-foreground w-24 text-right">
                        {count} phase{count === 1 ? "" : "s"} ({pct}%)
                      </span>
                    </button>
                  ))}
                  {zeroMinDaysEval.length > 0 && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-muted/50"
                      onClick={() => setFilter("status", "no-min-days")}
                    >
                      <div className="flex items-center gap-1.5 min-w-[100px]">
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                        <span className="font-medium text-muted-foreground">Not required</span>
                      </div>
                      <div className="flex-1 max-w-md">
                        <Progress value={zeroPct} className="h-2" />
                      </div>
                      <span className="text-sm font-mono tabular-nums text-muted-foreground w-24 text-right">
                        {zeroMinDaysEval.length} phase
                        {zeroMinDaysEval.length === 1 ? "" : "s"} ({zeroPct}%)
                      </span>
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tenant gate panel — who consumes gated programs (P1-6) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Tenant Feature Gates
              </span>
              <p className="text-xs text-muted-foreground">
                Tenants with the <code>challenges.two-phase</code> feature enabled — the
                gate that admits them to multi-phase programs.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {gateTenants.length === 0 ? (
                <EmptyState
                  title="No tenants gated on challenges.two-phase"
                  description="Enable the feature on a tenant to admit it to multi-phase programs."
                  icon={ShieldCheck}
                />
              ) : (
                gateTenants.map((t) => (
                  <Badge key={t.id} variant="outline" className="text-[10px] items-center gap-1">
                    <Users className="h-2.5 w-2.5" aria-hidden />
                    {t.name}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>

          {/* Detail drawer — fields, validation, history, usage (P1-5, P1-6) */}
          <Sheet open={!!selected} onOpenChange={(open) => !open && closeConfig()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              {selected ? (
                <>
                  <SheetHeader>
                    <SheetTitle>
                      {selected.challengeTypeName} — {selected.phaseName}
                    </SheetTitle>
                    <SheetDescription>
                      Config {selected.id} · phase #{selected.phaseOrder}
                      {selected.updatedAt
                        ? ` · updated ${selected.updatedAt} by ${selected.updatedBy ?? "unknown"}`
                        : ""}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-4 space-y-4">
                    {/* All config fields */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ["Account size", `$${selected.accountSize.toLocaleString()}`],
                        ["Profit target", `${selected.profitTargetPct}%`],
                        ["Max drawdown", `${selected.maxDrawdownPct}%`],
                        ["Daily drawdown", `${selected.dailyDrawdownPct}%`],
                        ["Min trading days", selected.isFunded ? "n/a (funded)" : String(selected.minTradingDays)],
                        ["Max days", selected.maxDays > 0 ? `${selected.maxDays} days` : "No limit"],
                        ["Profit split", selected.profitSplit > 0 ? `${selected.profitSplit}% to trader` : "—"],
                        ["Funded phase", selected.isFunded ? "Yes" : "No"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border bg-muted/30 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {label}
                          </div>
                          <div className="font-mono tabular-nums">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Validation vs platform risk defaults d6/d7 */}
                    <div className="rounded-md border p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        Platform risk defaults (5% daily / 10% max)
                      </div>
                      {(() => {
                        const m = matchesRiskDefaults(selected);
                        if (m.daily && m.max) {
                          return (
                            <p className="text-xs text-emerald-600">
                              Drawdown limits match platform defaults.
                            </p>
                          );
                        }
                        return (
                          <p className="text-xs text-amber-600">
                            Drift:{" "}
                            {!m.daily && `daily ${selected.dailyDrawdownPct}% ≠ 5% `}
                            {!m.max && `max ${selected.maxDrawdownPct}% ≠ 10%`}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Change history (§61 who/what/when/why) */}
                    <div className="rounded-md border p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                        <History className="h-3.5 w-3.5" aria-hidden />
                        Change history
                      </div>
                      {drawerHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No logged changes for this config yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {drawerHistory.slice(0, 5).map((c) => (
                            <li key={c.id} className="text-xs">
                              <span className="font-medium">{c.field}</span>:{" "}
                              {c.oldValue} → {c.newValue}
                              <div className="text-muted-foreground">
                                {c.actor} · {c.timestamp} · {c.reason}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Usage chips */}
                    <div className="rounded-md border p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        Usage
                      </div>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {usageAccounts.length} account
                          {usageAccounts.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {usageTenants.size} tenant{usageTenants.size === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </SheetContent>
          </Sheet>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
