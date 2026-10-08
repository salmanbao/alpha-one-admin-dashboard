"use client";

/**
 * CRM Module — pages.
 *
 *   1. CrmOverviewPage  — KPIs + pipeline bar chart
 *   2. CrmContactsPage  — DataTable of contacts (row click → CrmContactSheet drawer)
 *   3. CrmPipelinePage  — Kanban board (5 columns, drag-and-drop, Lead Score badges,
 *                         KPI row, Lead Scoring Methodology card)
 *
 * The CrmContactSheet drawer (§27 — quick inspection + contextual actions) is
 * shared between CrmContactsPage and CrmPipelinePage so cards/rows in either
 * view open the same rich detail panel: avatar + stage badge, KPI strip, activity
 * timeline, deal list, notes textarea, and a footer with Convert / Add Task /
 * Delete actions (the Delete action uses an AlertDialog to satisfy §24 destructive
 * friction requirements).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantContacts, hashStr, type CrmContact } from "@/lib/platform/mock-data";
import { updateCrmContact, deleteCrmContact, useCrmContacts } from "@/modules/crm/crm-store";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { BarSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
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
  MoreHorizontal,
  ArrowRight,
  TrendingUp,
  Award,
  Zap,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STAGE_COLOR: Record<CrmContact["stage"], string> = {
  lead: "#94a3b8",
  qualified: "#0f766e",
  opportunity: "#f59e0b",
  customer: "#059669",
  churned: "#dc2626",
};

const KANBAN_STAGES: CrmContact["stage"][] = [
  "lead",
  "qualified",
  "opportunity",
  "customer",
  "churned",
];

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

/**
 * Deterministic lead score (0–100) derived from contact attributes.
 * No Math.random — every render yields the same score for the same contact.
 *
 * Factors (cumulative):
 *   +50  base
 *   +20  pipeline value > $5,000
 *   +10  pipeline value > $15,000  (stacks with the +20 above)
 *   +15  source is referral or affiliate (case-insensitive)
 *   +15  last interaction < 3 days
 *   +8   last interaction < 7 days  (mutually exclusive with the +15)
 *   -10  last interaction > 30 days
 *   +12  contact has at least one associated deal
 *
 * Final value clamped to 0–100.
 */
function computeLeadScore(contact: CrmContact): number {
  let score = 50;
  if (contact.value && contact.value > 5000) score += 20;
  if (contact.value && contact.value > 15000) score += 10;
  const src = (contact.source ?? "").toLowerCase();
  if (src === "referral" || src === "affiliate") score += 15;
  if (contact.lastInteraction) {
    const daysSince =
      (Date.now() - new Date(contact.lastInteraction).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < 3) score += 15;
    else if (daysSince < 7) score += 8;
    else if (daysSince > 30) score -= 10;
  }
  if (dealsFor(contact).length > 0) score += 12;
  return Math.max(0, Math.min(100, score));
}

type LeadScoreTone = "hot" | "warm" | "cold";

function leadScoreTone(score: number): LeadScoreTone {
  if (score >= 80) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

const LEAD_SCORE_TONE_CLASS: Record<LeadScoreTone, string> = {
  hot: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  warm: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  cold: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};

const LEAD_SCORE_TONE_LABEL: Record<LeadScoreTone, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

/**
 * Inline Lead Score pill — emerald / amber / rose depending on the score.
 * Rendered on every kanban card and inside the Sheet drawer's KPI strip.
 */
function LeadScoreCard({
  contact,
  className,
}: {
  contact: CrmContact;
  className?: string;
}) {
  const score = computeLeadScore(contact);
  const tone = leadScoreTone(score);
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 px-1.5 text-[10px] font-medium", LEAD_SCORE_TONE_CLASS[tone], className)}
      title={`Lead score ${score}/100 — ${LEAD_SCORE_TONE_LABEL[tone]}`}
    >
      <Zap className="h-2.5 w-2.5" />
      <span className="font-mono font-semibold tabular-nums">{score}</span>
      <span className="opacity-80">· {LEAD_SCORE_TONE_LABEL[tone]}</span>
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Shared Contact Sheet drawer (§27)                                  */
/* ------------------------------------------------------------------ */

/**
 * CrmContactSheet — right-side detail drawer for a single CRM contact.
 *
 * Renders the same drawer that previously lived inline in CrmContactsPage
 * (impl-crm-contact-drawer work). Extracted to a shared component so that
 * both CrmContactsPage (table rows) and CrmPipelinePage (kanban cards) can
 * open the same rich detail panel.
 *
 * The outer shell handles Sheet open/close + tenant/currency/term resolution.
 * The body is keyed by `contact.id` so it remounts when the user opens a
 * different contact — the new mount seeds its own `notes` state from the
 * contact's stored notes, avoiding setState-in-effect entirely (which the
 * React Compiler rejects) and naturally resetting the textarea per contact.
 */
function CrmContactSheet({
  contact,
  onClose,
}: {
  contact: CrmContact | null;
  onClose: () => void;
}) {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";

  return (
    <Sheet
      open={!!contact}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[600px] overflow-y-auto" side="right">
        {contact && (
          <CrmContactSheetBody
            key={contact.id}
            contact={contact}
            currency={currency}
            term={term}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CrmContactSheetBody({
  contact,
  currency,
  term,
  onClose,
}: {
  contact: CrmContact;
  currency: string;
  term: ReturnType<typeof makeTermResolver>;
  onClose: () => void;
}) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  // Initialise from the contact's notes on mount only — the parent passes
  // a fresh `key` per contact.id, so this component remounts for each new
  // contact and the initial state is read once per contact.
  const [notes, setNotes] = useState(contact.notes ?? "");

  // Memoise on the whole contact object — when the parent updates the
  // contact (e.g. via drag-and-drop changing its stage), these recompute.
  // The React Compiler infers `contact` as the dependency, which matches
  // the manual dependency array below.
  const activity = useMemo(() => activityFor(contact), [contact]);
  const deals = useMemo(() => dealsFor(contact), [contact]);

  return (
    <div className="flex h-full flex-col">
            <SheetHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-muted text-foreground text-xs">
                      {contact.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="text-lg truncate">{contact.name}</SheetTitle>
                    <SheetDescription className="mt-1 truncate">
                      {contact.email}
                    </SheetDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="capitalize shrink-0"
                  style={{ color: STAGE_COLOR[contact.stage], borderColor: STAGE_COLOR[contact.stage] }}
                >
                  {contact.stage}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">{contact.source}</Badge>
                <span>Owner: <span className="text-foreground font-medium">{contact.owner}</span></span>
                {contact.phone && (
                  <span>Phone: <span className="text-foreground font-medium">{contact.phone}</span></span>
                )}
              </div>
            </SheetHeader>

            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              <div className="rounded-lg border p-2 text-center">
                <DollarSign className="h-3 w-3 mx-auto text-emerald-600 mb-1" />
                <div className="text-[10px] text-muted-foreground">Pipeline Value</div>
                <div className="text-xs font-medium truncate">{formatCurrency(contact.value, currency)}</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <Activity className="h-3 w-3 mx-auto text-amber-600 mb-1" />
                <div className="text-[10px] text-muted-foreground">Last Contact</div>
                <div className="text-xs font-medium">{relativeTime(contact.lastInteraction)}</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <Briefcase className="h-3 w-3 mx-auto text-rose-600 mb-1" />
                <div className="text-[10px] text-muted-foreground">Deals</div>
                <div className="text-xs font-medium">{deals.length}</div>
              </div>
            </div>

            {/* Lead score row (inline above timeline so users see it at a glance) */}
            <div className="flex items-center justify-between gap-2 px-4 pb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Lead Score
              </span>
              <LeadScoreCard contact={contact} />
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
                    disabled={notes === (contact.notes ?? "")}
                    onClick={() => {
                      // Persist to the shared CRM store — reopening the
                      // contact (or viewing Contacts/Pipeline) shows it.
                      updateCrmContact(tid, contact.id, { notes });
                      toast({
                        title: "Notes saved",
                        description: `Notes updated for ${contact.name}.`,
                      });
                    }}
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
                  // Convert = promote the contact to the customer stage in
                  // the shared store — Pipeline/Contacts reflect it instantly.
                  updateCrmContact(tid, contact.id, { stage: "customer" });
                  toast({
                    title: `Converted to ${term("account")}`,
                    description: `${contact.name} moved to the customer stage.`,
                  });
                }}
              >
                <UserCheck className="h-3 w-3" /> Convert to {term("account")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    title: "Task added (demo)",
                    description: `Follow-up task created for ${contact.name}.`,
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
                      You are about to permanently delete {contact.name} ({contact.email}).
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
                        // Mutate the shared store — the contact disappears
                        // from Contacts, Pipeline and overview stats.
                        deleteCrmContact(tid, contact.id);
                        toast({
                          title: "Contact deleted",
                          description: `${contact.name} has been removed.`,
                          variant: "destructive",
                        });
                        onClose();
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
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function CrmOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = useCrmContacts(tid);
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
        description={`Contacts, leads, and pipeline for this ${term("account").toLowerCase()} tenant.`}
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
            <BarSeries data={pipelineData} xKey="name" yKey="value" color="#0f766e" />
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
  const contacts = useCrmContacts(tid);

  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);

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

  return (
    <Page>
      <PageHeader title="Contacts" description={`All CRM contacts for this ${term("account").toLowerCase()} tenant.`} icon={Users} />
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
            onRowClick={(c) => setSelectedContact(c)}
          />
        </div>
      </PageContent>

      {/* Contact detail drawer (§27 — quick inspection + contextual actions) */}
      <CrmContactSheet contact={selectedContact} onClose={() => setSelectedContact(null)} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Kanban helpers                                                      */
/* ------------------------------------------------------------------ */

/** Kanban contact card — draggable, clickable, opens the Sheet drawer. */
function ContactKanbanCard({
  contact,
  currency,
  onOpen,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  contact: CrmContact;
  currency: string;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stage: CrmContact["stage"]) => void;
}) {
  const initials = contact.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", contact.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-md border bg-card p-2.5 shadow-sm transition-all hover:shadow-md hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      aria-label={`Open contact ${contact.name}`}
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{contact.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
        </div>
        {/* Move dropdown (fallback for touch / no-drag users) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Move ${contact.name} to another stage`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Move to…
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {KANBAN_STAGES.filter((s) => s !== contact.stage).map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onMove(s)}
                className="text-xs capitalize"
              >
                <ArrowRight className="h-3 w-3" />
                <span className="ml-1.5 flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-sm"
                    style={{ background: STAGE_COLOR[s] }}
                  />
                  {s}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(contact.value, currency)}
        </span>
        <LeadScoreCard contact={contact} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="text-[10px]">{contact.source}</Badge>
        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 font-normal">
          <Activity className="h-2.5 w-2.5" />
          {relativeTime(contact.lastInteraction)}
        </Badge>
      </div>
    </div>
  );
}

/** Kanban column — a single stage lane. */
function KanbanColumn({
  stage,
  contacts,
  currency,
  draggedOverStage,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardOpen,
  onCardDragStart,
  onCardDragEnd,
  onCardMove,
}: {
  stage: CrmContact["stage"];
  contacts: CrmContact[];
  currency: string;
  draggedOverStage: CrmContact["stage"] | null;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onCardOpen: (c: CrmContact) => void;
  onCardDragStart: (c: CrmContact) => void;
  onCardDragEnd: () => void;
  onCardMove: (c: CrmContact, stage: CrmContact["stage"]) => void;
}) {
  const stageValue = contacts.reduce((s, c) => s + c.value, 0);
  const isDropTarget = draggedOverStage === stage;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
        isDropTarget &&
          "border-emerald-500/60 bg-emerald-50 ring-2 ring-emerald-500/40 dark:bg-emerald-950/30",
      )}
      aria-label={`${stage} stage column with ${contacts.length} contacts`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 rounded-sm shrink-0"
            style={{ background: STAGE_COLOR[stage] }}
            aria-hidden
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground capitalize truncate">
            {stage}
          </span>
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {contacts.length}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {formatCurrency(stageValue, currency)}
        </span>
      </div>

      {/* Cards list — max height with custom scrollbar (§41 long list handling) */}
      <div className="scrollbar-thin flex-1 max-h-[600px] min-h-[120px] overflow-y-auto p-2 space-y-2">
        {contacts.length === 0 ? (
          <div className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              {isDropTarget ? "Drop contact here" : "No contacts in this stage"}
            </p>
          </div>
        ) : (
          contacts.map((c) => (
            <ContactKanbanCard
              key={c.id}
              contact={c}
              currency={currency}
              onOpen={() => onCardOpen(c)}
              onDragStart={() => onCardDragStart(c)}
              onDragEnd={onCardDragEnd}
              onMove={(s) => onCardMove(c, s)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Lead scoring methodology — surfaces the deterministic factors + weights. */
const SCORING_FACTORS: ReadonlyArray<{
  label: string;
  detail: string;
  weight: string;
  tone: string;
}> = [
  {
    label: "Base score",
    detail: "Starting point for every contact.",
    weight: "+50",
    tone: "text-slate-600 dark:text-slate-400",
  },
  {
    label: "Pipeline value > $5,000",
    detail: "Mid-tier deal size.",
    weight: "+20",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Pipeline value > $15,000",
    detail: "High-value deal (stacks with the +20).",
    weight: "+10",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Referral / affiliate source",
    detail: "Higher intent than cold outbound.",
    weight: "+15",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Recent interaction (< 3 days)",
    detail: "Active in the last 72 hours.",
    weight: "+15",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Recent interaction (< 7 days)",
    detail: "Active in the last week (mutually exclusive).",
    weight: "+8",
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    label: "Stale interaction (> 30 days)",
    detail: "No activity for over a month.",
    weight: "−10",
    tone: "text-rose-600 dark:text-rose-400",
  },
  {
    label: "Has associated deals",
    detail: "At least one deal linked to the contact.",
    weight: "+12",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
];

/* ------------------------------------------------------------------ */
/* CrmPipelinePage — Kanban                                            */
/* ------------------------------------------------------------------ */

export function CrmPipelinePage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  // Shared store — Contacts page, Pipeline kanban and the drawer all read
  // the same effective list, so stage moves/notes/deletes stay in sync.
  const contacts = useCrmContacts(tid);

  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [draggedContact, setDraggedContact] = useState<CrmContact | null>(null);
  const [draggedOverStage, setDraggedOverStage] = useState<CrmContact["stage"] | null>(
    null,
  );

  /* KPI computations ------------------------------------------------ */
  const totalPipelineValue = useMemo(
    () => contacts.reduce((s, c) => s + c.value, 0),
    [contacts],
  );
  const openDealsCount = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.stage === "lead" || c.stage === "qualified" || c.stage === "opportunity",
      ).length,
    [contacts],
  );
  const avgDealSize = contacts.length > 0 ? totalPipelineValue / contacts.length : 0;
  const wonCount = useMemo(
    () => contacts.filter((c) => c.stage === "customer").length,
    [contacts],
  );
  const lostCount = useMemo(
    () => contacts.filter((c) => c.stage === "churned").length,
    [contacts],
  );
  const winRate =
    wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

  /* Mutations ------------------------------------------------------- */
  const moveContact = (contact: CrmContact, newStage: CrmContact["stage"]) => {
    if (contact.stage === newStage) return;
    // Mutate the shared CRM store so Contacts/Pipeline stay in sync.
    updateCrmContact(tid, contact.id, { stage: newStage });
    // Keep the open Sheet drawer in sync if the moved contact is currently selected.
    setSelectedContact((prev) =>
      prev && prev.id === contact.id ? { ...prev, stage: newStage } : prev,
    );
    toast({
      title: "Moved",
      description: `${contact.name} → ${newStage}`,
    });
  };

  const handleColumnDrop = (stage: CrmContact["stage"]) => {
    if (draggedContact) {
      moveContact(draggedContact, stage);
      setDraggedContact(null);
      setDraggedOverStage(null);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Pipeline"
        description={`Kanban view of the ${term("account").toLowerCase()} → ${term("challenge")} journey. Drag cards between stages or use the per-card Move menu.`}
        icon={GitBranch}
        actions={
          <Badge variant="secondary" className="text-xs">
            {contacts.length} contacts
          </Badge>
        }
      />
      <PageContent>
        {/* KPI row (§24 — Metric category with deltaLabel explainability) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Pipeline Value"
            value={formatCurrency(totalPipelineValue, currency)}
            icon={DollarSign}
            tone="positive"
            deltaLabel="all stages"
          />
          <MetricCard
            label="Open Deals"
            value={openDealsCount}
            icon={Briefcase}
            deltaLabel="lead → opportunity"
          />
          <MetricCard
            label="Avg Deal Size"
            value={formatCurrency(avgDealSize, currency)}
            icon={TrendingUp}
            deltaLabel="per contact"
          />
          <MetricCard
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            icon={Award}
            tone="positive"
            deltaLabel={`${wonCount} won / ${lostCount} lost`}
          />
        </div>

        {/* Kanban board — horizontal scroll on small viewports, native
            5-col flex row on xl+. Each column is a drop target. */}
        <div
          className="rounded-lg border bg-card p-3"
          aria-label="Pipeline kanban board"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Pipeline Stages</p>
            <p className="text-[10px] text-muted-foreground">
              Drag a card to a column, or use the ⋯ menu on each card.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {KANBAN_STAGES.map((stage) => {
              const stageContacts = contacts.filter((c) => c.stage === stage);
              return (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  contacts={stageContacts}
                  currency={currency}
                  draggedOverStage={draggedOverStage}
                  onDragOver={() => setDraggedOverStage(stage)}
                  onDragLeave={() =>
                    setDraggedOverStage((current) =>
                      current === stage ? null : current,
                    )
                  }
                  onDrop={() => handleColumnDrop(stage)}
                  onCardOpen={(c) => setSelectedContact(c)}
                  onCardDragStart={(c) => setDraggedContact(c)}
                  onCardDragEnd={() => {
                    setDraggedContact(null);
                    setDraggedOverStage(null);
                  }}
                  onCardMove={(c, s) => moveContact(c, s)}
                />
              );
            })}
          </div>
        </div>

        {/* Lead Scoring Methodology card (inline "Lead Scoring page") */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-amber-600" />
              <LabelWithHelp
                help={
                  <>
                    Lead scores are computed deterministically from each
                    contact&apos;s attributes — they do not change between
                    renders. The score is the sum of a 50-point base plus the
                    weighted factors below, clamped to 0–100.
                  </>
                }
              >
                How lead scores are calculated
              </LabelWithHelp>
            </CardTitle>
            <CardDescription>
              Each contact card shows a Lead Score badge with a tone:
              <span className="font-medium text-emerald-600 dark:text-emerald-400"> Hot ≥ 80</span>,
              <span className="font-medium text-amber-600 dark:text-amber-400"> Warm 50–79</span>,
              <span className="font-medium text-rose-600 dark:text-rose-400"> Cold &lt; 50</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SCORING_FACTORS.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {f.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {f.detail}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-[10px] font-semibold tabular-nums",
                      f.tone,
                    )}
                  >
                    {f.weight}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageContent>

      {/* Shared contact detail drawer — same one used by CrmContactsPage */}
      <CrmContactSheet
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </Page>
  );
}
