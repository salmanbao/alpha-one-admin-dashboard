"use client";
/**
 * N18 — Loyalty Ledger & Tiers (depth pass, Wave 3/P2).
 *
 * Adds over the Round-1 stub:
 *   - full **points ledger** with type filters and running balances,
 *   - **earn rules** (source × tier multiplier) + **tier progress** ladder,
 *   - **rewards catalog management** overview feeding R2-14 (stock, price,
 *     tier gating, expiry — manage in the catalog screen),
 *   - **expiry policy**: 12-month rule with a 30-day expiring-points warning.
 *
 * Ledger is the same store the R2-14 redeem flow writes to (AC-1 there), so
 * redemptions appear here immediately.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, ArrowUpRight, BookOpen, Clock, Gift, Layers, Sparkles, Timer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/platform/status";
import { TerraCard, TerraPageHeader, TerraSectionTitle, TerraEmpty } from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  CATEGORY_LABEL,
  TIERS,
  defaultRewards,
  expiringSoon,
  loadRewards,
  resetRewards,
  tierProgress,
  type LedgerType,
  type RewardsState,
} from "./rewards-store";

const LEDGER_FILTERS: Array<{ id: LedgerType | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "spent", label: "Spent" },
  { id: "expired", label: "Expired" },
  { id: "reversed", label: "Reversed" },
];

const ledgerTone = (t: LedgerType): "success" | "info" | "muted" | "warning" =>
  t === "earned" ? "success" : t === "spent" ? "info" : t === "expired" ? "muted" : "warning";

/** Earn rules: what credits points, and how the tier multiplier applies. */
const EARN_RULES = [
  { id: "challenge", label: "Challenge purchase", pts: "1 pt per $1 spent", note: "× tier multiplier" },
  { id: "kyc", label: "KYC verification completed", pts: "500 pts", note: "one-time" },
  { id: "referral", label: "Referred trader gets funded", pts: "800 pts", note: "× tier multiplier" },
  { id: "payout", label: "First payout received", pts: "1,000 pts", note: "one-time" },
  { id: "activity", label: "Monthly active trader bonus", pts: "1,000 pts", note: "requires 10+ trading days" },
  { id: "survey", label: "Completed NPS / CSAT survey", pts: "150 pts", note: "max 1 per survey" },
];

const EXPIRY_POLICY = [
  "Points expire 12 months after they are earned (per-entry expiry shown in the ledger).",
  "Expired points are written back to the ledger as an `expired` entry — never silently dropped.",
  "Redeemed points are not refundable unless a redemption is reversed (shown in R2-14 history).",
  "Any activity (trade, purchase, referral) resets the 12-month clock for unexpired points.",
];

export function LoyaltyPage() {
  const [rewards, setRewards] = useState<RewardsState>(defaultRewards);
  const [filter, setFilter] = useState<LedgerType | "all">("all");

  useEffect(() => {
    setRewards(loadRewards());
  }, []);

  const progress = useMemo(() => tierProgress(rewards), [rewards]);
  const expiring = useMemo(() => expiringSoon(rewards, 30), [rewards]);
  const ledger = useMemo(
    () => rewards.ledger.filter((l) => (filter === "all" ? true : l.type === filter)),
    [rewards.ledger, filter],
  );
  const totals = useMemo(() => {
    const earned = rewards.ledger.filter((l) => l.pts > 0).reduce((s, l) => s + l.pts, 0);
    const spent = rewards.ledger.filter((l) => l.type === "spent").reduce((s, l) => s + Math.abs(l.pts), 0);
    const lost = rewards.ledger.filter((l) => l.type === "expired" || l.type === "reversed").reduce((s, l) => s + Math.abs(l.pts), 0);
    return { earned, spent, lost };
  }, [rewards.ledger]);

  const catalogStats = useMemo(() => {
    const byCat = new Map<string, { count: number; minCost: number; low: number }>();
    for (const i of rewards.items) {
      const cur = byCat.get(i.category) ?? { count: 0, minCost: Number.MAX_SAFE_INTEGER, low: 0 };
      cur.count += 1;
      cur.minCost = Math.min(cur.minCost, i.cost);
      if (i.stock <= 10) cur.low += 1;
      byCat.set(i.category, cur);
    }
    return Array.from(byCat.entries()).map(([cat, v]) => ({ cat, ...v }));
  }, [rewards.items]);

  const currentTier = TIERS.find((t) => t.id === rewards.tier) ?? TIERS[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title="Loyalty & Tiers"
        description="Points ledger, earning rules, tier progression and the rewards catalog that spends them (R2-14)."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/rewards">
                <Gift className="mr-1 h-4 w-4" />
                Open Rewards Catalog
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/promos">Open Promo Wallet</Link>
            </Button>
          </div>
        }
      />

      {/* ── Balance + tier progress ────────────────────────────────── */}
      <TerraCard className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-2xl font-semibold tabular-nums">{rewards.points.toLocaleString()} pts</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="secondary">{rewards.tier} tier</Badge>
              <Badge variant="outline">{currentTier.earnMultiplier} earn</Badge>
              <Badge variant="outline">{rewards.lifetimePoints.toLocaleString()} lifetime</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Progress to {progress.next?.id ?? "top tier"}
              {progress.next ? ` (${progress.next.min.toLocaleString()} pts)` : ""}
            </p>
            <Progress value={progress.pct} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {progress.next ? `${progress.remaining.toLocaleString()} pts to ${progress.next.id} — unlocks tier-gated rewards in the catalog.` : "Maximum tier reached."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Earned</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-600">+{totals.earned.toLocaleString()}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Spent</p>
              <p className="text-sm font-semibold tabular-nums">−{totals.spent.toLocaleString()}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Lost</p>
              <p className="text-sm font-semibold tabular-nums text-muted-foreground">−{totals.lost.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </TerraCard>

      {/* ── Tier ladder ────────────────────────────────────────────── */}
      <div>
        <TerraSectionTitle title="Tier progression" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const isCurrent = t.id === rewards.tier;
            const reached = rewards.lifetimePoints >= t.min;
            return (
              <TerraCard key={t.id} className={`p-3 ${isCurrent ? "border-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    <Award className={`h-4 w-4 ${reached ? "text-primary" : "text-muted-foreground"}`} />
                    {t.id}
                  </p>
                  {isCurrent && <Badge>you</Badge>}
                  {!reached && !isCurrent && <Badge variant="outline">locked</Badge>}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.min.toLocaleString()} lifetime pts · {t.earnMultiplier} earn
                </p>
                <p className="mt-1 text-[11px]">{t.perks}</p>
                {isCurrent && <Progress value={progress.pct} className="mt-2 h-1.5" />}
                {reached && !isCurrent && <p className="mt-2 text-[10px] text-emerald-600">Unlocked</p>}
                {!reached && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {(t.min - rewards.lifetimePoints).toLocaleString()} pts to unlock
                  </p>
                )}
              </TerraCard>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ── Ledger + rules ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TerraCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TerraSectionTitle title="Points ledger" />
            <div className="flex flex-wrap gap-1">
              {LEDGER_FILTERS.map((f) => (
                <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} className="h-6 text-[10px]" onClick={() => setFilter(f.id)}>
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {ledger.length === 0 ? (
            <TerraEmpty title="No ledger entries" description="Nothing recorded for this filter yet." />
          ) : (
            <ul className="mt-2 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
              {ledger.map((l) => {
                const exp = l.pts > 0 ? new Date(l.expiresAt) : null;
                const expLabel = exp && exp.getTime() > Date.now() ? `expires ${exp.toLocaleDateString()}` : l.pts > 0 ? "expired" : "";
                return (
                  <li key={l.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.desc}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(l.ts).toLocaleDateString()} · {l.source ?? "manual"}
                        {expLabel ? ` · ${expLabel}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge tone={ledgerTone(l.type)}>{l.type}</StatusBadge>
                      <p className={`mt-0.5 font-semibold tabular-nums ${l.pts >= 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {l.pts >= 0 ? "+" : ""}
                        {l.pts.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">bal {l.balance.toLocaleString()}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Redemptions from the Rewards Catalog post here instantly (R2-14 AC-1).
          </p>
        </TerraCard>

        <div className="space-y-4">
          <TerraCard className="p-4">
            <TerraSectionTitle title="Earning rules" />
            <ul className="mt-2 space-y-1 text-xs">
              {EARN_RULES.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1.5">
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{r.note}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{r.pts}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-2 rounded border p-2 text-[11px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Tier multiplier applies to $-based and referral rules — you currently earn at {currentTier.earnMultiplier}.
            </div>
          </TerraCard>

          <TerraCard className="p-4">
            <TerraSectionTitle title="Expiry policy" />
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {EXPIRY_POLICY.map((p, i) => (
                <li key={i} className="flex gap-1.5">
                  <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className={`mt-2 rounded border p-2 text-xs ${expiring.length ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" : ""}`}>
              <p className="flex items-center gap-1 font-medium">
                <Timer className="h-3.5 w-3.5" />
                {expiring.length
                  ? `${expiring.reduce((s, l) => s + l.pts, 0).toLocaleString()} pts expire within 30 days`
                  : "No points expiring in the next 30 days"}
              </p>
              {expiring.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  {expiring.slice(0, 4).map((l) => (
                    <li key={l.id} className="flex justify-between">
                      <span className="truncate">{l.desc}</span>
                      <span className="tabular-nums">
                        {l.pts} pts · {new Date(l.expiresAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TerraCard>
        </div>
      </div>

      {/* ── Rewards catalog management (feeds R2-14) ───────────────── */}
      <TerraCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TerraSectionTitle title="Rewards catalog (management view)" />
          <Button size="sm" asChild>
            <Link href="/rewards">
              Manage &amp; redeem
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {catalogStats.map((c) => (
            <div key={c.cat} className="rounded border p-2 text-xs">
              <p className="flex items-center gap-1 font-medium">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {CATEGORY_LABEL[c.cat as keyof typeof CATEGORY_LABEL] ?? c.cat}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {c.count} item{c.count === 1 ? "" : "s"} · from {c.minCost.toLocaleString()} pts
              </p>
              {c.low > 0 && <p className="text-[11px] text-amber-600">{c.low} low/out of stock</p>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Catalog items carry cost, stock, tier requirement and expiry — edits are reflected in the R2-14 redemption flow.
        </p>
      </TerraCard>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            setRewards(resetRewards());
            toast({ title: "Demo data reset", description: "Ledger, catalog and redemptions restored to seed state." });
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset demo rewards data
        </Button>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <BookOpen className="h-3 w-3" />
        Dummy data — points, redemptions and tiers are stored locally on this device; the store API lands with R2-F02.
      </p>
    </div>
  );
}
