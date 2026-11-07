"use client";
/** R2-08 — Marketing Message Archive (search-first + message sheet, legal hold). */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { Archive, Download, Lock } from "lucide-react";
import { searchArchive, setLegalHold, type ArchivedMessage } from "../message-archive-store";

export function MessageArchivePage(){
  const [q,setQ]=useState(""); const [ch,setCh]=useState(""); const [detail,setDetail]=useState<ArchivedMessage|null>(null); const [,tick]=useState(0);
  const rows = useMemo(()=>searchArchive({text:q,channel:ch||undefined}),[q,ch,tick]);
  const cols: Column<ArchivedMessage>[] = [
    {key:"id",header:"Message",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.id}<span className="block text-[10px] text-muted-foreground">{r.campaign||r.flow||"—"} · {r.channel}</span></button>},
    {key:"to",header:"Recipient",cell:r=><span className="text-xs">{r.to}<span className="block text-[10px] text-muted-foreground">{r.consentState}</span></span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="delivered"?"success":r.status==="bounced"||r.status==="complained"?"danger":"info"}>{r.status}</StatusBadge>},
    {key:"snap",header:"Snapshot",cell:r=><span className="text-[10px] font-mono">{r.snapshotId}</span>},
    {key:"hold",header:"Hold",cell:r=>r.legalHold?<StatusBadge tone="warning">legal hold</StatusBadge>:<span className="text-muted-foreground">—</span>},
    {key:"at",header:"Sent",cell:r=><span className="text-xs">{new Date(r.sentAt).toLocaleString()}</span>},
  ];
  return (
    <Page>
      <PageHeader title="Marketing Message Archive" description="Immutable sent-message evidence (R2-F04 snapshots). Search by channel/campaign/recipient; legal hold prevents purge." icon={Archive}
        actions={<Button size="sm" variant="outline" onClick={()=>{recordAudit({action:"archive.export",entity:"archive",entityId:"bulk",summary:`Exported archive search results (${rows.length})`,module:"marketing"}); toast({title:"Export started",description:"EML/PDF bundle export (dummy, export gated by compliance.archive.export)"});}}><Download className="mr-1 h-4 w-4"/>Export</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Results" value={String(rows.length)}/><MetricCard label="Delivered" value={String(rows.filter(r=>r.status==="delivered").length)} tone="positive"/><MetricCard label="Bounced/complaint" value={String(rows.filter(r=>r.status==="bounced"||r.status==="complained").length)} tone="negative"/><MetricCard label="Legal holds" value={String(rows.filter(r=>r.legalHold).length)} tone="warning"/></div>
        <div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search recipient, campaign, subject, template…" className="max-w-sm"/><Select value={ch||"all"} onValueChange={v=>setCh(v==="all"?"":v)}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Channel"/></SelectTrigger><SelectContent><SelectItem value="all">All channels</SelectItem>{["email","sms","whatsapp","push"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <p className="text-[11px] text-muted-foreground">Retention policy active; legal-hold overrides deletion. Search is indexed (dummy corpus; &lt;1s target at 100k).</p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={12} />
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="w-full sm:max-w-2xl overflow-y-auto"><SheetHeader><SheetTitle>{detail?.id} — {detail?.channel}</SheetTitle><SheetDescription>Exact rendered content as sent (snapshot {detail?.snapshotId}).</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2"><Card><CardContent className="p-2"><p className="text-muted-foreground">Envelope</p><p>From: {detail.envelope.from}</p><p>Provider: {detail.envelope.provider}</p><p>ID: {detail.envelope.messageId}</p></CardContent></Card><Card><CardContent className="p-2"><p className="text-muted-foreground">Consent/linking</p><p>Consent at send: {detail.consentState}</p><p>Receipt: {detail.consentReceiptId||"—"}</p><p>Links: {detail.linkWrap.join(", ")||"—"}</p></CardContent></Card></div>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">HTML snapshot</p><pre className="whitespace-pre-wrap rounded bg-muted p-2">{detail.html}</pre><p className="font-semibold mt-2 mb-1">Text</p><pre className="whitespace-pre-wrap rounded bg-muted p-2">{detail.text}</pre></CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Delivery timeline</p>{detail.deliveryTimeline.map((t,i)=><div key={i}>{new Date(t.at).toLocaleString()} — {t.event}</div>)}</CardContent></Card>
          <div className="flex gap-2"><Button variant="outline" onClick={()=>{recordAudit({action:"archive.export.single",entity:"message",entityId:detail.id,summary:`Exported ${detail.id} as EML/PDF`,module:"marketing"}); toast({title:"Exported",description:"Single message EML/PDF (dummy)."});}}><Download className="mr-1 h-3 w-3"/>Export EML/PDF</Button><Button variant={detail.legalHold?"default":"outline"} onClick={()=>{setLegalHold(detail.id,!detail.legalHold); recordAudit({action:`archive.legal_hold.${!detail.legalHold?"on":"off"}`,entity:"message",entityId:detail.id,summary:`Legal hold ${!detail.legalHold?"set":"removed"} for ${detail.id}`,severity:"warning",module:"marketing"}); setDetail({...detail,legalHold:!detail.legalHold}); tick(n=>n+1); toast({title:!detail.legalHold?"Legal hold set":"Legal hold removed"});}}><Lock className="mr-1 h-3 w-3"/>Legal hold</Button></div>
        </div>}
      </SheetContent></Sheet>
    </Page>
  );
}
