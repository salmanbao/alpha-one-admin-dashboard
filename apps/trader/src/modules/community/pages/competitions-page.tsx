"use client";

/**
 * Competitions — converted from stitch_screens/competitions
 * Active and past trading competitions with prize pools.
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { competitions } from "@/lib/fixtures/terra-fixtures";

export function CompetitionsPage() {
  const active = competitions.filter((c) => c.status === "active");
  const ended = competitions.filter((c) => c.status === "ended");
  const [joined, setJoined] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {active.map((c) => {
          const isJoined = joined.includes(c.id);
          const participants = c.participants + (isJoined ? 1 : 0);
          return (
          <TerraCard key={c.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <h2 className="font-headline text-lg font-bold text-on-surface">{c.name}</h2>
              <TerraBadge tone="primary" dot pulse>
                Active
              </TerraBadge>
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
                  Ends
                </span>
                <span className="font-bold text-on-surface">
                  {new Date(c.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant">
              {participants.toLocaleString()} traders • {c.entry}
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
                <TerraBadge tone="secondary">Ended</TerraBadge>
                {c.placement && (
                  <span className="text-sm font-bold text-primary">#{c.placement}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerraCard>
    </div>
  );
}
