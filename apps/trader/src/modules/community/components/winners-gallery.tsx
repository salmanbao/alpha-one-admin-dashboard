"use client";

/**
 * Winners gallery — past-edition podium cards.
 *
 * Each card shows the top three of a settled competition with their
 * prizes, labeled as Demo standings, linking to the detail page (where
 * the claim flow lives for the signed-in trader's placement).
 */

import Link from "next/link";
import { Trophy } from "lucide-react";
import { TerraBadge, TerraCard } from "@/components/terra/terra-ui";
import {
  useCatalogCompetitions,
  useCatalogWinners,
} from "@/lib/competitions-catalog";

const rankStyle = [
  "border-warning/60 text-warning",
  "border-outline-variant text-on-surface",
  "border-outline-variant text-on-surface",
];

export function WinnersGallery() {
  // R7 I3 — fixture podiums + operator "Results declared" announcements
  // from prop-admin, over the same catalog that feeds the hub.
  const competitions = useCatalogCompetitions();
  const competitionWinners = useCatalogWinners();
  if (competitionWinners.length === 0) return null;

  return (
    <section aria-labelledby="winners-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="winners-heading" className="font-headline text-lg font-bold text-on-surface">
          Recent winners
        </h2>
        <TerraBadge tone="neutral">Demo</TerraBadge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {competitionWinners.map((w) => {
          const c = competitions.find((x) => x.id === w.competitionId);
          if (!c) return null;
          return (
            <TerraCard key={w.competitionId} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    {c.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Ended {new Date(c.endsAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {c.participants.toLocaleString()} participants
                  </p>
                </div>
                <TerraBadge tone="success">Settled</TerraBadge>
              </div>

              <ol className="space-y-2">
                {w.podium.map((p, i) => (
                  <li
                    key={p.rank}
                    className={`flex items-center justify-between gap-3 rounded-lg border-l-4 px-3 py-2 ${rankStyle[i] ?? rankStyle[2]}`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <strong className="tabular-nums">#{p.rank}</strong>
                      <span className={p.me ? "font-bold text-on-surface" : "text-on-surface-variant"}>
                        {p.trader}
                      </span>
                      {p.me && <TerraBadge tone="primary">You</TerraBadge>}
                    </span>
                    <span className="text-xs font-bold text-on-surface">{p.prize}</span>
                  </li>
                ))}
              </ol>

              <Link
                href={`/competitions/${c.id}`}
                className="inline-block text-xs font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View results & prizes →
              </Link>
            </TerraCard>
          );
        })}
      </div>
    </section>
  );
}
