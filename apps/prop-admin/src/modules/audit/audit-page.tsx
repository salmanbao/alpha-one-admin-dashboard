"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AuditLogTable } from "@/components/platform/audit";
import { getTenantAudit } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { ScrollText, Activity, ShieldAlert, ShieldQuestion, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditEntry } from "@/lib/platform/types";

export function AuditPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const entries = useMemo(() => getTenantAudit(tid), [tid]);

  // KPI row — derived from the unfiltered tenant-scoped audit stream so the
  // headline numbers stay stable regardless of the operator's current
  // filters inside the AuditLogTable.
  const totalEvents = entries.length;
  const critical = entries.filter((e) => e.severity === "critical").length;
  const warnings = entries.filter((e) => e.severity === "warning").length;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff).length;

  const handleExport = () => {
    exportToCsv<AuditEntry>(
      entries,
      [
        { key: "id", header: "ID", value: (e) => e.id },
        { key: "timestamp", header: "Timestamp", value: (e) => e.timestamp },
        { key: "actor", header: "Actor", value: (e) => e.actor },
        { key: "action", header: "Action", value: (e) => e.action },
        { key: "entity", header: "Entity", value: (e) => e.entity },
        { key: "entityId", header: "Entity ID", value: (e) => e.entityId ?? "" },
        { key: "severity", header: "Severity", value: (e) => e.severity },
        { key: "module", header: "Module", value: (e) => e.module ?? "" },
        { key: "summary", header: "Summary", value: (e) => e.summary },
      ],
      `audit-log-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Audit Log"
        description="Cross-module audit trail of admin and user actions."
        icon={ScrollText}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row — visual hierarchy per spec §41 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Events" value={totalEvents} icon={Activity} tone="default" />
          <MetricCard
            label="Critical"
            value={critical}
            icon={ShieldAlert}
            tone={critical > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Warnings"
            value={warnings}
            icon={ShieldQuestion}
            tone={warnings > 0 ? "warning" : "positive"}
          />
          <MetricCard label="Last 24h" value={last24h} icon={Clock} tone="default" />
        </div>

        {/* Existing AuditLogTable — all filters intact */}
        <AuditLogTable entries={entries} />
      </PageContent>
    </Page>
  );
}
