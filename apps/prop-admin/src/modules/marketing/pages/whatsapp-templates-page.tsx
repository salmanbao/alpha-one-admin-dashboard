"use client";

/**
 * N2 — WhatsApp Template Approval Manager (Wave 1, P0).
 * Manage WhatsApp message templates: submit to Meta, track approval
 * status, variables, category, samples, sync. Composer dependency.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { MessageSquareText, Plus, RefreshCw, Send, Eye } from "lucide-react";
import { listWhatsAppTemplates, submitWhatsAppTemplate, syncWhatsAppTemplates, type WhatsAppTemplate } from "../channel-infra-store";

const tone = (s: string): "success"|"danger"|"warning"|"muted" => s==="approved"?"success":s==="rejected"?"danger":s==="pending"?"warning":"muted";

export function WhatsAppTemplatesPage() {
  const [, tick] = useState(0);
  const rows = listWhatsAppTemplates();
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<WhatsAppTemplate | null>(null);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState({ name: "", category: "MARKETING" as WhatsAppTemplate["category"], language: "en_US", body: "Hi {{1}}, your update: {{2}}", vars: "name, update" });

  const filtered = useMemo(() => rows.filter(r => !q || r.name.includes(q.toLowerCase()) || r.category.includes(q.toUpperCase())), [rows, q]);
  const approved = rows.filter(r=>r.status==="approved").length;
  const pending = rows.filter(r=>r.status==="pending").length;

  const cols: Column<WhatsAppTemplate>[] = [
    { key:"name", header:"Template", sortValue:r=>r.name, cell:r=><button type="button" className="font-mono text-xs text-primary hover:underline" onClick={()=>setDetail(r)}>{r.name}</button> },
    { key:"cat", header:"Category", cell:r=><Badge variant="outline" className="text-[9px]">{r.category}</Badge> },
    { key:"lang", header:"Language", cell:r=><span className="text-xs">{r.language}</span> },
    { key:"status", header:"Status", cell:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
    { key:"vars", header:"Variables", cell:r=><span className="font-mono text-[10px]">{r.variables.map(v=>`{{${v}}}`).join(", ")||"—"}</span> },
    { key:"sync", header:"Last sync", sortValue:r=>r.lastSync, cell:r=><span className="text-xs">{relativeTime(r.lastSync)}</span> },
    { key:"a", header:"", cell:r=><Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={()=>setDetail(r)}><Eye className="mr-1 h-3 w-3" />View</Button> },
  ];

  function doSync() {
    syncWhatsAppTemplates();
    recordAudit({action:"whatsapp.templates.sync",entity:"whatsapp-templates",summary:"Synced WhatsApp templates from Meta.",module:"marketing"});
    toast({title:"Templates synced",description:"Fetched latest approval statuses from Meta (simulated)."});
    tick(n=>n+1);
  }
  function submit() {
    const vars = form.vars.split(",").map(s=>s.trim()).filter(Boolean);
    const rec = submitWhatsAppTemplate({ name: form.name.trim(), providerId:"prov-meta-wa", category: form.category, language: form.language, components:[{type:"BODY", text: form.body}], variables: vars });
    recordAudit({action:"whatsapp.template.submit",entity:"whatsapp-template",entityId:rec.id,summary:`Submitted template ${rec.name} (${rec.category}) for Meta approval.`,module:"marketing"});
    toast({title:"Template submitted",description:`${rec.name} sent to Meta for approval (pending).`});
    setCreate(false); setForm({name:"",category:"MARKETING",language:"en_US",body:"Hi {{1}}, your update: {{2}}",vars:"name, update"});
    tick(n=>n+1);
  }

  return (
    <Page>
      <PageHeader title="WhatsApp Template Manager" description="Create, submit and track WhatsApp templates through Meta approval. Required before WhatsApp sends." icon={MessageSquareText}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={doSync}><RefreshCw className="mr-1 h-4 w-4" />Sync from Meta</Button><Button size="sm" onClick={()=>setCreate(true)}><Plus className="mr-1 h-4 w-4" />New template</Button></div>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Approved" value={String(approved)} tone="positive" />
          <MetricCard label="Pending review" value={String(pending)} tone={pending?"warning":"default"} />
          <MetricCard label="Rejected" value={String(rows.filter(r=>r.status==="rejected").length)} tone={rows.some(r=>r.status==="rejected")?"negative":"default"} />
        </div>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search templates…" className="max-w-sm" />
        <DataTable columns={cols} data={filtered} rowKey={r=>r.id} pageSize={10} emptyTitle="No templates" onRowClick={setDetail} />
        <p className="text-[11px] text-muted-foreground">Only <strong>approved</strong> templates can be used in WhatsApp campaigns. Rejections include Meta’s reason.</p>
      </PageContent>

      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && <><SheetHeader><SheetTitle className="font-mono">{detail.name}</SheetTitle><SheetDescription>{detail.category} · {detail.language} · <StatusBadge tone={tone(detail.status)}>{detail.status}</StatusBadge></SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              {detail.reason && <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive"><strong>Rejection reason:</strong> {detail.reason}</div>}
              <Card><CardContent className="p-3"><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Body</p><p className="text-sm whitespace-pre-wrap">{detail.components.find(c=>c.type==="BODY")?.text ?? "—"}</p></CardContent></Card>
              <div className="rounded border p-2"><p className="text-[10px] uppercase text-muted-foreground">Variables</p><p className="font-mono text-xs">{detail.variables.join(", ")||"—"}</p><p className="text-[10px] text-muted-foreground">Dedup/sample guidance: provide realistic example values when submitting.</p></div>
              <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Submitted</p>{detail.submittedAt?relativeTime(detail.submittedAt):"—"}</div><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Reviewed</p>{detail.reviewedAt?relativeTime(detail.reviewedAt):"—"}</div></div>
              <Button variant="outline" size="sm" onClick={()=>{ toast({title:"Resubmitted",description:`${detail.name} queued for Meta review.`}); }}>Resubmit to Meta</Button>
            </div></>}
        </SheetContent>
      </Sheet>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent><DialogHeader><DialogTitle>New WhatsApp template</DialogTitle><DialogDescription>Submit for Meta approval. Use {"{{1}}"} placeholders in order.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name (snake_case)</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")})} className="mt-1 font-mono text-xs" placeholder="promo_update" /></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">Category</Label><Select value={form.category} onValueChange={v=>setForm({...form,category:v as any})}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["AUTHENTICATION","MARKETING","UTILITY"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Language</Label><Input value={form.language} onChange={e=>setForm({...form,language:e.target.value})} className="mt-1 font-mono text-xs" /></div></div>
            <div><Label className="text-xs">Body</Label><Textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} rows={3} className="mt-1 font-mono text-xs" /></div>
            <div><Label className="text-xs">Variable names (comma-separated)</Label><Input value={form.vars} onChange={e=>setForm({...form,vars:e.target.value})} className="mt-1 font-mono text-xs" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setCreate(false)}>Cancel</Button><Button disabled={!form.name.trim()} onClick={submit}><Send className="mr-1 h-4 w-4" />Submit to Meta</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
