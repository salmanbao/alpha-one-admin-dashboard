"use client";

/**
 * Account Provisioning — converted from stitch_screens/account_provisioning
 * Live provisioning progress with stage checklist.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle, TerraProgress } from "@/components/terra/terra-ui";

const stages = [
  { label: "Payment confirmed", done: true, note: "Order TT-48210" },
  { label: "KYC verified", done: true, note: "Level 2 approved" },
  { label: "Risk profile assigned", done: true, note: "Terra Pro $100K • Phase 1" },
  { label: "Server space reserved", done: true, note: "TerraMarkets-Live02" },
  { label: "Platform account created", done: false, note: "In progress — typically < 1 hour" },
  { label: "Credentials delivered", done: false, note: "Email + dashboard" },
];

export function AccountProvisioningPage() {
  const done = stages.filter((s) => s.done).length;
  const pct = Math.round((done / stages.length) * 100);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Provisioning"
        description="Your trading account is being created"
        actions={
          <TerraBadge tone="tertiary" dot pulse>
            Provisioning
          </TerraBadge>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <TerraCard>
          <div className="flex items-baseline justify-between pb-2">
            <span className="text-sm font-bold text-on-surface">Overall progress</span>
            <span className="font-headline text-xl font-bold tabular-nums text-primary">{pct}%</span>
          </div>
          <TerraProgress value={pct} height="h-3" />
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Provisioning stages" />
          <ol className="space-y-4">
            {stages.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {s.done ? "✓" : "•"}
                </span>
                <div>
                  <p className={`text-sm font-bold ${s.done ? "text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                </div>
              </li>
            ))}
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
