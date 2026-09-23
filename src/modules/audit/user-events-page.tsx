"use client";

/**
 * User Events Page — real-time log of all user and account activities
 * (spec section 40 — User Events stream).
 *
 * Each event carries a typed `eventType` enum used to color-code the
 * badge (§17-19 — Explainable State) so operators can scan the feed
 * at a glance and pick out the events that matter.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getUserEvents, type UserEvent } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  Activity,
  UserPlus,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  Download,
  Filter,
  X,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EventTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

/** Map an eventType to a status tone for the badge. */
function eventTone(eventType: UserEvent["eventType"]): EventTone {
  switch (eventType) {
    case "ACCOUNT_CREATED":
    case "KYC_COMPLETED":
    case "CHALLENGE_PASSED":
    case "PAYOUT_COMPLETED":
      return "success";
    case "KYC_REJECTED":
    case "BREACH_DETECTED":
    case "CHALLENGE_FAILED":
      return "danger";
    case "ORDER_CREATED":
    case "PAYOUT_REQUESTED":
    case "CHALLENGE_STARTED":
    case "LOGIN":
      return "info";
    case "PASSWORD_CHANGED":
      return "warning";
    default:
      return "muted";
  }
}

/** Pretty label for the dropdown / badge. */
const EVENT_LABELS: Record<UserEvent["eventType"], string> = {
  ACCOUNT_CREATED: "Account Created",
  KYC_COMPLETED: "KYC Completed",
  KYC_REJECTED: "KYC Rejected",
  ORDER_CREATED: "Order Created",
  PAYOUT_REQUESTED: "Payout Requested",
  PAYOUT_COMPLETED: "Payout Completed",
  CHALLENGE_STARTED: "Challenge Started",
  CHALLENGE_PASSED: "Challenge Passed",
  CHALLENGE_FAILED: "Challenge Failed",
  BREACH_DETECTED: "Breach Detected",
  LOGIN: "Login",
  PASSWORD_CHANGED: "Password Changed",
};

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function UserEventsPage() {
  const { runtime } = usePlatform();
  void runtime; // tenant runtime is unused here; events are global

  const allEvents = useMemo(() => getUserEvents(100), []);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  // KPIs — derived from the unfiltered full set so the headline numbers
  // stay stable regardless of the operator's current filters.
  const totalEvents = allEvents.length;
  const accountCreated = allEvents.filter((e) => e.eventType === "ACCOUNT_CREATED").length;
  const kycCompleted = allEvents.filter((e) => e.eventType === "KYC_COMPLETED").length;
  const payoutRequested = allEvents.filter((e) => e.eventType === "PAYOUT_REQUESTED").length;
  const breachDetected = allEvents.filter((e) => e.eventType === "BREACH_DETECTED").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nowMs = Date.now();
    return allEvents.filter((e) => {
      if (typeFilter !== "all" && e.eventType !== typeFilter) return false;
      if (dateRange !== "all") {
        const cutoff = nowMs - (DATE_RANGES[dateRange] ?? 0);
        if (new Date(e.timestamp).getTime() < cutoff) return false;
      }
      if (q && !`${e.userEmail} ${e.accountId} ${e.description} ${e.eventType}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allEvents, search, typeFilter, dateRange]);

  const activeFilters = (typeFilter !== "all" ? 1 : 0) + (dateRange !== "all" ? 1 : 0) + (search ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setDateRange("all");
  };

  const columns: Column<UserEvent>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (e) => <span className="font-mono text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>,
      sortValue: (e) => e.timestamp,
      width: "200px",
    },
    {
      key: "userEmail",
      header: "User Email",
      cell: (e) => <span className="font-medium text-foreground">{e.userEmail}</span>,
      sortValue: (e) => e.userEmail,
    },
    {
      key: "accountId",
      header: "Account ID",
      cell: (e) => <span className="font-mono text-xs">{e.accountId}</span>,
      sortValue: (e) => e.accountId,
    },
    {
      key: "eventType",
      header: "Event Type",
      cell: (e) => <StatusBadge tone={eventTone(e.eventType)}>{EVENT_LABELS[e.eventType]}</StatusBadge>,
      sortValue: (e) => e.eventType,
    },
    {
      key: "description",
      header: "Description",
      cell: (e) => <span className="text-sm text-muted-foreground">{e.description}</span>,
    },
  ];

  const exportCsv = () => {
    exportToCsv<UserEvent>(
      filtered,
      [
        { key: "id", header: "Event ID", value: (e) => e.id },
        { key: "timestamp", header: "Timestamp", value: (e) => e.timestamp },
        { key: "userEmail", header: "User Email", value: (e) => e.userEmail },
        { key: "accountId", header: "Account ID", value: (e) => e.accountId },
        { key: "eventType", header: "Event Type", value: (e) => e.eventType },
        { key: "description", header: "Description", value: (e) => e.description },
      ],
      `user-events-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="User Events"
        description="Real-time log of all user and account activities."
        icon={ScrollText}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Total Events" value={totalEvents} icon={Activity} tone="default" />
          <MetricCard label="Accounts Created" value={accountCreated} icon={UserPlus} tone="positive" />
          <MetricCard label="KYC Completed" value={kycCompleted} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Payouts Requested" value={payoutRequested} icon={Wallet} tone="warning" />
          <MetricCard label="Breaches Detected" value={breachDetected} icon={AlertTriangle} tone={breachDetected > 0 ? "negative" : "positive"} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilters > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{activeFilters}</Badge>
            ) : null}
          </div>
          {/* Search */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, account, description…"
            className="h-8 w-56 text-xs"
          />
          {/* Event type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by event type"
          >
            <option value="all">All event types</option>
            {(Object.keys(EVENT_LABELS) as UserEvent["eventType"][]).map((t) => (
              <option key={t} value={t}>{EVENT_LABELS[t]}</option>
            ))}
          </select>
          {/* Date range */}
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
          <span className={cn("ml-auto text-xs text-muted-foreground")}>
            {filtered.length} of {allEvents.length} events
          </span>
        </div>

        {/* Events table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(e) => e.id}
            pageSize={10}
            emptyTitle="No events match your filters"
            emptyDescription="Try widening the date range or clearing the event type filter."
          />
        </div>
      </PageContent>
    </Page>
  );
}
