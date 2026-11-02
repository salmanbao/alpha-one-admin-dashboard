"use client";

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { tenants as allTenants, getTenantTraders } from "@/lib/platform/mock-data";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { FileText, Download, AlertCircle, CreditCard, Receipt, Clock, CheckCircle2 } from "lucide-react";

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
            const amount = (t.plan === "enterprise" ? 4900 : t.plan === "scale" ? 1900 : 890) + Math.round(seed * 12 + i * 7);
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

  const pastDue = records.filter((r) => r.status === "past due");
  const totalRevenue = records.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);

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
                  {pastDue.map((r) => (
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
                  ))}
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
