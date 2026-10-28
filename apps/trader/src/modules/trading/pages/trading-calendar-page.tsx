"use client";

/**
 * Trading Calendar — converted from stitch_screens/trading_calendar
 * Monthly trading activity grid with daily P&L heat map.
 *
 * P2 upgrades: the heat map is derived from real closed trades
 * (scoped to the active account or all accounts), clicking a day opens
 * a drawer with that day's trades, and each ISO week gets a summary
 * row under the grid.
 */

import { useMemo, useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades, type TerraTrade } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { DetailDialog } from "@/components/terra/detail-dialog";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isoDay = (t: TerraTrade) => t.closedAt.slice(0, 10);

/** ISO week number + Monday-based key for week buckets. */
function isoWeek(dateStr: string): { key: string; label: string } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+d - +yearStart) / 86_400_000 + 1) / 7);
  // Bucket start = the Monday of the original date's week.
  const orig = new Date(`${dateStr}T00:00:00Z`);
  const origDay = orig.getUTCDay() || 7;
  orig.setUTCDate(orig.getUTCDate() - (origDay - 1));
  const key = orig.toISOString().slice(0, 10);
  return {
    key,
    label: `Week ${week} · ${key.slice(5).replace("-", "/")}`,
  };
}

const fmtDay = (dayStr: string) =>
  new Date(`${dayStr}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function TradingCalendarPage() {
  const { activeAccount, activeAccountId } = useActiveAccount();
  const [monthOffset, setMonthOffset] = useState(0);
  const [scopeAll, setScopeAll] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();

  // Trades in the viewed month, scoped like the other trader screens.
  const monthTrades = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const pool = scopeAll
      ? terraTrades
      : terraTrades.filter((t) => t.accountId === activeAccountId);
    return pool.filter((t) => isoDay(t).startsWith(prefix));
  }, [year, month, scopeAll, activeAccountId]);

  // Day → closed P&L and trade list (single pass).
  const byDay = useMemo(() => {
    const map = new Map<string, TerraTrade[]>();
    for (const t of monthTrades) {
      const list = map.get(isoDay(t)) ?? [];
      list.push(t);
      map.set(isoDay(t), list);
    }
    return map;
  }, [monthTrades]);

  const dayPnl = (d: number | null) => {
    if (d === null) return null;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const trades = byDay.get(key);
    if (!trades || trades.length === 0) return null;
    return trades.reduce((s, t) => s + t.pnl, 0);
  };

  const cells = (() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  })();

  const tradingDays = cells.filter((d): d is number => d !== null && dayPnl(d) !== null);
  const total = tradingDays.reduce((s, d) => s + (dayPnl(d) ?? 0), 0);

  // Weekly summaries — bucket the month's trading days by ISO week.
  const weeks = useMemo(() => {
    const buckets = new Map<string, { label: string; pnl: number; days: number; trades: number }>();
    for (const [day, trades] of byDay) {
      const { key, label } = isoWeek(day);
      const b = buckets.get(key) ?? { label, pnl: 0, days: 0, trades: 0 };
      b.pnl += trades.reduce((s, t) => s + t.pnl, 0);
      b.days += 1;
      b.trades += trades.length;
      buckets.set(key, b);
    }
    return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [byDay]);

  const heat = (pnl: number | null) => {
    if (pnl === null) return "";
    if (pnl > 150) return "bg-primary text-on-primary";
    if (pnl > 0) return "bg-primary-fixed text-on-primary-fixed-variant";
    if (pnl < -50) return "bg-error-container text-on-error-container";
    return "bg-error/20 text-error";
  };

  const openDayTrades = openDay ? (byDay.get(openDay) ?? []) : [];
  const openDayPnl = openDayTrades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Calendar"
        description={
          scopeAll
            ? "Daily P&L across your accounts"
            : `Daily P&L on #${activeAccount.login} • ${activeAccount.name}`
        }
        actions={
          <div className="flex items-center rounded-xl bg-surface-container-low p-0.5" role="group" aria-label="Calendar scope">
            <button
              type="button"
              aria-pressed={!scopeAll}
              onClick={() => setScopeAll(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              This account
            </button>
            <button
              type="button"
              aria-pressed={scopeAll}
              onClick={() => setScopeAll(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              All accounts
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Month P&L" value={formatSignedMoney(total)} tone={total >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Trading Days" value={tradingDays.length} sub="of the month" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Green Days" value={tradingDays.filter((d) => (dayPnl(d) ?? 0) > 0).length} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Red Days" value={tradingDays.filter((d) => (dayPnl(d) ?? 0) < 0).length} />
        </TerraCard>
      </div>

      <TerraCard>
        <div className="flex items-center justify-between pb-4">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            ← Prev
          </button>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            className="rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekDays.map((w) => (
            <div key={w} className="pb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const pnl = dayPnl(d);
            const hasTrades = pnl !== null;
            return (
              <button
                key={i}
                type="button"
                disabled={!hasTrades}
                onClick={() =>
                  setOpenDay(
                    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                  )
                }
                aria-haspopup="dialog"
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-transform",
                  d === null && "pointer-events-none opacity-0",
                  d !== null && !hasTrades && "bg-surface-container-low text-on-surface-variant",
                  hasTrades && "hover:scale-105",
                  heat(pnl),
                )}
              >
                <span className="font-bold">{d}</span>
                {hasTrades && (
                  <span className="mt-0.5 hidden text-[9px] font-bold tabular-nums sm:block">
                    {(pnl ?? 0) >= 0 ? "+" : ""}
                    {pnl}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary" /> +150+</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-fixed" /> 0–150</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-error-container" /> losses</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-surface-container-low" /> no trades</span>
        </div>
      </TerraCard>

      {/* Weekly summaries */}
      <TerraCard>
        <TerraSectionTitle
          title="Weekly summaries"
          description="ISO-week buckets for the viewed month."
        />
        {weeks.length === 0 ? (
          <TerraEmpty
            title="No trading weeks this month"
            description="Closed trades in this month will roll up here by week."
          />
        ) : (
          <div className="space-y-2">
            {weeks.map((w) => (
              <div
                key={w.label}
                className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-bold text-on-surface">{w.label}</p>
                  <p className="text-xs text-on-surface-variant">
                    {w.days} trading day{w.days === 1 ? "" : "s"} • {w.trades} trade
                    {w.trades === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`font-bold tabular-nums ${w.pnl >= 0 ? "text-primary" : "text-error"}`}
                >
                  {formatSignedMoney(w.pnl)}
                </span>
              </div>
            ))}
          </div>
        )}
      </TerraCard>

      {/* Day drawer — that day's closed trades */}
      <DetailDialog
        open={openDay !== null}
        onOpenChange={(o) => {
          if (!o) setOpenDay(null);
        }}
        title={openDay ? fmtDay(openDay) : "Day detail"}
        description={
          openDay
            ? `${openDayTrades.length} closed trade${openDayTrades.length === 1 ? "" : "s"} • day P&L ${formatSignedMoney(openDayPnl)}`
            : undefined
        }
      >
        <div className="space-y-2">
          {openDayTrades.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm"
            >
              <div>
                <p className="font-bold text-on-surface">
                  {t.symbol}{" "}
                  <span
                    className={t.side === "long" ? "text-primary" : "text-error"}
                  >
                    {t.side === "long" ? "Long" : "Short"}
                  </span>
                </p>
                <p className="text-xs text-on-surface-variant">
                  #{t.ticket} • {t.lots.toFixed(2)} lots • {t.pips >= 0 ? "+" : ""}
                  {t.pips} pips
                </p>
              </div>
              <span
                className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}
              >
                {formatSignedMoney(t.pnl)}
              </span>
            </div>
          ))}
        </div>
      </DetailDialog>
    </div>
  );
}
