"use client";

/**
 * R10-B1 — Drawdown Model (operator-facing).
 *
 * Operator view over `drawdown-model-store`:
 *   • Configuration list: static vs trailing drawdown, timezone-aware daily
 *     reset, recalculation interval, watermark source (equity vs balance).
 *   • Per-account watermarks with current drawdown %, peak equity/balance.
 *
 * Registered in the risk manifest + view-router; reachable via direct link
 * (nav-children cap is at 150/150).
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  getDrawdownConfigs,
  getDrawdownStats,
  useDrawdownVersion,
} from "@/lib/drawdown-model-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function DrawdownModelPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useDrawdownVersion(); // re-render on any mutation

  const configs = getDrawdownConfigs();
  const stats = getDrawdownStats();

  return (
    <Page>
      <PageHeader
        title="Drawdown Model"
        description="Configurable static/trailing drawdown with timezone-aware daily loss reset. Watermarks driven from `trade.closed` payloads (accountLimits / accountBaseline) and a 60s timer for recalculation + daily-reset."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Configs" value={configs.length} />
          <MetricCard label="Enabled" value={configs.filter((c) => c.enabled).length} />
          <MetricCard label="Trailing" value={stats.trailingConfigs} />
          <MetricCard label="Static" value={stats.staticConfigs} />
          <MetricCard label="Watermarks" value={stats.totalWatermarks} />
          <MetricCard label="Avg DD %" value={stats.averageDrawdownPct.toFixed(1)} />
        </div>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Drawdown Configurations</h2>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                cell: (c) => <span>{c.name}</span>,
              },
              { key: "type", header: "Type", cell: (c) => <span>{c.drawdownType}</span> },
              { key: "max", header: "Max DD %", cell: (c) => <span className="text-xs">{c.maxDrawdownPct}%</span> },
              { key: "daily", header: "Daily %", cell: (c) => <span className="text-xs">{c.dailyDrawdownPct}%</span> },
              { key: "reset", header: "Reset", cell: (c) => <span>{c.resetMethod}</span> },
              { key: "zone", header: "Timezone", cell: (c) => <span>{c.resetTimezone}</span> },
            ]}
            data={configs}
            rowKey={(c) => c.id}
            pageSize={8}
          />
        </section>
      </PageContent>
    </Page>
  );
}
