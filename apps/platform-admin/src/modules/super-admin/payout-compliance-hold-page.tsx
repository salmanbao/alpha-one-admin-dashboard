"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  usePayouts,
  releasePayout,
  type PlatformPayout,
  type PlatformPayoutStatus,
} from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { Download, AlertTriangle, Gavel, PlayCircle, Clock, Search } from "lucide-react";

const IN_FLIGHT: PlatformPayoutStatus[] = ["pending", "approved", "processing", "on-hold"];

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function PayoutComplianceHoldPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [holdTypeFilter, setHoldTypeFilter] = useState("all");

  const onHold = useMemo(
    () => payouts.filter((p) => p.status === "on-hold"),
    [payouts],
  );

  const complianceHolds = useMemo(
    () => payouts.filter((p) => p.holdReason?.toLowerCase().includes("compliance") || p.holdReason?.toLowerCase().includes("kyc") || p.holdReason?.toLowerCase().includes("aml")),
    [payouts],
  );

  const pendingReview = useMemo(
    () => payouts.filter(
      (p) => IN_FLIGHT.includes(p.status) && 
      !p.holdReason && 
      ageDays(p.createdAt) >= 7
    ),
    [payouts],
  );

  const filtered = useMemo(() => {
    let base = onHold;
    if (holdTypeFilter === "compliance") base = complianceHolds;
    if (holdTypeFilter === "review-needed") base = pendingReview;

    return base.filter((p) => {
      if (tenantFilter !== "all" && p.tenantId !== tenantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.reference} ${p.traderName} ${p.tenantName ?? p.tenantId} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [onHold, complianceHolds, pendingReview, tenantFilter, holdTypeFilter, search]);

  const totalOnHold = onHold.length;
  const totalCompliance = complianceHolds.length;
  const totalReview = pendingReview.length;
  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);
  const byCurrency = filtered.reduce((acc, p) => {
    acc[p.currency] = (acc[p.currency] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  function release(p: PlatformPayout, reason: string) {
    const res = releasePayout(p.id, user.name, reason);
    if (res.ok) {
      toast({
        title: `Released ${p.reference}`,
        description: `${formatCurrency(p.amount, p.currency)} returned to queue — audited with reason.`,
      });
    } else {
      toast({
        title: "Release blocked",
        description: res.error ?? "Payout is not on hold.",
        variant: "destructive",
      });
    }
  }

  function exportCsv() {
    exportToCsv(
      filtered,
      [
        { key: "reference", header: "Reference", value: (p) => p.reference },
        { key: "tenant", header: "Tenant", value: (p) => p.tenantName ?? p.tenantId },
        { key: "trader", header: "Trader", value: (p) => p.traderName },
        { key: "amount", header: "Amount", value: (p) => p.amount },
        { key: "currency", header: "Currency", value: (p) => p.currency },
        { key: "method", header: "Method", value: (p) => p.method },
        { key: "holdReason", header: "Hold Reason", value: (p) => p.holdReason ?? "—" },
        { key: "age", header: "Age (days)", value: (p) => ageDays(p.createdAt) },
      ],
      `compliance-holds-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const columns: Column<PlatformPayout>[] = [
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
      cell: (p) => <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(p.amount, p.currency)}</span>,
      sortValue: (p) => p.amount,
    },
    {
      key: "method",
      header: "Method",
      cell: (p) => <Badge variant="secondary" className="text-[10px]">{p.method}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => {
        const tone = p.status === "on-hold" ? "warning" : p.status === "pending" ? "info" : "default";
        return <StatusBadge tone={tone}>{p.status}</StatusBadge>;
      },
    },
    {
      key: "holdReason",
      header: "Hold Reason",
      cell: (p) => (
        <span className="text-sm max-w-xs truncate block text-muted-foreground" title={p.holdReason ?? "—"}>
          {p.holdReason ?? "—"}
        </span>
      ),
    },
    {
      key: "age",
      header: "Age",
      cell: (p) => (
        <span className={`font-mono text-xs tabular-nums ${IN_FLIGHT.includes(p.status) && ageDays(p.createdAt) >= 7 ? "text-rose-600 font-semibold" : ""}`}>
          {ageDays(p.createdAt)}d
        </span>
      ),
      sortValue: (p) => ageDays(p.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <div className="flex items-center gap-1">
          {p.status === "on-hold" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px]"
              onClick={() => {
                const reason = prompt(`Release ${p.reference}? Reason required:`);
                if (reason) release(p, reason);
              }}
            >
              <PlayCircle className="mr-1 h-3 w-3" /> Release
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Payout Compliance Hold Queue"
        description="Payouts on hold for compliance, KYC, or AML review — and in-flight payouts exceeding 7 days requiring review. (R10 PS-06)"
        icon={Gavel}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard label="On Hold" value={totalOnHold} icon={AlertTriangle} tone={totalOnHold > 0 ? "warning" : "default"} />
          <MetricCard label="Compliance Holds" value={totalCompliance} icon={Gavel} tone={totalCompliance > 0 ? "negative" : "default"} />
          <MetricCard label="Review Needed (7d+)" value={totalReview} icon={Clock} tone={totalReview > 0 ? "warning" : "default"} />
          <MetricCard
            label="Total Amount"
            value={Object.keys(byCurrency).length === 0 ? "—" : Object.entries(byCurrency).map(([c, a]) => formatCurrency(a, c)).join(" · ")}
            icon={Clock}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search reference, trader, tenant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className="border rounded px-3 py-2 text-sm w-[180px]">
            <option value="all">All tenants</option>
            {allTenants.filter((t) => t.id !== "platform").map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={holdTypeFilter} onChange={(e) => setHoldTypeFilter(e.target.value)} className="border rounded px-3 py-2 text-sm w-[180px]">
            <option value="all">All holds</option>
            <option value="compliance">Compliance/KYC/AML</option>
            <option value="review-needed">Review Needed (7d+)</option>
          </select>
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(p) => p.id}
              pageSize={20}
              searchableText={(p) => `${p.reference} ${p.traderName} ${p.tenantName ?? ""}`}
              emptyTitle="No payouts on hold"
              emptyDescription="No payouts match the current filters."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <Gavel className="h-4 w-4" /> Compliance Hold Queue — Scope
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Compliance holds: payouts explicitly placed on hold for compliance, KYC, or AML reasons.</li>
            <li>Review needed: in-flight payouts older than 7 days with no hold reason — potential SLA breach (PW-07).</li>
            <li>Release action writes an audit row and returns the payout to its prior queue stage.</li>
            <li>This queue is distinct from R9's legal-hold console, which scopes data/audit artifacts, not money movement.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}