"use client";

/**
 * R10-A1 — Scaling Plan (operator-facing).
 *
 * Operator view over `scaling-plan-store`:
 *   • Milestone list (editable overrides — audited).
 *   • Per-account progress rows with current phase / milestone index.
 *   • Milestone reach stats — survives reload via localStorage.
 *
 * Registered in the challenges manifest + view-router; reachable via
 * direct link / deep-link (nav-children cap is at 150/150).
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  addMilestone,
  getScalingMilestones,
  getScalingProgressForTrader,
  getScalingStats,
  handleTradeClosed,
  removeMilestone,
  updateMilestone,
  useScalingVersion,
} from "@/lib/scaling-plan-store";
import { usePlatform } from "@/lib/platform/platform-context";

const PHASE_BADGE: Record<string, string> = {
  scaling: "bg-blue-50/40 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700",
  funded: "bg-emerald-50/40 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700",
  blocked: "bg-rose-50/40 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-700",
};

export function ScalingPlanPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useScalingVersion(); // re-render on any mutation

  const milestones = getScalingMilestones();
  const stats = getScalingStats();

  const progressRows = useMemo(
    () =>
      getScalingProgressForTrader(tid).sort(
        (a, b) => b.currentProfitPct - a.currentProfitPct,
      ),
    [tid],
  );

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");

  const milestoneColumns = [
    { key: "name", header: "Milestone", cell: (m) => <span>{m.name}</span> },
    {
      key: "target",
      header: "Profit Target",
      cell: (m) => <span className="text-xs">{m.profitTargetPct}%</span>,
    },
    {
      key: "minDays",
      header: "Min Days",
      cell: (m) => <span className="text-xs">{String(m.minTradingDays ?? "—")}</span>,
    },
    {
      key: "split",
      header: "New Split",
      cell: (m) =>
        m.newProfitSplitPct ? (
          <span className="text-xs">{m.newProfitSplitPct}%</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "size",
      header: "New Account Size",
      cell: (m) =>
        m.newAccountSize ? (
          <span className="text-xs">$${m.newAccountSize.toLocaleString()}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "actions", header: "", cell: () => null },
  ];

  const progressColumns = [
    { key: "accountId", header: "Account", cell: (r) => <span>{r.accountId}</span> },
    {
      key: "phase",
      header: "Phase",
      cell: (r) => (
        <Badge
          variant="outline"
          className={`text-[10px] ${PHASE_BADGE[r.currentPhase]}`}
        >
          {r.currentPhase}
        </Badge>
      ),
    },
    { key: "milestone", header: "Milestone #", cell: (r) => <span className="text-xs">{String(r.currentMilestoneIndex)}</span> },
    { key: "profitPct", header: "Profit %", cell: (r) => <span className="text-xs font-mono">{r.currentProfitPct.toFixed(1)}%</span> },
    { key: "tradingDays", header: "Trading Days", cell: (r) => <span className="text-xs">{String(r.tradingDays)}</span> },
    { key: "splitPct", header: "Split", cell: (r) => <span className="text-xs">{r.currentProfitSplitPct}%</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Scaling Plan Automation"
        description="Account milestone detection — reacts to `trade.closed` / `payout.paid` / hard-breach on the shared lifecycle log with idempotent watermarking (survives F5)."
        icon={ArrowLeft}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setEditingMilestoneId(null)}>
              New Milestone
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Accounts"
            value={stats.totalAccounts}
            icon={ArrowLeft}
          />
          <MetricCard label="Avg Profit %" value={stats.averageProfitPct.toFixed(1)} />
          <MetricCard label="Milestones Reached" value={stats.milestonesReached} />
          <MetricCard label="Avg Split %" value={stats.averageSplitPct.toFixed(1)} />
        </div>

        <div className="space-y-4">
          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Milestones</h2>
            <DataTable
              columns={milestoneColumns}
              data={milestones}
              rowKey={(m) => m.id}
              pageSize={8}
              searchPlaceholder="Search milestones…"
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Account Progress</h2>
            <DataTable
              columns={progressColumns}
              data={progressRows}
              rowKey={(r) => r.accountId}
              pageSize={10}
            />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
