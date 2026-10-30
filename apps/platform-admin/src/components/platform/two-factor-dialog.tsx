"use client";

/**
 * PFaaS Platform — Two-Factor Step-Up Dialog
 *
 * The shared OTP challenge every sensitive console action passes through
 * (docs/21 CON-01: 2FA is mandatory for all platform roles — there is no
 * exception path). Used by SensitiveActionDialog, ApprovalFlow, session
 * revocation, and impersonation start.
 *
 * Contract: `onVerify(code)` resolves on success (the dialog closes) and
 * throws/rejects to surface an inline error — so callers keep their own
 * continuation logic (execute, approve, revoke…) inside `onVerify`.
 *
 * Demo semantics: any 6-digit code verifies; `000000` simulates a failed
 * attempt so the error state is reviewable.
 */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@pfaas/ui/input-otp";
import { ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEMO_FAILING_CODE = "000000";

interface TwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Extra context shown under the title (e.g. the action being confirmed). */
  description?: React.ReactNode;
  /** Verify the code. Throw to show an inline error. */
  onVerify: (code: string) => void | Promise<void>;
  submitLabel?: string;
}

export function TwoFactorDialog({
  open,
  onOpenChange,
  title = "Two-factor authentication",
  description,
  onVerify,
  submitLabel = "Verify & continue",
}: TwoFactorDialogProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(30);
  const inFlight = useRef(false);

  // Reset between openings; restart the resend cooldown.
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setVerifying(false);
      setResendIn(30);
      inFlight.current = false;
    }
  }, [open]);

  // Keyboard accessibility: Escape closes dialog (unless verifying)
  useEffect(() => {
    if (!open || verifying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, verifying, onOpenChange]);

  useEffect(() => {
    if (!open || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, resendIn]);

  const submit = async () => {
    if (code.length !== 6 || verifying || inFlight.current) return;
    inFlight.current = true;
    setVerifying(true);
    setError(null);
    try {
      await onVerify(code);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
      setCode("");
    } finally {
      setVerifying(false);
      inFlight.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!verifying) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "Enter the 6-digit code from your authenticator app to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => { setCode(v); setError(null); }}
            onComplete={submit}
            autoFocus
            disabled={verifying}
            containerClassName="gap-2"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-11 w-10 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <div className="h-5 text-center text-xs font-medium text-destructive" role="alert">
            {error}
          </div>

          <Button
            className="w-full"
            disabled={code.length !== 6 || verifying}
            onClick={submit}
          >
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {verifying ? "Verifying…" : submitLabel}
          </Button>

          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              className={cn(
                "underline-offset-2 hover:underline",
                resendIn > 0 && "cursor-not-allowed no-underline opacity-60",
              )}
              disabled={resendIn > 0}
              onClick={() => setResendIn(30)}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">
              Demo: any 6 digits pass · 000000 fails
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
