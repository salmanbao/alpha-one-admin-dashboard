"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts, getTraderPayouts, hashStr } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FileText, Download, CheckCircle2, Clock, XCircle, Receipt, FileCheck, Award, FileSignature } from "lucide-react";
import type { ComponentType } from "react";

interface DocRow {
  id: string;
  name: string;
  type: string;
  category: string;
  date: string;
  status: "available" | "pending" | "not-applicable";
  format: string;
  icon: ComponentType<{ className?: string }>;
}

export function DocumentsPage() {
  const { runtime, user } = usePlatform();
  const trader = user.application === "trader" ? getTraderForUser(user) : null;
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const payouts = trader ? getTraderPayouts(trader.id) : [];
  const account = accounts[0];

  const docs: DocRow[] = [
    { id: "DOC-001", name: "Challenge Purchase Invoice", type: "Invoice", category: "Invoices", date: "2 months ago", status: "available", format: "PDF", icon: Receipt },
    { id: "DOC-002", name: "Challenge Agreement", type: "Agreement", category: "Agreements", date: "2 months ago", status: "available", format: "PDF", icon: FileSignature },
    ...(account?.phase === "funded" ? [{ id: "DOC-003", name: "Funded Trader Agreement", type: "Agreement", category: "Agreements", date: "1 month ago", status: "available" as const, format: "PDF", icon: FileSignature }] : []),
    ...(payouts.length > 0 ? [{ id: "DOC-004", name: "Payout Receipt", type: "Receipt", category: "Payouts", date: "2 weeks ago", status: "available" as const, format: "PDF", icon: Receipt }] : []),
    { id: "DOC-005", name: "KYC Verification Certificate", type: "Certificate", category: "KYC", date: "2 months ago", status: "available", format: "PDF", icon: FileCheck },
    ...(account?.phase === "funded" ? [{ id: "DOC-006", name: "Challenge Completion Certificate", type: "Certificate", category: "Certificates", date: "1 month ago", status: "available" as const, format: "PDF", icon: Award }] : []),
    { id: "DOC-007", name: "Tax Document (Year-End)", type: "Tax", category: "Tax", date: "—", status: "pending", format: "PDF", icon: FileText },
    { id: "DOC-008", name: "Terms of Service (Accepted)", type: "Terms", category: "Legal", date: "2 months ago", status: "available", format: "PDF", icon: FileText },
  ];

  const columns: Column<DocRow>[] = [
    { key: "name", header: "Document", cell: (d) => <div className="flex items-center gap-2"><d.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{d.name}</span></div>, sortValue: (d) => d.name },
    { key: "category", header: "Category", cell: (d) => <Badge variant="outline" className="text-[10px]">{d.category}</Badge>, sortValue: (d) => d.category },
    { key: "date", header: "Date", cell: (d) => <span className="text-xs text-muted-foreground">{d.date}</span>, sortValue: (d) => d.date },
    { key: "format", header: "Format", cell: (d) => <Badge variant="outline" className="text-[10px]">{d.format}</Badge> },
    { key: "status", header: "Status", cell: (d) => <StatusBadge tone={d.status === "available" ? "success" : d.status === "pending" ? "warning" : "muted"}>{d.status}</StatusBadge>, sortValue: (d) => d.status },
    { key: "actions", header: "Actions", cell: (d) => d.status === "available" ? <button className="text-xs font-medium text-primary hover:underline">Download</button> : <span className="text-xs text-muted-foreground">—</span> },
  ];

  return (
    <Page>
      <PageHeader title="Documents" description="Invoices, agreements, receipts, certificates, and tax documents." icon={FileText} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Documents" value={docs.length} icon={FileText} />
          <MetricCard label="Available" value={docs.filter((d) => d.status === "available").length} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Pending" value={docs.filter((d) => d.status === "pending").length} icon={Clock} tone="warning" />
          <MetricCard label="Certificates" value={docs.filter((d) => d.category === "Certificates").length} icon={Award} />
        </div>
        <DataTable columns={columns} data={docs} rowKey={(d) => d.id} searchableText={(d) => `${d.name} ${d.category} ${d.type}`} searchPlaceholder="Search documents…" pageSize={15} emptyTitle="No documents" emptyDescription="Documents will appear here as you purchase challenges and receive payouts." />
      </PageContent>
    </Page>
  );
}
