"use client";

/**
 * Challenge Marketplace — converted from stitch_screens/challenge_marketplace_1 + _2
 * Challenge program cards with filter pills and pricing.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

const filters = ["All", "Two-Phase", "Instant"] as const;

export function MarketplacePage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const visible = useMemo(
    () =>
      terraChallenges.filter((c) =>
        filter === "All"
          ? true
          : filter === "Instant"
            ? c.tag === "instant"
            : c.tag === "two-phase",
      ),
    [filter],
  );

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Challenge Marketplace"
        description="Choose your evaluation program and start trading"
        actions={
          <>
            <Link
              href="/challenge-comparison"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Compare programs
            </Link>
            <Link
              href="/purchase-history"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Purchase history
            </Link>
          </>
        }
      />

      {/* Filter pills */}
      <div className="flex items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              filter === f
                ? "bg-primary font-bold text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <TerraEmpty title="No challenges found" description="Try a different filter." />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((ch) => (
            <TerraCard key={ch.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    {ch.name}
                  </h3>
                  <p className="mt-0.5 font-headline text-2xl font-bold text-primary">
                    {formatMoney(ch.accountSize, "USD").replace(".00", "")}
                  </p>
                </div>
                {ch.popular ? (
                  <TerraBadge tone="tertiary">Most Popular</TerraBadge>
                ) : ch.tag === "instant" ? (
                  <TerraBadge tone="primary">Instant</TerraBadge>
                ) : (
                  <TerraBadge tone="secondary">Two-Phase</TerraBadge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-3 text-xs">
                <div>
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Profit Target
                  </span>
                  <span className="font-semibold text-on-surface">{ch.profitTarget}</span>
                </div>
                <div>
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Profit Split
                  </span>
                  <span className="font-semibold text-on-surface">{ch.profitSplit}</span>
                </div>
                <div>
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Daily Loss
                  </span>
                  <span className="font-semibold text-on-surface">{ch.dailyLoss}</span>
                </div>
                <div>
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Max Drawdown
                  </span>
                  <span className="font-semibold text-on-surface">{ch.maxDrawdown}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {ch.platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant"
                  >
                    {p}
                  </span>
                ))}
                {ch.minDays > 0 && (
                  <span className="text-[11px] text-on-surface-variant">
                    Min {ch.minDays} trading days
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-outline-variant/40 pt-4">
                <div>
                  <span className="font-headline text-xl font-bold text-on-surface">
                    {formatMoney(ch.price)}
                  </span>
                  <span className="ml-1 text-xs text-on-surface-variant">one-time</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/challenge-detail?id=${ch.id}`}
                    className="rounded-xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    Details
                  </Link>
                  <Link
                    href={`/checkout?id=${ch.id}`}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
                  >
                    Start Now
                  </Link>
                </div>
              </div>
            </TerraCard>
          ))}
        </div>
      )}
    </div>
  );
}
