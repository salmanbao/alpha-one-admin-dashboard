"use client";

/**
 * PFaaS Platform — State + Meaning (UX Constitution §17-19)
 *
 * Translates raw backend status enums into human-readable explanations.
 * Instead of just "BREACHED", shows "Account Breached — Maximum
 * Drawdown exceeded by $84".
 *
 * Each state communicates:
 * - Current State
 * - Meaning (what it means)
 * - Reason (why it happened)
 * - Available Actions
 * - Next Possible State
 */

import { Badge } from "@pfaas/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@pfaas/ui/cn";
import type { ComponentType } from "react";

export interface StateExplanation {
  /** Raw backend status code */
  code: string;
  /** Human-readable title */
  title: string;
  /** What this state means */
  meaning: string;
  /** Why it happened (optional) */
  reason?: string;
  /** What can happen next */
  nextStates?: string[];
  /** Tone for visual treatment */
  tone: "safe" | "warning" | "critical" | "info" | "neutral" | "progress";
}

const toneStyles: Record<StateExplanation["tone"], { badge: string; icon: ComponentType<{ className?: string }>; iconColor: string }> = {
  safe: { badge: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2, iconColor: "text-emerald-600 dark:text-emerald-400" },
  warning: { badge: "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30", icon: AlertTriangle, iconColor: "text-amber-600 dark:text-amber-400" },
  critical: { badge: "border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30", icon: ShieldAlert, iconColor: "text-rose-600 dark:text-rose-400" },
  info: { badge: "border-teal-500/40 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30", icon: Info, iconColor: "text-teal-600 dark:text-teal-400" },
  neutral: { badge: "border-border text-muted-foreground bg-muted", icon: Clock, iconColor: "text-muted-foreground" },
  progress: { badge: "border-teal-500/40 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30", icon: Clock, iconColor: "text-teal-600 dark:text-teal-400" },
};

/** Status → StateExplanation lookup table (§56: internal vs external language) */
const STATE_EXPLANATIONS: Record<string, StateExplanation> = {
  // Trader states
  "trader.active": {
    code: "active",
    title: "Active",
    meaning: "The trader is currently trading and has full platform access.",
    nextStates: ["Suspended", "Breached"],
    tone: "safe",
  },
  "trader.invited": {
    code: "invited",
    title: "Invited",
    meaning: "An invitation has been sent. The trader hasn't completed registration yet.",
    nextStates: ["Active"],
    tone: "info",
  },
  "trader.suspended": {
    code: "suspended",
    title: "Suspended",
    meaning: "Trading is temporarily disabled for this trader.",
    reason: "Account suspension may be due to policy violation or manual action.",
    nextStates: ["Active (reinstated)", "Archived"],
    tone: "warning",
  },
  "trader.breached": {
    code: "breached",
    title: "Account Breached",
    meaning: "One or more risk rules have been violated.",
    reason: "Maximum Drawdown or Daily Loss limit was exceeded.",
    nextStates: ["Reset", "Archived"],
    tone: "critical",
  },

  // Account states
  "account.active": {
    code: "active",
    title: "Active",
    meaning: "The account is trading normally within all risk limits.",
    tone: "safe",
  },
  "account.breached": {
    code: "breached",
    title: "Account Breached",
    meaning: "The account exceeded a risk limit and can no longer trade.",
    reason: "Maximum Drawdown or Daily Loss limit was exceeded.",
    nextStates: ["Reset", "Archived"],
    tone: "critical",
  },
  "account.passed": {
    code: "passed",
    title: "Challenge Passed",
    meaning: "The trader met the profit target without breaching risk rules.",
    nextStates: ["Funded"],
    tone: "safe",
  },
  "account.pending": {
    code: "pending",
    title: "Pending",
    meaning: "The account is being set up and isn't ready for trading yet.",
    tone: "info",
  },

  // Payout states
  "payout.pending": {
    code: "pending",
    title: "Pending Review",
    meaning: "A payout has been requested and is awaiting approval.",
    nextStates: ["Approved", "Rejected"],
    tone: "progress",
  },
  "payout.approved": {
    code: "approved",
    title: "Approved",
    meaning: "The payout has been approved and is being prepared for processing.",
    nextStates: ["Processing", "Paid"],
    tone: "safe",
  },
  "payout.processing": {
    code: "processing",
    title: "Processing",
    meaning: "The payment is being sent to the trader's payment method.",
    nextStates: ["Paid"],
    tone: "info",
  },
  "payout.paid": {
    code: "paid",
    title: "Completed",
    meaning: "The payout has been successfully sent to the trader.",
    tone: "safe",
  },
  "payout.rejected": {
    code: "rejected",
    title: "Rejected",
    meaning: "The payout request was denied.",
    reason: "May be due to KYC issues, risk concerns, or policy violations.",
    nextStates: ["Re-requested"],
    tone: "critical",
  },

  // Challenge states
  "challenge.in-progress": {
    code: "in-progress",
    title: "In Progress",
    meaning: "The trader is actively working on this challenge.",
    nextStates: ["Passed", "Failed"],
    tone: "progress",
  },
  "challenge.passed": {
    code: "passed",
    title: "Passed",
    meaning: "The trader met the profit target without breaching risk rules.",
    nextStates: ["Funded"],
    tone: "safe",
  },
  "challenge.failed": {
    code: "failed",
    title: "Failed",
    meaning: "The challenge ended without reaching the profit target.",
    reason: "Either the time limit expired or a risk rule was breached.",
    nextStates: ["Retry"],
    tone: "critical",
  },
  "challenge.funded": {
    code: "funded",
    title: "Funded",
    meaning: "The trader has passed all phases and is now trading a funded account.",
    tone: "safe",
  },

  // KYC states
  "kyc.pending": {
    code: "pending",
    title: "Awaiting Submission",
    meaning: "The trader hasn't submitted KYC documents yet.",
    tone: "info",
  },
  "kyc.review": {
    code: "review",
    title: "Under Review",
    meaning: "Documents have been submitted and are awaiting manual verification.",
    tone: "progress",
  },
  "kyc.approved": {
    code: "approved",
    title: "Verified",
    meaning: "Identity verification is complete.",
    tone: "safe",
  },
  "kyc.rejected": {
    code: "rejected",
    title: "Verification Failed",
    meaning: "The submitted documents could not be verified.",
    reason: "Documents may be expired, illegible, or don't match the profile.",
    nextStates: ["Re-submit"],
    tone: "critical",
  },
  "kyc.expired": {
    code: "expired",
    title: "Verification Expired",
    meaning: "KYC verification has expired and needs to be renewed.",
    tone: "warning",
  },

  // Breach severity
  "breach.critical": {
    code: "critical",
    title: "Critical Breach",
    meaning: "A hard limit was exceeded. The account can no longer trade.",
    reason: "Maximum Drawdown was exceeded.",
    tone: "critical",
  },
  "breach.warning": {
    code: "warning",
    title: "Warning",
    meaning: "A soft limit was approached. Trading continues but action is needed.",
    reason: "Daily Loss limit reached.",
    tone: "warning",
  },

  // Certificate states (issued certificates awarded to traders)
  "certificate.valid": {
    code: "valid",
    title: "Valid",
    meaning: "The certificate is active and verifiable. The trader can share the certificate URL publicly.",
    nextStates: ["Expired", "Revoked"],
    tone: "safe",
  },
  "certificate.expired": {
    code: "expired",
    title: "Expired",
    meaning: "The certificate has passed its validity period and is no longer verifiable.",
    reason: "Certificates are valid for a fixed term; this one has lapsed.",
    nextStates: ["Re-issued"],
    tone: "warning",
  },
  "certificate.revoked": {
    code: "revoked",
    title: "Revoked",
    meaning: "The certificate has been revoked by an admin and is no longer verifiable.",
    reason: "Revocation is typically a manual action due to a policy violation or trader request.",
    nextStates: ["Re-issued"],
    tone: "critical",
  },
};

/**
 * Get the StateExplanation for a given status code and entity type.
 */
export function getStateExplanation(status: string, entityType: "account" | "payout" | "challenge" | "kyc" | "breach" | "certificate"): StateExplanation {
  const key = `${entityType}.${status}`;
  return STATE_EXPLANATIONS[key] ?? {
    code: status,
    title: status.charAt(0).toUpperCase() + status.slice(1),
    meaning: "Status information unavailable.",
    tone: "neutral" as const,
  };
}

/**
 * ExplainableStateBadge — shows a status badge with a tooltip explaining
 * the state meaning (§18-19). Hover to see full explanation.
 */
export function ExplainableStateBadge({
  status,
  entityType,
  showTooltip = true,
  detail,
}: {
  status: string;
  entityType: "account" | "payout" | "challenge" | "kyc" | "breach" | "certificate";
  showTooltip?: boolean;
  detail?: string;
}) {
  const explanation = getStateExplanation(status, entityType);
  const styles = toneStyles[explanation.tone];
  const Icon = styles.icon;

  const tooltip = showTooltip
    ? `${explanation.title}\n\n${explanation.meaning}${explanation.reason ? `\n\nReason: ${explanation.reason}` : ""}${detail ? `\n\n${detail}` : ""}`
    : undefined;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", styles.badge)}
      title={tooltip}
      role="status"
      aria-label={`${explanation.title}: ${explanation.meaning}`}
    >
      <Icon className={cn("h-3 w-3", styles.iconColor)} />
      {explanation.title}
    </Badge>
  );
}

/**
 * StateExplanationCard — full explanation card showing current state,
 * meaning, reason, and next possible states (§17-18).
 */
export function StateExplanationCard({
  status,
  entityType,
  detail,
  action,
}: {
  status: string;
  entityType: "account" | "payout" | "challenge" | "kyc" | "breach" | "certificate";
  detail?: string;
  action?: React.ReactNode;
}) {
  const explanation = getStateExplanation(status, entityType);
  const styles = toneStyles[explanation.tone];
  const Icon = styles.icon;

  return (
    <div className={cn("rounded-lg border p-4", styles.badge)}>
      <div className="flex items-start gap-3">
        <div className={cn("rounded-md bg-background/50 p-2")}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{explanation.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{explanation.meaning}</p>
          {explanation.reason ? (
            <p className="mt-1 text-xs text-muted-foreground/80">
              <span className="font-medium">Reason:</span> {explanation.reason}
            </p>
          ) : null}
          {detail ? (
            <div className="mt-2 rounded-md bg-background/60 p-2 text-xs text-foreground">
              {detail}
            </div>
          ) : null}
          {explanation.nextStates && explanation.nextStates.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
              <span>Next:</span>
              {explanation.nextStates.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="rounded bg-background/60 px-1.5 py-0.5 font-medium">{s}</span>
                  {i < explanation.nextStates!.length - 1 ? <span>→</span> : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
