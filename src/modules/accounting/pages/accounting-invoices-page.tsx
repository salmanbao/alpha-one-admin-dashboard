"use client";

/**
 * Accounting — Invoices page.
 *
 * Spec sections §9 KPIs, §17-§19 state-first + explainability,
 * §22-§24 contextual + destructive actions, §27 drawer vs page,
 * §33 help, §54-§55 terminology.
 *
 * Generate, send, track invoices. Mock data is deterministic (no
 * Math.random) — invoices are a constant array, KPIs are derived from
 * that array via reduce/filter.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertTriangle,
  Wallet,
  CalendarClock,
  Receipt,
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Types                                                            */
/* ---------------------------------------------------------------- */

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

interface LineItem {
  desc: string;
  qty: number;
  unit: number;
  tax: number;
}

interface Invoice {
  id: string;
  trader: string;
  email: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  lineItems: LineItem[];
  notes?: string;
}

/* ---------------------------------------------------------------- */
/* Mock data (deterministic — no Math.random)                       */
/* ---------------------------------------------------------------- */

const INVOICES: Invoice[] = [
  {
    id: "INV-2024-001",
    trader: "Liam Smith",
    email: "liam@example.com",
    issueDate: "2024-11-01",
    dueDate: "2024-11-15",
    amount: 1200,
    tax: 120,
    total: 1320,
    status: "paid",
    lineItems: [
      { desc: "2-Step Challenge", qty: 1, unit: 1000, tax: 100 },
      { desc: "Addon: Reset Token", qty: 2, unit: 100, tax: 20 },
    ],
    notes: "Payment received via bank transfer. Thank you.",
  },
  {
    id: "INV-2024-002",
    trader: "Olivia Brown",
    email: "olivia@example.com",
    issueDate: "2024-11-03",
    dueDate: "2024-11-17",
    amount: 500,
    tax: 50,
    total: 550,
    status: "sent",
    lineItems: [
      { desc: "1-Step Challenge", qty: 1, unit: 500, tax: 50 },
    ],
  },
  {
    id: "INV-2024-003",
    trader: "Noah Davis",
    email: "noah@example.com",
    issueDate: "2024-10-20",
    dueDate: "2024-11-03",
    amount: 2400,
    tax: 240,
    total: 2640,
    status: "overdue",
    lineItems: [
      { desc: "2-Step Challenge", qty: 2, unit: 1000, tax: 200 },
      { desc: "Addon: Account Reset", qty: 4, unit: 100, tax: 40 },
    ],
    notes: "Two reminder emails sent. Awaiting trader response.",
  },
  {
    id: "INV-2024-004",
    trader: "Emma Wilson",
    email: "emma@example.com",
    issueDate: "2024-11-05",
    dueDate: "2024-11-19",
    amount: 1500,
    tax: 150,
    total: 1650,
    status: "paid",
    lineItems: [
      { desc: "2-Step Challenge", qty: 1, unit: 1000, tax: 100 },
      { desc: "Addon: Reset Token", qty: 5, unit: 100, tax: 50 },
    ],
  },
  {
    id: "INV-2024-005",
    trader: "James Taylor",
    email: "james@example.com",
    issueDate: "2024-11-06",
    dueDate: "2024-11-20",
    amount: 1000,
    tax: 100,
    total: 1100,
    status: "draft",
    lineItems: [
      { desc: "2-Step Challenge", qty: 1, unit: 1000, tax: 100 },
    ],
  },
  {
    id: "INV-2024-006",
    trader: "Sophia Miller",
    email: "sophia@example.com",
    issueDate: "2024-10-28",
    dueDate: "2024-11-11",
    amount: 3200,
    tax: 320,
    total: 3520,
    status: "paid",
    lineItems: [
      { desc: "2-Step Challenge", qty: 2, unit: 1000, tax: 200 },
      { desc: "Addon: Account Reset", qty: 12, unit: 100, tax: 120 },
    ],
  },
  {
    id: "INV-2024-007",
    trader: "Mason Anderson",
    email: "mason@example.com",
    issueDate: "2024-11-08",
    dueDate: "2024-11-22",
    amount: 800,
    tax: 80,
    total: 880,
    status: "sent",
    lineItems: [
      { desc: "1-Step Challenge", qty: 1, unit: 500, tax: 50 },
      { desc: "Addon: Reset Token", qty: 3, unit: 100, tax: 30 },
    ],
  },
  {
    id: "INV-2024-008",
    trader: "Ava Thomas",
    email: "ava@example.com",
    issueDate: "2024-09-25",
    dueDate: "2024-10-09",
    amount: 1800,
    tax: 180,
    total: 1980,
    status: "cancelled",
    lineItems: [
      { desc: "2-Step Challenge", qty: 1, unit: 1000, tax: 100 },
      { desc: "Addon: Account Reset", qty: 8, unit: 100, tax: 80 },
    ],
    notes: "Cancelled at trader request — challenge refunded.",
  },
  {
    id: "INV-2024-009",
    trader: "Lucas Moore",
    email: "lucas@example.com",
    issueDate: "2024-11-09",
    dueDate: "2024-11-23",
    amount: 1100,
    tax: 110,
    total: 1210,
    status: "overdue",
    lineItems: [
      { desc: "1-Step Challenge", qty: 1, unit: 500, tax: 50 },
      { desc: "Addon: Reset Token", qty: 6, unit: 100, tax: 60 },
    ],
  },
  {
    id: "INV-2024-010",
    trader: "Isabella Jackson",
    email: "bella@example.com",
    issueDate: "2024-11-10",
    dueDate: "2024-11-24",
    amount: 2200,
    tax: 220,
    total: 2420,
    status: "draft",
    lineItems: [
      { desc: "2-Step Challenge", qty: 1, unit: 1000, tax: 100 },
      { desc: "Addon: Account Reset", qty: 12, unit: 100, tax: 120 },
    ],
  },
];

const STATUS_TONE: Record<InvoiceStatus, "muted" | "info" | "success" | "danger"> = {
  draft: "muted",
  sent: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "muted",
};

function invoiceStatusTone(s: InvoiceStatus) {
  return STATUS_TONE[s];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

const STATUS_FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */

export function AccountingInvoicesPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";
  const brandName = tenant?.branding?.name ?? "Platform";

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTrader, setDraftTrader] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftIssue, setDraftIssue] = useState(new Date().toISOString().slice(0, 10));
  const [draftDue, setDraftDue] = useState(
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [draftNotes, setDraftNotes] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  // ----- Derived KPIs (deterministic — pure reduce over constant array) -----
  const kpis = useMemo(() => {
    const outstanding = INVOICES.filter(
      (i) => i.status === "sent" || i.status === "overdue",
    ).reduce((s, i) => s + i.total, 0);
    const paidThisMonth = INVOICES.filter((i) => i.status === "paid").reduce(
      (s, i) => s + i.total,
      0,
    );
    const overdue = INVOICES.filter((i) => i.status === "overdue");
    const avgDaysToPay = (() => {
      const paid = INVOICES.filter((i) => i.status === "paid");
      if (!paid.length) return 0;
      const total = paid.reduce((s, i) => s + daysBetween(i.issueDate, i.dueDate), 0);
      return Math.round(total / paid.length);
    })();
    return { outstanding, paidThisMonth, overdueCount: overdue.length, avgDaysToPay };
  }, []);

  // ----- Filtered rows (status + date range + DataTable's own search) -----
  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = dateRange === "all" ? null : Number(dateRange) * 86_400_000;
    return INVOICES.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (rangeMs !== null) {
        const issued = new Date(i.issueDate).getTime();
        if (Number.isNaN(issued) || now - issued > rangeMs) return false;
      }
      return true;
    });
  }, [statusFilter, dateRange]);

  // ----- Row actions -----
  function handleSend(invoice: Invoice) {
    toast({
      title: "Invoice sent",
      description: `${invoice.id} emailed to ${invoice.email} (demo).`,
    });
  }
  function handleMarkPaid(invoice: Invoice) {
    toast({
      title: "Marked as paid",
      description: `${invoice.id} — ${formatCurrency(invoice.total, currency)} received (demo).`,
    });
  }
  function handleDownloadPdf(invoice: Invoice) {
    toast({
      title: "Generating PDF",
      description: `${invoice.id} download will start shortly (demo).`,
    });
  }
  function confirmCancel() {
    if (!cancelTarget) return;
    toast({
      title: "Invoice cancelled",
      description: `${cancelTarget.id} has been voided (demo).`,
      variant: "destructive",
    });
    setCancelTarget(null);
  }

  // ----- Create draft (demo) -----
  function handleSaveDraft() {
    if (!draftTrader.trim()) {
      toast({
        title: "Trader required",
        description: `Enter the ${term("trader").toLowerCase()} name before saving the draft.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Draft saved",
      description: `New invoice draft for ${draftTrader} saved (demo).`,
    });
    setCreating(false);
    setDraftTrader("");
    setDraftEmail("");
    setDraftNotes("");
  }

  // ----- Export CSV -----
  function exportInvoices() {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Invoice #", value: (i) => i.id },
        { key: "trader", header: term("trader"), value: (i) => i.trader },
        { key: "email", header: "Email", value: (i) => i.email },
        { key: "issueDate", header: "Issue Date", value: (i) => i.issueDate },
        { key: "dueDate", header: "Due Date", value: (i) => i.dueDate },
        { key: "amount", header: "Amount", value: (i) => i.amount },
        { key: "tax", header: "Tax", value: (i) => i.tax },
        { key: "total", header: "Total", value: (i) => i.total },
        { key: "status", header: "Status", value: (i) => i.status },
      ],
      `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  // ----- Columns -----
  const columns: Column<Invoice>[] = [
    {
      key: "id",
      header: "Invoice #",
      cell: (i) => <span className="font-mono text-xs">{i.id}</span>,
      sortValue: (i) => i.id,
    },
    {
      key: "trader",
      header: term("trader"),
      cell: (i) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{i.trader}</span>
          <span className="text-xs text-muted-foreground">{i.email}</span>
        </div>
      ),
      sortValue: (i) => i.trader,
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (i) => <span className="text-xs text-muted-foreground">{fmtDate(i.issueDate)}</span>,
      sortValue: (i) => i.issueDate,
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (i) => {
        const overdue = i.status === "overdue";
        return (
          <span className={`text-xs ${overdue ? "font-medium text-rose-600" : "text-muted-foreground"}`}>
            {fmtDate(i.dueDate)}
          </span>
        );
      },
      sortValue: (i) => i.dueDate,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (i) => <span className="tabular-nums">{formatCurrency(i.amount, currency)}</span>,
      sortValue: (i) => i.amount,
      numeric: true,
    },
    {
      key: "tax",
      header: "Tax",
      cell: (i) => <span className="tabular-nums text-muted-foreground">{formatCurrency(i.tax, currency)}</span>,
      sortValue: (i) => i.tax,
      numeric: true,
    },
    {
      key: "total",
      header: "Total",
      cell: (i) => <span className="tabular-nums font-medium">{formatCurrency(i.total, currency)}</span>,
      sortValue: (i) => i.total,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (i) => (
        <StatusBadge tone={invoiceStatusTone(i.status)} className="capitalize">{i.status}</StatusBadge>
      ),
      sortValue: (i) => i.status,
    },
    {
      key: "actions",
      header: "",
      cell: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            aria-label={`View invoice ${i.id}`}
            onClick={() => setSelected(i)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            aria-label={`Download ${i.id} as PDF`}
            onClick={() => handleDownloadPdf(i)}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
          {(i.status === "draft" || i.status === "sent") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              aria-label={`Send invoice ${i.id}`}
              onClick={() => handleSend(i)}
            >
              <Send className="mr-1 h-3.5 w-3.5" /> Send
            </Button>
          )}
          {i.status !== "paid" && i.status !== "cancelled" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-emerald-600"
              aria-label={`Mark invoice ${i.id} as paid`}
              onClick={() => handleMarkPaid(i)}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Paid
            </Button>
          )}
          {i.status !== "cancelled" && i.status !== "paid" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-600"
              aria-label={`Cancel invoice ${i.id}`}
              onClick={() => setCancelTarget(i)}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      ),
      width: "min-w-[260px]",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Invoices"
        description={`Generate, send, and track ${term("trader").toLowerCase()} invoices.`}
        icon={FileText}
        term={`${plural(term("trader"))} · ${INVOICES.length} total invoices`}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Invoice
          </Button>
        }
      />
      <PageContent>
        {/* KPI row — §9 every metric carries a deltaLabel for context */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Outstanding"
            value={formatCurrency(kpis.outstanding, currency)}
            icon={Wallet}
            tone="warning"
            deltaLabel={`${INVOICES.filter((i) => i.status === "sent" || i.status === "overdue").length} unpaid`}
          />
          <MetricCard
            label="Paid This Month"
            value={formatCurrency(kpis.paidThisMonth, currency)}
            icon={CheckCircle2}
            tone="positive"
            deltaLabel={`${INVOICES.filter((i) => i.status === "paid").length} invoices cleared`}
          />
          <MetricCard
            label="Overdue"
            value={String(kpis.overdueCount)}
            icon={AlertTriangle}
            tone="negative"
            deltaLabel="past their due date"
          />
          <MetricCard
            label="Avg Days to Pay"
            value={`${kpis.avgDaysToPay} days`}
            icon={CalendarClock}
            deltaLabel="target: 15 days"
          />
        </div>

        {/* Filter bar — status + date range + export */}
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "all")}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Filter by date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {INVOICES.length} invoices
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={exportInvoices}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Invoices DataTable */}
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(i) => i.id}
          searchableText={(i) => `${i.id} ${i.trader} ${i.email} ${i.status}`}
          searchPlaceholder="Search invoices…"
          pageSize={8}
          emptyTitle="No invoices match"
          emptyDescription="Adjust the status or date filters to see more invoices."
        />
      </PageContent>

      {/* Invoice Sheet drawer (View) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono">{selected?.id}</span>
              {selected ? (
                <StatusBadge tone={invoiceStatusTone(selected.status)} className="capitalize">
                  {selected.status}
                </StatusBadge>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              Issued {selected ? fmtDate(selected.issueDate) : ""} · Due{" "}
              {selected ? fmtDate(selected.dueDate) : ""}
            </SheetDescription>
          </SheetHeader>

          {selected ? (
            <div className="flex flex-col gap-4 px-4 pb-4">
              {/* Bill From / Bill To */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Bill From</p>
                  <p className="mt-1 font-medium text-foreground">{brandName}</p>
                  <p className="text-xs text-muted-foreground">accounts@{brandName.toLowerCase().replace(/\s+/g, "")}.com</p>
                  <p className="text-xs text-muted-foreground">Financial Operations</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Bill To</p>
                  <p className="mt-1 font-medium text-foreground">{selected.trader}</p>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                  <p className="text-xs text-muted-foreground">{term("trader")}</p>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_60px_90px_80px_90px] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit</span>
                  <span className="text-right">Tax</span>
                  <span className="text-right">Total</span>
                </div>
                {selected.lineItems.map((li, idx) => {
                  const lineTotal = li.qty * li.unit + li.tax;
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_60px_90px_80px_90px] gap-2 px-3 py-2 text-sm tabular-nums"
                    >
                      <span className="truncate text-foreground">{li.desc}</span>
                      <span className="text-right">{li.qty}</span>
                      <span className="text-right text-muted-foreground">{formatCurrency(li.unit, currency)}</span>
                      <span className="text-right text-muted-foreground">{formatCurrency(li.tax, currency)}</span>
                      <span className="text-right font-medium">{formatCurrency(lineTotal, currency)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(selected.amount, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(selected.tax, currency)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatCurrency(selected.total, currency)}</span>
                </div>
              </div>

              {/* Notes */}
              {selected.notes ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm text-foreground">{selected.notes}</p>
                </div>
              ) : null}

              {/* Footer actions — §22 contextual actions where the decision happens */}
              <SheetFooter className="flex-row flex-wrap gap-2 border-t pt-4">
                <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(selected)}>
                  <Download className="mr-1 h-4 w-4" /> Download PDF
                </Button>
                {(selected.status === "draft" || selected.status === "sent") && (
                  <Button size="sm" variant="outline" onClick={() => handleSend(selected)}>
                    <Send className="mr-1 h-4 w-4" /> Send Email
                  </Button>
                )}
                {selected.status !== "paid" && selected.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600"
                    onClick={() => handleMarkPaid(selected)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Mark Paid
                  </Button>
                )}
                {selected.status !== "cancelled" && selected.status !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600"
                    onClick={() => {
                      setCancelTarget(selected);
                      setSelected(null);
                    }}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Cancel Invoice
                  </Button>
                )}
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create Invoice Sheet drawer */}
      <Sheet open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </SheetTitle>
            <SheetDescription>
              Create a draft invoice. Line items and tax are auto-calculated from the default template.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-trader">{term("trader")} name</Label>
                <Input
                  id="inv-trader"
                  value={draftTrader}
                  onChange={(e) => setDraftTrader(e.target.value)}
                  placeholder="e.g. Liam Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="trader@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-issue">Issue date</Label>
                <Input
                  id="inv-issue"
                  type="date"
                  value={draftIssue}
                  onChange={(e) => setDraftIssue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Due date</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={draftDue}
                  onChange={(e) => setDraftDue(e.target.value)}
                />
              </div>
            </div>

            {/* Default template line items (read-only preview) */}
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_60px_90px_80px_90px] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Tax</span>
                <span className="text-right">Total</span>
              </div>
              <div className="grid grid-cols-[1fr_60px_90px_80px_90px] gap-2 px-3 py-2 text-sm tabular-nums">
                <span className="truncate text-foreground">2-Step {term("challenge")}</span>
                <span className="text-right">1</span>
                <span className="text-right text-muted-foreground">{formatCurrency(1000, currency)}</span>
                <span className="text-right text-muted-foreground">{formatCurrency(100, currency)}</span>
                <span className="text-right font-medium">{formatCurrency(1100, currency)}</span>
              </div>
              <div className="grid grid-cols-[1fr_60px_90px_80px_90px] gap-2 border-t px-3 py-2 text-sm tabular-nums">
                <span className="truncate text-foreground">Addon: Reset Token</span>
                <span className="text-right">2</span>
                <span className="text-right text-muted-foreground">{formatCurrency(100, currency)}</span>
                <span className="text-right text-muted-foreground">{formatCurrency(20, currency)}</span>
                <span className="text-right font-medium">{formatCurrency(220, currency)}</span>
              </div>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <LabelWithHelp help="Sum of (Qty × Unit Price) before tax.">Subtotal</LabelWithHelp>
                <span className="tabular-nums">{formatCurrency(1200, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <LabelWithHelp help="10% applied to each line item.">Tax</LabelWithHelp>
                <span className="tabular-nums">{formatCurrency(120, currency)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(1320, currency)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Add payment instructions, reference, or terms…"
                rows={3}
              />
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 border-t pt-4">
              <Button size="sm" variant="outline" onClick={() => handleDownloadPdf({ ...INVOICES[0], id: "INV-DRAFT" })}>
                <Download className="mr-1 h-4 w-4" /> Download PDF
              </Button>
              <Button size="sm" variant="outline" disabled={!draftTrader.trim()}>
                <Send className="mr-1 h-4 w-4" /> Send Email
              </Button>
              <Button size="sm" onClick={handleSaveDraft} className="ml-auto">
                <Clock className="mr-1 h-4 w-4" /> Save Draft
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Invoice AlertDialog — §24 destructive action with consequence */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice {cancelTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the invoice and release the owed balance of{" "}
              <span className="font-medium text-foreground">
                {cancelTarget ? formatCurrency(cancelTarget.total, currency) : ""}
              </span>
              . The {term("trader").toLowerCase()} will be notified, and the invoice cannot be re-activated.
              Use this only if the charge was raised in error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invoice</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={confirmCancel}
            >
              <XCircle className="mr-2 h-4 w-4" /> Void invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
