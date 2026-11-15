"use client";

/**
 * Hero banner carousel — the featured competitions above the fold.
 *
 * One full-width banner per featured competition, rotated with CSS
 * scroll-snap (no carousel dependency). Dots are real buttons with
 * aria-labels; content leads with the prize headline so the tangible
 * prize (iPhone-class) is the first thing a visitor reads.
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { Gift, Smartphone, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { TerraBadge, formatNumber } from "@/components/terra/terra-ui";
import type { Competition } from "@/lib/fixtures/terra-fixtures";
import { CompetitionCountdown } from "./competition-countdown";

const themeSurface: Record<Competition["theme"], string> = {
  aurora:
    "bg-gradient-to-r from-primary-fixed via-tertiary-fixed to-secondary-container",
  ember:
    "bg-gradient-to-r from-error-container/70 via-secondary-container to-tertiary-fixed",
  abyss:
    "bg-gradient-to-r from-surface-container-high via-secondary-container to-tertiary-fixed",
};

/** First physical prize, if the competition has one — the signup hook. */
function physicalPrize(c: Competition) {
  return c.prizes.find((p) => p.kind === "physical");
}

function statusBadge(c: Competition) {
  return c.status === "active" ? (
    <TerraBadge tone="primary" dot pulse>
      Active
    </TerraBadge>
  ) : c.status === "upcoming" ? (
    <TerraBadge tone="secondary">Upcoming</TerraBadge>
  ) : (
    <TerraBadge tone="neutral">Ended</TerraBadge>
  );
}

export function CompetitionHero({ competitions }: { competitions: Competition[] }) {
  const featured = competitions.filter((c) => c.featured);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (featured.length === 0) return null;

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollTo = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActive(index);
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
        aria-label="Featured competitions"
      >
        {featured.map((c) => {
          const physical = physicalPrize(c);
          const capped = c.participantCap ? Math.min(100, Math.round((c.participants / c.participantCap) * 100)) : null;
          return (
            <section
              key={c.id}
              aria-label={c.name}
              className={cn(
                "w-full shrink-0 snap-center rounded-2xl p-6 sm:p-8",
                themeSurface[c.theme],
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(c)}
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                      <Trophy className="h-3 w-3" aria-hidden="true" />
                      Featured
                    </span>
                  </div>
                  <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                    {c.name}
                  </h2>
                  <p className="text-sm text-on-surface-variant">{c.tagline}</p>
                  <p className="font-headline text-lg font-bold text-primary sm:text-xl">
                    Win {c.prizeHeadline}
                  </p>
                  {physical && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant">
                      <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                      {physical.label} for 1st place
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <CompetitionCountdown
                    startsAt={c.startsAt}
                    endsAt={c.endsAt}
                    status={c.status}
                    className="bg-surface-container-lowest/80"
                  />
                  <p className="text-xs font-semibold text-on-surface-variant">
                    {formatNumber(c.participants)}
                    {c.participantCap
                      ? ` / ${formatNumber(c.participantCap)} traders`
                      : " traders"}
                    {capped !== null && ` · ${capped}% full`}
                  </p>
                  <Link
                    href={`/competitions/${c.id}`}
                    className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    View details
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {featured.length > 1 && (
        <div
          className="mt-3 flex justify-center gap-2"
          role="group"
          aria-label="Choose featured banner"
        >
          {featured.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Show banner ${i + 1}: ${c.name}`}
              aria-current={active === i}
              onClick={() => scrollTo(i)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                active === i ? "bg-primary" : "bg-outline-variant hover:bg-on-surface-variant/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
