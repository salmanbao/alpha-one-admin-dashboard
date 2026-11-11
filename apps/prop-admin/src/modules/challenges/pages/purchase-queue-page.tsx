"use client";

/**
 * Purchase Queue — R4-09 operator surface
 *
 * Queues challenge purchases from the trader app (cross-app intake) and
 * surfaces four operator actions:
 *   - Assign challenge product (writes mapping to purchase-ops store)
 *   - Trigger provisioning (emits `provisioning.started` on shared bus)
 *   - Refund purchase (refund record + `purchase.refunded` event)
 *   - Contact trader (emits `comms.message-sent` for trader inbox bridge)
 *
 * Every action writes `recordAudit` (AC 4).
 * Source rows carry `(demo transport)` chip (rule R3).
 */

import { useState, useCallback } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Package,
  User,
  Server,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import {
  useCrossAppPurchases,
  type PurchaseRecord,
} from "@/lib/platform/cross-app-intake";
import {
  useAllOrderOps,
  assignProduct,
  triggerProvisioning,
  refundPurchase,
  contactTrader,
} from "@/modules/challenges/purchase-operator-store";
import { challengeTypes } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";

/* ------------------------------------------------------------------ */
/* Dialog state                                                         */
/* ------------------------------------------------------------------ */

type ActionKind = "assign" | "refund" | "contact";

interface DialogState {
  kind: ActionKind;
  record: PurchaseRecord;
  // For refund
  refundReason?: string;
  // For contact
  subject?: string;
  body?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function PurchaseQueuePage() {
  const { runtime, navigate } = usePlatform();
  const tenantId = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const purchases = useCrossAppPurchases(tenantId);
  const allOps = useAllOrderOps();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setConfirmRefund(false);
    setSubmitting(false);
  }, []);

  /* ----- Action handlers ----- */

  const handleAssignProduct = (record: PurchaseRecord, product: { id: string; name: string }) => {
    setSubmitting(true);
    assignProduct(record, product);
    toast({
      title: "Product assigned",
      description: `#${record.orderId} → ${product.name} (${record.traderName})`,
    });
    closeDialog();
  };

  const handleTriggerProvisioning = (record: PurchaseRecord) => {
    setSubmitting(true);
    triggerProvisioning(record);
    toast({
      title: "Provisioning started",
      description: `#${record.orderId} provisioning started (${record.traderName})`,
    });
    closeDialog();
  };

  const handleRefund = (record: PurchaseRecord, reason: string) => {
    setSubmitting(true);
    refundPurchase(record, reason);
    toast({
      title: "Purchase refunded",
      description: `#${record.orderId} refunded ${formatCurrency(record.amount, record.currency)}`,
    });
    closeDialog();
  };

  const handleContact = (record: PurchaseRecord, subject: string, body: string) => {
    setSubmitting(true);
    contactTrader(record, subject, body);
    toast({
      title: "Message sent",
      description: `#${record.orderId}: ${subject} — trader inbox notified`,
    });
    closeDialog();
  };

  /* ----- Render ----- */

  return (
    <Page>
      <PageHeader
        title="Purchase Queue"
        description="Challenge purchases awaiting operator action"
        icon={Package}
      />
      <PageContent>
        {/* Source badge */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            (demo transport)
          </Badge>
          <span>— rows arrive from the trader app via shared lifecycle log</span>
        </div>

        {purchases.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No pending purchases
              </p>
              <p className="text-xs text-muted-foreground">
                Challenge purchases from traders will appear here when they complete checkout.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {purchases.map((record) => {
              const ops = allOps[record.orderId];
              const hasAssignment = !!ops?.assignment;
              const hasRefund = !!ops?.refund;
              const hasProvisioning = !!ops?.provisioning;
              const contactCount = ops?.contacts?.length ?? 0;

              return (
                <Card key={record.id} className={hasRefund ? "border-red-500/30" : ""}>
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">
                              {record.traderName}
                            </h3>
                            <Badge variant="outline" className="text-[10px]">
                              #{record.orderId}
                            </Badge>
                            {hasRefund && (
                              <Badge variant="destructive" className="text-[10px]">
                                Refunded
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatCurrency(record.amount, record.currency)} ·{" "}
                            {record.challengeType ?? "Challenge"} ·{" "}
                            {record.method ?? "Payment method unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(record.createdAt).toLocaleDateString()}</p>
                        <p>{new Date(record.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>

                    {/* Ops state badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {hasAssignment ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                          Product: {ops?.assignment?.productName}
                        </Badge>
                      ) : null}
                      {hasProvisioning ? (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-700 dark:text-blue-400">
                          Provisioning triggered
                        </Badge>
                      ) : null}
                      {contactCount > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {contactCount} contact{contactCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!hasAssignment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialog({ kind: "assign", record })
                          }
                        >
                          <User className="mr-1 h-3 w-3" />
                          Assign product
                        </Button>
                      )}
                      {!hasProvisioning && !hasRefund && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialog({ kind: "refund", record })
                          }
                        >
                          <CreditCard className="mr-1 h-3 w-3" />
                          Refund
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDialog({ kind: "contact", record })
                        }
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        Contact trader
                      </Button>
                      {!hasProvisioning && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleTriggerProvisioning(record)}
                          disabled={hasRefund}
                        >
                          <Server className="mr-1 h-3 w-3" />
                          Trigger provisioning
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate("purchase-history")}
                      >
                        <ArrowRight className="mr-1 h-3 w-3" />
                        View history
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info footer */}
        <p className="mt-4 text-xs text-muted-foreground">
          Operator actions write to the shared purchase-ops store and emit lifecycle events
          that the trader app consumes (purchase history, invoice status, inbox messages).
          Every action is logged to the audit trail.
        </p>
      </PageContent>

      {/* ----- Dialogs ----- */}

      {/* Assign product dialog */}
      {dialog?.kind === "assign" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign challenge product</DialogTitle>
              <DialogDescription>
                Select the product to assign to order #{dialog.record.orderId} for{" "}
                {dialog.record.traderName}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {challengeTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    handleAssignProduct(dialog.record, {
                      id: ct.id,
                      name: ct.name,
                    })
                  }
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <div className="rounded-md bg-muted p-1.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ct.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Refund dialog */}
      {dialog?.kind === "refund" && !confirmRefund && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Refund purchase</DialogTitle>
              <DialogDescription>
                Refund #{dialog.record.orderId} —{" "}
                {formatCurrency(dialog.record.amount, dialog.record.currency)}{" "}
                to {dialog.record.traderName}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Reason for refund
                </label>
                <Textarea
                  placeholder="Enter reason for the refund..."
                  value={dialog.refundReason ?? ""}
                  onChange={(e) =>
                    setDialog({
                      ...dialog,
                      refundReason: e.target.value,
                    })
                  }
                  disabled={submitting}
                  className="min-h-[80px]"
                />
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-medium">This action is permanent</p>
                    <p className="mt-0.5">
                      The refund will be recorded and a lifecycle event emitted.
                      The trader will see the refund in their purchase history and inbox.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!dialog.refundReason?.trim()) {
                    toast({
                      title: "Reason required",
                      description: "Please enter a reason for the refund.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setConfirmRefund(true);
                }}
                disabled={submitting}
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Refund confirmation dialog (two-step) */}
      {dialog?.kind === "refund" && confirmRefund && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirm refund
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to refund order #{dialog.record.orderId}?
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/20">
              <p className="text-sm font-medium">
                {formatCurrency(dialog.record.amount, dialog.record.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                to {dialog.record.traderName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: {dialog.refundReason}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmRefund(false);
                  setDialog({
                    ...dialog,
                    refundReason: "",
                  });
                }}
                disabled={submitting}
              >
                Go back
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRefund(dialog.record, dialog.refundReason ?? "")}
                disabled={submitting}
              >
                Confirm refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Contact trader dialog */}
      {dialog?.kind === "contact" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Contact trader</DialogTitle>
              <DialogDescription>
                Send a message to {dialog.record.traderName} about order #
                {dialog.record.orderId}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Subject
                </label>
                <Textarea
                  placeholder="Subject line..."
                  value={dialog.subject ?? ""}
                  onChange={(e) =>
                    setDialog({
                      ...dialog,
                      subject: e.target.value,
                    })
                  }
                  disabled={submitting}
                  className="min-h-[40px]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Message
                </label>
                <Textarea
                  placeholder="Message body..."
                  value={dialog.body ?? ""}
                  onChange={(e) =>
                    setDialog({
                      ...dialog,
                      body: e.target.value,
                    })
                  }
                  disabled={submitting}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!dialog.subject?.trim() || !dialog.body?.trim()) {
                    toast({
                      title: "Missing fields",
                      description: "Please fill in both subject and message.",
                      variant: "destructive",
                    });
                    return;
                  }
                  handleContact(
                    dialog.record,
                    dialog.subject ?? "",
                    dialog.body ?? "",
                  );
                }}
                disabled={submitting}
              >
                Send message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}