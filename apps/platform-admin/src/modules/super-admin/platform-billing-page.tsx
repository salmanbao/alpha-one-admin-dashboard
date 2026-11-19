"use client";

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { Download, AlertCircle, CreditCard, AlertTriangle, RotateCcw } from "lucide-react";
import { useDunningRecords, escalateDunning, sendReminder, suspendTenant, reinstateTenant, type DunningRecord, type DunningStatus } from "@/lib/platform/dunning-store";

interface BillingRecord {
  id: string;
  tenantName: string;
  tenantId: string;
  plan: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "past due" | "disputed";
  due: string;
  generated: string;
  method: string;
  overdueDays: number;
}

export function PlatformBillingPage() {
  // R4-06: plan prices come from the shared catalog (component scope —
  // the mock loader runs outside render, so hooks can't live in it).
  const plans = usePlans();
  const dunningRecords = useDunningRecords();
  const {
    data: records = [],
    loading,
    error,
    retry,
  } = useAsyncMock(
    () =>
      mockAsync(() => {
        const out: BillingRecord[] = [];
        allTenants.filter((t) => t.id !== "platform").forEach((t) => {
          const seed = t.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
          const count = 3 + (seed % 3);
          for (let i = 0; i < count; i++) {
            const status = i === 0 ? (seed % 7 === 0 ? "past due" : "pending") : (seed + i) % 9 === 0 ? "disputed" : "paid";
            const generated = new Date(Date.now() - (i + 1) * 30 * 86400000);
            const due = new Date(generated.getTime() + 14 * 86400000);
            const amount = (t.plan === "enterprise" ? plans.find(p => p.id === "enterprise")?.priceMonthly ?? 890 : t.plan === "scale" ? plans.find(p => p.id === "scale")?.priceMonthly ?? 890 : 890) + Math.round(seed * 12 + i * 7);
            out.push({
              id: `INV-${generated.getFullYear()}-${String(generated.getMonth() + 1).padStart(2, "0")}-${String(((seed + i * 37) % 900) + 100)}`,
              tenantName: t.name,
              tenantId: t.id,
              plan: t.plan,
              amount,
              currency: t.currency,
              status,
              due: due.toISOString(),
              generated: generated.toISOString(),
              method: ["Card", "ACH", "Wire transfer"][i % 3],
              overdueDays: status === "past due" ? Math.round((Date.now() - due.getTime()) / 86400000) : 0,
            });
          }
        });
        return out;
      }, { delayMs: 350 }),
    [],
  );

  // Separate dunning overdue records for KPI count
  const dunningOverdue = dunningRecords.filter((r) => r.status === "pastDue" || r.status === "overdue");
  const pastDue = records.filter((r) => r.status === "past due").concat(
    dunningOverdue.map((d) => ({
      id: d.invoiceNumber,
      tenantName: d.tenantName,
      tenantId: d.tenantId,
      plan: "", // dunning records don't have plan
      amount: d.amount,
      currency: "USD",
      status: d.status === "overdue" ? "past due" : "past due",
      due: d.lastReminderAt,
      generated: d.lastReminderAt,
      method: "",
      overdueDays: d.daysOverdue,
    }))
  );
  const totalRevenue = records.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  
  // Build dunning actions based on status
  const dunningActions = (record: DunningRecord) => {
    const isPastDue = record.status === "pastDue";
    const isOverdue = record.status === "overdue";
    const isSuspended = record.status === "suspended";
    const isCancelled = record.status === "cancelled";
    
    return (
      <div className="flex items-center gap-1">
        {isPastDue && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={() => {
              const result = sendReminder(record.id);
              toast({ title: result.title, description: result.description });
            }}
          >
            <RotateCcw className="h-3 w-3 mr-0.5" /> Remind
          </Button>
        )}
        {isOverdue && (
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-xs"
            onClick={() => {
              const result = escalateDunning(record.id);
              toast({ title: result.title, description: result.description });
            }}
          >
            <AlertTriangle className="h-3 w-3 mr-0.5" /> Escalate
          </Button>
        )}
        {isSuspended && (
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-xs"
            onClick={() => {
              const result = reinstateTenant(record.id);
              toast({ title: result.title, description: result.description });
            }}
          >
            <RotateCcw className="h-3 w-3 mr-0.5" /> Reinstate
          </Button>
        )}
        {isCancelled && (
          <span className="text-xs text-muted-foreground">Cancelled</span>
        )}
        {(!isCancelled && !isSuspended) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => toast({ title: "Invoice PDF", description: `${record.invoiceNumber} for ${record.tenantName} — PDF download (demo).` })}
          >
            <Download className="h-3 w-3 mr-0.5" /> PDF
          </Button>
        )}
      </div>
    );
  };

  const columns: Column<BillingRecord>[] = [
    { key: "id", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium text-xs">{r.tenantName}</span>, sortValue: (r) => r.tenantName },
    { key: "plan", header: "Plan", cell: (r) => <Badge variant="outline" className="text-[10px] capitalize">{r.plan}</Badge>, sortValue: (r) => r.plan },
    { key: "amount", header: "Amount", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.amount, r.currency)}</span>, sortValue: (r) => r.amount, numeric: true },
    { key: "due", header: "Due", cell: (r) => <span className="text-xs">{new Date(r.due).toLocaleDateString()}</span>, sortValue: (r) => r.due },
    { key: "status", header: "Status", cell: (r) => <StatusBadge tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : r.status === "disputed" ? "info" : "danger"}>{r.status}</StatusBadge>, sortValue: (r) => r.status },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => toast({ title: "Invoice PDF", description: `${r.id} for ${r.tenantName} — PDF download (demo).` })}>
            <Download className="h-3 w-3 mr-0.5" /> PDF
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Billing & Invoices" description="Subscription billing, invoice tracking, and payment status across all tenants." icon={CreditCard} />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={records.length > 0}
          loadingLabel="Loading billing records…"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Invoices (30d)</p><p className="text-2xl font-bold">{records.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Paid revenue</p><p className="text-2xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold">{records.filter((r) => r.status === "pending").length}</p></CardContent></Card>
            <Card className={pastDue.length > 0 ? "border-red-200 bg-red-50/40" : ""}><CardContent className="pt-6"><p className="text-xs text-muted-foreground flex items-center gap-1">Overdue <AlertCircle className="h-3 w-3 text-red-600" /></p><p className="text-2xl font-bold text-red-700">{pastDue.length}</p></CardContent></Card>
          </div>

          {pastDue.length > 0 && (
            <Card className="mb-6 border-red-200 bg-red-50/30">
              <CardHeader className="pb-2"><span className="text-sm font-medium text-red-800">Overdue payments — action required</span></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastDue.map((r) => {
                    // Check if this is a dunning record or billing record
                    const dunningRecord = dunningRecords.find((dr) => dr.tenantId === r.tenantId && dr.invoiceNumber === r.id);
                    if (dunningRecord) {
                      return (
                        <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 border text-xs">
                          <div>
                            <span className="font-medium">{r.id}</span> — <span>{r.tenantName}</span> ({r.plan})
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold tabular-nums">{formatCurrency(r.amount, r.currency)}</span>
                            <span className="text-red-700 font-semibold">{r.overdueDays}d overdue</span>
                            {dunningActions(dunningRecord)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 border text-xs">
                        <div>
                          <span className="font-medium">{r.id}</span> — <span>{r.tenantName}</span> ({r.plan})
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold tabular-nums">{formatCurrency(r.amount, r.currency)}</span>
                          <span className="text-red-700 font-semibold">{r.overdueDays}d overdue</span>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => toast({ title: "Reminder sent", description: `Payment reminder for ${r.id} (${r.tenantName}) — demo.` })}>Remind</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Invoice ledger</span></CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={records}
                rowKey={(r) => r.id}
                searchableText={(r) => `${r.id} ${r.tenantName} ${r.status}`}
                searchPlaceholder="Search invoices…"
                pageSize={10}
                emptyTitle="No invoices yet"
                emptyDescription="Invoices appear after the first billing cycle."
              />
            </CardContent>
          </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
