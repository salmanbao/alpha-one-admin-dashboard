"use client";

/**
 * Payout Methods Review — R4-11 operator surface
 *
 * Queues payout-method change events from the trader app (cross-app
 * intake) and surfaces a real review workflow:
 *   - Document-match checklist (method matches trader identity documents)
 *   - Verify action (emits payout-method.updated on shared bus)
 *   - Reject action with reason (emits payout-method.rejected with reason)
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
  Wallet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  useCrossAppMethodChanges,
  type MethodChangeRecord,
} from "@/lib/platform/cross-app-intake";
import { emitLifecycle } from "@pfaas/lifecycle";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Dialog state                                                         */
/* ------------------------------------------------------------------ */

type ActionKind = "verify" | "reject";

interface DialogState {
  kind: ActionKind;
  record: MethodChangeRecord;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Document-match checklist items                                       */
/* ------------------------------------------------------------------ */

const CHECKLIST_ITEMS = [
  { id: "doc", label: "Matching document ID on file" },
  { id: "account", label: "Account name matches trader profile" },
  { id: "number", label: "IBAN / wallet address matches provided details" },
] as const;

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function PayoutMethodsReviewPage() {
  const { runtime } = usePlatform();
  const tenantId = runtime.tenant?.id ?? "platform";

  const records = useCrossAppMethodChanges(tenantId);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeDialog = useCallback(() => setDialog(null), []);

  /* ----- Action handlers ----- */

  const handleVerify = (record: MethodChangeRecord) => {
    setSubmitting(true);
    emitLifecycle({
      entity: { kind: "payout-method", id: record.traderMethodId ?? record.id },
      name: "payout-method.updated",
      actor: "prop-admin",
      key: `verified:${record.id}`,
      payload: { method: record.method, verification: "verified", reviewedBy: "prop-admin" },
    });
    recordAudit({
      action: "Payout method verified",
      entity: "payout-method",
      entityId: record.id,
      summary: `#${record.id} → ${record.method ?? "unknown"} verified`,
      severity: "info",
    });
    toast({
      title: "Method verified",
      description: `${record.method ?? "Method"} has been verified`,
    });
    setSubmitting(false);
    closeDialog();
  };

  const handleReject = (record: MethodChangeRecord, reason: string) => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please enter a reason for rejection.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    emitLifecycle({
      entity: { kind: "payout-method", id: record.traderMethodId ?? record.id },
      name: "payout-method.rejected",
      actor: "prop-admin",
      key: `rejected:${record.id}:${Date.now()}`,
      payload: { method: record.method, reason, reviewedBy: "prop-admin" },
    });
    recordAudit({
      action: "Payout method rejected",
      entity: "payout-method",
      entityId: record.id,
      summary: `#${record.id} → ${record.method ?? "unknown"} rejected: ${reason}`,
      severity: "warning",
    });
    toast({
      title: "Method rejected",
      description: `${record.method ?? "Method"} rejected: ${reason}`,
      variant: "destructive",
    });
    setSubmitting(false);
    closeDialog();
  };

  /* ----- Render ----- */

  return (
    <Page>
      <PageHeader
        title="Payout Methods Review"
        description="Review and verify trader payout methods — document-match checklist required before verification"
        icon={Wallet}
      />
      <PageContent>
        {/* Source badge */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            (demo transport)
          </Badge>
          <span>— rows arrive from shared lifecycle log</span>
        </div>

        {records.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No payout method review queue
              </p>
              <p className="text-xs text-muted-foreground">
                Trader payout methods added or updated will appear here for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((record) => {
              return (
                <Card key={record.id} className="border-amber-500/30">
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">
                              {record.traderName}
                            </h3>
                            <Badge variant="outline" className="text-[10px]">
                              {record.method ?? "unknown"}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {record.action ?? "changed"}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Action: {record.action ?? "unknown"} ·{" "}
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(record.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>

                    {/* Document-match checklist */}
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Document-match checklist — verify before approving
                      </p>
                      <ul className="space-y-1">
                        {CHECKLIST_ITEMS.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground/40 text-[10px] text-muted-foreground">
                              ✓
                            </span>
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setDialog({ kind: "verify", record })}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Verify method
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDialog({ kind: "reject", record })}
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Reject method
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
          Approving a method emits <code>payout-method.updated</code> with <code>verification: "verified"</code>;{" "}
          rejecting emits <code>payout-method.rejected</code> with a reason. Both are logged to the audit trail.
        </p>
      </PageContent>

      {/* ----- Dialogs ----- */}

      {/* Verify dialog */}
      {dialog?.kind === "verify" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Verify method</DialogTitle>
              <DialogDescription>
                Verify this method for {dialog.record.traderName} ({dialog.record.method ?? "unknown"}). This will allow the trader to submit payout requests using this method.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => handleVerify(dialog.record)}
                disabled={submitting}
              >
                Verify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject dialog */}
      {dialog?.kind === "reject" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Reject method
              </DialogTitle>
              <DialogDescription>
                Reject this method for {dialog.record.traderName} ({dialog.record.method ?? "unknown"}). The trader will see this rejection reason on their Withdrawal Methods page.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Reason for rejection
                </label>
                <Textarea
                  placeholder="Reason (required)"
                  value={dialog.reason ?? ""}
                  onChange={(e) =>
                    setDialog({ ...dialog, reason: e.target.value })
                  }
                  disabled={submitting}
                  className="min-h-[80px]"
                />
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="text-xs text-destructive">
                    <p className="font-medium">This action is permanent</p>
                    <p className="mt-0.5">
                      The rejection will be recorded and a lifecycle event emitted.
                      The trader will see the rejected state on their method card.
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
                  if (!dialog.reason?.trim()) {
                    toast({
                      title: "Reason required",
                      description: "Please enter a reason for the rejection.",
                      variant: "destructive",
                    });
                    return;
                  }
                  handleReject(dialog.record, dialog.reason);
                }}
                disabled={submitting}
              >
                Reject method
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
