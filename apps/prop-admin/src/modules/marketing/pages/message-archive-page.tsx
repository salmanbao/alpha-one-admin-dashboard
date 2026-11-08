"use client";
/**
 * R2-08 — Marketing Message Archive (round-3 depth uplift).
 *
 * Replaces the narrated export/purge toasts (R3-F05) with store-backed
 * behaviour: the table runs over the full-text index (snippets + matched
 * fields per hit), Export downloads real .eml / .mbox / .pdf evidence
 * files, and the purge job enforces legal hold — refusals are listed with
 * their holding case IDs instead of a "done" toast.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { Archive, Download, Lock, FileText, Trash2, ShieldAlert, Search, ExternalLink } from "lucide-react";
import {
  searchIndex, getArchivedMessage, setLegalHold, purgeJob, exportMessage, exportBundle,
  indexStats, useArchiveVersion, type SearchHit, type PurgeResult, type ArchivedMessage,
} from "../message-archive-store";

type ExportFormat = "eml" | "pdf";

export function MessageArchivePage(){
  const { user, navigate } = usePlatform();
  const canExport = hasPermission(user, "compliance.archive.export");
  const canPurge = hasPermission(user, "compliance.archive.purge");
  const gateExport = canExport ? undefined : "Requires compliance.archive.export";
  const gatePurge = canPurge ? undefined : "Requires compliance.archive.purge";

  const archiveVersion = useArchiveVersion(); // purge / legal-hold mutations bump the store
  const [q,setQ]=useState("");
  const [ch,setCh]=useState("");
  const [st,setSt]=useState("");
  const [holdFilter,setHoldFilter]=useState("all");
  const [detailId,setDetailId]=useState<string|null>(null);
  const [format,setFormat]=useState<ExportFormat>("eml");
  const [purgeOpen,setPurgeOpen]=useState(false);
  const [lastPurge,setLastPurge]=useState<PurgeResult|null>(null);

  const hits = useMemo(()=>searchIndex({
    text:q||undefined, channel:ch||undefined, status:st||undefined,
    legalHold:holdFilter==="held"?true:holdFilter==="free"?false:undefined,
  }),[q,ch,st,holdFilter,archiveVersion]);
  const rows = hits.map(h=>h.message);
  const stats = indexStats();
  const detail = detailId ? getArchivedMessage(detailId) : undefined;

  const download=(content:string,filename:string,mime:string)=>{
    const blob=new Blob([content],{type:`${mime};charset=utf-8`});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; a.style.display="none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runExport=(ids:string[],fmt:ExportFormat,scope:string)=>{
    const res = exportBundle(ids, fmt, user?.name ?? "operator");
    if(!res.ok){ toast({title:"Nothing to export",description:"No messages in the current selection.",variant:"destructive"}); return; }
    download(res.content,res.filename,res.mime);
    toast({title:`Exported ${ids.length} message(s)`,description:`${scope} · ${fmt==="eml"?"EML bundle (.mbox), one RFC 822 message per record":"PDF evidence book"} — ${res.filename}`});
  };

  const cols: Column<ArchivedMessage>[] = [
    {key:"id",header:"Message",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetailId(r.id)}>{r.id}<span className="block text-[10px] font-normal text-muted-foreground">{r.campaign||r.flow||"—"} · {r.channel}</span></button>},
    {key:"to",header:"Recipient",cell:r=><span className="text-xs">{r.to}<span className="block text-[10px] text-muted-foreground">{r.consentState}</span></span>},
    {key:"snippet",header:"Match",cell:r=>{
      const hit = hits.find(h=>h.message.id===r.id);
      if(!hit) return null;
      return (
        <div className="max-w-[320px] min-w-0">
          <p className="line-clamp-2 text-[11px] text-muted-foreground"><Snippet hit={hit}/></p>
          {hit.matchedFields.length>0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {hit.matchedFields.slice(0,3).map(f=><Badge key={f} variant="outline" className="text-[9px]">{f}</Badge>)}
            </div>
          )}
        </div>
      );
    }},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="delivered"?"success":r.status==="bounced"||r.status==="complained"?"danger":"info"}>{r.status}</StatusBadge>},
    {key:"hold",header:"Hold",cell:r=>r.legalHold?<StatusBadge tone="warning" label={r.holdCase?`${r.holdCase.caseId} — ${r.holdCase.reason}`:"legal hold"}>legal hold</StatusBadge>:<span className="text-muted-foreground">—</span>},
    {key:"at",header:"Sent",cell:r=><span className="text-xs">{new Date(r.sentAt).toLocaleString()}</span>},
  ];

  return (
    <Page>
      <PageHeader title="Marketing Message Archive" description="Immutable sent-message evidence (point-in-time snapshots) over a full-text index. Legal hold survives the purge job; exports are real EML/PDF files." icon={Archive}
        actions={
          <div className="flex items-center gap-2">
            <Select value={format} onValueChange={v=>setFormat(v as ExportFormat)}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="eml">EML bundle</SelectItem>
                <SelectItem value="pdf">PDF book</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!canExport||rows.length===0} title={gateExport??"Exports the current result set"}
              onClick={()=>runExport(rows.map(r=>r.id),format,`${rows.length} search result(s)`)}><Download className="mr-1 h-4 w-4"/>Export</Button>
            <Button size="sm" variant="destructive" disabled={!canPurge} title={gatePurge} onClick={()=>setPurgeOpen(true)}><Trash2 className="mr-1 h-4 w-4"/>Purge</Button>
          </div>
        } />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Results" value={String(rows.length)}/>
          <MetricCard label="Delivered" value={String(rows.filter(r=>r.status==="delivered").length)} tone="positive"/>
          <MetricCard label="Bounced/complaint" value={String(rows.filter(r=>r.status==="bounced"||r.status==="complained").length)} tone="negative"/>
          <MetricCard label="Legal holds" value={String(rows.filter(r=>r.legalHold).length)} tone="warning"/>
          <MetricCard label="Index" value={`${stats.documents} docs`} icon={Search}
            action={<span className="text-[10px] text-muted-foreground">{stats.uniqueTokens} tokens · {stats.postings} postings</span>}/>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Full-text search: recipient, campaign, subject, body…" className="max-w-sm"/>
          <Select value={ch||"all"} onValueChange={v=>setCh(v==="all"?"":v)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Channel"/></SelectTrigger><SelectContent><SelectItem value="all">All channels</SelectItem>{["email","sms","whatsapp","push"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={st||"all"} onValueChange={v=>setSt(v==="all"?"":v)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status"/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["sent","delivered","bounced","complained"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={holdFilter} onValueChange={setHoldFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Hold"/></SelectTrigger><SelectContent><SelectItem value="all">Any hold state</SelectItem><SelectItem value="held">Under legal hold</SelectItem><SelectItem value="free">No hold</SelectItem></SelectContent></Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Indexed corpus ({stats.documents} documents, {stats.uniqueTokens} tokens, last built {new Date(stats.indexedAt).toLocaleTimeString()}); retention purge skips held messages and reports the holding case per refusal.
        </p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={12} emptyTitle="No messages match" emptyDescription="Clear the query or widen the channel/status/hold filters."/>

        {lastPurge && (
          <Card>
            <CardContent className="space-y-2 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold"><ShieldAlert className="h-4 w-4"/> Last purge run — {new Date(lastPurge.ranAt).toLocaleString()}</p>
              <p className="text-muted-foreground">
                {lastPurge.purged.length} deleted · {lastPurge.refused.length} refused under legal hold · {lastPurge.keptRecent} kept inside the retention window.
              </p>
              {lastPurge.purged.length>0 && <p className="font-mono text-[11px]">deleted: {lastPurge.purged.join(", ")}</p>}
              {lastPurge.refused.length>0 && (
                <div className="space-y-1">
                  {lastPurge.refused.map(r=>(
                    <p key={r.id} className="flex flex-wrap items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <Lock className="h-3 w-3"/> {r.id} — refused{r.holdCase?<>: holding case <Badge variant="outline" className="font-mono text-[9px]">{r.holdCase}</Badge></>:null} <span className="text-muted-foreground">({r.reason})</span>
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>

      {/* Detail sheet — evidence record + real exports */}
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetailId(null)}><SheetContent className="w-full sm:max-w-2xl overflow-y-auto"><SheetHeader><SheetTitle>{detail?.id} — {detail?.channel}</SheetTitle><SheetDescription>Exact rendered content as sent (snapshot {detail?.snapshotId}).</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2"><Card><CardContent className="p-2"><p className="text-muted-foreground">Envelope</p><p>From: {detail.envelope.from}</p><p>Provider: {detail.envelope.provider}</p><p>ID: {detail.envelope.messageId}</p></CardContent></Card><Card><CardContent className="p-2"><p className="text-muted-foreground">Consent/linking</p><p>Consent at send: {detail.consentState}</p><p>Receipt: {detail.consentReceiptId||"—"}</p><p>Links: {detail.linkWrap.join(", ")||"—"}</p></CardContent></Card></div>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">HTML snapshot</p><pre className="whitespace-pre-wrap rounded bg-muted p-2">{detail.html}</pre><p className="font-semibold mt-2 mb-1">Text</p><pre className="whitespace-pre-wrap rounded bg-muted p-2">{detail.text}</pre></CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Delivery timeline</p>{detail.deliveryTimeline.map((t,i)=><div key={i}>{new Date(t.at).toLocaleString()} — {t.event}</div>)}</CardContent></Card>
          {detail.legalHold && (
            <Card className="border-amber-500/40"><CardContent className="p-2">
              <p className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400"><Lock className="h-3 w-3"/> Under legal hold — excluded from purge</p>
              <p>{detail.holdCase?.reason ?? "Operator hold"}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono">{detail.holdCase?.caseId ?? "hold"}</span>
                {detail.holdCase?.caseId.startsWith("aml") && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>navigate("aml-case",{id:detail.holdCase!.caseId})}><ExternalLink className="mr-1 h-3 w-3"/>Open AML case</Button>
                )}
              </div>
            </CardContent></Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!canExport} title={gateExport} onClick={()=>{const r=exportMessage(detail.id,"eml",user?.name??"operator"); if(r.ok){download(r.content,r.filename,r.mime); toast({title:"Exported .eml",description:`${r.filename} — full RFC 822 multipart message with X-* evidence headers.`});}}}><Download className="mr-1 h-3 w-3"/>Export .eml</Button>
            <Button variant="outline" disabled={!canExport} title={gateExport} onClick={()=>{const r=exportMessage(detail.id,"pdf",user?.name??"operator"); if(r.ok){download(r.content,r.filename,r.mime); toast({title:"Exported .pdf",description:`${r.filename} — evidence record with timeline and snapshots.`});}}}><FileText className="mr-1 h-3 w-3"/>Export .pdf</Button>
            <Button variant={detail.legalHold?"default":"outline"} onClick={()=>{const next=!detail.legalHold; setLegalHold(detail.id,next,next?"Operator hold from archive detail":""); recordAudit({action:`archive.legal_hold.${next?"on":"off"}`,entity:"message",entityId:detail.id,summary:`Legal hold ${next?"set":"removed"} for ${detail.id}`,severity:"warning",module:"marketing"}); setDetailId(null); toast({title:next?"Legal hold set":"Legal hold removed",description:next?"Purge job will refuse this message and name its hold case.":"Message is eligible for the next purge run."});}}><Lock className="mr-1 h-3 w-3"/>Legal hold</Button>
          </div>
        </div>}
      </SheetContent></Sheet>

      {/* Purge confirmation — the job itself enforces legal hold */}
      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run retention purge?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes every message outside the retention window. Messages under legal hold are
              refused by the job and reported with their holding case ID — nothing held is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={()=>{
              const res = purgeJob({olderThanDays:0, actor:user?.name});
              setLastPurge(res); setPurgeOpen(false);
              toast({
                title:`Purge complete — ${res.purged.length} deleted`,
                description:res.refused.length
                  ? `${res.refused.length} refused under legal hold: ${res.refused.map(r=>`${r.id}${r.holdCase?` (${r.holdCase})`:""}`).join(", ")}`
                  : "No messages were under hold.",
                variant:res.refused.length?"destructive":"default",
              });
            }}>Run purge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

/** Highlight the query terms inside a snippet window. */
function Snippet({hit}:{hit:SearchHit}){
  if(!hit.terms.length) return <>{hit.snippet}</>;
  const pattern = hit.terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  const re = new RegExp(`(${pattern})`,"ig");
  const exact = new RegExp(`^(?:${pattern})$`,"i");
  return (
    <>
      {hit.snippet.split(re).map((part,i)=>
        exact.test(part)
          ? <mark key={i} className="bg-yellow-200 text-yellow-950 dark:bg-yellow-500/40 dark:text-yellow-50">{part}</mark>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}
