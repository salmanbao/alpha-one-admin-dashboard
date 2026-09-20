"use client";

/**
 * PFaaS Platform — Audit UI
 *
 * Spec section 40. Reusable Activity Timeline + Audit Log Table +
 * Entity Change History used across modules.
 */

import { Activity, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { AuditEntry } from "@/lib/platform/types";
import { DataTable, type Column } from "./data-table";
import { Badge } from "@/components/ui/badge";

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
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
            <Icon className="h-3 w-3" /> {r.severity}
          </span>
        );
      },
      sortValue: (r) => r.severity,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={entries}
      rowKey={(r) => r.id}
      searchableText={(r) => `${r.actor} ${r.action} ${r.entity} ${r.summary}`}
      searchPlaceholder="Search audit log…"
      pageSize={10}
    />
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
