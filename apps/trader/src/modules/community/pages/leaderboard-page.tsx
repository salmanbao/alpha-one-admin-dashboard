"use client";

/**
 * Community Leaderboard — converted from stitch_screens/community_leaderboard
 * Ranked traders table with podium top-3 and "me" highlight.
 *
 * Audit finding #5: adds segment filters (challenge type, time period,
 * region) and a "My Ranking" card that benchmarks the trader against
 * the active segment — position, gap to the next rank, and standing
 * versus the segment average. Ranks are always recomputed from the
 * filtered segment, so #1 in a filtered view really means #1 there.
 */

import { useMemo, useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
} from "@/components/terra/terra-ui";
import {
  leaderboard,
  type LeaderboardEntry,
} from "@/lib/fixtures/terra-fixtures";

/* ------------------------------------------------------------------ */
/* Filter definitions                                                  */
/* ------------------------------------------------------------------ */

type Period = "thisMonth" | "lastMonth" | "allTime";
type Challenge = "all" | LeaderboardEntry["challenge"];
type Region = "all" | LeaderboardEntry["region"];

const periodOptions: readonly { id: Period; label: string }[] = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "allTime", label: "All time" },
];

const challengeLabel: Record<LeaderboardEntry["challenge"], string> = {
  "flash-50k": "Flash 50K",
  "evaluation-100k": "Evaluation 100K",
  funded: "Funded",
};

const challengeOptions: readonly { id: Challenge; label: string }[] = [
  { id: "all", label: "All challenges" },
  { id: "flash-50k", label: "Flash 50K" },
  { id: "evaluation-100k", label: "Evaluation 100K" },
  { id: "funded", label: "Funded" },
];

const regionLabel: Record<LeaderboardEntry["region"], string> = {
  americas: "Americas",
  emea: "EMEA",
  apac: "APAC",
};

const regionOptions: readonly { id: Region; label: string }[] = [
  { id: "all", label: "All regions" },
  { id: "americas", label: "Americas" },
  { id: "emea", label: "EMEA" },
  { id: "apac", label: "APAC" },
];

/** Header badge for the active period — stable labels, no Date math. */
const periodBadge: Record<Period, string> = {
  thisMonth: "October 2026",
  lastMonth: "September 2026",
  allTime: "All time",
};

const fmtGain = (value: number) => `+${value.toFixed(1)}%`;

/* ------------------------------------------------------------------ */
/* Filter chips                                                        */
/* ------------------------------------------------------------------ */

/** Chip-style single-select filter used for all three facets. */
function FilterChips<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        {legend}
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              value === opt.id
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/60 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [challenge, setChallenge] = useState<Challenge>("all");
  const [region, setRegion] = useState<Region>("all");

  /** The active segment — filtered, then re-ranked by the chosen period. */
  const segment = useMemo(
    () =>
      leaderboard
        .filter(
          (t) =>
            (challenge === "all" || t.challenge === challenge) &&
            (region === "all" || t.region === region),
        )
        .slice()
        .sort((a, b) => b.gains[period] - a.gains[period]),
    [period, challenge, region],
  );

  const me = segment.find((t) => t.me);
  const meIndex = me ? segment.indexOf(me) : -1;
  const podium = segment.slice(0, 3);
  const segmentAvg =
    segment.length > 0
      ? segment.reduce((sum, t) => sum + t.gains[period], 0) / segment.length
      : 0;
  const leader = segment[0];
  const ahead = me && meIndex > 0 ? segment[meIndex - 1] : undefined;
  const vsAvg = me ? me.gains[period] - segmentAvg : 0;
  const topPct = me
    ? Math.max(1, Math.ceil(((meIndex + 1) / segment.length) * 100))
    : 0;
  /** Share of the leader's gain — how far the trader is from the top. */
  const leaderShare = me && leader ? (me.gains[period] / leader.gains[period]) * 100 : 0;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Community Leaderboard"
        description="Top traders by percentage gain — filter by challenge, region, and period to compare against your real peers"
        actions={<TerraBadge tone="primary">{periodBadge[period]}</TerraBadge>}
      />

      {/* Segment filters (audit #5) — challenge type, period, region */}
      <TerraCard>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <FilterChips
            legend="Time period"
            options={periodOptions}
            value={period}
            onChange={setPeriod}
          />
          <FilterChips
            legend="Challenge type"
            options={challengeOptions}
            value={challenge}
            onChange={setChallenge}
          />
          <FilterChips
            legend="Region"
            options={regionOptions}
            value={region}
            onChange={setRegion}
          />
        </div>
      </TerraCard>

      {/* My Ranking (audit #5) — position and context within the segment */}
      {me ? (
        <TerraCard className="bg-primary-fixed/20">
          <TerraSectionTitle
            title="My Ranking"
            description={`${challengeLabel[me.challenge]} · ${regionLabel[me.region]} · ${periodBadge[period]}`}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Position
              </p>
              <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                #{meIndex + 1}
                <span className="ml-1 text-sm font-semibold text-on-surface-variant">
                  of {segment.length}
                </span>
              </p>
              <p className="text-xs text-on-surface-variant">Top {topPct}% of segment</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                My gain
              </p>
              <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                {fmtGain(me.gains[period])}
              </p>
              <p className="text-xs text-on-surface-variant">
                {vsAvg >= 0
                  ? `${fmtGain(vsAvg)} above the ${fmtGain(segmentAvg)} segment average`
                  : `${fmtGain(Math.abs(vsAvg))} below the ${fmtGain(segmentAvg)} segment average`}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Gap to next place
              </p>
              <p className="font-headline text-2xl font-bold tabular-nums text-on-surface">
                {ahead ? `${(ahead.gains[period] - me.gains[period]).toFixed(1)} pts` : "—"}
              </p>
              <p className="text-xs text-on-surface-variant">
                {ahead ? `behind ${ahead.name} (#${meIndex})` : "you're at the top of this segment"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                vs. segment leader
              </p>
              <p className="font-headline text-2xl font-bold tabular-nums text-on-surface">
                {Math.round(leaderShare)}%
              </p>
              <p className="text-xs text-on-surface-variant">
                of {leader ? `${leader.name}'s ${fmtGain(leader.gains[period])}` : "—"}
              </p>
            </div>
          </div>
        </TerraCard>
      ) : (
        <TerraCard>
          <p className="text-sm font-semibold text-on-surface">
            You&apos;re not ranked in this segment yet.
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Only traders matching the active filters appear here — switch back to
            &ldquo;All challenges / All regions&rdquo; to find your row, or trade the
            selected challenge to enter its ranking.
          </p>
        </TerraCard>
      )}

      {/* Podium — top 3 of the active segment */}
      {podium.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[podium[1], podium[0], podium[2]].map((t, i) => {
            if (!t) return null;
            const place = i === 1 ? 1 : i === 0 ? 2 : 3;
            return (
              <TerraCard
                key={t.name}
                className={`flex flex-col items-center gap-2 py-8 text-center ${
                  place === 1 ? "bg-primary-fixed/40" : ""
                }`}
              >
                <span className="text-3xl">
                  {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
                </span>
                <span className="font-headline text-lg font-bold text-on-surface">
                  {t.country} {t.name}
                </span>
                <span className="font-headline text-2xl font-bold tabular-nums text-primary">
                  {fmtGain(t.gains[period])}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {challengeLabel[t.challenge]} · {t.trades} trades
                </span>
                {t.me && <TerraBadge tone="secondary">You</TerraBadge>}
              </TerraCard>
            );
          })}
        </div>
      ) : null}

      {/* Full ranked table for the active segment */}
      {segment.length > 0 ? (
        <TerraCard>
          <TerraTable
            head={["Rank", "Trader", "Challenge", "Gain", "Trades"]}
            rows={segment.map((t, i) => [
              <span key="r" className="font-headline font-bold tabular-nums">
                #{i + 1}
              </span>,
              <span key="n" className={`font-semibold ${t.me ? "text-primary" : ""}`}>
                {t.country} {t.name} {t.me && "· you"}
              </span>,
              <span key="c" className="text-xs text-on-surface-variant">
                {challengeLabel[t.challenge]} · {regionLabel[t.region]}
              </span>,
              <span key="g" className="font-bold tabular-nums text-primary">
                {fmtGain(t.gains[period])}
              </span>,
              t.trades,
            ])}
          />
        </TerraCard>
      ) : (
        <TerraEmpty
          title="No traders match these filters"
          description="This challenge + region combination has no ranked traders yet. Broaden a filter to see the standings."
        />
      )}
    </div>
  );
}
