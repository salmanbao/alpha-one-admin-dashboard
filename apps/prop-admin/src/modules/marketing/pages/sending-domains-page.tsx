"use client";

/**
 * N3 — Sending Domains & Authentication (Wave 1, P0).
 * Register sending/bounce domains and verify SPF, DKIM, DMARC with
 * copyable DNS records. Unverified domains block campaign scheduling.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Globe2, Plus, Copy, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { listSendingDomains, addSendingDomain, verifyDomain, hasBlockingDomain, type SendingDomain } from "../channel-infra-store";

const tone = (s: string): "success"|"danger"|"warning"|"muted" => s==="verified"||s==="ok"?"success":s==="failed"||s==="mismatch"?"danger":s==="pending"||s==="missing"?"warning":"muted";

function RecRow({ label, r }: { label: string; r: { status: string; record?: string; selector?: string; policy?: string; verifiedAt?: string } }) {
  return (
    <div className="rounded border p-2">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold">{label}{r.selector?` (${r.selector})`:""}{r.policy?` · ${r.policy}`:""}</p><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge></div>
      <div className="mt-1 flex items-start gap-2"><code className="flex-1 break-all rounded bg-muted px-2 py-1 text-[10px]">{r.record ?? "Add this record at your DNS provider, then verify."}</code>
        {r.record && <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={()=>{ navigator.clipboard?.writeText(r.record!); toast({title:"Copied",description:`${label} record copied.`}); }}><Copy className="h-3 w-3" /></Button>}</div>
      {r.verifiedAt && <p className="mt-1 text-[10px] text-muted-foreground">Verified {relativeTime(r.verifiedAt)}</p>}
    </div>
  );
}

export function SendingDomainsPage() {
  const [, tick] = useState(0);
  const rows = listSendingDomains();
  const [detail, setDetail] = useState<SendingDomain | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ domain: "", type: "sending" as "sending"|"bounce" });
  const blocking = hasBlockingDomain();

  const cols: Column<SendingDomain>[] = [
    { key:"domain", header:"Domain", sortValue:r=>r.domain, cell:r=><button type="button" className="font-mono text-xs text-primary hover:underline" onClick={()=>setDetail(r)}>{r.domain}</button> },
    { key:"type", header:"Type", cell:r=><Badge variant="outline" className="text-[9px]">{r.type}</Badge> },
    { key:"spf", header:"SPF", cell:r=><StatusBadge tone={tone(r.spf.status)}>{r.spf.status}</StatusBadge> },
    { key:"dkim", header:"DKIM", cell:r=><StatusBadge tone={tone(r.dkim.status)}>{r.dkim.status}</StatusBadge> },
    { key:"dmarc", header:"DMARC", cell:r=><StatusBadge tone={tone(r.dmarc.status)}>{r.dmarc.status}</StatusBadge> },
    { key:"status", header:"Aggregate", cell:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
    { key:"check", header:"Last check", sortValue:r=>r.lastCheck, cell:r=><span className="text-xs">{relativeTime(r.lastCheck)}</span> },
    { key:"a", header:"", cell:r=><Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={()=>{ const d=verifyDomain(r.id); recordAudit({action:"domain.verify",entity:"sending-domain",entityId:r.id,summary:`Verified ${r.domain}: SPF ${d?.spf.status}, DKIM ${d?.dkim.status}, DMARC ${d?.dmarc.status}.`,module:"marketing"}); toast({title:"Verification run",description:`${r.domain} checked (simulated).`}); setDetail(d??null); tick(n=>n+1); }}><RefreshCw className="mr-1 h-3 w-3" />Verify</Button> },
  ];

  const verified = rows.filter(r=>r.status==="verified").length;

  return (
    <Page>
      <PageHeader title="Sending Domains & Authentication" description="Register domains and verify SPF, DKIM, DMARC. Unverified domains block campaign scheduling." icon={Globe2}
        actions={<Button size="sm" onClick={()=>setAddOpen(true)}><Plus className="mr-1 h-4 w-4" />Add domain</Button>} />
      <PageContent>
        {blocking && <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /><div><p className="font-medium">Campaign scheduling blocked</p><p className="text-xs text-muted-foreground">One or more domains are not fully verified (SPF/DKIM/DMARC). Verify them before scheduling email campaigns.</p></div></div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Domains" value={String(rows.length)} />
          <MetricCard label="Verified" value={String(verified)} tone={verified===rows.length&&rows.length>0?"positive":"warning"} />
          <MetricCard label="Blocking scheduling" value={blocking?"Yes":"No"} tone={blocking?"negative":"positive"} />
        </div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} searchableText={r=>`${r.domain} ${r.type}`} pageSize={8} emptyTitle="No domains" onRowClick={setDetail} />
      </PageContent>

      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detail && <><SheetHeader><SheetTitle className="font-mono">{detail.domain}</SheetTitle><SheetDescription>{detail.type} domain · {detail.status} · last check {relativeTime(detail.lastCheck)}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">Copy each DNS record to your provider, then run Verify. Provider guidance: align the Return-Path (bounce) domain with SPF and sign mail with DKIM using the selector shown.</p>
              <RecRow label="SPF" r={detail.spf} />
              <RecRow label="DKIM" r={detail.dkim} />
              <RecRow label="DMARC" r={detail.dmarc} />
              <div className="rounded border p-2 text-xs"><p className="font-semibold mb-1">Verification history</p><p className="text-muted-foreground">Created {absoluteTime(detail.createdAt)} · Last checked {absoluteTime(detail.lastCheck)}{detail.spf.verifiedAt?` · SPF ok ${relativeTime(detail.spf.verifiedAt)}`:""}.</p></div>
              <Button className="w-full" onClick={()=>{ const d=verifyDomain(detail.id); recordAudit({action:"domain.verify",entity:"sending-domain",entityId:detail.id,summary:`Re-verified ${detail.domain}.`,module:"marketing"}); toast({title:"Re-verified"}); setDetail(d??null); tick(n=>n+1); }}><RefreshCw className="mr-1 h-4 w-4" />Re-verify all records</Button>
            </div></>}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add sending domain</DialogTitle><DialogDescription>Register a domain and generate SPF/DKIM/DMARC records to verify.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Domain</Label><Input value={form.domain} onChange={e=>setForm({...form,domain:e.target.value})} placeholder="mail.example.com" className="mt-1 font-mono text-xs" /></div>
            <div><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={v=>setForm({...form,type:v as any})}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sending">Sending domain</SelectItem><SelectItem value="bounce">Bounce/Return-Path domain</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button><Button disabled={!form.domain.trim()} onClick={()=>{ const rec=addSendingDomain(form.domain.trim().toLowerCase(), form.type); recordAudit({action:"domain.add",entity:"sending-domain",entityId:rec.id,summary:`Added ${rec.domain} (${rec.type}).`,module:"marketing"}); toast({title:"Domain added",description:"DNS records generated — copy and verify."}); setDetail(rec); setAddOpen(false); setForm({domain:"",type:"sending"}); tick(n=>n+1); }}>Add & generate records</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
