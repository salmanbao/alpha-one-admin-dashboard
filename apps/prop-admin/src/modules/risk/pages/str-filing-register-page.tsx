"use client";
/**
 * R3-01 — STR / SAR Filing Register.
 *
 * Register table (filing ID, linked case, type, FIU, status, deadline clock,
 * four-eyes filer/approver), filing sheet (narrative editor with template
 * prompts, snapshotted evidence, attachments, regulator-interaction timeline,
 * links back to the frozen case and its payout holds) and the compliance
 * strip with the late-filing warning escalated into the risk alerts queue
 * (AC-3).
 */
import { useEffect, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FileText, Clock, Send, AlertTriangle, Paperclip, ExternalLink, Lock } from "lucide-react";
import { listAmlAlerts, getAmlCase } from "../aml-store";
import { payoutsHeldByCase } from "@/modules/payouts/payout-store";
import {
  listFilings,
  getFiling,
  filingStripMetrics,
  isFilingOverdue,
  syncFilingEscalations,
  createFilingFromCase,
  updateFilingNarrative,
  submitFiling,
  recordFilingInteraction,
  closeFiling,
  useStrFilingVersion,
  defaultNarrativeForCase,
  FILING_REGULATORS,
  type StrFiling,
  type FilingStatus,
  type FilingType,
} from "../str-filing-store";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const STATUS_TONE: Record<FilingStatus, Tone> = {
  draft: "muted",
  submitted: "info",
  acknowledged: "success",
  rfi: "warning",
  closed: "default",
};

const INTERACTION_KINDS: Array<{ value: "note" | "rfi" | "ack" | "response"; label: string }> = [
  { value: "note", label: "Note" },
  { value: "rfi", label: "Regulator RFI (opens RFI clock)" },
  { value: "ack", label: "Acknowledgement (with ack ref)" },
  { value: "response", label: "Response to RFI" },
];

function deadlineInfo(due: string) {
  const ms = new Date(due).getTime() - Date.now();
  const d = Math.round(ms / 86_400_000);
  if (ms < 0) return { text: `${Math.abs(d)}d overdue`, tone: "danger" as const };
  if (d <= 1) return { text: d <= 0 ? "due today" : "1d left", tone: "warning" as const };
  return { text: `${d}d left`, tone: "default" as const };
}

export function StrFilingRegisterPage() {
  const { navigate, user, pushNotification } = usePlatform();
  // Gates: read via route permission; create/edit = compliance.str.manage;
  // submit = compliance.aml.approve four-eyes (AC-2).
  const canManage = hasPermission(user, "compliance.str.manage");
  const canApprove = hasPermission(user, "compliance.aml.approve");
  useStrFilingVersion();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // AC-3 — the deadline clock escalates overdue filings into the risk alerts
  // queue once each (store stamps escalatedAt + writes the audit entry).
  useEffect(() => {
    const { newlyEscalated } = syncFilingEscalations();
    for (const f of newlyEscalated) {
      pushNotification({
        title: "STR filing overdue",
        message: `${f.type} ${f.id} (${f.caseId}) — follow-up deadline passed for ${f.regulator}.`,
        severity: "critical",
        module: "risk",
        actionLabel: "Open register",
        actionHref: "str-filings",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filings = listFilings();
  const metrics = filingStripMetrics();
  const overdue = filings.filter(isFilingOverdue);
  const rows = statusFilter === "all" ? filings : filings.filter((f) => f.status === statusFilter);
  const selected = selectedId ? getFiling(selectedId) : undefined;

  const cols: Column<StrFiling>[] = [
    {
      key: "id",
      header: "Filing",
      cell: (f) => (
        <div className="min-w-0">
          <span className="font-mono text-sm font-medium">{f.id}</span>
          <span className="block text-[10px] text-muted-foreground">
            {f.type} · created {new Date(f.createdAt).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      key: "case",
      header: "AML Case",
      cell: (f) => (
        <button
          type="button"
          className="text-left text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate("aml-case", { id: f.caseId });
          }}
        >
          {f.caseId}
          <span className="block text-[10px] font-normal text-muted-foreground">
            {getAmlCase(f.caseId)?.typology ?? "case"}
          </span>
        </button>
      ),
    },
    { key: "regulator", header: "Regulator / FIU", cell: (f) => <span className="text-xs">{f.regulator}</span> },
    {
      key: "status",
      header: "Status",
      cell: (f) => <StatusBadge tone={STATUS_TONE[f.status]}>{f.status === "rfi" ? "RFI open" : f.status}</StatusBadge>,
    },
    {
      key: "deadline",
      header: "Follow-up clock",
      cell: (f) => {
        const live = f.status === "draft" || f.status === "submitted" || f.status === "rfi";
        const info = deadlineInfo(f.followUpDue);
        const tone: Tone = !live ? "muted" : info.tone === "danger" && isFilingOverdue(f) ? "danger" : info.tone;
        return (
          <span className={cn("flex items-center gap-1 text-xs font-medium", tone === "danger" && "text-destructive", tone === "warning" && "text-amber-700 dark:text-amber-400", tone === "muted" && "text-muted-foreground font-normal")}>
            <Clock className="h-3 w-3 shrink-0" />
            {live ? info.text : new Date(f.followUpDue).toLocaleDateString()}
            {f.escalatedAt && <Badge variant="outline" className="border-rose-500/40 text-[9px] text-rose-700 dark:text-rose-400">escalated</Badge>}
          </span>
        );
      },
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (f) => (
        <span className="text-xs">{f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : "—"}</span>
      ),
    },
    { key: "ack", header: "Ack ref", cell: (f) => <span className="font-mono text-xs">{f.ackRef ?? "—"}</span> },
    {
      key: "eyes",
      header: "Filer → approver",
      cell: (f) => (
        <span className="text-xs">
          {f.filer} →{" "}
          {f.approver ? (
            <strong>{f.approver}</strong>
          ) : (
            <span className="text-muted-foreground">pending four-eyes</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="STR / SAR Filing Register"
        description="What was filed, with whom, when, and what happened next — deadlines, RFIs and four-eyes sign-off."
        icon={FileText}
        actions={
          <Button
            size="sm"
            disabled={!canManage}
            title={canManage ? undefined : "Requires compliance.str.manage"}
            onClick={() => setCreating(true)}
          >
            <FileText className="h-4 w-4" /> New filing from case
          </Button>
        }
      />
      <PageContent>
        <div className="space-y-3">
          {/* Compliance dashboard strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Due ≤ 30 days" value={metrics.dueIn30} icon={Clock} tone={metrics.dueIn30 > 0 ? "warning" : "positive"} />
            <MetricCard label="Open RFIs" value={metrics.openRfi} icon={FileText} tone={metrics.openRfi > 0 ? "warning" : "positive"} />
            <MetricCard label="Avg time-to-file" value={`${metrics.avgTimeToFile}d`} icon={Send} />
            <MetricCard label="Overdue filings" value={metrics.overdue} icon={AlertTriangle} tone={metrics.overdue > 0 ? "negative" : "positive"} />
          </div>

          {/* AC-3 late-filing warning (escalated into the risk alerts queue) */}
          {overdue.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">Late-filing warning:</span>
              <span>
                {overdue.map((f) => f.id).join(", ")} passed the follow-up deadline — escalated into the risk alerts queue and audit-logged.
              </span>
            </div>
          )}

          <DataTable
            columns={cols}
            data={rows}
            rowKey={(f) => f.id}
            onRowClick={(f) => setSelectedId(f.id)}
            searchableText={(f) => `${f.id} ${f.caseId} ${f.regulator} ${f.type} ${f.status} ${f.filer}`}
            searchPlaceholder="Search filings…"
            pageSize={10}
            toolbar={
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {(["draft", "submitted", "acknowledged", "rfi", "closed"] as FilingStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "rfi" ? "RFI open" : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{rows.length} filing(s)</span>
              </div>
            }
            emptyTitle="No filings match"
            emptyDescription="Adjust the status filter, or draft a filing from an AML case."
          />
        </div>
      </PageContent>

      {/* Filing sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && (
            <FilingSheet
              filing={selected}
              canManage={canManage}
              canApprove={canApprove}
              onOpenCase={(id) => {
                setSelectedId(null);
                navigate("aml-case", { id });
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* New filing sheet */}
      <Sheet open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <NewFilingSheet
          canManage={canManage}
          onCancel={() => setCreating(false)}
          onCreated={(f) => {
            setCreating(false);
            setSelectedId(f.id);
          }}
        />
      </Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Filing sheet — narrative, evidence snapshot, interactions, actions  */
/* ------------------------------------------------------------------ */

function FilingSheet({
  filing,
  canManage,
  canApprove,
  onOpenCase,
}: {
  filing: StrFiling;
  canManage: boolean;
  canApprove: boolean;
  onOpenCase: (caseId: string) => void;
}) {
  const { user } = usePlatform();
  const [narrative, setNarrative] = useState(filing.narrative);
  const [dirty, setDirty] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [kind, setKind] = useState<(typeof INTERACTION_KINDS)[number]["value"]>("note");
  const [detail, setDetail] = useState("");
  const [ackRef, setAckRef] = useState("");

  const live = filing.status === "draft" || filing.status === "submitted" || filing.status === "rfi";
  const info = deadlineInfo(filing.followUpDue);
  const held = payoutsHeldByCase(filing.caseId);
  const caseDoc = getAmlCase(filing.caseId);
  const editable = canManage && filing.status === "draft";

  const record = () => {
    if (!detail.trim()) return;
    const ok = recordFilingInteraction(filing.id, kind, detail.trim(), user?.name ?? "operator", {
      ackRef: kind === "ack" ? ackRef.trim() || undefined : undefined,
    });
    if (ok) {
      toast({ title: "Interaction recorded", description: `${filing.id} — ${kind}` });
      setDetail("");
      setAckRef("");
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{filing.id}</span>
          <Badge variant="outline">{filing.type}</Badge>
          <StatusBadge tone={STATUS_TONE[filing.status]}>{filing.status === "rfi" ? "RFI open" : filing.status}</StatusBadge>
          {filing.escalatedAt && <StatusBadge tone="danger">overdue · escalated</StatusBadge>}
        </SheetTitle>
        <SheetDescription>
          {filing.regulator} · case{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => onOpenCase(filing.caseId)}>
            {filing.caseId}
          </button>{" "}
          · filer {filing.filer}
          {filing.approver ? ` → approver ${filing.approver}` : " (four-eyes pending)"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        {/* Deadline clock */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs",
            live && info.tone === "danger" && isFilingOverdue(filing)
              ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-border bg-muted/40",
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">Follow-up due {new Date(filing.followUpDue).toLocaleDateString()}</span>
          {live && <span>{info.text}</span>}
          {filing.ackRef && <span className="font-mono">Ack: {filing.ackRef}</span>}
          {held.length > 0 && (
            <span className="text-destructive">{held.length} payout hold(s): {held.map((p) => p.reference).join(", ")}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {filing.status === "draft" && (
            <Button
              size="sm"
              disabled={!canApprove}
              title={canApprove ? undefined : "Requires compliance.aml.approve (four-eyes)"}
              onClick={() => setConfirmSubmit(true)}
            >
              <Send className="h-3.5 w-3.5" /> Submit to regulator
            </Button>
          )}
          {live && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage}
              title={canManage ? undefined : "Requires compliance.str.manage"}
              onClick={() => {
                if (closeFiling(filing.id, user?.name ?? "operator")) {
                  toast({ title: "Filing closed", description: `${filing.id} marked closed.` });
                }
              }}
            >
              Close filing
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onOpenCase(filing.caseId)}>
            <ExternalLink className="h-3.5 w-3.5" /> Open frozen case
          </Button>
        </div>

        {/* Narrative editor (locked for non-drafts) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`narr-${filing.id}`} className="text-xs uppercase text-muted-foreground">
              Narrative
            </Label>
            {!editable && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                {filing.status === "draft" ? "read-only (requires compliance.str.manage)" : "filed — immutable record"}
              </span>
            )}
          </div>
          <Textarea
            id={`narr-${filing.id}`}
            rows={10}
            className="font-mono text-xs"
            value={narrative}
            readOnly={!editable}
            onChange={(e) => {
              setNarrative(e.target.value);
              setDirty(true);
            }}
          />
          {editable && dirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateFilingNarrative(filing.id, narrative, user?.name ?? "operator");
                  setDirty(false);
                  toast({ title: "Narrative saved", description: `${filing.id} draft updated.` });
                }}
              >
                Save narrative
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setNarrative(filing.narrative); setDirty(false); }}>
                Revert
              </Button>
            </div>
          )}
        </div>

        {/* Evidence snapshot (AC-1) */}
        <div className="rounded-md border p-3 text-xs space-y-2">
          <p className="font-semibold uppercase text-muted-foreground">
            Evidence snapshot · {new Date(filing.evidence.capturedAt).toLocaleString()}
          </p>
          <p>
            <strong>{filing.evidence.typology}</strong> ({filing.evidence.risk} risk) · {filing.evidence.traderName || "(subject at snapshot)"} ·{" "}
            {filing.evidence.currency} {filing.evidence.amount.toLocaleString()}
          </p>
          <div>
            <p className="mb-1 text-muted-foreground">Amount trail</p>
            {filing.evidence.amountTrail.length === 0 && <p className="text-muted-foreground">(no movements snapshotted)</p>}
            {filing.evidence.amountTrail.map((m, i) => (
              <div key={i} className="flex justify-between border-b py-0.5">
                <span>
                  {m.type} · {m.method} <span className="text-muted-foreground">{m.note}</span>
                </span>
                <span className="font-mono">{m.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-muted-foreground">Screening evidence</p>
            {filing.evidence.screening.length === 0 && <p className="text-muted-foreground">(none snapshotted)</p>}
            {filing.evidence.screening.map((s, i) => (
              <p key={i}>
                {s.provider}: <strong>{s.result}</strong> — {s.detail}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Paperclip className="h-3 w-3" /> Attachments (from case documents):
            </span>
            {filing.evidence.attachments.map((a) => (
              <Badge key={a} variant="outline" className="font-mono text-[10px]">{a}</Badge>
            ))}
          </div>
        </div>

        {/* Regulator interaction timeline */}
        <div className="rounded-md border p-3 text-xs space-y-2">
          <p className="font-semibold uppercase text-muted-foreground">Regulator interactions</p>
          <div className="space-y-1">
            {filing.interactions.map((it, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-24 shrink-0 text-muted-foreground">{new Date(it.at).toLocaleDateString()}</span>
                <span>
                  <Badge variant={it.kind === "rfi" || it.kind === "escalation" ? "destructive" : "outline"} className="mr-1 text-[9px]">
                    {it.kind}
                  </Badge>
                  <strong>{it.actor}</strong>: {it.detail}
                </span>
              </div>
            ))}
          </div>
          {live && (
            <div className="space-y-2 border-t pt-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Interaction type</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERACTION_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {kind === "ack" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Ack reference</Label>
                    <Input value={ackRef} onChange={(e) => setAckRef(e.target.value)} placeholder="e.g. NCA-ACK-12345" className="h-8 text-xs" />
                  </div>
                )}
              </div>
              <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Interaction detail (required)" className="text-xs" />
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage || !detail.trim()}
                title={canManage ? undefined : "Requires compliance.str.manage"}
                onClick={record}
              >
                Record interaction
              </Button>
            </div>
          )}
        </div>

        {/* Four-eyes submit confirmation (AC-2) */}
        <AlertDialog open={confirmSubmit} onOpenChange={(o) => !o && setConfirmSubmit(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit {filing.type} {filing.id}?</AlertDialogTitle>
              <AlertDialogDescription>
                Four-eyes (AC-2): this submits to <strong>{filing.regulator}</strong> and is audit-logged with you
                ({user?.name}) as the approver — requires compliance.aml.approve. The linked case moves to
                sar_filed and the narrative becomes an immutable record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (submitFiling(filing.id, { approver: user?.name ?? "operator" })) {
                    toast({ title: "Filing submitted", description: `${filing.id} → ${filing.regulator} (four-eyes logged).` });
                  }
                }}
              >
                Submit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* New filing sheet — pick a case, type, FIU; narrative from template  */
/* ------------------------------------------------------------------ */

function NewFilingSheet({
  canManage,
  onCancel,
  onCreated,
}: {
  canManage: boolean;
  onCancel: () => void;
  onCreated: (f: StrFiling) => void;
}) {
  const { user } = usePlatform();
  const cases = listAmlAlerts();
  const [caseId, setCaseId] = useState<string>("");
  const [type, setType] = useState<FilingType>("STR");
  const [regulator, setRegulator] = useState<string>(FILING_REGULATORS[0]);
  const [narrative, setNarrative] = useState("");
  const selectedCase = caseId ? getAmlCase(caseId) : undefined;

  const pickCase = (id: string) => {
    setCaseId(id);
    const c = getAmlCase(id);
    // Template prompts: typology, amount trail from case movements,
    // screening evidence snapshots (R3-01 filing sheet spec).
    setNarrative(c ? defaultNarrativeForCase(c) : "");
  };

  const create = () => {
    if (!selectedCase) return;
    const f = createFilingFromCase(selectedCase.id, {
      type,
      regulator,
      narrative,
      filer: user?.name ?? "operator",
    });
    if (!f) {
      toast({ title: "Case unavailable", description: "Pick a valid AML case to file from.", variant: "destructive" });
      return;
    }
    toast({ title: "Draft created", description: `${f.id} — case evidence snapshotted, case narrative locked.` });
    onCreated(f);
  };

  return (
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> New filing from case
        </SheetTitle>
        <SheetDescription>
          Snapshots the frozen case evidence and locks the case narrative (AC-1). Submitting later is
          four-eyes behind compliance.aml.approve.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase text-muted-foreground">Linked AML case</Label>
          <Select value={caseId} onValueChange={pickCase}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Pick a case…" /></SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.id} · {c.typology} ({c.risk})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Filing type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FilingType)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SAR">SAR</SelectItem>
                <SelectItem value="STR">STR</SelectItem>
                <SelectItem value="voluntary">Voluntary disclosure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Regulator / FIU</Label>
            <Select value={regulator} onValueChange={setRegulator}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILING_REGULATORS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCase && (
          <div className="rounded-md border p-2 text-xs text-muted-foreground">
            <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
              <Paperclip className="h-3 w-3" /> Attachments (reused from case documents)
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedCase.kyc.docs.map((d) => (
                <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
              ))}
              <Badge variant="outline" className="font-mono text-[10px]">case-{selectedCase.id}-movements.csv</Badge>
              <Badge variant="outline" className="font-mono text-[10px]">case-{selectedCase.id}-screening.pdf</Badge>
            </div>
            <p className="mt-1">
              Subject: {selectedCase.traderName} · movements: {selectedCase.movements.length} · payout hold:{" "}
              {selectedCase.payoutHold ? "active" : "none"}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="new-narrative" className="text-xs uppercase text-muted-foreground">
            Narrative (template prompts prefilled from the case)
          </Label>
          <Textarea
            id="new-narrative"
            rows={14}
            className="font-mono text-xs"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Pick a case to load the typology / amount-trail / screening template…"
          />
        </div>

        <div className="flex gap-2">
          <Button
            disabled={!canManage || !selectedCase}
            title={canManage ? undefined : "Requires compliance.str.manage"}
            onClick={create}
          >
            Create draft filing
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </SheetContent>
  );
}
