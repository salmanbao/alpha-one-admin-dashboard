"use client";

/**
 * PFaaS Platform — Audit UI
 *
 * Spec section 40. Reusable Activity Timeline + Audit Log Table +
 * Entity Change History used across modules. Includes filtering by
 * module, severity, actor, and date range.
 */

import { useState, useMemo } from "react";
import { Activity, ShieldAlert, ShieldCheck, ShieldQuestion, Filter, X } from "lucide-react";
import type { AuditEntry } from "@/lib/platform/types";
import { DataTable, type Column } from "./data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ActivityTimeline({ entries, max = 8 }: { entries: AuditEntry[]; max?: number }) {
  const list = entries.slice(0, max);
  if (list.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" /> No recent activity.
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {list.map((e) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background"
            style={{
              background:
                e.severity === "critical"
                  ? "var(--destructive)"
                  : e.severity === "warning"
                  ? "#ea580c"
                  : "var(--brand-primary)",
            }}
          />
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{e.action}</p>
            <Badge variant="outline" className="text-[10px]">{e.entity}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {e.actor} · {new Date(e.timestamp).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AuditLogTable({ entries }: { entries: AuditEntry[] }) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("");

  // Derive unique modules and actors for filter dropdowns
  const modules = useMemo(() => Array.from(new Set(entries.map((e) => e.module).filter(Boolean) as string[])), [entries]);
  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor))), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (severityFilter !== "all" && e.severity !== severityFilter) return false;
      if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
      if (actorFilter && !e.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false;
      return true;
    });
  }, [entries, severityFilter, moduleFilter, actorFilter]);

  const activeFilters = (severityFilter !== "all" ? 1 : 0) + (moduleFilter !== "all" ? 1 : 0) + (actorFilter ? 1 : 0);

  const clearFilters = () => {
    setSeverityFilter("all");
    setModuleFilter("all");
    setActorFilter("");
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp",
      header: "Time",
      cell: (r) => <span className="text-xs">{new Date(r.timestamp).toLocaleString()}</span>,
      sortValue: (r) => r.timestamp,
      width: "180px",
    },
    {
      key: "actor",
      header: "Actor",
      cell: (r) => <span className="font-medium text-foreground">{r.actor}</span>,
      sortValue: (r) => r.actor,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => r.action,
      sortValue: (r) => r.action,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (r) => <Badge variant="outline" className="text-[10px]">{r.entity}</Badge>,
      sortValue: (r) => r.entity,
    },
    {
      key: "summary",
      header: "Summary",
      cell: (r) => <span className="text-muted-foreground">{r.summary}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (r) => {
        const Icon = r.severity === "critical" ? ShieldAlert : r.severity === "warning" ? ShieldQuestion : ShieldCheck;
        const color =
          r.severity === "critical" ? "text-rose-600" : r.severity === "warning" ? "text-amber-600" : "text-emerald-600";
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`} role="img" aria-label={`Severity: ${r.severity}`}>
            <Icon className="h-3 w-3" /> {r.severity}
          </span>
        );
      },
      sortValue: (r) => r.severity,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{activeFilters}</Badge>
          ) : null}
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by severity"
        >
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by module"
        >
          <option value="all">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <Input
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          placeholder="Filter by actor…"
          className="h-8 w-40 text-xs"
          list="audit-actors"
        />
        <datalist id="audit-actors">
          {actors.map((a) => <option key={a} value={a} />)}
        </datalist>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {entries.length} entries
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        searchableText={(r) => `${r.actor} ${r.action} ${r.entity} ${r.summary}`}
        searchPlaceholder="Search audit log…"
        pageSize={10}
      />
    </div>
  );
}

export function EntityChangeHistory({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" /> No change history recorded.
      </div>
    );
  }
  return <ActivityTimeline entries={entries} max={12} />;
}
