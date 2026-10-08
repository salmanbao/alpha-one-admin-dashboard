/**
 * PFaaS Platform — Mock Data Store
 *
 * Powers the demo: tenants, users, roles, traders, accounts, challenges,
 * breaches, payouts, analytics, affiliates, accounting transactions,
 * marketing campaigns, kyc records, support tickets, ai insights, audit log.
 *
 * Deterministic (seeded) so the dashboard is stable across reloads.
 */

import type {
  AuditEntry,
  AuthUser,
  RoleDefinition,
  TenantContext,
} from "./types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Module augmentation — extend AuditEntry with an optional `tenantId`
 * field without modifying the canonical interface in types.ts. This lets
 * us scope audit log entries (and the user-events / change-history cousins
 * defined locally below) per-tenant in a multi-tenant SaaS shell.
 */
declare module "./types" {
  interface AuditEntry {
    tenantId?: string;
  }
}

/**
 * Deterministic small-string hash — used in place of `Math.random()` so
 * mock data is stable across reloads (e.g. tenant scoping, default toggles).
 */
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

export const tenants: TenantContext[] = [
  {
    id: "tenant-alpha",
    slug: "alpha",
    name: "Alpha Capital",
    application: "prop-admin",
    branding: {
      name: "Alpha Capital",
      tagline: "Trade. Prove. Earn.",
      initials: "AC",
      primaryColor: "#4a7c59", // Terra forest green
      accentColor: "#705c30", // Terra warm amber
      surfaceColor: "#f5efe6", // Terra warm cream
      radius: "0.75rem",
    },
    locale: "en-US",
    timezone: "America/New_York",
    currency: "USD",
    enabledModules: ["trading", "challenges", "risk", "payouts", "settings"],
    enabledFeatures: ["challenges.two-phase", "risk.daily-drawdown"],
    terminology: {
      challenge: "Evaluation",
      trader: "Participant",
      payout: "Withdrawal",
    },
    plan: "growth",
    status: "active",
    createdAt: daysAgo(220),
  },
  {
    id: "tenant-beta",
    slug: "beta",
    name: "Beta Trading",
    application: "prop-admin",
    branding: {
      name: "Beta Trading",
      tagline: "Funded traders, faster.",
      initials: "BT",
      primaryColor: "#5a7c4a", // Terra sage green
      accentColor: "#8a6d30", // Terra golden brown
      surfaceColor: "#f5efe6",
      radius: "0.5rem",
    },
    locale: "en-GB",
    timezone: "Europe/London",
    currency: "GBP",
    enabledModules: [
      "trading",
      "challenges",
      "risk",
      "payouts",
      "analytics",
      "affiliates",
      "accounting",
      "ai",
      "settings",
    ],
    enabledFeatures: [
      "challenges.two-phase",
      "risk.daily-drawdown",
      "analytics.advanced",
      "analytics.cohorts",
      "ai.insights",
    ],
    terminology: {
      challenge: "Challenge",
      trader: "Trader",
      payout: "Payout",
    },
    plan: "scale",
    status: "active",
    createdAt: daysAgo(410),
  },
  {
    id: "tenant-gamma",
    slug: "gamma",
    name: "Gamma Futures",
    application: "prop-admin",
    branding: {
      name: "Gamma Futures",
      tagline: "Quantitative prop trading.",
      initials: "GF",
      primaryColor: "#4a6c59", // Terra deep green
      accentColor: "#705c30", // Terra warm amber
      surfaceColor: "#f5efe6",
      radius: "0.625rem",
    },
    locale: "en-US",
    timezone: "America/Chicago",
    currency: "USD",
    enabledModules: [
      "trading",
      "challenges",
      "risk",
      "payouts",
      "analytics",
      "marketing",
      "crm",
      "kyc",
      "support",
      "settings",
    ],
    enabledFeatures: [
      "challenges.two-phase",
      "analytics.cohorts",
      "kyc.automated",
    ],
    terminology: {
      challenge: "Assessment",
      trader: "Candidate",
      payout: "Disbursement",
    },
    plan: "enterprise",
    status: "active",
    createdAt: daysAgo(95),
  },
];

/* The platform tenant context */
export const platformTenant: TenantContext = {
  id: "platform",
  slug: "platform",
  name: "PFaaS Platform",
  application: "prop-admin",
  branding: {
    name: "PFaaS Platform",
    tagline: "White-label prop firm infrastructure.",
    initials: "PF",
    primaryColor: "#4a7c59", // Terra forest green
    accentColor: "#705c30", // Terra warm amber
    surfaceColor: "#faf6f0", // Terra warm cream
    radius: "0.625rem",
  },
  locale: "en-US",
  timezone: "UTC",
  currency: "USD",
  enabledModules: [
    "trading",
    "challenges",
    "risk",
    "payouts",
    "analytics",
    "affiliates",
    "accounting",
    "marketing",
    "crm",
    "kyc",
    "support",
    "ai",
  ],
  enabledFeatures: ["platform.all"],
  terminology: {},
  plan: "enterprise",
  status: "active",
  createdAt: daysAgo(900),
};

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export const roles: RoleDefinition[] = [
  {
    id: "prop-admin",
    name: "Prop Firm Admin",
    description: "Full control of the tenant.",
    application: "prop-admin",
    permissions: [
      "trader.read",
      "trader.update",
      "account.read",
      "account.write",
      "challenge.read",
      "challenge.create",
      "challenge.update",
      "challenge.delete",
      "risk.read",
      "risk.configure",
      "breach.read",
      "payout.read",
      "payout.approve",
      "analytics.read",
      "analytics.advanced.read",
      "analytics.export",
      "affiliate.read",
      "affiliate.configure",
      "accounting.read",
      "accounting.configure",
      "marketing.read",
      "marketing.configure",
      "crm.read",
      "kyc.read",
      "kyc.approve",
      "support.read",
      "support.configure",
      "ai.read",
      "ai.configure",
      "settings.manage",
      "users.manage",
      "audit.read",
    ],
    color: "#0f766e",
  },
  {
    id: "risk-manager",
    name: "Risk Manager",
    description: "Monitors risk and breaches.",
    application: "prop-admin",
    permissions: [
      "trader.read",
      "account.read",
      "risk.read",
      "risk.configure",
      "breach.read",
      "analytics.read",
    ],
    color: "#b91c1c",
  },
  {
    id: "finance-manager",
    name: "Finance Manager",
    description: "Approves payouts and manages accounting.",
    application: "prop-admin",
    permissions: [
      "payout.read",
      "payout.approve",
      "accounting.read",
      "accounting.configure",
      "analytics.read",
      "trader.read",
      "account.read",
    ],
    color: "#15803d",
  },
  {
    id: "marketing-manager",
    name: "Marketing Manager",
    description: "Manages affiliates and campaigns.",
    application: "prop-admin",
    permissions: [
      "affiliate.read",
      "affiliate.configure",
      "marketing.read",
      "marketing.configure",
      "analytics.read",
      "trader.read",
    ],
    color: "#b45309",
  },
  {
    id: "support-agent",
    name: "Support Agent",
    description: "Handles trader support tickets.",
    application: "prop-admin",
    permissions: [
      "support.read",
      "support.configure",
      "trader.read",
      "account.read",
    ],
    color: "#c2410c",
  },
];

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users: AuthUser[] = [
    {
    id: "user-alpha-admin",
    tenantId: "tenant-alpha",
    name: "Sarah Chen",
    email: "sarah@alphacapital.io",
    initials: "SC",
    roles: ["prop-admin"],
    permissions: roles.find((r) => r.id === "prop-admin")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(2),
  },
  {
    id: "user-alpha-risk",
    tenantId: "tenant-alpha",
    name: "Marcus Webb",
    email: "marcus@alphacapital.io",
    initials: "MW",
    roles: ["risk-manager"],
    permissions: roles.find((r) => r.id === "risk-manager")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(3),
  },
  {
    id: "user-alpha-finance",
    tenantId: "tenant-alpha",
    name: "Priya Nair",
    email: "priya@alphacapital.io",
    initials: "PN",
    roles: ["finance-manager"],
    permissions: roles.find((r) => r.id === "finance-manager")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(5),
  },
  {
    id: "user-beta-admin",
    tenantId: "tenant-beta",
    name: "Daniel Cooper",
    email: "daniel@betatrading.co.uk",
    initials: "DC",
    roles: ["prop-admin"],
    permissions: roles.find((r) => r.id === "prop-admin")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(1),
  },
  {
    id: "user-beta-marketing",
    tenantId: "tenant-beta",
    name: "Elena Rossi",
    email: "elena@betatrading.co.uk",
    initials: "ER",
    roles: ["marketing-manager"],
    permissions: roles.find((r) => r.id === "marketing-manager")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(4),
  },
  {
    id: "user-gamma-admin",
    tenantId: "tenant-gamma",
    name: "James Park",
    email: "james@gammafutures.com",
    initials: "JP",
    roles: ["prop-admin"],
    permissions: roles.find((r) => r.id === "prop-admin")!.permissions,
    application: "prop-admin",
    lastActiveAt: hoursAgo(2),
  },
  ];

/* ------------------------------------------------------------------ */
/* Trading domain                                                      */
/* ------------------------------------------------------------------ */

export interface Trader {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  country: string;
  status: "active" | "invited" | "suspended" | "breached";
  joinedAt: string;
  challengePhase?: "phase-1" | "phase-2" | "funded" | "none";
  accountBalance: number;
  equity: number;
  totalPnl: number;
  winRate: number;
  trades: number;
}

export interface TradingAccount {
  id: string;
  tenantId: string;
  traderId: string;
  traderName: string;
  login: string;
  platform: "MT5" | "MT4" | "DXTrade";
  type: "challenge" | "funded" | "demo";
  phase: "phase-1" | "phase-2" | "funded";
  balance: number;
  equity: number;
  leverage: string;
  currency: string;
  status: "active" | "breached" | "passed" | "pending";
  createdAt: string;
}

export interface Position {
  id: string;
  tenantId: string;
  accountId: string;
  traderId: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  swap: number;
  openedAt: string;
}

export interface Challenge {
  id: string;
  tenantId: string;
  traderId: string;
  traderName: string;
  name: string;
  phase: "phase-1" | "phase-2" | "funded" | "failed";
  accountSize: number;
  profitTarget: number;
  maxDrawdown: number;
  dailyDrawdown: number;
  progressPct: number;
  daysLeft: number;
  currentProfit: number;
  status: "in-progress" | "passed" | "failed" | "funded";
  createdAt: string;
}

export interface Breach {
  id: string;
  tenantId: string;
  traderId: string;
  traderName: string;
  accountId: string;
  type: "daily-drawdown" | "max-drawdown" | "profit-target-miss" | "time-limit";
  rule: string;
  triggeredAt: string;
  severity: "warning" | "critical";
  status: "open" | "resolved";
}

export interface Payout {
  id: string;
  tenantId: string;
  traderId: string;
  traderName: string;
  amount: number;
  currency: string;
  method: "bank-transfer" | "crypto" | "paypal" | "skrill";
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  profitSplit: number; // trader % share
  createdAt: string;
  processedAt?: string;
  reference: string;
}

export interface Affiliate {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  code: string;
  referrals: number;
  activeReferrals: number;
  conversions: number;
  commissionEarned: number;
  commissionPending: number;
  status: "active" | "pending" | "suspended";
  tier: "bronze" | "silver" | "gold" | "platinum";
  joinedAt: string;
}

export interface AffiliateCampaign {
  id: string;
  tenantId: string;
  name: string;
  affiliateId: string;
  affiliateName: string;
  clicks: number;
  signups: number;
  conversions: number;
  spend: number;
  revenue: number;
  status: "active" | "paused" | "ended";
  startDate: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  reference: string;
  type: "payout" | "challenge-fee" | "subscription" | "refund" | "commission";
  description: string;
  amount: number;
  currency: string;
  category: string;
  status: "posted" | "pending" | "reconciled";
  date: string;
  account: string;
}

export interface MarketingCampaign {
  id: string;
  tenantId: string;
  name: string;
  channel: "email" | "social" | "paid-ads" | "content" | "affiliate";
  status: "active" | "paused" | "draft" | "completed";
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  startDate: string;
  endDate?: string;
}

export interface CrmContact {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  source: string;
  stage: "lead" | "qualified" | "opportunity" | "customer" | "churned";
  owner: string;
  value: number;
  lastInteraction: string;
  notes: string;
}

export interface KycRecord {
  id: string;
  tenantId: string;
  traderId: string;
  traderName: string;
  status: "pending" | "review" | "approved" | "rejected" | "expired";
  documentType: "passport" | "driving-license" | "national-id";
  country: string;
  submittedAt: string;
  reviewedAt?: string;
  riskLevel: "low" | "medium" | "high";
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  subject: string;
  traderName: string;
  category: "trading" | "payout" | "account" | "technical" | "billing";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "waiting" | "resolved" | "closed";
  assignee?: string;
  createdAt: string;
  lastReplyAt?: string;
  messages: number;
}

export interface AiInsight {
  id: string;
  tenantId: string;
  module: string;
  title: string;
  summary: string;
  detail: string;
  severity: "info" | "warning" | "opportunity" | "critical";
  confidence: number;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Seeded traders (shared, used across tenants)                        */
/* ------------------------------------------------------------------ */

const traderFirstNames = [
  "Liam", "Noah", "Olivia", "Emma", "Sophia", "Mason", "Ava", "Lucas",
  "Isabella", "Ethan", "Mia", "Aiden", "Amelia", "Jayden", "Harper",
  "Riley", "Zoe", "Nora", "Leo", "Ezra",
];
const traderLastNames = [
  "Smith", "Khan", "Garcia", "Müller", "Rossi", "Wang", "Nguyen", "Silva",
  "Andersson", "Patel", "Kim", "Lopez", "Olsen", "Haddad", "Kowalski",
  "Reyes", "Ivanov", "Cohen", "Park", "Singh",
];
const countries = ["US", "GB", "AE", "SG", "DE", "FR", "BR", "IN", "ZA", "CA"];

function seedTraders(tenantId: string, count: number): Trader[] {
  const out: Trader[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${traderFirstNames[i % traderFirstNames.length]} ${traderLastNames[(i * 3) % traderLastNames.length]}`;
    const phaseRoll = (i % 7);
    const phase =
      phaseRoll === 0 ? "funded" :
      phaseRoll === 1 ? "none" :
      phaseRoll <= 3 ? "phase-1" : "phase-2";
    const status =
      phase === "none" ? "invited" :
      i % 11 === 0 ? "breached" :
      i % 9 === 0 ? "suspended" : "active";
    const balance = phase === "funded" ? 25000 + (i % 4) * 25000 : 5000 + (i % 5) * 5000;
    const equity = balance + (Math.sin(i) * balance * 0.08);
    out.push({
      id: `trader-${tenantId}-${i + 1}`,
      tenantId,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@email.com`,
      country: countries[i % countries.length],
      status,
      joinedAt: daysAgo(180 - i * 3),
      challengePhase: phase as Trader["challengePhase"],
      accountBalance: balance,
      equity: Math.round(equity),
      totalPnl: Math.round(Math.sin(i * 1.3) * 4200 + 1200),
      winRate: 38 + (i % 30),
      trades: 40 + (i % 220),
    });
  }
  return out;
}

export const traders: Trader[] = [
  ...seedTraders("tenant-alpha", 24),
  ...seedTraders("tenant-beta", 38),
  ...seedTraders("tenant-gamma", 18),
];

/* Trading accounts */
function seedAccounts(): TradingAccount[] {
  const out: TradingAccount[] = [];
  let n = 0;
  for (const t of traders) {
    if (t.challengePhase === "none") continue;
    const phases: TradingAccount["phase"][] =
      t.challengePhase === "funded"
        ? ["funded"]
        : t.challengePhase === "phase-2"
        ? ["phase-1", "phase-2"]
        : ["phase-1"];
    for (const phase of phases) {
      n++;
      const isFunded = phase === "funded";
      out.push({
        id: `acct-${t.tenantId}-${n}`,
        tenantId: t.tenantId,
        traderId: t.id,
        traderName: t.name,
        login: `${100000 + n}`,
        platform: n % 3 === 0 ? "DXTrade" : "MT5",
        type: isFunded ? "funded" : "challenge",
        phase,
        balance: isFunded ? 50000 : 10000,
        equity: Math.round(t.equity),
        leverage: "1:100",
        currency: t.tenantId === "tenant-beta" ? "GBP" : "USD",
        status: t.status === "breached" ? "breached" : isFunded ? "active" : "in-progress",
        createdAt: t.joinedAt,
      });
    }
  }
  return out;
}
export const tradingAccounts: TradingAccount[] = seedAccounts();

/* Positions */
const symbols = [
  ["EURUSD", 1.085], ["GBPUSD", 1.271], ["USDJPY", 151.4], ["XAUUSD", 2348.5],
  ["BTCUSD", 67250], ["ETHUSD", 3480], ["SP500", 5230], ["NAS100", 18420],
] as const;

/**
 * Per-symbol contract size (units per 1.0 lot / 1.0 volume).
 *
 * FX majors: 1 lot = 100,000 units of base currency.
 * XAUUSD: 1 lot = 100 oz of gold.
 * Crypto: 1 unit = 1 BTC / 1 ETH (volume is in coin units, not lots).
 * Indices: 1 unit = $1 per index point.
 *
 * The previous seed used 1000 for JPY pairs and 10000 for everything else,
 * which produced absurd P&L on crypto ($2.29M on a 0.45 BTC position) and
 * indices. With correct contract sizes, P&L on a 0.10 lot FX position with a
 * 50-pip move is ~$50 — realistic.
 */
const CONTRACT_SIZE: Record<string, number> = {
  EURUSD: 100_000,
  GBPUSD: 100_000,
  USDJPY: 100_000,
  XAUUSD: 100,
  BTCUSD: 1,
  ETHUSD: 1,
  SP500: 1,
  NAS100: 1,
};

function seedPositions(): Position[] {
  const out: Position[] = [];
  let n = 0;
  for (const a of tradingAccounts.slice(0, 60)) {
    const count = 1 + (n % 4);
    for (let i = 0; i < count; i++) {
      n++;
      const [sym, price] = symbols[(n + i) % symbols.length];
      const entry = price * (1 + (Math.sin(n) * 0.01));
      const current = price;
      // Round volume to 2 decimals to avoid float artifacts like
      // 0.15000000000000002 in the UI.
      const volume = Math.round((0.05 + (n % 5) * 0.1) * 100) / 100;
      const side: "buy" | "sell" = n % 2 === 0 ? "buy" : "sell";
      const contract = CONTRACT_SIZE[sym] ?? 1;
      // P&L = (current - entry) * volume * contractSize, sign-flipped for
      // SELL (price drop profits shorts). Previously the sign was a separate
      // `n % 2` flip uncorrelated with side, producing wrong-direction P&L.
      const dir = side === "buy" ? 1 : -1;
      // JPY-quoted pairs (USDJPY, EURJPY, …) need to be converted to the
      // account's display currency (USD). The raw P&L is in JPY; dividing
      // by currentPrice converts JPY→USD. Without this, a 138-pip USDJPY
      // move on 0.25 lot showed as -$34,417 (the JPY amount) instead of
      // the correct ~-$228 (USD amount). Apply only when the quote
      // currency is JPY; the symbols array currently only has USDJPY, but
      // the rule generalizes to any *JPY pair.
      const isJpyQuote = sym.endsWith("JPY");
      const pnlRaw = (current - entry) * volume * contract * dir;
      const pnl = isJpyQuote ? pnlRaw / current : pnlRaw;
      // P&L % is the price-move percentage (volume cancels). Previously
      // divided by (entry * volume) which inflated the % for low-volume
      // positions. Capped to 2 decimals.
      const pnlPct = ((current - entry) / entry) * 100 * dir;
      out.push({
        id: `pos-${n}`,
        tenantId: a.tenantId,
        accountId: a.id,
        traderId: a.traderId,
        symbol: sym,
        side,
        volume,
        entryPrice: Math.round(entry * 100) / 100,
        currentPrice: current,
        pnl: Math.round(pnl),
        pnlPct: Math.round(pnlPct * 100) / 100,
        swap: Math.round(Math.sin(n) * 5),
        openedAt: hoursAgo(n % 48),
      });
    }
  }
  return out;
}
export const positions: Position[] = seedPositions();

/* Challenges */
function seedChallenges(): Challenge[] {
  const out: Challenge[] = [];
  let n = 0;
  for (const t of traders) {
    if (t.challengePhase === "none" || t.challengePhase === "funded") continue;
    n++;
    const phase = t.challengePhase;
    const accountSize = phase === "phase-2" ? 25000 : 10000;
    const profitTarget = accountSize * (phase === "phase-2" ? 0.05 : 0.08);
    out.push({
      id: `chal-${t.tenantId}-${n}`,
      tenantId: t.tenantId,
      traderId: t.id,
      traderName: t.name,
      name: phase === "phase-2" ? "Verification Phase" : "1-Step Evaluation",
      phase,
      accountSize,
      profitTarget,
      maxDrawdown: accountSize * 0.1,
      dailyDrawdown: accountSize * 0.05,
      progressPct: Math.round(((Math.sin(n) + 1) / 2) * 100),
      daysLeft: 30 - (n % 25),
      currentProfit: Math.round((Math.sin(n) + 1) * profitTarget * 0.5),
      status: "in-progress",
      createdAt: t.joinedAt,
    });
  }
  return out;
}
export const challenges: Challenge[] = seedChallenges();

/* Breaches */
function seedBreaches(): Breach[] {
  const out: Breach[] = [];
  const breachedTraders = traders.filter((t) => t.status === "breached" || t.challengePhase === "phase-1");
  let n = 0;
  for (const t of breachedTraders.slice(0, 18)) {
    n++;
    const types: Breach["type"][] = ["daily-drawdown", "max-drawdown", "profit-target-miss", "time-limit"];
    out.push({
      id: `br-${t.tenantId}-${n}`,
      tenantId: t.tenantId,
      traderId: t.id,
      traderName: t.name,
      accountId: tradingAccounts.find((a) => a.traderId === t.id)?.id ?? "acct-unknown",
      type: types[n % types.length],
      rule: n % 2 === 0 ? "Daily loss limit exceeded (5%)" : "Max drawdown breached (10%)",
      triggeredAt: daysAgo(n),
      severity: n % 3 === 0 ? "critical" : "warning",
      status: n % 4 === 0 ? "resolved" : "open",
    });
  }
  return out;
}
export const breaches: Breach[] = seedBreaches();

/* Payouts */
function seedPayouts(): Payout[] {
  const out: Payout[] = [];
  const fundedTraders = traders.filter((t) => t.challengePhase === "funded");
  let n = 0;
  for (const t of fundedTraders) {
    const count = 1 + (n % 3);
    for (let i = 0; i < count; i++) {
      n++;
      const statuses: Payout["status"][] = ["pending", "approved", "processing", "paid", "rejected"];
      const status = statuses[(n + i) % statuses.length];
      out.push({
        id: `pay-${t.tenantId}-${n}`,
        tenantId: t.tenantId,
        traderId: t.id,
        traderName: t.name,
        amount: Math.round(1200 + (Math.sin(n) + 1) * 4500),
        currency: t.tenantId === "tenant-beta" ? "GBP" : "USD",
        method: ["bank-transfer", "crypto", "paypal", "skrill"][n % 4] as Payout["method"],
        status,
        profitSplit: 80 + (n % 20),
        createdAt: daysAgo(n * 2),
        processedAt: status === "paid" ? daysAgo(n) : undefined,
        reference: `WD-${10000 + n}`,
      });
    }
  }
  return out;
}
export const payouts: Payout[] = seedPayouts();

/* Affiliates */
const affiliateNames = ["Prime FX Partners", "Trading Hub", "Fx Influencers", "Capital Network", "Quant Affiliates", "Pro Traders Club"];
export const affiliates: Affiliate[] = affiliateNames.flatMap((name, i) =>
  ["tenant-beta", "tenant-gamma"].map((tid, j) => ({
    id: `aff-${tid}-${i}`,
    tenantId: tid,
    name,
    email: `contact@${name.toLowerCase().replace(/\s+/g, "")}.com`,
    code: `${tid.slice(0, 2).toUpperCase()}${name.slice(0, 2).toUpperCase()}${i + 1}`,
    referrals: 20 + i * 15 + j * 8,
    activeReferrals: 12 + i * 6 + j * 3,
    conversions: 5 + i * 4 + j * 2,
    commissionEarned: Math.round(2400 + i * 1800 + j * 900),
    commissionPending: Math.round(300 + i * 220),
    status: i % 4 === 0 ? "pending" : "active",
    tier: (["bronze", "silver", "gold", "platinum"] as const)[i % 4],
    joinedAt: daysAgo(120 + i * 30),
  }))
);

export const affiliateCampaigns: AffiliateCampaign[] = affiliates.slice(0, 12).map((a, i) => ({
  id: `camp-${a.id}`,
  tenantId: a.tenantId,
  name: `Q${(i % 4) + 1} ${a.name} Push`,
  affiliateId: a.id,
  affiliateName: a.name,
  clicks: 800 + i * 320,
  signups: 40 + i * 12,
  conversions: 8 + i * 3,
  spend: Math.round(400 + i * 250),
  revenue: Math.round(2400 + i * 1200),
  status: i % 3 === 0 ? "paused" : "active",
  startDate: daysAgo(60 - i * 4),
}));

/* Accounting transactions */
export const transactions: Transaction[] = (() => {
  const out: Transaction[] = [];
  for (const tid of ["tenant-alpha", "tenant-beta", "tenant-gamma"]) {
    for (let i = 0; i < 30; i++) {
      const types: Transaction["type"][] = ["payout", "challenge-fee", "subscription", "refund", "commission"];
      const type = types[i % types.length];
      out.push({
        id: `txn-${tid}-${i}`,
        tenantId: tid,
        reference: `TXN-${20000 + i}`,
        type,
        description:
          type === "payout" ? "Trader withdrawal" :
          type === "challenge-fee" ? "Challenge registration fee" :
          type === "subscription" ? "Platform monthly subscription" :
          type === "refund" ? "Refund processed" : "Affiliate commission payout",
        amount: Math.round((Math.sin(i) + 1) * 3500 + 200),
        currency: tid === "tenant-beta" ? "GBP" : "USD",
        category: type,
        status: i % 5 === 0 ? "pending" : i % 7 === 0 ? "reconciled" : "posted",
        date: daysAgo(i),
        account: "Operating Account",
      });
    }
  }
  return out;
})();

/* Marketing campaigns */
export const marketingCampaigns: MarketingCampaign[] = (() => {
  const out: MarketingCampaign[] = [];
  const names = ["Spring Launch", "Funded Trader Promo", "Crypto Challenge Series", "Black Friday Bonus", "Affiliate Boost", "Retargeting Q1"];
  for (const tid of ["tenant-beta", "tenant-gamma"]) {
    names.forEach((n, i) => {
      out.push({
        id: `mkt-${tid}-${i}`,
        tenantId: tid,
        name: n,
        channel: ["email", "social", "paid-ads", "content", "affiliate"][i % 5] as MarketingCampaign["channel"],
        status: i % 4 === 0 ? "draft" : i % 5 === 0 ? "completed" : "active",
        budget: 2000 + i * 1500,
        spend: Math.round(800 + i * 600),
        impressions: 12000 + i * 4500,
        clicks: 480 + i * 180,
        conversions: 12 + i * 6,
        revenue: Math.round(3200 + i * 2100),
        startDate: daysAgo(45 - i * 3),
        endDate: i % 4 === 0 ? daysAgo(10) : undefined,
      });
    });
  }
  return out;
})();

/* CRM contacts */
export const crmContacts: CrmContact[] = (() => {
  const out: CrmContact[] = [];
  for (const tid of ["tenant-beta", "tenant-gamma"]) {
    for (let i = 0; i < 18; i++) {
      out.push({
        id: `crm-${tid}-${i}`,
        tenantId: tid,
        name: `${traderFirstNames[i % traderFirstNames.length]} ${traderLastNames[(i * 2) % traderLastNames.length]}`,
        email: `lead${i}@example.com`,
        phone: i % 2 === 0 ? `+1-555-01${i}` : undefined,
        source: ["Website", "Webinar", "Affiliate", "Social", "Cold Outbound"][i % 5],
        stage: (["lead", "qualified", "opportunity", "customer", "churned"] as const)[i % 5],
        owner: ["Sarah", "Elena", "James", "Marcus"][i % 4],
        value: 500 + i * 350,
        lastInteraction: daysAgo(i),
        notes: i % 3 === 0 ? "Interested in 100k challenge." : "Demo account requested.",
      });
    }
  }
  return out;
})();

/* KYC records */
export const kycRecords: KycRecord[] = (() => {
  const out: KycRecord[] = [];
  let n = 0;
  for (const t of traders) {
    if (t.status === "invited") continue;
    n++;
    out.push({
      id: `kyc-${t.tenantId}-${n}`,
      tenantId: t.tenantId,
      traderId: t.id,
      traderName: t.name,
      status: (["pending", "review", "approved", "approved", "rejected"] as const)[n % 5],
      documentType: (["passport", "driving-license", "national-id"] as const)[n % 3],
      country: t.country,
      submittedAt: daysAgo(n * 2),
      reviewedAt: n % 3 === 0 ? daysAgo(n) : undefined,
      riskLevel: (["low", "medium", "high"] as const)[n % 3],
    });
  }
  return out;
})();

/* Support tickets */
export const supportTickets: SupportTicket[] = (() => {
  const out: SupportTicket[] = [];
  const subjects = [
    "Cannot login to MT5 account",
    "Payout taking too long",
    "Challenge progress not updating",
    "Profit target reached but not funded",
    "Need to update bank details",
    "Drawdown calculation seems off",
    "How to upload KYC documents",
    "Affiliate commission missing",
  ];
  for (const tid of ["tenant-alpha", "tenant-beta", "tenant-gamma"]) {
    for (let i = 0; i < 14; i++) {
      out.push({
        id: `tkt-${tid}-${i}`,
        tenantId: tid,
        subject: subjects[i % subjects.length],
        traderName: traders.filter((t) => t.tenantId === tid)[i % 10]?.name ?? "Unknown",
        category: (["trading", "payout", "account", "technical", "billing"] as const)[i % 5],
        priority: (["low", "medium", "high", "urgent"] as const)[i % 4],
        status: (["open", "in-progress", "waiting", "resolved", "closed"] as const)[i % 5],
        assignee: i % 2 === 0 ? "Support Team" : undefined,
        createdAt: daysAgo(i * 2),
        lastReplyAt: i % 3 === 0 ? hoursAgo(8) : undefined,
        messages: 1 + (i % 8),
      });
    }
  }
  return out;
})();

/* AI insights */
export const aiInsights: AiInsight[] = [
  {
    id: "ai-1",
    tenantId: "tenant-beta",
    module: "ai",
    title: "Payout spike detected",
    summary: "Payout requests up 38% week-over-week, concentrated in funded traders.",
    detail: "Model confidence 87%. Recommend reviewing payout reserves.",
    severity: "warning",
    confidence: 0.87,
    generatedAt: hoursAgo(2),
  },
  {
    id: "ai-2",
    tenantId: "tenant-beta",
    module: "ai",
    title: "Affiliate conversion opportunity",
    summary: "Affiliates in 'gold' tier convert 2.4x better. Consider tier upgrade for 3 partners.",
    detail: "Expected revenue uplift: $18.4k over 30 days.",
    severity: "opportunity",
    confidence: 0.78,
    generatedAt: hoursAgo(6),
  },
  {
    id: "ai-3",
    tenantId: "tenant-gamma",
    module: "ai",
    title: "KYC backlog growing",
    summary: "14 KYC reviews pending >48h. Risk of churn for 4 high-value leads.",
    detail: "Auto-approve low-risk profiles to reduce backlog.",
    severity: "critical",
    confidence: 0.92,
    generatedAt: hoursAgo(3),
  },
];

/* Audit log */
export const auditLog: AuditEntry[] = (() => {
  const out: AuditEntry[] = [];
  const actors = ["Sarah Chen", "Marcus Webb", "Priya Nair", "Daniel Cooper", "Elena Rossi", "James Park", "System"];
  const actions = [
    ["Approved payout", "payout"],
    ["Updated risk config", "risk"],
    ["Created challenge", "challenge"],
    ["Suspended trader", "trader"],
    ["Enabled module", "settings"],
    ["Updated branding", "settings"],
    ["Resolved breach", "breach"],
    ["Approved KYC", "kyc"],
  ] as const;
  // Per-tenant seeded entries (20 per tenant). The outer loop binding
  // `tid` is now stored on each AuditEntry so `getTenantAudit(tid)` can
  // actually filter — previously every tenant saw the same 60 entries.
  for (const tid of ["tenant-alpha", "tenant-beta", "tenant-gamma"]) {
    for (let i = 0; i < 20; i++) {
      const [action, entity] = actions[i % actions.length];
      out.push({
        id: `aud-${tid}-${i}`,
        timestamp: hoursAgo(i * 5),
        actor: actors[i % actors.length],
        action,
        entity,
        entityId: `${entity}-${1000 + i}`,
        summary: `${action} on ${entity}`,
        severity: i % 6 === 0 ? "critical" : i % 3 === 0 ? "warning" : "info",
        module: entity,
        tenantId: tid,
      });
    }
  }
  // Platform-scoped entries (visible to super-admin only).
  for (let i = 0; i < 12; i++) {
    const [action, entity] = actions[i % actions.length];
    out.push({
      id: `aud-platform-${i}`,
      timestamp: hoursAgo(i * 7),
      actor: actors[(i + 1) % actors.length],
      action,
      entity,
      entityId: `${entity}-platform-${1000 + i}`,
      summary: `${action} (platform-wide)`,
      severity: i % 5 === 0 ? "critical" : i % 4 === 0 ? "warning" : "info",
      module: entity,
      tenantId: "platform",
    });
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Analytics aggregations                                              */
/* ------------------------------------------------------------------ */

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export function revenueSeries(tenantId: string): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    out.push({
      date: daysAgo(i).slice(0, 10),
      value: Math.round(8000 + Math.sin(i / 3) * 2400 + (30 - i) * 80),
    });
  }
  return out;
}

export function traderGrowthSeries(tenantId: string): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = [];
  let base = 10;
  for (let i = 29; i >= 0; i--) {
    base += Math.round(Math.sin(i) + 2);
    out.push({ date: daysAgo(i).slice(0, 10), value: base });
  }
  return out;
}

export function payoutSeries(tenantId: string): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    out.push({
      date: daysAgo(i).slice(0, 10),
      value: Math.round(3200 + Math.cos(i / 4) * 1400 + (30 - i) * 30),
    });
  }
  return out;
}

export function riskDistribution(tenantId: string) {
  return [
    { label: "Low Risk", value: 62, color: "#16a34a" },
    { label: "Moderate", value: 24, color: "#ca8a04" },
    { label: "Elevated", value: 10, color: "#ea580c" },
    { label: "Critical", value: 4, color: "#dc2626" },
  ];
}

export function breachTrend(tenantId: string): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    out.push({
      date: daysAgo(i).slice(0, 10),
      value: Math.round(Math.max(0, 2 + Math.sin(i / 2) * 3)),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                      */
/* ------------------------------------------------------------------ */

export function getTenant(id: string): TenantContext | undefined {
  return [...tenants, platformTenant].find((t) => t.id === id);
}

export function getTenantTraders(tenantId: string): Trader[] {
  return traders.filter((t) => t.tenantId === tenantId);
}
export function getTenantAccounts(tenantId: string): TradingAccount[] {
  return tradingAccounts.filter((a) => a.tenantId === tenantId);
}
export function getTenantChallenges(tenantId: string): Challenge[] {
  return challenges.filter((c) => c.tenantId === tenantId);
}
export function getTenantBreaches(tenantId: string): Breach[] {
  return breaches.filter((b) => b.tenantId === tenantId);
}
export function getTenantPayouts(tenantId: string): Payout[] {
  return payouts.filter((p) => p.tenantId === tenantId);
}
export function getTenantAffiliates(tenantId: string): Affiliate[] {
  return affiliates.filter((a) => a.tenantId === tenantId);
}
export function getTenantTransactions(tenantId: string): Transaction[] {
  return transactions.filter((t) => t.tenantId === tenantId);
}
export function getTenantCampaigns(tenantId: string): MarketingCampaign[] {
  return marketingCampaigns.filter((m) => m.tenantId === tenantId);
}
export function getTenantContacts(tenantId: string): CrmContact[] {
  return crmContacts.filter((c) => c.tenantId === tenantId);
}
export function getTenantKyc(tenantId: string): KycRecord[] {
  return kycRecords.filter((k) => k.tenantId === tenantId);
}
export function getTenantTickets(tenantId: string): SupportTicket[] {
  return supportTickets.filter((s) => s.tenantId === tenantId);
}
export function getTenantAiInsights(tenantId: string): AiInsight[] {
  return aiInsights.filter((a) => a.tenantId === tenantId || a.tenantId === "platform");
}
export function getPlatformAudit(): AuditEntry[] {
  // Cross-tenant view for super-admin (every seeded entry).
  return auditLog;
}
export function getTenantAudit(tenantId: string): AuditEntry[] {
  // Platform tenant sees the full cross-tenant stream; a regular tenant
  // only sees its own entries plus any unscoped (`tenantId === undefined`)
  // legacy entries. Previously this returned the same 60 entries for every
  // tenant because the `tid` argument was ignored.
  if (tenantId === "platform") return auditLog;
  return auditLog.filter((a) => a.tenantId === tenantId || a.tenantId === undefined);
}
export function getTenantPositions(tenantId: string): Position[] {
  return positions.filter((p) => p.tenantId === tenantId);
}

/* ------------------------------------------------------------------ */
/* Trader-personal helpers (Round 7 addition)                          */
/* Used by the trader-facing Overview / Attention Center / Live Equity  */
/* to render the operator's own data instead of whole-tenant totals.   */
/* ------------------------------------------------------------------ */

/** Find the Trader record linked to a user (returns null for non-trader users). */
export function getTraderForUser(user: { traderId?: string; application?: string }): Trader | null {
  if (!user.traderId) return null;
  return traders.find((t) => t.id === user.traderId) ?? null;
}

/** All trading accounts owned by this trader (across phases / brokers). */
export function getTraderAccounts(traderId: string): TradingAccount[] {
  return tradingAccounts.filter((a) => a.traderId === traderId);
}

/** Open positions on this trader's accounts. */
export function getTraderPositions(traderId: string): Position[] {
  const acctIds = new Set(tradingAccounts.filter((a) => a.traderId === traderId).map((a) => a.id));
  return positions.filter((p) => acctIds.has(p.accountId));
}

/** Payout / withdrawal requests submitted by this trader. */
export function getTraderPayouts(traderId: string): Payout[] {
  return payouts.filter((p) => p.traderId === traderId);
}

/** Breaches recorded on this trader's accounts. */
export function getTraderBreaches(traderId: string): Breach[] {
  return breaches.filter((b) => b.traderId === traderId);
}

/** Audit entries that mention this trader's id (Round 7: for the trader's
 *  own live activity feed — the tenant-wide feed leaks other traders'
 *  actions to Tom, which is wrong context). */
export function getTraderAudit(traderId: string, tenantId: string): AuditEntry[] {
  return auditLog.filter(
    (a) =>
      (a.tenantId === tenantId || a.tenantId === undefined) &&
      (a.entityId === traderId || (a.summary && a.summary.includes(traderId))),
  );
}

/* ------------------------------------------------------------------ */
/* New types for missing flows                                        */
/* ------------------------------------------------------------------ */

export interface ChallengeType {
  id: string;
  name: string;
  description: string;
  phases: number;
  icon: string;
  hasFreeTrial: boolean;
  isCompetition: boolean;
  active: boolean;
}

export interface ChallengePhaseConfig {
  id: string;
  challengeTypeId: string;
  phaseName: string;
  phaseOrder: number;
  accountSize: number;
  profitTargetPct: number;
  maxDrawdownPct: number;
  dailyDrawdownPct: number;
  minTradingDays: number;
  maxDays: number;
  profitSplit: number;
  isFunded: boolean;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  couponCode: string;
  discountPct: number;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "scheduled";
  targetCountries: string[];
  targetSegments: string[];
  matchingUsers: number;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: string;
  variables: string[];
  lastModified: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  layout: string;
  active: boolean;
  lastModified: string;
  /**
   * Optional designer field configuration (Round 7 addition). Templates
   * created via the Certificate Designer can store their field list
   * here so editing an existing template loads its previous config
   * instead of always starting from DEFAULT_FIELDS. Older templates
   * without this field fall back to the default 4-field layout.
   */
  fields?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    fontSize: number;
    fontWeight: string;
    color: string;
    align: "left" | "center" | "right";
  }>;
}

export interface Banner {
  id: string;
  type: "marketing" | "announcement";
  title: string;
  content: string;
  status: "active" | "inactive";
  startDate: string;
  endDate: string;
  position: "top" | "sidebar" | "modal";
}

export interface TradingEventRule {
  id: string;
  type: "news" | "copy" | "inverse" | "weekend";
  name: string;
  description: string;
  symbol: string;
  severity: "warning" | "critical";
  action: "flag" | "block" | "notify";
  active: boolean;
}

export interface UserEvent {
  id: string;
  timestamp: string;
  userEmail: string;
  accountId: string;
  eventType: "ACCOUNT_CREATED" | "KYC_COMPLETED" | "KYC_REJECTED" | "ORDER_CREATED" | "PAYOUT_REQUESTED" | "PAYOUT_COMPLETED" | "CHALLENGE_STARTED" | "CHALLENGE_PASSED" | "CHALLENGE_FAILED" | "BREACH_DETECTED" | "LOGIN" | "PASSWORD_CHANGED";
  description: string;
  /** Tenant scoping — derived deterministically from the trader the event is bound to. */
  tenantId?: string;
}

export interface ChangeHistoryEntry {
  id: string;
  timestamp: string;
  actor: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  /** Tenant scoping — derived deterministically from `id` via `hashStr`. */
  tenantId?: string;
}

/* Seeded data for new types */

export const challengeTypes: ChallengeType[] = [
  { id: "ct-1", name: "Instant Funded", description: "Get funded immediately without evaluation phases.", phases: 1, icon: "Zap", hasFreeTrial: false, isCompetition: false, active: true },
  { id: "ct-2", name: "1-Step Evaluation", description: "Single phase evaluation to prove trading ability.", phases: 1, icon: "Target", hasFreeTrial: false, isCompetition: false, active: true },
  { id: "ct-3", name: "2-Step Evaluation", description: "Two-phase evaluation with verification step.", phases: 2, icon: "Layers", hasFreeTrial: false, isCompetition: false, active: true },
  { id: "ct-4", name: "3-Step Evaluation", description: "Three-phase evaluation for advanced traders.", phases: 3, icon: "GitBranch", hasFreeTrial: false, isCompetition: false, active: true },
  { id: "ct-5", name: "Free Trial", description: "No-cost evaluation to attract new traders.", phases: 1, icon: "Gift", hasFreeTrial: true, isCompetition: false, active: true },
  { id: "ct-6", name: "Competition", description: "Leaderboard-based competition among traders.", phases: 1, icon: "Trophy", hasFreeTrial: false, isCompetition: true, active: true },
];

export const challengePhaseConfigs: ChallengePhaseConfig[] = [
  { id: "pc-1", challengeTypeId: "ct-3", phaseName: "Phase 1", phaseOrder: 1, accountSize: 10000, profitTargetPct: 8, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 0, maxDays: 30, profitSplit: 0, isFunded: false },
  { id: "pc-2", challengeTypeId: "ct-3", phaseName: "Phase 2", phaseOrder: 2, accountSize: 10000, profitTargetPct: 5, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 0, maxDays: 60, profitSplit: 0, isFunded: false },
  { id: "pc-3", challengeTypeId: "ct-3", phaseName: "Funded", phaseOrder: 3, accountSize: 10000, profitTargetPct: 0, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 0, maxDays: 0, profitSplit: 80, isFunded: true },
  { id: "pc-4", challengeTypeId: "ct-2", phaseName: "Phase 1", phaseOrder: 1, accountSize: 25000, profitTargetPct: 8, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 3, maxDays: 30, profitSplit: 0, isFunded: false },
  { id: "pc-5", challengeTypeId: "ct-2", phaseName: "Funded", phaseOrder: 2, accountSize: 25000, profitTargetPct: 0, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 0, maxDays: 0, profitSplit: 80, isFunded: true },
  { id: "pc-6", challengeTypeId: "ct-1", phaseName: "Funded", phaseOrder: 1, accountSize: 50000, profitTargetPct: 0, maxDrawdownPct: 10, dailyDrawdownPct: 5, minTradingDays: 0, maxDays: 0, profitSplit: 90, isFunded: true },
];

export const offers: Offer[] = [
  { id: "off-1", name: "EXPO2026 BUNDLE DEAL", description: "Bundle 3 challenges at 40% off", couponCode: "EXPO2026", discountPct: 40, startDate: "2026-08-31", endDate: "2026-09-30", status: "active", targetCountries: ["US", "GB", "AE", "SG"], targetSegments: ["new_users", "no_purchase"], matchingUsers: 142, createdAt: daysAgo(15) },
  { id: "off-2", name: "Summer Promo", description: "20% off all 2-step evaluations", couponCode: "SUMMER20", discountPct: 20, startDate: "2026-06-01", endDate: "2026-08-31", status: "expired", targetCountries: ["US", "CA"], targetSegments: ["all"], matchingUsers: 0, createdAt: daysAgo(90) },
  { id: "off-3", name: "Black Friday Flash", description: "50% off everything for 48 hours", couponCode: "BF50", discountPct: 50, startDate: "2026-11-25", endDate: "2026-11-27", status: "scheduled", targetCountries: [], targetSegments: ["all"], matchingUsers: 0, createdAt: daysAgo(5) },
];

export const emailTemplates: EmailTemplate[] = [
  { id: "et-1", name: "Challenge Purchased", subject: "Your {{challenge_name}} challenge is ready!", body: "Hi {{user_name}}, your {{challenge_name}} challenge has been activated...", trigger: "challenge.purchased", variables: ["user_name", "challenge_name", "account_login"], lastModified: daysAgo(30) },
  { id: "et-2", name: "Challenge Passed", subject: "Congratulations! You passed Phase {{phase}}", body: "Hi {{user_name}}, you've successfully passed Phase {{phase}}...", trigger: "challenge.passed", variables: ["user_name", "phase", "next_steps"], lastModified: daysAgo(15) },
  { id: "et-3", name: "Payout Approved", subject: "Your payout of {{amount}} has been approved", body: "Hi {{user_name}}, your withdrawal request of {{amount}} {{currency}} has been approved...", trigger: "payout.approved", variables: ["user_name", "amount", "currency", "method"], lastModified: daysAgo(7) },
  { id: "et-4", name: "Breach Notification", subject: "Account breached: {{rule}}", body: "Hi {{user_name}}, your account has been breached due to {{rule}}...", trigger: "breach.detected", variables: ["user_name", "rule", "account_login"], lastModified: daysAgo(3) },
  { id: "et-5", name: "KYC Approved", subject: "Your KYC verification is complete", body: "Hi {{user_name}}, your identity has been verified...", trigger: "kyc.approved", variables: ["user_name"], lastModified: daysAgo(20) },
];

export const certificateTemplates: CertificateTemplate[] = [
  { id: "cert-1", name: "Challenge Passed Certificate", description: "Awarded when a trader passes a challenge phase", triggerEvent: "challenge.passed", layout: "standard", active: true, lastModified: daysAgo(45) },
  { id: "cert-2", name: "Funded Trader Certificate", description: "Awarded when a trader reaches funded status", triggerEvent: "challenge.funded", layout: "premium", active: true, lastModified: daysAgo(30) },
  { id: "cert-3", name: "Competition Winner", description: "Awarded to competition winners", triggerEvent: "competition.won", layout: "trophy", active: false, lastModified: daysAgo(60) },
];

export const banners: Banner[] = [
  { id: "ban-1", type: "announcement", title: "Platform Maintenance", content: "Scheduled maintenance on Sunday 2-4 AM UTC. Trading may be briefly interrupted.", status: "active", startDate: daysAgo(2), endDate: daysAgo(-5), position: "top" },
  { id: "ban-2", type: "marketing", title: "EXPO2026 Deal Live!", content: "Get 40% off all challenge bundles with code EXPO2026", status: "active", startDate: daysAgo(5), endDate: daysAgo(-30), position: "top" },
  { id: "ban-3", type: "announcement", title: "FREEDOM Promotion", content: "Celebrate freedom with special pricing this week!", status: "inactive", startDate: daysAgo(40), endDate: daysAgo(10), position: "top" },
  { id: "ban-4", type: "marketing", title: "New Challenge Type", content: "Try our new 3-Step Evaluation for advanced traders", status: "active", startDate: daysAgo(1), endDate: daysAgo(-60), position: "sidebar" },
];

export const tradingEventRules: TradingEventRule[] = [
  { id: "te-1", type: "news", name: "NFP Release", description: "Block trading during Non-Farm Payrolls release", symbol: "All", severity: "critical", action: "block", active: true },
  { id: "te-2", type: "news", name: "FOMC Statement", description: "Flag trades during FOMC press conference", symbol: "All", severity: "warning", action: "flag", active: true },
  { id: "te-3", type: "copy", name: "Copy Trading Detection", description: "Detect synchronized trading across accounts", symbol: "All", severity: "critical", action: "block", active: true },
  { id: "te-4", type: "inverse", name: "Inverse Trading Detection", description: "Detect hedging/inverse trading patterns", symbol: "All", severity: "warning", action: "flag", active: true },
  { id: "te-5", type: "weekend", name: "Weekend Trading Block", description: "Block new positions on weekends for challenge accounts", symbol: "All", severity: "warning", action: "block", active: true },
];

export const userEvents: UserEvent[] = (() => {
  const out: UserEvent[] = [];
  const eventTypes: UserEvent["eventType"][] = ["ACCOUNT_CREATED", "KYC_COMPLETED", "ORDER_CREATED", "PAYOUT_REQUESTED", "PAYOUT_COMPLETED", "CHALLENGE_STARTED", "CHALLENGE_PASSED", "CHALLENGE_FAILED", "BREACH_DETECTED", "LOGIN"];
  const descriptions: Record<string, string> = {
    ACCOUNT_CREATED: "Account registered and initial setup completed",
    KYC_COMPLETED: "Identity verification completed successfully",
    ORDER_CREATED: "Challenge purchase order placed",
    PAYOUT_REQUESTED: "Withdrawal request submitted",
    PAYOUT_COMPLETED: "Payout sent to trader successfully",
    CHALLENGE_STARTED: "Challenge evaluation began",
    CHALLENGE_PASSED: "Challenge phase passed successfully",
    CHALLENGE_FAILED: "Challenge failed - risk rule breached",
    BREACH_DETECTED: "Risk rule violation detected",
    LOGIN: "User logged in to platform",
  };
  for (let i = 0; i < 120; i++) {
    const t = traders[i % traders.length];
    const evt = eventTypes[i % eventTypes.length];
    out.push({
      id: `ue-${i}`,
      timestamp: hoursAgo(i * 3),
      userEmail: t.email,
      accountId: `3333887${100 + i}`,
      eventType: evt,
      description: descriptions[evt],
      // Bind each event to the same tenant as its trader so user-events
      // can be filtered per-tenant by the audit module's helper.
      tenantId: t.tenantId,
    });
  }
  return out;
})();

export const changeHistory: ChangeHistoryEntry[] = (() => {
  const out: ChangeHistoryEntry[] = [];
  const actors = ["Sarah Chen", "Marcus Webb", "Priya Nair", "System", "AI Engine"];
  const changes = [
    { entity: "Challenge", field: "profitTargetPct", old: "8%", new: "10%" },
    { entity: "Challenge", field: "maxDrawdownPct", old: "10%", new: "8%" },
    { entity: "Account", field: "status", old: "active", new: "suspended" },
    { entity: "Payout", field: "status", old: "pending", new: "approved" },
    { entity: "Risk Rule", field: "dailyLossLimit", old: "5%", new: "4%" },
    { entity: "Offer", field: "discountPct", old: "20%", new: "40%" },
    { entity: "Phase", field: "minTradingDays", old: "0", new: "3" },
    { entity: "Email Template", field: "subject", old: "Old subject", new: "New subject" },
  ];
  for (let i = 0; i < 40; i++) {
    const c = changes[i % changes.length];
    const id = `ch-${i}`;
    // Deterministically assign this change-history entry to one of the
    // 3 tenants (or "platform" for super-admin) using `hashStr`.
    const h = hashStr(id) % 4;
    const tid = h === 0 ? "tenant-alpha" : h === 1 ? "tenant-beta" : h === 2 ? "tenant-gamma" : "platform";
    out.push({
      id,
      timestamp: hoursAgo(i * 6),
      actor: actors[i % actors.length],
      entityType: c.entity,
      entityId: `${c.entity}-${1000 + i}`,
      field: c.field,
      oldValue: c.old,
      newValue: c.new,
      reason: i % 3 === 0 ? "Policy update" : i % 3 === 1 ? "Configuration change" : "Manual adjustment",
      tenantId: tid,
    });
  }
  return out;
})();

/* New helper functions */

export function getChallengeTypes(): ChallengeType[] {
  return challengeTypes;
}
export function getChallengePhaseConfigs(challengeTypeId?: string): ChallengePhaseConfig[] {
  return challengeTypeId ? challengePhaseConfigs.filter((p) => p.challengeTypeId === challengeTypeId) : challengePhaseConfigs;
}
export function getOffers(): Offer[] {
  return offers;
}
export function getEmailTemplates(): EmailTemplate[] {
  return emailTemplates;
}
export function getCertificateTemplates(): CertificateTemplate[] {
  return certificateTemplates;
}
export function getBanners(type?: "marketing" | "announcement"): Banner[] {
  return type ? banners.filter((b) => b.type === type) : banners;
}
export function getTradingEventRules(type?: string): TradingEventRule[] {
  return type ? tradingEventRules.filter((r) => r.type === type) : tradingEventRules;
}
export function getUserEvents(limit = 100): UserEvent[] {
  return userEvents.slice(0, limit);
}
export function getTenantUserEvents(tenantId: string, limit = 100): UserEvent[] {
  // Platform tenant sees the full cross-tenant stream; a regular tenant
  // only sees its own events plus any unscoped legacy entries.
  const filtered =
    tenantId === "platform"
      ? userEvents
      : userEvents.filter((e) => e.tenantId === tenantId || e.tenantId === undefined);
  return filtered.slice(0, limit);
}
export function getChangeHistory(entityType?: string, entityId?: string): ChangeHistoryEntry[] {
  let result = changeHistory;
  if (entityType) result = result.filter((c) => c.entityType === entityType);
  if (entityId) result = result.filter((c) => c.entityId === entityId);
  return result;
}
export function getTenantChangeHistory(tenantId: string, entityType?: string, entityId?: string): ChangeHistoryEntry[] {
  // Platform tenant sees the full cross-tenant stream; a regular tenant
  // only sees its own changes plus any unscoped legacy entries.
  let result =
    tenantId === "platform"
      ? changeHistory
      : changeHistory.filter((c) => c.tenantId === tenantId || c.tenantId === undefined);
  if (entityType) result = result.filter((c) => c.entityType === entityType);
  if (entityId) result = result.filter((c) => c.entityId === entityId);
  return result;
}

/* Firm statistics data */
export function getFirmStatistics(tenantId: string) {
  const traders = getTenantTraders(tenantId);
  const payouts = getTenantPayouts(tenantId);
  const challenges = getTenantChallenges(tenantId);
  const totalRevenue = 40355.82;
  const totalPayouts = payouts.reduce((s, p) => s + p.amount, 0) + 6808;
  const challengesSold = 1140;
  const netProfit = totalRevenue - totalPayouts;
  const profitMargin = ((netProfit / totalRevenue) * 100).toFixed(1);
  const avgChallengeValue = totalRevenue / challengesSold;
  const payoutRatio = ((totalPayouts / totalRevenue) * 100).toFixed(1);
  return {
    totalRevenue,
    totalPayouts,
    netProfit,
    profitMargin: parseFloat(profitMargin),
    avgChallengeValue,
    payoutRatio: parseFloat(payoutRatio),
    challengesSold,
    copyTradingEvents: 156352,
    inverseTradingEvents: 131673,
    newsTradingEvents: 5407,
    totalAccounts: traders.length,
    activeAccounts: traders.filter((t) => t.status === "active").length,
    fundedAccounts: traders.filter((t) => t.challengePhase === "funded").length,
    revenueSeries: Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2026, i, 1).toLocaleString("default", { month: "short" }),
      revenue: Math.round(2000 + Math.sin(i / 2) * 1500 + i * 800),
      payouts: Math.round(400 + Math.cos(i / 3) * 300 + i * 100),
      net: Math.round(1600 + Math.sin(i / 2) * 1200 + i * 700),
      challenges: Math.round(40 + Math.sin(i / 2) * 20 + i * 15),
    })),
  };
}

/* Daily highlights data */
export function getDailyHighlights(tenantId: string) {
  const hours = Array.from({ length: 24 }, (_, h) => `${h}:00`);
  return {
    dailyRevenue: 1092.16,
    dailyPayouts: 52.5,
    dailyNetRevenue: 1039.66,
    avgOrderValue: 40.45,
    latestHourRevenue: 36.77,
    // Hourly revenue/orders/payouts use deterministic sine curves (no
    // Math.random) — stable across reloads, mirrors `payoutSeries` and
    // `breachTrend` patterns. `tenantId` is intentionally consumed so the
    // values differ slightly per tenant without losing determinism.
    hourlyRevenue: hours.map((h, i) => ({
      hour: h,
      value: Math.round(20 + Math.sin(i / 3) * 40 + (hashStr(`${tenantId}-rev-${i}`) % 30)),
    })),
    hourlyOrders: hours.map((h, i) => ({
      hour: h,
      value: Math.round(1 + Math.sin(i / 3) * 2 + ((hashStr(`${tenantId}-ord-${i}`) % 10) / 10)),
    })),
    hourlyPayouts: hours.map((h, i) => ({
      hour: h,
      value: Math.round((hashStr(`${tenantId}-pay-${i}`) % 50) / 10),
    })),
    topCountries: [
      { country: "United States", orders: 142, revenue: 5680 },
      { country: "United Kingdom", orders: 89, revenue: 3560 },
      { country: "UAE", orders: 67, revenue: 2680 },
      { country: "Singapore", orders: 45, revenue: 1800 },
      { country: "Germany", orders: 38, revenue: 1520 },
    ],
    topPSPs: [
      { psp: "Crypto (USDT)", orders: 198, revenue: 7920 },
      { psp: "Card (Stripe)", orders: 156, revenue: 6240 },
      { psp: "Fiat (Bank)", orders: 67, revenue: 2680 },
    ],
    topPlatforms: [
      { platform: "MetaTrader 5", accounts: 1240, pct: 87 },
      { platform: "DXTrade", accounts: 186, pct: 13 },
    ],
    topCoupons: [
      { code: "EXPO2026", redemptions: 42, savings: 1680 },
      { code: "SUMMER20", redemptions: 28, savings: 560 },
      { code: "WELCOME10", redemptions: 15, savings: 150 },
    ],
    purchasesByAccountSize: [
      { size: "$5K", count: 45, revenue: 1800 },
      { size: "$10K", count: 112, revenue: 4480 },
      { size: "$25K", count: 89, revenue: 3560 },
      { size: "$50K", count: 67, revenue: 2680 },
      { size: "$100K", count: 34, revenue: 1360 },
    ],
    // Recent orders use deterministic `hashStr` for the amount in place of
    // Math.random — keeps the demo table stable across reloads.
    recentOrders: Array.from({ length: 8 }, (_, i) => ({
      id: `ORD-${10000 + i}`,
      customer: traders[i % traders.length]?.name ?? "Unknown",
      challenge: ["2-Step Gen Z", "Instant Standard", "1-Step Turbo"][i % 3],
      amount: 35 + (hashStr(`${tenantId}-ord-amount-${i}`) % 50),
      psp: ["Crypto", "Card", "Fiat"][i % 3],
      time: `${i + 1}h ago`,
    })),
  };
}
