"use client";

/**
 * Community Leaderboard — converted from stitch_screens/community_leaderboard
 * Ranked traders table with podium top-3 and "me" highlight.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
} from "@/components/terra/terra-ui";
import { leaderboard } from "@/lib/fixtures/terra-fixtures";

const podium = leaderboard.slice(0, 3);

export function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Community Leaderboard"
        description="Top traders this month by percentage gain"
        actions={<TerraBadge tone="primary">October 2026</TerraBadge>}
      />

      {/* Podium */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[podium[1], podium[0], podium[2]].map((t, i) => {
          const place = i === 1 ? 1 : i === 0 ? 2 : 3;
          return (
            <TerraCard
              key={t.rank}
              className={`flex flex-col items-center gap-2 py-8 text-center ${
                place === 1 ? "bg-primary-fixed/40" : ""
              }`}
            >
              <span className="text-3xl">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</span>
              <span className="font-headline text-lg font-bold text-on-surface">
                {t.country} {t.name}
              </span>
              <span className="font-headline text-2xl font-bold tabular-nums text-primary">
                {t.gain}
              </span>
              <span className="text-xs text-on-surface-variant">{t.trades} trades</span>
              {t.me && <TerraBadge tone="secondary">You</TerraBadge>}
            </TerraCard>
          );
        })}
      </div>

      <TerraCard>
        <TerraTable
          head={["Rank", "Trader", "Gain", "Trades"]}
          rows={leaderboard.map((t) => [
            <span key="r" className="font-headline font-bold tabular-nums">
              #{t.rank}
            </span>,
            <span key="n" className={`font-semibold ${t.me ? "text-primary" : ""}`}>
              {t.country} {t.name} {t.me && "· you"}
            </span>,
            <span key="g" className="font-bold tabular-nums text-primary">
              {t.gain}
            </span>,
            t.trades,
          ])}
        />
      </TerraCard>
    </div>
  );
}
