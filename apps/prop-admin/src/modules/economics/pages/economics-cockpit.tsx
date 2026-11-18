"use client";

import Link from "next/link";
import { PageHeader, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { calculateCohortMetrics, mockCohortData, CohortEconomicsRow } from "@/lib/economics-store";

export function EconomicsCockpit() {
  const cohorts = mockCohortData;
  const current = cohorts[0];
  const currentMetrics = calculateCohortMetrics(current);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cohort Economics Cockpit"
        description="Business numbers every prop-firm plan is built on: pass rate × payout ratio × CAC/LTV"
      />

      {/* Funnel overview */}
      <MetricCard label="Pass Rate" value={currentMetrics.passRate} />
      <MetricCard label="Payout Ratio" value={currentMetrics.payoutRatio} />
      <MetricCard label="Total Revenue" value={currentMetrics.totalRevenue} />
      <MetricCard label="Total Payouts" value={currentMetrics.totalPayouts} />

      {/* Scenario sliders */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="space-y-4">
          <p className="text-sm font-medium">Pass Rate +3pp Scenario</p>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">Original: {currentMetrics.passRate}%</p>
            <p className="text-lg font-medium">+3pp → {(currentMetrics.passRate + 3).toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Net effect on payout ratio: 
              {(currentMetrics.payoutRatio + 3).toFixed(1)}%</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium">Payout Ratio +5pp Scenario</p>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">Original: {currentMetrics.payoutRatio}%</p>
            <p className="text-lg font-medium">+5pp → {(currentMetrics.payoutRatio + 5).toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Net effect on profit: increases margin</p>
          </div>
        </div>
      </div>

      {/* Cohort table */}
      <DataTable
        columns={[
          {
            key: "cohortId",
            header: "Cohort",
            cell: (row: CohortEconomicsRow) => (
              <Link href={`/prop-admin/economics/${row.cohortId}`}>
                {row.cohortId}
              </Link>
            ),
            width: "w-32",
          },
          {
            key: "program",
            header: "Program",
            cell: (row: CohortEconomicsRow) => row.program,
            width: "w-48",
          },
          {
            key: "sold",
            header: "Sold",
            cell: (row: CohortEconomicsRow) => row.sold,
            width: "w-32",
          },
          {
            key: "passed",
            header: "Passed",
            cell: (row: CohortEconomicsRow) => row.passed,
            width: "w-32",
          },
          {
            key: "passRate",
            header: "Pass Rate",
            cell: (row: CohortEconomicsRow) => `${calculateCohortMetrics(row).passRate.toFixed(1)}%`,
            width: "w-32",
          },
          {
            key: "payoutRatio",
            header: "Payout Ratio",
            cell: (row: CohortEconomicsRow) => `${calculateCohortMetrics(row).payoutRatio.toFixed(1)}%`,
            width: "w-32",
          },
          {
            key: "cacLtv",
            header: "CAC/LTV",
            cell: (row: CohortEconomicsRow) => `${(calculateCohortMetrics(row).cacLtv ?? 0).toFixed(1)}×`,
            width: "w-32",
          },
        ]}
        data={cohorts}
        searchableText={(row) => row.cohortId}
        pageSize={10}
        rowKey={(row) => row.cohortId}
      />

      {/* Live indicators */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Active Cohorts</p>
            <p className="text-2xl font-bold">{cohorts.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Fee Revenue</p>
            <p className="text-2xl font-medium">{cohorts.reduce((sum, c) => sum + c.feeRevenue, 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Payouted</p>
            <p className="text-2xl font-bold">{cohorts.reduce((sum, c) => sum + c.paidOut, 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}