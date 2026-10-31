"use client";

/**
 * Challenge Programs — platform-admin super-admin view.
 *
 * Displays challenge phase configurations with their minimum trading days
 * requirement prominently shown. Audit finding #11 (MEDIUM): the platform
 * mock data has minTradingDays on every phase config but no view ever
 * surfaced it. This page closes that gap so platform operators can review
 * and validate the minimum trading days across all challenge programs.
 */

import { useMemo } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Progress } from "@/components/ui/progress";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import {
  getChallengePhaseConfigs,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import { Calendar, Target, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PhaseRow extends ChallengePhaseConfig {
  challengeTypeName: string;
  phaseStatus: "active" | "funded" | "evaluation";
}

const CHALLENGE_TYPES: Record<string, string> = {
  "ct-1": "1-Step Evaluation",
  "ct-2": "2-Step Evaluation",
  "ct-3": "3-Step Evaluation",
  "ct-4": "Instant Funding",
};

export function ChallengeProgramsPage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 500 }), []);

  const phases = useMemo((): PhaseRow[] => {
    const cfgs = getChallengePhaseConfigs();
    return cfgs.map((p) => ({
      ...p,
      challengeTypeName: CHALLENGE_TYPES[p.challengeTypeId] ?? p.challengeTypeId,
      phaseStatus: p.isFunded
        ? "funded"
        : p.phaseOrder === 1
          ? "evaluation"
          : "active",
    }));
  }, []);

  const phasesWithMinDays = phases.filter((p) => p.minTradingDays > 0);
  const zeroMinDays = phases.filter((p) => p.minTradingDays === 0 && !p.isFunded);
  const fundedPhases = phases.filter((p) => p.isFunded);

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
      sortValue: (r) => `${r.challengeTypeId}-${r.phaseOrder}`,
    },
    {
      key: "accountSize",
      header: "Account Size",
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
      cell: (r) => {
        if (r.minTradingDays === 0 && !r.isFunded) {
          return (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not required
            </Badge>
          );
        }
        if (r.isFunded) {
          return (
            <Badge variant="outline" className="text-[10px] text-emerald-600">
              <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Funded
            </Badge>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
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
      key: "maxDays",
      header: "Max Days",
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
      cell: (r) =>
        <span className="font-mono tabular-nums text-sm">{r.maxDrawdownPct}%</span>,
      sortValue: (r) => r.maxDrawdownPct,
    },
    {
      key: "profitSplit",
      header: "Profit Split",
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
      key: "actions",
      header: "Status",
      cell: (r) => {
        if (r.isFunded) {
          return <Badge variant="default" className="text-[10px] bg-emerald-100 text-emerald-700">Funded Phase</Badge>;
        }
        if (r.minTradingDays === 0) {
          return (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
              <AlertTriangle className="mr-1 h-2.5 w-2.5" /> No min days
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-[10px] border-teal-500/50 text-teal-600">
            {r.minTradingDays} min days
          </Badge>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Challenge Programs"
        description="Phase configurations across all challenge types — minimum trading days, profit targets, drawdown limits, and profit splits. Minimum trading days are highlighted for compliance review."
        icon={Target}
        actions={
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px] items-center gap-1">
              <Info className="h-2.5 w-2.5" /> {phasesWithMinDays.length} of {phases.length} phases require minimum trading days
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
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Total Phases"
              value={phases.length}
              icon={Target}
            />
            <MetricCard
              label="Phases with Min Days"
              value={phasesWithMinDays.length}
              icon={Calendar}
              tone="positive"
            />
            <MetricCard
              label="Zero Min Days (eval)"
              value={zeroMinDays.length}
              icon={AlertTriangle}
              tone={zeroMinDays.length > 0 ? "warning" : "positive"}
            />
            <MetricCard
              label="Funded Phases"
              value={fundedPhases.length}
              icon={CheckCircle2}
            />
          </div>

          {/* Data table — every phase config with minTradingDays prominently displayed */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Phase Configurations</span>
              <p className="text-xs text-muted-foreground">
                Minimum trading days are shown prominently (teal). Phases with no requirement are flagged
                (amber). Funded phases show a check (emerald).
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={phases}
                rowKey={(r) => r.id}
                searchableText={(r) =>
                  `${r.challengeTypeName} ${r.phaseName} ${r.minTradingDays} ${r.maxDays} ${r.profitTargetPct} ${r.maxDrawdownPct}`
                }
                searchPlaceholder="Search phases by type, name, or parameters…"
                pageSize={15}
                emptyTitle="No phase configurations"
                emptyDescription="Challenge phase configs will appear here."
              />
            </CardContent>
          </Card>

          {/* Min days distribution summary */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Minimum Trading Days Distribution</span>
              <p className="text-xs text-muted-foreground">
                How many days are required across evaluation phases — useful for standardizing programs.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {useMemo(() => {
                const daysMap = new Map<number, number>();
                phasesWithMinDays.forEach((p) => {
                  daysMap.set(p.minTradingDays, (daysMap.get(p.minTradingDays) ?? 0) + 1);
                });
                return Array.from(daysMap.entries())
                  .sort((a, b) => a[0] - b[0])
                  .map(([days, count]) => ({
                    days,
                    count,
                    pct: Math.round((count / phasesWithMinDays.length) * 100),
                  }));
              }, [phasesWithMinDays]).map(({ days, count, pct }) => (
                <div key={days} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-[100px]">
                    <Calendar className="h-4 w-4 text-teal-500" aria-hidden />
                    <span className="font-medium tabular-nums">{days} days</span>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Progress value={pct} className="h-2" />
                  </div>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground w-16 text-right">
                    {count} phase{count === 1 ? "" : "s"} ({pct}%)
                  </span>
                </div>
              ))}
              {zeroMinDays.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-[100px]">
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                    <span className="font-medium text-muted-foreground">Not required</span>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Progress value={Math.round((zeroMinDays.length / phases.length) * 100)} className="h-2" />
                  </div>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground w-16 text-right">
                    {zeroMinDays.length} phase{zeroMinDays.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}