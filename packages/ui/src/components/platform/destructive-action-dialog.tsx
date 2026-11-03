"use client";

/**
 * PFaaS Platform — DestructiveActionDialog
 *
 * Standardized confirmation dialog for all destructive actions across
 * dashboards. Includes: warning icon, consequence description, REQUIRED
 * reason input, and secondary confirmation step. Replaces ad-hoc
 * `AlertDialog` + toast patterns with a single auditable component.
 */

import { useState, useEffect } from "react";
import { AlertTriangle, Trash2, UserX, ShieldAlert, Zap, Ban, CircleAlert } from "lucide-react";
import { ErrorAlert } from "./error-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export type DestructiveActionVariant =
  | "delete"
  | "terminate"
  | "suspend"
  | "refund"
  | "close-position"
  | "reject-payout"
  | "disable-feature"
  | "remove-member"
  | "revoke-access"
  | "custom";

interface VariantConfig {
  icon: React.ComponentType<{ className?: string }>;
  defaultTitle: string;
  defaultConsequence: string;
}

const VARIANT_CONFIG: Record<DestructiveActionVariant, VariantConfig> = {
  delete: {
    icon: Trash2,
    defaultTitle: "Delete permanently?",
    defaultConsequence: "This action cannot be undone. The record and all associated data will be permanently removed.",
  },
  terminate: {
    icon: UserX,
    defaultTitle: "Terminate account?",
    defaultConsequence: "The tenant will lose all platform access immediately. All traders, challenges, and data will be deactivated. Billing stops at the next cycle.",
  },
  suspend: {
    icon: ShieldAlert,
    defaultTitle: "Suspend access?",
    defaultConsequence: "The tenant and all traders will be unable to log in or trade. Active positions will be closed according to risk rules. Can be reversed by re-activating.",
  },
  refund: {
    icon: Zap,
    defaultTitle: "Process refund?",
    defaultConsequence: "The transaction amount will be returned to the original payment method. This cannot be reversed and will be recorded in the financial audit log.",
  },
  "close-position": {
    icon: Ban,
    defaultTitle: "Close position?",
    defaultConsequence: "The live trading position will be closed at current market price. All floating P&L will be realized. This cannot be undone.",
  },
  "reject-payout": {
    icon: CircleAlert,
    defaultTitle: "Reject payout?",
    defaultConsequence: "The trader will be notified and must re-request. The rejection reason is recorded in the audit trail. The trader's withdrawable balance is unaffected.",
  },
  "disable-feature": {
    icon: ShieldAlert,
    defaultTitle: "Disable feature?",
    defaultConsequence: "The feature will be unavailable to the tenant immediately. Any active usage will be stopped. Tenant data for this feature is preserved.",
  },
  "remove-member": {
    icon: UserX,
    defaultTitle: "Remove team member?",
    defaultConsequence: "The member will lose all access immediately. Their personal data is preserved but they cannot rejoin without a new invitation.",
  },
  "revoke-access": {
    icon: ShieldAlert,
    defaultTitle: "Revoke access?",
    defaultConsequence: "All API keys, sessions, and permissions are terminated immediately. The user must re-authenticate to regain access.",
  },
  custom: {
    icon: AlertTriangle,
    defaultTitle: "Confirm destructive action?",
    defaultConsequence: "This action cannot be easily undone. Please review the consequence description carefully.",
  },
};

export interface DestructiveActionDialogProps {
  /** Controls visibility of the dialog */
  open: boolean;
  /** Called when user cancels or closes the dialog */
  onOpenChange: (open: boolean) => void;
  /** Called when user confirms with a valid reason */
  onConfirm: (reason: string) => void;
  /** Predefined action type for consistent messaging */
  variant?: DestructiveActionVariant;
  /** Custom title (overrides variant default) */
  title?: string;
  /** Custom consequence description (overrides variant default) */
  consequence?: string;
  /** Label for the reason input */
  reasonLabel?: string;
  /** Placeholder text for the reason input */
  reasonPlaceholder?: string;
  /** Minimum reason length (default: 10) */
  minReasonLength?: number;
  /** Whether the confirm button should show loading state */
  loading?: boolean;
  /** Additional context shown below the consequence */
  context?: React.ReactNode;
  /** Unique ID for the dialog (required for ARIA) */
  dialogId: string;
}

export function DestructiveActionDialog({
  open,
  onOpenChange,
  onConfirm,
  variant = "custom",
  title,
  consequence,
  reasonLabel = "Reason (required)",
  reasonPlaceholder = "Describe why this action is necessary…",
  minReasonLength = 10,
  loading = false,
  context,
  dialogId,
}: DestructiveActionDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const config = VARIANT_CONFIG[variant];
  const effectiveTitle = title ?? config.defaultTitle;
  const effectiveConsequence = consequence ?? config.defaultConsequence;
  const Icon = config.icon;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const isValid = reason.trim().length >= minReasonLength;
  const showError = touched && !isValid;

  const handleConfirm = () => {
    setTouched(true);
    if (isValid) {
      onConfirm(reason.trim());
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-destructive" aria-hidden="true" />
            {effectiveTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>{effectiveConsequence}</p>
              {context && <div className="text-sm text-muted-foreground">{context}</div>}
              <ErrorAlert
                title="Reason required"
                description="Your reason will be recorded in the audit trail and shown to affected parties where applicable."
                tone="warning"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={dialogId} className="text-xs text-muted-foreground">
              {reasonLabel}
            </Label>
            <Textarea
              id={dialogId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={reasonPlaceholder}
              className={`min-h-[80px] ${showError ? "border-destructive focus:border-destructive" : ""}`}
              aria-required="true"
              aria-invalid={showError}
              aria-describedby={showError ? `${dialogId}-error` : undefined}
              disabled={loading}
            />
            {showError && (
              <ErrorAlert
                title={`Reason must be at least ${minReasonLength} characters`}
                tone="destructive"
                className="text-xs font-medium text-destructive"
                ariaLive="polite"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length} / {minReasonLength} min characters
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setReason(""); setTouched(false); }}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? "Confirming…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing destructive action dialog state with
 * the standard pattern: open → reason input → confirm → close.
 */
export function useDestructiveActionDialog() {
  const [dialog, setDialog] = useState<{
    open: boolean;
    variant?: DestructiveActionVariant;
    title?: string;
    consequence?: string;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    minReasonLength?: number;
    context?: React.ReactNode;
    onConfirm?: (reason: string) => void;
    dialogId: string;
  } | null>(null);

  const open = (config: Omit<Parameters<typeof setDialog>[0], "open"> & { dialogId?: string }) => {
    const id = config.dialogId ?? `destructive-${Math.random().toString(36).slice(2)}`;
    setDialog({ ...config, open: true, dialogId: id } as any);
  };

  const close = () => {
    setDialog((prev) => (prev ? { ...prev, open: false } : null));
  };

  const DialogComponent = dialog ? (
    <DestructiveActionDialog
      key={dialog.dialogId}
      open={dialog.open}
      onOpenChange={close}
      onConfirm={dialog.onConfirm ?? (() => {})}
      variant={dialog.variant}
      title={dialog.title}
      consequence={dialog.consequence}
      reasonLabel={dialog.reasonLabel}
      reasonPlaceholder={dialog.reasonPlaceholder}
      minReasonLength={dialog.minReasonLength}
      context={dialog.context}
      dialogId={dialog.dialogId}
    />
  ) : null;

  return { open, close, DialogComponent };
}