"use client";

/**
 * Pattern Monitor — converted for audit B #1, extended for audit #2
 *
 * The prop-firm risk stack has always watched a trader's linked accounts
 * for three trading patterns; operators saw them, the trader never did,
 * so a rule was only ever explained *after* it was broken. This screen
 * surfaces the same detections against the trader's own closed-trade
 * history — and, more importantly, explains what is watched, why the
 * rule exists, and how to adjust before anything triggers.
 *
 * Detections are derived (detectTerraPatterns) from the deterministic
 * fixtures: same data, same events, every render.
 *
 * Audit #2 added the visualization layer the finding called for:
 *
 *   • Global filters — time period, instrument, outcome — that drive
 *     the heatmap, the per-symbol comparison and the detection list
 *     together, so a question like "how does EURUSD behave on Mondays?"
 *     is one control away.
 *   • A symbol × weekday activity heatmap (trade count or net P&L),
 *     the standard way to see session/weekday bias at a glance.
 *   • Per-symbol comparative stats with inline bars — win rate and
 *     P&L side by side — plus that symbol's detection indicators, so
 *     the pattern risk of an instrument is readable from one row.
 *
 * Time filters anchor to the **newest trade in the fixtures**, never to
 * `Date.now()`, so the same data always lands in the same bucket.
 *
 * Terra palette; chart heights follow the audit framework.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import {
  detectTerraPatterns,
  terraAccounts,
  terraTrades,
  type TerraPatternEvent,
  type TerraPatternKind,
} from "@/lib/fixtures/terra-fixtures";
import {
  ArrowLeftRight,
  CalendarClock,
  Copy,
  Grid3x3,
  Info,
  Layers,
  X,
} from "lucide-react";

type KindFilter = "all" | TerraPatternKind;

const kindFilters: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All patterns" },
  { id: "copy", label: "Copy trading" },
  { id: "inverse", label: "Inverse / hedging" },
  { id: "weekend", label: "Weekend entries" },
];

const kindMeta: Record<
  TerraPatternKind,
  { label: string; tone: "primary" | "tertiary" | "error"; icon: typeof Copy }
> = {
  copy: { label: "Copy trading", tone: "primary", icon: Copy },
  inverse: { label: "Inverse / hedging", tone: "tertiary", icon: ArrowLeftRight },
  weekend: { label: "Weekend entry", tone: "error", icon: CalendarClock },
};

const loginOf = (accountId: string) =>
  terraAccounts.find((a) => a.id === accountId)?.login ?? accountId;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

/** One-line "what matched" text for a detection. */
function detailOf(event: TerraPatternEvent): string {
  const [a, b] = event.accounts.map(loginOf);
  if (event.kind === "weekend") {
    return `Entered ${fmtWhen(event.detectedAt)} — outside market hours`;
  }
  const legs =
    event.kind === "copy"
      ? `both ${event.side}`
      : `long on #${a}, short on #${b}`;
  return `${legs} • entries ${event.deltaMinutes}m apart on #${a} / #${b}`;
}

/* ------------------------------------------------------------------ */
/* Audit #2 — global filters                                           */
/* ------------------------------------------------------------------ */

type PeriodKey = "all" | "7" | "30" | "90";
type OutcomeKey = "all" | "wins" | "losses";

const periods: { id: PeriodKey; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
];

const outcomes: { id: OutcomeKey; label: string }[] = [
  { id: "all", label: "All outcomes" },
  { id: "wins", label: "Wins only" },
  { id: "losses", label: "Losses only" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** UTC weekday index (0 = Sun) → column (0 = Mon). */
const weekdayCol = (iso: string) => (new Date(iso).getUTCDay() + 6) % 7;

/** Static intensity buckets — Tailwind needs literal class names. */
const HEAT_POS = ["", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary/85"];
const HEAT_NEG = ["", "bg-error/15", "bg-error/35", "bg-error/60", "bg-error/85"];
const HEAT_TEXT = ["text-on-surface-variant", "text-on-surface", "text-on-surface", "text-on-primary", "text-on-primary"];
const HEAT_TEXT_NEG = ["text-on-surface-variant", "text-on-surface", "text-on-surface", "text-on-error", "text-on-error"];

const cellBase =
  "flex h-9 min-w-10 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors";

/* ------------------------------------------------------------------ */
/* Educational copy — the heart of the finding                          */
/* ------------------------------------------------------------------ */

const patternGuides: {
  kind: TerraPatternKind;
  title: string;
  watch: string;
  why: string;
  adjust: string[];
}[] = [
  {
    kind: "copy",
    title: "Copy & synchronized trading",
    watch: "The same symbol entered in the same direction on two of your accounts within 4 hours of each other.",
    why: "Limits are set per account, but a mirrored entry doubles the firm's exposure to a single idea — so position caps, correlated-exposure rules and consistency scoring are all breached even though each account looks healthy on its own. Entries that track each other across linked accounts are also read as coordinated trading, which most program rules treat as one trader operating a single book.",
    adjust: [
      "If you intentionally run the same idea twice, size each leg as half a position — risk the pair like one book, not two.",
      "Keep one active idea per account; if the second entry was a top-up, close or stagger it instead.",
      "Tag the intention in your trading journal so a reviewer sees a plan rather than a mirror.",
    ],
  },
  {
    kind: "inverse",
    title: "Inverse / hedging pairs",
    watch: "The same symbol entered in opposite directions on two accounts within 4 hours of each other.",
    why: "Opening the opposite leg on a second account instead of closing the first keeps both positions alive, so neither account records the economic loss. That is how drawdown limits, daily-loss rules and news restrictions get bypassed without any single account appearing to breach — which is exactly why programs prohibit it.",
    adjust: [
      "Close the original position rather than neutralizing it somewhere else.",
      "If the strategy is genuinely two-legged, run both legs inside one account and keep the net risk inside your daily limit.",
      "Need a legitimate hedge (e.g. over a scheduled announcement)? Request an exception before the window instead of routing it through a second account.",
    ],
  },
  {
    kind: "weekend",
    title: "Weekend & market-closed entries",
    watch: "An entry placed between Saturday 00:00 UTC and Sunday 21:00 UTC, while the market is closed.",
    why: "There is no continuous market at the weekend, so a resting order can only fill at the reopen — against a gap you never saw. Losses from those fills are unpredictable, and several programs also forbid carrying risk while the desk is closed for exactly that reason.",
    adjust: [
      "Cancel or reduce resting weekend orders before Friday's close.",
      "Move planned entries to the Sunday reopen or the Monday session instead of a limit left over the break.",
      "Already filled? Walk the entry in Trade Replay to see the gap you absorbed, then note the outcome in your journal.",
    ],
  },
];

export function TradingPatternsPage() {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [symbol, setSymbol] = useState<string>("all");
  const [outcome, setOutcome] = useState<OutcomeKey>("all");
  const [heatMetric, setHeatMetric] = useState<"trades" | "pnl">("trades");

  const events = useMemo(() => detectTerraPatterns(), []);

  /* ── Filter plumbing ── */
  const symbols = useMemo(
    () => [...new Set(terraTrades.map((t) => t.symbol))].sort(),
    [],
  );

  // Anchor: the newest closed trade in the fixtures — never Date.now(),
  // so "last 7 days" means the same window on every render.
  const anchor = useMemo(
    () => Math.max(...terraTrades.map((t) => +new Date(t.closedAt))),
    [],
  );

  const filteredTrades = useMemo(() => {
    const cutoff = period === "all" ? -Infinity : anchor - Number(period) * 86_400_000;
    return terraTrades.filter((t) => {
      if (+new Date(t.closedAt) < cutoff) return false;
      if (symbol !== "all" && t.symbol !== symbol) return false;
      if (outcome === "wins" && t.pnl <= 0) return false;
      if (outcome === "losses" && t.pnl >= 0) return false;
      return true;
    });
  }, [anchor, period, symbol, outcome]);

  const filteredTickets = useMemo(
    () => new Set(filteredTrades.map((t) => t.ticket)),
    [filteredTrades],
  );

  /** Detections that survive the same period / instrument / outcome window. */
  const filteredEvents = useMemo(() => {
    const cutoff = period === "all" ? -Infinity : anchor - Number(period) * 86_400_000;
    return events.filter((e) => {
      if (+new Date(e.detectedAt) < cutoff) return false;
      if (symbol !== "all" && e.symbol !== symbol) return false;
      // Outcome: keep the event only when at least one matched trade is
      // still in the filtered set (detections have no P&L of their own).
      if (outcome !== "all" && !e.tickets.some((tk) => filteredTickets.has(tk))) return false;
      return true;
    });
  }, [events, anchor, period, symbol, outcome, filteredTickets]);

  const counts = useMemo(
    () => ({
      copy: filteredEvents.filter((e) => e.kind === "copy").length,
      inverse: filteredEvents.filter((e) => e.kind === "inverse").length,
      weekend: filteredEvents.filter((e) => e.kind === "weekend").length,
    }),
    [filteredEvents],
  );

  const visible = useMemo(
    () => (kindFilter === "all" ? filteredEvents : filteredEvents.filter((e) => e.kind === kindFilter)),
    [filteredEvents, kindFilter],
  );

  const hasFilters = period !== "all" || symbol !== "all" || outcome !== "all";
  const clearFilters = () => {
    setPeriod("all");
    setSymbol("all");
    setOutcome("all");
  };

  /* ── Heatmap: symbol × weekday ── */
  const heatmap = useMemo(() => {
    const rows = symbols.map((sym) => {
      const cells = Array.from({ length: 7 }, () => ({ count: 0, pnl: 0 }));
      for (const t of filteredTrades) {
        if (t.symbol !== sym) continue;
        const c = weekdayCol(t.openedAt);
        cells[c].count += 1;
        cells[c].pnl += t.pnl;
      }
      return { sym, cells };
    });
    // Keep rows that actually have data under the current filters.
    return rows.filter((r) => r.cells.some((c) => (heatMetric === "trades" ? c.count > 0 : c.pnl !== 0)));
  }, [symbols, filteredTrades, heatMetric]);

  const heatMax = useMemo(() => {
    let max = 0;
    for (const r of heatmap) {
      for (const c of r.cells) {
        const v = heatMetric === "trades" ? c.count : Math.abs(c.pnl);
        if (v > max) max = v;
      }
    }
    return max || 1;
  }, [heatmap, heatMetric]);

  /* ── Per-symbol comparative stats ── */
  const symbolStats = useMemo(() => {
    const bySymbol = new Map<
      string,
      { trades: number; wins: number; pnl: number; pips: number }
    >();
    for (const t of filteredTrades) {
      const s = bySymbol.get(t.symbol) ?? { trades: 0, wins: 0, pnl: 0, pips: 0 };
      s.trades += 1;
      if (t.pnl > 0) s.wins += 1;
      s.pnl += t.pnl;
      s.pips += t.pips;
      bySymbol.set(t.symbol, s);
    }
    const detBySymbol = new Map<string, Record<TerraPatternKind, number>>();
    for (const e of filteredEvents) {
      const d = detBySymbol.get(e.symbol) ?? { copy: 0, inverse: 0, weekend: 0 };
      d[e.kind] += 1;
      detBySymbol.set(e.symbol, d);
    }
    return [...bySymbol.entries()]
      .map(([sym, s]) => ({
        sym,
        ...s,
        winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
        detections: detBySymbol.get(sym) ?? { copy: 0, inverse: 0, weekend: 0 },
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades, filteredEvents]);

  const maxAbsPnl = useMemo(
    () => Math.max(1, ...symbolStats.map((s) => Math.abs(s.pnl))),
    [symbolStats],
  );

  const filterSelectCls =
    "rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-semibold outline-none focus:border-primary";

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Pattern Monitor"
        description="Trading patterns watched across your linked accounts — with the reason behind each rule."
        actions={
          <TerraBadge tone={filteredEvents.length > 0 ? "tertiary" : "success"} dot pulse={filteredEvents.length > 0}>
            {filteredEvents.length > 0 ? `${filteredEvents.length} to review` : "No detections"}
          </TerraBadge>
        }
      />

      {/* ── Global filters (audit #2) ── */}
      <TerraCard>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Time period
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              className={filterSelectCls}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Instrument
            </span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className={filterSelectCls}
            >
              <option value="all">All symbols</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Outcome
            </span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutcomeKey)}
              className={filterSelectCls}
            >
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 pb-0.5">
            <span className="text-xs tabular-nums text-on-surface-variant">
              {filteredTrades.length} of {terraTrades.length} trades
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="pt-3 text-xs text-on-surface-variant">
          Windows anchor to your most recent closed trade
          ({fmtWhen(terraTrades.reduce((a, b) => (+new Date(a.closedAt) > +new Date(b.closedAt) ? a : b)).closedAt)}),
          so the same history always falls in the same bucket.
        </p>
      </TerraCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <TerraCard>
          <TerraStat
            label="Copy entries"
            value={String(counts.copy)}
            sub="mirrored across accounts"
            tone={counts.copy > 0 ? "negative" : undefined}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Inverse pairs"
            value={String(counts.inverse)}
            sub="opposing legs linked"
            tone={counts.inverse > 0 ? "negative" : undefined}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Weekend entries"
            value={String(counts.weekend)}
            sub="outside market hours"
            tone={counts.weekend > 0 ? "negative" : undefined}
          />
        </TerraCard>
      </div>

      {/* ── Activity heatmap (audit #2) ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Activity heatmap"
          description="Trades by instrument and weekday (UTC entry day) — spot concentration, quiet sessions and weekday bias."
          actions={
            <div className="flex gap-1 rounded-full bg-surface-container-low p-1" role="group" aria-label="Heatmap metric">
              {(["trades", "pnl"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={heatMetric === m}
                  onClick={() => setHeatMetric(m)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    heatMetric === m
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {m === "trades" ? "Trades" : "Net P&L"}
                </button>
              ))}
            </div>
          }
        />
        {heatmap.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `8rem repeat(7, minmax(0, 1fr))` }}
                >
                  <span className="sr-only">Instrument</span>
                  {WEEKDAYS.map((d) => (
                    <span
                      key={d}
                      className="text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                    >
                      {d}
                    </span>
                  ))}
                  {heatmap.map((row) => (
                    <div key={row.sym} className="contents">
                      <span className="flex items-center truncate pr-2 text-sm font-semibold text-on-surface">
                        {row.sym}
                      </span>
                      {row.cells.map((c, i) => {
                        const raw = heatMetric === "trades" ? c.count : c.pnl;
                        const mag = heatMetric === "trades" ? c.count : Math.abs(c.pnl);
                        const ratio = mag / heatMax;
                        const bucket = mag === 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
                        const negative = heatMetric === "pnl" && c.pnl < 0;
                        const text = negative ? HEAT_TEXT_NEG[bucket] : HEAT_TEXT[bucket];
                        const bg = raw === 0
                          ? "bg-surface-container-low"
                          : negative
                            ? HEAT_NEG[bucket]
                            : HEAT_POS[bucket];
                        const title =
                          heatMetric === "trades"
                            ? `${row.sym} · ${WEEKDAYS[i]}: ${c.count} trade${c.count === 1 ? "" : "s"}, ${formatSignedMoney(c.pnl)}`
                            : `${row.sym} · ${WEEKDAYS[i]}: ${formatSignedMoney(c.pnl)} across ${c.count} trade${c.count === 1 ? "" : "s"}`;
                        return (
                          <div
                            key={i}
                            className={`${cellBase} ${bg} ${text}`}
                            title={title}
                            aria-label={title}
                          >
                            {heatMetric === "trades" ? (c.count || "·") : (c.pnl === 0 ? "·" : formatSignedMoney(c.pnl))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-4 text-[11px] text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {heatMetric === "trades"
                  ? "Shade = trade count (darker = more entries)"
                  : "Green = net gain, red = net loss; shade = magnitude"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {heatMetric === "trades" ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/15" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/35" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/60" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/85" aria-hidden="true" />
                    <span className="ml-1">
                      1 → {heatMax} trades
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-sm bg-error/60" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-surface-container-high" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/60" aria-hidden="true" />
                    <span className="ml-1">±{formatMoney(heatMax)}</span>
                  </>
                )}
              </span>
            </div>
            {/* The heatmap is visual — mirror it for screen readers. */}
            <table className="sr-only">
              <caption>
                Activity by instrument and weekday, {heatMetric === "trades" ? "trade count" : "net P&L"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.sym}>
                    <th scope="row">{row.sym}</th>
                    {row.cells.map((c, i) => (
                      <td key={i}>
                        {heatMetric === "trades"
                          ? `${c.count} trades, ${formatSignedMoney(c.pnl)}`
                          : formatSignedMoney(c.pnl)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <TerraEmpty
            icon={<Grid3x3 className="h-6 w-6" aria-hidden="true" />}
            title="No activity in this window"
            description="No closed trades match the current period, instrument and outcome filters. Widen the filters to see the heatmap."
          />
        )}
      </TerraCard>

      {/* ── Per-symbol comparison (audit #2) ── */}
      <TerraCard>
        <TerraSectionTitle
          title="Instrument comparison"
          description="Every symbol under the current filters, ranked by net P&L, with its pattern detections."
        />
        {symbolStats.length > 0 ? (
          <TerraTable
            head={["Symbol", "Trades", "Win rate", "Net P&L", "Pips", "Detections"]}
            rows={symbolStats.map((s) => (
              [
                <span key="sym" className="font-semibold">{s.sym}</span>,
                <span key="n" className="tabular-nums">{s.trades}</span>,
                <span key="w" className="flex items-center gap-2">
                  <span className="w-10 shrink-0 tabular-nums">{s.winRate.toFixed(0)}%</span>
                  <span className="min-w-16 flex-1">
                    <TerraProgress
                      value={s.winRate}
                      height="h-1.5"
                      barClassName={s.winRate >= 50 ? "bg-primary" : "bg-tertiary"}
                    />
                  </span>
                </span>,
                <span key="p" className="flex items-center gap-2">
                  <span
                    className={`w-20 shrink-0 tabular-nums ${s.pnl >= 0 ? "text-primary" : "text-error"}`}
                  >
                    {formatSignedMoney(s.pnl)}
                  </span>
                  <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <span
                      className={`block h-full rounded-full ${s.pnl >= 0 ? "bg-primary" : "bg-error"}`}
                      style={{ width: `${Math.max(3, (Math.abs(s.pnl) / maxAbsPnl) * 100)}%` }}
                    />
                  </span>
                </span>,
                <span key="pip" className="tabular-nums text-on-surface-variant">
                  {s.pips > 0 ? "+" : ""}{s.pips}
                </span>,
                <span key="d" className="flex flex-wrap gap-1">
                  {(Object.keys(s.detections) as TerraPatternKind[])
                    .filter((k) => s.detections[k] > 0)
                    .map((k) => (
                      <TerraBadge key={k} tone={kindMeta[k].tone}>
                        {kindMeta[k].label} ×{s.detections[k]}
                      </TerraBadge>
                    ))}
                  {s.detections.copy + s.detections.inverse + s.detections.weekend === 0 && (
                    <span className="text-xs text-on-surface-variant">—</span>
                  )}
                </span>,
              ]
            ))}
          />
        ) : (
          <TerraEmpty
            title="Nothing to compare"
            description="No closed trades match the current filters."
          />
        )}
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle
          title="Detections"
          description="Derived from your closed trades on every linked account — copy and inverse match entries within 4 hours; weekend matches entries while the market is closed."
        />
        <div className="flex flex-wrap gap-2 pb-4" role="group" aria-label="Filter detections by pattern">
          {kindFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={kindFilter === f.id}
              onClick={() => setKindFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                kindFilter === f.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-normal opacity-75">
                {f.id === "all" ? filteredEvents.length : counts[f.id]}
              </span>
            </button>
          ))}
        </div>

        {visible.length > 0 ? (
          <TerraTable
            head={["Detected", "Pattern", "Symbol", "What matched", "Trades"]}
            rows={visible.map((e) => {
              const meta = kindMeta[e.kind];
              return [
                <span key="when" className="whitespace-nowrap tabular-nums text-on-surface-variant">
                  {fmtWhen(e.detectedAt)}
                </span>,
                <span key="kind" className="inline-flex items-center gap-1.5">
                  <TerraBadge tone={meta.tone}>{meta.label}</TerraBadge>
                </span>,
                <span key="sym" className="font-semibold">{e.symbol}</span>,
                <span key="detail" className="text-on-surface-variant">{detailOf(e)}</span>,
                <span key="tix" className="whitespace-nowrap tabular-nums text-xs text-on-surface-variant">
                  #{e.tickets.join(" / #")}
                </span>,
              ];
            })}
          />
        ) : (
          <TerraEmpty
            title="Nothing matched this filter"
            description="No detections of this type in the selected window. Switch filters to see the other patterns."
          />
        )}

        <p className="flex items-start gap-2 pt-4 text-xs text-on-surface-variant">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            A detection is a prompt to review, not an automatic violation — matched trades are
            shown so you can confirm the intent. See the{" "}
            <Link href="/rules" className="font-semibold text-primary underline-offset-2 hover:underline">
              program rules
            </Link>{" "}
            for the exact thresholds on your account.
          </span>
        </p>
      </TerraCard>

      <div className="space-y-4">
        <TerraSectionTitle
          title="Why these patterns are monitored"
          description="What each rule looks for, why the program has it, and the change that keeps you clear of it."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {patternGuides.map((guide) => {
            const meta = kindMeta[guide.kind];
            const Icon = meta.icon;
            return (
              <TerraCard key={guide.kind} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      guide.kind === "weekend"
                        ? "bg-error-container text-on-error-container"
                        : "bg-primary-fixed text-on-primary-fixed-variant"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-headline font-bold text-on-surface">{guide.title}</h3>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      What we watch for
                    </dt>
                    <dd className="mt-1 text-on-surface">{guide.watch}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Why the rule exists
                    </dt>
                    <dd className="mt-1 text-on-surface-variant">{guide.why}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      How to adjust
                    </dt>
                    <dd className="mt-1 space-y-1.5 text-on-surface-variant">
                      {guide.adjust.map((step) => (
                        <p key={step} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{step}</span>
                        </p>
                      ))}
                    </dd>
                  </div>
                </dl>
              </TerraCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
