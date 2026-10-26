"use client";

/**
 * PFaaS Platform — Two-Operator Approval Flow (docs/21 CON-32 §3.5)
 *
 * Approver-side presentation for `pending_approval` requests:
 *
 *   ApprovalRequestCard — the exact action + blast radius the approver
 *     must review, the initiator (who structurally cannot approve their
 *     own request), a live 10-minute countdown, and Approve/Reject.
 *     Approve runs the shared 2FA step-up, then `decideApproval` —
 *     store-level self-approval returns a 403-shaped error, never a
 *     warning-then-proceed.
 *   ApprovalCountdown  — ticking window display (hydration-safe).
 *   useApprovalRequests — subscribe to the store's approval list.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import { useCountdown, formatCountdown } from "@/hooks/use-countdown";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  useConsoleStore,
  decideApproval,
  type ApprovalRequest,
} from "@/lib/platform/console-store";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
} from "lucide-react";

/** All approval requests (newest first), live-subscribed. */
export function useApprovalRequests(): ApprovalRequest[] {
  const { approvals } = useConsoleStore();
  return approvals;
}

export function pendingApprovals(all: ApprovalRequest[]): ApprovalRequest[] {
  return all.filter((a) => a.status === "pending_approval");
}

/** Ticking 10-minute window: `9:59` → `0:00`, `expired` after. */
export function ApprovalCountdown({
  expiresAt,
  status,
  className,
}: {
  expiresAt: number;
  status: ApprovalRequest["status"];
  className?: string;
}) {
  const remaining = useCountdown(
    status === "pending_approval" ? expiresAt : null,
  );
  const expired = status === "expired" || (remaining !== null && remaining <= 0);
  return (
    <span
      className={
        className ??
        `inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
          status !== "pending_approval"
            ? "text-muted-foreground"
            : expired
              ? "text-destructive"
              : "text-amber-600"
        }`
      }
    >
      <Clock className="h-3 w-3" />
      {status !== "pending_approval"
        ? "closed"
        : expired
          ? "expired"
          : formatCountdown(remaining)}
    </span>
  );
}

const statusTone = (s: ApprovalRequest["status"]) =>
  s === "pending_approval"
    ? "warning"
    : s === "approved" || s === "executed"
      ? "success"
      : s === "rejected"
        ? "danger"
        : "muted";

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  /** Called after a successful approve/reject (parent shows its own toast). */
  onDecided?: (request: ApprovalRequest, decision: "approve" | "reject") => void;
}

export function ApprovalRequestCard({ request, onDecided }: ApprovalRequestCardProps) {
  const { user } = usePlatform();
  const [otpOpen, setOtpOpen] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const isInitiator = user.id === request.initiator.id;
  const isPending = request.status === "pending_approval";
  const decidedByYou = request.approver?.id === user.id;

  const approve = async (code: string) => {
    // 2FA verified by the dialog contract; the store applies the
    // structural rules (expired window, already decided, self-approval 403).
    if (code === "000000") throw new Error("Invalid code. Please try again.");
    const result = decideApproval(request.id, { id: user.id, name: user.name }, "approve");
    if (!result.ok) {
      setDecisionError(result.message);
      throw new Error(result.message);
    }
    setDecisionError(null);
    toast({
      title: "Approval recorded",
      description: `${request.actionLabel} — approved by you (2FA verified).`,
    });
    onDecided?.(result.request, "approve");
  };

  const reject = () => {
    const result = decideApproval(request.id, { id: user.id, name: user.name }, "reject");
    if (!result.ok) {
      setDecisionError(result.message);
      return;
    }
    setDecisionError(null);
    toast({
      title: "Request rejected",
      description: `${request.actionLabel} — rejected. The initiator was notified.`,
    });
    onDecided?.(result.request, "reject");
  };

  return (
    <Card className={isPending ? "border-amber-500/40" : undefined}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{request.actionLabel}</h3>
              <StatusBadge tone={statusTone(request.status)}>
                {request.status.replace("_", " ")}
              </StatusBadge>
              <Badge variant="outline" className="text-[9px]">{request.actionKey}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Initiated by <span className="font-medium text-foreground">{request.initiator.name}</span>
              {request.approver ? (
                <> · decided by <span className="font-medium text-foreground">{request.approver.name}</span></>
              ) : null}
              {request.detail ? <> · {request.detail}</> : null}
            </p>
          </div>
          <ApprovalCountdown expiresAt={request.expiresAt} status={request.status} />
        </div>

        <div className="mt-3 rounded-md border bg-muted/30 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Blast radius
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {request.blastRadius.map((line) => (
              <li key={line} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {decisionError ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive"
            role="alert"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{decisionError}</span>
          </div>
        ) : null}

        {isPending ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isInitiator ? (
                <span className="font-medium text-amber-600">
                  You initiated this request — a different operator must approve it.
                </span>
              ) : (
                <>Approving requires your 2FA. Window closes in 10 minutes.</>
              )}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reject} disabled={decisionError !== null}>
                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => { setDecisionError(null); setOtpOpen(true); }}
                disabled={isInitiator}
                title={isInitiator ? "Self-approval is structurally denied (403)" : undefined}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {request.status === "executed" && request.executedAt
              ? "Executed and recorded in the platform audit log."
              : request.status === "approved"
                ? "Approved — executing."
                : `Closed (${request.status})${decidedByYou ? " by you" : ""}.`}
          </p>
        )}
      </CardContent>

      <TwoFactorDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        title="Approve protected action"
        description={`Confirm with 2FA to approve: ${request.actionLabel}`}
        submitLabel="Verify & approve"
        onVerify={approve}
      />
    </Card>
  );
}

/** Compact list row for headers/badges showing how many are waiting. */
export function ApprovalInboxBadge({ onClick }: { onClick?: () => void }) {
  const approvals = useApprovalRequests();
  const pending = pendingApprovals(approvals).length;
  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={onClick}>
      <ShieldAlert className="h-3.5 w-3.5" />
      Approvals
      <span
        className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
          pending > 0 ? "bg-amber-500 text-black" : "bg-muted text-muted-foreground"
        }`}
      >
        {pending}
      </span>
    </Button>
  );
}
