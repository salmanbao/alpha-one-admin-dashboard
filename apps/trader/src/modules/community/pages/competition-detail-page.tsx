"use client";

/**
 * Competition detail — full prize table, rules, leaderboard and a sticky
 * join panel.
 *
 * The join flow is explicit: requirements checkboxes gate a confirm
 * dialog (focus-trapped, Escape-closable via @/components/ui/dialog),
 * and the store's honest refusal reason is surfaced when it declines.
 * Ended competitions show results + the claim entry point instead.
 */

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Gift, ShieldCheck, Trophy, Users } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  competitionGainPctFor,
  prizeTierFor,
} from "@/lib/fixtures/terra-fixtures";
import { useCatalogCompetitions } from "@/lib/competitions-catalog";
import {
  claimFor,
  isJoined,
  joinCompetition,
  leaveCompetition,
  useCompetitions,
} from "@/lib/competitions-store";
import { CompetitionCountdown } from "../components/competition-countdown";
import { CompetitionLeaderboard } from "../components/competition-leaderboard";
import { PrizeClaimDialog } from "../components/prize-claim-dialog";
import { PrizeTable } from "../components/prize-table";

const metricLabel = {
  "gain-percent": "Highest net gain (%)",
  "absolute-profit": "Absolute profit (USD)",
  "risk-adjusted": "Risk-adjusted return",
} as const;

const themeSurface = {
  aurora: "bg-gradient-to-r from-primary-fixed via-tertiary-fixed to-secondary-container",
  ember: "bg-gradient-to-r from-error-container/70 via-secondary-container to-tertiary-fixed",
  abyss: "bg-gradient-to-r from-surface-container-high via-secondary-container to-tertiary-fixed",
} as const;

export function CompetitionDetailPage({ id }: { id: string }) {
  // R7 I3 — catalog = fixtures + operator-published competitions; hook
  // runs before the not-found early return below.
  const competitions = useCatalogCompetitions();
  const competition = competitions.find((c) => c.id === id);
  const { entries } = useCompetitions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [reqs, setReqs] = useState({ kyc: false, rules: false, oneAccount: false });
  const [error, setError] = useState<string | null>(null);

  if (!competition) {
    return (
      <div className="space-y-6">
        <TerraPageHeader title="Competition" />
        <TerraEmpty
          icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
          title="Competition not found"
          description="This competition doesn't exist or has been removed."
          actionLabel="Back to competitions"
          actionHref="/competitions"
        />
      </div>
    );
  }

  const c = competition;
  const joined = entries.some((e) => e.competitionId === c.id);
  const ended = c.status === "ended";
  const claim = claimFor(c.id);
  const tier = ended && c.placement ? prizeTierFor(c, c.placement) : undefined;
  const pct = c.participantCap
    ? Math.min(100, Math.round((c.participants / c.participantCap) * 100))
    : null;
  const allReqs = reqs.kyc && reqs.rules && reqs.oneAccount;
  const gain = competitionGainPctFor(c);

  function confirmJoin() {
    const result = joinCompetition(c.id);
    if (result.ok) {
      setConfirmOpen(false);
      setError(null);
    } else {
      setConfirmOpen(false);
      setError(result.reason);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All competitions
        </Link>
      </div>

      {/* Banner — prize-led, same theme system as the hero carousel */}
      <section
        aria-label={c.name}
        className={`rounded-2xl p-6 sm:p-8 ${themeSurface[c.theme]}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {c.status === "active" ? (
                <TerraBadge tone="primary" dot pulse>
                  Active
                </TerraBadge>
              ) : c.status === "upcoming" ? (
                <TerraBadge tone="secondary">Upcoming</TerraBadge>
              ) : (
                <TerraBadge tone="neutral">Ended</TerraBadge>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {formatNumber(c.participants)}
                {c.participantCap ? ` / ${formatNumber(c.participantCap)}` : ""} traders
              </span>
            </div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
              {c.name}
            </h1>
            <p className="text-sm text-on-surface-variant">{c.tagline}</p>
            <p className="font-headline text-lg font-bold text-primary sm:text-xl">
              Win {c.prizeHeadline}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <CompetitionCountdown
              startsAt={c.startsAt}
              endsAt={c.endsAt}
              status={c.status}
              className="bg-surface-container-lowest/80"
            />
            <p className="text-xs font-semibold text-on-surface-variant">
              {new Date(c.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {new Date(c.endsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl bg-error-container/60 px-4 py-3 text-sm font-semibold text-on-error-container">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {/* Prize table */}
          <section aria-labelledby="prizes-h" className="space-y-3">
            <TerraSectionTitle
              title="Prizes"
              description="Top 10 in cash and hardware — demo standings (Demo)."
            />
            <h2 id="prizes-h" className="sr-only">
              Prizes
            </h2>
            <PrizeTable prizes={c.prizes} />
          </section>

          {/* How it works / rules */}
          <TerraCard className="space-y-3">
            <TerraSectionTitle title="How it works" />
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Ranked by <strong className="text-on-surface">{metricLabel[c.rules.metric]}</strong>{" "}
                  across the competition window.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Minimum <strong className="text-on-surface">{c.rules.minTrades}</strong> closed
                  trades to place.
                </span>
              </li>
              {c.rules.maxDailyDrawdownPct !== undefined && (
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    Daily drawdown capped at{" "}
                    <strong className="text-on-surface">{c.rules.maxDailyDrawdownPct}%</strong> —
                    breach disqualifies the day.
                  </span>
                </li>
              )}
              {c.rules.consistencyRule && (
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{c.rules.consistencyRule}</span>
                </li>
              )}
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Entry: {c.entryRequirement.label}
                  {c.entryRequirement.requiresKyc ? " · approved KYC required" : ""}.
                </span>
              </li>
            </ul>
          </TerraCard>

          {/* Leaderboard */}
          <TerraCard>
            <CompetitionLeaderboard competition={c} />
          </TerraCard>

          {/* FAQ */}
          <TerraCard className="space-y-3">
            <TerraSectionTitle title="FAQ" />
            <div className="space-y-2">
              {c.faq.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-outline-variant/60 px-4 py-3"
                >
                  <summary className="cursor-pointer list-none text-sm font-bold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-sm text-on-surface-variant">{f.a}</p>
                </details>
              ))}
            </div>
          </TerraCard>
        </div>

        {/* Sticky join panel */}
        <div className="md:col-span-1">
          <div className="sticky top-4 space-y-3">
            <TerraCard className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Entry
                </p>
                <p className="text-sm font-bold text-on-surface">
                  {c.entryRequirement.label}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Accounts: {c.entryRequirement.accountTypes.join(", ")}
                  {c.entryRequirement.requiresKyc ? " · KYC approved" : ""}
                </p>
              </div>

              {pct !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface-variant">
                      {formatNumber(c.participants)} / {formatNumber(c.participantCap!)}
                    </span>
                    <span className="font-bold text-on-surface">{pct}% full</span>
                  </div>
                  <TerraProgress value={pct} height="h-1.5" />
                </div>
              )}

              {ended ? (
                tier ? (
                  claim ? (
                    <div className="space-y-2 rounded-xl bg-primary-fixed/40 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-on-primary-fixed-variant">
                        <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                        Prize claimed (Demo)
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {tier.label} — shipping details received.
                      </p>
                      <TerraBadge tone="success">Claimed</TerraBadge>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClaimOpen(true)}
                      className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Claim {tier.label} — #{c.placement} place
                    </button>
                  )
                ) : (
                  <p className="rounded-xl bg-surface-container-low px-3 py-2.5 text-xs text-on-surface-variant">
                    {c.placement
                      ? `You finished #${c.placement} — outside the prize tiers this time.`
                      : "Results settled — you finished outside the prize tiers (Demo)."}
                  </p>
                )
              ) : joined ? (
                <button
                  type="button"
                  onClick={() => {
                    leaveCompetition(c.id);
                  }}
                  className="w-full rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  ✓ Joined — leave competition
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirmOpen(true);
                  }}
                  className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Join competition
                </button>
              )}

              <p className="text-[11px] text-on-surface-variant">
                Demo standings — final results after settlement. Gain shown in the
                leaderboard: +{gain.toFixed(1)}%.
              </p>
            </TerraCard>
          </div>
        </div>
      </div>

      {/* Requirements confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {c.name}?</DialogTitle>
            <DialogDescription>
              Confirm each requirement before entering. Entry is free — one account
              per trader.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {(
              [
                ["kyc", "My KYC profile is approved"],
                ["rules", `I've read the rules (${metricLabel[c.rules.metric]}, ${c.rules.minTrades} trades min.)`],
                ["oneAccount", "I'm entering with a single account"],
              ] as const
            ).map(([key, label]) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-outline-variant/60 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-low">
                  <input
                    type="checkbox"
                    checked={reqs[key]}
                    onChange={(e) => setReqs((r) => ({ ...r, [key]: e.target.checked }))}
                    className="h-4 w-4 shrink-0 accent-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!allReqs}
              onClick={confirmJoin}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {claimOpen && (
        <PrizeClaimDialog competition={c} open onOpenChange={setClaimOpen} />
      )}
    </div>
  );
}
