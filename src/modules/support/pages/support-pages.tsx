"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTickets } from "@/lib/platform/mock-data";
import type { SupportTicket } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, ticketPriorityTone, ticketStatusTone } from "@/components/platform/status";
import { DonutSeries } from "@/components/platform/charts";
import { toast } from "@/hooks/use-toast";
import { LifeBuoy, Inbox, AlertTriangle, Clock, CheckCircle2, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function avgResponseHours(tickets: SupportTicket[]): number {
  const withReplies = tickets.filter((t) => t.lastReplyAt);
  if (!withReplies.length) return 0;
  let total = 0;
  for (const t of withReplies) {
    const created = new Date(t.createdAt).getTime();
    const replied = new Date(t.lastReplyAt!).getTime();
    total += Math.max(1, (replied - created) / (1000 * 60 * 60));
  }
  return Math.round(total / withReplies.length);
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function SupportOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const tickets = getTenantTickets(tid);
  const open = tickets.filter((t) => t.status === "open" || t.status === "in-progress").length;
  const urgent = tickets.filter((t) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length;
  const resolvedToday = tickets.filter((t) => t.status === "resolved").length;
  const avg = avgResponseHours(tickets);
  const recent = tickets
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  const buckets = (["urgent", "high", "medium", "low"] as const).map((p) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: tickets.filter((t) => t.priority === p).length,
    color:
      p === "urgent" ? "#dc2626" :
      p === "high" ? "#ea580c" :
      p === "medium" ? "#0ea5e9" : "#94a3b8",
  }));
  return (
    <Page>
      <PageHeader
        title="Support"
        description="Ticketing and trader assistance across the tenant."
        icon={LifeBuoy}
        actions={
          <Button size="sm" variant="outline" onClick={() => toast({ title: "New ticket", description: "Open a new ticket (demo)." })}>
            <Inbox className="mr-1 h-4 w-4" /> New Ticket
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Open Tickets" value={open} icon={Inbox} tone="warning" />
          <MetricCard label="Urgent" value={urgent} icon={AlertTriangle} tone="negative" />
          <MetricCard label="Avg Response" value={avg ? `${avg}h` : "—"} icon={Clock} />
          <MetricCard label="Resolved Today" value={resolvedToday} icon={CheckCircle2} tone="positive" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Recent tickets</p>
            <DataTable
              columns={[
                { key: "subject", header: "Subject", cell: (t) => <span className="font-medium text-foreground">{t.subject}</span> },
                { key: "traderName", header: "Trader", cell: (t) => <span className="text-muted-foreground">{t.traderName}</span> },
                { key: "priority", header: "Priority", cell: (t) => <StatusBadge tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusBadge> },
                { key: "status", header: "Status", cell: (t) => <StatusBadge tone={ticketStatusTone(t.status)}>{t.status}</StatusBadge> },
                { key: "created", header: "Created", cell: (t) => <span className="text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>, sortValue: (t) => t.createdAt },
              ]}
              data={recent}
              rowKey={(t) => t.id}
              pageSize={6}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Priority distribution</p>
            <DonutSeries data={buckets} height={200} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function SupportTicketsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const tickets = getTenantTickets(tid);
  const columns: Column<SupportTicket>[] = [
    { key: "subject", header: "Subject", cell: (t) => <span className="font-medium text-foreground">{t.subject}</span> },
    { key: "traderName", header: "Trader", cell: (t) => <span className="text-muted-foreground">{t.traderName}</span> },
    { key: "category", header: "Category", cell: (t) => <span className="capitalize text-muted-foreground">{t.category}</span>, sortValue: (t) => t.category },
    { key: "priority", header: "Priority", cell: (t) => <StatusBadge tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusBadge>, sortValue: (t) => t.priority },
    { key: "status", header: "Status", cell: (t) => <StatusBadge tone={ticketStatusTone(t.status)}>{t.status}</StatusBadge>, sortValue: (t) => t.status },
    { key: "assignee", header: "Assignee", cell: (t) => <span className="text-muted-foreground">{t.assignee ?? "Unassigned"}</span> },
    { key: "created", header: "Created", cell: (t) => <span className="text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>, sortValue: (t) => t.createdAt },
    { key: "messages", header: "Messages", cell: (t) => <span className="text-xs text-muted-foreground">{t.messages}</span>, sortValue: (t) => t.messages },
  ];
  return (
    <Page>
      <PageHeader title="Support Tickets" description="All trader support tickets." icon={Inbox} />
      <PageContent>
        <DataTable
          columns={columns}
          data={tickets}
          rowKey={(t) => t.id}
          searchableText={(t) => `${t.subject} ${t.traderName} ${t.category} ${t.assignee ?? ""}`}
          onRowClick={(t) => toast({ title: `Open ticket ${t.id}`, description: t.subject })}
          pageSize={12}
        />
      </PageContent>
    </Page>
  );
}

/* Knowledge base — static FAQ cards */

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

const faqItems: FaqItem[] = [
  {
    id: "faq-1",
    category: "Getting Started",
    question: "How do I start a challenge?",
    answer: "After verifying your KYC, navigate to Challenges and select an available plan. Funded status is reached after passing both Phase 1 and Phase 2 profit targets.",
    icon: BookOpen,
  },
  {
    id: "faq-2",
    category: "Trading",
    question: "What is the max daily drawdown?",
    answer: "Most plans enforce a 5% daily drawdown limit. Breaches are flagged automatically and the affected account is moved to breached status with payout eligibility reviewed.",
    icon: FileText,
  },
  {
    id: "faq-3",
    category: "Payouts",
    question: "How long do payouts take?",
    answer: "Payouts are processed within 1-3 business days after approval. Bank holidays may extend processing. You will receive email confirmation once funds are released.",
    icon: FileText,
  },
  {
    id: "faq-4",
    category: "Account",
    question: "Can I reset my challenge account?",
    answer: "Yes, resets are available from the account detail page. Each plan includes one free reset per month; additional resets may incur a fee depending on your tier.",
    icon: BookOpen,
  },
  {
    id: "faq-5",
    category: "Technical",
    question: "Why can I not log in to MT5?",
    answer: "Ensure your MT5 credentials were issued from the Accounts page. If login still fails, verify your server matches the account platform (MT5 vs DXTrade) and contact support.",
    icon: FileText,
  },
  {
    id: "faq-6",
    category: "Billing",
    question: "How do refunds work for failed challenges?",
    answer: "Refunds are issued for technical failures on our side. Failed trades are non-refundable. To request a refund, open a ticket under the billing category.",
    icon: BookOpen,
  },
];

export function SupportKnowledgePage() {
  return (
    <Page>
      <PageHeader title="Knowledge Base" description="Self-service guides and FAQs for traders." icon={BookOpen} />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {faqItems.map((f) => (
            <Card key={f.id} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border bg-muted">
                  <f.icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{f.category}</span>
                <CardTitle className="text-base">{f.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">{f.answer}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContent>
    </Page>
  );
}
