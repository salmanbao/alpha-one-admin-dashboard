/**
 * Payout risk context builder (audit finding #3 — HIGH).
 *
 * The approval surfaces already carried a performance chip and the
 * profit-split math, but nothing ever constructed a `PayoutTraderRisk`,
 * so `RiskContextPanel` — the component built for exactly this job —
 * always rendered null. A reviewer could approve a payout without ever
 * seeing the trader's breach history, risk score or account health.
 *
 * This module derives that context from the seeded fixtures:
 *
 *   • breach counts        — getTenantBreaches, by trader
 *   • limits + usage       — the trader's challenge (daily / max DD)
 *                            plus a deterministic usage share
 *   • account health       — the trader's account (equity vs balance)
 *   • consistency score    — win rate + a stable hash component
 *   • risk score (0–100)   — higher is *lower* risk, matching the
 *                            shared panel's bands (0 Critical → 100
 *                            Very Low)
 *
 * Everything is a pure function of the fixture ids — no `Math.random()`,
 * no `Date.now()` — so the same trader always shows the same rating.
 * Swap each derivation for its telemetry feed when the backend exposes
 * it; the shape stays identical.
 */

import {
  getTenantAccounts,
  getTenantBreaches,
  getTenantChallenges,
  getTenantTraders,
  hashStr,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import type { PayoutTraderRisk } from "@pfaas/ui/platform-risk-context";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Share of a limit already consumed (0–99 %).
 *
 * Base band is hash-derived so two traders never look identical; an
 * *open* breach of that rule forces the usage into the critical band,
 * because that is precisely what an open breach means.
 */
function usagePct(seedKey: string, openBreachOfThatRule: boolean): number {
  const base = 8 + (hashStr(seedKey) % 72); // 8–79 %
  if (openBreachOfThatRule) return clamp(84 + (hashStr(`${seedKey}:forced`) % 15), 0, 99);
  return base;
}

/** The trader's account — prefer the funded one, fall back to any link. */
function accountFor(traderId: string, accounts: TradingAccount[]): TradingAccount | undefined {
  const linked = accounts.filter((a) => a.traderId === traderId);
  return linked.find((a) => a.type === "funded") ?? linked[0];
}

/**
 * Build the risk context for one trader, or `undefined` when the
 * fixtures have no record of them (never invent a rating for an
 * unknown trader — the panel renders nothing instead).
 */
export function buildPayoutRisk(
  tenantId: string,
  traderId: string,
): PayoutTraderRisk | undefined {
  const trader = getTenantTraders(tenantId).find((t) => t.id === traderId);
  if (!trader) return undefined;

  const account = accountFor(traderId, getTenantAccounts(tenantId));
  const challenge = getTenantChallenges(tenantId).find((c) => c.traderId === traderId);
  const traderBreaches = getTenantBreaches(tenantId).filter((b) => b.traderId === traderId);

  const total = traderBreaches.length;
  const openList = traderBreaches.filter((b) => b.status === "open");
  const open = openList.length;
  const openCritical = openList.filter((b) => b.severity === "critical").length;
  const critical = traderBreaches.filter((b) => b.severity === "critical").length;
  const warning = traderBreaches.filter((b) => b.severity === "warning").length;

  const balance = account?.balance ?? trader.accountBalance;
  const equity = account?.equity ?? trader.equity;

  // Limits: the challenge phase config when present, otherwise the
  // conventional 5 % daily / 10 % max DD on the account size.
  const dailyLossLimit = challenge?.dailyDrawdown ?? Math.round(balance * 0.05);
  const maxDrawdownLimit = challenge?.maxDrawdown ?? Math.round(balance * 0.1);

  const dailyLossUsedPct = usagePct(
    `${traderId}:daily`,
    traderBreaches.some((b) => b.type === "daily-drawdown" && b.status === "open"),
  );
  const maxDrawdownUsedPct = usagePct(
    `${traderId}:dd`,
    traderBreaches.some((b) => b.type === "max-drawdown" && b.status === "open"),
  );

  const consistencyScore = clamp(
    Math.round(trader.winRate * 0.7 + (hashStr(`${traderId}:consistency`) % 22) + 14),
    12,
    97,
  );

  /* ── Risk score — higher is lower risk ── */
  let score = 56 + (hashStr(`${traderId}:score`) % 19); // 56–74 base
  score -= openCritical * 22;
  score -= (open - openCritical) * 9;
  score -= Math.min(12, (total - open) * 3); // resolved history still weighs
  if (dailyLossUsedPct > 80) score -= 15;
  else if (dailyLossUsedPct > 50) score -= 7;
  if (maxDrawdownUsedPct > 80) score -= 15;
  else if (maxDrawdownUsedPct > 50) score -= 7;
  if (consistencyScore < 50) score -= 8;
  if (trader.status === "breached") score -= 18;
  if (trader.winRate >= 55) score += 5;
  const riskScore = clamp(Math.round(score), 3, 97);

  /* ── Trend — a rule of thumb, not a time series ── */
  const riskTrend: PayoutTraderRisk["riskTrend"] =
    open > 0 || dailyLossUsedPct > 85 || maxDrawdownUsedPct > 85
      ? "deteriorating"
      : total > 0
        ? "improving"
        : "stable";

  const recent = [...traderBreaches]
    .sort((a, b) => +new Date(b.triggeredAt) - +new Date(a.triggeredAt))
    .slice(0, 4)
    .map((b) => ({
      type: b.type,
      severity: b.severity,
      triggeredAt: b.triggeredAt,
      status: b.status,
    }));

  return {
    traderId,
    riskScore,
    riskTrend,
    breaches: { total, open, critical, warning, recent },
    accountHealth: {
      equity,
      balance,
      dailyLossLimit,
      maxDrawdownLimit,
      dailyLossUsed: Math.round((dailyLossLimit * dailyLossUsedPct) / 100),
      maxDrawdownUsed: Math.round((maxDrawdownLimit * maxDrawdownUsedPct) / 100),
      consistencyScore,
    },
  };
}

/**
 * The risk that should gate a **batch** decision: the lowest score
 * (highest risk) trader among the selection. Approving a batch is only
 * as safe as its riskiest member, so that is the context the reviewer
 * acknowledges.
 *
 * Returns `undefined` when none of the traders resolve — the caller
 * renders no panel rather than a fabricated one.
 */
export function worstPayoutRisk(
  tenantId: string,
  traderIds: string[],
): PayoutTraderRisk | undefined {
  let worst: PayoutTraderRisk | undefined;
  for (const id of [...new Set(traderIds)]) {
    const risk = buildPayoutRisk(tenantId, id);
    if (risk && (!worst || risk.riskScore < worst.riskScore)) worst = risk;
  }
  return worst;
}
