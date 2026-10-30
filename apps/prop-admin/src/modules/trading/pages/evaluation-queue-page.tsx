"use client";

/**
 * Evaluation Queue — PRD §4.3 / §4.6.2 / §4.17.
 *
 * The admin review step for challenge evaluations that reached a decision
 * point. Mirrors the payout review pattern:
 *   - Approve  → POST /evaluation/:id/approve
 *   - Reject   → POST /evaluation/:id/reject (reason required, §24 friction)
 *   - Override → POST /evaluation/:id/override (force pass/fail, reason
 *                required — manual overrides are audit-logged)
 *
 * Decisions mutate the session evaluation store; the queue table, KPI
 * cards and the sidebar "Evaluation Queue" count badge all re-render from
 * that single source of truth.
 */

import { useState } from "react";
import { useDetailOverlay } from "@/components/platform/detail-overlay";
import { openViewInNewTab } from "@/lib/platform/view-links";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  decideEvaluation,
  getEvaluations,
  useEvaluationVersion,
  type Evaluation,
} from "@/modules/trading/evaluation-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  ExternalLink,
  MoreVertical,
  Scale,
  XCircle,
} from "lucide-react";

type StatusTone = "warning" | "success" | "danger" | "info";

export const statusTone: Record<Evaluation["status"], StatusTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  overridden: "info",
};

export const statusLabel: Record<Evaluation["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  overridden: "Overridden",
};

/* ------------------------------------------------------------------ */
/* Per-row actions — Approve / Reject (reason) / Override (reason)     */
/* ------------------------------------------------------------------ */

/** Shared by the queue's actions column and evaluation-detail-page. */
export function EvaluationRowActions({ ev }: { ev: Evaluation }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideOutcome, setOverrideOutcome] = useState<"pass" | "fail">("pass");

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        onClick={() => {
          decideEvaluation(ev.id, "approved");
          toast({
            title: "Evaluation approved",
            description: `${ev.traderName} — ${ev.challengeName} ${ev.phase} approved.`,
          });
        }}
      >
        Approve
      </Button>

      {/* §24 Destructive Actions — reject notifies the trader and blocks
          funding; reason is captured for the audit trail. */}
      <AlertDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700">
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject {ev.traderName}&#39;s {ev.challengeName} ({ev.phase})
              evaluation on account {ev.accountLogin}.
            </AlertDialogDescription>
            <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              <span className="font-medium">Consequence:</span> The trader will be notified and
              the account will not advance to funding. They can request a re-review. This action
              is logged in the audit trail.
            </div>
          </AlertDialogHeader>
          <div className="space-y-1.5 text-left">
            <Label htmlFor={`reject-reason-${ev.id}`} className="text-xs text-muted-foreground">
              Reason (required)
            </Label>
            <Textarea
              id={`reject-reason-${ev.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Consistency rule breached — 78% of profit from one position."
              className="min-h-[72px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim()}
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                decideEvaluation(ev.id, "rejected", rejectReason);
                toast({
                  title: "Evaluation rejected",
                  description: `${ev.traderName}'s evaluation was rejected.`,
                  variant: "destructive",
                });
                setRejectReason("");
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual override — force pass / force fail with reason (audit-logged) */}
      <AlertDialog
        open={overrideOpen}
        onOpenChange={(open) => {
          setOverrideOpen(open);
          if (!open) {
            setOverrideReason("");
            setOverrideOutcome("pass");
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Scale className="mr-1 h-3 w-3" /> Override
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manually override evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              Bypass the automated rules for {ev.traderName}&#39;s {ev.challengeName} (
              {ev.phase}) evaluation. Use only when the numbers do not tell the full story.
            </AlertDialogDescription>
            <div className="rounded-md border border-amber-500/30 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <span className="font-medium">Consequence:</span> The override direction (force
              pass / force fail) and your reason are permanently recorded in the audit trail.
            </div>
          </AlertDialogHeader>
          <div className="space-y-3 text-left">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Outcome</Label>
              <RadioGroup
                value={overrideOutcome}
                onValueChange={(v) => setOverrideOutcome(v as "pass" | "fail")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pass" id={`ov-pass-${ev.id}`} />
                  <Label htmlFor={`ov-pass-${ev.id}`} className="text-sm cursor-pointer">
                    Force pass
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fail" id={`ov-fail-${ev.id}`} />
                  <Label htmlFor={`ov-fail-${ev.id}`} className="text-sm cursor-pointer">
                    Force fail
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ov-reason-${ev.id}`} className="text-xs text-muted-foreground">
                Reason (required)
              </Label>
              <Textarea
                id={`ov-reason-${ev.id}`}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Drawdown spike caused by broker price gap — reviewed tick data."
                className="min-h-[72px]"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!overrideReason.trim()}
              onClick={() => {
                decideEvaluation(ev.id, "overridden", overrideReason, overrideOutcome);
                toast({
                  title: `Evaluation overridden — force ${overrideOutcome}`,
                  description: `${ev.traderName}'s evaluation was manually overridden (audit logged).`,
                });
                setOverrideReason("");
                setOverrideOutcome("pass");
              }}
            >
              <Scale className="mr-1 h-3 w-3" /> Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function EvaluationQueuePage() {
  useEvaluationVersion(); // table + KPIs react to decisions
  const { openPanel } = useDetailOverlay();
  const [tab, setTab] = useState<Evaluation["status"] | "all">("pending");

  const evaluations = getEvaluations();
  const counts = {
    pending: evaluations.filter((e) => e.status === "pending").length,
    approved: evaluations.filter((e) => e.status === "approved").length,
    rejected: evaluations.filter((e) => e.status === "rejected").length,
    overridden: evaluations.filter((e) => e.status === "overridden").length,
  };
  const rows = tab === "all" ? evaluations : evaluations.filter((e) => e.status === tab);

  const columns: Column<Evaluation>[] = [
    {
      key: "trader",
      header: "Trader",
      cell: (ev) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{ev.traderName}</p>
          <p className="truncate text-xs text-muted-foreground">{ev.traderEmail}</p>
        </div>
      ),
      sortValue: (ev) => ev.traderName,
    },
    {
      key: "account",
      header: "Account",
      cell: (ev) => <span className="font-mono text-xs">{ev.accountLogin}</span>,
      sortValue: (ev) => ev.accountLogin,
    },
    {
      key: "challenge",
      header: "Challenge",
      cell: (ev) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{ev.challengeName}</p>
          <p className="text-xs text-muted-foreground">{ev.phase}</p>
        </div>
      ),
      sortValue: (ev) => ev.challengeName,
    },
    {
      key: "progress",
      header: "Profit vs Target",
      cell: (ev) => {
        const pct = Math.min(100, Math.round((ev.profitPct / ev.targetPct) * 100));
        const met = ev.profitPct >= ev.targetPct;
        return (
          <div className="min-w-[96px]">
            <span className={cn("text-xs font-semibold", met ? "text-emerald-600" : "text-muted-foreground")}>
              {ev.profitPct}% / {ev.targetPct}%
            </span>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div
                className={cn("h-1.5 rounded-full", met ? "bg-emerald-500" : "bg-sky-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
      sortValue: (ev) => ev.profitPct,
    },
    {
      key: "days",
      header: "Days",
      cell: (ev) => (
        <span className="text-xs tabular-nums">
          {ev.daysTraded}/{ev.minDays} min
        </span>
      ),
      sortValue: (ev) => ev.daysTraded,
    },
    {
      key: "drawdown",
      header: "Drawdown Used",
      cell: (ev) => <span className="text-xs tabular-nums">{ev.drawdownUsedPct}%</span>,
      sortValue: (ev) => ev.drawdownUsedPct,
      numeric: true,
    },
    {
      key: "requested",
      header: "Requested",
      cell: (ev) => (
        <span className="text-xs text-muted-foreground">
          {new Date(ev.requestedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
      sortValue: (ev) => ev.requestedAt,
    },
    {
      key: "status",
      header: "Status",
      cell: (ev) => (
        <StatusBadge tone={statusTone[ev.status]}>{statusLabel[ev.status]}</StatusBadge>
      ),
      sortValue: (ev) => ev.status,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (ev) => (
        // stopPropagation on the whole cell so decision buttons and the
        // row menu never bubble into the row's overlay open.
        <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
          <div className="min-w-0 flex-1">
            {ev.status === "pending" ? (
              <EvaluationRowActions ev={ev} />
            ) : (
              <div className="max-w-[220px]">
                {ev.reason ? (
                  <p className="truncate text-xs text-muted-foreground" title={ev.reason}>
                    {ev.overrideOutcome ? `Force ${ev.overrideOutcome}: ` : ""}
                    {ev.reason}
                  </p>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {ev.decidedAt ? (
                  <p className="text-[11px] text-muted-foreground/70">
                    {new Date(ev.decidedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 p-0"
                aria-label={`Actions for ${ev.traderName}'s evaluation`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Evaluation actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openPanel("evaluation-detail", { id: ev.id })}>
                <Eye className="h-3.5 w-3.5" /> View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openViewInNewTab("evaluation-detail", { id: ev.id })}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const handleExport = () => {
    exportToCsv(
      rows,
      [
        { key: "id", header: "ID", value: (e) => e.id },
        { key: "traderName", header: "Trader", value: (e) => e.traderName },
        { key: "traderEmail", header: "Email", value: (e) => e.traderEmail },
        { key: "accountLogin", header: "Account", value: (e) => e.accountLogin },
        { key: "challengeName", header: "Challenge", value: (e) => e.challengeName },
        { key: "phase", header: "Phase", value: (e) => e.phase },
        { key: "profitPct", header: "Profit %", value: (e) => e.profitPct },
        { key: "targetPct", header: "Target %", value: (e) => e.targetPct },
        { key: "status", header: "Status", value: (e) => e.status },
        { key: "reason", header: "Reason", value: (e) => e.reason ?? "" },
        { key: "requestedAt", header: "Requested", value: (e) => e.requestedAt },
      ],
      `evaluation-queue-${tab}-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Evaluation Queue"
        description="Challenge evaluations awaiting review — approve, reject, or override."
        icon={ClipboardCheck}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pending" value={counts.pending} icon={Clock} tone="warning" />
          <MetricCard label="Approved" value={counts.approved} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Rejected" value={counts.rejected} icon={XCircle} tone="negative" />
          <MetricCard label="Overridden" value={counts.overridden} icon={Scale} tone="info" />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Evaluation review queue</p>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(ev) => ev.id}
            onRowClick={(ev) => openPanel("evaluation-detail", { id: ev.id })}
            searchableText={(ev) =>
              `${ev.traderName} ${ev.traderEmail} ${ev.accountLogin} ${ev.challengeName} ${ev.phase} ${ev.status}`
            }
            searchPlaceholder="Search evaluations…"
            emptyTitle={tab === "pending" ? "Queue is clear" : "No evaluations found"}
            emptyDescription={
              tab === "pending"
                ? "All submitted evaluations have been reviewed. New submissions appear here automatically."
                : "Adjust the filter or try a different search."
            }
            toolbar={
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as Evaluation["status"] | "all")}
              >
                <TabsList>
                  <TabsTrigger value="pending">
                    Pending ({counts.pending})
                  </TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Decisions are recorded in the audit trail. Manual overrides require a reason and are
          flagged for compliance review.
        </p>
      </PageContent>
    </Page>
  );
}
