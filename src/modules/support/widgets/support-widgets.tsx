"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTickets } from "@/lib/platform/mock-data";
import type { SupportTicket } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, ticketPriorityTone, ticketStatusTone, formatCompact } from "@/components/platform/status";
import { DonutSeries } from "@/components/platform/charts";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Inbox, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { effectiveTicketStatus, effectiveTicketMessages, useTicketVersion } from "@/modules/support/support-store";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function avgResponseHours(tickets: SupportTicket[]): number {
  const withReplies = tickets.filter((t) => t.lastReplyAt);
  if (!withReplies.length) return 0;
  let total = 0;
  for (const t of withReplies) {
    const created = new Date(t.createdAt).getTime();
    const replied = new Date(t.lastReplyAt!).getTime();
    total += Math.max(1, (replied - created) / (1000 * 60 * 60));
  }
  return Math.round(total / withReplies.length);
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

export function SupportOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useTicketVersion();
  const tickets = getTenantTickets(tid).map((t) => ({
    ...t,
    status: effectiveTicketStatus(t),
    messages: effectiveTicketMessages(t),
  }));
  const open = tickets.filter((t) => t.status === "open" || t.status === "in-progress").length;
  const urgent = tickets.filter((t) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length;
  const resolvedToday = tickets.filter(
    (t) => t.status === "resolved" && t.lastReplyAt && isToday(t.lastReplyAt),
  ).length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;
  const avg = avgResponseHours(tickets);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Open Tickets" value={open} icon={Inbox} tone={open > 0 ? "warning" : "positive"} />
      <MetricCard label="Urgent" value={urgent} icon={AlertTriangle} tone={urgent > 0 ? "negative" : "positive"} />
      <MetricCard label="Avg Response" value={avg ? `${avg}h` : "—"} icon={Clock} />
      <MetricCard
        label="Resolved Today"
        value={resolvedToday}
        deltaLabel={resolved > 0 ? `${resolved} all-time` : undefined}
        icon={CheckCircle2}
        tone="positive"
      />
    </div>
  );
}

const recentColumns: Column<SupportTicket>[] = [
  { key: "subject", header: "Subject", cell: (t) => <span className="block max-w-[220px] truncate font-medium text-foreground">{t.subject}</span> },
  { key: "traderName", header: "Participant", cell: (t) => <span className="block max-w-[140px] truncate text-muted-foreground">{t.traderName}</span> },
  { key: "priority", header: "Priority", cell: (t) => <StatusBadge tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusBadge> },
  { key: "status", header: "Status", cell: (t) => <StatusBadge tone={ticketStatusTone(t.status)}>{t.status}</StatusBadge> },
  { key: "messages", header: "Messages", cell: (t) => <span className="text-xs text-muted-foreground">{t.messages}</span>, sortValue: (t) => t.messages },
  { key: "created", header: "Created", cell: (t) => <span className="text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>, sortValue: (t) => t.createdAt },
];

export function RecentTicketsWidget() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useTicketVersion();
  const tickets = getTenantTickets(tid)
    .map((t) => ({ ...t, status: effectiveTicketStatus(t), messages: effectiveTicketMessages(t) }))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  return (
    <DataTable
      columns={recentColumns}
      data={tickets}
      rowKey={(t) => t.id}
      onRowClick={(t) => navigate("support-tickets", { focus: t.id })}
      searchableText={(t) => `${t.subject} ${t.traderName} ${t.category}`}
      pageSize={6}
      emptyTitle="No tickets"
      emptyDescription="Support tickets will appear here."
    />
  );
}

export function TicketPriorityWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useTicketVersion();
  const tickets = getTenantTickets(tid).map((t) => ({ ...t, status: effectiveTicketStatus(t) }));
  const buckets = (["urgent", "high", "medium", "low"] as const).map((p) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: tickets.filter((t) => t.priority === p).length,
    color:
      p === "urgent" ? "#dc2626" :
      p === "high" ? "#ea580c" :
      p === "medium" ? "#0d9488" : "#94a3b8",
  }));
  const total = buckets.reduce((s, b) => s + b.value, 0);
  if (!total) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No tickets
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <DonutSeries data={buckets} height={180} />
      <p className="truncate text-xs text-muted-foreground">{formatCompact(total)} tickets across {buckets.filter((b) => b.value > 0).length} priorities</p>
    </div>
  );
}
