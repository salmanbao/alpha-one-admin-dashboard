"use client";

import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { useInvoices } from "@/lib/platform/invoice-store";
import { useTenants } from "@/lib/platform/tenant-store";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { toast } from "@/hooks/use-toast";
import { updateInvoiceStatus, recordPayment, cancelInvoice, addInvoiceLine, createInvoice } from "@/lib/platform/invoice-store";
import { DollarSign, FileText, Clock, X } from "lucide-react";

interface InvoiceLineForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function InvoiceDetailPage({
  invoiceId,
}: {
  invoiceId?: string;
}) {
  const invoices = useInvoices();
  const [invoice, setInvoice] = useState<ReturnType<typeof useInvoices>[0] | undefined>(undefined);
  const [lines, setLines] = useState<any[]>([]);
  const [form, setForm] = useState<InvoiceLineForm>({
    description: "",
    quantity: 1,
    unitPrice: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Find tenant
  const tenants = useTenants();
  const tenant = useMemo(() => {
    if (!invoice) return undefined;
    return tenants.find((t) => t.id === invoice.tenantId);
  }, [invoice?.tenantId, tenants]);

  const plans = usePlans();
  const plan = useMemo(() => {
    if (!tenant) return undefined;
    return plans.find((p) => p.id === tenant.plan);
  }, [tenant?.plan, plans]);

  // Load invoice on mount
  useEffect(() => {
    if (invoiceId) {
      const loaded = invoices.find((i) => i.id === invoiceId);
      if (loaded) {
        setInvoice(loaded);
        setLines(loaded.lines);
      }
    }
  }, [invoiceId, invoices]);

  // Re-derive lines when invoice changes
  useEffect(() => {
    if (invoice) {
      setLines(invoice.lines);
    }
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <Page>
        <PageHeader title="Invoice Detail" description="Select an invoice to view details." />
        <div className="p-4 text-muted-foreground">No invoice selected</div>
      </Page>
    );
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = Math.round(subtotal * 1.18);

  const columns: Column<any>[] = [
    { key: "description", header: "Description", cell: (l) => <span className="font-medium">{l.description}</span>, sortValue: (l) => l.description },
    { key: "quantity", header: "Qty", cell: (l) => <span className="text-right tabular-nums">{l.quantity}</span>, sortValue: (l) => l.quantity, numeric: true },
    { key: "unitPrice", header: "Unit Price", cell: (l) => <span className="tabular-nums text-right">{formatCurrency(l.unitPrice)}</span>, sortValue: (l) => l.unitPrice, numeric: true },
    { key: "amount", header: "Amount", cell: (l) => <span className="tabular-nums font-bold text-right">{formatCurrency(l.amount)}</span>, sortValue: (l) => l.amount, numeric: true },
  ];

  const planPrice = tenant ? (tenant.plan === "enterprise" ? 12000 : tenant.plan === "scale" ? 4900 : tenant.plan === "growth" ? 1900 : 890) : 0;

  return (
    <Page>
      <PageHeader
        title={`Invoice #${invoice.invoiceNumber}`}
        description={tenant?.name ? `Tenant: ${tenant.name}` : ""}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="mr-2"
            >
              <FileText className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                const result = cancelInvoice(invoice.id);
                toast({ title: result.title, description: result.description });
              }}
            >
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
          </>
        }
      />
      <PageContent>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Invoice Details</span></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label htmlFor="invoice-number">Invoice #</Label>
              <Input
                id="invoice-number"
                value={invoice.invoiceNumber}
                readOnly
                className="bg-transparent border-0 text-muted-foreground"
              />
            </div>
            <div>
              <Label htmlFor="issue-date">Issue Date</Label>
              <Input
                id="issue-date"
                value={invoice.issueDate}
                readOnly
                className="bg-transparent border-0 text-muted-foreground"
              />
            </div>
            <div>
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                value={invoice.dueDate}
                readOnly
                className="bg-transparent border-0 text-muted-foreground"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Input
                id="status"
                value={invoice.status}
                readOnly
                className="bg-transparent border-0 text-muted-foreground"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={invoice.currency}
                readOnly
                className="bg-transparent border-0 text-muted-foreground"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <span className="mt-1 font-bold tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="col-span-2">
              <Label htmlFor="tax">Tax (18%)</Label>
              <span className="mt-1 text-muted-foreground">{formatCurrency(tax)}</span>
            </div>
            <div className="col-span-2 border-t border-b border-muted/20 pt-4 pb-4">
              <Label htmlFor="total">Total</Label>
              <span className="mt-1 font-bold text-foreground tabular-nums">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Line Items</span></CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="p-4 text-muted-foreground">No line items</p>
            ) : (
              <DataTable
                columns={columns}
                data={lines}
                rowKey={(l) => l.id}
                searchPlaceholder="Search lines…"
                emptyTitle="No line items"
                emptyDescription="Lines appear here after adding."
              />
            )}
          </CardContent>
        </Card>

        {/* Action toolbar */}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => setShowPaymentDialog(true)}
            variant="outline"
          >
            <Clock className="mr-1 h-3 w-3" /> Record Payment
          </Button>
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
          >
            <FileText className="mr-1 h-3 w-3" /> Add Line
          </Button>
        </div>

        {/* Payment Dialog */}
        {showPaymentDialog && (
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent className="p-6">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Apply a payment against this invoice
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <DialogFooter className="justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const result = recordPayment(invoice.id, paymentAmount);
                    toast({ title: result.title, description: result.description });
                    setPaymentAmount(0);
                    setShowPaymentDialog(false);
                  }}
                >
                  Record
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowPaymentDialog(false)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Add Line Dialog */}
        {isEditing && (
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="p-6">
              <DialogHeader>
                <DialogTitle>Add Line Item</DialogTitle>
                <DialogDescription>Add a new line item to the invoice</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: Number(e.target.value) || 1 })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={form.unitPrice}
                    onChange={(e) =>
                      setForm({ ...form, unitPrice: Number(e.target.value) || 0 })
                    }
                    className="w-full"
                  />
                </div>
              </div>
              <DialogFooter className="justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const result = addInvoiceLine(invoice.id, {
                      description: form.description,
                      quantity: form.quantity,
                      unitPrice: form.unitPrice,
                      amount: form.quantity * form.unitPrice,
                    });
                    toast({ title: result.title, description: result.description });
                    setLines(result.invoice.lines);
                    setForm({ description: "", quantity: 1, unitPrice: 0 });
                    setIsEditing(false);
                  }}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageContent>
    </Page>
  );
}