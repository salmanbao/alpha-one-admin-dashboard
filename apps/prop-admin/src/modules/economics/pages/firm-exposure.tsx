"use client";

import { PageHeader, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { ArrowUp, ArrowDown } from "lucide-react";

interface ExposureRow {
  symbol: string;
  netNotional: number;
  grossNotional: number;
  positionCount: number;
  direction: string;
}

export function FirmExposure() {
  const exposures: ExposureRow[] = [
    {
      symbol: "EURUSD",
      netNotional: 54375,
      grossNotional: 163125,
      positionCount: 2,
      direction: "neutral",
    },
    {
      symbol: "GBPUSD",
      netNotional: 63650,
      grossNotional: 140030,
      positionCount: 2,
      direction: "bullish",
    },
    {
      symbol: "USDJPY",
      netNotional: 74400,
      grossNotional: 74400,
      positionCount: 1,
      direction: "bullish",
    },
  ];

  const hedgedPairs = [
    {
      symbol: "EURUSD",
      sideA: "long",
      sideB: "short",
      sizeA: 10,
      sizeB: 5,
    },
    {
      symbol: "GBPUSD",
      sideA: "long",
      sideB: "short",
      sizeA: 8,
      sizeB: 3,
    },
  ];

  const totalGross = exposures.reduce((sum, e) => sum + e.grossNotional, 0);
  const totalNet = exposures.reduce((sum, e) => sum + e.netNotional, 0);
  const topConcentration = exposures
    .slice()
    .sort((a, b) => b.grossNotional - a.grossNotional)[0];

  const concentrationPercentage = topConcentration
    ? (topConcentration.grossNotional / Math.max(totalGross, 1)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firm Exposure Analysis"
        description="Aggregate exposure metrics, concentration gauges, and hedged pair analysis for firm risk management."
      />

      {/* Exposure Summary */}
      <MetricCard label="Total Gross Notional" value={totalGross} />
      <MetricCard label="Total Net Notional" value={totalNet} />
      <MetricCard label="Hedged Pairs" value={hedgedPairs.length} />

      {/* Symbol Exposure Table */}
      <DataTable
        columns={[
          {
            key: "symbol",
            header: "Symbol",
            cell: (row: ExposureRow) => row.symbol,
            width: "w-32",
          },
          {
            key: "netNotional",
            header: "Net Notional",
            cell: (row: ExposureRow) => row.netNotional.toLocaleString(),
            width: "w-48",
            numeric: true,
          },
          {
            key: "grossNotional",
            header: "Gross Notional",
            cell: (row: ExposureRow) => row.grossNotional.toLocaleString(),
            width: "w-48",
            numeric: true,
          },
          {
            key: "concentration",
            header: "Concentration",
            cell: (row: ExposureRow) => {
              const pct = (row.grossNotional / Math.max(totalGross, 1)) * 100;
              const isHigh = pct >= 70;
              return (
                <span className={isHigh ? "text-red-500" : "text-emerald-500"}>
                  {pct.toFixed(1)}%
                </span>
              );
            },
            width: "w-48",
          },
          {
            key: "direction",
            header: "Direction",
            cell: (row: ExposureRow) => (
              <span className={`flex items-center gap-1 ${row.direction === "bullish" ? "text-emerald-500" : row.direction === "bearish" ? "text-rose-500" : "text-muted-foreground"}`}>
                {row.direction === "bullish" ? <ArrowUp className="h-4 w-4" /> : row.direction === "bearish" ? <ArrowDown className="h-4 w-4" /> : "—"}
                {row.direction}
              </span>
            ),
            width: "w-32",
          },
        ]}
        data={exposures}
        searchableText={(row) => row.symbol}
        pageSize={10}
        rowKey={(row) => row.symbol}
      />

      {/* Hedged Pairs */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium mb-2">Hedged Pairs Detected</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {hedgedPairs.map((pair, index) => (
            <li key={index}>
              <span className="font-medium">{pair.symbol}</span>:{" "}
              {pair.sizeA} {pair.sideA} ↔ {pair.sizeB} {pair.sideB}
            </li>
          ))}
        </ul>
        {hedgedPairs.length === 0 && (
          <p className="text-sm text-muted-foreground">No hedged pairs detected.</p>
        )}
      </div>

      {/* Live Indicators */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Top Concentration</p>
            <p className="text-2xl font-bold">{topConcentration?.symbol || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Exposure</p>
            <p className="text-2xl font-bold">{totalNet}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Concentration %</p>
            <p className="text-2xl font-bold">{concentrationPercentage.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}