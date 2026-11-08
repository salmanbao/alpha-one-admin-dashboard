"use client";

/**
 * TraderStageBanner — R2-W3-02.
 *
 * The dashboard's "where am I?" answer, rendered from the single
 * TraderStage derived from the lifecycle log (see lib/lifecycle/
 * trader-stage.ts). The journey checklist, provisioning header and the
 * (dev) simulator all read the same derivation, so completing KYC moves
 * every one of them with no page-specific branching.
 */

import Link from "next/link";
import { cn } from "@pfaas/ui";
import { TerraBadge, TerraCard, TerraProgress } from "@/components/terra/terra-ui";
import { TRADER_STAGES, stageMeta, useTraderStage, type TraderStage } from "@/lib/lifecycle/trader-stage";

const stageStepLabel: Record<TraderStage, string> = {
  browsing: "Start",
  purchased: "Purchased",
  verifying: "Verify",
  provisioned: "Provision",
  funded: "Funded",
  "payout-ready": "Payout",
};

export function TraderStageBanner({ className }: { className?: string }) {
  const state = useTraderStage();
  const meta = stageMeta(state);
  const currentIndex = TRADER_STAGES.indexOf(state.stage);

  return (
    <TerraCard
      className={cn(
        "relative overflow-hidden",
        meta.tone === "tertiary" && "bg-tertiary-fixed/40",
        meta.tone === "secondary" && "bg-secondary-fixed/60",
        meta.tone === "success" && "bg-success/10",
        meta.tone === "primary" &&
          "bg-gradient-to-r from-primary-fixed-dim/30 via-tertiary-fixed/30 to-secondary-container",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
              meta.tone === "success" ? "bg-success text-white" : "bg-primary text-on-primary",
            )}
          >
            {meta.icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-headline text-lg font-bold text-on-surface">{meta.title}</p>
              <TerraBadge tone={meta.tone === "success" ? "success" : "primary"}>
                {meta.label}
              </TerraBadge>
            </div>
            <p className="text-sm text-on-surface-variant">{meta.message}</p>
          </div>
        </div>
        <Link
          href={meta.cta.href}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-all active:scale-95"
        >
          {meta.cta.label} →
        </Link>
      </div>

      <div className="mt-4">
        <TerraProgress value={meta.progress} height="h-2" />
        <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
          {TRADER_STAGES.map((s, i) => (
            <li
              key={s}
              className={cn(
                "flex items-center gap-1",
                i < currentIndex && "text-success",
                i === currentIndex && "font-bold text-on-surface",
              )}
            >
              <span aria-hidden>{i < currentIndex ? "✓" : i === currentIndex ? "●" : "○"}</span>
              {stageStepLabel[s]}
            </li>
          ))}
        </ol>
      </div>
    </TerraCard>
  );
}
