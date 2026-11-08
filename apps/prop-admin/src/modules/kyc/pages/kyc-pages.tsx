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
import { useLifecycleLog } from "@pfaas/lifecycle";
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
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/platform/guards";
import { hasPermission } from "@/lib/platform/permission-engine";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  useLifecycleLog(); // R2-W3-01 — cross-app submissions re-render this queue
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
        { key: "accountName", header: term("account"), value: (r) => r.accountName ?? "" },
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
    { key: "account", header: term("account"), cell: (r) => (
      <span className="flex items-center gap-1.5">
        <span className="font-medium">{r.accountName}</span>
        {r.source ? (
          <span className="rounded border border-dashed px-1 text-[9px] uppercase tracking-wide text-muted-foreground" title="Arrived via the trader app over the shared lifecycle log (demo transport)">
            demo transport
          </span>
        ) : null}
      </span>
    ), sortValue: (r) => r.accountName ?? "" },
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
 * PRD §4.13 — "Review Documents" opens a document viewer modal showing the
 * submitted ID document (front/back) plus a selfie alongside the record
 * metadata. Rendered as mock document cards (no image assets in this build).
 */
function KycDocumentViewer({ record, open, onOpenChange }: {
  record: KycRecord;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const docLabel = record.documentType.replace("-", " ");
  // Deterministic seeded SVG "scans" (R2-W2-01) — derived from record id
  // so the same record always renders the same artifact.
  const seed = record.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const initials = record.traderName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const mkSvg = (kind: "front" | "back" | "selfie") => {
    const bg = kind === "selfie" ? "#e8e0d4" : "#f4efe6";
    const accent = kind === "selfie" ? "#4a7c59" : "#705c30";
    const label =
      kind === "front"
        ? `${docLabel.toUpperCase()} · FRONT`
        : kind === "back"
          ? `${docLabel.toUpperCase()} · BACK / MRZ`
          : "SELFIE / LIVENESS";
    const body =
      kind === "selfie"
        ? `<circle cx="100" cy="70" r="36" fill="${accent}" opacity="0.18"/>
           <circle cx="100" cy="60" r="22" fill="${accent}" opacity="0.35"/>
           <rect x="60" y="95" width="80" height="40" rx="20" fill="${accent}" opacity="0.25"/>`
        : `<rect x="14" y="14" width="172" height="4" fill="${accent}" opacity="0.5"/>
           <rect x="14" y="24" width="90" height="3" fill="#8a7a60" opacity="0.4"/>
           <rect x="14" y="32" width="120" height="3" fill="#8a7a60" opacity="0.4"/>
           <text x="100" y="78" text-anchor="middle" font-size="26" font-weight="700" fill="${accent}">${initials}</text>
           ${kind === "back" ? `<text x="14" y="118" font-size="9" font-family="monospace" fill="#5a4a30">P&lt;${record.country.slice(0, 3).toUpperCase()}${record.traderName.replace(/[^A-Z]/g, "").slice(0, 12).padEnd(12, "<")}...</text>` : ""}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140">
      <rect width="200" height="140" fill="${bg}" rx="8"/>
      <rect x="6" y="6" width="188" height="128" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 3" rx="6" opacity="0.5"/>
      ${body}
      <text x="100" y="132" text-anchor="middle" font-size="9" font-weight="600" fill="${accent}" letter-spacing="1">${label}</text>
      <text x="190" y="12" text-anchor="end" font-size="8" fill="#8a7a60" opacity="0.6">seed ${seed % 9999}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const docs = [
    { id: "front", title: `${docLabel} (front)`, detail: `${record.country} · uploaded ${new Date(record.submittedAt).toLocaleDateString()}`, src: mkSvg("front") },
    { id: "back", title: `${docLabel} (back)`, detail: "MRZ / barcode region", src: mkSvg("back") },
    { id: "selfie", title: "Selfie / liveness", detail: "Face match score 94%", src: mkSvg("selfie") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Document review — {record.traderName}
          </DialogTitle>
          <DialogDescription>
            {docLabel} · {record.country} · risk {record.riskLevel}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {docs.map((d) => (
            <div key={d.id} className="rounded-lg border bg-muted/30 p-2 space-y-1.5">
              <div className="overflow-hidden rounded-md border bg-card">
                <img
                  src={d.src}
                  alt={d.title}
                  className="h-32 w-full object-cover transition-transform hover:scale-105"
                  style={{ imageRendering: "auto" }}
                />
              </div>
              <p className="text-xs font-medium">{d.title}</p>
              <p className="text-[10px] text-muted-foreground">{d.detail}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
          Verified against provider {record.documentType === "passport" ? "Onfido" : "Sumsub"} · OCR + MRZ checksum passed · no tamper signals detected.
        </div>
      </DialogContent>
    </Dialog>
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

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
      {/* PRD §4.13 — "Review Documents" opens the document viewer modal
          before the reviewer Approves/Rejects. */}
      <Button
        size="sm"
        variant="outline"
        title="Review documents"
        onClick={() => setViewerOpen(true)}
      >
        <Eye className="h-3 w-3" /> Review
      </Button>
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

        {/* Reject — AlertDialog friction (§24 Destructive Actions). PRD
            requires a captured reason (onReject(reason)); validated before
            the destructive confirm is enabled. Inside the kyc.approve
            PermissionGuard together with Approve/Request Info. */}
        <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
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
            <div className="space-y-1.5">
              <Label htmlFor={`kyc-reject-${record.id}`} className="text-xs text-muted-foreground">
                Reason for rejection (required)
              </Label>
              <Textarea
                id={`kyc-reject-${record.id}`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Proof of address is older than 3 months."
                className="min-h-[72px]"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!rejectReason.trim()}
                onClick={() => {
                  applyKycDecision(record.id, "rejected", { reason: rejectReason.trim() });
                  toast({
                    title: "KYC rejected",
                    description: `${record.traderName}'s submission was rejected — ${rejectReason.trim()}`,
                    variant: "destructive",
                  });
                  setRejectReason("");
                }}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Request Info — opens a dialog with doc-type checkboxes.
            Inside the kyc.approve PermissionGuard (kyc.read ≠ kyc.approve). */}
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
                  applyKycDecision(record.id, "info-requested", {
                    reason: docList ? `Needs: ${docList}` : instructions.trim(),
                  });
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

      <KycDocumentViewer record={record} open={viewerOpen} onOpenChange={setViewerOpen} />
    </div>
  );
}

export function KycReviewsPage() {
  const { runtime, tenant, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useKycVersion(); // rows react to decisions
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));

  // SF-13: bulk decision path — selection via the DataTable API, actions
  // gated behind the same kyc.approve permission as the per-row buttons.
  const canApprove = hasPermission(user, "kyc.approve");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const actionable = records.filter(
    (r) => selected.includes(r.id) && (r.status === "pending" || r.status === "review"),
  );

  const runBulkApprove = () => {
    actionable.forEach((r) => applyKycDecision(r.id, "approved"));
    toast({
      title: `${actionable.length} submission(s) approved`,
      description: "Applicants notified. Bulk decision recorded in the audit log.",
    });
    setSelected([]);
  };

  const runBulkReject = () => {
    if (!bulkRejectReason.trim()) return;
    actionable.forEach((r) =>
      applyKycDecision(r.id, "rejected", { reason: bulkRejectReason.trim() }),
    );
    toast({
      title: `${actionable.length} submission(s) rejected`,
      description: "Applicants notified and may re-submit.",
    });
    setBulkRejectOpen(false);
    setBulkRejectReason("");
    setSelected([]);
  };

  const columns: Column<KycRecord>[] = [
    { key: "account", header: term("account"), cell: (r) => <span className="font-medium">{r.accountName}</span>, sortValue: (r) => r.accountName ?? "" },
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
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            bulkToolbar={
              canApprove && actionable.length > 0 ? (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={runBulkApprove}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Approve selected ({actionable.length})
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-[11px]" onClick={() => setBulkRejectOpen(true)}>
                    <XCircle className="mr-1 h-3 w-3" /> Reject selected
                  </Button>
                </>
              ) : null
            }
          />
        </div>
      </PageContent>

      {/* SF-13 bulk reject — reason required, same §24 friction as single reject */}
      <AlertDialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {actionable.length} KYC submission(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              A reason is required. Rejected status is applied to every selected submission
              and the applicants will be notified. They may re-submit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
            placeholder="Reason (required)"
            className="min-h-[72px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkRejectReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!bulkRejectReason.trim()} onClick={runBulkReject}>
              Reject {actionable.length} submission(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    { key: "account", header: term("account"), cell: (r) => <span className="font-medium">{r.accountName}</span>, sortValue: (r) => r.accountName ?? "" },
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
