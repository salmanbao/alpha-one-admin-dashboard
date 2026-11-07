"use client";
/**
 * N19 — Referral Reward Payout Tracker (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 stub:
 *   - full **status timeline** per reward: earned → pending KYC → approved → paid
 *     (with timestamps and stage notes),
 *   - **fraud-hold flag** surfaced from risk signals (score + reason + review),
 *   - **cohort breakdown** (referred / KYC / funded / paid / held per cohort),
 *   - stage filters and payout triggering with compliance checks.
 *
 * Pending rewards also surface in the R2-14 rewards catalog header.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Gift, ShieldAlert, Users, Wallet, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/platform/status";
import { TerraCard, TerraPageHeader, TerraSectionTitle, TerraTable, TerraEmpty } from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  STAGE_ORDER,
  listCohorts,
  listReferralRewards,
  stageTone,
  type ReferralReward,
  type RewardStage,
} from "../referral-payout-store";

const STAGE_FILTERS: Array<{ id: RewardStage | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "pending_kyc", label: "Pending KYC" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
];

export function ReferralRewardsPage() {
  const [rewards, setRewards] = useState<ReferralReward[]>(() => listReferralRewards());
  const [filter, setFilter] = useState<RewardStage | "all">("all");
  const cohorts = useMemo(() => listCohorts(), []);

  const visible = rewards.filter((r) => (filter === "all" ? true : r.stage === filter));
  const totals = useMemo(() => {
    const paid = rewards.filter((r) => r.stage === "paid");
    const pending = rewards.filter((r) => r.stage !== "paid");
    const held = rewards.filter((r) => r.fraudHold);
    return {
      paidCount: paid.length,
      paidAmount: paid.reduce((s, r) => s + r.amount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, r) => s + r.amount, 0),
      heldCount: held.length,
      heldAmount: held.reduce((s, r) => s + r.amount, 0),
    };
  }, [rewards]);

  const cohortTotals = useMemo(() => {
    return {
      referred: cohorts.reduce((s, c) => s + c.referred, 0),
      kyc: cohorts.reduce((s, c) => s + c.kycPassed, 0),
      funded: cohorts.reduce((s, c) => s + c.funded, 0),
      paid: cohorts.reduce((s, c) => s + c.paid, 0),
      amount: cohorts.reduce((s, c) => s + c.amountPaid, 0),
      held: cohorts.reduce((s, c) => s + c.fraudHeld, 0),
    };
  }, [cohorts]);

  function advance(id: string, stage: RewardStage, note: string) {
    setRewards((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              stage,
              payoutId: stage === "paid" ? (r.payoutId ?? `po-${Math.floor(7000 + Math.random() * 2000)}`) : r.payoutId,
              timeline: [...r.timeline, { stage, at: new Date().toISOString(), note }],
            }
          : r,
      ),
    );
  }

  function triggerPayout(r: ReferralReward) {
    if (r.fraudHold) {
      toast({ title: "Payout blocked", description: "Fraud hold must be cleared by risk review first.", variant: "destructive" });
      return;
    }
    advance(r.id, "paid", "Paid out through the payouts rail (compliance applied)");
    toast({ title: "Payout queued", description: `$${r.amount} reward queued — same compliance path as profit payouts.` });
  }

  function requestReview(r: ReferralReward) {
    advance(r.id, r.stage, "Manual risk review requested by trader (hold stays until risk signs off)");
    toast({ title: "Review requested", description: `Risk team notified about the hold on ${r.friend}.` });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title="Referral Reward Payouts"
        description="Track every reward through earned → pending KYC → approved → paid, with fraud holds and cohort performance."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/rewards">
              <Gift className="mr-1 h-4 w-4" />
              Spend points in Rewards Catalog
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* ── Summary ────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <TerraCard className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid rewards</p>
          <p className="text-xl font-semibold tabular-nums">${totals.paidAmount}</p>
          <p className="text-[11px] text-muted-foreground">{totals.paidCount} of {rewards.length} referrals converted</p>
        </TerraCard>
        <TerraCard className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending payout</p>
          <p className="text-xl font-semibold tabular-nums">${totals.pendingAmount}</p>
          <p className="text-[11px] text-muted-foreground">{totals.pendingCount} rewards in flight</p>
        </TerraCard>
        <TerraCard className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fraud holds</p>
          <p className={`text-xl font-semibold tabular-nums ${totals.heldCount ? "text-rose-600" : ""}`}>{totals.heldCount}</p>
          <p className="text-[11px] text-muted-foreground">${totals.heldAmount} blocked pending risk review</p>
        </TerraCard>
        <TerraCard className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversion (referred → paid)</p>
          <p className="text-xl font-semibold tabular-nums">
            {cohortTotals.referred ? Math.round((cohortTotals.paid / cohortTotals.referred) * 100) : 0}%
          </p>
          <p className="text-[11px] text-muted-foreground">{cohortTotals.paid} paid / {cohortTotals.referred} referred</p>
        </TerraCard>
      </div>

      {totals.heldCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {totals.heldCount} reward(s) on fraud hold — risk signals (device/velocity matching) flagged them. Held rewards cannot be paid out until
            risk review clears them.
          </span>
        </div>
      )}

      {/* ── Reward list + timeline ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TerraSectionTitle title="Reward lifecycle" />
        <div className="flex flex-wrap gap-1">
          {STAGE_FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setFilter(f.id)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <TerraEmpty title="No rewards in this stage" description="Switch the filter to see other rewards." />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const stageIdx = STAGE_ORDER.indexOf(r.stage);
            const conversion = Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100);
            return (
              <TerraCard key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {r.friend} <span className="font-normal text-muted-foreground">· ${r.amount} {r.currency}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Cohort {r.cohort}
                      {r.payoutId ? ` · payout ${r.payoutId}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={stageTone(r.stage)}>{r.stage.replace("_", " ")}</StatusBadge>
                    {r.fraudHold && <StatusBadge tone="danger">fraud hold</StatusBadge>}
                  </div>
                </div>

                {/* Fraud hold banner */}
                {r.fraudHold && (
                  <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                    <p className="flex items-center gap-1 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Fraud hold · risk score {r.fraudHold.riskScore.toFixed(2)}
                    </p>
                    <p className="mt-0.5">{r.fraudHold.reason}</p>
                    <Button size="sm" variant="outline" className="mt-1.5 h-6 text-[10px]" onClick={() => requestReview(r)}>
                      Request manual review
                    </Button>
                  </div>
                )}

                {/* Status timeline */}
                <ol className="mt-3 space-y-1.5">
                  {STAGE_ORDER.map((s, i) => {
                    const event = r.timeline.find((t) => t.stage === s);
                    const done = i <= stageIdx;
                    return (
                      <li key={s} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                          aria-hidden
                        >
                          {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className={`font-medium ${done ? "" : "text-muted-foreground"}`}>{s.replace("_", " ")}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {event ? `${new Date(event.at).toLocaleString()} — ${event.note}` : "not reached"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {/* Conditions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.conditions.map((c) => (
                    <Badge key={c.label} variant={c.done ? "secondary" : "outline"} className={c.done ? "" : "text-muted-foreground"}>
                      {c.done ? "✓" : "○"} {c.label}
                    </Badge>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-[10rem] flex-1">
                    <Progress value={conversion} className="h-1.5" />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {stageIdx + 1}/{STAGE_ORDER.length} stages complete
                    </p>
                  </div>
                  {r.stage === "approved" && !r.fraudHold && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => triggerPayout(r)}>
                      <Wallet className="mr-1 h-3 w-3" />
                      Trigger payout
                    </Button>
                  )}
                  {r.stage === "paid" && <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Paid {r.payoutId}</p>}
                </div>
              </TerraCard>
            );
          })}
        </div>
      )}

      <Separator />

      {/* ── Cohort breakdown ───────────────────────────────────────── */}
      <div>
        <TerraSectionTitle title="Breakdown by referral cohort" />
        <div className="mt-2">
          <TerraTable
            head={["Cohort", "Referred", "KYC passed", "Funded", "Paid", "Amount paid", "Held"]}
            rows={cohorts.map((c) => [
              <span key={`${c.id}-l`} className="font-medium">{c.label}</span>,
              <span key={`${c.id}-r`}>{c.referred}</span>,
              <span key={`${c.id}-k`}>
                {c.kycPassed}{" "}
                <span className="text-[10px] text-muted-foreground">
                  ({c.referred ? Math.round((c.kycPassed / c.referred) * 100) : 0}%)
                </span>
              </span>,
              <span key={`${c.id}-f`}>
                {c.funded}{" "}
                <span className="text-[10px] text-muted-foreground">
                  ({c.referred ? Math.round((c.funded / c.referred) * 100) : 0}%)
                </span>
              </span>,
              <span key={`${c.id}-p`}>{c.paid}</span>,
              <span key={`${c.id}-a`} className="tabular-nums">${c.amountPaid}</span>,
              <span key={`${c.id}-h`}>{c.fraudHeld ? <StatusBadge tone="danger">{c.fraudHeld}</StatusBadge> : <span className="text-muted-foreground">0</span>}</span>,
            ])}
          />
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          Cohorts are signup-month buckets; paid rewards flow through the same compliance rail as profit payouts (KYC + risk checks).
        </p>
      </div>
    </div>
  );
}
