"use client";

/**
 * R10-B2 — Pre-Trade Restrictions (operator-facing).
 *
 * Operator view over `pre-trade-restriction-store`:
 *   • News windows, trading hours, symbol allow/deny, leverage tiers,
 *     holiday calendar.
 *   • Trade validation gate (`validateTrade`) — the trade-time check.
 *   • Enforcement log of blocked trades (`trade.blocked` lifecycle).
 *
 * Registered in the risk manifest + view-router; reachable via direct link.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  addHoliday,
  addNewsWindow,
  addSymbolRestriction,
  getHolidayCalendar,
  getLeverageTiers,
  getNewsWindows,
  getPreTradeStats,
  getSymbolRestrictions,
  getTradingHours,
  usePreTradeVersion,
} from "@/lib/pre-trade-restriction-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function PreTradeRestrictionsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  usePreTradeVersion(); // re-render on any mutation

  const newsWindows = getNewsWindows();
  const tradingHours = getTradingHours();
  const symbolRestrictions = getSymbolRestrictions();
  const leverageTiers = getLeverageTiers();
  const holidays = getHolidayCalendar();
  const stats = getPreTradeStats();

  return (
    <Page>
      <PageHeader
        title="Pre-Trade Restrictions"
        description="Trade-time enforcement gate (validateTrade) with news windows, weekend/holiday rules, symbol allow/deny lists, leverage tiers, and trading hours. Blocked trades emit trade.blocked lifecycle events."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="News Windows" value={stats.activeNewsWindows} />
          <MetricCard label="Symbol Restrictions" value={stats.activeSymbolRestrictions} />
          <MetricCard label="Leverage Tiers" value={stats.activeLeverageTiers} />
          <MetricCard label="Holidays" value={stats.holidays} />
          <MetricCard label="Blocked Trades" value={stats.totalBlockedTrades} />
        </div>

        <div className="space-y-4">
          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">News Windows</h2>
            <DataTable
              columns={[
                { key: "name", header: "Name", cell: (n) => <span>{n.name}</span> },
                { key: "symbol", header: "Symbol", cell: (n) => <span>{n.symbol}</span> },
                { key: "severity", header: "Severity", cell: (n) => <span>{n.severity}</span> },
                { key: "enabled", header: "Enabled", cell: (n) => <span>{String(n.enabled)}</span> },
              ]}
              data={newsWindows}
              rowKey={(n) => n.id}
              pageSize={8}
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Symbol Restrictions</h2>
            <DataTable
              columns={[
                { key: "name", header: "Name", cell: (s) => <span>{s.name}</span> },
                { key: "action", header: "Action", cell: (s) => <span>{s.action}</span> },
                { key: "symbols", header: "Symbols", cell: (s) => <span>{s.symbols}</span> },
                { key: "enabled", header: "Enabled", cell: (s) => <span>{String(s.enabled)}</span> },
              ]}
              data={symbolRestrictions}
              rowKey={(s) => s.id}
              pageSize={8}
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Leverage Tiers</h2>
            <DataTable
              columns={[
                { key: "name", header: "Name", cell: (l) => <span>{l.name}</span> },
                { key: "maxLeverage", header: "Max Leverage", cell: (l) => <span>1:{l.maxLeverage}</span> },
                { key: "phases", header: "Phases", cell: (l) => <span>{l.appliesToPhases.join(", ")}</span> },
              ]}
              data={leverageTiers}
              rowKey={(l) => l.id}
              pageSize={8}
            />
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Holiday Calendar</h2>
            <DataTable
              columns={[
                { key: "name", header: "Name", cell: (h) => <span>{h.name}</span> },
                { key: "date", header: "Date", cell: (h) => <span>{h.date}</span> },
                { key: "region", header: "Region", cell: (h) => <span>{h.region}</span> },
              ]}
              data={holidays}
              rowKey={(h) => h.id}
              pageSize={8}
            />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}