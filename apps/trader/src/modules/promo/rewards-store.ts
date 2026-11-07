/**
 * R2-14 + N18 — Rewards / Loyalty store (trader, dummy data).
 *
 * Shared by the rewards catalog (R2-14) and the loyalty ledger (N18):
 * one atomic `redeem()` keeps the point balance, ledger and stock in sync
 * (AC-1: redeeming deducts points atomically and records a ledger entry
 * visible in N18; AC-3: expired stock and duplicate redemptions blocked).
 */

export type RewardCategory = "fee_rebate" | "challenge_discount" | "merch" | "payout_fast_track";
export type TierName = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface TierDef {
  id: TierName;
  /** cumulative lifetime points required */
  min: number;
  earnMultiplier: string;
  perks: string;
}

/** Tier ladder (cumulative lifetime points). */
export const TIERS: TierDef[] = [
  { id: "Bronze", min: 0, earnMultiplier: "1×", perks: "Base earn rate, standard support" },
  { id: "Silver", min: 1_500, earnMultiplier: "1.25×", perks: "Priority support, 1.25× earn, monthly fee rebate draw" },
  { id: "Gold", min: 3_000, earnMultiplier: "1.5×", perks: "Exclusive coupons, faster payout review, 1.5× earn" },
  { id: "Platinum", min: 6_000, earnMultiplier: "2×", perks: "Concierge support, free payout fast-tracks, 2× earn" },
];

export const tierIndex = (t: TierName) => TIERS.findIndex((x) => x.id === t);

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: RewardCategory;
  cost: number;
  stock: number;
  tierRequired: TierName;
  /** ISO date — items past this date can't be redeemed (AC-3) */
  expiresAt?: string;
  /** fulfillment SLA in hours */
  slaHours: number;
  fulfillment: "code" | "auto";
}

export type RedemptionStatus = "processing" | "granted" | "applied" | "expired" | "reversed";

export interface Redemption {
  id: string;
  itemId: string;
  title: string;
  cost: number;
  status: RedemptionStatus;
  code?: string;
  at: string;
  slaHours: number;
  reversalReason?: string;
}

export type LedgerType = "earned" | "spent" | "expired" | "reversed";

export interface LedgerEntry {
  id: string;
  ts: string;
  type: LedgerType;
  desc: string;
  pts: number;
  balance: number;
  /** when the entry's points expire (12-month policy) */
  expiresAt: string;
  source?: string;
}

export interface RewardsState {
  points: number;
  lifetimePoints: number;
  tier: TierName;
  ledger: LedgerEntry[];
  items: CatalogItem[];
  redemptions: Redemption[];
}

const STORAGE_KEY = "pfaas:trader:rewards";
const YEAR_MS = 365 * 86_400_000;

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const day = 86_400_000;

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

function seed(): RewardsState {
  const items: CatalogItem[] = [
    {
      id: "it-rebate-25",
      title: "$25 monthly fee rebate",
      description: "Credit applied to your next platform fee invoice (automatic).",
      category: "fee_rebate",
      cost: 250,
      stock: 40,
      tierRequired: "Bronze",
      slaHours: 24,
      fulfillment: "auto",
    },
    {
      id: "it-rebate-100",
      title: "$100 fee rebate bundle",
      description: "Four × $25 fee credits for the next four billing cycles.",
      category: "fee_rebate",
      cost: 900,
      stock: 12,
      tierRequired: "Silver",
      slaHours: 24,
      fulfillment: "auto",
    },
    {
      id: "it-chal-10",
      title: "10% challenge discount",
      description: "Single-use code, 10% off any evaluation challenge checkout.",
      category: "challenge_discount",
      cost: 600,
      stock: 25,
      tierRequired: "Silver",
      expiresAt: iso(9 * day),
      slaHours: 1,
      fulfillment: "code",
    },
    {
      id: "it-chal-free",
      title: "Free retry voucher",
      description: "One free restart after a breach (excludes 100K+ programs).",
      category: "challenge_discount",
      cost: 1_800,
      stock: 6,
      tierRequired: "Gold",
      slaHours: 2,
      fulfillment: "code",
    },
    {
      id: "it-fasttrack",
      title: "Payout fast-track (24h)",
      description: "Your next payout is reviewed with a 24-hour SLA (automatic).",
      category: "payout_fast_track",
      cost: 1_200,
      stock: 15,
      tierRequired: "Gold",
      slaHours: 24,
      fulfillment: "auto",
    },
    {
      id: "it-merch-hoodie",
      title: "Alpha-One hoodie",
      description: "Heavyweight hoodie, ships in 5–7 business days. Code emailed.",
      category: "merch",
      cost: 2_200,
      stock: 0,
      tierRequired: "Silver",
      slaHours: 168,
      fulfillment: "code",
    },
    {
      id: "it-merch-bottle",
      title: "Insulated bottle (expired drop)",
      description: "Limited drop — redemption window closed.",
      category: "merch",
      cost: 1_400,
      stock: 30,
      tierRequired: "Bronze",
      expiresAt: iso(-2 * day),
      slaHours: 168,
      fulfillment: "code",
    },
    {
      id: "it-plat-concierge",
      title: "Concierge onboarding call",
      description: "1:1 strategy call with a platform mentor.",
      category: "fee_rebate",
      cost: 3_500,
      stock: 5,
      tierRequired: "Platinum",
      slaHours: 48,
      fulfillment: "code",
    },
  ];

  const ledger: LedgerEntry[] = [
    { id: "l1", ts: iso(-2 * day), type: "earned", desc: "Challenge purchase — 100K Evaluation", pts: 500, balance: 2_450, expiresAt: iso(YEAR_MS - 2 * day), source: "challenge_purchase" },
    { id: "l2", ts: iso(-5 * day), type: "earned", desc: "Referral funded — an***@mail.com", pts: 800, balance: 1_950, expiresAt: iso(YEAR_MS - 5 * day), source: "referral_funded" },
    { id: "l3", ts: iso(-10 * day), type: "spent", desc: "Redeemed — $25 fee rebate", pts: -250, balance: 1_150, expiresAt: iso(0), source: "it-rebate-25" },
    { id: "l4", ts: iso(-27 * day), type: "expired", desc: "Promo points expired (12-month policy)", pts: -100, balance: 1_400, expiresAt: iso(-27 * day) },
    { id: "l5", ts: iso(-41 * day), type: "earned", desc: "KYC verification completed", pts: 500, balance: 1_500, expiresAt: iso(YEAR_MS - 41 * day), source: "kyc" },
    { id: "l6", ts: iso(-58 * day), type: "earned", desc: "Monthly active trader bonus", pts: 1_000, balance: 1_000, expiresAt: iso(YEAR_MS - 58 * day), source: "activity" },
  ];

  const redemptions: Redemption[] = [
    { id: "rd1", itemId: "it-rebate-25", title: "$25 monthly fee rebate", cost: 250, status: "applied", at: iso(-10 * day), slaHours: 24 },
    { id: "rd2", itemId: "it-chal-10", title: "10% challenge discount", cost: 600, status: "granted", code: "ALPHA-10-7Q2F", at: iso(-3 * day), slaHours: 1 },
    { id: "rd3", itemId: "it-merch-bottle", title: "Insulated bottle (expired drop)", cost: 1_400, status: "reversed", at: iso(-20 * day), slaHours: 168, reversalReason: "Drop cancelled — points refunded in full." },
    { id: "rd4", itemId: "it-chal-free", title: "Free retry voucher", cost: 1_800, status: "expired", at: iso(-40 * day), slaHours: 2, reversalReason: "Code unused after 30 days — voucher expired, points not refunded." },
  ];

  return { points: 2_450, lifetimePoints: 4_100, tier: "Silver", ledger, items, redemptions };
}

/* ------------------------------------------------------------------ */
/* Persistence (localStorage — dummy, per device)                      */
/* ------------------------------------------------------------------ */

/** Deterministic first-render value (SSR + hydration safe; never touches storage). */
export function defaultRewards(): RewardsState {
  return seed();
}

export function loadRewards(): RewardsState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as RewardsState;
    if (!parsed || !Array.isArray(parsed.ledger) || !Array.isArray(parsed.items)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

export function saveRewards(s: RewardsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — in-memory state still works for the session */
  }
}

export function resetRewards(): RewardsState {
  const s = seed();
  saveRewards(s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function tierProgress(state: RewardsState): { tier: TierName; next?: TierDef; pct: number; remaining: number } {
  const next = TIERS.find((t) => t.min > state.lifetimePoints);
  if (!next) return { tier: state.tier, pct: 100, remaining: 0 };
  const prev = [...TIERS].reverse().find((t) => t.min <= state.lifetimePoints) ?? TIERS[0];
  const span = next.min - prev.min;
  const pct = Math.round(((state.lifetimePoints - prev.min) / span) * 100);
  return { tier: state.tier, next, pct, remaining: next.min - state.lifetimePoints };
}

export const isExpired = (item: CatalogItem) => !!item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();

export function itemAvailability(state: RewardsState, item: CatalogItem): { ok: boolean; reason?: string } {
  if (isExpired(item)) return { ok: false, reason: "Expired — redemption window closed (AC-3)." };
  if (item.stock <= 0) return { ok: false, reason: "Out of stock (AC-3)." };
  if (tierIndex(item.tierRequired) > tierIndex(state.tier)) return { ok: false, reason: `Requires ${item.tierRequired} tier — you're ${state.tier} (AC-2).` };
  if (state.points < item.cost) return { ok: false, reason: `Need ${(item.cost - state.points).toLocaleString()} more points.` };
  const dup = state.redemptions.find((r) => r.itemId === item.id && ["processing", "granted", "applied"].includes(r.status));
  if (dup) return { ok: false, reason: "Already redeemed — duplicate blocked (AC-3)." };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Atomic redemption (AC-1)                                            */
/* ------------------------------------------------------------------ */

export type RedeemResult =
  | { ok: true; state: RewardsState; redemption: Redemption; entry: LedgerEntry }
  | { ok: false; reason: string };

export function redeem(state: RewardsState, itemId: string): RedeemResult {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: "Item not found." };

  const check = itemAvailability(state, item);
  if (!check.ok) return { ok: false, reason: check.reason ?? "Unavailable." };

  const balance = state.points - item.cost;
  const at = new Date().toISOString();
  const code = item.fulfillment === "code" ? `ALPHA-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` : undefined;
  const status: RedemptionStatus = item.fulfillment === "code" ? "granted" : "processing";

  const redemption: Redemption = {
    id: `rd-${Date.now()}`,
    itemId: item.id,
    title: item.title,
    cost: item.cost,
    status,
    code,
    at,
    slaHours: item.slaHours,
  };

  const entry: LedgerEntry = {
    id: `l-${Date.now()}`,
    ts: at,
    type: "spent",
    desc: `Redeemed — ${item.title}`,
    pts: -item.cost,
    balance,
    expiresAt: new Date(0).toISOString(),
    source: item.id,
  };

  const next: RewardsState = {
    ...state,
    points: balance,
    ledger: [entry, ...state.ledger],
    items: state.items.map((i) => (i.id === item.id ? { ...i, stock: i.stock - 1 } : i)),
    redemptions: [redemption, ...state.redemptions],
  };
  saveRewards(next);
  return { ok: true, state: next, redemption, entry };
}

/** Ledger entries whose points expire within `days` (N18 expiry policy). */
export function expiringSoon(state: RewardsState, days = 30): LedgerEntry[] {
  const horizon = Date.now() + days * day;
  return state.ledger.filter((l) => l.pts > 0 && new Date(l.expiresAt).getTime() <= horizon && new Date(l.expiresAt).getTime() > Date.now());
}

export const CATEGORY_LABEL: Record<RewardCategory, string> = {
  fee_rebate: "Fee rebate",
  challenge_discount: "Challenge discount",
  merch: "Merchandise",
  payout_fast_track: "Payout fast-track",
};
