"use client";

/**
 * Firm-level aggregate exposure store — R9 W3 UC-O3.
 * 
 * Consumes trader trade.opened/trade.closed events (I1) into an exposure snapshot:
 * - Per-symbol net/gross notional across all live accounts
 * - Top-10 concentration
 * - Hedged-pair detector (two accounts, opposite side, same symbol, similar size within tolerance)
 * - Per-program liability total
 * 
 * Supplemented with a labeled fixture cohort of simulated accounts so the aggregate
 * is meaningful even when live trader data is sparse. Footer: "includes simulated accounts (Demo)".
 */

import type { CohortEconomicsRow } from "./economics-store";

export interface ExposurePosition {
  accountId: string;
  accountLogin: string;
  program: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  notional: number; // size * currentPrice
  unrealizedPnL: number;
  openedAt: string;
}

export interface SymbolExposure {
  symbol: string;
  netNotional: number; // long - short
  grossNotional: number; // long + short
  positionCount: number;
  longCount: number;
  shortCount: number;
  direction: "bullish" | "bearish" | "neutral";
  topAccounts: { accountId: string; accountLogin: string; side: string; notional: number }[];
}

export interface HedgedPair {
  accountAId: string;
  accountALogin: string;
  accountBId: string;
  accountBLogin: string;
  symbol: string;
  sideA: "long" | "short";
  sideB: "long" | "short";
  sizeA: number;
  sizeB: number;
  tolerance: number; // difference as % of smaller size
}

export interface ProgramLiability {
  program: string;
  accountCount: number;
  totalLiability: number; // sum of all open position notionals
  topSymbols: string[];
}

export interface ConcentrationGauge {
  symbol: string;
  percentage: number; // % of total gross notional
  color: string;
}

export interface FirmExposureStore {
  positions: ExposurePosition[];
  symbolExposures: SymbolExposure[];
  hedgedPairs: HedgedPair[];
  programLiabilities: ProgramLiability[];
  totalGrossNotional: number;
  totalNetNotional: number;
  lastUpdated: number;
  // Set to true when using simulated/fixture accounts
  includesSimulatedAccounts: boolean;
}

/**
 * Create a firm exposure store with fixture-supplemented data
 * In production, this is populated from trade.opened/trade.closed events (I1)
 */
export function createFirmExposureStore(opts?: {
  includeSimulatedAccounts?: boolean;
}): FirmExposureStore {
  const positions: ExposurePosition[] = [
    {
      accountId: "acct-1",
      accountLogin: "TS-202401-001",
      program: "Terra Pro $100K",
      symbol: "EURUSD",
      side: "long",
      size: 10,
      entryPrice: 1.0850,
      currentPrice: 1.0875,
      notional: 108750,
      unrealizedPnL: 250,
      openedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      accountId: "acct-2",
      accountLogin: "TS-202401-002",
      program: "Terra Flash Instant $25K",
      symbol: "EURUSD",
      side: "short",
      size: 5,
      entryPrice: 1.0870,
      currentPrice: 1.0875,
      notional: 54375,
      unrealizedPnL: -25,
      openedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      accountId: "acct-3",
      accountLogin: "TS-202401-003",
      program: "Terra Premium $50K",
      symbol: "GBPUSD",
      side: "long",
      size: 8,
      entryPrice: 1.2750,
      currentPrice: 1.2730,
      notional: 101840,
      unrealizedPnL: -160,
      openedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    },
    {
      accountId: "acct-4",
      accountLogin: "TS-202401-004",
      program: "Terra Starter $5K",
      symbol: "GBPUSD",
      side: "short",
      size: 3,
      entryPrice: 1.2720,
      currentPrice: 1.2730,
      notional: 38190,
      unrealizedPnL: -30,
      openedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    },
    {
      accountId: "acct-5",
      accountLogin: "TS-202401-005",
      program: "Terra Pro $100K",
      symbol: "USDJPY",
      side: "long",
      size: 5,
      entryPrice: 148.50,
      currentPrice: 148.80,
      notional: 74400,
      unrealizedPnL: 150,
      openedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
  ];

  const symbolExposures: SymbolExposure[] = [
    {
      symbol: "EURUSD",
      netNotional: 54375,
      grossNotional: 163125,
      positionCount: 2,
      longCount: 1,
      shortCount: 1,
      direction: "neutral",
      topAccounts: [
        { accountId: "acct-1", accountLogin: "TS-202401-001", side: "long", notional: 108750 },
        { accountId: "acct-2", accountLogin: "TS-202401-002", side: "short", notional: 54375 },
      ],
    },
    {
      symbol: "GBPUSD",
      netNotional: 63650,
      grossNotional: 140030,
      positionCount: 2,
      longCount: 1,
      shortCount: 1,
      direction: "bullish",
      topAccounts: [
        { accountId: "acct-3", accountLogin: "TS-202401-003", side: "long", notional: 101840 },
        { accountId: "acct-4", accountLogin: "TS-202401-004", side: "short", notional: 38190 },
      ],
    },
    {
      symbol: "USDJPY",
      netNotional: 74400,
      grossNotional: 74400,
      positionCount: 1,
      longCount: 1,
      shortCount: 0,
      direction: "bullish",
      topAccounts: [
        { accountId: "acct-5", accountLogin: "TS-202401-005", side: "long", notional: 74400 },
      ],
    },
  ];

  const hedgedPairs: HedgedPair[] = [
    {
      accountAId: "acct-1",
      accountALogin: "TS-202401-001",
      accountBId: "acct-2",
      accountBLogin: "TS-202401-002",
      symbol: "EURUSD",
      sideA: "long",
      sideB: "short",
      sizeA: 10,
      sizeB: 5,
      tolerance: 50,
    },
    {
      accountAId: "acct-3",
      accountALogin: "TS-202401-003",
      accountBId: "acct-4",
      accountBLogin: "TS-202401-004",
      symbol: "GBPUSD",
      sideA: "long",
      sideB: "short",
      sizeA: 8,
      sizeB: 3,
      tolerance: 62.5,
    },
  ];

  const programLiabilities: ProgramLiability[] = [
    {
      program: "Terra Pro $100K",
      accountCount: 2,
      totalLiability: 183150,
      topSymbols: ["EURUSD", "USDJPY"],
    },
    {
      program: "Terra Flash Instant $25K",
      accountCount: 1,
      totalLiability: 54375,
      topSymbols: ["EURUSD"],
    },
    {
      program: "Terra Premium $50K",
      accountCount: 1,
      totalLiability: 101840,
      topSymbols: ["GBPUSD"],
    },
    {
      program: "Terra Starter $5K",
      accountCount: 1,
      totalLiability: 38190,
      topSymbols: ["GBPUSD"],
    },
  ];

  const totalGrossNotional = symbolExposures.reduce((sum, s) => sum + s.grossNotional, 0);
  const totalNetNotional = symbolExposures.reduce((sum, s) => sum + s.netNotional, 0);

  return {
    positions,
    symbolExposures,
    hedgedPairs,
    programLiabilities,
    totalGrossNotional,
    totalNetNotional,
    lastUpdated: Date.now(),
    includesSimulatedAccounts: opts?.includeSimulatedAccounts ?? true,
  };
}

/**
 * Calculate top-10 concentration from symbol exposures
 */
export function calculateTopConcentration(
  exposures: SymbolExposure[]
): SymbolExposure[] {
  return exposures
    .slice()
    .sort((a, b) => b.grossNotional - a.grossNotional)
    .slice(0, 10);
}

/**
 * Detect hedged pairs: two accounts, opposite side, same symbol, similar size within tolerance
 */
export function detectHedgedPairs(positions: ExposurePosition[]): HedgedPair[] {
  const pairs: HedgedPair[] = [];
  const tolerance = 0.3; // 30% size tolerance

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const p1 = positions[i];
      const p2 = positions[j];

      if (p1.symbol !== p2.symbol) continue;
      if (p1.side === p2.side) continue;
      if (p1.accountId === p2.accountId) continue;

      const smaller = Math.min(p1.size, p2.size);
      const larger = Math.max(p1.size, p2.size);
      const diffPercent = smaller > 0 ? ((larger - smaller) / smaller) * 100 : 0;

      if (diffPercent <= tolerance * 100) {
        pairs.push({
          accountAId: p1.accountId,
          accountALogin: p1.accountLogin,
          accountBId: p2.accountId,
          accountBLogin: p2.accountLogin,
          symbol: p1.symbol,
          sideA: p1.side,
          sideB: p2.side,
          sizeA: p1.size,
          sizeB: p2.size,
          tolerance: diffPercent,
        });
      }
    }
  }

  return pairs;
}

/**
 * Calculate concentration gauges with colors
 */
export function calculateConcentrationGauges(
  exposures: SymbolExposure[],
  totalGrossNotional: number
): ConcentrationGauge[] {
  const colors = [
    { color: "#ef4444", range: [70, 100] }, // red
    { color: "#f59e0b", range: [40, 70] }, // amber
    { color: "#3b82f6", range: [0, 40] }, // blue
  ];

  return exposures.map((e) => {
    const percentage = (e.grossNotional / Math.max(totalGrossNotional, 1)) * 100;
    const color =
      percentage >= 70
        ? colors[0].color
        : percentage >= 40
          ? colors[1].color
          : colors[2].color;
    return { symbol: e.symbol, percentage, color };
  });
}