"use client";

import Link from "next/link";
import { TerraEmpty } from "@/components/terra/terra-ui";
import { CheckCircle2, Rocket, BookOpen, Flame, TrendingUp } from "lucide-react";

/**
 * Trader empty state — finding #9 (LOW).
 *
 * Enhanced from the previous single-line "Browse available trading challenges"
 * to an instructional empty state that guides first-time users through the
 * three most important next steps: explore challenges, review objectives, and
 * see an active session preview. Links go to real surfaces that already exist
 * in the trader app.
 */
export function TraderEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 space-y-5 max-w-md mx-auto">
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-surface-container-low flex items-center justify-center">
          <TerraEmpty title="No challenges yet" />
        </div>
        <h3 className="font-headline text-xl font-bold text-on-surface">No active challenges</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          You haven&rsquo;t started a trading challenge yet. Every challenge begins
          with an evaluation phase — once funded, you unlock payouts, scaling, and
          live performance analytics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <a
          href="/marketplace"
          className="group flex flex-col items-center gap-2 rounded-xl border border-outline-variant px-4 py-4 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <div className="rounded-full bg-surface-container-low p-3 text-muted-foreground group-hover:text-primary transition-colors">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-on-surface">Explore challenges</span>
          <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
            Find your first evaluation
          </span>
        </a>
        <a
          href="/objectives"
          className="group flex flex-col items-center gap-2 rounded-xl border border-outline-variant px-4 py-4 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <div className="rounded-full bg-surface-container-low p-3 text-muted-foreground group-hover:text-primary transition-colors">
            <Flame className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-on-surface">Review objectives</span>
          <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
            See daily trading goals
          </span>
        </a>
        <a
          href="/performance-analytics"
          className="group flex flex-col items-center gap-2 rounded-xl border border-outline-variant px-4 py-4 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <div className="rounded-full bg-surface-container-low p-3 text-muted-foreground group-hover:text-primary transition-colors">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-on-surface">Preview analytics</span>
          <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
            See what P&L looks like live
          </span>
        </a>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 p-5 text-xs">
        <p className="font-medium text-on-surface">
          Quick tip: start with a 1-step or 2-step challenge on MT5. Funded
          accounts can request payouts on our standard weekly cycle.
        </p>
      </div>
    </div>
  );
}
