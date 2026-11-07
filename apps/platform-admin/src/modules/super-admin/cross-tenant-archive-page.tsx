"use client";
/**
 * R2-11 — Cross-Tenant Message Archive / e-Discovery (round-3 depth uplift).
 *
 * The "export bundle (dummy)" and "deterministic export (dummy)" toasts
 * (R3-F05) become sealed export bundles built in the store: bundle ID +
 * SHA-256 seal over the deterministic scope, downloadable as a PDF evidence
 * book or a JSON manifest carrying consent refs (N10), approval trails (N6)
 * and hold state. Case folders keep the seal of their last hand-over.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/platform/console-store";
import { Archive, FolderLock, Download, ShieldCheck } from "lucide-react";
import { downloadText } from "./bundle-utils";
import {
  listMessages, listCases, createCase, exportSelection, exportCaseBundle,
  useArchiveStoreVersion, type ArchivedMsg, type BundleFormat,
} from "./cross-tenant-archive-store";

export function CrossTenantArchivePage(){
  const { user } = usePlatform();
  useArchiveStoreVersion(); // case creation + seals bump the store
  const actor = user?.name ?? "operator";
  const [tenant,setTenant]=useState("");
  const [q,setQ]=useState("");
  const [format,setFormat]=useState<BundleFormat>("pdf");
  const [detail,setDetail]=useState<ArchivedMsg|null>(null);
  const [caseName,setCaseName]=useState("");
  const cases = listCases();
  const [accessLog,setAccessLog]=useState<string[]>(["operator opened archive view"]);

  const rows = useMemo(()=>listMessages({tenant:tenant||undefined,text:q||undefined}),[tenant,q]);
  function log(msg:string){ const line=`${new Date().toLocaleTimeString()} — ${msg}`; setAccessLog(l=>[line,...l]); recordAudit({action:"archive.access",target:"cross-tenant-archive",actor, detail:msg,severity:"info"}); }

  function runBundle(ids:string[], label:string, scopeNote:string){
    const res = exportSelection(ids, label, format, actor);
    if(!res.ok){ toast({title:"Nothing to export",description:"No messages in the current scope.",variant:"destructive"}); return; }
    downloadText(res.content,res.filename,res.mime);
    log(`exported sealed bundle ${res.bundleId} (${scopeNote}, ${format})`);
    toast({
      title:`Sealed bundle ${res.bundleId}`,
      description:`${res.count} message(s) · sha256:${res.seal.slice(0,16)}… · ${res.filename} — seal is deterministic over the scope, so a re-export compares equal.`,
    });
  }

  const cols: Column<ArchivedMsg>[] = [
    {key:"id",header:"Message",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>{setDetail(r); log(`opened ${r.id} (${r.tenant})`);}}>{r.id}<span className="block text-[10px] font-normal text-muted-foreground">{r.tenant} · {r.campaign}</span></button>},
    {key:"ch",header:"Channel",cell:r=>r.channel},
    {key:"to",header:"Recipient",cell:r=><span className="text-xs">{r.to}</span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="delivered"?"success":"danger"}>{r.status}</StatusBadge>},
    {key:"hold",header:"Hold",cell:r=>r.legalHold?<StatusBadge tone="warning">hold</StatusBadge>:"—"},
  ];

  return (
    <Page>
      <PageHeader title="Cross-Tenant Message Archive (e-Discovery)" description="Search sent marketing traffic across tenants (platform.archive perms). Every search/open is audit-logged; case folders export sealed, deterministic bundles." icon={Archive}
        actions={
          <div className="flex items-center gap-2">
            <Select value={format} onValueChange={v=>setFormat(v as BundleFormat)}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF book</SelectItem>
                <SelectItem value="manifest">JSON manifest</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={rows.length===0} onClick={()=>runBundle(rows.map(r=>r.id),`search: ${tenant||"all tenants"}${q?` "${q}"`:""}`,`${rows.length} results`)}><Download className="mr-1 h-4 w-4"/>Export bundle</Button>
          </div>
        } />
      <PageContent>
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">Access log (who opened what): strict audit. Tenant filter respects View-As permission model. <span className="font-mono">{accessLog[0]}</span></div>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Results" value={String(rows.length)}/><MetricCard label="Tenants in scope" value={String(new Set(rows.map(r=>r.tenant)).size)}/><MetricCard label="Case folders" value={String(cases.length)}/></div>
        <div className="flex flex-wrap gap-2"><Select value={tenant||"all"} onValueChange={v=>{setTenant(v==="all"?"":v); log(`filtered tenant=${v}`);}}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Tenant"/></SelectTrigger><SelectContent><SelectItem value="all">All tenants (permitted)</SelectItem>{["Alpha Funded","Beta Prop","Gamma"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="max-w-sm"/><Input value={caseName} onChange={e=>setCaseName(e.target.value)} placeholder="New case folder name" className="w-[200px]"/><Button size="sm" variant="outline" disabled={!caseName.trim()} onClick={()=>{const c=createCase(caseName.trim(),rows.map(r=>r.id),actor); log(`created case folder ${c.name} (${c.ids.length} msgs)`); toast({title:"Case folder created",description:`${c.name} — ${c.ids.length} message(s), scope frozen for sealing.`}); setCaseName("");}}><FolderLock className="mr-1 h-3 w-3"/>Create case</Button></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10}/>
        {cases.length>0&&<Card><CardContent className="p-2 text-xs space-y-1">
          <p className="font-semibold">Case folders (legal hold on case prevents tenant-side purge)</p>
          {cases.map(c=>(
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5">
              <span className="min-w-0">
                <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">({c.ids.length} msgs · by {c.createdBy} · {new Date(c.createdAt).toLocaleDateString()})</span>
                {c.sealed && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3"/>
                    sealed {c.sealed.format.toUpperCase()} · <code>sha256:{c.sealed.seal.slice(0,12)}…</code> · {c.sealed.bundleId} · {new Date(c.sealed.at).toLocaleString()}
                  </span>
                )}
                {!c.sealed && <span className="block text-[10px] text-muted-foreground">not yet exported</span>}
              </span>
              <span className="flex shrink-0 gap-1">
                <span className="hidden text-[10px] text-muted-foreground sm:inline">{format}</span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{
                  const res = exportCaseBundle(c.id, format, actor);
                  if(!res.ok) return;
                  downloadText(res.content,res.filename,res.mime);
                  log(`exported case ${c.name} (${res.bundleId})`);
                  toast({title:`Case sealed — ${res.bundleId}`,description:`${c.name}: ${res.count} message(s) + consent refs (N10) + approval trail (N6) · sha256:${res.seal.slice(0,16)}… · deterministic re-export compares equal.`});
                }}>Export</Button>
              </span>
            </div>
          ))}
        </CardContent></Card>}
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-xl overflow-y-auto"><SheetHeader><SheetTitle>{detail?.id} ({detail?.tenant})</SheetTitle><SheetDescription>Tenant context header; bundle includes consent + N6 approval trail.</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs"><Card><CardContent className="p-2"><p><strong>Tenant:</strong> {detail.tenant}</p><p>Campaign: {detail.campaign} · Snapshot: {detail.snapshot}</p><p>Recipient: {detail.to} · Status: {detail.status} · Sent {new Date(detail.sentAt).toLocaleString()}</p>{detail.legalHold&&<p className="mt-1 text-amber-700 dark:text-amber-400">Under legal hold — tenant-side purge blocked.</p>}</CardContent></Card><Card><CardContent className="p-2"><p className="font-semibold">Rendered snapshot (as sent)</p><pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2">{detail.body}</pre></CardContent></Card><Card><CardContent className="p-2"><p className="font-semibold">Included in export bundle</p><ul className="list-disc pl-4"><li>Consent receipt (N10): <code>{detail.consentRef}</code></li><li>Campaign approval trail + snapshot (N6, R2-F04): <code>{detail.approvalRef}</code></li><li>Delivery timeline + hold state</li></ul></CardContent></Card>
          <Button size="sm" variant="outline" onClick={()=>runBundle([detail.id],`message ${detail.id}`,"1 message")}><Download className="mr-1 h-3 w-3"/>Export this message (sealed)</Button>
        </div>}
      </SheetContent></Sheet>
    </Page>
  );
}
