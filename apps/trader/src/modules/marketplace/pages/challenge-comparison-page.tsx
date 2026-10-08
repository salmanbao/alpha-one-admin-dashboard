"use client";

/**
 * Challenge Comparison — converted from stitch_screens/challenge_comparison
 * Side-by-side comparison of Terra programs.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, formatMoney } from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

const compareIds = ["ch-starter-25k", "ch-pro-100k", "ch-flash-25k"];

export function ChallengeComparisonPage() {
  const programs = compareIds
    .map((id) => terraChallenges.find((c) => c.id === id))
    .filter((c): c is (typeof terraChallenges)[number] => Boolean(c));

  const rows: { label: string; get: (c: (typeof programs)[number]) => string }[] = [
    { label: "Account Size", get: (c) => formatMoney(c.accountSize, "USD").replace(".00", "") },
    { label: "Price", get: (c) => formatMoney(c.price) },
    { label: "Type", get: (c) => (c.tag === "instant" ? "Instant" : "Two-Phase") },
    { label: "Profit Target", get: (c) => c.profitTarget },
    { label: "Profit Split", get: (c) => c.profitSplit },
    { label: "Daily Loss", get: (c) => c.dailyLoss },
    { label: "Max Drawdown", get: (c) => c.maxDrawdown },
    { label: "Min Trading Days", get: (c) => (c.minDays === 0 ? "None" : String(c.minDays)) },
    { label: "Platforms", get: (c) => c.platforms.join(", ") },
  ];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Compare Programs"
        description="Find the Terra program that fits your trading style"
      />

      <TerraCard className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-40 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Feature
              </th>
              {programs.map((c) => (
                <th key={c.id} className="px-4 py-3 text-left">
                  <div className="flex flex-col gap-1">
                    <span className="font-headline font-bold text-on-surface">
                      {c.name} {formatMoney(c.accountSize, "USD").replace(".00", "")}
                    </span>
                    {c.popular && <TerraBadge tone="tertiary">Most Popular</TerraBadge>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 0 ? "bg-surface-container-low/60" : ""}
              >
                <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {row.label}
                </td>
                {programs.map((c) => (
                  <td key={c.id} className="px-4 py-3 font-medium text-on-surface">
                    {row.get(c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {programs.map((c) => (
                <td key={c.id} className="px-4 py-4">
                  <Link
                    href={`/checkout?id=${c.id}`}
                    className="inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
                  >
                    Start — {formatMoney(c.price)}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </TerraCard>
    </div>
  );
}
