"use client";

/**
 * Accounting — Invoice Detail Page.
 *
 * Extracted from the Invoices list's inline view Sheet into the
 * detail-overlay pattern: a row click (or the View action) opens this
 * screen as a sheet (?panel=accounting-invoice-detail&id=INV-…) and the
 * same component renders full-page from ?view=accounting-invoice-detail
 * (new tab / overlay header's "New tab" button).
 *
 * Shows the bill-from/bill-to parties, line items, totals and notes,
 * plus the contextual §22 actions (Download PDF, Send Email, Mark Paid,
 * Cancel Invoice) where the decision happens. The cancel confirmation
 * is an AlertDialog per §24 destructive friction.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import {
  getInvoice,
  invoiceStatusTone,
  fmtDate,
  type Invoice,
} from "@/modules/accounting/pages/accounting-invoices-page";
import { Page, PageContent } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  ChevronRight,
  Download,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from "lucide-react";

export function AccountingInvoiceDetailPage() {
  const { router, navigate, runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";
  const brandName = tenant?.branding?.name ?? "Platform";

  const invoice = getInvoice(router.params.id ?? "");
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const close = () => navigate("accounting-invoices");

  if (!invoice) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Invoice not found</p>
            <p className="text-sm text-muted-foreground">
              This invoice doesn&apos;t exist — it may belong to a previous
              billing year or have been voided.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back to Invoices
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  // ----- Contextual §22 actions (demo toasts — same as the list's) -----
  function handleSend(inv: Invoice) {
    toast({
      title: "Invoice sent",
      description: `${inv.id} emailed to ${inv.email} (demo).`,
    });
  }
  function handleMarkPaid(inv: Invoice) {
    toast({
      title: "Marked as paid",
      description: `${inv.id} — ${formatCurrency(inv.total, currency)} received (demo).`,
    });
  }
  function handleDownloadPdf(inv: Invoice) {
    toast({
      title: "Generating PDF",
      description: `${inv.id} download will start shortly (demo).`,
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

  return (
    <Page>
      {/* Breadcrumb — Invoices > [invoice id] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Invoices
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {invoice.id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          {/* Header — id + status + issued/due */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <span className="font-mono">{invoice.id}</span>
                  <StatusBadge
                    tone={invoiceStatusTone(invoice.status)}
                    className="capitalize"
                  >
                    {invoice.status}
                  </StatusBadge>
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Issued {fmtDate(invoice.issueDate)} · Due{" "}
                  {fmtDate(invoice.dueDate)}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={close} aria-label="Close detail">
              Close
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-4">
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
                <p className="mt-1 font-medium text-foreground">{invoice.trader}</p>
                <p className="text-xs text-muted-foreground">{invoice.email}</p>
                <p className="text-xs text-muted-foreground">{term("account")}</p>
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
              {invoice.lineItems.map((li, idx) => {
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
                <span className="tabular-nums">{formatCurrency(invoice.amount, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{formatCurrency(invoice.tax, currency)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(invoice.total, currency)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm text-foreground">{invoice.notes}</p>
              </div>
            ) : null}

            {/* Footer actions — §22 contextual actions where the decision happens */}
            <div className="flex flex-row flex-wrap gap-2 border-t pt-4">
              <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(invoice)}>
                <Download className="mr-1 h-4 w-4" /> Download PDF
              </Button>
              {(invoice.status === "draft" || invoice.status === "sent") && (
                <Button size="sm" variant="outline" onClick={() => handleSend(invoice)}>
                  <Send className="mr-1 h-4 w-4" /> Send Email
                </Button>
              )}
              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-600"
                  onClick={() => handleMarkPaid(invoice)}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Mark Paid
                </Button>
              )}
              {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-rose-600"
                  onClick={() => setCancelTarget(invoice)}
                >
                  <XCircle className="mr-1 h-4 w-4" /> Cancel Invoice
                </Button>
              )}
            </div>
          </div>
        </div>
      </PageContent>

      {/* Cancel Invoice AlertDialog — §24 destructive action with consequence */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice {cancelTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the invoice and release the owed balance of{" "}
              <span className="font-medium text-foreground">
                {cancelTarget ? formatCurrency(cancelTarget.total, currency) : ""}
              </span>
              . The {term("account").toLowerCase()} will be notified, and the invoice cannot be re-activated.
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
