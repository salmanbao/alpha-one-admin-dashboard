"use client";

/**
 * Daily Highlights Page (spec §4 — Analytics as Investigation workspace)
 *
 * Answers: "What happened today, hour by hour, and where?"
 *
 * Layered:
 *   1. KPI strip (5 metrics) — daily revenue / payouts / net / avg order / latest hour
 *   2. Hourly charts (4 AreaSeries) — revenue, orders, payouts, orders-by-PSP
 *   3. Breakdown tables (6 small HTML tables) — countries, PSPs, platforms,
 *      coupons, account sizes, recent orders
 *
 * Per spec §25 ("Tables are operational workspaces"), the bottom tables are
 * small and focused. They use plain HTML <table> elements rather than the
 * heavier DataTable wrapper so we can present many compact tables without
 * duplicating search/pagination chrome on each one.
 *
 * Data: getDailyHighlights(tid) from @/lib/platform/mock-data.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getDailyHighlights } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HOURLY_CHART_COLORS = ["#059669", "#0f766e", "#d97706", "#7c3aed"];

export function DailyHighlightsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const h = getDailyHighlights(tid);
  const fmt = (v: number) => formatCurrency(v, currency);

  // Synthesize hourly orders attributed to the top PSP per hour.
  // We distribute the topPSPs share across the existing hourly orders using
  // a deterministic sine curve so the chart is stable across renders.
  const topPSPs = h.topPSPs;
  const totalPspOrders = topPSPs.reduce((s, p) => s + p.orders, 0) || 1;
  const hourlyOrdersByPSP = h.hourlyOrders.map((point, i) => {
    const psp = topPSPs[i % topPSPs.length];
    const share = psp.orders / totalPspOrders;
    return {
      hour: point.hour,
      value: Math.max(1, Math.round(point.value * share)),
    };
  });

  return (
    <Page>
      <PageHeader
        title="Daily Highlights (UTC)"
        description="Hourly revenue, payouts, and operational breakdowns for the selected UTC day."
        icon={TrendingUp}
        actions={
          <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Select date"
              className="bg-transparent text-xs font-medium outline-none"
            />
          </div>
        }
      />
      <PageContent>
        {/* 1. KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Daily Revenue" value={fmt(h.dailyRevenue)} delta={6} deltaLabel="vs yesterday" icon={DollarSign} tone="positive" />
          <MetricCard label="Daily Payouts" value={fmt(h.dailyPayouts)} delta={-2} deltaLabel="vs yesterday" icon={TrendingDown} tone="warning" />
          <MetricCard label="Daily Net Revenue" value={fmt(h.dailyNetRevenue)} delta={7} deltaLabel="vs yesterday" icon={TrendingUp} tone="positive" />
          <MetricCard label="Avg Order Value" value={fmt(h.avgOrderValue)} delta={3} deltaLabel="vs yesterday" icon={ShoppingCart} />
          <MetricCard label="Latest Hour Revenue" value={fmt(h.latestHourRevenue)} icon={Clock} tone="positive" />
        </div>

        {/* 2. Hourly charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Hourly Revenue" subtitle={`Total revenue per hour — ${currency}`}>
            <AreaSeries data={h.hourlyRevenue} xKey="hour" yKey="value" color={HOURLY_CHART_COLORS[0]} formatValue={(v) => fmt(v)} />
          </ChartCard>
          <ChartCard title="Hourly Orders" subtitle="Order count per hour">
            <AreaSeries data={h.hourlyOrders} xKey="hour" yKey="value" color={HOURLY_CHART_COLORS[1]} formatValue={(v) => String(v)} />
          </ChartCard>
          <ChartCard title="Hourly Payouts" subtitle={`Payout amount per hour — ${currency}`}>
            <AreaSeries data={h.hourlyPayouts} xKey="hour" yKey="value" color={HOURLY_CHART_COLORS[2]} formatValue={(v) => fmt(v)} />
          </ChartCard>
          <ChartCard title="Hourly Orders by PSP" subtitle="Top PSP share per hour">
            <AreaSeries data={hourlyOrdersByPSP} xKey="hour" yKey="value" color={HOURLY_CHART_COLORS[3]} formatValue={(v) => String(v)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topPSPs.map((p, i) => (
                <span key={p.psp} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: HOURLY_CHART_COLORS[i % HOURLY_CHART_COLORS.length] }} />
                  {p.psp}
                </span>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* 3. Breakdown tables — small HTML tables */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleTable title="Top Countries" headers={["Country", "Orders", "Revenue"]}>
            {h.topCountries.map((c) => (
              <tr key={c.country}>
                <td className="px-3 py-2 text-sm text-foreground">{c.country}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{c.orders}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{fmt(c.revenue)}</td>
              </tr>
            ))}
          </SimpleTable>

          <SimpleTable title="Top PSPs" headers={["PSP", "Orders", "Revenue"]}>
            {h.topPSPs.map((p) => (
              <tr key={p.psp}>
                <td className="px-3 py-2 text-sm text-foreground">{p.psp}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{p.orders}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{fmt(p.revenue)}</td>
              </tr>
            ))}
          </SimpleTable>

          <SimpleTable title="Top Platforms" headers={["Platform", "Accounts", "Share"]}>
            {h.topPlatforms.map((p) => (
              <tr key={p.platform}>
                <td className="px-3 py-2 text-sm text-foreground">{p.platform}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{p.accounts}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{p.pct}%</td>
              </tr>
            ))}
          </SimpleTable>

          <SimpleTable title="Top Coupons" headers={["Code", "Redemptions", "Savings"]}>
            {h.topCoupons.map((c) => (
              <tr key={c.code}>
                <td className="px-3 py-2 text-sm text-foreground">
                  <Badge variant="outline" className="text-[10px]">{c.code}</Badge>
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{c.redemptions}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-emerald-600">−{fmt(c.savings)}</td>
              </tr>
            ))}
          </SimpleTable>

          <SimpleTable title="Purchases by Account Size" headers={["Size", "Count", "Revenue"]}>
            {h.purchasesByAccountSize.map((p) => (
              <tr key={p.size}>
                <td className="px-3 py-2 text-sm text-foreground">{p.size}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{p.count}</td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">{fmt(p.revenue)}</td>
              </tr>
            ))}
          </SimpleTable>

          <SimpleTable title="Recent Orders" headers={["Order", "Customer", "Challenge", "Amount", "PSP", "Time"]}>
            {h.recentOrders.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 text-xs font-medium text-foreground">{o.id}</td>
                <td className="px-3 py-2 text-xs text-foreground">{o.customer}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{o.challenge}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{fmt(o.amount)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{o.psp}</td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">{o.time}</td>
              </tr>
            ))}
          </SimpleTable>
        </div>

        <p className="text-xs text-muted-foreground">
          All times are in UTC. Values shown for {date || "today"}.
        </p>
      </PageContent>
    </Page>
  );
}

/* ---------- Local helpers ---------- */

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({
  title,
  headers,
  children,
  className,
}: {
  title: string;
  headers: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="border-b px-3 py-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
