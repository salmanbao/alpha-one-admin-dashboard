"use client";

/**
 * Marketing — Email Campaigns Page
 *
 * Spec: tracking email marketing performance, templates, audiences,
 * scheduling, send metrics (open / click / conversion) and top
 * performing templates. Targets traders in a tenant-aware way via
 * makeTermResolver.
 *
 * Sections:
 *   1. KPI row — Total Sent, Avg Open Rate, Avg Click Rate, Conversion Rate
 *   2. Filter bar — status Select / template Select + Export CSV
 *   3. Campaigns DataTable — full lifecycle view per campaign
 *   4. Create Campaign button + Sheet drawer (shared form, view + create)
 *   5. Email Performance Trend (12-week AreaSeries)
 *   6. Top Performing Templates DataTable
 *
 * Terra palette only — emerald / amber / rose / slate / sky.
 * No Math.random — deterministic Math.sin patterns.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { StatusBadge, formatCompact } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  Plus,
  Download,
  Eye,
  MousePointerClick,
  Target,
  Calendar,
  Save,
  Clock,
  FileText,
  TestTube2,
  Users,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type EmailStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "completed"
  | "paused"
  | "failed";

type EmailTemplate =
  | "Welcome"
  | "Newsletter"
  | "Promotional"
  | "Re-engagement"
  | "Phase-Passed"
  | "Payout-Approved";

interface EmailCampaign {
  id: string;
  name: string;
  template: EmailTemplate;
  status: EmailStatus;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  scheduledAt?: string;
  audience: string;
  subject: string;
}

const EMAIL_CAMPAIGNS: EmailCampaign[] = [
  {
    id: "EC-001",
    name: "Welcome Series — New Traders",
    template: "Welcome",
    status: "completed",
    sent: 1248,
    opened: 812,
    clicked: 184,
    converted: 47,
    audience: "Active Traders (New)",
    subject: "Welcome aboard — let's get you funded",
  },
  {
    id: "EC-002",
    name: "Phase 2 Launch Announcement",
    template: "Promotional",
    status: "sent",
    sent: 3840,
    opened: 1458,
    clicked: 412,
    converted: 89,
    audience: "All Traders",
    subject: "Phase 2 evaluation is live — 40% off this week",
  },
  {
    id: "EC-003",
    name: "Weekly Newsletter — Issue #14",
    template: "Newsletter",
    status: "scheduled",
    sent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    scheduledAt: "2026-04-22T09:00",
    audience: "All Traders",
    subject: "Market roundup — what moved this week",
  },
  {
    id: "EC-004",
    name: "Payout Approved — Congrats",
    template: "Payout-Approved",
    status: "completed",
    sent: 524,
    opened: 488,
    clicked: 121,
    converted: 38,
    audience: "Funded Traders",
    subject: "Your payout is on the way",
  },
  {
    id: "EC-005",
    name: "Re-engage Dormant Traders",
    template: "Re-engagement",
    status: "paused",
    sent: 642,
    opened: 184,
    clicked: 22,
    converted: 3,
    audience: "Inactive 30d+",
    subject: "We miss you — here's 25% off your next challenge",
  },
  {
    id: "EC-006",
    name: "Phase 1 Passed — Well Done",
    template: "Phase-Passed",
    status: "sending",
    sent: 218,
    opened: 142,
    clicked: 28,
    converted: 6,
    audience: "Phase-1 Passers",
    subject: "You passed Phase 1 — Phase 2 awaits",
  },
  {
    id: "EC-007",
    name: "Q1 Promo — 40% Off",
    template: "Promotional",
    status: "failed",
    sent: 124,
    opened: 38,
    clicked: 4,
    converted: 0,
    audience: "All Traders",
    subject: "Q1 kickoff — 40% off all challenges",
  },
  {
    id: "EC-008",
    name: "Monthly Newsletter — Issue #15",
    template: "Newsletter",
    status: "draft",
    sent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    audience: "All Traders",
    subject: "April market preview + platform updates",
  },
];

const TEMPLATE_PERF: {
  template: EmailTemplate;
  sent: number;
  openRate: number;
  clickRate: number;
  conversion: number;
  revenue: number;
}[] = [
  { template: "Welcome", sent: 4280, openRate: 65.1, clickRate: 14.8, conversion: 3.8, revenue: 38400 },
  { template: "Newsletter", sent: 8420, openRate: 32.4, clickRate: 4.8, conversion: 1.2, revenue: 18200 },
  { template: "Promotional", sent: 5240, openRate: 38.1, clickRate: 11.2, conversion: 2.4, revenue: 42600 },
  { template: "Re-engagement", sent: 1840, openRate: 22.6, clickRate: 3.4, conversion: 0.4, revenue: 2100 },
  { template: "Phase-Passed", sent: 1280, openRate: 78.4, clickRate: 22.6, conversion: 8.4, revenue: 56400 },
  { template: "Payout-Approved", sent: 624, openRate: 92.4, clickRate: 28.2, conversion: 14.2, revenue: 42100 },
];

const WEEKLY_OPEN_TREND = Array.from({ length: 12 }, (_, i) => ({
  label: `W${i + 1}`,
  openRate: Math.round((28 + Math.sin(i / 2) * 6 + i * 0.4) * 10) / 10,
}));

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "failed", label: "Failed" },
];

const TEMPLATE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All templates" },
  { value: "Welcome", label: "Welcome" },
  { value: "Newsletter", label: "Newsletter" },
  { value: "Promotional", label: "Promotional" },
  { value: "Re-engagement", label: "Re-engagement" },
  { value: "Phase-Passed", label: "Phase-Passed" },
  { value: "Payout-Approved", label: "Payout-Approved" },
];

/* ------------------------------------------------------------------ */
/* Status helpers (inline — do not touch shared status.tsx)          */
/* ------------------------------------------------------------------ */

function emailStatusTone(status: EmailStatus): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "draft": return "muted";
    case "scheduled": return "info";
    case "sending": return "warning";
    case "sent": return "success";
    case "completed": return "success";
    case "paused": return "warning";
    case "failed": return "danger";
    default: return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type SheetState =
  | { mode: "create" }
  | { mode: "view"; campaign: EmailCampaign }
  | null;

export function MarketingEmailCampaignsPage() {
  const { tenant, runtime } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [sheetState, setSheetState] = useState<SheetState>(null);

  const filtered = useMemo(() => {
    return EMAIL_CAMPAIGNS.filter((c) => {
      const statusOk = statusFilter === "all" || c.status === statusFilter;
      const templateOk = templateFilter === "all" || c.template === templateFilter;
      return statusOk && templateOk;
    });
  }, [statusFilter, templateFilter]);

  // KPI computations — derived from full dataset (30d window)
  const totalSent = EMAIL_CAMPAIGNS.reduce((s, c) => s + c.sent, 0);
  const totalOpened = EMAIL_CAMPAIGNS.reduce((s, c) => s + c.opened, 0);
  const totalClicked = EMAIL_CAMPAIGNS.reduce((s, c) => s + c.clicked, 0);
  const totalConverted = EMAIL_CAMPAIGNS.reduce((s, c) => s + c.converted, 0);
  const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const avgClickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
  const conversionRate = totalClicked > 0 ? (totalConverted / totalClicked) * 100 : 0;

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "ID", value: (c) => c.id },
        { key: "name", header: "Campaign", value: (c) => c.name },
        { key: "template", header: "Template", value: (c) => c.template },
        { key: "status", header: "Status", value: (c) => c.status },
        { key: "sent", header: "Sent", value: (c) => c.sent },
        { key: "opened", header: "Opened", value: (c) => c.opened },
        { key: "clicked", header: "Clicked", value: (c) => c.clicked },
        { key: "converted", header: "Converted", value: (c) => c.converted },
        {
          key: "openRate",
          header: "Open Rate %",
          value: (c) => (c.sent > 0 ? Math.round((c.opened / c.sent) * 1000) / 10 : 0),
        },
        {
          key: "clickRate",
          header: "Click Rate %",
          value: (c) => (c.opened > 0 ? Math.round((c.clicked / c.opened) * 1000) / 10 : 0),
        },
        { key: "audience", header: "Audience", value: (c) => c.audience },
        { key: "subject", header: "Subject", value: (c) => c.subject },
      ],
      `email-campaigns-${Date.now()}.csv`,
    );
  };

  const columns: Column<EmailCampaign>[] = [
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="font-mono">{c.id}</span> · {c.subject}
          </p>
        </div>
      ),
      sortValue: (c) => c.name,
      width: "280px",
    },
    {
      key: "template",
      header: "Template",
      cell: (c) => <span className="text-muted-foreground">{c.template}</span>,
      sortValue: (c) => c.template,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <StatusBadge tone={emailStatusTone(c.status)}>
          <span className="capitalize">{c.status}</span>
        </StatusBadge>
      ),
      sortValue: (c) => c.status,
    },
    { key: "sent", header: "Sent", cell: (c) => formatCompact(c.sent), sortValue: (c) => c.sent, numeric: true },
    { key: "opened", header: "Opened", cell: (c) => formatCompact(c.opened), sortValue: (c) => c.opened, numeric: true },
    { key: "clicked", header: "Clicked", cell: (c) => formatCompact(c.clicked), sortValue: (c) => c.clicked, numeric: true },
    { key: "converted", header: "Converted", cell: (c) => c.converted, sortValue: (c) => c.converted, numeric: true },
    {
      key: "openRate",
      header: "Open Rate",
      cell: (c) => (
        <span className={c.sent > 0 && (c.opened / c.sent) >= 0.3 ? "text-emerald-600" : ""}>
          {c.sent > 0 ? `${Math.round((c.opened / c.sent) * 1000) / 10}%` : "—"}
        </span>
      ),
      sortValue: (c) => (c.sent > 0 ? c.opened / c.sent : 0),
      numeric: true,
    },
    {
      key: "clickRate",
      header: "Click Rate",
      cell: (c) => (
        <span className={c.opened > 0 && (c.clicked / c.opened) >= 0.05 ? "text-emerald-600" : ""}>
          {c.opened > 0 ? `${Math.round((c.clicked / c.opened) * 1000) / 10}%` : "—"}
        </span>
      ),
      sortValue: (c) => (c.opened > 0 ? c.clicked / c.opened : 0),
      numeric: true,
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSheetState({ mode: "view", campaign: c });
          }}
          aria-label={`View ${c.name}`}
        >
          View
        </Button>
      ),
      width: "80px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Email Campaigns"
        description={`Plan, send and track email campaigns targeting this ${term("trader").toLowerCase()} tenant's audience.`}
        icon={Mail}
        actions={
          <Button
            size="sm"
            onClick={() => setSheetState({ mode: "create" })}
          >
            <Plus className="mr-1 h-4 w-4" /> Create Campaign
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Emails Sent (30d)"
            value={formatCompact(totalSent)}
            delta={4}
            deltaLabel="across 8 campaigns"
            icon={Send}
            tone="default"
          />
          <MetricCard
            label="Avg Open Rate"
            value={`${avgOpenRate.toFixed(1)}%`}
            delta={6}
            deltaLabel="industry avg: 21.5%"
            icon={Eye}
            tone="positive"
          />
          <MetricCard
            label="Avg Click Rate"
            value={`${avgClickRate.toFixed(1)}%`}
            delta={2}
            deltaLabel="industry avg: 2.6%"
            icon={MousePointerClick}
            tone="positive"
          />
          <MetricCard
            label="Conversion Rate"
            value={`${conversionRate.toFixed(1)}%`}
            delta={-3}
            deltaLabel={`clicked → became ${term("trader").toLowerCase()}`}
            icon={Target}
            tone="warning"
          />
        </div>

        {/* Filter bar + Export */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="h-8 w-[150px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger size="sm" className="h-8 w-[170px]" aria-label="Filter by template">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(statusFilter !== "all" || templateFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setStatusFilter("all");
                    setTemplateFilter("all");
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Campaigns table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">
            Campaigns ({filtered.length})
          </p>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.id} ${c.name} ${c.template} ${c.status} ${c.subject}`}
            searchPlaceholder="Search campaigns…"
            pageSize={8}
            emptyTitle="No campaigns match your filters"
            emptyDescription="Try changing the status or template filter, or reset to see all campaigns."
            onRowClick={(c) => setSheetState({ mode: "view", campaign: c })}
          />
        </div>

        {/* Email performance trend */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <p className="mb-1 flex items-center gap-1 text-sm font-medium">
              Email Performance Trend
              <span className="text-xs font-normal text-muted-foreground">— 12-week open rate</span>
            </p>
            <AreaSeries
              data={WEEKLY_OPEN_TREND}
              xKey="label"
              yKey="openRate"
              color="#059669"
              height={220}
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Quick Stats</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Best performing</span>
                <span className="font-medium text-emerald-600">Payout-Approved</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Best open rate</span>
                <span className="font-medium">92.4%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Active campaigns</span>
                <span className="font-medium">
                  {EMAIL_CAMPAIGNS.filter((c) => c.status === "sending" || c.status === "scheduled").length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Conversion (click → {term("trader").toLowerCase()})</span>
                <span className="font-medium">{conversionRate.toFixed(1)}%</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Top performing templates */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Top Performing Templates
          </p>
          <DataTable
            columns={TEMPLATE_COLUMNS(currency)}
            data={TEMPLATE_PERF}
            rowKey={(t) => t.template}
            searchableText={(t) => t.template}
            searchPlaceholder="Search templates…"
            pageSize={10}
            emptyTitle="No templates yet"
            emptyDescription="Once you start sending email campaigns, performance by template will appear here."
          />
        </div>
      </PageContent>

      {/* Create / Edit Sheet drawer (shared form) */}
      <EmailCampaignSheet
        state={sheetState}
        onClose={() => setSheetState(null)}
        defaultAudienceLabel={`All ${term("trader").toLowerCase()}s`}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Top templates columns                                              */
/* ------------------------------------------------------------------ */

function TEMPLATE_COLUMNS(currency: string): Column<typeof TEMPLATE_PERF[number]>[] {
  return [
    {
      key: "template",
      header: "Template",
      cell: (t) => <span className="font-medium">{t.template}</span>,
      sortValue: (t) => t.template,
    },
    { key: "sent", header: "Sent", cell: (t) => formatCompact(t.sent), sortValue: (t) => t.sent, numeric: true },
    {
      key: "openRate",
      header: "Open Rate",
      cell: (t) => (
        <span className={t.openRate >= 50 ? "text-emerald-600 font-medium" : ""}>
          {t.openRate.toFixed(1)}%
        </span>
      ),
      sortValue: (t) => t.openRate,
      numeric: true,
    },
    {
      key: "clickRate",
      header: "Click Rate",
      cell: (t) => (
        <span className={t.clickRate >= 10 ? "text-emerald-600 font-medium" : ""}>
          {t.clickRate.toFixed(1)}%
        </span>
      ),
      sortValue: (t) => t.clickRate,
      numeric: true,
    },
    {
      key: "conversion",
      header: "Conversion",
      cell: (t) => `${t.conversion.toFixed(1)}%`,
      sortValue: (t) => t.conversion,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue Attributed",
      cell: (t) => (
        <span className="font-semibold text-emerald-600">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(t.revenue)}
        </span>
      ),
      sortValue: (t) => t.revenue,
      numeric: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Sheet drawer — create / view / edit shared form                    */
/* ------------------------------------------------------------------ */

interface EmailCampaignSheetProps {
  state: SheetState;
  onClose: () => void;
  defaultAudienceLabel: string;
}

function EmailCampaignSheet({ state, onClose, defaultAudienceLabel }: EmailCampaignSheetProps) {
  const isCreate = state?.mode === "create";
  const campaign = state?.mode === "view" ? state.campaign : undefined;

  const [name, setName] = useState("");
  const [template, setTemplate] = useState<EmailTemplate>("Welcome");
  const [audience, setAudience] = useState("all");
  const [scheduledAt, setScheduledAt] = useState("");
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");

  // Sync form with the open campaign
  // (use a key on the form element below to reset state per campaign)
  const formKey = campaign?.id ?? "create";

  // Pre-fill when viewing an existing campaign
  const initialName = campaign?.name ?? "";
  const initialTemplate = campaign?.template ?? "Welcome";
  const initialAudience = audienceFor(campaign?.audience, defaultAudienceLabel);
  const initialSubject = campaign?.subject ?? "";
  const initialScheduledAt = campaign?.scheduledAt ?? "";

  return (
    <Sheet
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[560px] overflow-y-auto" side="right">
        {state && (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-lg">
                {isCreate ? "New Email Campaign" : campaign!.name}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {isCreate ? (
                  <>
                    Compose a new campaign and schedule it to your{" "}
                    {defaultAudienceLabel} audience.
                  </>
                ) : (
                  <>
                    <span className="font-mono">{campaign!.id}</span> ·{" "}
                    <span className="capitalize">{campaign!.status}</span> ·{" "}
                    {campaign!.sent > 0
                      ? `${formatCompact(campaign!.sent)} sent · ${formatCompact(campaign!.opened)} opened`
                      : "Not yet sent"}
                  </>
                )}
              </SheetDescription>
            </SheetHeader>

            {/* KPI strip — only in view mode */}
            {campaign && campaign.sent > 0 && (
              <div className="grid grid-cols-4 gap-2 px-4 py-2">
                <KpiPill label="Open Rate" value={`${Math.round((campaign.opened / campaign.sent) * 1000) / 10}%`} tone="emerald" />
                <KpiPill label="Click Rate" value={campaign.opened > 0 ? `${Math.round((campaign.clicked / campaign.opened) * 1000) / 10}%` : "—"} tone="emerald" />
                <KpiPill label="Converted" value={String(campaign.converted)} tone="amber" />
                <KpiPill label="Conv. Rate" value={campaign.clicked > 0 ? `${Math.round((campaign.converted / campaign.clicked) * 1000) / 10}%` : "—"} tone="amber" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <Tabs defaultValue="compose" key={formKey}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="compose" className="text-xs">Compose</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                  <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
                </TabsList>

                {/* Compose tab */}
                <TabsContent value="compose" className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <LabelWithHelp help="Internal name shown only to your team. Recipients see the subject line, not this name.">
                      <Label htmlFor="ec-name" className="text-xs font-medium">Campaign Name</Label>
                    </LabelWithHelp>
                    <Input
                      id="ec-name"
                      value={name || initialName}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Welcome Series — New Traders"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ec-template" className="text-xs font-medium">Template</Label>
                    <Select
                      value={template || initialTemplate}
                      onValueChange={(v) => setTemplate(v as EmailTemplate)}
                    >
                      <SelectTrigger id="ec-template" className="w-full">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_OPTIONS.filter((t) => t.value !== "all").map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp help={`Define which ${defaultAudienceLabel} segment receives this campaign. "Specific Segment" lets you target a saved audience.`}>
                      <Label htmlFor="ec-audience" className="text-xs font-medium">Audience</Label>
                    </LabelWithHelp>
                    <Select
                      value={audience !== "all" ? audience : initialAudience}
                      onValueChange={setAudience}
                    >
                      <SelectTrigger id="ec-audience" className="w-full">
                        <SelectValue placeholder="Choose an audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {defaultAudienceLabel}</SelectItem>
                        <SelectItem value="active">Active Traders</SelectItem>
                        <SelectItem value="funded">Funded Traders</SelectItem>
                        <SelectItem value="failed">Failed Traders</SelectItem>
                        <SelectItem value="segment">Specific Segment…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <LabelWithHelp help="The subject line recipients see in their inbox. Keep it under 60 characters for best open rates.">
                      <Label htmlFor="ec-subject" className="text-xs font-medium">Subject Line</Label>
                    </LabelWithHelp>
                    <Input
                      id="ec-subject"
                      value={subject || initialSubject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Welcome aboard — let's get you funded"
                      maxLength={120}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {(subject || initialSubject).length}/120 characters
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp help="A short preview shown next to the subject in most email clients. Think of it as a second subject line.">
                      <Label htmlFor="ec-preview" className="text-xs font-medium">Preview Text</Label>
                    </LabelWithHelp>
                    <Textarea
                      id="ec-preview"
                      value={preview}
                      onChange={(e) => setPreview(e.target.value)}
                      placeholder="Add a one-line preview that appears after the subject in inbox previews…"
                      className="min-h-[60px]"
                      maxLength={140}
                    />
                  </div>
                </TabsContent>

                {/* Preview tab — renders the email body preview */}
                <TabsContent value="preview" className="mt-3">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-3 border-b pb-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subject</p>
                      <p className="font-medium">
                        {subject || initialSubject || "—"}
                      </p>
                      {preview && (
                        <p className="mt-1 text-xs text-muted-foreground">{preview}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Hi [First Name],
                      </p>
                      <p className="text-sm leading-relaxed">
                        {templateOrDefault(template || initialTemplate).body}
                      </p>
                      <p className="text-xs text-muted-foreground">— The Team</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() =>
                      toast({
                        title: "Test email sent (demo)",
                        description: `A test send was triggered to your address for "${subject || initialSubject || "Untitled"}".`,
                      })
                    }
                  >
                    <TestTube2 className="mr-1 h-4 w-4" /> Send Test Email
                  </Button>
                </TabsContent>

                {/* Schedule tab */}
                <TabsContent value="schedule" className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <LabelWithHelp help="Schedule in your local time. The campaign will be queued and sent at the chosen moment. Leave empty to send immediately.">
                      <Label htmlFor="ec-schedule" className="text-xs font-medium">Schedule Send</Label>
                    </LabelWithHelp>
                    <Input
                      id="ec-schedule"
                      type="datetime-local"
                      value={scheduledAt || initialScheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                  <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
                      <Users className="h-3 w-3" /> Estimated recipients
                    </p>
                    {audience === "segment"
                      ? "Depends on the selected segment size."
                      : `Approximately ${formatCompact(estimatedReach(audience || initialAudience))} ${defaultAudienceLabel}.`}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "Draft saved (demo)",
                    description: `Campaign "${name || initialName || "Untitled"}" saved as draft.`,
                  });
                  onClose();
                }}
              >
                <Save className="mr-1 h-3.5 w-3.5" /> Save Draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!scheduledAt && !initialScheduledAt}
                onClick={() => {
                  toast({
                    title: "Campaign scheduled (demo)",
                    description: `Will send at ${scheduledAt || initialScheduledAt || "the selected time"}.`,
                  });
                  onClose();
                }}
              >
                <Calendar className="mr-1 h-3.5 w-3.5" /> Schedule
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  toast({
                    title: "Campaign sent (demo)",
                    description: `${name || initialName || "Untitled"} is now sending to the selected audience.`,
                  });
                  onClose();
                }}
              >
                <Send className="mr-1 h-3.5 w-3.5" /> Send Now
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function audienceFor(audience: string | undefined, defaultLabel: string): string {
  if (!audience) return "all";
  if (audience.startsWith("All")) return "all";
  if (audience.startsWith("Active")) return "active";
  if (audience.startsWith("Funded")) return "funded";
  if (audience.startsWith("Failed")) return "failed";
  if (audience.startsWith("Inactive") || audience.startsWith("Phase")) return "segment";
  return "all";
}

function estimatedReach(audience: string): number {
  switch (audience) {
    case "all": return 8420;
    case "active": return 3840;
    case "funded": return 642;
    case "failed": return 1210;
    case "segment": return 0;
    default: return 0;
  }
}

function templateOrDefault(template: EmailTemplate): { body: string } {
  const map: Record<EmailTemplate, { body: string }> = {
    Welcome: { body: "Welcome aboard! Your evaluation account is ready. Here's everything you need to start trading and reach your profit target." },
    Newsletter: { body: "Here's your weekly market roundup. Top movers, platform updates and this week's featured strategy." },
    Promotional: { body: "For a limited time, get 40% off all challenge bundles. Use code LAUNCH40 at checkout." },
    "Re-engagement": { body: "We noticed you haven't traded in a while. Here's 25% off your next challenge to help you get back on track." },
    "Phase-Passed": { body: "Congratulations — you've passed Phase 1! Phase 2 is now unlocked and ready for you." },
    "Payout-Approved": { body: "Good news — your payout has been approved and is being processed. Funds should arrive within 2-3 business days." },
  };
  return map[template] ?? { body: "" };
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : "text-rose-600";
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneClass} tabular-nums`}>{value}</div>
    </div>
  );
}
