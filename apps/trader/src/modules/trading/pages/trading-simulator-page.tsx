"use client";

/**
 * Trading Simulator — audit finding #1 (MEDIUM).
 *
 * Traders on an evaluation have no sandbox: every order they place is
 * counted against the real daily-loss, drawdown and profit-target
 * rules, so a strategy change is only ever tested with the evaluation
 * itself on the line. This screen is the missing sub-screen — virtual
 * capital, the *same* program rules, and zero effect on the live
 * account.
 *
 * Determinism: outcomes come from a hash-seeded mulberry32 PRNG seeded
 * from `hashStr(seed + "#" + run)` — no `Math.random()` anywhere — so
 * the same settings always reproduce the same equity curve and the
 * same breach point. Swap the generator for a market feed when the
 * backend exposes one; the rule engine below stays as-is.
 *
 * Rules are read from the live fixtures (`terraRiskLimits`,
 * `acc.profitTarget`, `challengeForAccount`), so the simulator
 * enforces exactly what the evaluation enforces.
 *
 * Terra palette; chart heights follow the audit framework (full-width
 * 240, paired 220).
 */

import { useMemo, useState } from "react";
import {
  TerraAreaChart,
  TerraBadge,
  TerraBarChart,
  TerraCard,
  TerraDrawdownMeter,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import {
  challengeForAccount,
  terraAccounts,
  terraRiskLimits,
} from "@/lib/fixtures/terra-fixtures";
import { hashStr } from "@/lib/fixtures/trader-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { FlaskConical, Info, Play, RotateCcw, ShieldCheck } from "lucide-react";

const inputCls =
  "rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary";

/* ------------------------------------------------------------------ */
/* Strategies — deterministic parameters, no randomness in the preset  */
/* ------------------------------------------------------------------ */

type StrategyKey = "trend" | "meanrev" | "breakout" | "conservative";

interface StrategyPreset {
  key: StrategyKey;
  label: string;
  blurb: string;
  /** Probability that a simulated trade closes green. */
  winRate: number;
  /** Average winner, in R multiples of the amount risked. */
  avgWinR: number;
  /** Average loser, in R multiples of the amount risked. */
  avgLossR: number;
  tradesPerDay: number;
}

const STRATEGIES: StrategyPreset[] = [
  {
    key: "trend",
    label: "Trend follow",
    blurb: "Few, patient trades — winners run to 2.4R.",
    winRate: 0.42,
    avgWinR: 2.4,
    avgLossR: 1.0,
    tradesPerDay: 2,
  },
  {
    key: "meanrev",
    label: "Mean reversion",
    blurb: "More, smaller trades — fade the extremes.",
    winRate: 0.58,
    avgWinR: 1.1,
    avgLossR: 1.0,
    tradesPerDay: 4,
  },
  {
    key: "breakout",
    label: "Breakout",
    blurb: "Low hit rate, outsized 3R winners.",
    winRate: 0.34,
    avgWinR: 3.0,
    avgLossR: 1.0,
    tradesPerDay: 1,
  },
  {
    key: "conservative",
    label: "Conservative",
    blurb: "Half-size risk, high hit rate, slow grind.",
    winRate: 0.64,
    avgWinR: 0.9,
    avgLossR: 0.8,
    tradesPerDay: 1,
  },
];

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

/** mulberry32 — 32-bit seed in, uniform [0,1) out. Same seed, same run. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

type SimOutcome = "target" | "daily" | "drawdown" | "completed";

interface SimTrade {
  n: number;
  day: number;
  won: boolean;
  pnl: number;
  equity: number;
}

interface SimResult {
  trades: SimTrade[];
  /** End-of-day equity, starting from the opening balance. */
  curve: { x: string; y: number }[];
  /** Net P&L per trading day. */
  daily: { x: string; y: number }[];
  net: number;
  winRate: number;
  maxDrawdown: number;
  worstDay: number;
  days: number;
  outcome: SimOutcome;
  /** Day the run stopped (breach or target), null when it ran to plan. */
  stopDay: number | null;
}

interface RuleLimits {
  daily: number;
  maxDd: number;
}

function outcomeMeta(outcome: SimOutcome): { label: string; tone: "success" | "error" | "neutral" } {
  switch (outcome) {
    case "target":
      return { label: "Profit target reached", tone: "success" };
    case "daily":
      return { label: "Daily loss limit breached", tone: "error" };
    case "drawdown":
      return { label: "Max drawdown breached", tone: "error" };
    default:
      return { label: "Ran to plan — target not reached", tone: "neutral" };
  }
}

/**
 * Play `maxTrades` virtual trades through the program's real rules.
 *
 * Stops at the first hard stop — a daily-loss or drawdown breach ends
 * the evaluation in real life, so it ends the run here too. Reaching
 * the profit target first stops the run as a success.
 */
function simulate(
  preset: StrategyPreset,
  seed: string,
  start: number,
  riskPct: number,
  maxTrades: number,
  limits: RuleLimits,
  target: number,
): SimResult {
  const rand = mulberry32(hashStr(seed + "#" + preset.key));

  let equity = start;
  let peak = start;
  let maxDrawdown = 0;
  let day = 1;
  let dayPnl = 0;
  let worstDay = 0;
  let outcome: SimOutcome = "completed";
  let stopDay: number | null = null;

  const trades: SimTrade[] = [];
  const curve: { x: string; y: number }[] = [{ x: "Open", y: start }];
  const daily: { x: string; y: number }[] = [];

  for (let i = 0; i < maxTrades; i++) {
    // Close out the previous trading day before the first trade of a new one.
    if (i > 0 && i % preset.tradesPerDay === 0) {
      daily.push({ x: `Day ${day}`, y: Math.round(dayPnl) });
      worstDay = Math.min(worstDay, dayPnl);
      curve.push({ x: `Day ${day}`, y: Math.round(equity) });
      dayPnl = 0;
      day += 1;
    }

    const risk = Math.max(0, (equity * riskPct) / 100);
    const won = rand() < preset.winRate;
    // Same jitter band for winners and losers so the shape of the
    // equity curve is a property of the preset + seed, not of luck.
    const jitter = 0.7 + rand() * 0.6;
    const r = won ? preset.avgWinR * jitter : -preset.avgLossR * jitter;
    const pnl = risk * r;

    equity += pnl;
    dayPnl += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    trades.push({ n: i + 1, day, won, pnl, equity });

    // Hard stops — evaluated in the same order the rule engine does.
    if (equity <= 0) {
      outcome = "drawdown";
      stopDay = day;
      break;
    }
    if (equity - start >= target) {
      outcome = "target";
      stopDay = day;
      break;
    }
    if (dayPnl <= -limits.daily) {
      outcome = "daily";
      stopDay = day;
      break;
    }
    if (maxDrawdown >= limits.maxDd) {
      outcome = "drawdown";
      stopDay = day;
      break;
    }
  }

  // Flush the final (possibly partial) day so the curve and the
  // worst-day stat always cover every trade that was simulated.
  daily.push({ x: `Day ${day}`, y: Math.round(dayPnl) });
  worstDay = Math.min(worstDay, dayPnl);
  curve.push({ x: `Day ${day}`, y: Math.round(equity) });

  const wins = trades.filter((t) => t.won).length;
  return {
    trades,
    curve,
    daily,
    net: equity - start,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    maxDrawdown,
    worstDay,
    days: day,
    outcome,
    stopDay,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TradingSimulatorPage() {
  const { activeAccount } = useActiveAccount();

  const [accountId, setAccountId] = useState(() => activeAccount.id);
  const [strategyKey, setStrategyKey] = useState<StrategyKey>("trend");
  const [riskPctRaw, setRiskPctRaw] = useState("1");
  const [tradesRaw, setTradesRaw] = useState("60");
  const [seed, setSeed] = useState("terra-sim");
  const [runCount, setRunCount] = useState(1);

  const acc = terraAccounts.find((a) => a.id === accountId) ?? terraAccounts[0];
  const limits: RuleLimits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const challenge = challengeForAccount(acc.id);

  const riskPct = clamp(Number.parseFloat(riskPctRaw) || 1, 0.1, 5);
  const maxTrades = Math.round(clamp(Number.parseFloat(tradesRaw) || 60, 5, 200));
  const effectiveSeed = `${seed.trim() || "terra-sim"}#${runCount}`;
  const strategy = STRATEGIES.find((s) => s.key === strategyKey) ?? STRATEGIES[0];

  const result = useMemo(
    () => simulate(strategy, effectiveSeed, acc.startingBalance, riskPct, maxTrades, limits, acc.profitTarget),
    [strategy, effectiveSeed, acc, riskPct, maxTrades, limits],
  );

  // Same seed, same account, every preset — a fair side-by-side.
  const comparison = useMemo(
    () =>
      STRATEGIES.map((s) => ({
        preset: s,
        run: simulate(s, effectiveSeed, acc.startingBalance, riskPct, maxTrades, limits, acc.profitTarget),
      })),
    [effectiveSeed, acc, riskPct, maxTrades, limits],
  );

  /* ── Rule implications — derived, never hand-written ── */
  const implications = useMemo(() => {
    const unit = (acc.startingBalance * riskPct) / 100;
    const avgLossUsd = unit * strategy.avgLossR;
    const avgWinUsd = unit * strategy.avgWinR;
    const expectancy = strategy.winRate * avgWinUsd - (1 - strategy.winRate) * avgLossUsd;
    return [
      {
        label: "Average loss",
        value: formatMoney(avgLossUsd),
        note: `at ${riskPct}% risk × ${strategy.avgLossR}R — the daily limit allows ${
          avgLossUsd > 0 ? Math.max(1, Math.floor(limits.daily / avgLossUsd)) : 0
        } in a row`,
      },
      {
        label: "Average win",
        value: formatMoney(avgWinUsd),
        note: `at ${riskPct}% risk × ${strategy.avgWinR}R with a ${Math.round(strategy.winRate * 100)}% hit rate`,
      },
      {
        label: "Losses to max DD",
        value: String(avgLossUsd > 0 ? Math.max(1, Math.floor(limits.maxDd / avgLossUsd)) : 0),
        note: `consecutive average losses against the ${formatMoney(limits.maxDd)} drawdown`,
      },
      {
        label: "Trades to target",
        value:
          expectancy > 0 ? String(Math.max(1, Math.ceil(acc.profitTarget / expectancy))) : "—",
        note:
          expectancy > 0
            ? `at ${formatMoney(expectancy)} expectancy per trade`
            : "negative expectancy — the target is out of reach",
      },
    ];
  }, [acc, strategy, riskPct, limits]);

  const meta = outcomeMeta(result.outcome);
  const recentTrades = result.trades.slice(-12);
  const targetPct = clamp((result.net / acc.profitTarget) * 100, 0, 100);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Simulator"
        description="Test a strategy against your program's real rules with virtual capital."
        actions={
          <TerraBadge tone={result.outcome === "daily" || result.outcome === "drawdown" ? "error" : "primary"} dot>
            <FlaskConical className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {meta.label}
          </TerraBadge>
        }
      />

      {/* Evaluation-untouched banner — the whole point of the screen. */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-fixed/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-bold text-on-surface">Your evaluation is untouched</p>
          <p className="mt-0.5 text-on-surface-variant">
            Every trade here is virtual — nothing is sent to the server, nothing counts against
            your live {acc.name} account. The same settings always produce the same run, so you
            can compare strategies without luck moving the goalposts.
          </p>
        </div>
      </div>

      {/* ── Controls ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Set up a run"
          description="Rules are read from your program — daily loss, drawdown and target match the evaluation exactly."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Account
            </span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`${inputCls} font-semibold`}
            >
              {terraAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Risk per trade (%)
            </span>
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={riskPctRaw}
              onChange={(e) => setRiskPctRaw(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Trades to simulate
            </span>
            <input
              type="number"
              min={5}
              max={200}
              step={5}
              value={tradesRaw}
              onChange={(e) => setTradesRaw(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Seed
            </span>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className={inputCls}
              placeholder="terra-sim"
            />
          </label>
        </div>

        <div className="pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Strategy
          </span>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label="Choose a strategy preset"
          >
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={strategyKey === s.key}
                onClick={() => setStrategyKey(s.key)}
                className={`rounded-full px-3 py-1.5 text-left text-xs font-bold transition-colors ${
                  strategyKey === s.key
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {s.label}
                <span className="ml-1.5 font-normal opacity-75">
                  {Math.round(s.winRate * 100)}% hit
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">{strategy.blurb}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          <button
            type="button"
            onClick={() => setRunCount((c) => c + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Run simulation
          </button>
          <button
            type="button"
            onClick={() => {
              setStrategyKey("trend");
              setRiskPctRaw("1");
              setTradesRaw("60");
              setSeed("terra-sim");
              setRunCount(1);
              setAccountId(terraAccounts[0].id);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
          <span className="self-center text-xs text-on-surface-variant">
            Run #{runCount} · seed <span className="font-mono">{effectiveSeed}</span>
          </span>
        </div>
      </TerraCard>

      {/* ── Outcome stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <TerraCard>
          <TerraStat
            label="Net P&L"
            value={formatSignedMoney(result.net)}
            sub={`${result.days} trading day${result.days === 1 ? "" : "s"}`}
            tone={result.net >= 0 ? "positive" : "negative"}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Win rate"
            value={`${result.winRate.toFixed(0)}%`}
            sub={`${result.trades.filter((t) => t.won).length} of ${result.trades.length} trades`}
            tone={result.winRate >= 50 ? "positive" : "neutral"}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Max drawdown"
            value={formatMoney(result.maxDrawdown)}
            sub={`of ${formatMoney(limits.maxDd)} allowed`}
            tone={result.maxDrawdown >= limits.maxDd * 0.7 ? "negative" : "neutral"}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Worst day"
            value={formatSignedMoney(result.worstDay)}
            sub={`of ${formatMoney(limits.daily)} allowed`}
            tone={result.worstDay <= -limits.daily * 0.7 ? "negative" : "neutral"}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Outcome"
            value={
              <TerraBadge tone={meta.tone === "success" ? "success" : meta.tone === "error" ? "error" : "neutral"}>
                {meta.label}
              </TerraBadge>
            }
            sub={result.stopDay ? `stopped on day ${result.stopDay}` : "no hard stop hit"}
          />
        </TerraCard>
      </div>

      {/* ── Equity curve (full-width 240) ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Simulated equity"
          description={`${acc.name} — opened at ${formatMoney(acc.startingBalance)}, target ${formatMoney(acc.profitTarget)}.`}
        />
        <TerraAreaChart
          data={result.curve}
          height={240}
          formatValue={(v) => formatMoney(v)}
        />
      </TerraCard>

      {/* ── Paired: daily P&L (220) + rule impact ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TerraCard>
          <TerraSectionTitle
            title="Daily P&L"
            description="Net result of each simulated trading day."
          />
          <TerraBarChart
            data={result.daily}
            height={220}
            formatValue={(v) => formatSignedMoney(v)}
            label={`Simulated daily P&L — ${result.daily.length} days, worst ${formatSignedMoney(result.worstDay)}`}
          />
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle
            title="Rule impact"
            description="How close this run came to each hard stop."
          />
          <div className="space-y-3">
            <TerraDrawdownMeter
              label="Daily loss (worst day)"
              used={Math.min(Math.abs(Math.min(0, result.worstDay)), limits.daily)}
              limit={limits.daily}
              remaining={Math.max(0, limits.daily - Math.abs(Math.min(0, result.worstDay)))}
              description="worst simulated day"
            />
            <TerraDrawdownMeter
              label="Max drawdown"
              used={Math.min(result.maxDrawdown, limits.maxDd)}
              limit={limits.maxDd}
              remaining={Math.max(0, limits.maxDd - result.maxDrawdown)}
              description="peak-to-trough"
            />
            <div className="rounded-xl bg-surface-container-low px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Profit target
                </span>
                <span className="text-[11px] font-bold text-primary">
                  {targetPct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="font-headline text-lg font-bold tabular-nums text-on-surface">
                  {formatSignedMoney(result.net)}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  of {formatMoney(acc.profitTarget)}
                </span>
              </div>
              <div className="mt-2">
                <TerraProgress value={targetPct} height="h-2" />
              </div>
            </div>
          </div>
        </TerraCard>
      </div>

      {/* ── Rule implications ── */}
      <TerraCard>
        <TerraSectionTitle
          title="What these settings mean for your rules"
          description={`${strategy.label} at ${riskPct}% risk — derived from your program's ${formatMoney(limits.daily)} daily and ${formatMoney(limits.maxDd)} drawdown limits.`}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {implications.map((i) => (
            <div key={i.label} className="rounded-xl bg-surface-container-low p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {i.label}
              </p>
              <p className="mt-1 font-headline text-lg font-bold tabular-nums text-on-surface">
                {i.value}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">{i.note}</p>
            </div>
          ))}
        </div>
      </TerraCard>

      {/* ── Strategy comparison ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Compare strategies"
          description="All four presets, same account, same seed, same risk — only the playbook changes."
        />
        <TerraTable
          head={["Strategy", "Net P&L", "Win rate", "Max drawdown", "Days", "Outcome"]}
          rows={comparison.map(({ preset, run }) => {
            const m = outcomeMeta(run.outcome);
            return [
              <span key="s" className="font-semibold">
                {preset.label}
              </span>,
              <span
                key="n"
                className={`tabular-nums ${run.net >= 0 ? "text-primary" : "text-error"}`}
              >
                {formatSignedMoney(run.net)}
              </span>,
              <span key="w" className="tabular-nums">
                {run.winRate.toFixed(0)}%
              </span>,
              <span key="d" className="tabular-nums">
                {formatMoney(run.maxDrawdown)}
              </span>,
              <span key="y" className="tabular-nums">
                {run.days}
              </span>,
              <span key="o">
                <TerraBadge tone={m.tone === "success" ? "success" : m.tone === "error" ? "error" : "neutral"}>
                  {m.label}
                </TerraBadge>
              </span>,
            ];
          })}
        />
      </TerraCard>

      {/* ── Recent trades ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Simulated trades"
          description={`Last ${recentTrades.length} of ${result.trades.length} — equity after each fill.`}
        />
        {recentTrades.length > 0 ? (
          <TerraTable
            head={["Trade", "Day", "Result", "P&L", "Equity"]}
            rows={recentTrades.map((t) => [
              <span key="n" className="tabular-nums text-on-surface-variant">
                #{t.n}
              </span>,
              <span key="d" className="tabular-nums">
                {t.day}
              </span>,
              <span key="r">
                <TerraBadge tone={t.won ? "success" : "error"}>{t.won ? "Win" : "Loss"}</TerraBadge>
              </span>,
              <span
                key="p"
                className={`tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}
              >
                {formatSignedMoney(t.pnl)}
              </span>,
              <span key="e" className="tabular-nums font-semibold">
                {formatMoney(t.equity)}
              </span>,
            ])}
          />
        ) : (
          <p className="text-sm text-on-surface-variant">No trades simulated yet.</p>
        )}
      </TerraCard>

      {/* ── Program rules footnote ── */}
      <div className="flex items-start gap-2 rounded-xl bg-secondary-fixed/60 p-4 text-xs text-on-secondary-fixed-variant">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Rules applied to this run: daily loss {formatMoney(limits.daily)} · max drawdown{" "}
          {formatMoney(limits.maxDd)} · profit target {formatMoney(acc.profitTarget)}
          {challenge ? (
            <>
              {" "}
              · minimum {challenge.minDays} trading days · {challenge.name}{" "}
              {Math.round((acc.profitTarget / acc.startingBalance) * 10000) / 100}% target
            </>
          ) : null}
          . The simulator models R-multiple outcomes against a constant {riskPct}% of equity —
          swap in live ticks when market data is available and the rule engine still applies the
          same way.
        </span>
      </div>
    </div>
  );
}
