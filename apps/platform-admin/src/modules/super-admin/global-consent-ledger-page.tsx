"use client";
/** R2-10 — Global Consent & Suppression Ledger (cross-tenant). */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Shield, Download } from "lucide-react";

type GState = "suppressed"|"bounced"|"complained"|"opted_out"|"clear";
interface LedgerRow { id:string; identity:string; state:GState; tenants:string[]; evidence:string[]; first:string; latest:string }
const SEED: LedgerRow[] = [
  {id:"g1",identity:"h:9f2a…@mailinator.com",state:"suppressed",tenants:["Alpha Funded","Beta Prop"],evidence:["Tenant A: spam trap hit (N10 rcpt-a1)","Tenant B: complaint"],first:"2026-08-01",latest:"2026-11-01"},
  {id:"g2",identity:"h:ab44…@disposable.test",state:"bounced",tenants:["Gamma"],evidence:["Hard bounce event b-441"],first:"2026-10-12",latest:"2026-10-12"},
  {id:"g3",identity:"h:cc10…+1555",state:"opted_out",tenants:["Alpha Funded"],evidence:["SMS opt-out receipt (N10)"],first:"2026-09-20",latest:"2026-09-20"},
];
const RULES = [{name:"Disposable domains",hits:142,enabled:true},{name:"Role addresses",hits:38,enabled:true},{name:"Seed-list hits",hits:6,enabled:true}];

export function GlobalConsentLedgerPage(){
  const [rows,setRows]=useState(SEED); const [enforce,setEnforce]=useState(true); const [detail,setDetail]=useState<LedgerRow|null>(null);
  const [q,setQ]=useState("");
  function tryAddBlocked(identity:string){
    if(enforce){ recordAudit({action:"suppression.block_readd",target:identity,actor:"operator",detail:`Global enforcement ON: blocked re-add across tenants`,severity:"warning"}); toast({title:"Re-add blocked",description:"Address suppressed on another tenant; attempt logged (AC-1).",variant:"destructive" as any}); }
  }
  const filtered = rows.filter(r=>r.identity.includes(q));
  const cols: Column<LedgerRow>[] = [
    {key:"id",header:"Identity (hashed)",cell:r=><button type="button" className="text-left font-mono text-xs text-primary hover:underline" onClick={()=>setDetail(r)}>{r.identity}</button>},
    {key:"st",header:"Global state",cell:r=><StatusBadge tone={r.state==="clear"?"success":"danger"}>{r.state.replace("_"," ")}</StatusBadge>},
    {key:"ten",header:"Tenants",cell:r=><span className="text-xs">{r.tenants.join(", ")}</span>},
    {key:"ev",header:"Evidence",numeric:true,cell:r=>r.evidence.length},
    {key:"at",header:"Latest",cell:r=><span className="text-xs">{r.latest}</span>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>tryAddBlocked(r.identity)}>Test re-add</Button>},
  ];
  return (
    <Page>
      <PageHeader title="Global Consent & Suppression Ledger" description="Cross-tenant suppression for abuse prevention and regulator queries. Traces to tenant receipts (N10) and delivery events." icon={Shield}
        actions={<Button size="sm" variant="outline" onClick={()=>{recordAudit({action:"suppression.export",target:"ledger",actor:"operator",detail:"ESP-importable suppression export",severity:"info"}); toast({title:"Exported",description:"Provider-importable suppression file (dummy)."});}}><Download className="mr-1 h-4 w-4"/>Export (ESP sync)</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Suppressed/bounced" value={String(rows.filter(r=>r.state!=="clear").length)} tone="warning"/><MetricCard label="Contributing tenants" value="3"/><MetricCard label="Global enforcement" value={enforce?"ON":"OFF"} tone={enforce?"positive":"warning"}/><MetricCard label="Evidence links" value={String(rows.reduce((s,r)=>s+r.evidence.length,0))}/></div>
        <Card><CardContent className="p-3 flex items-center justify-between text-sm"><div><p className="font-semibold">Global vs per-tenant suppression</p><p className="text-xs text-muted-foreground">When ON, an address suppressed on tenant A cannot be re-added as sendable on tenant B (logged).</p></div><Switch checked={enforce} onCheckedChange={v=>{setEnforce(!!v); recordAudit({action:`suppression.enforcement.${v?"on":"off"}`,target:"global",actor:"operator",detail:`Global enforcement ${v?"enabled":"disabled"}`,severity:"warning"});}}/></CardContent></Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search hashed identity…" className="mb-2 max-w-sm"/><DataTable columns={cols} data={filtered} rowKey={r=>r.id} pageSize={8}/></div>
          <Card><CardContent className="p-3 text-xs space-y-2"><p className="font-semibold">Enforcement rules / hit stats</p>{RULES.map(r=><div key={r.name} className="flex justify-between rounded border p-2"><span>{r.name}</span><span className="font-mono">{r.hits} hits</span></div>)}</CardContent></Card>
        </div>
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent><SheetHeader><SheetTitle>{detail?.identity}</SheetTitle><SheetDescription>Every row traces to tenant receipt or delivery event (AC-2).</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-2 text-xs"><p>State: <StatusBadge tone="danger">{detail.state}</StatusBadge></p><p>Tenants: {detail.tenants.join(", ")}</p><p className="font-semibold">Evidence drill-down (→ tenant N10 receipts / events)</p><ul className="list-disc pl-4">{detail.evidence.map(e=><li key={e}>{e}</li>)}</ul></div>}
      </SheetContent></Sheet>
    </Page>
  );
}
