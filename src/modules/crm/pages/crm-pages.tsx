"use client";

/**
 * CRM Module — pages.
 *
 *   1. CrmOverviewPage  — KPIs + pipeline bar chart
 *   2. CrmContactsPage — DataTable of contacts (row click → Sheet detail drawer)
 *   3. CrmPipelinePage — pipeline stages visualization with counts
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantContacts, hashStr, type CrmContact } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { BarSeries } from "@/components/platform/charts";
import {
  Users,
  UserPlus,
  CheckCircle2,
  Crown,
  UserMinus,
  Contact,
  GitBranch,
  Download,
  DollarSign,
  Activity,
  Briefcase,
  Trash2,
  Plus,
  UserCheck,
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
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

const STAGE_COLOR: Record<CrmContact["stage"], string> = {
  lead: "#94a3b8",
  qualified: "#0891b2",
  opportunity: "#f59e0b",
  customer: "#059669",
  churned: "#dc2626",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface ActivityEntry {
  label: string;
  detail: string;
  timestamp: string;
  icon: "join" | "email" | "click" | "demo" | "deal";
}

const ACTIVITY_TEMPLATES: Omit<ActivityEntry, "timestamp">[] = [
  { label: "Joined via landing page", detail: "Organic search — 'prop firm challenge' campaign", icon: "join" },
  { label: "Opened email campaign", detail: "Q4 challenge promotion — opened 3 times", icon: "email" },
  { label: "Clicked affiliate link", detail: "Affiliate code 'BONUS50' applied at checkout", icon: "click" },
  { label: "Requested demo", detail: "Booked a 15-minute onboarding call with Sarah", icon: "demo" },
  { label: "Deal moved to opportunity", detail: "100k challenge — awaiting first deposit", icon: "deal" },
];

function activityFor(c: CrmContact): ActivityEntry[] {
  const seed = hashStr(c.id);
  // Pick 3-5 entries deterministically based on the contact hash + stage.
  const count = 3 + (seed % 3);
  const created = new Date(c.lastInteraction).getTime();
  const out: ActivityEntry[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = ACTIVITY_TEMPLATES[(seed + i) % ACTIVITY_TEMPLATES.length];
    // Spread timestamps backwards from last interaction.
    const ts = new Date(created - i * 86_400_000).toISOString();
    out.push({ ...tpl, timestamp: ts });
  }
  return out;
}

interface MockDeal {
  id: string;
  name: string;
  amount: number;
  stage: "qualified" | "negotiation" | "closed-won" | "closed-lost";
}

const DEAL_NAMES = ["100k Challenge", "50k Reset Bundle", "Affiliate Boost Pack", "Annual Pro Tier"];

function dealsFor(c: CrmContact): MockDeal[] {
  const seed = hashStr(c.id);
  // Stage 'opportunity' or 'customer' contacts get deals; 'lead'/'churned' don't.
  if (c.stage === "lead" || c.stage === "churned") return [];
  const count = (seed % 3) + 1; // 1–3 deals
  const out: MockDeal[] = [];
  for (let i = 0; i < count; i++) {
    const stages: MockDeal["stage"][] = ["qualified", "negotiation", "closed-won", "closed-lost"];
    out.push({
      id: `deal-${c.id}-${i}`,
      name: DEAL_NAMES[(seed + i) % DEAL_NAMES.length],
      amount: 500 + ((seed >>> (i + 1)) % 8) * 500,
      stage: c.stage === "customer" ? "closed-won" : stages[(seed >>> (i + 2)) % stages.length],
    });
  }
  return out;
}

const DEAL_STAGE_COLOR: Record<MockDeal["stage"], string> = {
  qualified: "#94a3b8",
  negotiation: "#f59e0b",
  "closed-won": "#059669",
  "closed-lost": "#dc2626",
};

const ACTIVITY_ICON = {
  join: UserPlus,
  email: Mail,
  click: Activity,
  demo: Phone,
  deal: Briefcase,
} as const;

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function CrmOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);
  const leads = contacts.filter((c) => c.stage === "lead").length;
  const qualified = contacts.filter((c) => c.stage === "qualified").length;
  const customers = contacts.filter((c) => c.stage === "customer").length;
  const churned = contacts.filter((c) => c.stage === "churned").length;
  const pipelineValue = contacts.filter((c) => c.stage !== "churned").reduce((s, c) => s + c.value, 0);

  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const pipelineData = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));

  const handleExport = () => {
    exportToCsv(
      contacts,
      [
        { key: "name", header: "Name", value: (c) => c.name },
        { key: "email", header: "Email", value: (c) => c.email },
        { key: "phone", header: "Phone", value: (c) => c.phone ?? "" },
        { key: "source", header: "Source", value: (c) => c.source },
        { key: "stage", header: "Stage", value: (c) => c.stage },
        { key: "owner", header: "Owner", value: (c) => c.owner },
        { key: "value", header: "Value", value: (c) => c.value },
        { key: "lastInteraction", header: "Last Interaction", value: (c) => c.lastInteraction },
      ],
      `crm-contacts-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="CRM"
        description={`Contacts, leads, and pipeline for this ${term("trader").toLowerCase()} tenant.`}
        icon={Contact}
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
          <MetricCard label="Total Contacts" value={contacts.length} delta={5} icon={Users} tone="positive" />
          <MetricCard label="Leads" value={leads} delta={9} icon={UserPlus} />
          <MetricCard label="Qualified" value={qualified} delta={7} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Customers" value={customers} delta={3} icon={Crown} tone="positive" />
          <MetricCard label="Churned" value={churned} delta={-2} icon={UserMinus} tone="negative" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Pipeline by Stage</p>
            <BarSeries data={pipelineData} xKey="name" yKey="value" color="#0891b2" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Pipeline Value</p>
              <Badge variant="secondary" className="text-xs">{formatCurrency(pipelineValue, currency)}</Badge>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              {stages.map((stage) => {
                const count = contacts.filter((c) => c.stage === stage).length;
                const value = contacts.filter((c) => c.stage === stage).reduce((s, c) => s + c.value, 0);
                const total = contacts.length || 1;
                return (
                  <div key={stage} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{stage}</span>
                      <span className="font-medium text-foreground">
                        {count} · {formatCurrency(value, currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(count / total) * 100}%`, background: STAGE_COLOR[stage] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function CrmContactsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);

  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [notes, setNotes] = useState("");

  const columns: Column<CrmContact>[] = [
    { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    { key: "email", header: "Email", cell: (c) => <span className="text-xs text-muted-foreground">{c.email}</span>, sortValue: (c) => c.email },
    { key: "source", header: "Source", cell: (c) => c.source, sortValue: (c) => c.source },
    {
      key: "stage",
      header: "Stage",
      cell: (c) => (
        <Badge variant="outline" className="capitalize" style={{ color: STAGE_COLOR[c.stage], borderColor: STAGE_COLOR[c.stage] }}>
          {c.stage}
        </Badge>
      ),
      sortValue: (c) => c.stage,
    },
    { key: "owner", header: "Owner", cell: (c) => c.owner, sortValue: (c) => c.owner },
    { key: "value", header: "Value", cell: (c) => <span className="font-semibold">{formatCurrency(c.value, currency)}</span>, sortValue: (c) => c.value },
    {
      key: "lastInteraction",
      header: "Last Interaction",
      cell: (c) => <span className="text-xs text-muted-foreground">{new Date(c.lastInteraction).toLocaleDateString()}</span>,
      sortValue: (c) => c.lastInteraction,
    },
  ];

  // Memoised derived data for the selected contact.
  const activity = useMemo(
    () => (selectedContact ? activityFor(selectedContact) : []),
    [selectedContact],
  );
  const deals = useMemo(
    () => (selectedContact ? dealsFor(selectedContact) : []),
    [selectedContact],
  );

  // Reset notes when opening a new contact (use the contact's existing notes
  // as the seed value).
  const openContact = (c: CrmContact) => {
    setSelectedContact(c);
    setNotes(c.notes ?? "");
  };

  return (
    <Page>
      <PageHeader title="Contacts" description={`All CRM contacts for this ${term("trader").toLowerCase()} tenant.`} icon={Users} />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Contacts ({contacts.length})</p>
          <DataTable
            columns={columns}
            data={contacts}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.name} ${c.email} ${c.source} ${c.stage} ${c.owner}`}
            searchPlaceholder="Search contacts…"
            emptyTitle="No contacts yet"
            emptyDescription="Add your first contact or import a list to start."
            onRowClick={(c) => openContact(c)}
          />
        </div>
      </PageContent>

      {/* Contact Detail Sheet drawer (§27 — quick inspection + contextual actions) */}
      <Sheet
        open={!!selectedContact}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedContact(null);
            setNotes("");
          }
        }}
      >
        <SheetContent className="sm:max-w-[600px] overflow-y-auto" side="right">
          {selectedContact && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-muted text-foreground text-xs">
                        {selectedContact.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <SheetTitle className="text-lg truncate">{selectedContact.name}</SheetTitle>
                      <SheetDescription className="mt-1 truncate">
                        {selectedContact.email}
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="capitalize shrink-0"
                    style={{ color: STAGE_COLOR[selectedContact.stage], borderColor: STAGE_COLOR[selectedContact.stage] }}
                  >
                    {selectedContact.stage}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">{selectedContact.source}</Badge>
                  <span>Owner: <span className="text-foreground font-medium">{selectedContact.owner}</span></span>
                  {selectedContact.phone && (
                    <span>Phone: <span className="text-foreground font-medium">{selectedContact.phone}</span></span>
                  )}
                </div>
              </SheetHeader>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2 px-4 py-3">
                <div className="rounded-lg border p-2 text-center">
                  <DollarSign className="h-3 w-3 mx-auto text-emerald-600 mb-1" />
                  <div className="text-[10px] text-muted-foreground">Pipeline Value</div>
                  <div className="text-xs font-medium truncate">{formatCurrency(selectedContact.value, currency)}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <Activity className="h-3 w-3 mx-auto text-amber-600 mb-1" />
                  <div className="text-[10px] text-muted-foreground">Last Contact</div>
                  <div className="text-xs font-medium">{relativeTime(selectedContact.lastInteraction)}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <Briefcase className="h-3 w-3 mx-auto text-rose-600 mb-1" />
                  <div className="text-[10px] text-muted-foreground">Deals</div>
                  <div className="text-xs font-medium">{deals.length}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                {/* Activity timeline (§29 — chronological context) */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Activity Timeline</h4>
                  <ol className="space-y-3 border-l border-border pl-4">
                    {activity.map((e, i) => {
                      const Icon = ACTIVITY_ICON[e.icon];
                      return (
                        <li key={i} className="relative">
                          <span className="absolute -left-[21px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-border bg-background">
                            <Icon className="h-2 w-2 text-muted-foreground" />
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">{e.label}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {relativeTime(e.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{e.detail}</p>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <Separator />

                {/* Deal list */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Deals ({deals.length})</h4>
                  {deals.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-muted/20 p-3 text-center">
                      <p className="text-xs text-muted-foreground">No deals yet — convert this contact to start a challenge.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {deals.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{d.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{d.id}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold">{formatCurrency(d.amount, currency)}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] capitalize"
                              style={{ color: DEAL_STAGE_COLOR[d.stage], borderColor: DEAL_STAGE_COLOR[d.stage] }}
                            >
                              {d.stage.replace("-", " ")}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Notes</h4>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this contact..."
                    className="min-h-[80px]"
                    aria-label="Contact notes"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={notes === (selectedContact.notes ?? "")}
                      onClick={() =>
                        toast({
                          title: "Notes saved (demo)",
                          description: `Notes updated for ${selectedContact.name}.`,
                        })
                      }
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Convert to Trader (demo)",
                      description: `${selectedContact.name} would be promoted to a ${term("trader")} account.`,
                    });
                  }}
                >
                  <UserCheck className="h-3 w-3" /> Convert to {term("trader")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast({
                      title: "Task added (demo)",
                      description: `Follow-up task created for ${selectedContact.name}.`,
                    })
                  }
                >
                  <Plus className="h-3 w-3" /> Add Task
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to permanently delete {selectedContact.name} ({selectedContact.email}).
                      </AlertDialogDescription>
                      <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                        <span className="font-medium">Consequence:</span> The contact record, notes,
                        and deal associations will be removed. This action is irreversible and will
                        be logged in the audit trail.
                      </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          toast({
                            title: "Contact deleted (demo)",
                            description: `${selectedContact.name} has been removed.`,
                            variant: "destructive",
                          });
                          setSelectedContact(null);
                          setNotes("");
                        }}
                        className="bg-rose-600 text-white hover:bg-rose-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

export function CrmPipelinePage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);

  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const pipelineData = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));

  return (
    <Page>
      <PageHeader title="Pipeline" description={`Lead → Qualified → Opportunity → ${term("challenge")} journey.`} icon={GitBranch} />
      <PageContent>
        {/* Stage flow visualization */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Pipeline Stages</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {stages.map((stage, i) => {
              const stageContacts = contacts.filter((c) => c.stage === stage);
              const value = stageContacts.reduce((s, c) => s + c.value, 0);
              return (
                <div key={stage} className="relative">
                  {i < stages.length - 1 && (
                    <div className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 -translate-y-1/2 bg-border md:block" />
                  )}
                  <div className="rounded-lg border p-3" style={{ borderColor: STAGE_COLOR[stage] }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_COLOR[stage] }} />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stage}</span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stageContacts.length}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(value, currency)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Contacts per Stage</p>
          <BarSeries data={pipelineData} xKey="name" yKey="value" color="#0891b2" />
        </div>
      </PageContent>
    </Page>
  );
}
