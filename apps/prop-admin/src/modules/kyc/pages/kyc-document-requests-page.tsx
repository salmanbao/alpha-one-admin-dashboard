"use client";

/**
 * KYC Document Requests — research item #16.
 *
 * For cases where the firm needs additional information from the trader.
 * Show trader, requested document, reason, requested at, deadline, status.
 * Actions: Request, Resend, Approve, Reject, Close.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { getTenantKyc, getTenantTraders, hashStr } from "@/lib/platform/mock-data";
import { FileText, Clock, AlertTriangle, CheckCircle2, Plus, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DocRequest {
  id: string;
  traderId: string;
  traderName: string;
  documentType: string;
  reason: string;
  requestedAt: string;
  deadline: string;
  status: "pending" | "submitted" | "approved" | "rejected" | "expired";
}

const docTypes = ["Proof of Address", "Additional ID", "Source of Funds", "Bank Statement", "Selfie Verification", "Tax ID"];

function buildRequests(tid: string): DocRequest[] {
  const traders = getTenantTraders(tid);
  const kyc = getTenantKyc(tid);
  const requests: DocRequest[] = [];

  traders.slice(0, 8).forEach((t, i) => {
    const seed = hashStr(tid + t.id + i);
    if (seed % 3 === 0) return; // only ~2/3 of traders have doc requests
    const statuses: DocRequest["status"][] = ["pending", "submitted", "approved", "rejected", "expired"];
    requests.push({
      id: `DR-${String(1000 + seed % 9000)}`,
      traderId: t.id,
      traderName: t.name,
      documentType: docTypes[seed % docTypes.length],
      reason: ["Address mismatch", "ID expired", "Compliance review", "High-value payout verification"][seed % 4],
      requestedAt: `${seed % 10 + 1}d ago`,
      deadline: seed % 3 === 0 ? "Overdue" : `in ${seed % 5 + 1}d`,
      status: statuses[i % statuses.length],
    });
  });

  return requests;
}

const statusTone = (s: DocRequest["status"]) =>
  s === "approved" ? "success" : s === "pending" ? "warning" : s === "submitted" ? "info" : s === "rejected" ? "danger" : "muted";

export function KycDocumentRequestsPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const requests = buildRequests(tid);
  const [showForm, setShowForm] = useState(false);

  const pending = requests.filter((r) => r.status === "pending").length;
  const overdue = requests.filter((r) => r.deadline === "Overdue").length;
  const submitted = requests.filter((r) => r.status === "submitted").length;

  const columns: Column<DocRequest>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    { key: "traderName", header: "Trader", cell: (r) => <button onClick={() => navigate("trader-detail", { id: r.traderId })} className="text-xs font-medium text-primary hover:underline">{r.traderName}</button>, sortValue: (r) => r.traderName },
    { key: "documentType", header: "Document", cell: (r) => <Badge variant="outline" className="text-[10px]">{r.documentType}</Badge>, sortValue: (r) => r.documentType },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-xs text-muted-foreground">{r.reason}</span> },
    { key: "requestedAt", header: "Requested", cell: (r) => <span className="text-xs text-muted-foreground">{r.requestedAt}</span>, sortValue: (r) => r.requestedAt },
    { key: "deadline", header: "Deadline", cell: (r) => r.deadline === "Overdue" ? <Badge variant="outline" className="border-rose-500/30 text-rose-700 text-[10px] dark:text-rose-400">Overdue</Badge> : <span className="text-xs text-muted-foreground">{r.deadline}</span>, sortValue: (r) => r.deadline },
    { key: "status", header: "Status", cell: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge>, sortValue: (r) => r.status },
    {
      key: "actions", header: "Actions",
      cell: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && <Button size="sm" variant="ghost" className="text-xs" onClick={() => toast({ title: "Reminder sent", description: `Reminder sent to ${r.traderName}.` })}><Send className="h-3 w-3" /></Button>}
          {r.status === "submitted" && (
            <>
              <Button size="sm" variant="ghost" className="text-xs text-emerald-700" onClick={() => toast({ title: "Approved", description: `${r.documentType} approved for ${r.traderName}.` })}>Approve</Button>
              <Button size="sm" variant="ghost" className="text-xs text-rose-700" onClick={() => toast({ title: "Rejected", description: `${r.documentType} rejected for ${r.traderName}.`, variant: "destructive" })}>Reject</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Document Requests" description="Request additional verification documents from traders." icon={FileText}
        actions={<Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="mr-1 h-4 w-4" /> Request document</Button>} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Requests" value={requests.length} icon={FileText} />
          <MetricCard label="Pending" value={pending} icon={Clock} tone={pending > 0 ? "warning" : "positive"} />
          <MetricCard label="Overdue" value={overdue} icon={AlertTriangle} tone={overdue > 0 ? "negative" : "positive"} />
          <MetricCard label="Submitted" value={submitted} icon={CheckCircle2} tone="info" />
        </div>

        {overdue > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 p-3 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />{overdue} document request{overdue === 1 ? "" : "s"} overdue — follow up with the trader(s).
            </p>
          </div>
        )}

        <DataTable columns={columns} data={requests} rowKey={(r) => r.id} searchableText={(r) => `${r.traderName} ${r.documentType} ${r.reason} ${r.id}`} searchPlaceholder="Search document requests…" pageSize={15} emptyTitle="No requests" emptyDescription="Document requests will appear here." />
      </PageContent>
    </Page>
  );
}
