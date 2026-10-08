"use client";

/**
 * Terms & Policies — converted from stitch_screens/terms_policies
 * Document-style legal pages with section navigation.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import { TerraCard, TerraPageHeader, TerraBadge } from "@/components/terra/terra-ui";

const sections = [
  {
    id: "terms",
    title: "Terms of Service",
    updated: "2026-09-01",
    body: [
      "These terms govern your use of the TerraTrader platform, including challenges, funded accounts, and payouts.",
      "Challenges are evaluations of trading skill. Passing an evaluation grants access to a simulated funded environment subject to the profit split and risk rules described in each program.",
      "Prohibited practices include high-frequency arbitrage, tick scalping abuse, account sharing, copy-trading between Terra accounts, and any activity that exploits platform latency.",
      "Terra may close accounts that violate these terms, in which case profits obtained through prohibited practices are void.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    updated: "2026-09-01",
    body: [
      "We collect identity information required for KYC/AML compliance, trading activity for evaluation and risk management, and payment details processed by PCI-DSS compliant providers.",
      "We never sell your personal data. Trading data may be aggregated for anonymized community statistics such as leaderboards.",
      "You may request export or deletion of your data by contacting support, subject to regulatory retention requirements.",
    ],
  },
  {
    id: "risk",
    title: "Risk Disclosure",
    updated: "2026-08-15",
    body: [
      "Trading leveraged instruments involves substantial risk of loss. Past performance is not indicative of future results.",
      "Challenge fees purchase an evaluation service, not an investment product. No financial advice is provided.",
      "Only trade with capital you can afford to lose.",
    ],
  },
  {
    id: "payouts",
    title: "Payout Policy",
    updated: "2026-09-20",
    body: [
      "Funded accounts are eligible for profit splits according to their program. Payouts are processed bi-weekly after review.",
      "Identity verification (Level 2 KYC) must be complete before the first payout.",
      "Payout requests are reviewed within one business day; delivery depends on the selected method.",
    ],
  },
];

export function TermsPage() {
  const [active, setActive] = useState(sections[0].id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Terms & Policies"
        description="The rules of the TerraTrader platform"
        actions={<TerraBadge tone="neutral">Last updated {current.updated}</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <nav className="flex flex-row gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm text-left transition-all",
                active === s.id
                  ? "bg-secondary-container font-semibold text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
              )}
            >
              {s.title}
            </button>
          ))}
        </nav>

        <TerraCard className="lg:col-span-3">
          <h2 className="font-headline text-xl font-bold text-on-surface">{current.title}</h2>
          <p className="mb-4 text-xs text-on-surface-variant">Updated {current.updated}</p>
          <div className="space-y-4">
            {current.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-on-surface-variant">
                {p}
              </p>
            ))}
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
