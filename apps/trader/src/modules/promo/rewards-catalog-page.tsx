"use client";
/**
 * R2-14 — Rewards Redemption Flow (trader, + redeem sheet).
 *
 * - Catalog cards: fee rebates, challenge discounts, merch, payout fast-track
 *   with point cost, stock, tier requirement and expiry.
 * - Balance header: points, tier progress (N18) and pending referral payouts (N19).
 * - Redeem sheet: confirms cost + fulfillment SLA, returns a redemption code or
 *   applies automatically; redemption history shows processing / granted /
 *   applied / expired / reversed with reversal reasons.
 *
 * AC-1 redeeming deducts points atomically and records a ledger entry that is
 * visible in the N18 loyalty ledger; AC-2 tier-gated items are locked with an
 * upgrade CTA; AC-3 expired stock and duplicate redemptions are prevented.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Gift, Lock, Ticket, Truck, Zap, ArrowUpRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/platform/status";
import { TerraCard, TerraPageHeader, TerraSectionTitle, TerraStat, TerraEmpty } from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  CATEGORY_LABEL,
  TIERS,
  defaultRewards,
  expiringSoon,
  itemAvailability,
  loadRewards,
  redeem,
  saveRewards,
  tierProgress,
  tierIndex,
  type CatalogItem,
  type RewardCategory,
  type RewardsState,
} from "./rewards-store";
import { pendingPayoutSummary } from "../community/referral-payout-store";

const CATEGORY_ICON: Record<RewardCategory, typeof Gift> = {
  fee_rebate: Ticket,
  challenge_discount: Zap,
  merch: Truck,
  payout_fast_track: Award,
};

const CATEGORIES: RewardCategory[] = ["fee_rebate", "challenge_discount", "merch", "payout_fast_track"];

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "muted" | "danger"> = {
  processing: "info",
  granted: "success",
  applied: "success",
  expired: "muted",
  reversed: "warning",
};

const catIcon = (c: RewardCategory) => CATEGORY_ICON[c] ?? Gift;

function expiresIn(item: CatalogItem): { label: string; urgent: boolean } | null {
  if (!item.expiresAt) return null;
  const ms = new Date(item.expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "expired", urgent: true };
  const days = Math.ceil(ms / 86_400_000);
  return { label: days <= 7 ? `expires in ${days}d` : `expires ${new Date(item.expiresAt).toLocaleDateString()}`, urgent: days <= 7 };
}

export function RewardsCatalogPage() {
  const [rewards, setRewards] = useState<RewardsState>(defaultRewards);
  const [cat, setCat] = useState<RewardCategory | "all">("all");
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  useEffect(() => {
    setRewards(loadRewards());
  }, []);

  const progress = useMemo(() => tierProgress(rewards), [rewards]);
  const pending = useMemo(() => pendingPayoutSummary(), []);
  const expiring = useMemo(() => expiringSoon(rewards, 30), [rewards]);

  const items = rewards.items.filter((i) => (cat === "all" ? true : i.category === cat));
  const selectedCheck = selected ? itemAvailability(rewards, selected) : { ok: false, reason: "No item selected." };

  function confirmRedeem() {
    if (!selected) return;
    const res = redeem(rewards, selected.id);
    if (!res.ok) {
      toast({ title: "Redemption blocked", description: res.reason, variant: "destructive" });
      return;
    }
    setRewards(res.state);
    setSelected(null);
    toast({
      title: res.redemption.code ? "Redeemed — code ready" : "Redeemed — automatic application",
      description: res.redemption.code
        ? `${res.redemption.code} · ${res.redemption.cost} pts deducted · fulfilment in ${res.redemption.slaHours}h. Ledger entry recorded.`
        : `${res.redemption.cost} pts deducted · applied within ${res.redemption.slaHours}h. Ledger entry recorded (visible in Loyalty & Tiers).`,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title="Rewards Catalog"
        description="Spend loyalty points (N18) and referral rewards (N19) on fee rebates, challenge discounts, merch and payout fast-tracks."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/loyalty">
                <Award className="mr-1 h-4 w-4" />
                Loyalty &amp; Tiers
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/referral-rewards">
                <Gift className="mr-1 h-4 w-4" />
                Referral rewards
              </Link>
            </Button>
          </div>
        }
      />

      {/* ── Balance header ─────────────────────────────────────────── */}
      <TerraCard className="p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Point balance</p>
            <p className="text-2xl font-semibold tabular-nums">{rewards.points.toLocaleString()} pts</p>
            <Badge variant="secondary" className="mt-1">
              {rewards.tier} tier
            </Badge>
            <p className="mt-1 text-[11px] text-muted-foreground">{rewards.lifetimePoints.toLocaleString()} lifetime pts</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Progress to {progress.next?.id ?? "top tier"}
              {progress.next ? ` (${progress.next.min.toLocaleString()} pts)` : ""}
            </p>
            <Progress value={progress.pct} className="mt-2" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {progress.next ? `${progress.remaining.toLocaleString()} pts to ${progress.next.id}` : "Maximum tier reached"}
            </p>
            <p className="text-[11px] text-muted-foreground">Next-tier locked items show an upgrade CTA below.</p>
          </div>
          <div className="space-y-2">
            <div className="rounded border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending referral payouts (N19)</p>
              <p className="text-sm font-semibold">
                {pending.count} reward{pending.count === 1 ? "" : "s"} · ${pending.amount}
              </p>
              <Link href="/referral-rewards" className="text-[11px] text-primary hover:underline">
                Open payout tracker →
              </Link>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expiring within 30 days</p>
              <p className="text-sm font-semibold">{expiring.reduce((s, l) => s + l.pts, 0).toLocaleString()} pts</p>
            </div>
          </div>
        </div>
      </TerraCard>

      {/* ── Catalog ────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TerraSectionTitle title="Catalog" />
          <div className="flex flex-wrap gap-1">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setCat(c as RewardCategory | "all")}>
                {c === "all" ? "All" : CATEGORY_LABEL[c as RewardCategory]}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = catIcon(item.category);
            const check = itemAvailability(rewards, item);
            const locked = !check.ok && tierIndex(item.tierRequired) > tierIndex(rewards.tier);
            const exp = expiresIn(item);
            return (
              <TerraCard key={item.id} className={`relative p-4 ${locked ? "opacity-90" : ""}`}>
                {locked && (
                  <span className="absolute right-3 top-3 rounded bg-muted p-1 text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="flex items-start gap-2">
                  <span className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{item.title}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[item.category]}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{item.cost.toLocaleString()} pts</Badge>
                  <Badge variant={item.stock <= 0 ? "destructive" : item.stock <= 10 ? "outline" : "secondary"}>
                    {item.stock <= 0 ? "Out of stock" : `${item.stock} left`}
                  </Badge>
                  <Badge variant="outline">{item.tierRequired}+</Badge>
                  {exp && <Badge variant={exp.urgent ? "destructive" : "outline"}>{exp.label}</Badge>}
                  <Badge variant="outline">{item.slaHours}h SLA</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {item.fulfillment === "code" ? "Redemption code" : "Applied automatically"}
                  </span>
                  {locked ? (
                    <Button size="sm" variant="secondary" className="h-7 text-[10px]" asChild>
                      <Link href="/loyalty">
                        <Lock className="mr-1 h-3 w-3" />
                        Upgrade to {item.tierRequired}
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="h-7 text-[10px]" disabled={!check.ok} onClick={() => setSelected(item)}>
                      {check.ok ? "Redeem" : "Unavailable"}
                    </Button>
                  )}
                </div>
                {!check.ok && !locked && <p className="mt-1.5 text-[10px] text-amber-600">{check.reason}</p>}
              </TerraCard>
            );
          })}
        </div>
        {items.length === 0 && <TerraEmpty title="No rewards in this category" description="Try another category." />}
      </div>

      <Separator />

      {/* ── Redemption history ─────────────────────────────────────── */}
      <div>
        <TerraSectionTitle title="Redemption history" />
        <div className="mt-2 space-y-2">
          {rewards.redemptions.length === 0 && <TerraEmpty title="No redemptions yet" description="Redeem a reward to see it here." />}
          {rewards.redemptions.map((r) => (
            <TerraCard key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {r.title} <span className="text-muted-foreground">· {r.cost.toLocaleString()} pts</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <History className="mr-1 inline h-3 w-3" />
                    {new Date(r.at).toLocaleString()} · SLA {r.slaHours}h
                    {r.code ? ` · code ${r.code}` : ""}
                  </p>
                  {r.reversalReason && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{r.reversalReason}</p>}
                </div>
                <StatusBadge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</StatusBadge>
              </div>
            </TerraCard>
          ))}
        </div>
      </div>

      {/* ── Redeem sheet ───────────────────────────────────────────── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Redeem — {selected.title}</SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Cost</p>
                    <p className="font-semibold tabular-nums">{selected.cost.toLocaleString()} pts</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Balance after</p>
                    <p className="font-semibold tabular-nums">{Math.max(0, rewards.points - selected.cost).toLocaleString()} pts</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Fulfilment SLA</p>
                    <p className="font-semibold">{selected.slaHours}h</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Fulfilment</p>
                    <p className="font-semibold">{selected.fulfillment === "code" ? "Code issued" : "Automatic"}</p>
                  </div>
                </div>

                <div className="rounded border p-2 text-xs text-muted-foreground">
                  <p>
                    Tier required: <strong>{selected.tierRequired}</strong> · Stock: <strong>{selected.stock}</strong>
                    {selected.expiresAt && (
                      <>
                        {" "}
                        · Expires: <strong>{new Date(selected.expiresAt).toLocaleDateString()}</strong>
                      </>
                    )}
                  </p>
                  <p className="mt-1">
                    Deducted atomically with a ledger entry in Loyalty &amp; Tiers; duplicates and expired stock are rejected (AC-1/AC-3).
                  </p>
                </div>

                {!selectedCheck.ok && (
                  <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    {selectedCheck.reason}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" disabled={!selectedCheck.ok} onClick={confirmRedeem}>
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                    Confirm — {selected.cost.toLocaleString()} pts
                  </Button>
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cancel
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded border p-2">
                  <div>
                    <p className="text-xs font-medium">Your tier progress</p>
                    <p className="text-[11px] text-muted-foreground">
                      {rewards.tier} · {progress.next ? `${progress.remaining.toLocaleString()} pts to ${progress.next.id}` : "top tier"}
                    </p>
                  </div>
                  <Progress value={progress.pct} className="w-24" />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Tier perks: {TIERS.map((t) => `${t.id} ${t.earnMultiplier}`).join(" · ")}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex justify-end">
        <TerraStat label="Redemptions" value={String(rewards.redemptions.length)} sub={`${rewards.redemptions.filter((r) => r.status === "processing").length} processing`} />
      </div>
    </div>
  );
}
