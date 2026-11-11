"use client";

/**
 * Lifecycle Simulator dev tool — R2-W3-02 (replaces the old state-adaptive
 * dashboard mock).
 *
 * The old page kept a 10-state `stateConfigs` table in component state and
 * re-rendered a fake banner from it — nothing it "switched" touched any real
 * store, so the simulator could claim "funded live" while the dashboard said
 * otherwise (R4: dead code deleted same commit as its replacement).
 *
 * This page is now a dev tool over the SAME lifecycle log every real surface
 * reads (lib/lifecycle/trader-stage.ts):
 *
 *   - stage buttons call setTraderStage(), which emits the prerequisite
 *     events — the dashboard banner, journey checklist, provisioning header
 *     and prop-admin's cross-app intake all update from them immediately;
 *   - the banner shown here is the shared <TraderStageBanner />, i.e. the
 *     exact component the dashboard renders (no parallel copy);
 *   - the event panel tails the shared log live;
 *   - "Clear log" resets it (loudly: it also empties prop-admin intake).
 *
 * Gated in the sidebar by the existing `lifecycle.simulator` feature flag.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { lifecycleStageLabel, useLifecycleLog } from "@pfaas/lifecycle";
import { TraderStageBanner } from "@/components/terra/trader-stage-banner";
import {
  TRADER_STAGES,
  resetLifecycleLog,
  setTraderStage,
  stageMeta,
  useTraderStage,
  type TraderStage,
} from "@/lib/lifecycle/trader-stage";

const stageButtonLabel: Record<TraderStage, string> = {
  browsing: "Browsing",
  purchased: "Purchased",
  verifying: "Verifying",
  provisioned: "Provisioned",
  "provisioning-failed": "Failed",
  funded: "Funded",
  "payout-ready": "Payout ready",
};

export function StateAdaptiveDashboardPage() {
  const stageState = useTraderStage();
  const meta = stageMeta(stageState);
  const log = useLifecycleLog();
  const [clearedAt, setClearedAt] = useState<string | null>(null);

  // Newest first, capped so the panel can't outgrow the page.
  const recent = [...log].reverse().slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Simulator bar — writes the shared lifecycle log */}
      <section className="-mx-4 bg-surface-container-high/80 px-4 py-3.5 shadow-sm sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              ⟳
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Lifecycle Simulator <span className="text-secondary">(dev)</span>
              </span>
              <span className="text-[11px] text-secondary">
                Writes real events to the shared lifecycle log — gated by the{" "}
                <code className="rounded bg-surface px-1">lifecycle.simulator</code> feature flag
              </span>
            </div>
          </div>
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {TRADER_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  setTraderStage(stage);
                  setClearedAt(null);
                }}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-all",
                  stageState.stage === stage
                    ? "bg-primary font-bold text-on-primary shadow-sm"
                    : "bg-surface font-medium text-on-surface-variant hover:bg-surface-variant",
                )}
                aria-pressed={stageState.stage === stage}
              >
                {stageButtonLabel[stage]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* The REAL dashboard banner component — same derivation, same copy. */}
      <TraderStageBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live tail of the shared log */}
        <TerraCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <TerraSectionTitle title={`Shared lifecycle log (${log.length} events)`} />
            <button
              type="button"
              onClick={() => {
                resetLifecycleLog();
                setClearedAt(new Date().toLocaleTimeString());
              }}
              className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error-container/40"
            >
              Clear shared lifecycle log (dev)
            </button>
          </div>
          <p className="mb-2 text-[11px] text-on-surface-variant">
            Persisted under <code className="rounded bg-surface px-1">pfaas:demo:lifecycle-log</code>. On the
            demo gateway (:81) this is ONE key shared by all three apps — clearing it also empties
            prop-admin&apos;s cross-app intake.
          </p>
          {clearedAt ? (
            <p className="text-xs text-on-surface-variant">Log cleared at {clearedAt}.</p>
          ) : recent.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              Empty — pick a stage above, or complete a real flow (purchase, verification, payout).
            </p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {recent.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-low px-3 py-1.5"
                >
                  <span className="font-mono text-[10px] text-on-surface-variant">{e.id.split(":")[0]}</span>
                  <span className="font-semibold text-on-surface">{lifecycleStageLabel(e.name)}</span>
                  <span className="text-on-surface-variant">
                    {e.entity.kind}:{e.entity.id}
                  </span>
                  <TerraBadge tone={e.actor === "trader" ? "primary" : "secondary"}>{e.actor}</TerraBadge>
                  <span className="ml-auto tabular-nums text-on-surface-variant">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </TerraCard>

        {/* Derived stage + what it drives */}
        <TerraCard>
          <TerraSectionTitle title="Derived stage" />
          <div className="space-y-3 text-xs">
            <div className="rounded-lg bg-primary-fixed px-3 py-2 font-bold text-on-primary-fixed-variant">
              {meta.label} — {meta.progress}%
            </div>
            <p className="text-on-surface-variant">{meta.message}</p>
            <div className="space-y-1 text-on-surface-variant">
              <p className="font-semibold text-on-surface">Facts</p>
              {(
                [
                  ["purchased", "purchase.completed"],
                  ["kycSubmitted", "kyc.submitted / reviewing"],
                  ["kycApproved", "kyc.approved"],
                  ["provisioningUnderway", "provisioning.started"],
                  ["provisioned", "provisioning.activated"],
                  ["funded", "challenge.funded"],
                  ["payoutRequested", "payout.requested"],
                ] as const
              ).map(([fact, eventName]) => (
                <div key={fact} className="flex items-center justify-between rounded px-2 py-1">
                  <span>{eventName}</span>
                  <span className={stageState.facts[fact] ? "font-bold text-success" : "text-on-surface-variant/60"}>
                    {stageState.facts[fact] ? "✓" : "—"}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="block rounded-lg bg-primary px-3 py-2 text-center font-bold text-on-primary hover:bg-primary/90"
            >
              See it on the dashboard →
            </Link>
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
