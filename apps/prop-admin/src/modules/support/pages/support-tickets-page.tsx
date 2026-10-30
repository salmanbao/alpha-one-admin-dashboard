"use client";

/**
 * Support Ticket Management — converted from audit follow-up
 * Unified interface for viewing, categorizing, and responding to trader support tickets.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, PageContent, PageSkeleton } from "@/components/shell/page-skeleton";
import { EmptyState } from "@/components/platform/guards";
import { DataTable, Column } from "@/components/platform/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { type ReactNode } from "react";

export function SupportTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const tickets = [
    { id: "TK-001", subject: "Login failed after 2FA", status: "open", priority: "high", trader: "T-001", created: "2026-01-15" },
    { id: "TK-002", subject: "Payout delay on withdrawal", status: "pending", priority: "normal", trader: "T-042", created: "2026-01-14" },
    { id: "TK-003", subject: "Account locked suspicious activity", status: "open", priority: "critical", trader: "T-015", created: "2026-01-13" },
    { id: "TK-004", subject: "How to enable SMS notifications", status: "closed", priority: "low", trader: "T-077", created: "2026-01-12" },
    { id: "TK-005", subject: "Challenge purchase not reflecting", status: "open", priority: "high", trader: "T-112", created: "2026-01-16" },
  ];

  const columns: Column<any>[] = [
    {
      key: "id",
      header: "Ticket ID",
      cell: (row: any) => (
        <div className="font-medium text-sm text-on-surface">
          {row.id}
        </div>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      cell: (row: any) => (
        <div className="font-medium text-sm text-on-surface">{row.subject}</div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: any) => {
        const status = row.status;
        const statusClass =
          status === "open"
            ? "bg-primary/10 text-primary border-primary"
            : status === "pending"
              ? "bg-yellow/10 text-yellow-600 border-yellow-400"
              : "bg-green-100 text-green-800 border-green-300";
        const statusText =
          status === "open" ? "Open" : status === "pending" ? "Pending" : "Closed";
        return (
          <div className={statusClass} px-2 py-0.5 rounded text-xs font-medium>
            {statusText}
          </div>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      cell: (row: any) => {
        const priority = row.priority;
        const priorityClass =
          priority === "critical"
            ? "bg-destructive/10 text-destructive border-destructive"
            : priority === "high"
              ? "bg-red-100 text-red-800 border-red-300"
              : priority === "normal"
                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                : "bg-green-100 text-green-800 border-green-300";
        return (
          <div className={priorityClass} px-2 py-0.5 rounded text-xs font-medium>{priority}</div>
        );
      },
    },
    {
      key: "trader",
      header: "Trader",
      cell: (row: any) => <div className="font-medium text-sm text-on-surface-variant">{row.trader}</div>,
    },
    {
      key: "created",
      header: "Created",
      cell: (row: any) => <div className="text-xs text-on-surface-variant">{row.created}</div>,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Support Tickets"
        description="View and manage trader support tickets with filtering and status tracking"
        icon={Search}
      />
      <PageContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="relative w-full sm:w-full sm:w-1/3">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:w-1/4">
            <select
              value={statusFilter ?? "all"}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary w-full"
            >
              <option value="all">Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:w-1/4">
            <select
              value={priorityFilter ?? "all"}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="rounded-lg border bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary w-full"
            >
              <option value="all">Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={tickets}
          emptyTitle="No tickets found"
          emptyDescription="Create your first ticket from the trader dashboard, or use the filters to find existing tickets."
        />
      </PageContent>
    </Page>
  );
}