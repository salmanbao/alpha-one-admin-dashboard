"use client";

/**
 * Objectives — converted from stitch_screens/objectives_progress
 * Evaluation objectives with progress bars and status badges.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraObjectives } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

export function ObjectivesPage() {
  const completed = terraObjectives.filter((o) => o.status === "complete").length;
  // Objectives are scoped to the account currently selected in the header
  // switcher — the header copy follows it so the trader always knows which
  // account's targets they are reviewing.
  const { activeAccount } = useActiveAccount();

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Objectives Progress"
        description={`${activeAccount.name} • Login #${activeAccount.login} • ${activeAccount.phase} evaluation objectives`}
        actions={
          <TerraBadge tone="primary">
            {completed}/{terraObjectives.length} complete
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {terraObjectives.map((obj) => {
          const pct =
            obj.status === "complete"
              ? 100
              : obj.target > 0
                ? Math.min(100, (obj.current / obj.target) * 100)
                : 0;
          return (
            <TerraCard key={obj.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-headline font-semibold text-on-surface">{obj.name}</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{obj.description}</p>
                </div>
                {obj.status === "complete" ? (
                  <TerraBadge tone="success">Complete</TerraBadge>
                ) : (
                  <TerraBadge tone="primary">On Track</TerraBadge>
                )}
              </div>
              {obj.target > 0 && (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-2xl font-bold tabular-nums text-on-surface">
                      {obj.unit === "USD"
                        ? formatMoney(obj.current)
                        : `${obj.current}${obj.unit === "%" ? "%" : ""}`}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      of{" "}
                      {obj.unit === "USD"
                        ? formatMoney(obj.target)
                        : `${obj.target}${obj.unit === "%" ? "%" : ""}`}
                    </span>
                  </div>
                  <TerraProgress value={pct} height="h-3" />
                </>
              )}
              {obj.target === 0 && (
                <div className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-xs font-semibold text-on-primary-fixed-variant">
                  ✓ No violations recorded
                </div>
              )}
            </TerraCard>
          );
        })}
      </div>
    </div>
  );
}
