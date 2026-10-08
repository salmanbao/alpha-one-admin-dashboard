/**
 * Trader App — Mock Fixtures
 *
 * Deterministic mock data for the trader app only.
 * Contains only trader-specific demo data (no super-admin or other tenant data).
 * Seeded so the dashboard is stable across reloads.
 */

import type { AuthUser, TenantContext } from "@pfaas/platform-core";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const now = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return iso(d);
};
const hoursAgo = (n: number) => {
  const d = new Date(now);
  d.setHours(d.getHours() - n);
  return iso(d);
};

/* ------------------------------------------------------------------ */
/* Tenants                                                             */
/* ------------------------------------------------------------------ */

export const tradersTenant: TenantContext = {
  id: "tenant-trader",
  slug: "trader",
  name: "Trader",
  application: "trader" as const,
  branding: {
    name: "Trader",
    tagline: "Your trading workspace",
    initials: "TR",
    primaryColor: "#1e40af", // blue-600
    accentColor: "#3b82f6", // blue-500
    surfaceColor: "#f8fafc",
    radius: "0.5rem",
  },
  locale: "en-US",
  timezone: "America/New_York",
  currency: "USD",
  enabledModules: ["trading", "risk", "payouts"],
  enabledFeatures: ["challenges.two-phase", "risk.daily-drawdown"],
  terminology: {
    challenge: "Evaluation",
    trader: "Participant",
    payout: "Withdrawal",
  },
  plan: "growth",
  status: "active",
  createdAt: daysAgo(180),
};

/* ------------------------------------------------------------------ */
/* Auth User — Trader Demo User                                         */
/* ------------------------------------------------------------------ */

export const traderUser: AuthUser = {
  id: "user-trader-1",
  tenantId: "tenant-trader",
  email: "trader@example.com",
  name: "Trader One",
  initials: "TO",
  application: "trader" as const,
  roles: ["trader"],
  permissions: ["trader.self"],
  traderId: "trader-1",
  lastActiveAt: hoursAgo(1),
};

/* ------------------------------------------------------------------ */
/* Positions & Accounts                                                 */
/* ------------------------------------------------------------------ */

export const traderPositions = [
  {
    id: "pos-1",
    symbol: "EURUSD",
    side: "long",
    size: 100000,
    entryPrice: 1.0850,
    currentPrice: 1.0875,
    pnl: 250,
    pnlPercent: 0.23,
    marginUsed: 1000,
    marginRemaining: 4000,
    marginPercent: 2,
    stopLoss: 1.0820,
    takeProfit: 1.0900,
    openedAt: daysAgo(3),
    updatedAt: hoursAgo(2),
    status: "open",
  },
  {
    id: "pos-2",
    symbol: "GBPUSD",
    side: "short",
    size: 100000,
    entryPrice: 1.2650,
    currentPrice: 1.2625,
    pnl: -150,
    pnlPercent: -0.12,
    marginUsed: 800,
    marginRemaining: 5000,
    marginPercent: 1.6,
    stopLoss: 1.2700,
    takeProfit: 1.2550,
    openedAt: daysAgo(7),
    updatedAt: hoursAgo(1),
    status: "open",
  },
];

export const traderAccounts = [
  {
    id: "acc-1",
    traderId: "trader-1",
    accountName: "Standard Account",
    accountType: "standard",
    currency: "USD",
    balance: 10000,
    equity: 10250,
    marginUsed: 1800,
    marginRemaining: 8200,
    marginPercent: 18,
    unrealizedPnl: 250,
    realizedPnl: 1200,
    dailyPnl: 130,
    status: "active",
  },
];

/* ------------------------------------------------------------------ */
/* Trading KPIs                                                         */
/* ------------------------------------------------------------------ */

export const traderKpis = {
  totalOpenPositions: traderPositions.length,
  totalClosedPositions: 24,
  totalDeposits: 12500,
  totalWithdrawals: 8700,
  totalProfit: 4750,
  totalLoss: 1200,
  winRate: 68,
  avgTradeDuration: "4h 22m",
  totalTrades: 142,
  totalPnL: 3550,
};

/* ------------------------------------------------------------------ */
/* Trader Profiles (My Workspace detail)                               */
/* ------------------------------------------------------------------ */

export const traderProfiles = [
  {
    id: "trader-1",
    tenantId: "tenant-trader",
    name: "Trader One",
    email: "trader@example.com",
    application: "trader",
    status: "active",
    createdAt: daysAgo(180),
    country: "United States",
    accountBalance: 10250,
    equity: 10250,
    totalPnl: 3550,
    winRate: 68,
    trades: 142,
  },
];

/* ------------------------------------------------------------------ */
/* KYC (single record per trader)                                      */
/* ------------------------------------------------------------------ */

export const traderKyc = {
  traderId: "trader-1",
  verificationStatus: "approved",
  verificationNotes:
    "Identity and address documents verified. AML screening cleared.",
  level: "Level 2",
  expiresAt: daysAgo(-185), // expires ~6 months from now
  fullName: "Trader One",
  dateOfBirth: "1990-04-12",
  address: "123 Market St, San Francisco, CA 94103, USA",
  phone: "+1 (415) 555-0142",
  email: "trader@example.com",
  submittedAt: daysAgo(90),
};

/* ------------------------------------------------------------------ */
/* Risk Breaches                                                       */
/* ------------------------------------------------------------------ */

export const traderBreaches = [
  {
    id: "brch-1",
    traderId: "trader-1",
    accountId: "acc-1",
    type: "daily-drawdown",
    severity: "high",
    description: "Daily loss limit reached on Standard Account.",
    timestamp: daysAgo(4),
    status: "resolved",
  },
  {
    id: "brch-2",
    traderId: "trader-1",
    accountId: "acc-1",
    type: "max-drawdown",
    severity: "medium",
    description: "Equity dipped within 1% of the maximum drawdown threshold.",
    timestamp: daysAgo(11),
    status: "resolved",
  },
  {
    id: "brch-3",
    traderId: "trader-1",
    accountId: "acc-1",
    type: "news-blackout",
    severity: "low",
    description: "Position opened inside a scheduled high-impact news window.",
    timestamp: daysAgo(23),
    status: "acknowledged",
  },
];