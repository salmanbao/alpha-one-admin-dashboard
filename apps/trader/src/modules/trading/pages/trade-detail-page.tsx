"use client";

/**
 * Trade Detail — converted from stitch_screens/trade_detail
 * Single trade summary with execution details and timeline.
 *
 * Split into `TradeDetailContent({ id, embedded })` so it renders both
 * as the route (`/trade-detail?id=`) and inside the quick-view dialog
 * on Trade History / Open Positions (`embedded` hides page chrome —
 * the dialog header and footer provide navigation instead).
 * Replay opens in a new tab: session replay is a heavy, parallel task.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

export function TradeDetailContent({
  id,
  embedded = false,
}: {
  id: string | null;
  /** true when rendered inside the quick-view dialog (page chrome hidden). */
  embedded?: boolean;
}) {
  const trade =
    terraTrades.find((t) => t.id === id) ?? terraTrades[0];
  const fmt = (d: string) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const actions = (
    <>
      <TerraBadge tone={trade.side === "long" ? "primary" : "error"}>
        {trade.side === "long" ? "Long" : "Short"}
      </TerraBadge>
      <TerraBadge tone={trade.pnl >= 0 ? "success" : "error"}>
        {formatSignedMoney(trade.pnl)}
      </TerraBadge>
      <Link
        href={`/trade-replay?id=${trade.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
      >
        Replay trade ↗
      </Link>
    </>
  );

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : (
        <TerraPageHeader
          title={`Trade #${trade.ticket}`}
          description={`${trade.symbol} • ${trade.side === "long" ? "Long" : "Short"} • ${trade.lots.toFixed(2)} lots`}
          actions={actions}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Execution details" />
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ["Symbol", trade.symbol],
                ["Side", trade.side === "long" ? "Buy" : "Sell"],
                ["Volume", `${trade.lots.toFixed(2)} lots`],
                ["Entry Price", String(trade.entry)],
                ["Exit Price", String(trade.exit)],
                ["Pips", `${trade.pips >= 0 ? "+" : ""}${trade.pips}`],
                ["Opened", fmt(trade.openedAt)],
                ["Closed", fmt(trade.closedAt)],
                ["Account", `#${trade.accountId.replace("acc-", "")}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-container-low p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {k}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{v}</span>
                </div>
              ))}
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Price movement" description="Entry → exit path on the session chart" />
            <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 text-sm text-on-surface-variant">
              Session chart — {trade.symbol} {trade.entry} → {trade.exit}
            </div>
          </TerraCard>
        </div>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Result" />
            <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-low p-6 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Net P&amp;L
              </span>
              <span
                className={`font-headline text-3xl font-bold tabular-nums ${
                  trade.pnl >= 0 ? "text-primary" : "text-error"
                }`}
              >
                {formatSignedMoney(trade.pnl)}
              </span>
              <span className="text-xs text-on-surface-variant">
                incl. swap &amp; commission
              </span>
            </div>
            {trade.comment && (
              <p className="mt-3 rounded-xl bg-secondary-fixed/60 p-3 text-xs text-on-secondary-fixed-variant">
                “{trade.comment}”
              </p>
            )}
          </TerraCard>
          {!embedded && (
            <Link
              href="/trade-history"
              className="block rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              ← Back to Trade History
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function TradeDetailPage() {
  const params = useSearchParams();
  return <TradeDetailContent id={params.get("id")} />;
}
