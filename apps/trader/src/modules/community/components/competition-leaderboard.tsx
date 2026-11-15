"use client";

/**
 * Per-competition leaderboard — seeded top 10 (Demo) plus the signed-in
 * trader's pinned standing row.
 *
 * Standings are labeled honestly as demo data; the pinned row shows the
 * gap to the next rank so a joiner can see what it takes. Links out to
 * the full leaderboard screen.
 */

import Link from "next/link";
import { Medal } from "lucide-react";
import { TerraBadge } from "@/components/terra/terra-ui";
import {
  competitionGapFor,
  competitionGainPctFor,
  competitionLeaderboards,
  competitionStandingFor,
  type Competition,
} from "@/lib/fixtures/terra-fixtures";

const medal = (rank: number) =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

export function CompetitionLeaderboard({ competition }: { competition: Competition }) {
  const rows = competitionLeaderboards[competition.id] ?? [];
  const standing = competitionStandingFor(competition);
  const gap = competitionGapFor(competition, standing);
  const gain = competitionGainPctFor(competition);
  const pinnedAbove = rows.some((r) => r.rank === standing);
  const myRank = pinnedAbove ? standing : Math.min(standing, rows.length + 1);

  return (
    <section aria-label={`Leaderboard — ${competition.name}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-headline text-base font-bold text-on-surface">
          Leaderboard
        </h3>
        <Link
          href="/leaderboard"
          className="text-xs font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Full leaderboard →
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/60">
        <table className="w-full min-w-[420px] text-left text-sm">
          <caption className="sr-only">
            Demo standings for {competition.name} — final results after settlement
          </caption>
          <thead>
            <tr className="border-b border-outline-variant/60 bg-surface-container-low">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Rank
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Trader
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Gain
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Trades
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rank}
                className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low/60"
              >
                <td className="px-4 py-2.5 font-bold tabular-nums">{medal(r.rank)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{r.trader}</span>{" "}
                  <span aria-hidden="true">{r.country}</span>
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-primary">
                  +{r.gainPct.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 tabular-nums text-on-surface-variant">
                  {r.trades}
                </td>
              </tr>
            ))}
            {!pinnedAbove && (
              <tr className="bg-primary-fixed/40">
                <td className="px-4 py-2.5 font-bold tabular-nums text-primary">
                  #{myRank}
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-bold">You</span>{" "}
                  <TerraBadge tone="primary">Demo</TerraBadge>
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-primary">
                  +{gain.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 tabular-nums text-on-surface-variant">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <Medal className="h-3.5 w-3.5" aria-hidden="true" />
          {competition.status === "ended"
            ? "Demo standings — final results after settlement"
            : "Demo standings — live results after settlement"}
        </span>
        {gap !== null && competition.status !== "ended" && (
          <span>
            You are <strong className="text-on-surface">{gap.toFixed(1)}pp</strong> behind
            rank #{myRank - 1}.
          </span>
        )}
      </div>
    </section>
  );
}
