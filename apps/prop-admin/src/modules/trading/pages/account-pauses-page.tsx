"use client";

/**
 * Account Pause Requests — R9 W5 UC-T9 operator surface
 *
 * Queues the trader's pause / vacation-mode requests (cross-app intake)
 * and runs the approve/reject review:
 *   - Approve → emits `account.pause-approved` (entity = account) — the
 *     trader's account-pause-store (`usePauseSync`) is the named consumer:
 *     it flips the local record to "Paused until {date}" and freezes the
 *     day counters.
 *   - Reject (reason required) → emits `account.pause-rejected`; the same
 *     consumer shows the reason and unlocks a re-request.
 *
 * Every action writes `recordAudit`. Source rows carry the
 * `(demo transport)` chip (rule R3). Policy cap is 14 days (Demo).
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
import { Pause, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import {
  useCrossAppPauses,
  type PauseRecord,
} from "@/lib/platform/cross-app-intake";
import { emitLifecycle } from "@pfaas/lifecycle";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Dialog state                                                         */
/* ------------------------------------------------------------------ */

type ActionKind = "approve" | "reject";

interface DialogState {
  kind: ActionKind;
  record: PauseRecord;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AccountPausesPage() {
  const { runtime } = usePlatform();
  const tenantId = runtime.tenant?.id ?? "platform";

  const records = useCrossAppPauses(tenantId);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeDialog = useCallback(() => setDialog(null), []);

  /* ----- Action handlers ----- */

  const handleApprove = (record: PauseRecord) => {
    setSubmitting(true);
    emitLifecycle({
      entity: { kind: "account", id: record.accountId },
      name: "account.pause-approved",
      actor: "prop-admin",
      key: `pause-approved:${record.id}`,
      payload: {
        accountId: record.accountId,
        accountLogin: record.accountLogin ?? "",
        accountName: record.accountName ?? record.traderName,
        days: record.days,
        until: record.until,
        reviewedBy: "prop-admin",
      },
    });
    recordAudit({
      action: "Approved account pause",
      entity: "account",
      entityId: record.accountId,
      summary: `#${record.accountLogin ?? record.accountId} paused ${record.days} day(s) until ${new Date(record.until).toLocaleDateString()} — day counters frozen`,
      severity: "info",
    });
    toast({
      title: "Pause approved",
      description: `Account #${record.accountLogin ?? record.accountId} is paused until ${new Date(record.until).toLocaleDateString()}.`,
    });
    setSubmitting(false);
    closeDialog();
  };

  const handleReject = (record: PauseRecord, reason: string) => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please enter a reason for the rejection.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    emitLifecycle({
      entity: { kind: "account", id: record.accountId },
      name: "account.pause-rejected",
      actor: "prop-admin",
      key: `pause-rejected:${record.id}`,
      payload: {
        accountId: record.accountId,
        accountLogin: record.accountLogin ?? "",
        accountName: record.accountName ?? record.traderName,
        days: record.days,
        until: record.until,
        reason,
        reviewedBy: "prop-admin",
      },
    });
    recordAudit({
      action: "Rejected account pause",
      entity: "account",
      entityId: record.accountId,
      summary: `#${record.accountLogin ?? record.accountId} pause (${record.days} day(s)) rejected: ${reason}`,
      severity: "warning",
    });
    toast({
      title: "Pause rejected",
      description: `#${record.accountLogin ?? record.accountId}: ${reason}`,
      variant: "destructive",
    });
    setSubmitting(false);
    closeDialog();
  };

  const pending = records.filter((r) => r.status === "pending");

  /* ----- Render ----- */

  return (
    <Page>
      <PageHeader
        title="Account Pause Requests"
        description="Review trader vacation-mode requests (max 14 days) — approval freezes the account's day counters until the pause ends"
        icon={Pause}
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
              <Pause className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                No pause requests in the queue
              </p>
              <p className="text-xs text-muted-foreground">
                Trader pause requests (Account Detail → ⏸ Request pause) appear here for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((record) => (
              <Card
                key={record.id}
                className={record.status === "pending" ? "border-amber-500/30" : ""}
              >
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Pause className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{record.traderName}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            #{record.accountLogin ?? record.accountId}
                          </Badge>
                          <Badge
                            variant={record.status === "pending" ? "secondary" : record.status === "approved" ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {record.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {record.days} day(s) · until {new Date(record.until).toLocaleDateString()} ·
                          requested {new Date(record.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{new Date(record.createdAt).toLocaleTimeString()}</p>
                      {record.decidedAt && (
                        <p>decided {new Date(record.decidedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {record.status === "rejected" && record.reason && (
                    <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      Rejection reason: {record.reason}
                    </p>
                  )}

                  {/* Action buttons — only while pending */}
                  {record.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setDialog({ kind: "approve", record })}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Approve pause
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDialog({ kind: "reject", record })}
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Reject pause
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info footer */}
        <p className="mt-4 text-xs text-muted-foreground">
          Approving emits <code>account.pause-approved</code>; rejecting emits{" "}
          <code>account.pause-rejected</code> with a reason. The trader&apos;s account-pause-store
          applies the verdict — paused state, &quot;Paused until&quot; banner and frozen day
          counters. Both actions are logged to the audit trail.
        </p>
      </PageContent>

      {/* ----- Dialogs ----- */}

      {/* Approve dialog */}
      {dialog?.kind === "approve" && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Approve account pause</DialogTitle>
              <DialogDescription>
                Pause #{dialog.record.accountLogin ?? dialog.record.accountId} for{" "}
                {dialog.record.days} day(s) until{" "}
                {new Date(dialog.record.until).toLocaleDateString()}. The trader&apos;s day
                counters freeze immediately and stay frozen until the pause ends.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => handleApprove(dialog.record)} disabled={submitting}>
                Approve
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
                Reject pause request
              </DialogTitle>
              <DialogDescription>
                Reject the {dialog.record.days}-day pause for {dialog.record.traderName} (#
                {dialog.record.accountLogin ?? dialog.record.accountId}). The trader sees this
                reason on the account and may re-request.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="pause-reject-reason">
                  Reason for rejection
                </label>
                <Textarea
                  id="pause-reject-reason"
                  placeholder="Reason (required)"
                  value={dialog.reason ?? ""}
                  onChange={(e) => setDialog({ ...dialog, reason: e.target.value })}
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
                      The rejection is recorded and a lifecycle event emitted; the trader&apos;s
                      day counters keep running.
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
                Reject pause
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
