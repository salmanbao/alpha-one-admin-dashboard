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
    balance: 101860.0,
    equity: 102140.5,
    pnl: 1860.0,
    pnlPercent: 1.86,
    profitTarget: 3000,
    targetProgress: 62,
    dailyLossRemaining: 1200,
    maxDdRemaining: 7850,
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
    equity: 27420.0,
    pnl: 2420.0,
    pnlPercent: 9.68,
    profitTarget: 2500,
    targetProgress: 100,
    dailyLossRemaining: 600,
    maxDdRemaining: 1950,
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
    equity: 26450.0,
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
/* Equity curve (30d daily snapshots)                                  */
/* ------------------------------------------------------------------ */

export const equityCurve30d: { x: string; y: number }[] = [
  { x: "Sep 10", y: 100000 },
  { x: "Sep 11", y: 100120 },
  { x: "Sep 12", y: 99980 },
  { x: "Sep 13", y: 100340 },
  { x: "Sep 14", y: 100510 },
  { x: "Sep 15", y: 100430 },
  { x: "Sep 16", y: 100690 },
  { x: "Sep 17", y: 100820 },
  { x: "Sep 18", y: 101010 },
  { x: "Sep 19", y: 100940 },
  { x: "Sep 20", y: 101120 },
  { x: "Sep 21", y: 101240 },
  { x: "Sep 22", y: 101180 },
  { x: "Sep 23", y: 101360 },
  { x: "Sep 24", y: 101480 },
  { x: "Sep 25", y: 101420 },
  { x: "Sep 26", y: 101590 },
  { x: "Sep 27", y: 101510 },
  { x: "Sep 28", y: 101650 },
  { x: "Sep 29", y: 101740 },
  { x: "Sep 30", y: 101680 },
  { x: "Oct 01", y: 101820 },
  { x: "Oct 02", y: 101760 },
  { x: "Oct 03", y: 101910 },
  { x: "Oct 04", y: 101980 },
  { x: "Oct 05", y: 101920 },
  { x: "Oct 06", y: 102050 },
  { x: "Oct 07", y: 102110 },
  { x: "Oct 08", y: 102140 },
];

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
/* Daily P&L (last 14 trading days — feeds the bar chart)              */
/* ------------------------------------------------------------------ */

export const dailyPnl14d: { x: string; y: number }[] = [
  { x: "Sep 22", y: 120 },
  { x: "Sep 23", y: 180 },
  { x: "Sep 24", y: 120 },
  { x: "Sep 25", y: -60 },
  { x: "Sep 26", y: 170 },
  { x: "Sep 27", y: -80 },
  { x: "Sep 28", y: 140 },
  { x: "Sep 29", y: 90 },
  { x: "Sep 30", y: -60 },
  { x: "Oct 01", y: 140 },
  { x: "Oct 02", y: -60 },
  { x: "Oct 03", y: 150 },
  { x: "Oct 04", y: 70 },
  { x: "Oct 06", y: 60 },
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
  bestDayPct: 38, // consistency rule: best day as % of total profit
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
    sl: 148.9,
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
    openedAt: daysAgo(1),
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
    openedAt: daysAgo(2),
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
    openedAt: daysAgo(3),
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
    openedAt: daysAgo(4),
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
    openedAt: daysAgo(5),
    closedAt: daysAgo(5),
    accountId: "acc-100030",
  },
];

/* ------------------------------------------------------------------ */
/* Pending orders                                                      */
/* ------------------------------------------------------------------ */

export const terraOrders = [
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
/* Objectives (evaluation rules)                                       */
/* ------------------------------------------------------------------ */

export const terraObjectives = [
  {
    id: "obj-profit",
    name: "Profit Target",
    current: 1860,
    target: 3000,
    unit: "USD",
    status: "on-track" as const,
    description: "Reach 3% profit without breaching risk limits.",
  },
  {
    id: "obj-daily-dd",
    name: "Daily Loss Limit",
    current: 1800,
    target: 3000,
    unit: "USD",
    status: "on-track" as const,
    description: "Max loss in a single day. $1,200 remaining today.",
  },
  {
    id: "obj-max-dd",
    name: "Maximum Drawdown",
    current: 2150,
    target: 10000,
    unit: "USD",
    status: "on-track" as const,
    description: "Static trailing drawdown from the starting balance.",
  },
  {
    id: "obj-min-days",
    name: "Minimum Trading Days",
    current: 6,
    target: 4,
    unit: "days",
    status: "complete" as const,
    description: "At least 4 active trading days completed.",
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
  {
    id: "obj-consistency",
    name: "Consistency Rule",
    current: 38,
    target: 45,
    unit: "%",
    status: "on-track" as const,
    description: "Best day must stay below 45% of total profit.",
  },
];

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
    title: "62% of profit target reached",
    body: "Account #100030 is $1,140 away from the Phase 1 profit target.",
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
    subject: "62% of your Phase 1 profit target reached",
    body: "Account #100030 is $1,140 away from the target. Keep your daily loss buffer intact.",
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
  },
  {
    id: "doc-2",
    name: "Tax Statement 2025 — Q3",
    type: "tax" as const,
    format: "PDF",
    size: "268 KB",
    date: daysAgo(8),
  },
  {
    id: "doc-3",
    name: "Invoice INV-2025-0831 — Terra Pro $100K",
    type: "invoice" as const,
    format: "PDF",
    size: "96 KB",
    date: daysAgo(12),
  },
  {
    id: "doc-4",
    name: "KYC Verification Report",
    type: "kyc" as const,
    format: "PDF",
    size: "184 KB",
    date: daysAgo(95),
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
