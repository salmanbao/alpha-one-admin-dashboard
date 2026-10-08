"use client";

/**
 * Withdrawal Methods — converted from stitch_screens/withdrawal_methods
 * Configured payout methods with add/edit actions.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { withdrawalMethods } from "@/lib/fixtures/terra-fixtures";

export function WithdrawalMethodsPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Withdrawal Methods"
        description="Configure how you receive payouts"
        actions={
          <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90">
            + Add method
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {withdrawalMethods.map((m) => (
          <TerraCard key={m.id} className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-mono font-bold text-on-surface-variant">
                  {m.id.toUpperCase()}
                </span>
                <TerraBadge tone={m.primary ? "primary" : "secondary"} dot>
                  {m.primary ? "Default" : "Alternate"}
                </TerraBadge>
              </div>
              <h2 className="font-headline text-lg font-bold text-on-surface">{m.name}</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">{m.detail}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <TerraBadge tone="neutral">Fee {m.fee}</TerraBadge>
                <span className="text-on-surface-variant">ETA {m.eta}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container">
                Edit
              </button>
              {!m.primary && (
                <button type="button" className="rounded-xl bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container hover:bg-error-container/80">
                  Remove
                </button>
              )}
            </div>
          </TerraCard>
        ))}
      </div>
    </div>
  );
}
