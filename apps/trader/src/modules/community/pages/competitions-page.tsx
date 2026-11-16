"use client";

/**
 * Competitions hub (R6 rebuild).
 *
 *   Hero         — featured banners with the full prize headline,
 *                  countdown and participant cap (scroll-snap carousel).
 *   My Competitions — enrollments with standing, gap-to-next-rank,
 *                  urgency countdown and the prize-claim panel.
 *   Catalog      — every competition as a card: prize headline,
 *                  countdown, cap progress, entry tag, link to detail.
 *   Winners      — past podiums (Demo).
 *
 * Join/leave/claim write through `competitions-store` (R10) and surface
 * honest refusal reasons — nothing is toast-only.
 */

import Link from "next/link";
import { useState } from "react";
import { Gift, Trophy } from "lucide-react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  formatNumber,
} from "@/components/terra/terra-ui";
import {
  competitionGapFor,
  competitionStandingFor,
  prizeTierFor,
  type Competition,
} from "@/lib/fixtures/terra-fixtures";
import { useCatalogCompetitions } from "@/lib/competitions-catalog";
import {
  claimFor,
  joinCompetition,
  leaveCompetition,
  useCompetitions,
} from "@/lib/competitions-store";
import { CompetitionCountdown } from "../components/competition-countdown";
import { CompetitionHero } from "../components/competition-hero";
import { PrizeClaimDialog } from "../components/prize-claim-dialog";
import { WinnersGallery } from "../components/winners-gallery";

type StatusFilter = "all" | "active" | "upcoming" | "past";

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const statusBadge = (status: Competition["status"]) =>
  status === "active" ? (
    <TerraBadge tone="primary" dot pulse>
      Active
    </TerraBadge>
  ) : status === "upcoming" ? (
    <TerraBadge tone="secondary">Upcoming</TerraBadge>
  ) : (
    <TerraBadge tone="neutral">Ended</TerraBadge>
  );

/** Whole days from now (negative = passed) — urgency copy. */
const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** Entry requirement tag — one short line per card. */
function entryTag(c: Competition) {
  if (c.status === "ended") return "Closed";
  if (c.registrationClosesAt && daysUntil(c.registrationClosesAt) <= 1)
    return "Closes soon";
  return c.entryRequirement.label;
}

/** Cap fill 0..100 (null when uncapped). */
const capPct = (c: Competition) =>
  c.participantCap
    ? Math.min(100, Math.round((c.participants / c.participantCap) * 100))
    : null;

export function CompetitionsPage() {
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [claimOpen, setClaimOpen] = useState<string | null>(null);
  const { entries, claims } = useCompetitions();
  // R7 I3 — fixtures + competitions the operator published from
  // prop-admin (derived from the shared lifecycle log).
  const competitions = useCatalogCompetitions();

  const active = competitions.filter((c) => c.status === "active");
  const upcoming = competitions.filter((c) => c.status === "upcoming");
  const ended = competitions.filter((c) => c.status === "ended");
  const joinedIds = entries.map((e) => e.competitionId);

  const visible =
    filter === "active"
      ? active
      : filter === "upcoming"
        ? upcoming
        : filter === "past"
          ? ended
          : competitions;
  const joinedCompetitions = competitions.filter((c) => joinedIds.includes(c.id));

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const handleToggleJoin = (c: Competition) => {
    if (joinedIds.includes(c.id)) {
      leaveCompetition(c.id);
      flash(`You left ${c.name}. (Demo)`);
      return;
    }
    const result = joinCompetition(c.id);
    if (result.ok) {
      flash(`You joined ${c.name} — good luck! (Demo)`);
    } else {
      // Honest refusal — the store decided, we just show the reason.
      flash(result.reason);
    }
  };

  const claimable = joinedCompetitions.filter((c) => {
    if (c.status !== "ended" || !c.placement) return false;
    const tier = prizeTierFor(c, c.placement);
    const claim = claimFor(c.id);
    return !!tier && !claim;
  });

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Competitions"
        description="Live trading competitions with cash pools and real prizes"
        actions={
          <TerraBadge tone="neutral">Demo standings</TerraBadge>
        }
      />

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          {notice}
        </div>
      )}

      <CompetitionHero competitions={competitions} />

      {/* My Competitions — enrollments with standing, urgency and the
          claim panel for settled prizes (audit: enrollment tracking) */}
      <TerraCard>
        <TerraSectionTitle
          title="My Competitions"
          description="Your enrollments — standing, deadlines and prizes to claim."
        />
        {joinedCompetitions.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-on-surface-variant">
            You haven&apos;t joined a competition yet — pick one from the
            catalog below.
          </p>
        ) : (
          <div className="space-y-3">
            {joinedCompetitions.map((c) => {
              const endedNow = c.status === "ended";
              const rank = endedNow && c.placement ? c.placement : competitionStandingFor(c);
              const gap = endedNow ? null : competitionGapFor(c, rank);
              const tier = endedNow && c.placement ? prizeTierFor(c, c.placement) : undefined;
              const claim = claimFor(c.id);
              const closingSoon =
                !endedNow &&
                c.registrationClosesAt !== undefined &&
                daysUntil(c.registrationClosesAt) <= 3;
              return (
                <div key={c.id} className="rounded-xl bg-surface-container-low px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/competitions/${c.id}`}
                        className="text-sm font-bold text-on-surface hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {c.name}
                      </Link>
                      {statusBadge(c.status)}
                      {closingSoon && (
                        <TerraBadge tone="error">Closes soon</TerraBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!endedNow && (
                        <button
                          type="button"
                          onClick={() => handleToggleJoin(c)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error-container/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Leave
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    <span className="font-semibold text-primary">
                      {c.prizeHeadline}
                    </span>
                    {!endedNow && (
                      <CompetitionCountdown
                        startsAt={c.startsAt}
                        endsAt={c.endsAt}
                        status={c.status}
                        withLabel={false}
                      />
                    )}
                    <span>
                      Standing:{" "}
                      <span className="font-bold text-on-surface">
                        {endedNow
                          ? `#${rank} final`
                          : `#${formatNumber(rank)} of ${formatNumber(c.participants)}`}
                      </span>
                    </span>
                    {gap !== null && (
                      <span>
                        Gap to next rank:{" "}
                        <span className="font-bold text-on-surface">
                          {gap.toFixed(1)}pp
                        </span>
                      </span>
                    )}
                    {endedNow && tier && (
                      <span>
                        Prize:{" "}
                        <span className="font-bold text-on-surface">{tier.label}</span>
                      </span>
                    )}
                  </div>

                  {/* Claim panel — settled prize, honest states */}
                  {endedNow && tier && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-lowest px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                        <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                        {claim
                          ? "Claimed — shipping details received (Demo)"
                          : "You finished in the money — claim your prize"}
                      </span>
                      {claim ? (
                        <TerraBadge tone="success">Claimed</TerraBadge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setClaimOpen(c.id)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Claim {tier.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TerraCard>

      {/* Pending claims from past editions the user hasn't joined yet */}
      {claimable.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary-fixed/40 px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-on-primary-fixed-variant">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            You have {claimable.length === 1 ? "a prize" : "prizes"} waiting to be
            claimed.
          </span>
          <button
            type="button"
            onClick={() => setClaimOpen(claimable[0].id)}
            className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Claim now
          </button>
        </div>
      )}

      {/* Catalog — filter chips + cards for every competition */}
      <div>
        <div
          className="mb-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter competitions by status"
        >
          {(
            [
              ["all", "All", competitions.length],
              ["active", "Active", active.length],
              ["upcoming", "Upcoming", upcoming.length],
              ["past", "Past", ended.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                filter === key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <TerraEmpty
            icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
            title={`No ${filter} competitions`}
            description="Check back soon — new competitions open every month."
            actionLabel="Show all"
            actionHref="/competitions"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map((c) => {
              const isJoined = joinedIds.includes(c.id);
              const participants = c.participants + (isJoined ? 1 : 0);
              const pct = capPct(c);
              const physical = c.prizes.find((p) => p.kind === "physical");
              return (
                <TerraCard key={c.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-headline text-lg font-bold text-on-surface">
                      <Link
                        href={`/competitions/${c.id}`}
                        className="hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {c.name}
                      </Link>
                    </h2>
                    {statusBadge(c.status)}
                  </div>

                  <p className="font-headline text-base font-bold text-primary">
                    {c.prizeHeadline}
                  </p>
                  {physical && (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">
                      📱 {physical.label} for 1st place
                    </span>
                  )}

                  <CompetitionCountdown
                    startsAt={c.startsAt}
                    endsAt={c.endsAt}
                    status={c.status}
                  />

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface-variant">
                        {formatNumber(participants)}
                        {c.participantCap
                          ? ` / ${formatNumber(c.participantCap)} traders`
                          : " traders"}
                      </span>
                      <TerraBadge tone={entryTag(c) === "Closes soon" ? "error" : "neutral"}>
                        {entryTag(c)}
                      </TerraBadge>
                    </div>
                    {pct !== null && (
                      <TerraProgress value={pct} height="h-1.5" />
                    )}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Link
                      href={`/competitions/${c.id}`}
                      className="flex-1 rounded-xl border border-outline-variant px-4 py-2.5 text-center text-sm font-bold text-on-surface-variant hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      View details
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleJoin(c)}
                      aria-pressed={isJoined}
                      disabled={c.status === "ended"}
                      className={
                        isJoined
                          ? "flex-1 rounded-xl bg-primary-fixed px-4 py-2.5 text-sm font-bold text-on-primary-fixed-variant hover:bg-primary-fixed/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                          : "flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                      }
                    >
                      {c.status === "ended"
                        ? "Closed"
                        : isJoined
                          ? "✓ Joined — leave"
                          : "Join competition"}
                    </button>
                  </div>
                </TerraCard>
              );
            })}
          </div>
        )}
      </div>

      <WinnersGallery />

      {/* Claim dialog for whichever competition is pending */}
      {claimOpen && (
        <PrizeClaimDialog
          competition={competitions.find((c) => c.id === claimOpen)!}
          open
          onOpenChange={(o) => !o && setClaimOpen(null)}
        />
      )}
    </div>
  );
}
