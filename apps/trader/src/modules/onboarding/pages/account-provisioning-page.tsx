"use client";

/**
 * Account Provisioning — R2-03 corrected.
 * Derives progress from persisted purchasedAt (provisioning-handoff)
 * using getProvisioningProgress (minutes-per-stage demo pacing).
 * Completion is reachable, marks journey "provisioned" idempotently.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraProgress,
} from "@/components/terra/terra-ui";
import { markJourney } from "@/lib/onboarding/journey-store";
import { readProvisioningHandoff } from "@/lib/onboarding/provisioning-handoff";
import { emitLifecycle } from "@pfaas/lifecycle";
import { getProvisioningProgress } from "@/lib/status-progression";
import { useTraderStage, stageMeta } from "@/lib/lifecycle/trader-stage";

const stages = [
  { label: "Payment confirmed", note: "Order confirmed" },
  { label: "KYC verified", note: "Identity approved" },
  { label: "Risk profile assigned", note: "Challenge profile applied" },
  { label: "Server space reserved", note: "Execution environment ready" },
  { label: "Platform account created", note: "Trading account provisioned" },
  { label: "Credentials delivered", note: "Email + dashboard" },
];

/** Fallback only when no purchase handoff exists (demo/dev). */
const DEMO_PURCHASED_AT_FALLBACK = "2026-11-08T10:00:00Z";

export function AccountProvisioningPage() {
  const [purchasedAt, setPurchasedAt] = useState<string | null>(null);

  // R2-W3-02 — header badge derives from the same TraderStage every other
  // surface reads (lifecycle log), so it can never disagree with the
  // dashboard banner. "Active" still requires the actuator: the real
  // provisioning completion (facts.provisioned || page progress complete).
  const stageState = useTraderStage();
  const stageLabel = stageMeta(stageState).label;

  useEffect(() => {
    const handoff = readProvisioningHandoff();
    setPurchasedAt(handoff?.purchasedAt ?? DEMO_PURCHASED_AT_FALLBACK);
  }, []);

  const progress = getProvisioningProgress(purchasedAt ?? undefined);
  const { done, total, complete } = progress;
  const pct = Math.round((done / total) * 100);
  const active = stageState.facts.provisioned || complete;

  // Mark provisioned once when complete (idempotent; effect is safe), and
  // publish the provisioning lifecycle (R2-W3-01): one event updates the
  // dashboard stage, the journey checklist and prop-admin's queues.
  useEffect(() => {
    if (!purchasedAt) return;
    const handoff = readProvisioningHandoff();
    const entityId = handoff?.orderId ?? purchasedAt;
    emitLifecycle({
      entity: { kind: "provisioning", id: entityId },
      name: "provisioning.started",
      actor: "trader",
      key: `started:${entityId}`,
      payload: { purchasedAt, orderId: handoff?.orderId ?? null },
    });
    if (complete) {
      markJourney("provisioned");
      emitLifecycle({
        entity: { kind: "provisioning", id: entityId },
        name: "provisioning.activated",
        actor: "trader",
        key: `activated:${entityId}`,
        payload: { purchasedAt, stages: total },
      });
    }
  }, [purchasedAt, complete, total]);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Provisioning"
        description="Your trading account is being created"
        actions={
          active ? (
            <TerraBadge tone="success" dot>
              Active
            </TerraBadge>
          ) : (
            <TerraBadge tone="tertiary" dot pulse>
              {stageLabel} · Provisioning
            </TerraBadge>
          )
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <TerraCard>
          <div className="flex items-baseline justify-between pb-2">
            <span className="text-sm font-bold text-on-surface">Overall progress</span>
            <span className="font-headline text-xl font-bold tabular-nums text-primary">{pct}%</span>
          </div>
          <TerraProgress value={pct} height="h-3" />
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Demo: provisioning stages advance on an accelerated timeline for testing.
          </p>
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Provisioning stages" />
          <ol className="space-y-4">
            {stages.map((s, index) => {
              const rowDone = index < done;
              return (
                <li key={s.label} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      rowDone ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {rowDone ? "✓" : "•"}
                  </span>
                  <div>
                    <p className={`text-sm font-bold ${rowDone ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </TerraCard>

        <div className="flex justify-center gap-3">
          <Link
            href="/support"
            className="rounded-xl bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Contact support
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
