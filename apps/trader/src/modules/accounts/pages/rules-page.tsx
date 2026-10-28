"use client";

/**
 * Rules & Trading Conditions — converted from stitch_screens/rules_trading_conditions
 * Program rules with allowed/forbidden practices and parameter table.
 *
 * Scoped to the active account's program (header switcher) — a Terra
 * Flash Instant trader never sees Terra Pro numbers.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
} from "@/components/terra/terra-ui";
import { accountRules } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

export function RulesPage() {
  const { activeAccount } = useActiveAccount();
  const { heading, rules, parameters } = accountRules(activeAccount.id);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Rules & Trading Conditions"
        description={`${heading} • Login #${activeAccount.login}`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <TerraCard key={rule.id} className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-headline font-semibold text-on-surface">{rule.title}</h3>
              <p className="mt-0.5 text-xs text-on-surface-variant">{rule.description}</p>
              <p className="mt-2 text-sm font-bold text-primary">{rule.value}</p>
            </div>
            {rule.allowed ? (
              <TerraBadge tone="success">Allowed</TerraBadge>
            ) : (
              <TerraBadge tone="error">Limit</TerraBadge>
            )}
          </TerraCard>
        ))}
      </div>

      <TerraCard>
        <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">
          Program Parameters
        </h2>
        <TerraTable
          head={["Parameter", "Phase 1", "Phase 2", "Funded"]}
          rows={parameters}
        />
      </TerraCard>
    </div>
  );
}
