"use client";

/**
 * Position Detail — live open-position detail content.
 *
 * Distinct from TradeDetailContent (closed trades): this looks up the
 * live position list from the TradingContext, so clicking a symbol on
 * /trading-positions opens THAT position — not the first closed trade —
 * and the management actions (modify SL/TP, break-even, partial or full
 * close) act on the real session state.
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraSectionTitle,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";
import { useTrading } from "@/lib/trading/trading-context";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const levelInput =
  "rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary";

export function PositionDetailContent({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const { positions, modifyPosition, setBreakEven, closePosition } = useTrading();
  const pos = positions.find((p) => p.id === id);
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  if (!pos) return null;

  const account = terraAccounts.find((a) => a.id === pos.accountId);
  const netPnl = pos.pnl + pos.swap + pos.commission;
  const distance = (level: number | null) =>
    level === null ? null : Math.round((level - pos.entry) * 1000) / 1000;

  const applyModify = () => {
    modifyPosition(pos.id, {
      sl: sl === "" ? undefined : Number(sl),
      tp: tp === "" ? undefined : Number(tp),
    });
    setSl("");
    setTp("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <TerraBadge tone={pos.side === "long" ? "primary" : "error"}>
          {pos.side === "long" ? "Long" : "Short"}
        </TerraBadge>
        <TerraBadge tone={netPnl >= 0 ? "success" : "error"}>
          {formatSignedMoney(netPnl)} net
        </TerraBadge>
        <span className="text-xs text-on-surface-variant">
          Floating {formatSignedMoney(pos.pnl)} • swap {formatSignedMoney(pos.swap)} •
          commission {formatSignedMoney(pos.commission)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ["Ticket", `#${pos.id.replace("pos-", "").toUpperCase()}`],
          ["Symbol", pos.symbol],
          ["Volume", `${pos.lots.toFixed(2)} lots`],
          ["Entry Price", String(pos.entry)],
          ["Current Price", String(pos.current)],
          ["Stop Loss", pos.sl === null ? "—" : `${pos.sl} (${distance(pos.sl) ?? ""})`],
          ["Take Profit", pos.tp === null ? "—" : `${pos.tp} (${distance(pos.tp) ?? ""})`],
          ["Opened", fmt(pos.openedAt)],
          ["Account", account ? `#${account.login}` : pos.accountId],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-container-low p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {k}
            </span>
            <span className="text-sm font-bold text-on-surface">{v}</span>
          </div>
        ))}
      </div>

      {/* Position management — acts on the live session state */}
      <TerraCard>
        <TerraSectionTitle
          title="Manage position"
          description="Modify levels or close — actions apply immediately to the live session."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              New SL
            </span>
            <input
              value={sl}
              onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={pos.sl === null ? "Optional" : String(pos.sl)}
              className={levelInput}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              New TP
            </span>
            <input
              value={tp}
              onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={pos.tp === null ? "Optional" : String(pos.tp)}
              className={levelInput}
            />
          </label>
          <button
            type="button"
            onClick={applyModify}
            className="mt-auto rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Modify
          </button>
          <button
            type="button"
            onClick={() => setBreakEven(pos.id)}
            className="mt-auto rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            Break-even
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => closePosition(pos.id, 0.5)}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low"
          >
            Close 50%
          </button>
          <button
            type="button"
            onClick={() => closePosition(pos.id, 1)}
            className="rounded-xl bg-error px-4 py-2 text-sm font-bold text-on-error hover:bg-error/90"
          >
            Close position
          </button>
          {embedded && (
            <a
              href={`/trade-history?symbol=${pos.symbol}`}
              className="ml-auto rounded-xl px-3 py-2 text-xs font-bold text-primary hover:underline"
            >
              View similar trades →
            </a>
          )}
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle
          title="Position P&L"
          description="Gross floating P&L plus swap and commission = net."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Gross", pos.pnl],
            ["Swap", pos.swap],
            ["Commission", pos.commission],
            ["Net", netPnl],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-surface-container-low p-3 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {String(k)}
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  (v as number) >= 0 ? "text-primary" : "text-error"
                }`}
              >
                {formatSignedMoney(v as number)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-secondary-fixed/60 p-3 text-xs text-on-secondary-fixed-variant">
          Risk note: SL {pos.sl ?? "not set"} • TP {pos.tp ?? "not set"} — position stays open
          until closed manually or a level is hit.
        </p>
      </TerraCard>
    </div>
  );
}
