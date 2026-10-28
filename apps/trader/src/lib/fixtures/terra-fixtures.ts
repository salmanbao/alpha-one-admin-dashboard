/**
 * Terra Trader — Fixtures
 *
 * Deterministic mock data for all converted stitch screens.
 * Mirrors the accounts / trades / challenges shown across the
 * stitch_screens library (Terra Pro $100K, Terra Flash Instant $25K, …).
 */

import type { AuthUser, TenantContext } from "@pfaas/platform-core";

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const now = new Date();
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysFromNow = (n: number) => daysAgo(-n);
const hoursAgo = (n: number) => {
  const d = new Date(now);
  d.setHours(d.getHours() - n);
  return d.toISOString();
};
/** Timestamp `hours` before an ISO time — used for trade open times. */
const holdBefore = (iso: string, hours: number) =>
  new Date(+new Date(iso) - hours * 3_600_000).toISOString();

/* ------------------------------------------------------------------ */
/* Tenant & user                                                       */
/* ------------------------------------------------------------------ */

export const terraTenant: TenantContext = {
  id: "tenant-terra",
  slug: "terra",
  name: "TerraTrader",
  application: "trader" as const,
  branding: {
    name: "TerraTrader",
    tagline: "Trade. Grow. Get funded.",
    initials: "TT",
    primaryColor: "#4a7c59",
    accentColor: "#78a886",
    surfaceColor: "#faf6f0",
    radius: "0.5rem",
  },
  locale: "en-US",
  timezone: "America/New_York",
  currency: "USD",
  enabledModules: ["trading", "risk", "payouts", "marketplace"],
  enabledFeatures: ["challenges.two-phase", "risk.daily-drawdown"],
  terminology: {
    challenge: "Challenge",
    trader: "Trader",
    payout: "Payout",
  },
  plan: "growth",
  status: "active",
  createdAt: daysAgo(365),
};

export const terraUser: AuthUser = {
  id: "user-tom-allen",
  tenantId: "tenant-terra",
  email: "tom.allen@terra.trader",
  name: "Tom Allen",
  initials: "TA",
  application: "trader" as const,
  roles: ["trader"],
  permissions: ["trader.self"],
  traderId: "trader-tom",
  lastActiveAt: hoursAgo(0.25),
};

/* ------------------------------------------------------------------ */
/* Trading accounts                                                    */
/* ------------------------------------------------------------------ */

export interface TerraAccount {
  id: string;
  login: string;
  name: string;
  program: string;
  phase: "Phase 1" | "Phase 2" | "Funded";
  platform: "MT5" | "cTrader" | "DXtrade";
  server: string;
  status: "active" | "standby" | "breached" | "provisioning" | "passed";
  balance: number;
  equity: number;
  /** Balance the program started from — payouts and P&L are measured against it. */
  startingBalance: number;
  pnl: number;
  pnlPercent: number;
  profitTarget: number;
  targetProgress: number; // percent
  dailyLossRemaining: number;
  maxDdRemaining: number;
  profitSplit?: string;
  payoutNote?: string;
}

export const terraAccounts: TerraAccount[] = [
  {
    id: "acc-100030",
    login: "100030",
    name: "Terra Pro $100K (Phase 1)",
    program: "Terra Pro $100K",
    phase: "Phase 1",
    platform: "MT5",
    server: "TerraMarkets-Live02",
    status: "active",
    balance: 101688.0,
    equity: 101788.0,
    startingBalance: 100000,
    pnl: 1688.0,
    pnlPercent: 1.69,
    profitTarget: 6000,
    targetProgress: 28,
    dailyLossRemaining: 1200,
    maxDdRemaining: 5850,
  },
  {
    id: "acc-092841",
    login: "92841",
    name: "Terra Flash Instant $25K",
    program: "Terra Flash Instant $25K",
    phase: "Funded",
    platform: "cTrader",
    server: "TerraMarkets-Live01",
    status: "active",
    balance: 27420.0,
    equity: 27890.0,
    startingBalance: 25000,
    pnl: 2420.0,
    pnlPercent: 9.68,
    // No challenge target on a funded account — tracks the 10% net gain
    // ($2,500) required for the next scaling tier (9.68% of 10% = 96.8%).
    profitTarget: 2500,
    targetProgress: 96.8,
    dailyLossRemaining: 600,
    maxDdRemaining: 950,
    profitSplit: "80/20",
    payoutNote: "Bi-weekly • Available in 4 days",
  },
  {
    id: "acc-098412",
    login: "098412",
    name: "Terra Starter $25K (Phase 2)",
    program: "Terra Starter $25K",
    phase: "Phase 2",
    platform: "MT5",
    server: "TerraMarkets-Demo03",
    status: "standby",
    balance: 26450.0,
    equity: 26405.7,
    startingBalance: 25000,
    pnl: 1450.0,
    pnlPercent: 5.8,
    profitTarget: 2000,
    targetProgress: 72.5,
    dailyLossRemaining: 900,
    maxDdRemaining: 2100,
  },
];

export const primaryAccount = terraAccounts[0];

/* ------------------------------------------------------------------ */
/* Announcements / news (M12 Overview)                                 */
/* ------------------------------------------------------------------ */

export const announcements = [
  {
    id: "an-1",
    tag: "platform" as const,
    title: "DXtrade server maintenance — Sunday 02:00 UTC",
    body: "TerraMarkets-Live02 will be unavailable for ~30 minutes. Open positions are unaffected.",
    at: hoursAgo(6),
    pinned: true,
  },
  {
    id: "an-2",
    tag: "payouts" as const,
    title: "Payout window opens every other Friday",
    body: "Request a payout any time — eligible requests are processed on the next bi-weekly cycle.",
    at: daysAgo(2),
    pinned: false,
  },
  {
    id: "an-3",
    tag: "community" as const,
    title: "October Growth Sprint — $10,000 prize pool",
    body: "Funded traders are automatically entered. Climb the leaderboard before month end.",
    at: daysAgo(5),
    pinned: false,
  },
  {
    id: "an-4",
    tag: "product" as const,
    title: "Trade Replay now supports 30-day history",
    body: "Replay any closed trade tick-by-tick from the Trading section of your dashboard.",
    at: daysAgo(9),
    pinned: false,
  },
];

/* ------------------------------------------------------------------ */
/* Challenge timeline (M12 Challenge Detail View)                      */
/* ------------------------------------------------------------------ */

export const challengeTimeline = {
  accountId: "acc-100030",
  startedAt: daysAgo(12),
  maxCalendarDays: 30,
  elapsedDays: 12,
  tradingDays: 12,
  minTradingDays: 4,
  bestDayPct: 35, // consistency rule: best day as % of total profit
  consistencyCap: 45,
};

/* ------------------------------------------------------------------ */
/* Scaling plan (M3-3C Scaling Plan Engine + M10 post-payout check)   */
/* ------------------------------------------------------------------ */

export const scalingPlan = {
  accountId: "acc-092841",
  currentTier: "$25,000",
  nextTier: "$50,000",
  currentSplit: "80/20",
  nextSplit: "85/15",
  consecutivePayouts: 2, // of 3 required
  requiredPayouts: 3,
  fundedDays: 95,
  requiredFundedDays: 90,
  gainPct: 9.68,
  requiredGainPct: 10,
  history: [
    { reference: "PO-2187", at: daysAgo(16), counted: true },
    { reference: "PO-2154", at: daysAgo(30), counted: true },
    { reference: "PO-2119", at: daysAgo(44), counted: true },
    { reference: "PO-2098", at: daysAgo(58), counted: false, note: "below minimum" },
  ],
};

/* ------------------------------------------------------------------ */
/* Payout schedule (M10 Payout Scheduling)                             */
/* ------------------------------------------------------------------ */

export const payoutScheduleOptions = [
  "On-demand",
  "Bi-weekly",
  "Monthly",
] as const;

export const payoutSchedule = {
  current: "Bi-weekly" as (typeof payoutScheduleOptions)[number],
  cycleDays: 14,
  windowOpensAt: daysFromNow(4),
  windowClosesAt: daysFromNow(7),
  cutoffNote: "Requests cut off Fridays 23:59 UTC",
  autoSubmit: false,
};

/* ------------------------------------------------------------------ */
/* Certificates (M12 + M19 Funded Trader Certificate)                  */
/* ------------------------------------------------------------------ */

export interface TerraCertificate {
  id: string;
  title: string;
  program: string;
  accountSize?: string;
  issuedAt: string;
  credentialId: string;
  kind: "funded" | "phase" | "completion";
  status: "issued" | "pending" | "locked";
}

export const terraCertificates: TerraCertificate[] = [
  {
    id: "cert-funded-92841",
    title: "Funded Trader Certificate",
    program: "Terra Flash Instant $25K",
    accountSize: "$25,000",
    issuedAt: daysAgo(95),
    credentialId: "TT-FND-92841-2026",
    kind: "funded",
    status: "issued",
  },
  {
    id: "cert-p1-100030",
    title: "Phase 1 Evaluation Passed",
    program: "Terra Pro $100K",
    accountSize: "$100,000",
    issuedAt: daysAgo(46),
    credentialId: "TT-P1-100030-2026",
    kind: "phase",
    status: "issued",
  },
  {
    id: "cert-p2-098412",
    title: "Phase 2 Evaluation Passed",
    program: "Terra Starter $25K",
    accountSize: "$25,000",
    issuedAt: daysAgo(30),
    credentialId: "TT-P2-098412-2026",
    kind: "phase",
    status: "issued",
  },
  {
    id: "cert-consistency",
    title: "Consistency Mastery Badge",
    program: "Terra Pro $100K — Phase 2",
    issuedAt: daysFromNow(0),
    credentialId: "Pending completion of Phase 2",
    kind: "completion",
    status: "pending",
  },
  {
    id: "cert-scaling",
    title: "Scaling to $200K Certificate",
    program: "Terra Pro $100K — Funded",
    issuedAt: daysFromNow(0),
    credentialId: "Unlocks at 90 days funded + 10% gain",
    kind: "completion",
    status: "locked",
  },
];

/* ------------------------------------------------------------------ */
/* Open positions                                                      */
/* ------------------------------------------------------------------ */

export interface TerraPosition {
  id: string;
  symbol: string;
  side: "long" | "short";
  lots: number;
  entry: number;
  current: number;
  sl: number | null;
  tp: number | null;
  pnl: number;
  swap: number;
  commission: number;
  openedAt: string;
  accountId: string;
}

export const terraPositions: TerraPosition[] = [
  {
    id: "pos-eurusd",
    symbol: "EURUSD",
    side: "long",
    lots: 1.0,
    entry: 1.085,
    current: 1.0875,
    sl: 1.082,
    tp: 1.09,
    pnl: 250.0,
    swap: -1.2,
    commission: -3.5,
    openedAt: daysAgo(3),
    accountId: "acc-100030",
  },
  {
    id: "pos-gbpusd",
    symbol: "GBPUSD",
    side: "short",
    lots: 0.8,
    entry: 1.265,
    current: 1.2625,
    sl: 1.27,
    tp: 1.255,
    pnl: -150.0,
    swap: -0.8,
    commission: -2.8,
    openedAt: daysAgo(2),
    accountId: "acc-100030",
  },
  {
    id: "pos-xauusd",
    symbol: "XAUUSD",
    side: "long",
    lots: 0.5,
    entry: 2652.4,
    current: 2661.8,
    sl: 2640.0,
    tp: 2685.0,
    pnl: 470.0,
    swap: -4.1,
    commission: -5.0,
    openedAt: daysAgo(1),
    accountId: "acc-092841",
  },
  {
    id: "pos-usdjpy",
    symbol: "USDJPY",
    side: "long",
    lots: 0.6,
    entry: 148.32,
    current: 148.21,
    sl: 147.8,
    tp: 149.4,
    pnl: -44.3,
    swap: 2.1,
    commission: -2.1,
    openedAt: hoursAgo(9),
    accountId: "acc-098412",
  },
];

/* ------------------------------------------------------------------ */
/* Closed trades                                                       */
/* ------------------------------------------------------------------ */

export interface TerraTrade {
  id: string;
  ticket: string;
  symbol: string;
  side: "long" | "short";
  lots: number;
  entry: number;
  exit: number;
  pnl: number;
  pips: number;
  openedAt: string;
  closedAt: string;
  accountId: string;
  comment?: string;
}

/* ------------------------------------------------------------------ */
/* Extended closed-trade history (deterministic fill)                  */
/* Declared before terraTrades — feeds table pagination (20/page)      */
/* + richer analytics without hand-writing 40 entries.                 */
/* ------------------------------------------------------------------ */

const histMeta: Record<string, { base: number; decimals: number; pip: number }> = {
  EURUSD: { base: 1.0845, decimals: 5, pip: 0.0001 },
  XAUUSD: { base: 2641.5, decimals: 2, pip: 0.1 },
  GBPJPY: { base: 189.42, decimals: 3, pip: 0.01 },
  USDCAD: { base: 1.3712, decimals: 5, pip: 0.0001 },
  NZDUSD: { base: 0.6121, decimals: 5, pip: 0.0001 },
  AUDUSD: { base: 0.6684, decimals: 5, pip: 0.0001 },
  USDJPY: { base: 149.82, decimals: 3, pip: 0.01 },
  EURJPY: { base: 162.31, decimals: 3, pip: 0.01 },
};

const histSymbols = Object.keys(histMeta);

const histComments = [
  "London open continuation",
  "NY session reversal",
  "Range fade at daily level",
  "Trend pullback entry",
  "Breakout retest",
  "Mean reversion scalp",
];

const extendedTrades: TerraTrade[] = Array.from({ length: 41 }, (_, i) => {
  const symbol = histSymbols[i % histSymbols.length];
  const meta = histMeta[symbol];
  const side: "long" | "short" = i % 3 === 0 ? "short" : "long";
  const win = i % 4 !== 3;
  const pips = win ? 9 + ((i * 11) % 47) : -(7 + ((i * 5) % 28));
  const lots = Math.round((0.2 + (i % 4) * 0.15) * 100) / 100;
  const entry = Number(
    (meta.base + ((i % 7) - 3) * meta.pip * 4).toFixed(meta.decimals),
  );
  const exit = Number(
    (side === "long" ? entry + pips * meta.pip : entry - pips * meta.pip).toFixed(
      meta.decimals,
    ),
  );
  const ticket = String(83_960 - i * 7);
  const closedAt = daysAgo(6 + ((i * 3) % 24));
  const holdHours = 2 + ((i * 7) % 36);
  return {
    id: `trd-${ticket}`,
    ticket,
    symbol,
    side,
    lots,
    entry,
    exit,
    pips,
    pnl: Math.round(pips * lots * 10),
    openedAt: holdBefore(closedAt, holdHours),
    closedAt,
    accountId:
      i % 5 === 0 ? "acc-092841" : i % 7 === 0 ? "acc-098412" : "acc-100030",
    comment: win ? histComments[i % histComments.length] : undefined,
  };
});

export const terraTrades: TerraTrade[] = [
  {
    id: "trd-84012",
    ticket: "84012",
    symbol: "GBPJPY",
    side: "short",
    lots: 0.5,
    entry: 189.42,
    exit: 188.86,
    pnl: 280.0,
    pips: 56,
    openedAt: holdBefore(daysAgo(1), 7),
    closedAt: daysAgo(1),
    accountId: "acc-100030",
    comment: "London reversal setup",
  },
  {
    id: "trd-84009",
    ticket: "84009",
    symbol: "EURUSD",
    side: "long",
    lots: 1.0,
    entry: 1.0831,
    exit: 1.0854,
    pnl: 230.0,
    pips: 23,
    openedAt: holdBefore(daysAgo(2), 4),
    closedAt: daysAgo(2),
    accountId: "acc-100030",
  },
  {
    id: "trd-84005",
    ticket: "84005",
    symbol: "USDCAD",
    side: "short",
    lots: 0.4,
    entry: 1.3712,
    exit: 1.3728,
    pnl: -64.0,
    pips: -16,
    openedAt: holdBefore(daysAgo(3), 11),
    closedAt: daysAgo(3),
    accountId: "acc-100030",
  },
  {
    id: "trd-83998",
    ticket: "83998",
    symbol: "XAUUSD",
    side: "long",
    lots: 0.3,
    entry: 2638.0,
    exit: 2651.5,
    pnl: 405.0,
    pips: 135,
    openedAt: holdBefore(daysAgo(4), 26),
    closedAt: daysAgo(4),
    accountId: "acc-092841",
  },
  {
    id: "trd-83990",
    ticket: "83990",
    symbol: "NZDUSD",
    side: "long",
    lots: 0.6,
    entry: 0.6121,
    exit: 0.6104,
    pnl: -102.0,
    pips: -17,
    openedAt: holdBefore(daysAgo(5), 18),
    closedAt: daysAgo(5),
    accountId: "acc-100030",
  },
  ...extendedTrades,
];

/* ------------------------------------------------------------------ */
/* Pending orders                                                      */
/* ------------------------------------------------------------------ */

export interface TerraOrder {
  id: string;
  ticket: string;
  symbol: string;
  type: string; // "Buy Limit" | "Sell Stop" | …
  lots: number;
  price: number;
  sl: number | null;
  tp: number | null;
  expiry: string;
  placedAt: string;
  status: string;
  accountId: string;
}

export const terraOrders: TerraOrder[] = [
  {
    id: "ord-55011",
    ticket: "55011",
    symbol: "GBPUSD",
    type: "Buy Limit",
    lots: 0.5,
    price: 1.2595,
    sl: 1.2555,
    tp: 1.2675,
    expiry: "GTC",
    placedAt: hoursAgo(6),
    status: "pending",
    accountId: "acc-100030",
  },
  {
    id: "ord-55007",
    ticket: "55007",
    symbol: "XAUUSD",
    type: "Sell Stop",
    lots: 0.3,
    price: 2648.0,
    sl: 2658.0,
    tp: 2632.0,
    expiry: "Today",
    placedAt: hoursAgo(14),
    status: "pending",
    accountId: "acc-092841",
  },
];

/* ------------------------------------------------------------------ */
/* Market watch                                                        */
/* ------------------------------------------------------------------ */

export const marketWatch = [
  { symbol: "EURUSD", bid: 1.08741, ask: 1.08752, change: 0.18, spread: 1.1 },
  { symbol: "GBPUSD", bid: 1.26248, ask: 1.26261, change: -0.12, spread: 1.3 },
  { symbol: "USDJPY", bid: 148.208, ask: 148.219, change: 0.24, spread: 1.2 },
  { symbol: "XAUUSD", bid: 2661.72, ask: 2661.98, change: 0.55, spread: 2.6 },
  { symbol: "GBPJPY", bid: 188.851, ask: 188.879, change: 0.31, spread: 2.8 },
  { symbol: "USDCAD", bid: 1.37212, ask: 1.37226, change: 0.09, spread: 1.4 },
  { symbol: "NZDUSD", bid: 0.61042, ask: 0.61055, change: -0.21, spread: 1.6 },
  { symbol: "AUDUSD", bid: 0.66412, ask: 0.66424, change: -0.08, spread: 1.4 },
];

/* ------------------------------------------------------------------ */
/* Objectives are derived per account — see objectivesFor() below.     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Challenge marketplace                                               */
/* ------------------------------------------------------------------ */

export interface TerraChallenge {
  id: string;
  name: string;
  accountSize: number;
  price: number;
  profitSplit: string;
  profitTarget: string;
  dailyLoss: string;
  maxDrawdown: string;
  minDays: number;
  platforms: string[];
  tag: "instant" | "two-phase" | "one-phase";
  popular?: boolean;
}

export const terraChallenges: TerraChallenge[] = [
  {
    id: "ch-starter-25k",
    name: "Terra Starter",
    accountSize: 25000,
    price: 149,
    profitSplit: "80/20",
    profitTarget: "8%",
    dailyLoss: "4%",
    maxDrawdown: "10%",
    minDays: 3,
    platforms: ["MT5", "cTrader"],
    tag: "two-phase",
  },
  {
    id: "ch-pro-100k",
    name: "Terra Pro",
    accountSize: 100000,
    price: 549,
    profitSplit: "85/15",
    profitTarget: "6%",
    dailyLoss: "3%",
    maxDrawdown: "8%",
    minDays: 4,
    platforms: ["MT5", "cTrader", "DXtrade"],
    tag: "two-phase",
    popular: true,
  },
  {
    id: "ch-flash-25k",
    name: "Terra Flash Instant",
    accountSize: 25000,
    price: 299,
    profitSplit: "80/20",
    profitTarget: "Instant funding",
    dailyLoss: "3%",
    maxDrawdown: "6%",
    minDays: 0,
    platforms: ["MT5", "DXtrade"],
    tag: "instant",
  },
  {
    id: "ch-flash-50k",
    name: "Terra Flash Instant",
    accountSize: 50000,
    price: 499,
    profitSplit: "85/15",
    profitTarget: "Instant funding",
    dailyLoss: "3%",
    maxDrawdown: "6%",
    minDays: 0,
    platforms: ["MT5", "DXtrade"],
    tag: "instant",
  },
  {
    id: "ch-pro-50k",
    name: "Terra Pro",
    accountSize: 50000,
    price: 299,
    profitSplit: "85/15",
    profitTarget: "6%",
    dailyLoss: "3%",
    maxDrawdown: "8%",
    minDays: 4,
    platforms: ["MT5", "cTrader"],
    tag: "two-phase",
  },
  {
    id: "ch-pro-200k",
    name: "Terra Pro",
    accountSize: 200000,
    price: 1049,
    profitSplit: "90/10",
    profitTarget: "6%",
    dailyLoss: "3%",
    maxDrawdown: "8%",
    minDays: 5,
    platforms: ["MT5", "cTrader", "DXtrade"],
    tag: "two-phase",
  },
];

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

export const terraPayouts = [
  {
    id: "po-2201",
    reference: "PO-2201",
    account: "acc-092841",
    accountLogin: "92841",
    amount: 1936.0,
    method: "Bank Transfer (Wise)",
    status: "processing" as const,
    requestedAt: daysAgo(2),
    expectedAt: daysFromNow(2),
  },
  {
    id: "po-2187",
    reference: "PO-2187",
    account: "acc-092841",
    accountLogin: "92841",
    amount: 2100.0,
    method: "USDT (TRC-20)",
    status: "paid" as const,
    requestedAt: daysAgo(16),
    expectedAt: daysAgo(14),
  },
  {
    id: "po-2154",
    reference: "PO-2154",
    account: "acc-092841",
    accountLogin: "92841",
    amount: 1840.0,
    method: "Bank Transfer (Wise)",
    status: "paid" as const,
    requestedAt: daysAgo(30),
    expectedAt: daysAgo(28),
  },
  {
    id: "po-2119",
    reference: "PO-2119",
    account: "acc-092841",
    accountLogin: "92841",
    amount: 1620.0,
    method: "Bank Transfer (Wise)",
    status: "paid" as const,
    requestedAt: daysAgo(44),
    expectedAt: daysAgo(42),
  },
];

export const withdrawalMethods = [
  {
    id: "wm-wise",
    name: "Bank Transfer (Wise)",
    detail: "IBAN •••• 4821 • Tom Allen • USD",
    fee: "$0 (covered by Terra)",
    eta: "1–3 business days",
    primary: true,
  },
  {
    id: "wm-usdt",
    name: "USDT (TRC-20)",
    detail: "Wallet TXyz…9f2c",
    fee: "Network fee ~1 USDT",
    eta: "Within 24 hours",
    primary: false,
  },
  {
    id: "wm-ripple",
    name: "Ripple (XRP)",
    detail: "Wallet rPwX…k4Qm",
    fee: "Network fee ~0.2 XRP",
    eta: "Within 24 hours",
    primary: false,
  },
];

/* ------------------------------------------------------------------ */
/* Risk breaches                                                       */
/* ------------------------------------------------------------------ */

export const traderBreachesFallback = [
  {
    id: "brch-1",
    type: "daily-drawdown",
    severity: "high" as const,
    description: "Daily loss limit reached on Standard Account.",
    at: daysAgo(4),
    status: "resolved" as const,
  },
  {
    id: "brch-2",
    type: "max-drawdown",
    severity: "medium" as const,
    description: "Equity dipped within 1% of the maximum drawdown threshold.",
    at: daysAgo(11),
    status: "resolved" as const,
  },
  {
    id: "brch-3",
    type: "news-blackout",
    severity: "low" as const,
    description: "Position opened inside a scheduled high-impact news window.",
    at: daysAgo(23),
    status: "acknowledged" as const,
  },
];

/* ------------------------------------------------------------------ */
/* Journal entries                                                     */
/* ------------------------------------------------------------------ */

export const journalEntries = [
  {
    id: "jr-31",
    date: daysAgo(1),
    title: "London session — GBPJPY short",
    mood: "disciplined",
    tags: ["reversal", "london", "A+ setup"],
    notes:
      "Waited for the double-top at 189.40 with RSI divergence. Entered on the break of the second top's neckline. Exited at structure support.",
    pnl: 280,
    trades: 2,
  },
  {
    id: "jr-30",
    date: daysAgo(2),
    title: "NY open — EURUSD continuation",
    mood: "confident",
    tags: ["trend", "new-york"],
    notes:
      "Followed the plan: only longs above 1.0820. Added on the pullback to the 15m EMA. Closed half at TP1, rest at structural target.",
    pnl: 230,
    trades: 1,
  },
  {
    id: "jr-29",
    date: daysAgo(3),
    title: "Chop day — cut losses early",
    mood: "frustrated",
    tags: ["range", "revenge-risk"],
    notes:
      "USDCAD went against me immediately. Stop was hit for -0.4%. No revenge trades — closed the platform and reviewed tomorrow's levels.",
    pnl: -64,
    trades: 1,
  },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notifications = [
  {
    id: "nt-1",
    type: "milestone",
    title: "28% of profit target reached",
    body: "Account #100030 is $4,312 away from the Phase 1 profit target ($6,000).",
    at: hoursAgo(1),
    unread: true,
  },
  {
    id: "nt-2",
    type: "payout",
    title: "Payout PO-2201 is processing",
    body: "$1,936.00 is being prepared via Bank Transfer (Wise).",
    at: hoursAgo(5),
    unread: true,
  },
  {
    id: "nt-3",
    type: "risk",
    title: "Daily loss buffer at 40%",
    body: "You have used 60% of the daily loss allowance on #100030.",
    at: hoursAgo(8),
    unread: false,
  },
  {
    id: "nt-4",
    type: "system",
    title: "Scheduled maintenance",
    body: "TerraMarkets-Live02 restarts Sunday 02:00–02:30 UTC.",
    at: daysAgo(1),
    unread: false,
  },
];

/* ------------------------------------------------------------------ */
/* Communication history (M11 CRM — cross-channel log)                 */
/* ------------------------------------------------------------------ */

export interface CommunicationEntry {
  id: string;
  channel: "email" | "sms" | "push";
  subject: string;
  body: string;
  at: string;
  status: "opened" | "delivered" | "sent";
}

export const communicationLog: CommunicationEntry[] = [
  {
    id: "cm-1",
    channel: "email",
    subject: "Payout PO-2201 is on its way",
    body: "$1,936.00 via Bank Transfer (Wise) — expected within 2 business days.",
    at: hoursAgo(5),
    status: "opened",
  },
  {
    id: "cm-2",
    channel: "email",
    subject: "28% of your Phase 1 profit target reached",
    body: "Account #100030 is $4,312 away from the $6,000 target. Keep your daily loss buffer intact.",
    at: daysAgo(1),
    status: "opened",
  },
  {
    id: "cm-3",
    channel: "push",
    subject: "Daily loss buffer at 40%",
    body: "You have used 60% of the daily loss allowance on #100030.",
    at: daysAgo(1),
    status: "delivered",
  },
  {
    id: "cm-4",
    channel: "sms",
    subject: "to +1 (415) •••• 4402",
    body: "Terra: payout PO-2187 ($2,100.00) has been PAID. Track it in your dashboard.",
    at: daysAgo(16),
    status: "delivered",
  },
  {
    id: "cm-5",
    channel: "email",
    subject: "Phase 1 passed — account upgraded",
    body: "Congratulations! Phase 2 credentials were delivered to this address.",
    at: daysAgo(46),
    status: "opened",
  },
  {
    id: "cm-6",
    channel: "email",
    subject: "KYC reminder: document expires in 30 days",
    body: "Re-upload your proof of address to keep payouts flowing without interruption.",
    at: daysAgo(61),
    status: "sent",
  },
  {
    id: "cm-7",
    channel: "push",
    subject: "Welcome to TerraTrader, Tom 🎉",
    body: "Your first challenge is ready — check the Objectives page to track progress.",
    at: daysAgo(120),
    status: "delivered",
  },
];

/* ------------------------------------------------------------------ */
/* Recent activity timeline (M3 §3.6 GET /dashboard/recent-activity)   */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  id: string;
  kind: "trade" | "payout" | "milestone" | "kyc" | "challenge" | "system";
  title: string;
  detail: string;
  at: string;
  href?: string;
}

export const recentActivity: ActivityEntry[] = [
  {
    id: "ac-2",
    kind: "milestone",
    title: "28% of profit target reached",
    detail: "Account #100030 · $4,312 remaining",
    at: hoursAgo(6),
    href: "/objectives",
  },
  {
    id: "ac-3",
    kind: "payout",
    title: "Payout PO-2201 moved to processing",
    detail: "$1,936.00 via Bank Transfer (Wise)",
    at: hoursAgo(9),
    href: "/payout-detail?id=po-2201",
  },
  {
    id: "ac-1",
    kind: "trade",
    title: "Closed GBPJPY short · +$280.00",
    detail: "Ticket #84012 · 0.50 lots · +56 pips",
    at: hoursAgo(24),
    href: "/trade-detail?id=trd-84012",
  },
  {
    id: "ac-4",
    kind: "system",
    title: "MT5 credentials delivered",
    detail: "Login #92841 · TerraMarkets-Live02",
    at: daysAgo(1),
    href: "/trading-credentials",
  },
  {
    id: "ac-5",
    kind: "challenge",
    title: "Trading day 12 logged",
    detail: "Minimum 4 trading days — requirement met ✓",
    at: daysAgo(1),
    href: "/account-detail",
  },
  {
    id: "ac-6",
    kind: "kyc",
    title: "Identity verification approved",
    detail: "Level 2 — payouts unlocked",
    at: daysAgo(3),
    href: "/kyc-verification-status",
  },
  {
    id: "ac-7",
    kind: "challenge",
    title: "Phase 1 passed — account upgraded",
    detail: "Terra Pro $100K · Phase 2 credentials issued",
    at: daysAgo(46),
    href: "/evaluation-passed",
  },
];

/* ------------------------------------------------------------------ */
/* Support tickets                                                     */
/* ------------------------------------------------------------------ */

export const supportTickets = [
  {
    id: "tk-1024",
    subject: "Credentials not arriving for #92841",
    category: "Accounts",
    status: "open" as const,
    priority: "high" as const,
    updatedAt: hoursAgo(3),
    messages: [
      {
        author: "Tom Allen",
        at: daysAgo(1),
        body: "I passed the instant verification yesterday but haven't received MT5 credentials for account #92841 yet.",
      },
      {
        author: "Terra Support",
        at: hoursAgo(3),
        body: "Hi Tom — your credentials were re-sent to your registered email a few minutes ago. Please also check spam. We've escalated to provisioning to make sure the server was attached correctly.",
      },
    ],
  },
  {
    id: "tk-1019",
    subject: "Payout method change for PO-2201",
    category: "Payouts",
    status: "answered" as const,
    priority: "normal" as const,
    updatedAt: daysAgo(1),
    messages: [
      {
        author: "Tom Allen",
        at: daysAgo(2),
        body: "Can I switch PO-2201 from bank transfer to USDT before it processes?",
      },
      {
        author: "Terra Support",
        at: daysAgo(1),
        body: "Yes — as long as the payout hasn't been sent you can change the method from Withdrawal Methods. I've unlocked it for you.",
      },
    ],
  },
  {
    id: "tk-1012",
    subject: "Weekend holding clarification",
    category: "Rules",
    status: "closed" as const,
    priority: "low" as const,
    updatedAt: daysAgo(9),
    messages: [
      {
        author: "Tom Allen",
        at: daysAgo(10),
        body: "Is weekend holding allowed on Terra Pro Phase 1?",
      },
      {
        author: "Terra Support",
        at: daysAgo(9),
        body: "Yes, holding over the weekend is allowed on all Terra Pro challenges. Only news-trading restrictions apply.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Help Center articles (M3 §3.9 knowledge base)                       */
/* ------------------------------------------------------------------ */

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  popular: boolean;
  answer: string;
}

export const helpArticles: HelpArticle[] = [
  {
    id: "ha-1",
    category: "challenges",
    title: "How is the daily loss limit calculated?",
    popular: true,
    answer:
      "The daily loss limit is measured on equity (balance + floating P&L) at 00:00 UTC. It includes realised losses, floating losses and commissions for the current trading day. Hitting 100% of the allowance breaches the account, so we recommend risking well under 1% per trade.",
  },
  {
    id: "ha-2",
    category: "payouts",
    title: "When is my first payout available?",
    popular: true,
    answer:
      "Your first payout request becomes available 14 calendar days after your first winning day on a funded account. After that, payouts can be requested every 14 days. Requests submitted before 12:00 UTC are typically processed the same business day.",
  },
  {
    id: "ha-3",
    category: "platform",
    title: "Which platforms can I trade on?",
    popular: true,
    answer:
      "Terra supports MetaTrader 5 (desktop, web and mobile) as the primary platform. All challenge and funded accounts are provisioned on MT5 — download links and credentials are available on the Trading Credentials page.",
  },
  {
    id: "ha-4",
    category: "security",
    title: "How do I reset my trading password?",
    popular: true,
    answer:
      "Open Trading Credentials, find the account and press “Reset password”. A fresh investor password is emailed to your registered address within minutes and the old password stops working immediately. Platform (master) password resets require support verification.",
  },
  {
    id: "ha-5",
    category: "challenges",
    title: "Can I hold positions over the weekend?",
    popular: true,
    answer:
      "Yes — positions may be held across the weekend on funded accounts. During evaluation, holding through the Friday close is allowed but strongly discouraged: gap risk counts toward your drawdown the moment markets reopen Sunday 22:00 UTC.",
  },
  {
    id: "ha-6",
    category: "kyc",
    title: "How long does KYC verification take?",
    popular: true,
    answer:
      "Most identity checks are approved within a few hours and never longer than 2 business days. You'll receive an in-app notification and an email as soon as your status changes. Payouts stay locked until Level 2 verification is approved.",
  },
  {
    id: "ha-7",
    category: "challenges",
    title: "What is the consistency rule?",
    popular: false,
    answer:
      "Your best trading day must not exceed 45% of total profit at the time of a payout request or phase completion. This keeps performance steady rather than depending on one lucky day. The objectives page shows your current consistency ratio live.",
  },
  {
    id: "ha-8",
    category: "challenges",
    title: "How many trading days are required?",
    popular: false,
    answer:
      "Phase 1 requires a minimum of 4 trading days with at least one position per day. There is no maximum — the 30-day calendar limit is the only deadline. Days with no market movement (holidays) don't count against you.",
  },
  {
    id: "ha-9",
    category: "getting-started",
    title: "How do I get my MT5 credentials?",
    popular: false,
    answer:
      "Credentials are issued automatically once your purchase or evaluation starts — check the Trading Credentials page and your registered email. If more than an hour has passed, open a support ticket with your login number and we'll re-provision the account.",
  },
  {
    id: "ha-10",
    category: "getting-started",
    title: "What happens after I pass Phase 1?",
    popular: false,
    answer:
      "Phase 2 credentials are issued automatically and your account upgrades in place — same login style, new phase label. You'll get a notification, an email, and the evaluation-passed screen summarising your stats before Phase 2 begins.",
  },
  {
    id: "ha-11",
    category: "payouts",
    title: "Which withdrawal methods are supported?",
    popular: false,
    answer:
      "Bank transfer (Wise), USDT (TRC-20) and Ripple (XRP) are available out of the box, and you can add more from Withdrawal Methods. Bank transfers are free; crypto methods pass through the network fee only.",
  },
  {
    id: "ha-12",
    category: "security",
    title: "How do I enable two-factor authentication?",
    popular: false,
    answer:
      "Go to Profile & Security → Two-Factor Auth, scan the QR code with an authenticator app and enter the 6-digit code to confirm. Once enabled, new devices require the code at sign-in and sensitive actions (payouts, password changes) ask for it again.",
  },
  {
    id: "ha-13",
    category: "kyc",
    title: "Which documents do I need for KYC?",
    popular: false,
    answer:
      "Level 1 needs a government-issued photo ID (passport or driving licence). Level 2 adds a recent proof of address (utility bill or bank statement, issued within 3 months). Both must be clear, uncropped and match your profile details.",
  },
  {
    id: "ha-14",
    category: "platform",
    title: "Can I run EAs or copy trading?",
    popular: false,
    answer:
      "Expert Advisors are allowed as long as they don't exploit platform latency or tick data. Third-party copy trading between accounts is permitted; copy services that mirror other traders' signals across multiple Terra accounts are not.",
  },
];

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const terraDocuments = [
  {
    id: "doc-1",
    name: "Account Statement — October",
    type: "statement" as const,
    format: "PDF",
    size: "412 KB",
    date: daysAgo(1),
    // Deep-links the statement page to the document's month.
    href: "/account-statement?month=2026-10",
  },
  {
    id: "doc-2",
    name: "Tax Statement 2025 — Q3",
    type: "tax" as const,
    format: "PDF",
    size: "268 KB",
    date: daysAgo(8),
    href: "/tax-statement-detail?id=tx-2025-q3",
  },
  {
    id: "doc-3",
    name: "Invoice INV-2026-0831 — Terra Pro $100K",
    type: "invoice" as const,
    format: "PDF",
    size: "96 KB",
    date: daysAgo(12),
    href: "/invoice-detail?id=0831",
  },
  {
    id: "doc-4",
    name: "KYC Verification Report",
    type: "kyc" as const,
    format: "PDF",
    size: "184 KB",
    date: daysAgo(95),
    href: "/kyc-verification-status",
  },
];

/* ------------------------------------------------------------------ */
/* Economic calendar                                                   */
/* ------------------------------------------------------------------ */

export const economicEvents = [
  {
    id: "ev-1",
    time: "13:30",
    currency: "USD",
    impact: "high" as const,
    event: "Non-Farm Payrolls (Sep)",
    forecast: "145K",
    previous: "142K",
  },
  {
    id: "ev-2",
    time: "13:30",
    currency: "USD",
    impact: "high" as const,
    event: "Unemployment Rate",
    forecast: "4.2%",
    previous: "4.2%",
  },
  {
    id: "ev-3",
    time: "15:00",
    currency: "CAD",
    impact: "medium" as const,
    event: "Ivey PMI",
    forecast: "52.4",
    previous: "51.9",
  },
  {
    id: "ev-4",
    time: "23:50",
    currency: "JPY",
    impact: "medium" as const,
    event: "BoJ Summary of Opinions",
    forecast: "—",
    previous: "—",
  },
];

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export const leaderboard = [
  { rank: 1, name: "Mia Chen", gain: "+18.4%", trades: 212, country: "🇸🇬" },
  { rank: 2, name: "Diego Alvarez", gain: "+15.1%", trades: 178, country: "🇪🇸" },
  { rank: 3, name: "Tom Allen", gain: "+9.7%", trades: 142, country: "🇺🇸", me: true },
  { rank: 4, name: "Sara Lindqvist", gain: "+8.2%", trades: 96, country: "🇸🇪" },
  { rank: 5, name: "Ahmed Hassan", gain: "+7.6%", trades: 233, country: "🇦🇪" },
];

/* ------------------------------------------------------------------ */
/* Competitions                                                        */
/* ------------------------------------------------------------------ */

export const competitions = [
  {
    id: "cmp-oct",
    name: "October Growth Sprint",
    prize: "$10,000 prize pool",
    entry: "Free for funded traders",
    endsAt: daysFromNow(21),
    participants: 1284,
    status: "active" as const,
  },
  {
    id: "cmp-sep",
    name: "September Consistency Cup",
    prize: "$5,000 prize pool",
    entry: "Completed",
    endsAt: daysAgo(8),
    participants: 972,
    status: "ended" as const,
    placement: 14,
  },
];

/* ------------------------------------------------------------------ */
/* Referrals                                                           */
/* ------------------------------------------------------------------ */

export const referralStats = {
  code: "TOM-9F2K",
  referrals: 14,
  active: 9,
  earned: 1260,
  pending: 180,
  rate: "10% of every challenge fee",
};

export const referralHistory = [
  { id: "rf-1", who: "j****@gmail.com", joined: daysAgo(4), status: "purchased", reward: 54.9 },
  { id: "rf-2", who: "m****@outlook.com", joined: daysAgo(11), status: "passed-kyc", reward: 0 },
  { id: "rf-3", who: "k****@proton.me", joined: daysAgo(19), status: "purchased", reward: 54.9 },
  { id: "rf-4", who: "a****@yahoo.com", joined: daysAgo(28), status: "purchased", reward: 16.5 },
];

/* ------------------------------------------------------------------ */
/* Login / sessions                                                    */
/* ------------------------------------------------------------------ */

export const loginSessions = [
  {
    id: "ss-1",
    device: "Chrome 141 • macOS",
    location: "San Francisco, US",
    ip: "73.12.44.102",
    at: hoursAgo(0.4),
    current: true,
  },
  {
    id: "ss-2",
    device: "Safari • iPhone 16",
    location: "San Francisco, US",
    ip: "73.12.44.102",
    at: daysAgo(1),
    current: false,
  },
  {
    id: "ss-3",
    device: "MT5 Desktop • Windows",
    location: "Ashburn, US",
    ip: "52.4.19.88",
    at: daysAgo(3),
    current: false,
  },
];

/* ------------------------------------------------------------------ */
/* API tokens                                                          */
/* ------------------------------------------------------------------ */

export const apiTokens = [
  {
    id: "tok-1",
    name: "Journal sync (local)",
    prefix: "tt_live_9f2k…",
    scopes: ["read:accounts", "read:trades"],
    createdAt: daysAgo(12),
    lastUsedAt: hoursAgo(2),
  },
  {
    id: "tok-2",
    name: "Analytics dashboard",
    prefix: "tt_live_4a8m…",
    scopes: ["read:accounts", "read:payouts"],
    createdAt: daysAgo(40),
    lastUsedAt: daysAgo(2),
  },
];

/* ------------------------------------------------------------------ */
/* Per-account derived data                                            */
/*                                                                     */
/* Everything a trader cross-checks between screens — equity curves,   */
/* daily P&L, evaluation objectives and program rules — is derived     */
/* from one source (accounts + trades + payouts) so switching the      */
/* active account can never show two different versions of the truth.  */
/* ------------------------------------------------------------------ */

/** Program risk limits per account — single source of truth for the
 *  risk dashboard gauges and the objectives page. */
export const terraRiskLimits: Record<string, { daily: number; maxDd: number }> = {
  "acc-100030": { daily: 3000, maxDd: 8000 },
  "acc-092841": { daily: 750, maxDd: 1500 },
  "acc-098412": { daily: 1000, maxDd: 2500 },
};

export type TerraSeriesPoint = { x: string; y: number };

const DAY_MS = 86_400_000;
const startOfUtcDay = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const dayLabel = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
/** Deterministic pseudo-random in [-1, 1] — keeps mock series stable across renders. */
const wobble = (seed: number) => {
  const s = Math.sin(seed) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};
/** Compact whole-dollar money for fixture copy: $1,200 / $4,312. */
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Daily equity curve for one account over the last `days` days.
 *
 * Derived, not hand-written: each day reads
 *   balance(today) − closed P&L after that day + payouts after that day
 * (payouts reduce balance), with today ending at equity (balance +
 * floating). Small deterministic wobble mimics intraday equity drift
 * when no trades close. This is what makes the 7d/30d/90d toggles and
 * the account switcher agree with the balances shown next to them.
 */
export function equityCurveFor(accountId: string, days: number): TerraSeriesPoint[] {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) return [];
  const floating = terraPositions
    .filter((p) => p.accountId === accountId)
    .reduce((s, p) => s + p.pnl, 0);
  const today = startOfUtcDay(Date.now());
  const span = Math.max(1, Math.floor(days));
  const out: TerraSeriesPoint[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const dayStart = today - i * DAY_MS;
    let y: number;
    if (i === 0) {
      y = acc.balance + floating; // today: balance + unrealized P&L
    } else {
      const dayEnd = dayStart + DAY_MS;
      const closedAfter = terraTrades
        .filter((t) => t.accountId === accountId && +new Date(t.closedAt) >= dayEnd)
        .reduce((s, t) => s + t.pnl, 0);
      const paidAfter = terraPayouts
        .filter(
          (p) =>
            p.account === accountId && p.status === "paid" && +new Date(p.requestedAt) >= dayEnd,
        )
        .reduce((s, p) => s + p.amount, 0);
      y =
        acc.balance -
        closedAfter +
        paidAfter +
        wobble(dayStart / DAY_MS) * acc.balance * 0.0007;
    }
    out.push({ x: dayLabel(dayStart), y: Math.round(y * 100) / 100 });
  }
  return out;
}

/** Net P&L closed on each of the last `days` days (0 on non-trading days). */
export function dailyPnlFor(accountId: string, days = 14): TerraSeriesPoint[] {
  const today = startOfUtcDay(Date.now());
  const span = Math.max(1, Math.floor(days));
  const out: TerraSeriesPoint[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const dayStart = today - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const y = terraTrades
      .filter(
        (t) =>
          t.accountId === accountId &&
          +new Date(t.closedAt) >= dayStart &&
          +new Date(t.closedAt) < dayEnd,
      )
      .reduce((s, t) => s + t.pnl, 0);
    out.push({ x: dayLabel(dayStart), y: Math.round(y * 100) / 100 });
  }
  return out;
}

/** Marketplace challenge backing an account (matched by program name + size). */
export function challengeForAccount(accountId: string) {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) return undefined;
  return terraChallenges.find((ch) => `${ch.name} $${ch.accountSize / 1000}K` === acc.program);
}

export interface TerraObjective {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  status: "complete" | "on-track";
  description: string;
}

/**
 * Objectives for the given account.
 *
 * Evaluations (Phase 1 / Phase 2) track the profit target, daily loss,
 * max drawdown, minimum trading days and consistency. Funded accounts
 * have no profit target — they track scaling progression and payout
 * health instead. Every number derives from the account record, its
 * program limits and its actual trade history.
 */
export function objectivesFor(accountId: string): TerraObjective[] {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) return [];
  const limits = terraRiskLimits[accountId] ?? { daily: 1000, maxDd: 5000 };
  const trades = terraTrades.filter((t) => t.accountId === accountId);
  const paidPayouts = terraPayouts.filter(
    (p) => p.account === accountId && p.status === "paid",
  );
  // Total profit generated over the account's life (payouts don't erase
  // it — they move it off the balance).
  const grossProfit = acc.pnl + paidPayouts.reduce((s, p) => s + p.amount, 0);
  const dayTotals = new Map<string, number>();
  for (const t of trades) {
    const k = t.closedAt.slice(0, 10);
    dayTotals.set(k, (dayTotals.get(k) ?? 0) + t.pnl);
  }
  const bestDayPct =
    grossProfit > 0 && dayTotals.size > 0
      ? Math.round((Math.max(...dayTotals.values()) / grossProfit) * 100)
      : 0;

  const dailyUsed = Math.max(0, limits.daily - acc.dailyLossRemaining);
  const ddUsed = Math.max(0, limits.maxDd - acc.maxDdRemaining);

  const dailyObjective: TerraObjective = {
    id: "obj-daily-dd",
    name: "Daily Loss Limit",
    current: dailyUsed,
    target: limits.daily,
    unit: "USD",
    status: "on-track",
    description: `Max loss in a single day. ${usd(acc.dailyLossRemaining)} remaining today.`,
  };
  const consistencyObjective: TerraObjective = {
    id: "obj-consistency",
    name: "Consistency Rule",
    current: bestDayPct,
    target: 45,
    unit: "%",
    status: "on-track",
    description: `Best day must stay below 45% of total profit (currently ${bestDayPct}%).`,
  };

  if (acc.phase === "Funded") {
    const netGain = acc.balance - acc.startingBalance;
    const gainPct = Math.round((netGain / acc.startingBalance) * 10000) / 100;
    return [
      {
        id: "obj-scaling-gain",
        name: "Scaling Net Gain",
        current: gainPct,
        target: scalingPlan.requiredGainPct,
        unit: "%",
        status: gainPct >= scalingPlan.requiredGainPct ? "complete" : "on-track",
        description: `${usd(netGain)} net profit — 10% over the starting balance unlocks the ${scalingPlan.nextTier} tier.`,
      },
      {
        id: "obj-scaling-payouts",
        name: "Counted Payouts",
        current: scalingPlan.consecutivePayouts,
        target: scalingPlan.requiredPayouts,
        unit: "",
        status:
          scalingPlan.consecutivePayouts >= scalingPlan.requiredPayouts
            ? "complete"
            : "on-track",
        description: `${scalingPlan.requiredPayouts} consecutive counted payouts required to scale to ${scalingPlan.nextTier}.`,
      },
      dailyObjective,
      {
        id: "obj-max-dd",
        name: "Maximum Drawdown",
        current: ddUsed,
        target: limits.maxDd,
        unit: "USD",
        status: "on-track",
        description: "Trailing drawdown measured from the equity high-water mark.",
      },
      consistencyObjective,
    ];
  }

  const targetPct = Math.round((acc.profitTarget / acc.startingBalance) * 100);
  const minDays = challengeForAccount(accountId)?.minDays ?? 4;
  const tradingDays = dayTotals.size;
  return [
    {
      id: "obj-profit",
      name: "Profit Target",
      current: acc.pnl,
      target: acc.profitTarget,
      unit: "USD",
      status: acc.pnl >= acc.profitTarget ? "complete" : "on-track",
      description: `Reach ${targetPct}% profit without breaching risk limits.`,
    },
    dailyObjective,
    {
      id: "obj-max-dd",
      name: "Maximum Drawdown",
      current: ddUsed,
      target: limits.maxDd,
      unit: "USD",
      status: "on-track",
      description: "Static drawdown from the starting balance.",
    },
    {
      id: "obj-min-days",
      name: "Minimum Trading Days",
      current: tradingDays,
      target: minDays,
      unit: "days",
      status: tradingDays >= minDays ? "complete" : "on-track",
      description: `At least ${minDays} active trading days completed.`,
    },
    {
      id: "obj-news",
      name: "News Trading Restriction",
      current: 0,
      target: 0,
      unit: "",
      status: "complete" as const,
      description: "No violations of the high-impact news blackout.",
    },
    consistencyObjective,
  ];
}

export interface TerraRule {
  id: string;
  title: string;
  value: string;
  allowed: boolean;
  description: string;
}

/** Full parameter table per program (Phase 1 / Phase 2 / Funded columns). */
const PROGRAM_PARAMETERS: Record<string, string[][]> = {
  "Terra Pro $100K": [
    ["Profit Target", "6%", "4%", "—"],
    ["Daily Loss Limit", "3%", "3%", "3%"],
    ["Maximum Drawdown", "8%", "8%", "6% trailing"],
    ["Minimum Trading Days", "4", "4", "—"],
    ["Profit Split", "—", "—", "85/15"],
    ["Payout Frequency", "—", "—", "Bi-weekly"],
    ["Leverage", "1:50", "1:50", "1:30"],
    ["Max Lot Size", "10", "10", "Per margin"],
  ],
  "Terra Starter $25K": [
    ["Profit Target", "8%", "8%", "—"],
    ["Daily Loss Limit", "4%", "4%", "4%"],
    ["Maximum Drawdown", "10%", "10%", "10% trailing"],
    ["Minimum Trading Days", "3", "3", "—"],
    ["Profit Split", "—", "—", "80/20"],
    ["Payout Frequency", "—", "—", "Bi-weekly"],
    ["Leverage", "1:50", "1:50", "1:30"],
    ["Max Lot Size", "10", "10", "Per margin"],
  ],
  "Terra Flash Instant $25K": [
    ["Profit Target", "—", "—", "None"],
    ["Daily Loss Limit", "—", "—", "3%"],
    ["Maximum Drawdown", "—", "—", "6% trailing"],
    ["Minimum Trading Days", "—", "—", "—"],
    ["Profit Split", "—", "—", "80/20"],
    ["Payout Frequency", "—", "—", "Bi-weekly"],
    ["Leverage", "—", "—", "1:30"],
    ["Max Lot Size", "—", "—", "Per margin"],
  ],
};

/**
 * The rulebook for one account's program — used by /rules so the page
 * always matches whichever account is active in the header switcher.
 */
export function accountRules(accountId: string): {
  heading: string;
  rules: TerraRule[];
  parameters: string[][];
} {
  const acc = terraAccounts.find((a) => a.id === accountId) ?? terraAccounts[0];
  const limits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyPct = Math.round((limits.daily / acc.startingBalance) * 100);
  const ddPct = Math.round((limits.maxDd / acc.startingBalance) * 100);
  const targetPct = Math.round((acc.profitTarget / acc.startingBalance) * 100);
  const isFunded = acc.phase === "Funded";
  const minDays = challengeForAccount(acc.id)?.minDays ?? 4;

  const rules: TerraRule[] = [
    {
      id: "r1",
      title: "Profit Target",
      value: isFunded
        ? "None — instant funded balance"
        : `${targetPct}% (${usd(acc.profitTarget)}) for ${acc.phase}`,
      allowed: true,
      description: isFunded
        ? "No evaluation target — you trade a live funded balance from day one."
        : `Reach the ${acc.phase} profit target without violating any risk rules.`,
    },
    {
      id: "r2",
      title: "Daily Loss Limit",
      value: `${dailyPct}% (${usd(limits.daily)})`,
      allowed: false,
      description:
        "Equity or balance, whichever is lower, measured from the day's starting equity.",
    },
    {
      id: "r3",
      title: "Maximum Drawdown",
      value: `${ddPct}% ${isFunded ? "trailing" : "static"} (${usd(limits.maxDd)})`,
      allowed: false,
      description: isFunded
        ? "Trailing from the equity high-water mark; locks at the starting balance once profit reaches 10%."
        : "Static drawdown from the initial account balance.",
    },
    {
      id: "r4",
      title: "Minimum Trading Days",
      value: isFunded ? "—" : `${minDays} days`,
      allowed: true,
      description:
        "A trading day counts when at least 0.5% of the account is traded.",
    },
    {
      id: "r5",
      title: "News Trading",
      value: "Restricted ±2 min on high-impact",
      allowed: false,
      description:
        "No opening or closing positions within 2 minutes of high-impact news on the affected currency.",
    },
    {
      id: "r6",
      title: "Weekend Holding",
      value: "Allowed",
      allowed: true,
      description:
        "Positions may be held over the weekend on all Terra programs.",
    },
    {
      id: "r7",
      title: "Expert Advisors",
      value: "Allowed (own EAs only)",
      allowed: true,
      description:
        "Personal EAs are permitted. Copy-trading between Terra accounts or third parties is not.",
    },
    {
      id: "r8",
      title: "Prohibited Practices",
      value: "HFT, latency arb, tick scalping abuse",
      allowed: false,
      description:
        "Group trading, arbitrage between accounts and toxic-order strategies lead to account termination.",
    },
  ];

  return {
    heading: `${acc.program} — the rulebook for ${
      isFunded ? "your funded account" : `your ${acc.phase}`
    }`,
    rules,
    parameters: PROGRAM_PARAMETERS[acc.program] ?? PROGRAM_PARAMETERS["Terra Pro $100K"],
  };
}

/* ------------------------------------------------------------------ */
/* Payout entitlement (M3-2 Payout Request Flow + M10 post-payout)    */
/* ------------------------------------------------------------------ */

export interface PayoutEntitlement {
  isFunded: boolean;
  /** Payouts unlock only on funded accounts. */
  eligible: boolean;
  /** Trader's share of net profit available to withdraw right now. */
  withdrawable: number;
  /** Trader's profit split percent (80 from "80/20"). */
  splitPct: number;
  /** Net profit since the account was funded (balance − starting). */
  netProfit: number;
  /** Balance never dropped to/below the starting balance since funding. */
  healthy: boolean;
  /** Blocker copy when not eligible — undefined when eligible. */
  reason?: string;
}

/**
 * What an account can withdraw right now.
 *
 * Payouts are a funded-only mechanic: evaluation phases accumulate
 * profit but cannot pay out. On a funded account the withdrawable
 * amount is the trader's split of net profit (profit split from the
 * account record, e.g. 80/20 → 80%). A "flat" account (balance at or
 * below the starting balance) has nothing to withdraw, and the
 * challenge fee is refunded with the first payout on funded accounts.
 */
export function payoutEntitlement(accountId: string): PayoutEntitlement {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) {
    return {
      isFunded: false,
      eligible: false,
      withdrawable: 0,
      splitPct: 0,
      netProfit: 0,
      healthy: false,
      reason: "Account not found.",
    };
  }
  const isFunded = acc.phase === "Funded";
  const splitPct = acc.profitSplit ? Number(acc.profitSplit.split("/")[0]) || 0 : 0;
  const netProfit = acc.balance - acc.startingBalance;
  const healthy = netProfit > 0;
  const withdrawable = healthy ? Math.round(netProfit * (splitPct / 100) * 100) / 100 : 0;

  if (!isFunded) {
    return {
      isFunded: false,
      eligible: false,
      withdrawable: 0,
      splitPct,
      netProfit,
      healthy,
      reason: `Payouts unlock on funded accounts — #${acc.login} is still in ${acc.phase}. Pass the evaluation to start withdrawing.`,
    };
  }
  if (!healthy) {
    return {
      isFunded: true,
      eligible: false,
      withdrawable: 0,
      splitPct,
      netProfit,
      healthy,
      reason: `Nothing to withdraw — #${acc.login} is flat (balance ${usd(acc.balance)} vs starting ${usd(acc.startingBalance)}). Rebuild profit above the starting balance first.`,
    };
  }
  return { isFunded: true, eligible: true, withdrawable, splitPct, netProfit, healthy };
}
