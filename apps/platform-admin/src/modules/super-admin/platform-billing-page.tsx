"use client";

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { useInvoices, type Invoice } from "@/lib/platform/invoice-store";
import { useDunningRecords, escalateDunning, sendReminder, suspendTenant, reinstateTenant, type DunningRecord, type DunningStatus } from "@/lib/platform/dunning-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { Download, AlertCircle, CreditCard, AlertTriangle, RotateCcw, FileText, Ban, Play } from "lucide-react";

export function PlatformBillingPage() {
  const { navigate, pushNotification } = usePlatform();
  const plans = usePlans();
  const dunningRecords = useDunningRecords();
  const invoices = useInvoices();

  // Build billing records from the real invoice store (P0-1).
  const records = invoices.map((inv) => ({
    id: inv.invoiceNumber,
    tenantName: inv.tenantName,
    tenantId: inv.tenantId,
    plan: inv.lines[0]?.description ?? "",
    amount: inv.total,
    currency: inv.currency,
    status: inv.status,
    due: inv.dueDate,
    generated: inv.issueDate,
    method: inv.status === "paid" ? "Card" : "—",
    overdueDays: inv.status === "past due" 
      ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000))
      : 0,
    invoiceId: inv.id as string | undefined,
  }));

  // Separate dunning overdue records for KPI count
  const dunningOverdue = dunningRecords.filter((r) => r.status === "pastDue" || r.status === "overdue");
  const pastDue = records.filter((r) => r.status === "past due").concat(
    dunningOverdue.map((d) => ({
      id: d.invoiceNumber,
      tenantName: d.tenantName,
      tenantId: d.tenantId,
      plan: "",
      amount: d.amount,
      currency: "USD",
      status: "past due" as const,
      due: d.lastReminderAt,
      generated: d.lastReminderAt,
      method: "",
      overdueDays: d.daysOverdue,
      invoiceId: undefined as string | undefined,
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
        {(isPastDue || isOverdue) && (
          <>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => sendReminder(record.tenantId)}>
              <AlertCircle className="h-3 w-3" /> Remind
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => escalateDunning(record.tenantId)}>
              <AlertTriangle className="h-3 w-3" /> Escalate
            </Button>
          </>
        )}
        {isOverdue && (
          <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={() => suspendTenant(record.tenantId, "Payment overdue")}>
            <Ban className="h-3 w-3" /> Suspend
          </Button>
        )}
        {isSuspended && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => reinstateTenant(record.tenantId)}>
            <Play className="h-3 w-3" /> Reinstate
          </Button>
        )}
      </div>
    );
  };

  // Build invoice actions
  const invoiceActions = (record: typeof records[0]) => {
    return (
      <div className="flex items-center gap-1">
        {record.invoiceId && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => navigate("invoice-detail", { id: record.invoiceId! })}>
            <FileText className="h-3 w-3" /> View
          </Button>
        )}
      </div>
    );
  };

  const columns: Column<typeof records[0]>[] = [
    { key: "id", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium text-xs">{r.tenantName}</span>, sortValue: (r) => r.tenantName },
    { key: "plan", header: "Plan", cell: (r) => <Badge variant="outline" className="text-[10px] capitalize">{r.plan}</Badge>, sortValue: (r) => r.plan },
    { key: "amount", header: "Amount", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.amount, r.currency)}</span>, sortValue: (r) => r.amount, numeric: true },
    { key: "due", header: "Due", cell: (r) => <span className="text-xs">{new Date(r.due).toLocaleDateString()}</span>, sortValue: (r) => r.due },
    { key: "status", header: "Status", cell: (r) => <StatusBadge tone={r.status === "paid" ? "success" : r.status === "sent" || r.status === "draft" ? "warning" : r.status === "disputed" ? "info" : "danger"}>{r.status}</StatusBadge>, sortValue: (r) => r.status },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => toast({ title: "Invoice PDF", description: `${r.id} for ${r.tenantName} — PDF download.` })}>
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Invoices (30d)</p><p className="text-2xl font-bold">{records.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Paid revenue</p><p className="text-2xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold">{records.filter((r) => r.status === "draft" || r.status === "sent").length}</p></CardContent></Card>
          <Card className={pastDue.length > 0 ? "border-red-200 bg-red-50/40" : ""}><CardContent className="pt-6"><p className="text-xs text-muted-foreground flex items-center gap-1">Overdue <AlertCircle className="h-3 w-3 text-red-600" /></p><p className="text-2xl font-bold text-red-700">{pastDue.length}</p></CardContent></Card>
        </div>

        {pastDue.length > 0 && (
          <Card className="mb-6 border-red-200 bg-red-50/30">
            <CardHeader className="pb-2"><span className="text-sm font-medium text-red-800">Overdue payments — action required</span></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pastDue.map((r) => {
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
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => toast({ title: "Reminder sent", description: `Payment reminder for ${r.id} (${r.tenantName}).` })}>Remind</Button>
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
              onRowClick={(r) => r.invoiceId && navigate("invoice-detail", { id: r.invoiceId })}
              searchableText={(r) => `${r.id} ${r.tenantName} ${r.status}`}
              searchPlaceholder="Search invoices…"
              pageSize={10}
              emptyTitle="No invoices yet"
              emptyDescription="Invoices appear after the first billing cycle."
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
