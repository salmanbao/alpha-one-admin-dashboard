"use client";

/**
 * KYC Module — pages.
 *
 *   1. KycOverviewPage  — KPIs + recent submissions table
 *   2. KycReviewsPage  — DataTable of KYC records with Approve/Reject/Request Info actions
 *   3. KycRiskPage     — risk distribution donut + high-risk records table
 *
 * UX Constitution refs:
 *   - §22-23 Contextual Actions: actions appear where the decision happens
 *   - §24 Destructive Actions: Reject wrapped in AlertDialog with consequence
 *   - §28 Entity Workspaces: "Request Info" reveals a small dialog for docs
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantKyc, type KycRecord } from "@/lib/platform/mock-data";
import { applyKycDecision, effectiveKycStatus, useKycVersion } from "@/modules/kyc/kyc-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, kycStatusTone } from "@/components/platform/status";
import { DonutSeries } from "@/components/platform/charts";
import {
  ShieldCheck,
  Clock,
  FileSearch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileText,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

/** Document types that a reviewer may request from an applicant. */
const REQUESTABLE_DOCS = [
  {
    id: "proof-of-address",
    label: "Proof of Address (utility bill, bank statement)",
    desc: "Dated within last 3 months",
  },
  {
    id: "selfie-with-id",
    label: "Selfie with ID",
    desc: "Holding government-issued photo ID",
  },
  {
    id: "bank-statement",
    label: "Bank Statement",
    desc: "Showing account holder name",
  },
  {
    id: "source-of-funds",
    label: "Source of Funds Declaration",
    desc: "Explaining the origin of trading capital",
  },
  {
    id: "other",
    label: "Other (specify in instructions)",
    desc: "Use instructions field below",
  },
] as const;

export function KycOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useKycVersion(); // KPIs recompute when decisions change
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));
  const pending = records.filter((r) => r.status === "pending").length;
  const inReview = records.filter((r) => r.status === "review").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const highRisk = records.filter((r) => r.riskLevel === "high").length;

  const recent = [...records]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 6);

  const handleExport = () => {
    exportToCsv(
      records,
      [
        { key: "accountName", header: term("account"), value: (r) => r.accountName },
        { key: "documentType", header: "Document", value: (r) => r.documentType },
        { key: "country", header: "Country", value: (r) => r.country },
        { key: "status", header: "Status", value: (r) => r.status },
        { key: "riskLevel", header: "Risk", value: (r) => r.riskLevel },
        { key: "submittedAt", header: "Submitted", value: (r) => r.submittedAt },
        { key: "reviewedAt", header: "Reviewed", value: (r) => r.reviewedAt ?? "" },
      ],
      `kyc-overview-${Date.now()}.csv`,
    );
  };

  const recentColumns: Column<KycRecord>[] = [
    { key: "account", header: term("account"), cell: (r) => <span className="font-medium">{r.accountName}</span>, sortValue: (r) => r.accountName },
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
        description={`Identity verification and anti-money-laundering checks for ${plural(term("account")).toLowerCase()}.`}
        icon={ShieldCheck}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Pending" value={pending} icon={Clock} tone="warning" />
          <MetricCard label="In Review" value={inReview} icon={FileSearch} />
          <MetricCard label="Approved" value={approved} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Rejected" value={rejected} icon={XCircle} tone="negative" />
          <MetricCard label="High Risk" value={highRisk} icon={AlertTriangle} tone="negative" />
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

/**
 * Per-record action cell — Approve (primary), Reject (destructive w/ AlertDialog),
 * and "Request Info" (opens a dialog with document-type checkboxes + freeform
 * instructions). Mirrors the PayoutReviewActions pattern from
 * `contextual-actions.tsx` (§22-23) and applies AlertDialog friction to the
 * destructive Reject (§24).
 */
function KycRecordActions({ record }: { record: KycRecord }) {
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState("");

  const toggleDoc = (doc: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) next.delete(doc);
      else next.add(doc);
      return next;
    });
  };

  const resetRequestInfo = () => {
    setSelectedDocs(new Set());
    setInstructions("");
  };

  return (
    <div className="flex gap-1">
      <PermissionGuard
        permission="kyc.approve"
        fallback={<span className="text-xs text-muted-foreground">—</span>}
      >
        <Button
          size="sm"
          variant="default"
          onClick={() => {
            // Mutate the shared KYC store — status flips to approved
            // across the queue, KPIs and risk page instantly.
            applyKycDecision(record.id, "approved");
            toast({
              title: "Approved",
              description: `${record.traderName} KYC approved.`,
            });
          }}
        >
          Approve
        </Button>

        {/* Reject — AlertDialog friction (§24 Destructive Actions) */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <X className="h-3 w-3" /> Reject
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Reject KYC submission?
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to reject the {record.documentType.replace("-", " ")} submission
                from {record.traderName} ({record.country}).
              </AlertDialogDescription>
              <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                <span className="font-medium">Consequence:</span> The submission will move to
                Rejected status and the applicant will be notified. They may re-submit if
                eligible. This action is logged in the audit trail.
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  applyKycDecision(record.id, "rejected");
                  toast({
                    title: "KYC rejected",
                    description: `${record.traderName}'s submission has been rejected.`,
                    variant: "destructive",
                  });
                }}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Request Info — opens a dialog with doc-type checkboxes */}
        <AlertDialog
          open={requestInfoOpen}
          onOpenChange={(open) => {
            setRequestInfoOpen(open);
            if (!open) resetRequestInfo();
          }}
        >
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">
              <FileText className="h-3 w-3" /> Request Info
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Request additional documents</AlertDialogTitle>
              <AlertDialogDescription>
                Select the document types you need {record.traderName} to provide. They will
                receive an email notification with your request.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-1">
              {REQUESTABLE_DOCS.map((doc) => {
                const id = `doc-${record.id}-${doc.id}`;
                const checked = selectedDocs.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-2 rounded-lg border p-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => toggleDoc(doc.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor={id} className="text-xs font-medium cursor-pointer">
                        {doc.label}
                      </Label>
                      <div className="text-[10px] text-muted-foreground">{doc.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`instr-${record.id}`} className="text-xs text-muted-foreground">
                Additional instructions (optional)
              </Label>
              <Textarea
                id={`instr-${record.id}`}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Please upload a utility bill from the last 3 months..."
                className="min-h-[72px]"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={selectedDocs.size === 0 && !instructions.trim()}
                onClick={() => {
                  const docList = Array.from(selectedDocs).join(", ");
                  applyKycDecision(record.id, "info-requested");
                  toast({
                    title: "Request sent to applicant",
                    description: `${record.traderName} has been asked to provide: ${
                      docList || "as described in instructions"
                    }.`,
                  });
                  resetRequestInfo();
                  setRequestInfoOpen(false);
                }}
              >
                <Send className="h-3 w-3" /> Send Request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PermissionGuard>
    </div>
  );
}

export function KycReviewsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useKycVersion(); // rows react to decisions
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));

  const columns: Column<KycRecord>[] = [
    { key: "account", header: term("account"), cell: (r) => <span className="font-medium">{r.accountName}</span>, sortValue: (r) => r.accountName },
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
      header: "Actions",
      cell: (r) =>
        r.status === "pending" || r.status === "review" ? <KycRecordActions record={r} /> : null,
    },
  ];

  return (
    <Page>
      <PageHeader title={`${term("account")} KYC Reviews`} description={`Identity verification queue and history for ${plural(term("account")).toLowerCase()}.`} icon={FileSearch} />
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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useKycVersion();
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));

  const riskData = (["low", "medium", "high"] as const).map((level) => ({
    label: level,
    value: records.filter((r) => r.riskLevel === level).length,
    color: RISK_COLOR[level],
  }));

  const highRisk = records.filter((r) => r.riskLevel === "high");

  const highRiskColumns: Column<KycRecord>[] = [
    { key: "account", header: term("account"), cell: (r) => <span className="font-medium">{r.accountName}</span>, sortValue: (r) => r.accountName },
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
      <PageHeader title="Risk" description={`AML risk distribution and high-risk ${plural(term("account")).toLowerCase()} records.`} icon={AlertTriangle} />
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
              searchPlaceholder={`Search high-risk ${plural(term("account")).toLowerCase()}…`}
              pageSize={5}
              emptyTitle="No high-risk records"
              emptyDescription={`All KYC records are low or medium risk for this ${term("account").toLowerCase()} tenant.`}
            />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
