"use client";

/**
 * Open Positions — converted from stitch_screens/open_positions
 * Live positions table grouped with a summary strip.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraPositions } from "@/lib/fixtures/terra-fixtures";

export function OpenPositionsPage() {
  const totalPnl = terraPositions.reduce((s, p) => s + p.pnl, 0);
  const lots = terraPositions.reduce((s, p) => s + p.lots, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Open Positions"
        description="Live positions across all your accounts"
        actions={
          <Link
            href="/order-ticket"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Order
          </Link>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Open Positions" value={terraPositions.length} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Unrealized P&L"
            value={formatSignedMoney(totalPnl)}
            tone={totalPnl >= 0 ? "positive" : "negative"}
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Total Volume" value={`${lots.toFixed(2)} lots`} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Winning" value={terraPositions.filter((p) => p.pnl > 0).length} sub={`of ${terraPositions.length}`} />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraTable
          head={["Symbol", "Side", "Lots", "Entry", "Current", "SL", "TP", "P&L", "Account"]}
          rows={terraPositions.map((p) => [
            <Link key="s" href={`/trade-detail?id=${p.id}`} className="font-semibold text-primary hover:underline">
              {p.symbol}
            </Link>,
            <TerraBadge key="sd" tone={p.side === "long" ? "primary" : "error"}>
              {p.side === "long" ? "Long" : "Short"}
            </TerraBadge>,
            p.lots.toFixed(2),
            p.entry,
            p.current,
            p.sl ?? "—",
            p.tp ?? "—",
            <span key="p" className={`font-bold tabular-nums ${p.pnl >= 0 ? "text-primary" : "text-error"}`}>
              {formatSignedMoney(p.pnl)}
            </span>,
            <span key="a" className="font-mono text-xs text-on-surface-variant">
              #{terraPositions.find((t) => t.id === p.id)?.accountId.replace("acc-", "")}
            </span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
