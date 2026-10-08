"use client";

/**
 * Challenge Detail — converted from stitch_screens/challenge_detail
 * Program spec sheet with phase breakdown, rules summary and purchase CTA.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

export function ChallengeDetailPage() {
  const params = useSearchParams();
  const ch =
    terraChallenges.find((c) => c.id === params.get("id")) ?? terraChallenges[1];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`${ch.name} ${formatMoney(ch.accountSize, "USD").replace(".00", "")}`}
        description="Program specification and evaluation rules"
        actions={
          <>
            <TerraBadge tone={ch.tag === "instant" ? "primary" : "secondary"}>
              {ch.tag === "instant" ? "Instant Funding" : "Two-Phase"}
            </TerraBadge>
            {ch.popular && <TerraBadge tone="tertiary">Most Popular</TerraBadge>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Spec sheet */}
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="What's included" />
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ["Account Size", formatMoney(ch.accountSize, "USD").replace(".00", "")],
                ["Profit Split", ch.profitSplit],
                ["Profit Target", ch.profitTarget],
                ["Daily Loss", ch.dailyLoss],
                ["Max Drawdown", ch.maxDrawdown],
                ["Min Days", ch.minDays === 0 ? "None" : `${ch.minDays} days`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-container-low p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {k}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{v}</span>
                </div>
              ))}
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle
              title="Evaluation phases"
              description={ch.tag === "instant" ? "Single step — instant funded account" : "Two-step evaluation"}
            />
            <TerraTable
              head={["Phase", "Profit Target", "Daily Loss", "Max DD", "Min Days"]}
              rows={
                ch.tag === "instant"
                  ? [["Instant Funded", "—", ch.dailyLoss, ch.maxDrawdown, "—"]]
                  : [
                      ["Phase 1", "6%", ch.dailyLoss, ch.maxDrawdown, String(ch.minDays)],
                      ["Phase 2", "4%", ch.dailyLoss, ch.maxDrawdown, String(ch.minDays)],
                      ["Funded", "—", ch.dailyLoss, "6% trailing", "—"],
                    ]
              }
            />
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Included platforms" />
            <div className="flex flex-wrap gap-2">
              {ch.platforms.map((p) => (
                <span
                  key={p}
                  className="rounded-lg bg-surface-container px-3 py-1.5 text-sm font-semibold text-on-surface"
                >
                  {p}
                </span>
              ))}
            </div>
          </TerraCard>
        </div>

        {/* Purchase card */}
        <div className="lg:col-span-1">
          <TerraCard className="sticky top-24 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                One-time fee
              </p>
              <p className="font-headline text-4xl font-bold text-on-surface">
                {formatMoney(ch.price)}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Refundable with your first payout
              </p>
            </div>
            <ul className="space-y-2 text-sm text-on-surface">
              {[
                `${ch.profitSplit} profit split`,
                "Bi-weekly payouts",
                "No time limit",
                "Free retries on Phase 1",
                "24/7 dashboard access",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/checkout?id=${ch.id}`}
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
            >
              Start Challenge — {formatMoney(ch.price)}
            </Link>
            <Link
              href="/challenge-comparison"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              Compare programs
            </Link>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
