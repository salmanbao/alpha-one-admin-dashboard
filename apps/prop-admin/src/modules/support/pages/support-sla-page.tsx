"use client";

/**
 * Support SLA Management + Breach Dashboard
 *
 * Task ID: impl-support-sla
 *
 * UX constitution alignment:
 *   §9  KPIs              — every MetricCard carries a deltaLabel for context.
 *   §17-§19 State-first   — Breached tickets surfaced with rose StatusBadge + reason.
 *   §20 Rule Engine UX    — SLA targets explained inline via LabelWithHelp.
 *   §22-§23 Contextual Actions — Edit / Save / Export CSV sit where the data lives.
 *   §24 Destructive Actions  — disabling a policy is a single Switch toggle (reversible).
 *   §27 Drawer vs Page   — SLA policy editor uses a Sheet (quick inspect + small form).
 *   §33 Help             — LabelWithHelp on every SLA target field.
 *   §54-§55 Terminology  — `term("account")` + `plural()` for white-label.
 *
 * Mock data is deterministic (Math.sin patterns, hashStr derivation, fixed
 * constants) — no Math.random.
 *
 * Palette: Terra only (emerald / amber / rose / slate / sky). No blue / indigo /
 * violet. Compliance-band colors:
 *   >= 95%  emerald #059669  (On Target)
 *   80-94%  amber   #d97706  (At Risk)
 *   < 80%   rose    #e11d48  (Off Target)
 */

import { useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell as BarCell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { hashStr, getTenantTickets, type SupportTicket } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { AreaSeries } from "@/components/platform/charts";
import { StatusBadge, ticketPriorityTone } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Inbox,
  AlertTriangle,
  Gauge,
  Timer,
  TimerReset,
  Save,
  Download,
  Pencil,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Deterministic mock data                                             */
/* ------------------------------------------------------------------ */

type Priority = "urgent" | "high" | "medium" | "low";

interface SlaPolicy {
  priority: Priority;
  firstResponseHours: number;
  resolutionHours: number;
  autoEscalateHours: number;
  businessHoursOnly: boolean;
  pauseOnCustomer: boolean;
  active: boolean;
  description: string;
}

const SLA_POLICIES: SlaPolicy[] = [
  {
    priority: "urgent",
    firstResponseHours: 1,
    resolutionHours: 4,
    autoEscalateHours: 2,
    businessHoursOnly: false,
    pauseOnCustomer: true,
    active: true,
    description: "Critical account access issues, payment failures",
  },
  {
    priority: "high",
    firstResponseHours: 4,
    resolutionHours: 8,
    autoEscalateHours: 6,
    businessHoursOnly: false,
    pauseOnCustomer: true,
    active: true,
    description: "Trading platform issues, KYC rejections",
  },
  {
    priority: "medium",
    firstResponseHours: 24,
    resolutionHours: 48,
    autoEscalateHours: 36,
    businessHoursOnly: true,
    pauseOnCustomer: true,
    active: true,
    description: "Feature requests, general inquiries",
  },
  {
    priority: "low",
    firstResponseHours: 48,
    resolutionHours: 72,
    autoEscalateHours: 60,
    businessHoursOnly: true,
    pauseOnCustomer: true,
    active: false,
    description: "Documentation questions, cosmetic issues",
  },
];

const BREACH_TREND = Array.from({ length: 12 }, (_, i) => ({
  label: `Wk ${i + 1}`,
  breaches: Math.floor(8 + Math.sin(i / 2) * 4 + (i % 3 === 0 ? 3 : 0)),
}));

const COMPLIANCE_BY_PRIORITY = [
  { label: "Urgent", value: 88, target: 95 },
  { label: "High", value: 92, target: 95 },
  { label: "Medium", value: 96, target: 95 },
  { label: "Low", value: 98, target: 95 },
];

interface BreachedTicket {
  id: string;
  subject: string;
  priority: Priority;
  created: string;
  slaDue: string;
  hoursOver: number;
  assignee: string;
}

// Module-level static arrays (BREACHED_TICKETS / AGENT_WORKLOAD) were
// removed in Round 4 — they had hardcoded T-1xxx ids that never matched
// real tenant ticket ids, and the same 5 agents appeared on every tenant.
// They are now derived per-tenant via buildBreachedTickets(tid) +
// buildAgentWorkload(tid) at the bottom of the file.

interface AgentRow {
  agent: string;
  open: number;
  avgResponse: string;
  avgResolution: string;
  compliance: number;
}

/* ------------------------------------------------------------------ */
/* Compliance color helpers                                            */
/* ------------------------------------------------------------------ */

const COMPLIANCE_COLORS = {
  green: "#059669", // emerald
  amber: "#d97706", // amber
  rose: "#e11d48", // rose
};

function complianceColor(value: number): string {
  if (value >= 95) return COMPLIANCE_COLORS.green;
  if (value >= 80) return COMPLIANCE_COLORS.amber;
  return COMPLIANCE_COLORS.rose;
}

function complianceTone(value: number): "success" | "warning" | "danger" {
  if (value >= 95) return "success";
  if (value >= 80) return "warning";
  return "danger";
}

function complianceLabel(value: number): string {
  if (value >= 95) return "On Target";
  if (value >= 80) return "At Risk";
  return "Off Target";
}

/* ------------------------------------------------------------------ */
/* Chart helpers                                                       */
/* ------------------------------------------------------------------ */

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
};

/* ------------------------------------------------------------------ */
/* Derive total tickets 30d deterministically from tenant id           */
/* ------------------------------------------------------------------ */

function deriveTotalTickets30d(tenantId: string): number {
  // Deterministic 80–180 range based on a stable tenant hash.
  // Each tenant sees a consistent number — super-admin (platform) sees 142.
  if (!tenantId || tenantId === "platform") return 142;
  const h = Math.abs(hashStr(tenantId)) % 101;
  return 80 + h;
}

/**
 * Build breached tickets from the tenant's actual ticket list. Tickets
 * are "breached" if their SLA window (priority-based: urgent 4h, high 8h,
 * medium 24h, low 48h) has elapsed since `createdAt` and they're not yet
 * resolved/closed. Round 4 fix: previously breachedTickets was a global
 * constant array with hardcoded T-1xxx ids that never matched real
 * tenant ticket ids — clicking a row dead-ended into an unfetchable ticket.
 */
function slaHours(priority: Priority): number {
  switch (priority) {
    case "urgent": return 4;
    case "high": return 8;
    case "medium": return 24;
    case "low": return 48;
  }
}

function relativeHours(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
}

function buildBreachedTickets(tid: string): BreachedTicket[] {
  const tickets = getTenantTickets(tid);
  const out: BreachedTicket[] = [];
  for (const t of tickets) {
    if (t.status === "resolved" || t.status === "closed") continue;
    const elapsed = relativeHours(t.createdAt);
    const sla = slaHours(t.priority);
    if (elapsed <= sla) continue; // not breached yet
    const hoursOver = Math.round((elapsed - sla) * 10) / 10;
    out.push({
      id: t.id,
      subject: t.subject,
      priority: t.priority,
      created: `${Math.round(elapsed)}h ago`,
      slaDue: `${Math.round(sla - elapsed)}h ago`,
      hoursOver,
      assignee: t.assignee ?? "Unassigned",
    });
  }
  // Sort by hours-over descending so worst breaches come first.
  out.sort((a, b) => b.hoursOver - a.hoursOver);
  // Cap at 6 to match the previous hardcoded count.
  return out.slice(0, 6);
}

/**
 * Build per-agent workload from the tenant's actual ticket list.
 * Previously agentWorkload was a global constant — every tenant saw the
 * same 5 agents (Sarah K. / Marcus L. / Elena R. / David T. / Priya M.)
 * regardless of their actual ticket assignees. Round 4 fix: derive
 * agent list from `assignee` field on the tenant's tickets.
 */
function buildAgentWorkload(tid: string): AgentRow[] {
  const tickets = getTenantTickets(tid);
  const map = new Map<string, SupportTicket[]>();
  for (const t of tickets) {
    const a = t.assignee ?? "Unassigned";
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(t);
  }
  const rows: AgentRow[] = [];
  let i = 0;
  for (const [agent, ts] of map.entries()) {
    const open = ts.filter((t) => t.status === "open" || t.status === "in-progress").length;
    const withReplies = ts.filter((t) => t.lastReplyAt);
    const avgResponseH = withReplies.length > 0
      ? withReplies.reduce((s, t) => s + Math.max(0.5, (new Date(t.lastReplyAt!).getTime() - new Date(t.createdAt).getTime()) / (60 * 60 * 1000)), 0) / withReplies.length
      : 0;
    // Compliance: resolved-tickets / total-tickets ratio, deterministic
    // per-tenant seed for variety.
    const resolved = ts.filter((t) => t.status === "resolved" || t.status === "closed").length;
    const baseCompliance = ts.length > 0 ? Math.round((resolved / ts.length) * 100) : 90;
    const seed = hashStr(tid + agent) % 12;
    const compliance = Math.max(80, Math.min(99, baseCompliance + (seed - 6)));
    rows.push({
      agent,
      open,
      avgResponse: `${Math.round(avgResponseH * 10) / 10}h`,
      avgResolution: `${Math.round((avgResponseH * 3 + (hashStr(tid + agent) % 5)) * 10) / 10}h`,
      compliance,
    });
    i++;
  }
  return rows.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SupportSlaPage() {
  const { runtime, tenant, navigate } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";

  const [policies, setPolicies] = useState<SlaPolicy[]>(SLA_POLICIES);
  const [editingPriority, setEditingPriority] = useState<Priority | null>(null);
  const [draft, setDraft] = useState<SlaPolicy | null>(null);

  const totalTickets30d = deriveTotalTickets30d(tid);
  // Round 4: derive breached tickets + agent workload from the tenant's
  // real ticket list (was hardcoded global arrays with non-existent ids).
  const breachedTickets = useMemo(() => buildBreachedTickets(tid), [tid]);
  const agentWorkload = useMemo(() => buildAgentWorkload(tid), [tid]);
  const breachedCount = breachedTickets.length;
  const avgFirstResponse = "2.4h";
  const avgResolution = "8.1h";
  const activePolicyCount = policies.filter((p) => p.active).length;

  const openSheet = (p: SlaPolicy) => {
    setEditingPriority(p.priority);
    setDraft({ ...p });
  };

  const closeSheet = () => {
    setEditingPriority(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    setPolicies((prev) =>
      prev.map((p) => (p.priority === draft.priority ? draft : p)),
    );
    toast({
      title: "SLA policy saved",
      description: `${draft.priority} priority SLA targets updated (demo).`,
    });
    closeSheet();
  };

  const toggleActive = (priority: Priority, active: boolean) => {
    setPolicies((prev) =>
      prev.map((p) => (p.priority === priority ? { ...p, active } : p)),
    );
    toast({
      title: `${priority} SLA ${active ? "enabled" : "disabled"}`,
      description: active
        ? "Tickets will be tracked against this SLA."
        : "Tickets will not be tracked against this SLA.",
    });
  };

  /* ----- SLA policy table columns ----- */
  const policyColumns: Column<SlaPolicy>[] = [
    {
      key: "priority",
      header: "Priority",
      cell: (p) => (
        <StatusBadge tone={ticketPriorityTone(p.priority)}>
          {p.priority}
        </StatusBadge>
      ),
      sortValue: (p) => p.priority,
    },
    {
      key: "firstResponse",
      header: "First Response",
      cell: (p) => (
        <span className="font-medium tabular-nums">{p.firstResponseHours}h</span>
      ),
      sortValue: (p) => p.firstResponseHours,
      numeric: true,
    },
    {
      key: "resolution",
      header: "Resolution",
      cell: (p) => (
        <span className="font-medium tabular-nums">{p.resolutionHours}h</span>
      ),
      sortValue: (p) => p.resolutionHours,
      numeric: true,
    },
    {
      key: "description",
      header: "Description",
      cell: (p) => (
        <span className="text-xs text-muted-foreground">{p.description}</span>
      ),
    },
    {
      key: "active",
      header: "Active",
      cell: (p) => (
        <Switch
          checked={p.active}
          onCheckedChange={(checked) => toggleActive(p.priority, checked)}
          aria-label={`Toggle ${p.priority} SLA policy`}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            // Stop propagation so the row click handler doesn't also fire
            // (if one is ever added to this DataTable).
            e.stopPropagation();
            openSheet(p);
          }}
        >
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      ),
    },
  ];

  /* ----- Breached tickets table columns ----- */
  const breachedColumns: Column<BreachedTicket>[] = [
    {
      key: "id",
      header: "Ticket ID",
      cell: (t) => (
        <span className="font-mono text-xs text-foreground">{t.id}</span>
      ),
      sortValue: (t) => t.id,
    },
    {
      key: "subject",
      header: "Subject",
      cell: (t) => (
        <span className="font-medium text-foreground">{t.subject}</span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      cell: (t) => (
        <StatusBadge tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusBadge>
      ),
      sortValue: (t) => t.priority,
    },
    {
      key: "created",
      header: "Created",
      cell: (t) => (
        <span className="text-xs text-muted-foreground">{t.created}</span>
      ),
    },
    {
      key: "slaDue",
      header: "SLA Due",
      cell: (t) => (
        <span className="text-xs text-muted-foreground">{t.slaDue}</span>
      ),
    },
    {
      key: "hoursOver",
      header: "Time Over",
      cell: (t) => (
        <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-3 w-3" /> {t.hoursOver}h
        </span>
      ),
      sortValue: (t) => t.hoursOver,
      numeric: true,
    },
    {
      key: "assignee",
      header: "Assignee",
      cell: (t) => (
        <span className="text-muted-foreground">{t.assignee}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: () => <StatusBadge tone="danger">Breached</StatusBadge>,
    },
  ];

  /* ----- Agent workload table columns ----- */
  const agentColumns: Column<AgentRow>[] = [
    {
      key: "agent",
      header: "Agent",
      cell: (a) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
            {a.agent
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </div>
          <span className="font-medium text-foreground">{a.agent}</span>
        </div>
      ),
      sortValue: (a) => a.agent,
    },
    {
      key: "open",
      header: "Open Tickets",
      cell: (a) => <span className="tabular-nums">{a.open}</span>,
      sortValue: (a) => a.open,
      numeric: true,
    },
    {
      key: "avgResponse",
      header: "Avg Response",
      cell: (a) => (
        <span className="tabular-nums text-muted-foreground">{a.avgResponse}</span>
      ),
    },
    {
      key: "avgResolution",
      header: "Avg Resolution",
      cell: (a) => (
        <span className="tabular-nums text-muted-foreground">{a.avgResolution}</span>
      ),
    },
    {
      key: "compliance",
      header: "SLA Compliance",
      cell: (a) => (
        <div className="flex items-center gap-2">
          <span
            className="font-medium tabular-nums"
            style={{ color: complianceColor(a.compliance) }}
          >
            {a.compliance}%
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${a.compliance}%`,
                background: complianceColor(a.compliance),
              }}
            />
          </div>
        </div>
      ),
      sortValue: (a) => a.compliance,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <StatusBadge tone={complianceTone(a.compliance)}>
          {complianceLabel(a.compliance)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="SLA Management"
        description="Configure service level targets per priority and monitor breach rates."
        icon={Clock}
        term={`Across all ${plural(term("account")).toLowerCase()} · ${activePolicyCount} active policies`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCsv<BreachedTicket>(
                  breachedTickets,
                  [
                    { key: "id", header: "Ticket ID", value: (t) => t.id },
                    { key: "subject", header: "Subject", value: (t) => t.subject },
                    { key: "priority", header: "Priority", value: (t) => t.priority },
                    { key: "created", header: "Created", value: (t) => t.created },
                    { key: "slaDue", header: "SLA Due", value: (t) => t.slaDue },
                    { key: "hoursOver", header: "Hours Over", value: (t) => t.hoursOver },
                    { key: "assignee", header: "Assignee", value: (t) => t.assignee },
                  ],
                  "sla-breached-tickets.csv",
                )
              }
            >
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() =>
                toast({
                  title: "SLA policies saved (demo)",
                  description: `${activePolicyCount} active policies persisted.`,
                })
              }
            >
              <Save className="mr-1 h-4 w-4" /> Save Changes
            </Button>
          </div>
        }
      />

      <PageContent>
        {/* 1. KPI row ---------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Tickets (30d)"
            value={totalTickets30d}
            icon={Inbox}
            deltaLabel="across all priorities"
          />
          <MetricCard
            label="Breached SLAs"
            value={breachedCount}
            icon={AlertTriangle}
            tone="negative"
            deltaLabel="past their SLA target"
          />
          <MetricCard
            label="Avg First Response"
            value={avgFirstResponse}
            icon={Timer}
            deltaLabel="target: 4h"
          />
          <MetricCard
            label="Avg Resolution Time"
            value={avgResolution}
            icon={TimerReset}
            deltaLabel="target: 24h"
          />
        </div>

        {/* 2. SLA Policy Configuration ---------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-600" />
              SLA Policy Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              First-response + resolution targets per priority. Toggle to
              enable/disable; click <span className="font-medium">Edit</span>{" "}
              for advanced options.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={policyColumns}
              data={policies}
              rowKey={(p) => p.priority}
              pageSize={8}
              searchPlaceholder="Search policies…"
              searchableText={(p) => `${p.priority} ${p.description}`}
              emptyTitle="No SLA policies"
              emptyDescription="Add a priority SLA policy to begin tracking."
            />
          </CardContent>
        </Card>

        {/* 3. Charts row ------------------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA Breach Trend</CardTitle>
              <CardDescription>
                Weekly breached tickets over the last 12 weeks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AreaSeries
                data={BREACH_TREND}
                xKey="label"
                yKey="breaches"
                color={COMPLIANCE_COLORS.rose}
                height={220}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA Compliance by Priority</CardTitle>
              <CardDescription>
                % of tickets resolved within SLA, by priority.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Inline BarChart so each bar is color-coded by compliance band */}
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={COMPLIANCE_BY_PRIORITY}
                    margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={4}
                      interval={0}
                    />
                    <YAxis
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RTooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--muted)" }}
                      formatter={(v: number) => [`${v}%`, "Compliance"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {COMPLIANCE_BY_PRIORITY.map((d) => (
                        <BarCell key={d.label} fill={complianceColor(d.value)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Color-band legend */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: COMPLIANCE_COLORS.green }}
                  />{" "}
                  ≥ 95% On Target
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: COMPLIANCE_COLORS.amber }}
                  />{" "}
                  80–94% At Risk
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: COMPLIANCE_COLORS.rose }}
                  />{" "}
                  &lt; 80% Off Target
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4. Currently Breached Tickets ------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Currently Breached Tickets
            </CardTitle>
            <CardDescription>
              Click any row to open the ticket in the Support Tickets queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={breachedColumns}
              data={breachedTickets}
              rowKey={(t) => t.id}
              pageSize={8}
              onRowClick={() => navigate("support-tickets")}
              searchPlaceholder="Search breached tickets…"
              searchableText={(t) => `${t.id} ${t.subject} ${t.assignee}`}
              emptyTitle="No breached tickets"
              emptyDescription="All tickets are within their SLA targets."
            />
          </CardContent>
        </Card>

        {/* 5. Agent Workload ------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Agent Workload
            </CardTitle>
            <CardDescription>
              Open tickets, response/resolution times, and per-agent SLA
              compliance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={agentColumns}
              data={agentWorkload}
              rowKey={(a) => a.agent}
              pageSize={8}
              searchPlaceholder="Search agents…"
              searchableText={(a) => a.agent}
              emptyTitle="No agents"
              emptyDescription="No agent workload data available."
            />
          </CardContent>
        </Card>
      </PageContent>

      {/* 6. SLA Policy Editor Sheet Drawer ------------------------------ */}
      <Sheet
        open={!!editingPriority}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent className="sm:max-w-[480px] overflow-y-auto" side="right">
          {draft && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="text-lg">
                  Edit SLA Policy — {draft.priority}
                </SheetTitle>
                <SheetDescription>
                  Configure first response, resolution, and escalation
                  behaviour for the{" "}
                  <span className="font-medium capitalize text-foreground">
                    {draft.priority}
                  </span>{" "}
                  priority.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-4">
                  {/* Priority read-only */}
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3">
                      <StatusBadge tone={ticketPriorityTone(draft.priority)}>
                        {draft.priority}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        Cannot be changed
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* First Response Target */}
                  <div className="space-y-1.5">
                    <LabelWithHelp help="Time within which an agent must send the first reply to the trader. Measured from ticket creation. Lower is better; breaching this triggers an At-Risk state.">
                      First Response Target (hours)
                    </LabelWithHelp>
                    <Input
                      type="number"
                      min={1}
                      value={String(draft.firstResponseHours)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          firstResponseHours: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      aria-label="First response target in hours"
                    />
                  </div>

                  {/* Resolution Target */}
                  <div className="space-y-1.5">
                    <LabelWithHelp help="Time within which the ticket must be fully resolved (status = resolved). Counted from ticket creation. Breaching this triggers the Breached state shown in the dashboard.">
                      Resolution Target (hours)
                    </LabelWithHelp>
                    <Input
                      type="number"
                      min={1}
                      value={String(draft.resolutionHours)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          resolutionHours: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      aria-label="Resolution target in hours"
                    />
                  </div>

                  {/* Auto-escalate after */}
                  <div className="space-y-1.5">
                    <LabelWithHelp help="When the SLA clock crosses this threshold, the ticket is auto-routed to a senior agent or Tier 2 queue. Should sit between first response and resolution targets.">
                      Auto-escalate after (hours)
                    </LabelWithHelp>
                    <Input
                      type="number"
                      min={1}
                      value={String(draft.autoEscalateHours)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          autoEscalateHours: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      aria-label="Auto-escalate threshold in hours"
                    />
                  </div>

                  <Separator />

                  {/* Business hours only */}
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-0.5">
                      <LabelWithHelp help="When enabled, the SLA clock only counts configured business hours (e.g. 9–18 Mon–Fri). Useful for non-urgent priorities where outside-hours response is not contractually required.">
                        Business hours only
                      </LabelWithHelp>
                      <p className="text-xs text-muted-foreground">
                        Only count business hours toward the SLA clock.
                      </p>
                    </div>
                    <Switch
                      checked={draft.businessHoursOnly}
                      onCheckedChange={(checked) =>
                        setDraft({ ...draft, businessHoursOnly: checked })
                      }
                      aria-label="Toggle business-hours-only"
                    />
                  </div>

                  {/* Pause on customer response */}
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-0.5">
                      <LabelWithHelp help="When enabled, the SLA clock pauses whenever the ticket is in 'waiting' status (i.e. awaiting a customer response). The clock resumes once the customer replies, so SLA is not unfairly penalised by customer latency.">
                        Pause on customer response
                      </LabelWithHelp>
                      <p className="text-xs text-muted-foreground">
                        Pause the SLA clock while waiting for the customer.
                      </p>
                    </div>
                    <Switch
                      checked={draft.pauseOnCustomer}
                      onCheckedChange={(checked) =>
                        setDraft({ ...draft, pauseOnCustomer: checked })
                      }
                      aria-label="Toggle pause-on-customer-response"
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={closeSheet}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveDraft}>
                  <Save className="mr-1 h-3 w-3" /> Save Policy
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
