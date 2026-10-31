/**
 * Challenge rule simulation — finding #5 (rule validation before publish).
 *
 * A pure, deterministic model of how a cohort of hypothetical traders
 * would fare against a given rule set. No historical completed
 * outcomes exist in the demo fixtures (every seeded challenge is
 * in-progress), so replaying the past isn't possible; instead the
 * simulator runs a seeded random walk per trader — same inputs, same
 * numbers, every run — and aggregates the cohort outcome. This is
 * modeling, not measurement, and the UI says so.
 *
 * Model (frontend-honest simplification):
 *   • Each trader draws a skill factor (positive-edge day returns on
 *     average) and then trades one day at a time until they pass,
 *     breach, or run out the clock.
 *   • A day moves equity by a normally-ish distributed return scaled
 *     by skill; breaches are checked in rule order (daily drawdown
 *     first — it's checked intraday in production too — then max
 *     drawdown against the running peak, then the profit target).
 *   • Aggregates: pass rate, failure-reason mix, median days to pass,
 *     and the final-equity distribution (the profit distribution the
 *     finding asks for).
 *
 * Deterministic PRNG (mulberry32) — a fixed seed keeps every render
 * and every run identical, which matters for both trust and tests.
 */

export interface RuleConfig {
  /** Profit target as % of account size. */
  profitTargetPct: number;
  /** Max daily loss as % of account size. */
  dailyDrawdownPct: number;
  /** Max total drawdown (from peak) as % of account size. */
  maxDrawdownPct: number;
  /** Time limit in days. */
  timeLimitDays: number;
}

export interface SimulationResult {
  cohortSize: number;
  passed: number;
  failed: number;
  passRatePct: number;
  /** Failure-reason mix (counts). */
  failures: {
    dailyDrawdown: number;
    maxDrawdown: number;
    timeLimit: number;
  };
  /** Median days to pass, among passers (0 when nobody passed). */
  medianDaysToPass: number;
  /** Final-equity buckets as % of starting size (for the histogram). */
  distribution: { from: number; to: number; count: number }[];
  /** Final equity % of account size, sorted — feeds percentile stats. */
  finalEquityPctSorted: number[];
  medianFinalEquityPct: number;
}

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximately-normal draw from 3 uniform samples (cheap CLT). */
function gauss(rnd: () => number) {
  return (rnd() + rnd() + rnd() - 1.5) * 1.4;
}

export function simulateChallengeRules(
  rules: RuleConfig,
  cohortSize = 200,
  seed = 42,
): SimulationResult {
  const rnd = mulberry32(seed);
  let passed = 0;
  const failures = { dailyDrawdown: 0, maxDrawdown: 0, timeLimit: 0 };
  const daysToPass: number[] = [];
  const finalEquityPct: number[] = [];

  for (let trader = 0; trader < cohortSize; trader++) {
    // Skill: most traders are near breakeven-with-noise, a thin tail
    // has a genuine positive edge (mirrors real challenge cohorts).
    const skill = (rnd() * 2 - 1) * 0.0025 + (rnd() < 0.18 ? 0.0022 : 0.0004);

    let equityPct = 0; // % of account size
    let peakPct = 0;
    let outcome: "passed" | "dailyDrawdown" | "maxDrawdown" | "timeLimit" | null = null;
    let passDay = 0;

    for (let day = 1; day <= rules.timeLimitDays && outcome === null; day++) {
      const dayReturn = skill + gauss(rnd) * 0.012;
      equityPct += dayReturn;
      peakPct = Math.max(peakPct, equityPct);

      if (equityPct <= -rules.dailyDrawdownPct) {
        outcome = "dailyDrawdown";
      } else if (peakPct - equityPct >= rules.maxDrawdownPct) {
        outcome = "maxDrawdown";
      } else if (equityPct >= rules.profitTargetPct) {
        outcome = "passed";
        passDay = day;
      } else if (day === rules.timeLimitDays) {
        outcome = "timeLimit";
      }
    }

    if (outcome === "passed") {
      passed++;
      daysToPass.push(passDay);
      // Passers stop AT the target in production; model a small
      // overshoot tail so the distribution isn't a single spike.
      finalEquityPct.push(rules.profitTargetPct + Math.max(0, gauss(rnd)) * 1.5);
    } else {
      failures[outcome as keyof typeof failures]++;
      finalEquityPct.push(Math.max(equityPct, -(rules.dailyDrawdownPct + 1)));
    }
  }

  // Histogram buckets in % of account size: deep loss → target → beyond.
  const edges = [-12, -8, -4, 0, 4, 8, 12, 16, 100];
  const distribution = edges.slice(0, -1).map((from, i) => ({
    from,
    to: edges[i + 1],
    count: finalEquityPct.filter((v) => v >= from && v < edges[i + 1]).length,
  }));

  const sorted = [...finalEquityPct].sort((a, b) => a - b);
  const median = (arr: number[]) =>
    arr.length === 0
      ? 0
      : arr.length % 2 === 1
        ? arr[(arr.length - 1) / 2]
        : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;

  return {
    cohortSize,
    passed,
    failed: cohortSize - passed,
    passRatePct: Math.round((passed / cohortSize) * 1000) / 10,
    failures,
    medianDaysToPass: Math.round(median(daysToPass)),
    distribution,
    finalEquityPctSorted: sorted,
    medianFinalEquityPct: Math.round(median(sorted) * 10) / 10,
  };
}
