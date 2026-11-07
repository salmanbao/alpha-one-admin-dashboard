"use client";

/**
 * PFaaS Platform — Contextual Action Panel (UX Constitution §22-23)
 *
 * Surfaces actions where the user's decision happens, with one
 * clear primary action and secondary actions. Used for:
 * - Payout review (Approve / Reject / Request Info / Escalate)
 * - Breach resolution (Investigate / Resolve / Contact trader)
 * - KYC review (Approve / Reject / Request resubmission)
 *
 * Destructive actions use proportional friction (§24).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { resolveTermsInString } from "@/lib/platform/terminology";
import { Button } from "@/components/ui/button";
import { DestructiveActionDialog } from "@/components/platform/destructive-action-dialog";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  PayoutRejectDialog,
  type PayoutRejectTarget,
  type PayoutRejectResult,
} from "@/components/platform/payout-reject-dialog";
import { Check, X, FileQuestion, ChevronRight, MessageCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/components/platform/status";
import { EntityAuditTimeline } from "@/components/platform/audit";
import {
  applyPayoutDecision,
  payoutAmlBlock,
  payoutEscalated,
  usePayoutVersion,
} from "@/modules/payouts/payout-store";
import { payouts, getTenantTraders } from "@/lib/platform/mock-data";
import { buildPayoutRisk } from "@/lib/platform/payout-risk";
import { resolveBreach } from "@/modules/risk/breach-store";
import { useState, type ComponentType } from "react";

interface ContextualAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  variant: "primary" | "secondary" | "destructive";
  /** Whether this is the primary action (only one should be primary) */
  isPrimary?: boolean;
  /** Destructive actions require a confirmation dialog with consequence explanation (§24) */
  destructive?: {
    title: string;
    description: string;
    consequence: string;
  };
  /**
   * Permission required to run this action. When the active user lacks
   * it the button renders disabled with a "Requires …" tooltip — viewing
   * a queue is not the same permission as deciding on it (gap analysis §4).
   */
  requires?: string;
  /**
   * Data-driven block (R3-F02): when present the action renders disabled
   * with this as the tooltip — e.g. the payout is frozen by an AML hold
   * and only a compliance.aml.approve release on the case unfreezes it.
   */
  disabledReason?: string;
  /**
   * Action handler. Destructive actions receive the operator's typed
   * reason (required by DestructiveActionDialog) so it can be written
   * into the audit detail.
   */
  onAction: (reason?: string) => void;
}

interface ContextualActionPanelProps {
  /** Context label (e.g. "Payout #WD-12345") */
  contextLabel: string;
  /** Context detail (e.g. "$4,250 · Bank Transfer") */
  contextDetail: string;
  /** Status badge to show */
  statusBadge?: React.ReactNode;
  /** Actions to display — one should have isPrimary */
  actions: ContextualAction[];
  /** Compact mode for inline use */
  compact?: boolean;
  /** Optional warning strip under the context label (e.g. R3-F02 AML hold) */
  notice?: React.ReactNode;
}

export function ContextualActionPanel({
  contextLabel,
  contextDetail,
  statusBadge,
  actions,
  compact = false,
  notice,
}: ContextualActionPanelProps) {
  const primary = actions.find((a) => a.isPrimary) ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border bg-card p-3",
      !compact && "shadow-sm",
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{contextLabel}</span>
          {statusBadge}
        </div>
        <p className="truncate text-xs text-muted-foreground">{contextDetail}</p>
        {notice}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {primary ? (
          <ContextualActionButton action={primary} isPrimary />
        ) : null}
        {secondary.map((a) => (
          <ContextualActionButton key={a.id} action={a} />
        ))}
      </div>
    </div>
  );
}

function ContextualActionButton({ action, isPrimary = false }: { action: ContextualAction; isPrimary?: boolean }) {
  const { user } = usePlatform();
  const Icon = action.icon;
  const [open, setOpen] = useState(false);
  const variant = isPrimary ? "default" : action.variant === "destructive" ? "outline" : "ghost";
  const size = "sm";
  const className = cn("gap-1.5", isPrimary && "shadow-sm");
  // In-page action guard: the queue may be visible (payout.read) while the
  // decision itself requires payout.approve / risk.configure / …
  const allowed = !action.requires || hasPermission(user, action.requires);
  // R3-F02 `disabledReason` wins over the permission tooltip — the more
  // specific block (AML hold on this payout) is what the operator needs.
  const deniedTitle = action.disabledReason ?? (action.requires ? `Requires ${action.requires}` : undefined);
  const blocked = !allowed || !!action.disabledReason;

  if (action.destructive) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          disabled={blocked}
          title={deniedTitle}
          className={cn(className, "text-rose-600 hover:text-rose-700")}
          onClick={() => setOpen(true)}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
        {/* §24 proportionate friction: consequence + required reason (§25) */}
        <DestructiveActionDialog
          dialogId={`ctx-${action.id}`}
          open={open}
          onOpenChange={setOpen}
          variant="custom"
          title={action.destructive.title}
          consequence={action.destructive.consequence}
          context={<p className="text-sm">{action.destructive.description}</p>}
          onConfirm={(reason) => {
            setOpen(false);
            action.onAction(reason);
          }}
        />
      </>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={blocked}
      title={deniedTitle}
      onClick={() => action.onAction()}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{action.label}</span>
    </Button>
  );
}

// Convenience presets for common actions

export function PayoutReviewActions({
  payoutId,
  traderName,
  amount,
  currency,
}: {
  payoutId: string;
  traderName: string;
  amount: number;
  currency: string;
}) {
  const { pushNotification, runtime, navigate } = usePlatform();
  const tenant = runtime.tenant;
  const currencyFmt = formatCurrency(amount, currency || runtime.tenant?.currency || "USD");
  // Escalation (PRD §4.5 multi-level approval) is a session decision —
  // re-render the panel when it changes. usePayoutVersion also subscribes
  // to the AML store (R3-F02), so a hold release re-renders this panel.
  usePayoutVersion();
  const escalated = payoutEscalated(payoutId);
  // R3-F02 — active AML hold on this payout's trader: Approve is blocked
  // with the case ID in the reason; release lives on the AML case detail
  // behind compliance.aml.approve (four-eyes).
  const aml = payoutAmlBlock(payoutId);
  // Audit fix #3: reject collects a structured reason via the shared
  // PayoutRejectDialog instead of a reason-less confirmation.
  const [rejectTarget, setRejectTarget] = useState<PayoutRejectTarget | null>(null);
  // Payout calculation + performance context for the reject dialog
  // (audit X #1/#5) — resolve the payout by its unique reference so the
  // dialog can show the split math and the trader's recent performance.
  const payout = payouts.find((x) => x.reference === payoutId);
  const perf = payout
    ? getTenantTraders(payout.tenantId).find((t) => t.id === payout.traderId)
    : undefined;

  const actions: ContextualAction[] = [
    {
      id: "approve",
      label: "Approve",
      icon: Check,
      variant: "primary",
      isPrimary: true,
      requires: "payout.approve",
      disabledReason: aml ? `AML hold ${aml.caseId} — ${aml.typology}` : undefined,
      onAction: () => {
        // Mutate the shared decision store — the pending queue (table,
        // dashboard widget) drops this payout everywhere, instantly.
        const result = applyPayoutDecision(payoutId, "approved");
        if (!result.ok) {
          // Belt-and-braces (R3-F02): the button is disabled while held,
          // but the store is the real enforcement chokepoint.
          toast({ title: "Approval blocked by AML hold", description: `${result.caseId} — ${result.reason}`, variant: "destructive" });
          return;
        }
        toast({ title: "Payout approved", description: resolveTermsInString(`${traderName}'s payout of ${currencyFmt} is being processed.`, tenant) });
        pushNotification({
          title: "Payout approved",
          message: resolveTermsInString(`${traderName} — ${currencyFmt}`, tenant),
          severity: "success",
          module: "payouts",
          actionLabel: "View",
          actionHref: "payouts",
        });
      },
    },
    {
      id: "reject",
      label: "Reject",
      icon: X,
      variant: "destructive",
      requires: "payout.approve",
      // No `destructive` metadata — the shared PayoutRejectDialog opens
      // instead, collecting the structured reason first (audit fix #3).
      onAction: () =>
        setRejectTarget({
          reference: payoutId,
          traderName,
          amount,
          currency: currency || "USD",
          count: 1,
          profitSplit: payout?.profitSplit,
          performance: perf,
          // Risk context (audit #3) — this panel is the primary
          // single-payout decision surface, so it must carry the same
          // breach history / score / account health as the queue.
          risk: payout ? buildPayoutRisk(payout.tenantId, payout.traderId) : undefined,
        }),
    },
    {
      id: "request-info",
      label: "Request Info",
      icon: FileQuestion,
      variant: "secondary",
      requires: "payout.approve",
      onAction: () => {
        applyPayoutDecision(payoutId, "info-requested");
        toast({ title: "Information requested", description: resolveTermsInString(`Additional information has been requested from ${traderName}.`, tenant) });
      },
    },
  ];

  // Escalate → multi-level approval: the payout stays pending but now
  // requires senior sign-off; hidden once escalated (shows the badge).
  if (!escalated) {
    actions.push({
      id: "escalate",
      label: "Escalate",
      icon: AlertTriangle,
      variant: "secondary",
      requires: "payout.approve",
      onAction: () => {
        applyPayoutDecision(payoutId, "escalated");
        toast({
          title: "Payout escalated",
          description: resolveTermsInString(`${traderName}'s payout escalated for senior approval.`, tenant),
        });
      },
    });
  }

  return (
    <div className="space-y-2">
      <ContextualActionPanel
        contextLabel={payoutId}
        contextDetail={`${traderName} · ${currencyFmt}`}
        statusBadge={
          aml ? (
            <Badge variant="outline" className="border-rose-500/50 text-rose-700 dark:text-rose-400">
              AML hold · {aml.caseId}
            </Badge>
          ) : escalated ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
              Escalated · senior sign-off
            </Badge>
          ) : undefined
        }
        notice={
          aml ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-destructive">
              <ShieldAlert className="h-3 w-3 shrink-0" />
              <span>
                Frozen by AML case {aml.caseId} — {aml.typology} ({aml.risk} risk). Approve/Process blocked; rejection still allowed.
              </span>
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => navigate("aml-case", { id: aml.caseId })}
              >
                Open case
              </button>
            </p>
          ) : undefined
        }
        actions={actions}
        compact
      />
      {/* Entity audit trail — decisions recorded via lib/audit.ts appear
          here (and on every other surface) as soon as they are made. */}
      <EntityAuditTimeline entity="payout" entityId={payoutId} />
      {/* Shared reject dialog (audit fix #3) — structured reason + notify */}
      <PayoutRejectDialog
        target={rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        onConfirm={(result: PayoutRejectResult) => {
          applyPayoutDecision(payoutId, "rejected", { reason: result.reason });
          if (result.notifyTrader) {
            pushNotification({
              title: "Payout rejected",
              message: `Your payout ${payoutId} (${currencyFmt}) was rejected: ${result.reason}`,
              severity: "critical",
              module: "payouts",
            });
          }
          toast({
            title: "Payout rejected",
            description: `${traderName}'s payout was rejected — ${result.reason}`,
            variant: "destructive",
          });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

export function BreachResolutionActions({
  breachId,
  traderName,
  rule,
  traderId,
}: {
  breachId: string;
  traderName: string;
  rule: string;
  /** Real trader id — navigate needs an id, not the display name. */
  traderId?: string;
}) {
  const { navigate } = usePlatform();

  const actions: ContextualAction[] = [
    {
      id: "investigate",
      label: "Investigate",
      icon: ChevronRight,
      variant: "primary",
      isPrimary: true,
      onAction: () => {
        if (traderId) navigate("trader-detail", { id: traderId });
        else toast({ title: "Trader unavailable", description: "No trader record is linked to this breach.", variant: "destructive" });
      },
    },
    {
      id: "resolve",
      label: "Mark Resolved",
      icon: Check,
      variant: "secondary",
      requires: "risk.configure",
      onAction: () => {
        resolveBreach(breachId);
        toast({ title: "Breach resolved", description: `${traderName}'s breach has been marked as resolved.` });
      },
    },
    {
      id: "contact",
      label: "Contact",
      icon: MessageCircle,
      variant: "secondary",
      onAction: () => {
        if (traderId) navigate("trader-detail", { id: traderId });
        else toast({ title: "Contact trader", description: `Opening message thread with ${traderName}.` });
      },
    },
  ];

  return (
    <div className="space-y-2">
      <ContextualActionPanel
        contextLabel={`Breach: ${traderName}`}
        contextDetail={rule}
        actions={actions}
        compact
      />
      <EntityAuditTimeline entity="breach" entityId={breachId} />
    </div>
  );
}
