"use client";

/**
 * Change History Page — audit trail of all configuration changes with
 * before/after values (spec section 40 — Change History stream).
 *
 * Each row visually renders the diff: old value in rose strikethrough,
 * an arrow, new value in emerald. Row click opens a detail drawer so
 * the operator can see the full change context (actor, reason, entity
 * reference) before deciding whether to roll back.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getChangeHistory, type ChangeHistoryEntry } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { ArrowRight, History, Filter, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const ENTITY_TYPES = [
  "Challenge",
  "Account",
  "Payout",
  "Risk Rule",
  "Offer",
  "Phase",
  "Email Template",
] as const;

export function ChangeHistoryPage() {
  const { runtime } = usePlatform();
  void runtime;
  const allChanges = useMemo(() => getChangeHistory(), []);

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selected, setSelected] = useState<ChangeHistoryEntry | null>(null);

  const actors = useMemo(
    () => Array.from(new Set(allChanges.map((c) => c.actor))),
    [allChanges],
  );

  const DATE_RANGES: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nowMs = Date.now();
    return allChanges.filter((c) => {
      if (entityFilter !== "all" && c.entityType !== entityFilter) return false;
      if (actorFilter && !c.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false;
      if (dateRange !== "all") {
        const cutoff = nowMs - (DATE_RANGES[dateRange] ?? 0);
        if (new Date(c.timestamp).getTime() < cutoff) return false;
      }
      if (q && !`${c.actor} ${c.entityType} ${c.entityId} ${c.field} ${c.oldValue} ${c.newValue} ${c.reason}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allChanges, search, entityFilter, actorFilter, dateRange]);

  const activeFilters = (entityFilter !== "all" ? 1 : 0) + (actorFilter ? 1 : 0) + (dateRange !== "all" ? 1 : 0) + (search ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setEntityFilter("all");
    setActorFilter("");
    setDateRange("all");
  };

  const columns: Column<ChangeHistoryEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (c) => <span className="font-mono text-xs text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>,
      sortValue: (c) => c.timestamp,
      width: "180px",
    },
    {
      key: "actor",
      header: "Actor",
      cell: (c) => <span className="font-medium text-foreground">{c.actor}</span>,
      sortValue: (c) => c.actor,
    },
    {
      key: "entityType",
      header: "Entity Type",
      cell: (c) => <Badge variant="outline" className="text-[10px]">{c.entityType}</Badge>,
      sortValue: (c) => c.entityType,
    },
    {
      key: "entityId",
      header: "Entity ID",
      cell: (c) => <span className="font-mono text-xs">{c.entityId}</span>,
      sortValue: (c) => c.entityId,
    },
    {
      key: "field",
      header: "Field Changed",
      cell: (c) => <span className="text-sm font-medium">{c.field}</span>,
      sortValue: (c) => c.field,
    },
    {
      key: "diff",
      header: "Change",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-rose-600 line-through dark:text-rose-400" aria-label={`Old value: ${c.oldValue}`}>
            {c.oldValue}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400" aria-label={`New value: ${c.newValue}`}>
            {c.newValue}
          </span>
        </div>
      ),
      sortValue: (c) => `${c.oldValue}→${c.newValue}`,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (c) => <span className="text-xs text-muted-foreground">{c.reason}</span>,
    },
  ];

  const exportCsv = () => {
    exportToCsv<ChangeHistoryEntry>(
      filtered,
      [
        { key: "id", header: "Change ID", value: (c) => c.id },
        { key: "timestamp", header: "Timestamp", value: (c) => c.timestamp },
        { key: "actor", header: "Actor", value: (c) => c.actor },
        { key: "entityType", header: "Entity Type", value: (c) => c.entityType },
        { key: "entityId", header: "Entity ID", value: (c) => c.entityId },
        { key: "field", header: "Field Changed", value: (c) => c.field },
        { key: "oldValue", header: "Old Value", value: (c) => c.oldValue },
        { key: "newValue", header: "New Value", value: (c) => c.newValue },
        { key: "reason", header: "Reason", value: (c) => c.reason },
      ],
      `change-history-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Change History"
        description="Audit trail of all configuration changes with before/after values."
        icon={History}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilters > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{activeFilters}</Badge>
            ) : null}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, field, entity…"
            className="h-8 w-56 text-xs"
          />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by entity type"
          >
            <option value="all">All entity types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by actor"
          >
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
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
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {allChanges.length} changes
          </span>
        </div>

        {/* Change history table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            onRowClick={(c) => setSelected(c)}
            pageSize={10}
            emptyTitle="No changes match your filters"
            emptyDescription="Adjust the filters or widen the date range to see more change history."
          />
        </div>

        {/* Detail panel */}
        <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="w-full sm:max-w-md">
            {selected ? (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Change Detail
                  </SheetTitle>
                  <SheetDescription>
                    Full context for this configuration change.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Timestamp</p>
                      <p className="font-mono text-xs">{new Date(selected.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actor</p>
                      <p className="font-medium">{selected.actor}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                      <p className="text-xs">{selected.reason}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entity</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{selected.entityType}</Badge>
                      <span className="font-mono text-xs">{selected.entityId}</span>
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Field</p>
                    <p className="font-medium">{selected.field}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Diff</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 rounded-md bg-rose-50 dark:bg-rose-950/30 p-2">
                        <p className="text-[9px] uppercase tracking-wide text-rose-700 dark:text-rose-400">Old</p>
                        <p className="text-sm text-rose-600 line-through dark:text-rose-400">{selected.oldValue}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="flex-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2">
                        <p className="text-[9px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">New</p>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{selected.newValue}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          Roll back to old value
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Roll back this change?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This change will be rolled back to the previous
                            state. Any dependent configurations may be
                            affected. This action is logged in the audit trail.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              toast({
                                title: "Rollback queued",
                                description: `Reverting ${selected.field} to ${selected.oldValue}.`,
                              });
                              setSelected(null);
                            }}
                          >
                            Roll back
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}
