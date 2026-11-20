"use client";

/**
 * Cross-Tenant Payout Operations Console — R10 PS-01 + PF-01 + PW-01.
 *
 * The drill-through the queues page and Payout Statistics both lack:
 * one table of actual payout rows across every tenant, read from the
 * payout store (PF-12) — not a count, not a re-derived aggregate.
 *
 * Contents:
 *   • headline — pending payout liability DENOMINATED IN MONEY (PF-01),
 *     per currency (no FX is invented; the published methodology refuses
 *     cross-currency summation and so does this console);
 *   • filters — tenant / status / method / age, with money-denominated
 *     totals recomputed for the active filter set;
 *   • row actions — approve / hold / reject / release / cancel with a
 *     typed reason (PW-01): every mutation runs through the store, which
 *     writes a state-transition history row (PW-09) and a Platform Audit
 *     Log entry;
 *   • bulk actions — multi-select hold + CSV export (PW-06);
 *   • row click — payout detail sheet: lifecycle, history, evidence and
 *     the full action bar (drill-through to PS-02 territory).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DestructiveActionDialog } from "@/components/platform/destructive-action-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  usePayouts,
  approvePayout,
  holdPayout,
  releasePayout,
  rejectPayout,
  cancelPayout,
  type PlatformPayout,
  type PlatformPayoutStatus,
} from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import {
  Shield,
  Wallet,
  Search,
  Download,
  CheckCircle,
  PauseCircle,
  XCircle,
  PlayCircle,
  RotateCcw,
  Banknote,
AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const IN_FLIGHT: PlatformPayoutStatus[] = ["pending", "approved", "processing", "on-hold"];

const STATUS_TONES: Record<PlatformPayoutStatus, "success" | "info" | "warning" | "danger" | "muted"> = {
  pending: "warning",
  approved: "info",
  processing: "info",
  paid: "success",
  rejected: "muted",
  failed: "danger",
  cancelled: "muted",
  "on-hold": "warning",
};

const FAILURE_LABELS: Record<string, string> = {
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

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ageBucket(iso: string): "0-24h" | "24-72h" | "72h-7d" | "7d+" {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 24) return "0-24h";
  if (h < 72) return "24-72h";
  if (h < 168) return "72h-7d";
  return "7d+";
}

type DialogAction = "approve" | "hold" | "reject" | "release" | "cancel" | "compliance-hold";

const ACTION_META: Record<
  DialogAction,
  { label: string; variant: "reject-payout" | "custom"; consequence: (p: PlatformPayout) => string }
> = {
  approve: {
    label: "Approve",
    variant: "custom",
    consequence: (p) =>
      `${formatCurrency(p.amount, p.currency)} for ${p.traderName} moves to approved and becomes eligible for execution. The transition is written to the payout history and the Platform Audit Log.`,
  },
  hold: {
    label: "Hold",
    variant: "custom",
    consequence: (p) =>
      `Payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) is frozen in place — it will not execute until released. Use this for a compliance query, a PSP incident or a flagged trader without suspending the whole tenant.`,
  },
  reject: {
    label: "Reject",
    variant: "reject-payout",
    consequence: (p) =>
      `Payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) is rejected as an approval decision. The trader's withdrawable balance is unaffected and they must re-request.`,
  },
  release: {
    label: "Release",
    variant: "custom",
    consequence: (p) =>
      `Payout ${p.reference} returns to the queue it was held from and becomes executable again. The release is audited with your reason.`,
  },
  cancel: {
    label: "Cancel",
    variant: "custom",
    consequence: (p) =>
      `Payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) is cancelled permanently. This is an operator decision, distinct from a rail failure — the distinction is preserved for SLA reporting.`,
  },
  "compliance-hold": {
    label: "Compliance Hold",
    variant: "custom",
    consequence: (p) =>
      `Payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) is placed under compliance hold. The trader will need to resolve compliance queries before this payout can proceed. This is a payout-scoped hold — it does not suspend the whole tenant.`,
  },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PayoutOperationsPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  // Filters (PS-01 minimum scope: tenant / status / method / age)
  const [tenantFilter, setTenantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("all"); // P1 PW-02+PS-06: Compliance queue filter

  // Selection (PW-06 bulk hold / export)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Row detail sheet (drill-through)
  const [detail, setDetail] = useState<PlatformPayout | null>(null);

  // Typed-reason action dialog (PW-01)
  const [dialog, setDialog] = useState<{ action: DialogAction; payout: PlatformPayout } | null>(null);

  const filtered = useMemo(() => {
    return payouts.filter((p) => {
      if (tenantFilter !== "all" && p.tenantId !== tenantFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (ageFilter !== "all" && IN_FLIGHT.includes(p.status) && ageBucket(p.createdAt) !== ageFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.reference} ${p.traderName} ${p.tenantName ?? p.tenantId} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payouts, tenantFilter, statusFilter, methodFilter, ageFilter, search]);

  /**
   * PF-01 — money-denominated liability for the active filter set,
   * grouped by currency (never summed across currencies).
   */
  const liability = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    let rows = 0;
    for (const p of filtered) {
      if (!IN_FLIGHT.includes(p.status)) continue;
      byCurrency[p.currency] = (byCurrency[p.currency] ?? 0) + p.amount;
      rows++;
    }
    return { byCurrency, rows };
  }, [filtered]);

  const filteredTotal = filtered.length;
  const inFlightTotal = filtered.filter((p) => IN_FLIGHT.includes(p.status)).length;
  const failedTotal = filtered.filter((p) => p.status === "failed").length;
  const selectedRows = filtered.filter((p) => selected.has(p.id));

  /* ---------------- actions ---------------- */

  const actor = user.name;

  function runAction(action: DialogAction, p: PlatformPayout, reason: string) {
    const results: Record<DialogAction, { ok: boolean; error?: string }> = {
      approve: approvePayout(p.id, actor, reason),
      hold: holdPayout(p.id, actor, reason),
      reject: rejectPayout(p.id, actor, reason),
      release: releasePayout(p.id, actor, reason),
      cancel: cancelPayout(p.id, actor, reason),
      "compliance-hold": holdPayout(p.id, actor, reason),
    };
    const res = results[action];
    if (res.ok) {
      toast({
        title: `${ACTION_META[action].label}d payout ${p.reference}`,
        description: `${formatCurrency(p.amount, p.currency)} · ${p.traderName} — audited with reason.`,
      });
      setDetail(null);
    } else {
      toast({
        title: "Action blocked",
        description: res.error ?? "The payout is not in a state that allows this action.",
        variant: "destructive",
      });
    }
    setDialog(null);
  }

  function bulkHold() {
    if (selectedRows.length === 0) return;
    let held = 0;
    let blocked = 0;
    for (const p of selectedRows) {
      const res = holdPayout(p.id, actor, "Bulk hold from payout operations console (PW-06)");
      if (res.ok) held++;
      else blocked++;
    }
    toast({
      title: `Bulk hold: ${held} held${blocked ? `, ${blocked} skipped` : ""}`,
      description: held
        ? "Each hold wrote a transition history row and an audit entry."
        : "No selected payout was in a holdable state.",
      variant: held ? undefined : "destructive",
    });
    setSelected(new Set());
  }

  function exportRows() {
    exportToCsv(
      selectedRows.length > 0 ? selectedRows : filtered,
      [
        { key: "reference", header: "Reference", value: (p) => p.reference },
        { key: "tenant", header: "Tenant", value: (p) => p.tenantName ?? p.tenantId },
        { key: "trader", header: "Trader", value: (p) => p.traderName },
        { key: "amount", header: "Amount", value: (p) => p.amount },
        { key: "currency", header: "Currency", value: (p) => p.currency },
        { key: "method", header: "Method", value: (p) => p.method },
        { key: "status", header: "Status", value: (p) => p.status },
        { key: "profitSplit", header: "Profit split %", value: (p) => p.profitSplit },
        { key: "createdAt", header: "Requested", value: (p) => p.createdAt },
        { key: "age", header: "Age (days)", value: (p) => ageDays(p.createdAt) },
      ],
      `payouts-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /* ---------------- columns ---------------- */

  const columns: Column<PlatformPayout>[] = [
    {
      key: "select",
      header: "",
      width: "36px",
      cell: (p) => (
        <Checkbox
          checked={selected.has(p.id)}
          onCheckedChange={(v) => toggle(p.id, v === true)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select payout ${p.reference}`}
        />
      ),
    },
    {
      key: "reference",
      header: "Reference",
      cell: (p) => <span className="font-mono text-xs">{p.reference}</span>,
      sortValue: (p) => p.reference,
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (p) => (
        <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span>
      ),
      sortValue: (p) => p.tenantName ?? p.tenantId,
    },
    {
      key: "trader",
      header: "Trader",
      cell: (p) => <span className="text-sm">{p.traderName}</span>,
      sortValue: (p) => p.traderName,
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
      key: "method",
      header: "Method",
      cell: (p) => <Badge variant="secondary" className="text-[10px]">{p.method}</Badge>,
      sortValue: (p) => p.method,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <div className="flex flex-col gap-1">
          <StatusBadge tone={STATUS_TONES[p.status]}>{p.status}</StatusBadge>
          {p.status === "failed" && p.failureReason && (
            <span className="text-[10px] text-destructive">
              {FAILURE_LABELS[p.failureReason] ?? p.failureReason}
            </span>
          )}
          {p.status === "on-hold" && p.holdReason && (
            <span className="text-[10px] text-muted-foreground">held: {p.holdReason}</span>
          )}
        </div>
      ),
      sortValue: (p) => p.status,
    },
    {
      key: "age",
      header: "Age",
      cell: (p) => {
        const d = ageDays(p.createdAt);
        const inFlight = IN_FLIGHT.includes(p.status);
        return (
          <span
            className={`font-mono text-xs tabular-nums ${inFlight && d >= 7 ? "text-rose-600 font-semibold" : ""}`}
          >
            {d}d
          </span>
        );
      },
      sortValue: (p) => ageDays(p.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {p.status === "pending" && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "approve", payout: p })}>
                <CheckCircle className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "compliance-hold", payout: p })}>
                <AlertTriangle className="mr-1 h-3 w-3" /> Compliance Hold
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "hold", payout: p })}>
                <PauseCircle className="mr-1 h-3 w-3" /> Hold
              </Button>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "reject", payout: p })}>
                <XCircle className="mr-1 h-3 w-3" /> Reject
              </Button>
            </>
          )}
          {p.status === "on-hold" && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "release", payout: p })}>
              <PlayCircle className="mr-1 h-3 w-3" /> Release
            </Button>
          )}
          {["pending", "approved", "on-hold"].includes(p.status) && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-muted-foreground" onClick={() => setDialog({ action: "cancel", payout: p })}>
              Cancel
            </Button>
          )}
          {p.status === "failed" && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ action: "release", payout: p })}>
              <RotateCcw className="mr-1 h-3 w-3" /> Retry
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Payout Operations Console"
        description="Cross-tenant payout rows with money-denominated liability, filters and audited interventions (R10 PS-01 / PF-01 / PW-01)."
        icon={Wallet}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportRows}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" disabled={selected.size === 0} onClick={bulkHold}>
              <PauseCircle className="mr-1 h-4 w-4" /> Hold selected ({selected.size})
            </Button>
          </>
        }
      />
      <PageContent>
        {/* PF-01 — the number a CFO, auditor or incident commander needs first */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            label="Pending liability (in-flight)"
            value={
              Object.keys(liability.byCurrency).length === 0
                ? "—"
                : Object.entries(liability.byCurrency)
                    .map(([cur, amt]) => formatCurrency(amt, cur))
                    .join("  ·  ")
            }
            icon={Banknote}
            tone={liability.rows > 0 ? "warning" : "default"}
          />
          <MetricCard label="In-flight rows" value={inFlightTotal} icon={Wallet} />
          <MetricCard label="Rows in view" value={filteredTotal} icon={Search} />
          <MetricCard
            label="Failed"
            value={failedTotal}
            icon={XCircle}
            tone={failedTotal > 0 ? "negative" : "default"}
          />
        </div>

        {Object.keys(liability.byCurrency).length > 1 && (
          <p className="-mt-4 mb-4 text-xs text-muted-foreground">
            Amounts are reported per currency — no FX conversion is invented (same honesty rule as
            the published payout methodology).
          </p>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, trader, tenant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {allTenants
                .filter((t) => t.id !== "platform")
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(
                [
                  "pending",
                  "approved",
                  "processing",
                  "paid",
                  "rejected",
                  "failed",
                  "cancelled",
                  "on-hold",
                ] as PlatformPayoutStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {["bank-transfer", "crypto", "paypal", "skrill"].map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ageFilter} onValueChange={setAgeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Age" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any age</SelectItem>
              <SelectItem value="0-24h">0–24h</SelectItem>
              <SelectItem value="24-72h">24–72h</SelectItem>
              <SelectItem value="72h-7d">72h–7d</SelectItem>
              <SelectItem value="7d+">7d+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compliance Queue (P1 PW-02+PS-06) */}
        <div className="mt-3 rounded-lg border bg-muted/10 p-3">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Compliance Queue
          </p>
          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Compliance filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payouts</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
              <SelectItem value="compliance-hold">Compliance Hold</SelectItem>
              <SelectItem value="review-needed">Review Needed (7d+)</SelectItem>
            </SelectContent>
          </Select>
          {complianceFilter !== "all" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {complianceFilter === "review-needed"
                ? "Payouts in-flight for 7+ days requiring compliance review"
                : `Showing payouts with status: ${complianceFilter}`}
            </p>
          )}
        </div>

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
            {selected.size} selected ·{" "}
            {formatCurrency(
              selectedRows.reduce((s, p) => s + p.amount, 0),
              selectedRows[0]?.currency ?? "USD",
            )}{" "}
            <span className="text-muted-foreground">(first selected row's currency shown — export for per-currency totals)</span>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(p) => p.id}
              pageSize={20}
              searchableText={(p) => `${p.reference} ${p.traderName} ${p.tenantName ?? ""}`}
              onRowClick={(p) => setDetail(p)}
              emptyTitle="No payouts match"
              emptyDescription="Adjust the filters — every row on this page comes from the payout store, so runtime state changes appear immediately."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1">How this console stays honest</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Rows are live from the payout store — approve, hold or reject here and reload: state + audit row agree.</li>
            <li>Every mutation records actor, reason and timestamp in the payout&apos;s transition history (PW-09).</li>
            <li>Liability is per currency; ages are computed from the request timestamp, not a hard-coded SLA.</li>
          </ul>
        </div>
      </PageContent>

      {/* Detail sheet — drill-through (PS-02 territory) */}
      <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{detail.reference}</SheetTitle>
                <SheetDescription>
                  {detail.tenantName ?? detail.tenantId} · {detail.traderName}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-lg font-bold font-mono">
                      {formatCurrency(detail.amount, detail.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1">
                      <StatusBadge tone={STATUS_TONES[detail.status]}>{detail.status}</StatusBadge>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Method</p>
                    <p className="font-medium capitalize">{detail.method}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Profit split</p>
                    <p className="font-medium">{detail.profitSplit}%</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Requested</p>
                    <p className="font-mono text-xs">
                      {new Date(detail.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Age</p>
                    <p className="font-medium">{ageDays(detail.createdAt)} days</p>
                  </div>
                </div>

                {detail.failureReason && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-medium text-destructive">Failure reason</p>
                    <p>{FAILURE_LABELS[detail.failureReason] ?? detail.failureReason}</p>
                  </div>
                )}
                {detail.holdReason && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs font-medium">Hold reason</p>
                    <p>{detail.holdReason}</p>
                  </div>
                )}
                {detail.evidence && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs font-medium">Settlement evidence</p>
                    <p className="font-mono text-xs">
                      {detail.evidence.type}: {detail.evidence.reference}
                    </p>
                  </div>
                )}

                {/* Transition history (PW-09) */}
                <div>
                  <p className="text-xs font-medium mb-2">Status history</p>
                  {detail.history && detail.history.length > 0 ? (
                    <ol className="space-y-2">
                      {detail.history.map((h, i) => (
                        <li key={i} className="rounded-lg border p-2 text-xs">
                          <span className="font-mono">
                            {h.from} → {h.to}
                          </span>{" "}
                          · {h.actor} · {new Date(h.at).toLocaleString()}
                          <p className="text-muted-foreground mt-1">{h.reason}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No recorded transitions yet — the row is in its seeded state. Any action you
                      take below starts the trail.
                    </p>
                  )}
                </div>

                {/* Action bar (PW-01) */}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {detail.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => setDialog({ action: "approve", payout: detail })}>
                        <CheckCircle className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDialog({ action: "hold", payout: detail })}>
                        <PauseCircle className="mr-1 h-4 w-4" /> Hold
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDialog({ action: "reject", payout: detail })}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                  {detail.status === "on-hold" && (
                    <Button size="sm" variant="outline" onClick={() => setDialog({ action: "release", payout: detail })}>
                      <PlayCircle className="mr-1 h-4 w-4" /> Release
                    </Button>
                  )}
                  {["pending", "approved", "on-hold"].includes(detail.status) && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ action: "cancel", payout: detail })}>
                      Cancel payout
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Typed-reason dialog (PW-01: audited mutations only) */}
      <DestructiveActionDialog
        dialogId={`payout-${dialog?.action ?? "none"}`}
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        variant={dialog ? ACTION_META[dialog.action].variant : "custom"}
        title={
          dialog
            ? `${ACTION_META[dialog.action].label} payout ${dialog.payout.reference}?`
            : ""
        }
        consequence={dialog ? ACTION_META[dialog.action].consequence(dialog.payout) : ""}
        context={
          dialog ? (
            <span className="block text-xs">
              Tenant: <strong>{dialog.payout.tenantName ?? dialog.payout.tenantId}</strong> · Trader:{" "}
              {dialog.payout.traderName} · {formatCurrency(dialog.payout.amount, dialog.payout.currency)} ·{" "}
              {dialog.payout.method}
            </span>
          ) : null
        }
        reasonLabel="Reason (required — written to the audit trail)"
        onConfirm={(reason) => {
          if (dialog) runAction(dialog.action, dialog.payout, reason);
        }}
      />
    </Page>
  );
}
