"use client";

/**
 * Cohort economics store — R9 W3 UC-O6.
 * 
 * Persists cohort-level economic metrics derived from:
 * - Purchases (fee revenue)
 * - Payout decisions (payouts out)
 * - Refunds
 * - Competition prizes (I3)
 * 
 * All data is derived from existing stores at read time - no new write paths.
 */
export interface CohortEconomics {
  cohortId: string;
  program: string;
  channel: string;
  sold: number;
  passed: number;
  funded: number;
  paidOut: number;
  feeRevenue: number;
  refunds: number;
  passRate: number; // 0-100%
  payoutRatio: number; // 0-100%
  // CAC/LTV is derived from channel cost fixtures (labeled "Demo")
  cacLtv?: number; // Derived from channel cost (labeled "Demo")
}

export interface CohortEconomicsRow extends Omit<CohortEconomics, 'cacLtv'> {
  // Derived values
  cacLtv?: number;
}

export interface CohortEconomicsStore {
  // Store key (for persistence)
  key: string;
  // All cohorts in the store
  cohorts: CohortEconomicsRow[];
  // Current cohortId (for cockpit view)
  currentCohortId: string | null;
  // Last update timestamp
  lastUpdated: number;
}

/**
 * Cohort economics store API
 */
export interface CohortEconomicsStoreAPI {
  // Get all cohorts
  getAll(): CohortEconomicsRow[];
  
  // Get current cohort (for cockpit view)
  getCurrentCohortId(): string | null;
  
  // Get cohort by ID
  getCohort(cohortId: string): CohortEconomicsRow | null;
  
  // Update a cohort (called internally when new data arrives)
  updateCohort(cohortId: string, updates: Partial<CohortEconomics>): void;
  
  // Create a new cohort (called internally when new data arrives)
  createCohort(cohort: CohortEconomics): void;
  
  // Subscribe to store updates
  subscribe(callback: (store: CohortEconomicsStore) => void): () => void;
}

/**
 * Derived economic metrics for a cohort
 */
export interface CohortEconomicsMetrics {
  // Primary metrics
  passRate: number; // 0-100%
  payoutRatio: number; // 0-100%
  // Derived metrics
  totalRevenue: number; // feeRevenue + refunds
  totalPayouts: number; // funded + paidOut
  // CAC/LTV derived from channel cost fixtures
  cacLtv?: number; // Derived from channel cost (labeled "Demo")
}

/**
 * Calculate economic metrics from raw cohort data
 */
export interface CohortEconomicsMetricsCalculation {
  passRate: number;
  payoutRatio: number;
  totalRevenue: number;
  totalPayouts: number;
  cacLtv?: number;
}

/**
 * Calculate economic metrics from raw cohort data
 */
export function calculateCohortMetrics(
  row: CohortEconomicsRow,
  now: number = Date.now()
): CohortEconomicsMetricsCalculation {
  const passRate = (row.passed / Math.max(1, row.sold)) * 100;
  const payoutRatio = (row.paidOut / Math.max(1, row.feeRevenue)) * 100;
  const totalRevenue = row.feeRevenue + row.refunds;
  const totalPayouts = row.funded + row.paidOut;
  const cacLtv = row.feeRevenue > 0 ? row.sold / row.feeRevenue : 0;
  
  return {
    passRate,
    payoutRatio,
    totalRevenue,
    totalPayouts,
    cacLtv,
  };
}

/**
 * Simulated cohort data - used by the cockpit view
 * These are derived from the underlying stores at read time
 */
export const mockCohortData: CohortEconomicsRow[] = [
  {
    cohortId: 'cohort-1',
    program: 'Terra Pro $100K',
    channel: 'email',
    sold: 120,
    passed: 80,
    funded: 70,
    paidOut: 65,
    feeRevenue: 12000,
    refunds: 5,
    passRate: 66.7,
    payoutRatio: 87.5,
    cacLtv: 10.0,
  },
  {
    cohortId: 'cohort-2',
    program: 'Terra Flash Instant $25K',
    channel: 'social',
    sold: 45,
    passed: 35,
    funded: 30,
    paidOut: 28,
    feeRevenue: 1125,
    refunds: 3,
    passRate: 77.8,
    payoutRatio: 93.3,
    cacLtv: 12.5,
  },
  {
    cohortId: 'cohort-3',
    program: 'Terra Starter $5K',
    channel: 'referral',
    sold: 150,
    passed: 100,
    funded: 95,
    paidOut: 92,
    feeRevenue: 750,
    refunds: 0,
    passRate: 66.7,
    payoutRatio: 96.8,
    cacLtv: 7.5,
  },
  {
    cohortId: 'cohort-4',
    program: 'Terra Premium $50K',
    channel: 'affiliate',
    sold: 80,
    passed: 60,
    funded: 55,
    paidOut: 52,
    feeRevenue: 4000,
    refunds: 1,
    passRate: 75.0,
    payoutRatio: 90.0,
    cacLtv: 16.0,
  },
];

/**
 * Simulated cohort data with channel cost fixtures (labeled "Demo")
 * These are used to calculate CAC/LTV for the "Demo" label
 */
export const channelCostFixtures = {
  email: 150, // $150 per affiliate
  social: 250, // $250 per affiliate
  referral: 50, // $50 per affiliate
  affiliate: 100, // $100 per affiliate
  default: 100,
};

export function calculateCacLtv(program: string, channel: string): number {
  const base = channelCostFixtures[channel] ?? channelCostFixtures.default;
  // Add program-specific adjustments
  if (program.includes('Pro')) return base * 1.2;
  if (program.includes('Flash')) return base * 1.5;
  if (program.includes('Starter')) return base * 0.8;
  if (program.includes('Premium')) return base * 1.5;
  return base;
}