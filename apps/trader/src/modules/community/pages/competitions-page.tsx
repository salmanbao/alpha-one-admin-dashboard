"use client";

/**
 * Competitions — converted from stitch_screens/competitions
 * Active and past trading competitions with prize pools.
 *
 * + "My Competitions" management (audit: enrollment tracking) — every
 *   competition you've joined with status, deadline countdown and a
 *   deterministic current standing, plus status filters (All / Active /
 *   Upcoming / Past) over the full catalog.
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { competitions } from "@/lib/fixtures/terra-fixtures";

type Competition = (typeof competitions)[number];
type StatusFilter = "all" | "active" | "upcoming" | "past";

/** Whole days from now until an ISO date (negative = already passed). */
const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Current standing — deterministic mock rank derived from the id, so
 * the number is stable across renders (no Math.random()).
 */
const standingFor = (c: Competition) =>
  1 + ([...c.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % Math.max(1, c.participants));

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

/** Deadline copy per status: countdown for live/upcoming, final for ended. */
function deadlineLine(c: Competition) {
  if (c.status === "ended") return `Ended ${fmtDay(c.endsAt)}`;
  const days = daysUntil(c.endsAt);
  if (c.status === "upcoming") {
    const starts = daysUntil(c.startsAt);
    return starts > 0
      ? `Starts in ${starts} day${starts === 1 ? "" : "s"} (${fmtDay(c.startsAt)})`
      : `Registration open — ends in ${days} day${days === 1 ? "" : "s"}`;
  }
  return days > 0
    ? `Ends in ${days} day${days === 1 ? "" : "s"} (${fmtDay(c.endsAt)})`
    : `Final day — ends ${fmtDay(c.endsAt)}`;
}

export function CompetitionsPage() {
  const active = competitions.filter((c) => c.status === "active");
  const upcoming = competitions.filter((c) => c.status === "upcoming");
  const ended = competitions.filter((c) => c.status === "ended");
  const [joined, setJoined] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Enrollment management — filter the catalog by lifecycle status.
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible =
    filter === "active"
      ? active
      : filter === "upcoming"
        ? upcoming
        : filter === "past"
          ? ended
          : competitions;
  const joinedCompetitions = competitions.filter((c) => joined.includes(c.id));

  const handleToggleJoin = (id: string, name: string) => {
    const nowJoined = !joined.includes(id);
    setJoined((prev) =>
      nowJoined ? [...prev, id] : prev.filter((x) => x !== id),
    );
    setNotice(
      nowJoined
        ? `You joined ${name} — good luck! (Demo)`
        : `You left ${name}. (Demo)`,
    );
    setTimeout(() => setNotice(null), 4500);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Competitions"
        description="Compete against other traders for prize pools"
      />

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          {notice}
        </div>
      )}

      {/* My Competitions — enrolled events with status, deadlines and
          current standing, so nothing is missed between visits (audit:
          dedicated enrollment management view) */}
      <TerraCard>
        <TerraSectionTitle
          title="My Competitions"
          description="Your enrollments — status, deadlines and current standing."
        />
        {joinedCompetitions.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-on-surface-variant">
            You haven&apos;t joined a competition yet — pick one from the
            catalog below.
          </p>
        ) : (
          <div className="space-y-3">
            {joinedCompetitions.map((c) => {
              const isEnded = c.status === "ended";
              const rank = standingFor(c);
              return (
                <div
                  key={c.id}
                  className="rounded-xl bg-surface-container-low px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-on-surface">{c.name}</p>
                      {statusBadge(c.status)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleJoin(c.id, c.name)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error-container/40"
                    >
                      {isEnded ? "Dismiss" : "Leave"}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    <span className="font-semibold text-primary">{c.prize}</span>
                    <span>{deadlineLine(c)}</span>
                    <span>
                      Standing:{" "}
                      <span className="font-bold text-on-surface">
                        {isEnded && c.placement
                          ? `#${c.placement} final`
                          : `#${rank.toLocaleString()} of ${c.participants.toLocaleString()}`}
                      </span>
                    </span>
                    <span>{c.entry}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TerraCard>

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
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
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
          <TerraCard>
            <p className="py-6 text-center text-sm text-on-surface-variant">
              No {filter} competitions right now — check back soon.
            </p>
          </TerraCard>
        ) : filter === "past" ? (
          <TerraCard>
            <TerraSectionTitle title="Past competitions" />
            <div className="space-y-3">
              {ended.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{c.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {c.participants.toLocaleString()} traders • {c.prize}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TerraBadge tone="neutral">Ended</TerraBadge>
                    {c.placement && (
                      <span className="text-sm font-bold text-primary">#{c.placement}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TerraCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map((c) => {
              const isJoined = joined.includes(c.id);
              const participants = c.participants + (isJoined ? 1 : 0);
              return (
                <TerraCard key={c.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <h2 className="font-headline text-lg font-bold text-on-surface">
                      {c.name}
                    </h2>
                    {statusBadge(c.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-surface-container-low p-3">
                      <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                        Prize
                      </span>
                      <span className="font-bold text-primary">{c.prize}</span>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-3">
                      <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                        {c.status === "upcoming" ? "Starts" : "Ends"}
                      </span>
                      <span className="font-bold text-on-surface">
                        {fmtDay(c.status === "upcoming" ? c.startsAt : c.endsAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {participants.toLocaleString()} traders • {c.entry} •{" "}
                    {deadlineLine(c)}
                    {isJoined && (
                      <span className="ml-1 font-bold text-primary">
                        • Standing #{standingFor(c).toLocaleString()}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleToggleJoin(c.id, c.name)}
                    aria-pressed={isJoined}
                    className={
                      isJoined
                        ? "mt-auto w-full rounded-xl bg-primary-fixed px-5 py-2.5 text-sm font-bold text-on-primary-fixed-variant hover:bg-primary-fixed/80"
                        : "mt-auto w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                    }
                  >
                    {isJoined ? "✓ Joined — click to leave" : "Join competition"}
                  </button>
                </TerraCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
