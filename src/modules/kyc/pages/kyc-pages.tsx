"use client";

/**
 * KYC Module — pages.
 *
 *   1. KycOverviewPage  — KPIs + recent submissions table
 *   2. KycReviewsPage  — DataTable of KYC records with Approve/Reject actions
 *   3. KycRiskPage     — risk distribution donut + high-risk records table
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantKyc, type KycRecord } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, kycStatusTone } from "@/components/platform/status";
import { DonutSeries } from "@/components/platform/charts";
import { ShieldCheck, Clock, FileSearch, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";

const RISK_TONE: Record<KycRecord["riskLevel"], "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const RISK_COLOR: Record<KycRecord["riskLevel"], string> = {
  low: "#059669",
  medium: "#f59e0b",
  high: "#dc2626",
};

export function KycOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const records = getTenantKyc(tid);
  const pending = records.filter((r) => r.status === "pending").length;
  const inReview = records.filter((r) => r.status === "review").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const highRisk = records.filter((r) => r.riskLevel === "high").length;

  const recent = [...records]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 6);

  const recentColumns: Column<KycRecord>[] = [
    { key: "trader", header: "Trader", cell: (r) => <span className="font-medium">{r.traderName}</span>, sortValue: (r) => r.traderName },
    { key: "documentType", header: "Document", cell: (r) => <span className="capitalize">{r.documentType}</span>, sortValue: (r) => r.documentType },
    { key: "country", header: "Country", cell: (r) => r.country, sortValue: (r) => r.country },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge tone={kycStatusTone(r.status)}>{r.status}</StatusBadge>,
      sortValue: (r) => r.status,
    },
    {
      key: "riskLevel",
      header: "Risk",
      cell: (r) => (
        <Badge variant="outline" className="capitalize" style={{ color: RISK_COLOR[r.riskLevel], borderColor: RISK_COLOR[r.riskLevel] }}>
          {r.riskLevel}
        </Badge>
      ),
      sortValue: (r) => r.riskLevel,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</span>,
      sortValue: (r) => r.submittedAt,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="KYC / AML"
        description="Identity verification and anti-money-laundering checks."
        icon={ShieldCheck}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast({ title: "Export started", description: "KYC report generating (demo)." })}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Pending" value={pending} delta={-3} icon={Clock} tone="warning" />
          <MetricCard label="In Review" value={inReview} delta={1} icon={FileSearch} />
          <MetricCard label="Approved" value={approved} delta={8} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Rejected" value={rejected} delta={-1} icon={XCircle} tone="negative" />
          <MetricCard label="High Risk" value={highRisk} delta={2} icon={AlertTriangle} tone="negative" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Recent Submissions</p>
          <DataTable
            columns={recentColumns}
            data={recent}
            rowKey={(r) => r.id}
            searchableText={(r) => `${r.traderName} ${r.documentType} ${r.country} ${r.status}`}
            searchPlaceholder="Search submissions…"
            pageSize={6}
            emptyTitle="No recent submissions"
            emptyDescription="New KYC submissions will appear here."
          />
        </div>
      </PageContent>
    </Page>
  );
}

export function KycReviewsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const records = getTenantKyc(tid);

  const columns: Column<KycRecord>[] = [
    { key: "trader", header: "Trader", cell: (r) => <span className="font-medium">{r.traderName}</span>, sortValue: (r) => r.traderName },
    {
      key: "documentType",
      header: "Document",
      cell: (r) => <span className="capitalize">{r.documentType.replace("-", " ")}</span>,
      sortValue: (r) => r.documentType,
    },
    { key: "country", header: "Country", cell: (r) => r.country, sortValue: (r) => r.country },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge tone={kycStatusTone(r.status)}>{r.status}</StatusBadge>,
      sortValue: (r) => r.status,
    },
    {
      key: "riskLevel",
      header: "Risk",
      cell: (r) => (
        <Badge variant="outline" className="capitalize" style={{ color: RISK_COLOR[r.riskLevel], borderColor: RISK_COLOR[r.riskLevel] }}>
          {r.riskLevel}
        </Badge>
      ),
      sortValue: (r) => r.riskLevel,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</span>,
      sortValue: (r) => r.submittedAt,
    },
    {
      key: "reviewedAt",
      header: "Reviewed",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "—"}
        </span>
      ),
      sortValue: (r) => r.reviewedAt ?? "",
    },
    {
      key: "actions",
      header: "",
      cell: (r) =>
        r.status === "pending" || r.status === "review" ? (
          <div className="flex gap-1">
            <PermissionGuard permission="kyc.approve" fallback={<span className="text-xs text-muted-foreground">—</span>}>
              <Button
                size="sm"
                variant="default"
                onClick={() => toast({ title: "Approved", description: `${r.traderName} KYC approved.` })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  toast({ title: "Rejected", description: `${r.traderName} KYC rejected.`, variant: "destructive" })
                }
              >
                Reject
              </Button>
            </PermissionGuard>
          </div>
        ) : null,
    },
  ];

  return (
    <Page>
      <PageHeader title="KYC Reviews" description="Identity verification queue and history." icon={FileSearch} />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">All Submissions ({records.length})</p>
          <DataTable
            columns={columns}
            data={records}
            rowKey={(r) => r.id}
            searchableText={(r) => `${r.traderName} ${r.documentType} ${r.country} ${r.status} ${r.riskLevel}`}
            searchPlaceholder="Search KYC records…"
            emptyTitle="No KYC records"
            emptyDescription="Submissions from traders will appear here."
          />
        </div>
      </PageContent>
    </Page>
  );
}

export function KycRiskPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const records = getTenantKyc(tid);

  const riskData = (["low", "medium", "high"] as const).map((level) => ({
    label: level,
    value: records.filter((r) => r.riskLevel === level).length,
    color: RISK_COLOR[level],
  }));

  const highRisk = records.filter((r) => r.riskLevel === "high");

  const highRiskColumns: Column<KycRecord>[] = [
    { key: "trader", header: "Trader", cell: (r) => <span className="font-medium">{r.traderName}</span>, sortValue: (r) => r.traderName },
    {
      key: "documentType",
      header: "Document",
      cell: (r) => <span className="capitalize">{r.documentType.replace("-", " ")}</span>,
      sortValue: (r) => r.documentType,
    },
    { key: "country", header: "Country", cell: (r) => r.country, sortValue: (r) => r.country },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge tone={kycStatusTone(r.status)}>{r.status}</StatusBadge>,
      sortValue: (r) => r.status,
    },
    {
      key: "riskLevel",
      header: "Risk",
      cell: (r) => (
        <Badge variant="outline" className="capitalize" style={{ color: RISK_COLOR[r.riskLevel], borderColor: RISK_COLOR[r.riskLevel] }}>
          {r.riskLevel}
        </Badge>
      ),
      sortValue: (r) => r.riskLevel,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</span>,
      sortValue: (r) => r.submittedAt,
    },
  ];

  return (
    <Page>
      <PageHeader title="Risk" description="AML risk distribution and high-risk records." icon={AlertTriangle} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Risk Distribution</p>
            <DonutSeries data={riskData} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">High-Risk Records</p>
              <Badge variant="outline" className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                {highRisk.length} flagged
              </Badge>
            </div>
            <DataTable
              columns={highRiskColumns}
              data={highRisk}
              rowKey={(r) => r.id}
              searchableText={(r) => `${r.traderName} ${r.documentType} ${r.country} ${r.status}`}
              searchPlaceholder="Search high-risk…"
              pageSize={5}
              emptyTitle="No high-risk records"
              emptyDescription="All KYC records are low or medium risk."
            />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
