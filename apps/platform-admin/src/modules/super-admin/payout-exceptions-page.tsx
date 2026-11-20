"use client";

/**
 * Payout Exception Console — R10 PS-03 + PW-03.
 *
 * Failed and stuck payouts, which the console literally could not
 * represent before PW-03 added `failed` as a first-class state
 * (rejected = an approval decision; failed = a rail outcome — conflating
 * them corrupts both the on-time methodology and provider SLA reporting).
 *
 * Contents:
 *   • failure reason-code breakdown (rail declined, invalid beneficiary,
 *     insufficient float, timeout, …) with counts and money exposure;
 *   • exception table — failed rows with age, retry history and a
 *     typed-reason retry; stuck in-flight rows (7d+) surfaced alongside;
 *   • per-reason bulk retry (PS-03 minimum scope);
 *   • escalation — logs an audit row flagging the tenant's operators.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DestructiveActionDialog } from "@/components/platform/destructive-action-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import {
  usePayouts,
  retryPayout,
  type PlatformPayout,
  type PayoutFailureReason,
} from "@/lib/platform/payout-store";
import {
  AlertTriangle,
  RotateCcw,
  BellRing,
  Clock,
  CheckCircle2,
} from "lucide-react";

const FAILURE_LABELS: Record<PayoutFailureReason, string> = {
  "rail-declined": "Rail declined",
  "invalid-beneficiary": "Invalid beneficiary",
  "insufficient-float": "Insufficient float",
  timeout: "Timeout",
  "compliance-hold": "Compliance hold",
  "fraud-suspected": "Fraud suspected",
  duplicate: "Duplicate",
  "cancelled-by-operator": "Cancelled by operator",
  other: "Other",
};

const STUCK_DAYS = 7;

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function PayoutExceptionsPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  const [retryTarget, setRetryTarget] = useState<PlatformPayout | null>(null);

  const failed = useMemo(
    () => payouts.filter((p) => p.status === "failed"),
    [payouts],
  );

  /** Stuck = still in flight and older than the 7-day exception threshold. */
  const stuck = useMemo(
    () =>
      payouts.filter(
        (p) =>
          ["pending", "approved", "processing", "on-hold"].includes(p.status) &&
          ageDays(p.createdAt) >= STUCK_DAYS,
      ),
    [payouts],
  );

  /** PS-03 — failure reason-code breakdown with money exposure. */
  const byReason = useMemo(() => {
    const map = new Map<
      PayoutFailureReason,
      { count: number; byCurrency: Record<string, number> }
    >();
    for (const p of failed) {
      const key = p.failureReason ?? "other";
      const entry = map.get(key) ?? { count: 0, byCurrency: {} };
      entry.count++;
      entry.byCurrency[p.currency] = (entry.byCurrency[p.currency] ?? 0) + p.amount;
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [failed]);

  const totalRetries = failed.reduce(
    (s, p) => s + (p.history ?? []).filter((h) => h.to === "pending").length,
    0,
  );

  function retry(p: PlatformPayout, reason: string) {
    const res = retryPayout(p.id, user.name, reason);
    if (res.ok) {
      toast({
        title: `Retry queued for ${p.reference}`,
        description: `${formatCurrency(p.amount, p.currency)} returned to pending — transition + audit written.`,
      });
    } else {
      toast({
        title: "Retry blocked",
        description: res.error ?? "Only failed payouts can be retried.",
        variant: "destructive",
      });
    }
    setRetryTarget(null);
  }

  /** PS-03 — per-reason bulk retry. */
  function bulkRetry(reason: PayoutFailureReason) {
    const targets = failed.filter((p) => (p.failureReason ?? "other") === reason);
    let ok = 0;
    for (const p of targets) {
      if (retryPayout(p.id, user.name, `Bulk retry (${FAILURE_LABELS[reason]} — PS-03)`).ok) ok++;
    }
    toast({
      title: `Retried ${ok} of ${targets.length} “${FAILURE_LABELS[reason]}” failures`,
      description: ok
        ? "Each retry wrote a failed → pending transition and an audit row."
        : "Nothing was retried.",
      variant: ok ? undefined : "destructive",
    });
  }

  /** Escalation — flag the tenant's operators via the audit trail. */
  function escalate(p: PlatformPayout) {
    recordAudit({
      actor: user.name,
      action: "payout.exception_escalated",
      target: p.reference,
      tenantId: p.tenantId,
      severity: "critical",
      detail:
        `Escalated failed payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} ` +
        `to tenant operators — reason: ${p.failureReason ?? "unknown"}.`,
    });
    toast({
      title: `Escalated ${p.reference}`,
      description: `${p.tenantName ?? p.tenantId} operators notified — audit row written.`,
    });
  }

  const failedCols: Column<PlatformPayout>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (p) => <span className="font-mono text-xs">{p.reference}</span>,
      sortValue: (p) => p.reference,
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (p) => <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span>,
      sortValue: (p) => p.tenantName ?? p.tenantId,
    },
    {
      key: "trader",
      header: "Trader",
      cell: (p) => <span className="text-sm">{p.traderName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      cell: (p) => (
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(p.amount, p.currency)}
        </span>
      ),
      sortValue: (p) => p.amount,
    },
    {
      key: "reason",
      header: "Reason code",
      cell: (p) => (
        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
          {FAILURE_LABELS[p.failureReason ?? "other"]}
        </Badge>
      ),
      sortValue: (p) => p.failureReason ?? "other",
    },
    {
      key: "age",
      header: "Age",
      cell: (p) => (
        <span className="font-mono text-xs tabular-nums">{ageDays(p.createdAt)}d</span>
      ),
      sortValue: (p) => ageDays(p.createdAt),
    },
    {
      key: "retries",
      header: "Retries",
      cell: (p) => {
        const n = (p.history ?? []).filter((h) => h.to === "pending").length;
        return (
          <span className={`font-mono text-xs ${n >= 3 ? "text-rose-600 font-semibold" : ""}`}>
            {n}
          </span>
        );
      },
      sortValue: (p) => (p.history ?? []).filter((h) => h.to === "pending").length,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setRetryTarget(p)}>
            <RotateCcw className="mr-1 h-3 w-3" /> Retry
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => escalate(p)}>
            <BellRing className="mr-1 h-3 w-3" /> Escalate
          </Button>
        </div>
      ),
    },
  ];

  const stuckCols: Column<PlatformPayout>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (p) => <span className="font-mono text-xs">{p.reference}</span>,
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (p) => <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      cell: (p) => (
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(p.amount, p.currency)}
        </span>
      ),
      sortValue: (p) => p.amount,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => <StatusBadge tone={p.status === "on-hold" ? "warning" : "info"}>{p.status}</StatusBadge>,
    },
    {
      key: "age",
      header: "Age",
      cell: (p) => (
        <span className="font-mono text-xs font-semibold text-rose-600 tabular-nums">
          {ageDays(p.createdAt)}d
        </span>
      ),
      sortValue: (p) => ageDays(p.createdAt),
    },
    {
      key: "stage",
      header: "Stuck in",
      cell: (p) => (
        <span className="text-xs text-muted-foreground capitalize">{p.status} stage</span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Payout Exception Console"
        description="Failed and stuck payouts with reason codes, aging, retry history and per-reason bulk retry (R10 PS-03 / PW-03)."
        icon={AlertTriangle}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            label="Failed payouts"
            value={failed.length}
            icon={AlertTriangle}
            tone={failed.length > 0 ? "negative" : "default"}
          />
          <MetricCard
            label={`Stuck ≥ ${STUCK_DAYS}d (in flight)`}
            value={stuck.length}
            icon={Clock}
            tone={stuck.length > 0 ? "warning" : "default"}
          />
          <MetricCard label="Reason codes seen" value={byReason.length} icon={AlertTriangle} />
          <MetricCard label="Total retries" value={totalRetries} icon={RotateCcw} />
        </div>

        {/* Reason-code breakdown + per-reason bulk retry */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Failure reason codes</CardTitle>
            <CardDescription>
              Rail outcomes, kept distinct from approval rejections — each code can be retried in
              bulk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {byReason.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No failed payouts — the rail has rejected nothing in the current store state.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byReason.map(([reason, data]) => (
                  <div key={reason} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{FAILURE_LABELS[reason]}</span>
                      <Badge variant="secondary">{data.count}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {Object.entries(data.byCurrency)
                        .map(([cur, amt]) => formatCurrency(amt, cur))
                        .join(" · ")}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 w-full text-[10px]"
                      onClick={() => bulkRetry(reason)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry all ({data.count})
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failed table */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Failed payouts</CardTitle>
            <CardDescription>
              Reason code, aging and retry history per row — retry and escalate both write audit
              rows.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={failedCols}
              data={failed}
              rowKey={(p) => p.id}
              pageSize={10}
              searchableText={(p) => `${p.reference} ${p.traderName} ${p.tenantName ?? ""}`}
              emptyTitle="No failed payouts"
              emptyDescription="Failures appear here the moment a payout is marked failed with a reason code (PW-03)."
            />
          </CardContent>
        </Card>

        {/* Stuck table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Stuck in flight</CardTitle>
            <CardDescription>
              Pending, approved, processing or held rows older than {STUCK_DAYS} days — the
              exception counterpart to the aging buckets.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={stuckCols}
              data={stuck}
              rowKey={(p) => p.id}
              pageSize={10}
              searchableText={(p) => `${p.reference} ${p.traderName} ${p.tenantName ?? ""}`}
              emptyTitle="Nothing stuck"
              emptyDescription={`No in-flight payout has exceeded ${STUCK_DAYS} days.`}
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Why rejected ≠ failed
          </p>
          <p>
            <strong>Rejected</strong> is an approval decision made by an operator; <strong>failed</strong>{" "}
            is an outcome the rail returned. Keeping them apart means the on-time methodology and
            any future provider SLA reporting count the right denominators.
          </p>
        </div>
      </PageContent>

      {/* Typed-reason retry dialog */}
      <DestructiveActionDialog
        dialogId="payout-retry-reason"
        open={retryTarget !== null}
        onOpenChange={(o) => !o && setRetryTarget(null)}
        variant="custom"
        title={`Retry payout ${retryTarget?.reference ?? ""}?`}
        consequence={
          retryTarget
            ? `${formatCurrency(retryTarget.amount, retryTarget.currency)} for ${retryTarget.traderName} returns to the pending queue for a fresh execution attempt. The failed → pending transition and your reason are written to the payout history and the Platform Audit Log.`
            : ""
        }
        context={
          retryTarget ? (
            <span className="block text-xs">
              Reason code: <strong>{FAILURE_LABELS[retryTarget.failureReason ?? "other"]}</strong> ·
              Prior retries: {(retryTarget.history ?? []).filter((h) => h.to === "pending").length}
            </span>
          ) : null
        }
        reasonLabel="Retry reason (required)"
        onConfirm={(reason) => {
          if (retryTarget) retry(retryTarget, reason);
        }}
      />
    </Page>
  );
}
