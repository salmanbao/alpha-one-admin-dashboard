"use client";

/**
 * Position Detail — live open-position detail content.
 *
 * Distinct from TradeDetailContent (closed trades): this looks up
 * `terraPositions`, so clicking a symbol on /trading-positions opens
 * THAT position — not the first closed trade. Renders inside the
 * quick-view dialog (`embedded` hides page chrome) and is reused by
 * the position-management actions added with the TradingContext.
 */

import {
  TerraBadge,
  TerraCard,
  TerraSectionTitle,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts, terraPositions } from "@/lib/fixtures/terra-fixtures";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function PositionDetailContent({ id }: { id: string }) {
  const pos = terraPositions.find((p) => p.id === id);
  if (!pos) return null;

  const account = terraAccounts.find((a) => a.id === pos.accountId);
  const netPnl = pos.pnl + pos.swap + pos.commission;
  const distance = (level: number | null) =>
    level === null ? null : Math.round((level - pos.entry) * 1000) / 1000;

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
