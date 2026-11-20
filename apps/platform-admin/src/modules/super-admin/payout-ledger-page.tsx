"use client";

/**
 * Payout Money-Movement Ledger — R10 PS-08.
 *
 * Append-only journal of payout entries: request, hold, release, approve,
 * execute, fail, retry, clawback — each with actor, timestamp, reason and
 * amount, in payout currency. Complements R9 B-20 (billing-side edit
 * ledger) and becomes the reconciliation source for PS-04 and the evidence
 * base for PU-03.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  useLedger,
  readLedger,
  getLedgerTotals,
  type PayoutLedgerEntry,
  type PayoutLedgerEntryType,
} from "@/lib/platform/payout-ledger";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import {
  ArrowRight,
  Download,
  Filter,
  X,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/components/platform/status";

const TYPE_LABELS: Record<PayoutLedgerEntryType, string> = {
  request: "Request",
  hold: "Hold",
  release: "Release",
  approve: "Approve",
  execute: "Execute",
  fail: "Fail",
  retry: "Retry",
  clawback: "Clawback",
  reissue: "Re-issue",
  evidence: "Evidence",
  note: "Note",
  beneficiary: "Beneficiary",
};

const TYPE_TONES: Record<PayoutLedgerEntryType, "success" | "info" | "warning" | "destructive" | "default"> = {
  request: "info",
  hold: "warning",
  release: "success",
  approve: "info",
  execute: "success",
  fail: "destructive",
  retry: "info",
  clawback: "destructive",
  reissue: "info",
  evidence: "default",
  note: "default",
  beneficiary: "default",
};

function ageMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function PayoutLedgerPage() {
  const { user } = usePlatform();
  const entries = useLedger();

  // Filters
  const [tenantFilter, setTenantFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (tenantFilter !== "all" && e.tenantId !== tenantFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${e.reference} ${e.traderName} ${e.tenantId} ${e.id} ${e.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom && e.at < dateFrom) return false;
      if (dateTo && e.at > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [entries, tenantFilter, typeFilter, search, dateFrom, dateTo]);

  const totals = useMemo(() => getLedgerTotals(tenantFilter === "all" ? undefined : tenantFilter), [tenantFilter]);

  const totalNet = Object.values(totals.byCurrency).reduce((s, b) => s + b.net, 0);
  const totalIn = Object.values(totals.byCurrency).reduce((s, b) => s + b.in, 0);
  const totalOut = Object.values(totals.byCurrency).reduce((s, b) => s + b.out, 0);

  function exportCsv() {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Entry ID", value: (e) => e.id },
        { key: "at", header: "Timestamp", value: (e) => new Date(e.at).toLocaleString() },
        { key: "type", header: "Type", value: (e) => TYPE_LABELS[e.type] },
        { key: "payoutId", header: "Payout ID", value: (e) => e.payoutId },
        { key: "reference", header: "Reference", value: (e) => e.reference },
        { key: "tenant", header: "Tenant", value: (e) => allTenants.find(t => t.id === e.tenantId)?.name ?? e.tenantId },
        { key: "trader", header: "Trader", value: (e) => e.traderName },
        { key: "currency", header: "Currency", value: (e) => e.currency },
        { key: "signedAmount", header: "Signed Amount", value: (e) => e.signedAmount },
        { key: "fromStatus", header: "From Status", value: (e) => e.fromStatus ?? "—" },
        { key: "toStatus", header: "To Status", value: (e) => e.toStatus ?? "—" },
        { key: "actor", header: "Actor", value: (e) => e.actor },
        { key: "reason", header: "Reason", value: (e) => e.reason },
      ],
      `payout-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const columns: Column<PayoutLedgerEntry>[] = [
    {
      key: "at",
      header: "Time",
      cell: (e) => <span className="font-mono text-xs tabular-nums">{new Date(e.at).toLocaleString()}</span>,
      sortValue: (e) => e.at,
    },
    {
      key: "type",
      header: "Type",
      cell: (e) => (
        <Badge variant="outline" className={`text-[10px] ${TYPE_TONES[e.type] === "destructive" ? "border-destructive/40 text-destructive" : TYPE_TONES[e.type] === "success" ? "border-green-400 text-green-700" : TYPE_TONES[e.type] === "warning" ? "border-amber-400 text-amber-700" : ""}`}>
          {TYPE_LABELS[e.type]}
        </Badge>
      ),
      sortValue: (e) => e.type,
    },
    {
      key: "reference",
      header: "Reference",
      cell: (e) => <span className="font-mono text-xs">{e.reference}</span>,
      sortValue: (e) => e.reference,
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (e) => (
        <span className="text-sm font-medium">
          {allTenants.find(t => t.id === e.tenantId)?.name ?? e.tenantId}
        </span>
      ),
      sortValue: (e) => allTenants.find(t => t.id === e.tenantId)?.name ?? e.tenantId,
    },
    {
      key: "trader",
      header: "Trader",
      cell: (e) => <span className="text-sm">{e.traderName}</span>,
      sortValue: (e) => e.traderName,
    },
    {
      key: "currency",
      header: "Currency",
      cell: (e) => <span className="font-mono text-xs">{e.currency}</span>,
    },
    {
      key: "signedAmount",
      header: "Amount",
      numeric: true,
      cell: (e) => (
        <span className={`font-mono text-sm tabular-nums ${e.signedAmount < 0 ? "text-destructive" : "text-emerald-600"}`}>
          {e.signedAmount >= 0 ? "+" : ""}{formatCurrency(Math.abs(e.signedAmount), e.currency)}
        </span>
      ),
      sortValue: (e) => e.signedAmount,
    },
    {
      key: "status",
      header: "Status Transition",
      cell: (e) => (
        <span className="text-xs text-muted-foreground">
          {e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus ?? "—"}
        </span>
      ),
      sortValue: (e) => e.fromStatus ?? "",
    },
    {
      key: "actor",
      header: "Actor",
      cell: (e) => <span className="text-sm">{e.actor}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (e) => <span className="text-sm max-w-xs truncate block" title={e.reason}>{e.reason}</span>,
    },
  ];

  const hasAnyFilter = tenantFilter !== "all" || typeFilter !== "all" || search || dateFrom || dateTo;

  return (
    <Page>
      <PageHeader
        title="Payout Money-Movement Ledger"
        description="Append-only journal of payout entries — request, hold, release, approve, execute, fail, retry, clawback. Per-currency totals, never summed across currencies (R10 PS-08)."
        icon={ArrowRight}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* Totals — per currency, honest (no FX) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <MetricCard
            label="Total entries"
            value={totals.totalEntries}
            icon={Search}
          />
          <MetricCard
            label="Net money movement"
            value={
              Object.keys(totals.byCurrency).length === 0
                ? "—"
                : Object.entries(totals.byCurrency)
                    .map(([cur, b]) => formatCurrency(b.net, cur))
                    .join("  ·  ")
            }
            icon={ArrowRight}
            tone={totalNet < 0 ? "negative" : totalNet > 0 ? "positive" : "default"}
          />
          <MetricCard
            label="Inflow"
            value={
              Object.keys(totals.byCurrency).length === 0
                ? "—"
                : Object.entries(totals.byCurrency)
                    .map(([cur, b]) => formatCurrency(b.in, cur))
                    .join("  ·  ")
            }
            icon={ArrowRight}
            tone="positive"
          />
          <MetricCard
            label="Outflow"
            value={
              Object.keys(totals.byCurrency).length === 0
                ? "—"
                : Object.entries(totals.byCurrency)
                    .map(([cur, b]) => formatCurrency(b.out, cur))
                    .join("  ·  ")
            }
            icon={ArrowRight}
            tone="negative"
          />
          <MetricCard
            label="Currencies"
            value={Object.keys(totals.byCurrency).length}
            icon={Search}
          />
        </div>

        {Object.keys(totals.byCurrency).length > 1 && (
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
              placeholder="Search reference, trader, tenant, reason…"
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(["request", "hold", "release", "approve", "execute", "fail", "retry", "clawback", "reissue", "evidence", "note", "beneficiary"] as PayoutLedgerEntryType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="w-[150px]"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="w-[150px]"
            />
          </div>
        </div>

        {hasAnyFilter && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filters active</span>
            <Button variant="ghost" size="sm" onClick={() => { setTenantFilter("all"); setTypeFilter("all"); setSearch(""); setDateFrom(""); setDateTo(""); }}>
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Ledger Entries ({filtered.length} / {entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              pageSize={25}
              searchableText={(e) => `${e.reference} ${e.traderName} ${e.reason}`}
              emptyTitle="No ledger entries"
              emptyDescription="Entries appear when payouts are created, approved, held, executed, failed, retried, clawed back, or annotated."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <ArrowRight className="h-4 w-4" /> What this ledger guarantees
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Append-only — entries are never edited or deleted, only added.</li>
            <li>Every payout mutation (approve, hold, execute, fail, retry, clawback, reissue, evidence, note, beneficiary) writes a matching ledger row.</li>
            <li>Signed amounts: positive for inflows (request, approve, execute, retry, reissue), negative for outflows (clawback, fail as reversal).</li>
            <li>Per-currency totals — no FX conversion is invented; the honest methodology applies.</li>
            <li>Reconciliation source for provider health (PS-04) and auditor evidence packs (PU-03).</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}

// Need to import Select components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";