"use client";

/**
 * Rules & Trading Conditions — converted from stitch_screens/rules_trading_conditions
 * Program rules with allowed/forbidden practices and parameter table.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
} from "@/components/terra/terra-ui";

const rules = [
  {
    id: "r1",
    title: "Profit Target",
    value: "6% (Phase 1) • 4% (Phase 2)",
    allowed: true,
    description: "Reach the profit target without violating any risk rules.",
  },
  {
    id: "r2",
    title: "Daily Loss Limit",
    value: "3% of starting balance",
    allowed: false,
    description: "Equity or balance, whichever is lower, measured from the day's starting equity.",
  },
  {
    id: "r3",
    title: "Maximum Drawdown",
    value: "8% static",
    allowed: false,
    description: "Static drawdown from the initial account balance.",
  },
  {
    id: "r4",
    title: "Minimum Trading Days",
    value: "4 days",
    allowed: true,
    description: "A trading day counts when at least 0.5% of the account is traded.",
  },
  {
    id: "r5",
    title: "News Trading",
    value: "Restricted ±2 min on high-impact",
    allowed: false,
    description: "No opening or closing positions within 2 minutes of high-impact news on the affected currency.",
  },
  {
    id: "r6",
    title: "Weekend Holding",
    value: "Allowed",
    allowed: true,
    description: "Positions may be held over the weekend on all Terra programs.",
  },
  {
    id: "r7",
    title: "Expert Advisors",
    value: "Allowed (own EAs only)",
    allowed: true,
    description: "Personal EAs are permitted. Copy-trading between Terra accounts or third parties is not.",
  },
  {
    id: "r8",
    title: "Prohibited Practices",
    value: "HFT, latency arb, tick scalping abuse",
    allowed: false,
    description: "Group trading, arbitrage between accounts and toxic-order strategies lead to account termination.",
  },
];

export function RulesPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Rules & Trading Conditions"
        description="Terra Pro $100K — the rulebook for your evaluation"
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
          rows={[
            ["Profit Target", "6%", "4%", "—"],
            ["Daily Loss Limit", "3%", "3%", "3%"],
            ["Maximum Drawdown", "8%", "8%", "6% trailing"],
            ["Minimum Trading Days", "4", "4", "—"],
            ["Profit Split", "—", "—", "85/15"],
            ["Payout Frequency", "—", "—", "Bi-weekly"],
            ["Leverage", "1:50", "1:50", "1:30"],
            ["Max Lot Size", "10", "10", "Per margin"],
          ]}
        />
      </TerraCard>
    </div>
  );
}
