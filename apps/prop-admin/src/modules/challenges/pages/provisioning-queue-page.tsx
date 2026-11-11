"use client";

/**
 * Provisioning Queue — R4-10 operator surface
 *
 * Queues account-provisioning records from cross-app intake and surfaces
 * four operator actions per record:
 *   - Retry stage (emits `provisioning.retry`)
 *   - Deliver credentials (emits `provisioning.credentials`)
 *   - Mark activated (emits `provisioning.activated`)
 *   - Fail with reason (emits `provisioning.failed`)
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
  Server,
  Clock,
  Key,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  useCrossAppProvisioning,
  type ProvisioningRecord,
} from "@/lib/platform/cross-app-intake";
import {
  retryStage,
  deliverCredentials,
  markActivated,
  failWithReason,
} from "@/modules/challenges/provisioning-operator-store";
import { formatCurrency } from "@/components/platform/status";

/* ------------------------------------------------------------------ */
/* Dialog state                                                         */
/* ------------------------------------------------------------------ */

type ActionKind = "retry" | "deliver" | "activate" | "fail";

interface DialogState {
  kind: ActionKind;
  record: ProvisioningRecord;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function ProvisioningQueuePage() {
  const { runtime } = usePlatform();
  const tenantId = runtime.tenant?.id ?? "platform";

  const records = useCrossAppProvisioning(tenantId);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeDialog = useCallback(() => setDialog(null), []);

  /* ----- Action handlers ----- */

  const handleRetry = (record: ProvisioningRecord, reason?: string) => {
    setSubmitting(true);
    const rec: any = {
      orderId: record.accountName,
      traderName: record.traderName,
      createdAt: record.createdAt,
    };
    retryStage(rec, reason);
    toast({
      title: "Stage retried",
      description: `Provisioning retry queued for ${record.traderName}`,
    });
    closeDialog();
  };

  const handleDeliverCredentials = (record: ProvisioningRecord) => {
    setSubmitting(true);
    const rec: any = {
      orderId: record.accountName,
      traderName: record.traderName,
      createdAt: record.createdAt,
    };
    deliverCredentials(rec);
    toast({
      title: "Credentials delivered",
      description: `${record.traderName} credentials sent to trader inbox`,
    });
    closeDialog();
  };

  const handleActivate = (record: ProvisioningRecord) => {
    setSubmitting(true);
    const rec: any = {
      orderId: record.accountName,
      traderName: record.traderName,
      createdAt: record.createdAt,
    };
    markActivated(rec);
    toast({
      title: "Account activated",
      description: `${record.traderName} account is now live`,
    });
    closeDialog();
  };

  const handleFail = (record: ProvisioningRecord, reason: string) => {
    setSubmitting(true);
    const rec: any = {
      orderId: record.accountName,
      traderName: record.traderName,
      createdAt: record.createdAt,
    };
    failWithReason(rec, reason);
    toast({
      title: "Provisioning failed",
      description: `${record.traderName} — ${reason}`,
      variant: "destructive",
    });
    closeDialog();
  };

  /* ----- Render ----- */

  return (
    <Page>
      <PageHeader
        title="Provisioning Queue"
        description="Account provisioning records awaiting operator action"
        icon={Server}
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
              <Server className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No provisioning records
              </p>
              <p className="text-xs text-muted-foreground">
                Account-provisioning records will appear here when purchases move to provisioning.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((record) => {
              return (
                <Card key={record.id} className={record.status === "failed" ? "border-red-500/30" : ""}>
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">
                              {record.traderName}
                            </h3>
                            <Badge variant="outline" className="text-[10px]">
                              {record.accountName}
                            </Badge>
                            {record.status === "failed" && (
                              <Badge variant="destructive" className="text-[10px]">
                                Failed
                              </Badge>
                            )}
                            {record.status === "active" && (
                              <Badge variant="secondary" className="text-[10px]">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Status: {record.status} ·{" "}
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(record.createdAt).toLocaleTimeString()}</p>
                        {record.reason && (
                          <p className="text-xs text-red-600 mt-1">{record.reason}</p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialog({ kind: "retry", record })
                          }
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          Retry stage
                        </Button>
                      )}
                      {record.status !== "failed" &&
                        record.status !== "credentials-delivered" && record.status !== "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDialog({ kind: "deliver", record })}
                          >
                            <Key className="mr-1 h-3 w-3" />
                            Deliver credentials
                          </Button>
                        )}
                      {(record.status === "credentials-delivered" || record.status === "active") && record.status !== "failed" && record.status !== "in-progress" ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleActivate(record)}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Mark activated
                        </Button>
                      ) : null}
                      {record.status !== "failed" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDialog({ kind: "fail", record })}
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Fail
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info footer */}
        <p className="mt-4 text-xs text-muted-foreground">
          Provisioning actions emit lifecycle events that the trader stage derives
          from (provisioned → credentials moment → activated). Every action is
          logged to the audit trail.
        </p>
      </PageContent>

      {/* ----- Dialogs ----- */}

      {/* Retry dialog */}
      {dialog?.kind === "retry" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Retry provisioning stage</DialogTitle>
              <DialogDescription>
                Retry provisioning for {dialog.record.traderName} ({dialog.record.accountName}).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Reason (optional)
                </label>
                <Textarea
                  placeholder="Why was this stuck..."
                  value={dialog.reason ?? ""}
                  onChange={(e) =>
                    setDialog({ ...dialog, reason: e.target.value })
                  }
                  disabled={submitting}
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => handleRetry(dialog.record, dialog.reason)}
                disabled={submitting}
              >
                Retry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Deliver credentials dialog */}
      {dialog?.kind === "deliver" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Deliver credentials</DialogTitle>
              <DialogDescription>
                Deliver trading-account credentials to {dialog.record.traderName}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => handleDeliverCredentials(dialog.record)}
                disabled={submitting}
              >
                Deliver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mark activated dialog */}
      {dialog?.kind === "activate" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark activated</DialogTitle>
              <DialogDescription>
                Mark {dialog.record.traderName}'s account as active.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => handleActivate(dialog.record)}
                disabled={submitting}
              >
                Mark activated
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Fail dialog */}
      {dialog?.kind === "fail" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Mark provisioning failed
              </DialogTitle>
              <DialogDescription>
                Mark {dialog.record.traderName}'s provisioning as failed with a reason.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Reason for failure
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
              <div className="rounded-md border border-red-500/30 bg-red-50 p-3 dark:bg-red-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="text-xs text-red-800 dark:text-red-300">
                    <p className="font-medium">This action is permanent</p>
                    <p className="mt-0.5">
                      The failure will be recorded and a lifecycle event emitted.
                      The trader will see the failure status on their account.
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
                      description: "Please enter a reason for the failure.",
                      variant: "destructive",
                    });
                    return;
                  }
                  handleFail(dialog.record, dialog.reason);
                }}
                disabled={submitting}
              >
                Mark failed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
