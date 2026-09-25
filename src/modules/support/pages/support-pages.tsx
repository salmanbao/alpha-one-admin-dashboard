"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural, resolveTermsInString } from "@/lib/platform/terminology";
import { getTenantTickets, hashStr } from "@/lib/platform/mock-data";
import { resolveTicket, escalateTicket, appendTicketReply, effectiveTicketStatus, effectiveTicketMessages, useTicketVersion } from "@/modules/support/support-store";
import type { SupportTicket } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, ticketPriorityTone, ticketStatusTone } from "@/components/platform/status";
import { DonutSeries } from "@/components/platform/charts";
import { toast } from "@/hooks/use-toast";
import {
  LifeBuoy,
  Inbox,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BookOpen,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  User,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

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

/**
 * Derive SLA target (in hours) from priority — used by the Ticket Detail
 * Sheet KPI strip. The mock SupportTicket has no `slaHours` field, so we
 * project from the existing `priority` field deterministically.
 */
function slaHoursFor(priority: SupportTicket["priority"]): number {
  switch (priority) {
    case "urgent": return 4;
    case "high": return 8;
    case "medium": return 24;
    case "low": return 48;
  }
}

/**
 * Live SLA countdown hook. Returns a formatted "Hh Mm" / "Xh ago" string
 * that ticks every 60 seconds so the drawer's SLA cell reflects the
 * real time remaining until the deadline (createdAt + slaHoursFor)
 * instead of a static "{slaHoursFor}h" placeholder. Round 4 fix.
 *
 * If the ticket is already resolved/closed, returns the elapsed time
 * since deadline (positive number formatted as "Xh ago") so the operator
 * sees how late the response was.
 */
function useSlaRemaining(createdAt: string, priority: SupportTicket["priority"], status: SupportTicket["status"]): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  // Re-evaluate on every render (hook re-subscribes via the ticker).
  const slaMs = slaHoursFor(priority) * 60 * 60 * 1000;
  const created = new Date(createdAt).getTime();
  const deadline = created + slaMs;
  const now = Date.now();
  const isClosed = status === "resolved" || status === "closed";
  if (isClosed) {
    // Show how long after deadline the ticket sat (or "on time" if before)
    const closed = Date.now();
    const delta = closed - deadline;
    if (delta <= 0) return "On time";
    const hours = Math.floor(delta / (60 * 60 * 1000));
    const mins = Math.floor((delta % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h ${mins}m late` : `${mins}m late`;
  }
  const remaining = deadline - now;
  if (remaining <= 0) {
    const overdue = -remaining;
    const hours = Math.floor(overdue / (60 * 60 * 1000));
    const mins = Math.floor((overdue % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h ${mins}m over` : `${mins}m over`;
  }
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

/**
 * Live SLA countdown cell — wraps the useSlaRemaining hook so it can be
 * rendered inside the conditional Sheet drawer without breaking rules of
 * hooks (the parent <Sheet> only renders its body when open).
 */
function SlaTimerCell({ ticket, status }: { ticket: SupportTicket; status: SupportTicket["status"] }) {
  const remaining = useSlaRemaining(ticket.createdAt, ticket.priority, status);
  return (
    <div className="rounded-lg border p-2 text-center">
      <Clock className="h-3 w-3 mx-auto text-amber-600 mb-1" />
      <div className="text-[10px] text-muted-foreground">SLA</div>
      <div className="text-xs font-medium tabular-nums">{remaining}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deterministic conversation thread generator                          */
/* ------------------------------------------------------------------ */

interface ConversationMessage {
  author: string;
  authorInitials: string;
  body: string;
  timestamp: string;
  fromTrader: boolean;
}

const TRADER_OPENERS = [
  "Hi team, I'm seeing the issue described above and would appreciate a quick look.",
  "Following up — this is still blocking my trading session today.",
  "Any update on this? I'd like to get back to the challenge before the daily reset.",
  "Thanks for the reply. I've attached the screenshot showing the error.",
  "Could you also confirm whether the payout window re-opens once this is resolved?",
];

const AGENT_OPENERS = [
  "Thanks for reaching out — I've pulled up your account and I'm investigating now.",
  "I can confirm this is a known issue on our side; engineering is rolling out a fix this afternoon.",
  "Could you share the exact timestamp when this last occurred? I'll cross-reference the logs.",
  "Good news — the rule engine has been recalibrated; please refresh your dashboard in 5 minutes.",
  "I've escalated this to Tier 2 support. You should hear back within the SLA window.",
];

function conversationFor(t: SupportTicket): ConversationMessage[] {
  const seed = hashStr(t.id);
  // Build 3 deterministic messages anchored on createdAt; spacing of 2h, 5h.
  const created = new Date(t.createdAt).getTime();
  const mkTs = (hoursAgo: number) => new Date(created + hoursAgo * 3_600_000).toISOString();
  const traderIdx = seed % TRADER_OPENERS.length;
  const agentIdx = (seed >>> 3) % AGENT_OPENERS.length;
  const traderInitials = t.traderName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return [
    {
      author: t.traderName,
      authorInitials: traderInitials,
      body: TRADER_OPENERS[traderIdx],
      timestamp: mkTs(0),
      fromTrader: true,
    },
    {
      author: t.assignee ?? "Support Agent",
      authorInitials: (t.assignee ?? "SA")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      body: AGENT_OPENERS[agentIdx],
      timestamp: mkTs(2),
      fromTrader: false,
    },
    {
      author: t.traderName,
      authorInitials: traderInitials,
      body: TRADER_OPENERS[(traderIdx + 2) % TRADER_OPENERS.length],
      timestamp: mkTs(5),
      fromTrader: true,
    },
  ];
}

interface InternalNote {
  author: string;
  body: string;
  timestamp: string;
}

function internalNotesFor(t: SupportTicket): InternalNote[] {
  const seed = hashStr(t.id);
  const created = new Date(t.createdAt).getTime();
  const mkTs = (h: number) => new Date(created + h * 3_600_000).toISOString();
  const authors = ["Sarah K.", "Marcus T.", "Elena R."];
  const notes = [
    "Triaged to billing tier — confirmed the trader is on the 100k challenge plan.",
    "Cross-referenced with the trading log; the rule-engine recalc is plausible.",
  ];
  return notes.map((body, i) => ({
    author: authors[(seed >>> (i * 2)) % authors.length],
    body,
    timestamp: mkTs(i + 1),
  }));
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function SupportOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useTicketVersion(); // KPIs recompute after resolve/escalate
  const tickets = getTenantTickets(tid).map((t) => ({ ...t, status: effectiveTicketStatus(t) }));
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
      p === "medium" ? "#0d9488" : "#94a3b8",
  }));
  return (
    <Page>
      <PageHeader
        title="Support"
        description={`Ticketing and ${term("trader").toLowerCase()} assistance across this tenant.`}
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
                { key: "traderName", header: term("trader"), cell: (t) => <span className="text-muted-foreground">{t.traderName}</span> },
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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  useTicketVersion(); // table reacts to drawer actions
  const tickets = getTenantTickets(tid).map((t) => ({
    ...t,
    status: effectiveTicketStatus(t),
    messages: effectiveTicketMessages(t),
  }));

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  // Replies sent this session — appended to the thread so "Send" has an
  // observable effect in the conversation.
  const [sentReplies, setSentReplies] = useState<Array<{ body: string; timestamp: string }>>([]);
  const [reply, setReply] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const columns: Column<SupportTicket>[] = [
    { key: "subject", header: "Subject", cell: (t) => <span className="font-medium text-foreground">{t.subject}</span> },
    { key: "traderName", header: term("trader"), cell: (t) => <span className="text-muted-foreground">{t.traderName}</span> },
    { key: "category", header: "Category", cell: (t) => <span className="capitalize text-muted-foreground">{t.category}</span>, sortValue: (t) => t.category },
    { key: "priority", header: "Priority", cell: (t) => <StatusBadge tone={ticketPriorityTone(t.priority)}>{t.priority}</StatusBadge>, sortValue: (t) => t.priority },
    { key: "status", header: "Status", cell: (t) => <StatusBadge tone={ticketStatusTone(t.status)}>{t.status}</StatusBadge>, sortValue: (t) => t.status },
    { key: "assignee", header: "Assignee", cell: (t) => <span className="text-muted-foreground">{t.assignee ?? "Unassigned"}</span> },
    { key: "created", header: "Created", cell: (t) => <span className="text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>, sortValue: (t) => t.createdAt },
    { key: "messages", header: "Messages", cell: (t) => <span className="text-xs text-muted-foreground">{t.messages}</span>, sortValue: (t) => t.messages },
  ];

  // Derived conversation thread for the currently-selected ticket — memoised
  // so toggling `selectedTicket` doesn't recompute on every keystroke in the
  // reply box.
  const conversation = useMemo(
    () => (selectedTicket ? conversationFor(selectedTicket) : []),
    [selectedTicket],
  );
  const internalNotes = useMemo(
    () => (selectedTicket ? internalNotesFor(selectedTicket) : []),
    [selectedTicket],
  );

  return (
    <Page>
      <PageHeader title="Support Tickets" description={`All ${term("trader").toLowerCase()} support tickets.`} icon={Inbox} />
      <PageContent>
        <DataTable
          columns={columns}
          data={tickets}
          rowKey={(t) => t.id}
          searchableText={(t) => `${t.subject} ${t.traderName} ${t.category} ${t.assignee ?? ""}`}
          onRowClick={(t) => {
            setSelectedTicket(t);
            setReply("");
            setNotesOpen(false);
            setSentReplies([]);
          }}
          pageSize={12}
        />
      </PageContent>

      {/* Detail Sheet drawer (§27 — quick inspection + small contextual actions) */}
        <Sheet
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null);
            setReply("");
            setSentReplies([]);
          }
        }}
      >
        <SheetContent className="sm:max-w-[640px] overflow-y-auto" side="right">
          {selectedTicket && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle className="text-lg">{selectedTicket.subject}</SheetTitle>
                    <SheetDescription className="mt-1">
                      <span className="font-mono">#{selectedTicket.id}</span> · Opened {relativeTime(selectedTicket.createdAt)}
                    </SheetDescription>
                  </div>
                  <StatusBadge tone={ticketStatusTone(effectiveTicketStatus(selectedTicket))} className="shrink-0">
                    {effectiveTicketStatus(selectedTicket)}
                  </StatusBadge>
                </div>
              </SheetHeader>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2 px-4 py-3">
                <SlaTimerCell ticket={selectedTicket} status={effectiveTicketStatus(selectedTicket)} />
                <div className="rounded-lg border p-2 text-center">
                  <User className="h-3 w-3 mx-auto text-emerald-600 mb-1" />
                  <div className="text-[10px] text-muted-foreground">Assignee</div>
                  <div className="text-xs font-medium truncate">{selectedTicket.assignee ?? "Unassigned"}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <MessageSquare className="h-3 w-3 mx-auto text-rose-600 mb-1" />
                  <div className="text-[10px] text-muted-foreground">Messages</div>
                  <div className="text-xs font-medium">{effectiveTicketMessages(selectedTicket)}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {/* Conversation thread */}
                <div className="space-y-3 my-2">
                  <h4 className="text-sm font-medium">Conversation</h4>
                  {conversation.map((msg, i) => (
                    <div
                      key={`seed-${i}`}
                      className={`flex gap-2 ${msg.fromTrader ? "flex-row" : "flex-row-reverse"}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback
                          className={`text-[10px] ${
                            msg.fromTrader
                              ? "bg-muted text-foreground"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}
                        >
                          {msg.authorInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 rounded-lg p-3 ${
                          msg.fromTrader ? "bg-muted" : "bg-emerald-50 dark:bg-emerald-950/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-xs font-medium truncate">{msg.author}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {relativeTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{msg.body}</p>
                      </div>
                    </div>
                  ))}
                  {sentReplies.map((r, i) => (
                    <div key={`sent-${i}`} className="flex gap-2 flex-row-reverse">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          You
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-xs font-medium truncate">You (agent)</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">just now</span>
                        </div>
                        <p className="text-sm leading-relaxed">{r.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-3" />

                {/* Internal notes (collapsed — §12 Progressive Disclosure) */}
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    {notesOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Internal notes ({internalNotes.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {internalNotes.map((n, i) => (
                      <div key={i} className="rounded-md border border-dashed bg-muted/30 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-foreground">{n.author}</span>
                          <span className="text-[10px] text-muted-foreground">{relativeTime(n.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Reply box */}
                <div className="mt-4">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    className="min-h-[80px]"
                    aria-label="Reply to ticket"
                  />
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast({ title: "Attachment (demo)", description: "File picker would open here." })}
                        aria-label="Attach file"
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast({ title: "Canned responses (demo)", description: "Insert a saved macro." })}
                      >
                        <FileText className="h-3 w-3" /> Canned
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      disabled={!reply.trim()}
                      onClick={() => {
                        // Record the reply in the store (message count) and
                        // append it to the visible thread.
                        appendTicketReply(selectedTicket.id);
                        setSentReplies((r) => [
                          ...r,
                          { body: reply.trim(), timestamp: new Date().toISOString() },
                        ]);
                        toast({
                          title: "Reply sent",
                          description: `Reply posted to ${selectedTicket.id}.`,
                        });
                        setReply("");
                      }}
                    >
                      <Send className="h-3 w-3" /> Send
                    </Button>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Escalate moves the ticket to the in-progress (Tier 2)
                    // state — visible in the drawer badge and the table.
                    escalateTicket(selectedTicket.id);
                    toast({
                      title: "Escalated",
                      description: `Ticket ${selectedTicket.id} moved to Tier 2 queue.`,
                      variant: "default",
                    });
                  }}
                >
                  <AlertCircle className="h-3 w-3" /> Escalate
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Mutate the shared store — the row flips to resolved and
                    // every ticket KPI recomputes.
                    resolveTicket(selectedTicket.id);
                    toast({
                      title: "Resolved",
                      description: `Ticket ${selectedTicket.id} marked as resolved.`,
                    });
                    setSelectedTicket(null);
                    setReply("");
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" /> Resolve
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
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
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <Page>
      <PageHeader title="Knowledge Base" description={`Self-service guides and FAQs for ${plural(term("trader")).toLowerCase()}.`} icon={BookOpen} />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {faqItems.map((f) => (
            <Card key={f.id} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border bg-muted">
                  <f.icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{resolveTermsInString(f.category, tenant)}</span>
                <CardTitle className="text-base">{resolveTermsInString(f.question, tenant)}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">{resolveTermsInString(f.answer, tenant)}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContent>
    </Page>
  );
}
