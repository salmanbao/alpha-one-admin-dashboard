"use client";

/**
 * Platform Audit Log — cross-tenant audit trail (spec §6, §61).
 *
 * Super-admin only. Surfaces the entire `auditLog` (all tenants + the
 * platform-scoped stream) with a tenant filter, severity KPIs, free-text
 * search, and CSV export. Mirrors the per-tenant `AuditPage` pattern
 * (audit-page.tsx) but operates across every tenant in the platform.
 *
 * UX notes:
 *   - §22 Contextual Actions: the Export CSV action lives in the
 *     PageHeader next to the title (where the operator decides to export).
 *   - §24 Destructive Actions: read-only surface, so no AlertDialog
 *     friction is needed; the Export action is non-destructive.
 *   - §41 visual hierarchy: KPI row → filter bar → DataTable.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScrollText,
  Activity,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  Download,
  Building2,
} from "lucide-react";
import { getPlatformAudit, tenants } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import type { AuditEntry } from "@/lib/platform/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const severityTone = (sev: string): "danger" | "warning" | "info" =>
  sev === "critical" ? "danger" : sev === "warning" ? "warning" : "info";

const severityIcon = (sev: string) =>
  sev === "critical" ? ShieldAlert : sev === "warning" ? ShieldQuestion : Activity;

const tenantName = (tid?: string): string | null => {
  if (!tid) return null;
  if (tid === "platform") return "Platform";
  return tenants.find((t) => t.id === tid)?.name ?? null;
};

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function PlatformAuditPage() {
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allEvents = useMemo(() => getPlatformAudit(), []);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (tenantFilter !== "all" && e.tenantId !== tenantFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.actor?.toLowerCase().includes(q) ||
          e.action?.toLowerCase().includes(q) ||
          e.summary?.toLowerCase().includes(q) ||
          e.entity?.toLowerCase().includes(q) ||
          (tenantName(e.tenantId) ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allEvents, tenantFilter, search]);

  // KPI counts derived from the UNFILTERED stream so the headline numbers
  // stay stable regardless of the operator's current tenant filter / search.
  const totalEvents = allEvents.length;
  const criticalCount = allEvents.filter((e) => e.severity === "critical").length;
  const warningCount = allEvents.filter((e) => e.severity === "warning").length;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = allEvents.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff,
  ).length;

  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (e) => (
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(e.timestamp)}
        </span>
      ),
      sortValue: (e) => e.timestamp,
      width: "180px",
    },
    {
      key: "actor",
      header: "Actor",
      cell: (e) => <span className="font-medium text-foreground">{e.actor}</span>,
      sortValue: (e) => e.actor,
    },
    {
      key: "action",
      header: "Action",
      cell: (e) => <span className="text-sm">{e.action}</span>,
      sortValue: (e) => e.action,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (e) => (
        <div className="flex flex-col">
          <span className="text-sm">{e.entity}</span>
          {e.entityId ? (
            <span className="text-[10px] text-muted-foreground">{e.entityId}</span>
          ) : null}
        </div>
      ),
      sortValue: (e) => e.entity,
    },
    {
      key: "tenantId",
      header: "Tenant",
      cell: (e) => {
        const name = tenantName(e.tenantId);
        if (!name) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const isPlatform = e.tenantId === "platform";
        return (
          <Badge
            variant="outline"
            className="gap-1 text-[10px]"
            title={isPlatform ? "Platform-wide event" : `Tenant: ${name}`}
          >
            <Building2 className="h-3 w-3" />
            {name}
          </Badge>
        );
      },
      sortValue: (e) => e.tenantId ?? "—",
    },
    {
      key: "severity",
      header: "Severity",
      cell: (e) => {
        const Icon = severityIcon(e.severity);
        return (
          <StatusBadge tone={severityTone(e.severity)}>
            <span className="inline-flex items-center gap-1">
              <Icon className="h-3 w-3" />
              <span className="capitalize">{e.severity}</span>
            </span>
          </StatusBadge>
        );
      },
      sortValue: (e) => e.severity,
    },
    {
      key: "module",
      header: "Module",
      cell: (e) =>
        e.module ? (
          <Badge variant="secondary" className="text-[10px]">
            {e.module}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortValue: (e) => e.module ?? "—",
    },
    {
      key: "summary",
      header: "Summary",
      cell: (e) => (
        // Clamp to two lines instead of clipping mid-word at the table edge
        <span className="line-clamp-2 max-w-[260px] text-sm text-muted-foreground">{e.summary}</span>
      ),
      sortValue: (e) => e.summary,
    },
  ];

  const handleExport = () => {
    exportToCsv<AuditEntry>(
      filtered,
      [
        { key: "id", header: "ID", value: (e) => e.id },
        { key: "timestamp", header: "Timestamp", value: (e) => e.timestamp },
        { key: "actor", header: "Actor", value: (e) => e.actor },
        { key: "action", header: "Action", value: (e) => e.action },
        { key: "entity", header: "Entity", value: (e) => e.entity },
        { key: "entityId", header: "Entity ID", value: (e) => e.entityId ?? "" },
        {
          key: "tenant",
          header: "Tenant",
          value: (e) => tenantName(e.tenantId) ?? "—",
        },
        { key: "severity", header: "Severity", value: (e) => e.severity },
        { key: "module", header: "Module", value: (e) => e.module ?? "" },
        { key: "summary", header: "Summary", value: (e) => e.summary },
      ],
      `platform-audit-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Platform Audit Log"
        description="Cross-tenant audit trail of all admin, user, and system actions across the entire platform."
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
            value={criticalCount}
            icon={ShieldAlert}
            tone={criticalCount > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Warnings"
            value={warningCount}
            icon={ShieldQuestion}
            tone={warningCount > 0 ? "warning" : "positive"}
          />
          <MetricCard label="Last 24h" value={last24h} icon={Clock} tone="default" />
        </div>

        {/* Tenant filter + free-text search — DataTable owns its own
         * built-in search box (searchableText below) so we keep the
         * external Select for tenant scoping and let DataTable handle
         * the actor/action/entity free-text.
         */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="h-9 w-full md:w-[220px] text-sm">
              <SelectValue placeholder="All tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              <SelectItem value="platform">Platform (platform-wide)</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, entity, tenant…"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:max-w-sm"
            aria-label="Search platform audit log"
          />
          <span className="ml-auto text-sm text-muted-foreground">
            {filtered.length} of {allEvents.length}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(e) => e.id}
          pageSize={15}
          searchableText={(e) =>
            `${e.actor} ${e.action} ${e.entity} ${e.summary} ${
              tenantName(e.tenantId) ?? ""
            }`
          }
          searchPlaceholder="Refine within filter…"
          emptyTitle="No audit events"
          emptyDescription="No events match the current tenant filter or search."
        />
      </PageContent>
    </Page>
  );
}
