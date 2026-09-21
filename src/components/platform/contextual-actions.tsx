"use client";

/**
 * PFaaS Platform — Contextual Action Panel (UX Constitution §22-23)
 *
 * Surfaces actions where the user's decision happens, with one
 * clear primary action and secondary actions. Used for:
 * - Payout review (Approve / Reject / Request Info)
 * - Breach resolution (Investigate / Resolve / Contact trader)
 * - KYC review (Approve / Reject / Request resubmission)
 *
 * Destructive actions use proportional friction (§24).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Check, X, FileQuestion, ChevronRight, ShieldAlert, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

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
  /** Action handler */
  onAction: () => void;
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
}

export function ContextualActionPanel({
  contextLabel,
  contextDetail,
  statusBadge,
  actions,
  compact = false,
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
  const Icon = action.icon;
  const variant = isPrimary ? "default" : action.variant === "destructive" ? "outline" : "ghost";
  const size = "sm";
  const className = cn("gap-1.5", isPrimary && "shadow-sm");

  if (action.destructive) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={variant} size={size} className={cn(className, "text-rose-600 hover:text-rose-700")}>
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              {action.destructive.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action.destructive.description}
            </AlertDialogDescription>
            <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              <span className="font-medium">Consequence:</span> {action.destructive.consequence}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { action.onAction(); }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {action.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={action.onAction}>
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
  const { pushNotification } = usePlatform();

  const actions: ContextualAction[] = [
    {
      id: "approve",
      label: "Approve",
      icon: Check,
      variant: "primary",
      isPrimary: true,
      onAction: () => {
        toast({ title: "Payout approved", description: `${traderName}'s payout of ${amount} ${currency} is being processed.` });
        pushNotification({
          title: "Payout approved",
          message: `${traderName} — ${amount} ${currency}`,
          severity: "success",
          module: "payouts",
          read: false,
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
      destructive: {
        title: "Reject this payout?",
        description: `You are about to reject the payout of ${amount} ${currency} for ${traderName}.`,
        consequence: "The trader will need to re-request the payout. The rejection will be logged in the audit trail.",
      },
      onAction: () => {
        toast({ title: "Payout rejected", description: `${traderName}'s payout was rejected.`, variant: "destructive" });
      },
    },
    {
      id: "request-info",
      label: "Request Info",
      icon: FileQuestion,
      variant: "secondary",
      onAction: () => {
        toast({ title: "Information requested", description: `Additional information has been requested from ${traderName}.` });
      },
    },
  ];

  return (
    <ContextualActionPanel
      contextLabel={payoutId}
      contextDetail={`${traderName} · ${amount} ${currency}`}
      actions={actions}
      compact
    />
  );
}

export function BreachResolutionActions({
  breachId,
  traderName,
  rule,
}: {
  breachId: string;
  traderName: string;
  rule: string;
}) {
  const { navigate } = usePlatform();

  const actions: ContextualAction[] = [
    {
      id: "investigate",
      label: "Investigate",
      icon: ChevronRight,
      variant: "primary",
      isPrimary: true,
      onAction: () => navigate("trader-detail", { id: traderName }),
    },
    {
      id: "resolve",
      label: "Mark Resolved",
      icon: Check,
      variant: "secondary",
      onAction: () => {
        toast({ title: "Breach resolved", description: `${traderName}'s breach has been marked as resolved.` });
      },
    },
    {
      id: "contact",
      label: "Contact",
      icon: MessageCircle,
      variant: "secondary",
      onAction: () => {
        toast({ title: "Contact trader", description: `Opening message thread with ${traderName}.` });
      },
    },
  ];

  return (
    <ContextualActionPanel
      contextLabel={`Breach: ${traderName}`}
      contextDetail={rule}
      actions={actions}
      compact
    />
  );
}
