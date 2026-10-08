"use client";

/**
 * PFaaS Platform — Audit UI
 *
 * Spec section 40. Reusable Activity Timeline + Audit Log Table +
 * Entity Change History used across modules. Includes filtering by
 * module, severity, actor, and date range.
 */

import { useState, useMemo } from "react";
import { Activity, ShieldAlert, ShieldCheck, ShieldQuestion, Filter, X, Bookmark, Save, Trash2, ChevronDown, Pencil } from "lucide-react";
import type { AuditEntry } from "@/lib/platform/types";
import { DataTable, type Column } from "./data-table";
import { Badge } from "@pfaas/ui/badge";
import { Button } from "@pfaas/ui/button";
import { Input } from "@pfaas/ui/input";
import { cn } from "@pfaas/ui/cn";
import { useSavedViews } from "@/lib/platform/saved-views";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pfaas/ui/dropdown-menu";

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
  const { user } = usePlatform();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("all");
  const { views, saveView, deleteView, renameView, applyView } = useSavedViews("audit-log", user?.id ?? "anon");

  // Derive unique modules and actors for filter dropdowns
  const modules = useMemo(() => Array.from(new Set(entries.map((e) => e.module).filter(Boolean) as string[])), [entries]);
  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor))), [entries]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    return entries.filter((e) => {
      if (severityFilter !== "all" && e.severity !== severityFilter) return false;
      if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
      if (actorFilter && !e.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false;
      if (dateRange !== "all") {
        const cutoff = now - (ranges[dateRange] ?? 0);
        if (new Date(e.timestamp).getTime() < cutoff) return false;
      }
      return true;
    });
  }, [entries, severityFilter, moduleFilter, actorFilter, dateRange]);

  const activeFilters = (severityFilter !== "all" ? 1 : 0) + (moduleFilter !== "all" ? 1 : 0) + (actorFilter ? 1 : 0) + (dateRange !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSeverityFilter("all");
    setModuleFilter("all");
    setActorFilter("");
    setDateRange("all");
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
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        {/* Save current view */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={activeFilters === 0}
          onClick={() => {
            const name = window.prompt("Name this view:", `View ${views.length + 1}`);
            if (!name) return;
            saveView(name, { severity: severityFilter, module: moduleFilter, actor: actorFilter, dateRange });
          }}
        >
          <Save className="h-3 w-3" /> Save
        </Button>
        {/* Load saved view */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={views.length === 0}>
              <Bookmark className="h-3 w-3" /> Views
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Saved Views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                className="flex items-center gap-2"
                onClick={() => {
                  const f = applyView(v);
                  setSeverityFilter(f.severity ?? "all");
                  setModuleFilter(f.module ?? "all");
                  setActorFilter(f.actor ?? "");
                  setDateRange(f.dateRange ?? "all");
                }}
              >
                <Bookmark className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs">{v.name}</span>
                <span className="text-[9px] text-muted-foreground">
                  {Object.values(v.filters).filter((x) => x && x !== "all").length} filters
                </span>
                <button
                  className="ml-1 shrink-0 rounded p-0.5 hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = window.prompt("Rename view:", v.name);
                    if (newName && newName.trim()) renameView(v.id, newName.trim());
                  }}
                  aria-label={`Rename view ${v.name}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="shrink-0 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                  aria-label={`Delete view ${v.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
