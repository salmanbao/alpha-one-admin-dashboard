"use client";

/**
 * PFaaS Platform — Contextual Help (UX Constitution §33)
 *
 * Inline info tooltips that explain concepts without forcing users
 * to search external documentation. Never turns the product into
 * a tutorial website.
 */

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ContextualHelp({
  label,
  children,
  className,
  iconClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn("inline-flex items-center text-muted-foreground hover:text-foreground", className)}
            aria-label={`Learn more about ${label}`}
          >
            <Info className={cn("h-3 w-3", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{label}</p>
            <div className="text-xs text-muted-foreground">{children}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline label with contextual help — shows the label text + an info
 * icon that expands on hover.
 */
export function LabelWithHelp({
  children,
  help,
  className,
}: {
  children: React.ReactNode;
  help: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <ContextualHelp label={typeof children === "string" ? children : "Info"}>{help}</ContextualHelp>
    </span>
  );
}

// Common help texts used across the platform
export const HELP_TEXTS = {
  dailyLoss: "The maximum amount you can lose in a single trading day. Resets at 00:00 server time. Exceeding this limit triggers a daily breach.",
  maxDrawdown: "The maximum cumulative loss from your highest recorded equity. Does not reset. Exceeding this triggers an account breach.",
  profitTarget: "The profit you need to reach to pass the current challenge phase. Once achieved, you advance to the next phase or receive a funded account.",
  profitSplit: "The percentage of profits the trader keeps. The remainder goes to the prop firm. Standard split is 80/20 in the trader's favor.",
  challenge: "An evaluation period where traders must prove their ability by reaching a profit target while staying within risk limits.",
  breach: "A rule violation that restricts the account. Critical breaches stop all trading. Warnings indicate approaching a limit.",
  kyc: "Know Your Customer verification. Required before payouts can be processed. Verifies identity and prevents fraud.",
  reconciliation: "The process of matching platform ledger entries against bank statements to ensure financial accuracy.",
  drawdown: "The decline from a historical peak. Used to measure risk. Lower is better.",
} as const;
