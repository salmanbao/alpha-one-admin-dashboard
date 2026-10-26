"use client";

/**
 * PFaaS Platform — Sensitive Action Dialog
 *
 * The consequence-first confirmation every destructive console action
 * goes through (UX constitution: destructive dialogs state the
 * consequence; docs/21: 2FA on all protected actions, two-operator for
 * the nuclear set). Flow:
 *
 *   review (consequences → acknowledge [→ type-to-confirm] → 2FA)
 *     → TwoFactorDialog (OTP step-up)
 *     → executing (async mock)
 *       ├─ direct:        execute → done (audit recorded by the caller/store)
 *       └─ twoOperator:   initiateApproval (CON-32) → pending (10-min window,
 *                         second operator approves in the Approval Center)
 *     → error (retry → review)
 *
 * Only one dialog is ever open: the review dialog unmounts when the OTP
 * challenge opens (no nested dialogs).
 */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  initiateApproval,
  type ApprovalRequest,
} from "@/lib/platform/console-store";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

type Step = "review" | "otp" | "executing" | "done" | "pending" | "error";

interface SensitiveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stable action key recorded in the audit trail (e.g. `tenant.suspend`). */
  actionKey: string;
  /** What happens, e.g. "Suspend tenant Alpha Capital". */
  title: string;
  /** One-line consequence statement. */
  consequence: string;
  /** Blast-radius bullets shown above the confirmation. */
  blastRadius?: string[];
  /**
   * Type-to-confirm phrase for the highest tier (e.g. the tenant's name
   * or `HALT`). When set, the operator must match it exactly.
   */
  confirmPhrase?: string;
  /** Nuclear set — after 2FA this *initiates* an approval instead of executing. */
  twoOperator?: boolean;
  /**
   * Require a typed reason before continuing (CON-15: every emergency
   * action records why). The reason flows into the audit detail and the
   * approval request.
   */
  requireReason?: boolean;
  /** Runbook / case reference surfaced in the request detail. */
  detail?: string;
  tenantId?: string;
  /** Executes the action (mock async). Called after 2FA with the reason. */
  onExecute: (reason: string) => void | Promise<void>;
  /** Fired when a two-operator request enters `pending_approval`. */
  onApprovalInitiated?: (request: ApprovalRequest) => void;
}

export function SensitiveActionDialog({
  open,
  onOpenChange,
  actionKey,
  title,
  consequence,
  blastRadius,
  confirmPhrase,
  twoOperator = false,
  requireReason = false,
  detail,
  tenantId,
  onExecute,
  onApprovalInitiated,
}: SensitiveActionDialogProps) {
  const { user, navigate } = usePlatform();
  const [step, setStep] = useState<Step>("review");
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ApprovalRequest | null>(null);
  // True once the OTP challenge verified successfully — the dialog's
  // auto-close then must NOT bounce the flow back to "review".
  const verifiedRef = useRef(false);

  // Reset every time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setStep("review");
      setAcknowledged(false);
      setTyped("");
      setReason("");
      setErrorMessage(null);
      setPendingRequest(null);
      verifiedRef.current = false;
    }
  }, [open]);

  // `executing` runs outside the OTP dialog: direct → execute + done,
  // nuclear → initiate the two-operator approval.
  useEffect(() => {
    if (step !== "executing") return;
    let cancelled = false;
    (async () => {
      try {
        if (twoOperator) {
          const request = initiateApproval({
            actionKey,
            actionLabel: title,
            blastRadius: blastRadius ?? [consequence],
            initiator: { id: user.id, name: user.name },
            tenantId,
            detail: detail ? `${detail} · reason: ${reasonSnapshot}` : `Reason: ${reasonSnapshot}`,
          });
          if (cancelled) return;
          setPendingRequest(request);
          setStep("pending");
          onApprovalInitiated?.(request);
        } else {
          await onExecute(reasonSnapshot);
          if (cancelled) return;
          setStep("done");
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;
  const reasonOk = !requireReason || reason.trim().length >= 8;
  const reviewOk = acknowledged && phraseOk && reasonOk;
  // Captured when the flow leaves "review" so the async executor below
  // never reads stale state.
  const reasonSnapshot = reason.trim();

  const close = () => onOpenChange(false);

  return (
    <>
      {/* ── Review + result steps ─────────────────────────────────── */}
      <Dialog open={open && step !== "otp"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {step === "review" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {title}
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-sm text-muted-foreground">{consequence}</p>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Impact
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-foreground">
                    {(blastRadius ?? [consequence]).map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  {detail ? (
                    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
                  ) : null}
                </div>

                {requireReason ? (
                  <div>
                    <Label className="text-xs" htmlFor="action-reason">
                      Reason (required — recorded in the audit log)
                    </Label>
                    <Textarea
                      id="action-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this action necessary? e.g. Incident INC-4421 — relay backlog breaching SLO"
                      className="mt-1 text-sm"
                      rows={2}
                    />
                    {reason.trim().length > 0 && reason.trim().length < 8 ? (
                      <p className="mt-1 text-xs text-destructive">
                        Please give a meaningful reason (at least 8 characters).
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                    className="mt-0.5"
                  />
                  <span>I understand the consequences listed above.</span>
                </label>

                {confirmPhrase ? (
                  <div>
                    <Label className="text-xs" htmlFor="confirm-phrase">
                      Type <span className="font-mono font-semibold">{confirmPhrase}</span> to confirm
                    </Label>
                    <Input
                      id="confirm-phrase"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={confirmPhrase}
                      className="mt-1 font-mono"
                      autoComplete="off"
                    />
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {twoOperator
                    ? "Protected action: after 2FA this request needs approval from a second platform operator (10-minute window) before it executes."
                    : "Protected action: your identity is re-verified with 2FA before this executes, and the action is written to the audit log."}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button
                  disabled={!reviewOk}
                  onClick={() => setStep("otp")}
                >
                  Continue to 2FA <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "executing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {twoOperator ? "Requesting approval…" : `Executing: ${title}…`}
              </p>
            </div>
          )}

          {step === "done" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Action executed
                </DialogTitle>
                <DialogDescription>
                  {title} completed. The action is recorded in the platform audit log.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={close}>Close</Button>
              </DialogFooter>
            </>
          )}

          {step === "pending" && pendingRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Waiting for a second operator
                </DialogTitle>
                <DialogDescription>
                  Your 2FA-verified request is in <span className="font-medium">pending_approval</span>.
                  A different platform operator must approve within 10 minutes — self-approval is
                  structurally denied.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{pendingRequest.actionLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Request {pendingRequest.id} · expires 10 minutes after initiation
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close}>Close</Button>
                <Button
                  onClick={() => {
                    close();
                    navigate("approval-center");
                  }}
                >
                  Open Approval Center
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "error" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Action failed
                </DialogTitle>
                <DialogDescription>
                  {errorMessage ?? "Something went wrong while executing this action."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={close}>Close</Button>
                <Button onClick={() => { setErrorMessage(null); setStep("review"); }}>
                  Try again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── OTP step-up (mutually exclusive with the review dialog) ── */}
      <TwoFactorDialog
        open={open && step === "otp"}
        onOpenChange={(o) => {
          // Closing the OTP challenge (Esc / X) returns to review — but a
          // successful verify also closes it, and that must keep the step
          // the verify handler set ("executing").
          if (!o && step === "otp" && !verifiedRef.current) setStep("review");
        }}
        description={`Verify your identity to continue: ${title}`}
        submitLabel={twoOperator ? "Verify & request approval" : "Verify & execute"}
        onVerify={(code) => {
          // Mock validation lives in the dialog contract: a rejected
          // promise surfaces inline. Real 2FA will POST the code here.
          if (code === "000000") {
            return Promise.reject(new Error("Invalid code. Please try again."));
          }
          verifiedRef.current = true;
          setStep("executing");
          return Promise.resolve();
        }}
      />
    </>
  );
}
