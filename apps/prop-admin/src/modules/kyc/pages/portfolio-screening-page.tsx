"use client";

/**
 * R10-D1 — Portfolio Screening (operator-facing).
 *
 * Operator view over `portfolio-screening-store`:
 *   • Screening schedule (frequency, auto-screen on KYC submit).
 *   • Per-trader screening status (clear / potential / confirmed / not-screened).
 *   • KYC document expiry alerts (expired / expiring-soon / critical).
 *   • Portfolio rescreening job log (before/after counts).
 *
 * Registered in the compliance / kyc manifest + view-router; reachable via
 * direct link.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  acknowledgeExpiryAlert,
  getExpiryAlerts,
  getRescreeningJobs,
  getScreeningStats,
  getTraderScreeningStatus,
  triggerRescreening,
  usePortfolioScreeningVersion,
  getScreeningSchedule,
} from "@/lib/portfolio-screening-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function PortfolioScreeningPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  usePortfolioScreeningVersion(); // re-render on any mutation

  const schedule = useMemo(() => getScreeningSchedule(), []);
  const stats = getScreeningStats();

  const expiryAlerts = useMemo(() => getExpiryAlerts(), []);
  const jobs = useMemo(() => getRescreeningJobs({ status: "completed" }), []);

  const statusRows = useMemo(
    () => Object.values(stats).length > 0 ? Object.values(stats) : [],
    [],
  );

  return (
    <Page>
      <PageHeader
        title="Portfolio Screening"
        description="Portfolio-wide screening job schedule, KYC document expiry alerts, per-trader screening status, and the automatic rescreening pipeline (event-driven via `kyc.submitted` / `trader.reactivated` and scheduled every N days via the 60s interval)."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Total Traders" value={stats.totalTraders} />
          <MetricCard label="Clear" value={stats.clearTraders} />
          <MetricCard label="Potential Matches" value={stats.potentialMatches} />
          <MetricCard label="Confirmed Matches" value={stats.confirmedMatches} />
          <MetricCard label="Not Screened" value={stats.notScreened} />
          <MetricCard label="KYC Expiring Soon" value={stats.kycExpiringSoon} />
          <MetricCard label="KYC Expired" value={stats.kycExpired} />
          <MetricCard label="Open Alerts" value={stats.openAlerts} />
          <MetricCard label="Completed Jobs" value={stats.completedJobs} />
        </div>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Screening Schedule</h2>
          <DataTable
            columns={[
              { key: "enabled", header: "Enabled", cell: (s) => <span>{String(s.enabled)}</span> },
              { key: "frequencyDays", header: "Frequency (days)", cell: (s) => <span>{String(s.frequencyDays)}</span> },
              {
                key: "nextRunAt",
                header: "Next Run",
                cell: (s) => <span>{s.nextRunAt ?? "—"}</span>,
              },
            ]}
            data={[schedule]}
            rowKey={() => "schedule"}
            pageSize={4}
          />
        </section>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">KYC Expiry Alerts</h2>
          <DataTable
            columns={[
              { key: "documentType", header: "Type", cell: (a) => <span>{a.documentType}</span> },
              { key: "traderName", header: "Trader", cell: (a) => <span>{a.traderName}</span> },
              { key: "status", header: "Status", cell: (a) => <span>{a.status}</span> },
              { key: "daysUntilExpiry", header: "Days Left", cell: (a) => <span>{String(a.daysUntilExpiry)}</span> },
            ]}
            data={expiryAlerts}
            rowKey={(a) => a.id}
            pageSize={8}
          />
        </section>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Rescreening Job Log</h2>
          <DataTable
            columns={[
              { key: "trigger", header: "Trigger", cell: (j) => <span>{j.trigger}</span> },
              { key: "status", header: "Status", cell: (j) => <span>{j.status}</span> },
              { key: "scannedTraders", header: "Scanned", cell: (j) => <span>{String(j.scannedTraders)}</span> },
              { key: "cleared", header: "Cleared", cell: (j) => <span>{String(j.clearedMatches)}</span> },
            ]}
            data={jobs}
            rowKey={(j) => j.id}
            pageSize={8}
          />
        </section>
      </PageContent>
    </Page>
  );
}