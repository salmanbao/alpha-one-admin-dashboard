"use client";

/**
 * M3.3 — Consent & Suppression Center (spec §7.3).
 * Consent ledger (per contact/channel/source/timestamp with evidence)
 * and a suppression list for hard bounces, complaints, manual and
 * legal holds. Dedupe-on-import report.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { ShieldCheck, Plus, Download, Upload, Trash2, FileSearch } from "lucide-react";
import {
  listConsent, listSuppression, addSuppression, removeSuppression, consentStats,
  CONSENT_CHANNEL_LABEL, SUPPRESSION_REASON_LABEL,
  type ConsentRecord, type SuppressionEntry, type SuppressionReason, type ConsentChannel,
} from "../segments-store";

export function ConsentCenterPage() {
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const stats = consentStats();
  const [chFilter, setChFilter] = useState<ConsentChannel | "all">("all");
  const [stFilter, setStFilter] = useState<"all"|"granted"|"withdrawn">("all");
  const [evidence, setEvidence] = useState<ConsentRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SuppressionEntry | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [form, setForm] = useState({ contact: "", reason: "manual" as SuppressionReason, note: "", source: "Admin action" });

  const consent = useMemo(() => listConsent().filter((c) => (chFilter === "all" || c.channel === chFilter) && (stFilter === "all" || c.status === stFilter)), [chFilter, stFilter]);
  const suppression = listSuppression();

  const consentCols: Column<ConsentRecord>[] = [
    { key: "contact", header: "Contact", sortValue: (c) => c.contact, cell: (c) => <span className="font-mono text-xs">{c.contact}</span> },
    { key: "channel", header: "Channel", sortValue: (c) => c.channel, cell: (c) => <span className="text-xs">{CONSENT_CHANNEL_LABEL[c.channel]}</span> },
    { key: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <StatusBadge tone={c.status === "granted" ? "success" : "muted"}>{c.status}</StatusBadge> },
    { key: "source", header: "Source", cell: (c) => <span className="text-xs"><span className="capitalize">{c.source}</span><span className="block text-[10px] text-muted-foreground">{c.origin}</span></span> },
    { key: "ts", header: "Timestamp", sortValue: (c) => c.timestamp, cell: (c) => <span className="text-xs" title={absoluteTime(c.timestamp)}>{relativeTime(c.timestamp)}</span> },
    { key: "ev", header: "Evidence", cell: (c) => <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setEvidence(c)}><FileSearch className="mr-1 h-3 w-3" />View</Button> },
  ];

  const suppCols: Column<SuppressionEntry>[] = [
    { key: "contact", header: "Contact", sortValue: (s) => s.contact, cell: (s) => <span className="font-mono text-xs">{s.contact}</span> },
    { key: "reason", header: "Reason", sortValue: (s) => s.reason, cell: (s) => <StatusBadge tone={s.reason === "legal" ? "danger" : s.reason === "complaint" ? "warning" : "muted"}>{SUPPRESSION_REASON_LABEL[s.reason]}</StatusBadge> },
    { key: "by", header: "Added by", cell: (s) => <span className="text-xs">{s.addedBy}</span> },
    { key: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => <span className="text-xs" title={absoluteTime(s.date)}>{relativeTime(s.date)}</span> },
    { key: "source", header: "Source", cell: (s) => <span className="text-xs">{s.source}</span> },
    { key: "actions", header: "", cell: (s) => <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => { setRemoveTarget(s); setRemoveReason(""); }}><Trash2 className="mr-1 h-3 w-3" />Remove</Button> },
  ];

  return (
    <Page>
      <PageHeader title="Consent & Suppression" description="Opt-ins, withdrawals, evidence and the suppression ledger that gates every send." icon={ShieldCheck}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => toast({ title: "CSV import complete", description: "Dedupe report: 42 added · 6 duplicates skipped · 3 invalid rows rejected (rows 8, 19, 41)." })}><Upload className="mr-1 h-4 w-4" />Import CSV</Button><Button variant="outline" size="sm" onClick={() => toast({ title: "Ledger exported", description: "Consent ledger CSV downloaded (dummy)." })}><Download className="mr-1 h-4 w-4" />Export ledger</Button><Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-4 w-4" />Add suppression</Button></div>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Consent coverage" value={`${stats.coverage}%`} tone={stats.coverage < 70 ? "warning" : "positive"} />
          <MetricCard label="Withdrawals (30d)" value={String(stats.withdrawals30d)} />
          <MetricCard label="Suppressions (30d)" value={String(stats.suppressions30d)} />
          <MetricCard label="Pending evidence scans" value={String(stats.pendingScans)} tone={stats.pendingScans > 0 ? "warning" : "positive"} />
        </div>

        <Tabs defaultValue="ledger">
          <TabsList><TabsTrigger value="ledger">Consent ledger</TabsTrigger><TabsTrigger value="suppression">Suppression list</TabsTrigger></TabsList>

          <TabsContent value="ledger" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Select value={chFilter} onValueChange={(v) => setChFilter(v as ConsentChannel | "all")}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All channels</SelectItem>{(Object.keys(CONSENT_CHANNEL_LABEL) as ConsentChannel[]).map((c) => <SelectItem key={c} value={c}>{CONSENT_CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={stFilter} onValueChange={(v) => setStFilter(v as "all"|"granted"|"withdrawn")}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="granted">Granted</SelectItem><SelectItem value="withdrawn">Withdrawn</SelectItem></SelectContent>
              </Select>
            </div>
            {listConsent().length === 0 ? <EmptyState title="No consent records yet" description="Opt-ins land here with source and evidence as contacts subscribe." icon={ShieldCheck} /> :
              <DataTable columns={consentCols} data={consent} rowKey={(c) => c.id} searchableText={(c) => `${c.contact} ${c.channel} ${c.origin}`} pageSize={10} emptyTitle="No records match" emptyDescription="Adjust filters." />}
          </TabsContent>

          <TabsContent value="suppression" className="mt-4">
            {suppression.length === 0 ? <EmptyState title="Suppression list is clear" description="Bounces, complaints and manual holds appear here." icon={ShieldCheck} /> :
              <DataTable columns={suppCols} data={suppression} rowKey={(s) => s.id} searchableText={(s) => `${s.contact} ${s.reason} ${s.source}`} pageSize={10} emptyTitle="No suppressions" />}
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Evidence dialog */}
      <Dialog open={!!evidence} onOpenChange={(o) => !o && setEvidence(null)}>
        <DialogContent><DialogHeader><DialogTitle>Consent evidence</DialogTitle><DialogDescription>Audit reference for this consent record.</DialogDescription></DialogHeader>
          {evidence && <div className="space-y-1 text-sm"><p><span className="text-muted-foreground">Contact:</span> <span className="font-mono">{evidence.contact}</span></p><p><span className="text-muted-foreground">Channel:</span> {CONSENT_CHANNEL_LABEL[evidence.channel]}</p><p><span className="text-muted-foreground">Status:</span> {evidence.status}</p><p><span className="text-muted-foreground">Source:</span> {evidence.source} — {evidence.origin}</p><p><span className="text-muted-foreground">Captured:</span> {absoluteTime(evidence.timestamp)}</p><p><span className="text-muted-foreground">Evidence ID:</span> <code className="rounded bg-muted px-1 text-xs">{evidence.evidence}</code></p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setEvidence(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add suppression */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add suppression</DialogTitle><DialogDescription>Prevent this contact from receiving sends on any channel.</DialogDescription></DialogHeader>
          <div className="space-y-3"><div><Label className="text-xs">Contact (masked or identifier)</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="e.g. us***@mail.com" className="mt-1" /></div>
            <div><Label className="text-xs">Reason</Label><Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v as SuppressionReason })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(SUPPRESSION_REASON_LABEL) as SuppressionReason[]).map((r) => <SelectItem key={r} value={r}>{SUPPRESSION_REASON_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="mt-1" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={!form.contact.trim()} onClick={() => { addSuppression({ contact: form.contact.trim(), reason: form.reason, addedBy: "You", source: form.source, note: form.note || undefined }); recordAudit({ action: "suppression.add", entity: "suppression", entityId: form.contact, summary: `Suppressed ${form.contact} (${form.reason}).`, module: "marketing" }); toast({ title: "Contact suppressed", description: form.contact }); setAddOpen(false); setForm({ contact: "", reason: "manual", note: "", source: "Admin action" }); refresh(); }}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove suppression */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove suppression?</AlertDialogTitle><AlertDialogDescription asChild><div className="space-y-2 text-sm"><p>This re-enables sending to <span className="font-mono">{removeTarget?.contact}</span>. Provide a reason for the audit trail.</p><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="Reason for removal" rows={2} /></div></AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!removeReason.trim()} onClick={() => { if (removeTarget) { removeSuppression(removeTarget.id); recordAudit({ action: "suppression.remove", entity: "suppression", entityId: removeTarget.id, summary: `Removed suppression for ${removeTarget.contact}: ${removeReason}`, module: "marketing" }); toast({ title: "Suppression removed", description: removeTarget.contact }); refresh(); } }}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
