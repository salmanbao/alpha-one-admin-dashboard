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
      primaryColor: "#0f766e", // teal-700
      accentColor: "#14b8a6",
      surfaceColor: "#f0fdfa",
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
      primaryColor: "#7c2d12", // amber-900 (warm, non-blue)
      accentColor: "#ea580c",
      surfaceColor: "#fff7ed",
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
      primaryColor: "#6d28d9", // violet-600 (non-blue accent)
      accentColor: "#8b5cf6",
      surfaceColor: "#f5f3ff",
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

/* The super-admin "platform" pseudo-tenant */
export const platformTenant: TenantContext = {
  id: "platform",
  slug: "platform",
  name: "PFaaS Platform",
  application: "super-admin",
  branding: {
    name: "PFaaS Platform",
    tagline: "White-label prop firm infrastructure.",
    initials: "PF",
    primaryColor: "#0a0a0a",
    accentColor: "#404040",
    surfaceColor: "#fafafa",
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
    id: "super-admin",
    name: "Super Admin",
    description: "Controls the PFaaS platform itself.",
    application: "super-admin",
    permissions: ["*"],
    color: "#0a0a0a",
  },
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
    color: "#a21caf",
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
  {
    id: "trader",
    name: "Trader",
    description: "Participates in challenges and trades.",
    application: "trader",
    permissions: [
      "trader.self",
      "account.self",
      "challenge.self",
      "payout.self",
      "analytics.self",
      "support.self",
      "affiliate.self",
    ],
    color: "#0369a1",
  },
];

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users: AuthUser[] = [
  {
    id: "user-super",
    name: "Alex Morgan",
    email: "alex@pfaas.io",
    initials: "AM",
    roles: ["super-admin"],
    permissions: ["*"],
    application: "super-admin",
    lastActiveAt: hoursAgo(1),
  },
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
  {
    id: "user-trader-1",
    tenantId: "tenant-beta",
    name: "Tom Allen",
    email: "tom@example.com",
    initials: "TA",
    roles: ["trader"],
    permissions: roles.find((r) => r.id === "trader")!.permissions,
    application: "trader",
    lastActiveAt: hoursAgo(1),
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
];
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
      const volume = 0.05 + (n % 5) * 0.1;
      const pnl = (current - entry) * volume * (sym.includes("JPY") ? 1000 : 10000) * (n % 2 === 0 ? 1 : -1);
      out.push({
        id: `pos-${n}`,
        tenantId: a.tenantId,
        accountId: a.id,
        traderId: a.traderId,
        symbol: sym,
        side: n % 2 === 0 ? "buy" : "sell",
        volume,
        entryPrice: Math.round(entry * 100) / 100,
        currentPrice: current,
        pnl: Math.round(pnl),
        pnlPct: Math.round((pnl / (entry * volume)) * 10000) / 100,
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
      });
    }
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
export function getTenantAudit(tenantId: string): AuditEntry[] {
  return auditLog.filter((a) => a.module !== undefined).slice(0, 60);
}
export function getTenantPositions(tenantId: string): Position[] {
  return positions.filter((p) => p.tenantId === tenantId);
}
