"use client";
/** R2-11 — Cross-Tenant Message Archive / e-Discovery (archive + detail). */
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
import { recordAudit } from "@/lib/platform/console-store";
import { Archive, FolderLock, Download } from "lucide-react";

interface Msg { id:string; tenant:string; channel:string; to:string; campaign:string; status:string; snapshot:string; sentAt:string; legalHold:boolean }
const SEED: Msg[] = Array.from({length:30},(_,i)=>({id:`xt-${100+i}`,tenant:["Alpha Funded","Beta Prop","Gamma"][i%3],channel:["email","sms","push"][i%3],to:`u${i}@ex.com`,campaign:["Q4 Scale","Win-back"][i%2],status:i%5===0?"bounced":"delivered",snapshot:`snp-${100+i}`,sentAt:new Date(Date.now()-i*7200000).toISOString(),legalHold:i===4}));

export function CrossTenantArchivePage(){
  const [tenant,setTenant]=useState(""); const [q,setQ]=useState(""); const [detail,setDetail]=useState<Msg|null>(null);
  const [caseName,setCaseName]=useState(""); const [cases,setCases]=useState<Array<{name:string;ids:string[]}>>([]);
  const [accessLog,setAccessLog]=useState<string[]>(["operator opened archive view"]);
  const rows = useMemo(()=>SEED.filter(m=>(!tenant||m.tenant===tenant) && (!q||`${m.to} ${m.campaign} ${m.tenant}`.toLowerCase().includes(q.toLowerCase()))),[tenant,q]);
  function log(msg:string){ const line=`${new Date().toLocaleTimeString()} — ${msg}`; setAccessLog(l=>[line,...l]); recordAudit({action:"archive.access",target:"cross-tenant-archive",actor:"operator",detail:msg,severity:"info"}); }
  const cols: Column<Msg>[] = [
    {key:"id",header:"Message",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>{setDetail(r); log(`opened ${r.id} (${r.tenant})`);}}>{r.id}<span className="block text-[10px] text-muted-foreground">{r.tenant} · {r.campaign}</span></button>},
    {key:"ch",header:"Channel",cell:r=>r.channel},
    {key:"to",header:"Recipient",cell:r=><span className="text-xs">{r.to}</span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="delivered"?"success":"danger"}>{r.status}</StatusBadge>},
    {key:"hold",header:"Hold",cell:r=>r.legalHold?<StatusBadge tone="warning">hold</StatusBadge>:"—"},
  ];
  return (
    <Page>
      <PageHeader title="Cross-Tenant Message Archive (e-Discovery)" description="Search sent marketing traffic across tenants (platform.archive perms). Every search/open is audit-logged; case folders export deterministic bundles." icon={Archive}
        actions={<Button size="sm" variant="outline" onClick={()=>{log(`exported ${rows.length} results`); toast({title:"Case export (sealed)",description:"Bundle includes messages + consent receipts + campaign approval trail (N6 snapshots) as PDF/ZIP (dummy)."});}}><Download className="mr-1 h-4 w-4"/>Export bundle</Button>} />
      <PageContent>
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">Access log (who opened what): strict audit. Tenant filter respects View-As permission model. <span className="font-mono">{accessLog[0]}</span></div>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Results" value={String(rows.length)}/><MetricCard label="Tenants in scope" value={String(new Set(rows.map(r=>r.tenant)).size)}/><MetricCard label="Case folders" value={String(cases.length)}/></div>
        <div className="flex flex-wrap gap-2"><Select value={tenant||"all"} onValueChange={v=>{setTenant(v==="all"?"":v); log(`filtered tenant=${v}`);}}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Tenant"/></SelectTrigger><SelectContent><SelectItem value="all">All tenants (permitted)</SelectItem>{["Alpha Funded","Beta Prop","Gamma"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="max-w-sm"/><Input value={caseName} onChange={e=>setCaseName(e.target.value)} placeholder="New case folder name" className="w-[200px]"/><Button size="sm" variant="outline" disabled={!caseName.trim()} onClick={()=>{setCases(c=>[...c,{name:caseName.trim(),ids:rows.map(r=>r.id)}]); log(`created case folder ${caseName.trim()} (${rows.length} msgs)`); toast({title:"Case folder created"}); setCaseName("");}}><FolderLock className="mr-1 h-3 w-3"/>Create case</Button></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10}/>
        {cases.length>0&&<Card><CardContent className="p-2 text-xs"><p className="font-semibold mb-1">Case folders (legal hold on case prevents tenant-side purge)</p>{cases.map(c=><div key={c.name} className="flex justify-between border-b py-1"><span>{c.name} ({c.ids.length})</span><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{log(`exported case ${c.name}`); toast({title:"Deterministic export",description:"Messages + consent receipts + N6 approval trail."});}}>Export</Button></div>)}</CardContent></Card>}
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-xl overflow-y-auto"><SheetHeader><SheetTitle>{detail?.id} ({detail?.tenant})</SheetTitle><SheetDescription>Tenant context header; bundle includes consent + N6 approval trail.</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-2 text-xs"><Card><CardContent className="p-2"><p><strong>Tenant:</strong> {detail.tenant}</p><p>Campaign: {detail.campaign} · Snapshot: {detail.snapshot}</p><p>Recipient: {detail.to} · Status: {detail.status}</p></CardContent></Card><Card><CardContent className="p-2"><p className="font-semibold">Rendered snapshot (as sent)</p><pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2">Exact content for {detail.id} ({detail.snapshot})</pre></CardContent></Card><Card><CardContent className="p-2"><p className="font-semibold">Included in export bundle</p><ul className="list-disc pl-4"><li>Consent receipt refs (N10)</li><li>Campaign approval trail + snapshots (N6, R2-F04)</li><li>Delivery timeline</li></ul></CardContent></Card></div>}
      </SheetContent></Sheet>
    </Page>
  );
}
