"use client";

/**
 * Trade Replay — converted from stitch_screens/trade_replay
 * Replay of a closed trade with step timeline and price path.
 */

import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

const timeline = [
  { step: "Open", time: "08:12", note: "Entry filled at 1.08500", tone: "primary" as const },
  { step: "Add", time: "09:04", note: "Added 0.5 lots on pullback to H1 EMA", tone: "primary" as const },
  { step: "SL adjust", time: "10:22", note: "Stop moved to breakeven", tone: "secondary" as const },
  { step: "Partial close", time: "11:37", note: "Closed 50% at TP1 (+14 pips)", tone: "primary" as const },
  { step: "Close", time: "13:15", note: "Remainder closed at structure target", tone: "primary" as const },
];

export function TradeReplayPage() {
  const params = useSearchParams();
  const trade = terraTrades.find((t) => t.id === params.get("id")) ?? terraTrades[1];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Trade Replay — #${trade.ticket}`}
        description={`${trade.symbol} • ${trade.side === "long" ? "Long" : "Short"} • ${trade.lots.toFixed(2)} lots`}
        actions={
          <TerraBadge tone={trade.pnl >= 0 ? "success" : "error"}>
            {formatSignedMoney(trade.pnl)}
          </TerraBadge>
        }
      />

      <TerraCard>
        <TerraSectionTitle
          title="Price path"
          description={`${trade.entry} → ${trade.exit} • ${trade.pips >= 0 ? "+" : ""}${trade.pips} pips`}
          actions={
            <div className="flex gap-2">
              <button type="button" className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container">
                ⏮
              </button>
              <button type="button" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary">
                ▶ Play
              </button>
              <button type="button" className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container">
                ⏭
              </button>
            </div>
          }
        />
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 text-sm text-on-surface-variant">
          Session replay chart — {trade.symbol} ({trade.entry} → {trade.exit})
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Execution timeline" />
        <TerraTable
          head={["Step", "Time", "Note"]}
          rows={timeline.map((t) => [
            <TerraBadge key="s" tone={t.tone}>
              {t.step}
            </TerraBadge>,
            <span key="t" className="font-mono text-xs">
              {t.time}
            </span>,
            <span key="n" className="text-on-surface-variant">
              {t.note}
            </span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
