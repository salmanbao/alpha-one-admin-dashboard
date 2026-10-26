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
import { usePlatform } from "@/lib/platform/platform-context";
import { useConsoleStore } from "@/lib/platform/console-store";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
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
import { getPlatformAudit } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import type { AuditEntry } from "@/lib/platform/types";
import type { AuditRecord } from "@/lib/platform/console-store";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const severityTone = (sev: string): "danger" | "warning" | "info" =>
  sev === "critical" ? "danger" : sev === "warning" ? "warning" : "info";

const severityIcon = (sev: string) =>
  sev === "critical" ? ShieldAlert : sev === "warning" ? ShieldQuestion : Activity;

/** Resolve a tenant id to a display name, including runtime-created tenants. */
const makeTenantName = (roster: { id: string; name: string }[]) => {
  return (tid?: string): string | null => {
    if (!tid) return null;
    if (tid === "platform") return "Platform";
    return roster.find((t) => t.id === tid)?.name ?? null;
  };
};

/** Human-readable entity category for a raw `target` string. */
const entityLabel = (target?: string): string => {
  if (!target) return "Console";
  if (target.startsWith("INC")) return "Incident";
  if (target.startsWith("tenant-")) return "Tenant"; // bare tenant id
  if (target.includes(".")) {
    const [head, tail] = target.split(".");
    if (head === "control") return "Emergency control";
    if (head === "tenant") return `Tenant status → ${tail}`;
    if (head === "provisioning") return "Provisioning saga";
    return head;
  }
  return "Platform setting"; // e.g. `global_defaults`
};

/** Map a live console-store record onto the shared AuditEntry shape. */
const consoleEntry = (r: AuditRecord): AuditEntry => ({
  id: r.id,
  timestamp: new Date(r.at).toISOString(),
  actor: r.actor,
  action: r.action,
  entity: entityLabel(r.target),
  entityId: r.target,
  summary: r.detail ?? r.action,
  severity: r.severity,
  module: "console",
  tenantId: r.tenantId,
});

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
  const { navigate, availableTenants } = usePlatform();
  const consoleStore = useConsoleStore();
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const tenantName = useMemo(
    () => makeTenantName(availableTenants),
    [availableTenants],
  );

  // Seed stream loads through the mock layer (loading/error/retry states);
  // live console-store records merge in reactively on top of it.
  const {
    data: seeded,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => getPlatformAudit(), { delayMs: 450 }), []);

  const allEvents = useMemo<AuditEntry[]>(() => {
    // Live console-store events (lifecycle changes, escalations, provisioning,
    // support assist…) merge with the seeded cross-tenant trail, newest first.
    const live = consoleStore.audit.map(consoleEntry);
    return [...live, ...(seeded ?? [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [consoleStore.audit, seeded]);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (tenantFilter === "platform") {
        // Seeded platform entries carry tenantId="platform"; live console
        // records without a tenant scope are platform-wide too.
        if (e.tenantId !== "platform" && e.tenantId !== undefined) return false;
      } else if (tenantFilter !== "all" && e.tenantId !== tenantFilter) {
        return false;
      }
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
          <>
            {/* Audit chain: platform-wide → event log → model/change history */}
            <Button size="sm" variant="ghost" onClick={() => navigate("audit-log")}>
              Event log
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate("model-audit-log")}>
              Model audit
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={seeded !== undefined}
          loadingLabel="Loading audit trail…"
        >
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
              {availableTenants
                .filter((t) => t.id !== "platform")
                .map((t) => (
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
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
