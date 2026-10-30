"use client";

/**
 * KYC Rejected Queue — audit fix #3 (HIGH).
 * Rejected submissions with reason codes, templated notifications,
 * resubmission tracking, and a flag for suspicious cases.
 */
import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { getTenantKyc, getTenantTraders, hashStr } from "@/lib/platform/mock-data";
import { AlertTriangle, Send, Flag, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface KycRejectedItem {
  id: string;
  traderId: string;
  traderName: string;
  documentType: string;
  submittedAt: string;
  rejectedAt: string;
  reasonCode: string;
  reasonLabel: string;
  resubmissions: number;
  flaggedSuspicious: boolean;
  notifiedTrader: boolean;
}

const REASON_CODES: Record<string, string> = {
  DOC_BLUR: "Document blurred / low resolution",
  PHOTO_MISMATCH: "Photo does not match submission",
  EXPIRED_ID: "ID document has expired",
  ADDRESS_MISMATCH: "Address does not match proof",
  NAME_MISMATCH: "Name differs across documents",
  INCOMPLETE: "Document set incomplete",
  SUSPICIOUS_EDIT: "Possible digital alteration (flagged)",
};

function buildRejected(tid: string): KycRejectedItem[] {
  const traders = getTenantTraders(tid);
  const kyc = getTenantKyc(tid);
  const items: KycRejectedItem[] = [];
  const codes = Object.keys(REASON_CODES);
  traders.slice(0, 10).forEach((t, i) => {
    const seed = hashStr(tid + t.id + "rejected" + i);
    if (seed % 3 !== 0) return; // ~1/3 have a rejected record
    const code = codes[seed % codes.length];
    items.push({
      id: `KYC-R-${String(1000 + seed % 9000)}`,
      traderId: t.id,
      traderName: t.name,
      documentType: ["Passport / ID", "Driver's License", "Proof of Address", "Source of Funds"][seed % 4],
      submittedAt: `${seed % 10 + 1}d ago`,
      rejectedAt: `${seed % 7 + 1}d ago`,
      reasonCode: code,
      reasonLabel: REASON_CODES[code],
      resubmissions: seed % 3,
      flaggedSuspicious: code === "SUSPICIOUS_EDIT" || seed % 7 === 0,
      notifiedTrader: seed % 2 === 0,
    });
  });
  return items;
}

export function KycRejectedQueuePage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const items = buildRejected(tid);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  const flagged = items.filter((i) => i.flaggedSuspicious);
  const totalResubs = items.reduce((s, i) => s + i.resubmissions, 0);

  const notify = (id: string, name: string, code: string) => {
    setNotifiedIds((s) => new Set(s).add(id));
    toast({
      title: "Rejection notification sent",
      description: `Templated message sent to ${name} (reason: ${REASON_CODES[code] ?? code}).`,
    });
  };

  const columns: Column<KycRejectedItem>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    {
      key: "traderName",
      header: "Trader",
      cell: (r) => (
        <button onClick={() => navigate("trader-detail", { id: r.traderId })} className="text-xs font-medium text-primary hover:underline">
          {r.traderName}
        </button>
      ),
      sortValue: (r) => r.traderName,
    },
    { key: "documentType", header: "Document", cell: (r) => <Badge variant="outline" className="text-[10px]">{r.documentType}</Badge>, sortValue: (r) => r.documentType },
    {
      key: "reason",
      header: "Rejection reason",
      cell: (r) => (
        <div className="min-w-0">
          <span className="text-xs font-semibold text-on-surface">{r.reasonCode}</span>
          <p className="text-[11px] text-on-surface-variant">{r.reasonLabel}</p>
        </div>
      ),
    },
    { key: "submittedAt", header: "Submitted", cell: (r) => <span className="text-xs text-muted-foreground">{r.submittedAt}</span>, sortValue: (r) => r.submittedAt },
    { key: "rejectedAt", header: "Rejected", cell: (r) => <span className="text-xs text-muted-foreground">{r.rejectedAt}</span>, sortValue: (r) => r.rejectedAt },
    {
      key: "resubmissions",
      header: "Resubmissions",
      cell: (r) => (
        <span className={`text-xs font-bold ${r.resubmissions > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
          {r.resubmissions}
        </span>
      ),
      sortValue: (r) => r.resubmissions,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex gap-1 flex-wrap">
          {r.flaggedSuspicious && (
            <StatusBadge tone="danger"><Flag className="h-3 w-3" /> Suspicious</StatusBadge>
          )}
          {(notifiedIds.has(r.id) || r.notifiedTrader) && (
            <StatusBadge tone="success"><Send className="h-3 w-3" /> Notified</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => notify(r.id, r.traderName, r.reasonCode)}>
            <Send className="h-3 w-3 mr-1" /> Notify
          </Button>
          {r.flaggedSuspicious && (
            <Button size="sm" variant="outline" className="text-xs text-amber-700 border-amber-300" onClick={() => toast({ title: "Flagged for review", description: `Case ${r.id} escalated to compliance lead.` })}>
              <ShieldAlert className="h-3 w-3 mr-1" /> Escalate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="KYC Rejected Queue" description="Rejected submissions with reason codes, notifications, resubmission tracking, and suspicious-case flags." icon={AlertTriangle} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Rejected submissions" value={items.length} icon={AlertTriangle} tone="negative" />
          <MetricCard label="Flagged suspicious" value={flagged.length} icon={ShieldAlert} tone="warning" />
          <MetricCard label="Resubmissions (total)" value={totalResubs} icon={Clock} />
          <MetricCard label="Notified to trader" value={items.filter((i) => notifiedIds.has(i.id) || i.notifiedTrader).length} icon={Send} tone="positive" />
        </div>

        <DataTable columns={columns} data={items} rowKey={(r) => r.id} searchableText={(r) => `${r.id} ${r.traderName} ${r.documentType} ${r.reasonCode}`} searchPlaceholder="Search by ID, trader, document or reason…" pageSize={10} emptyTitle="No rejected submissions" emptyDescription="Rejected KYC cases will appear here when a document review results in a rejection." />
      </PageContent>
    </Page>
  );
}
