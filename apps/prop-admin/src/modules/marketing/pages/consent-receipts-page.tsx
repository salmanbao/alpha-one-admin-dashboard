"use client";
/** N10 — Consent Receipts & DSR Queue (depth). Full DSR workflow: verify, fulfill (export/erasure cert), reject, SLA/evidence. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Shield, FileDown, Trash2, Check, X } from "lucide-react";
import { listDSR, verifyDSR, fulfillDSR, rejectDSR, type DSR } from "../marketing-ops-store";
import { listConsent, type ConsentRecord } from "../segments-store";

export function ConsentReceiptsPage() {
  const [, tick] = useState(0);
  const receipts = listConsent();
  const dsrs = listDSR();
  const [act,setAct]=useState<{dsr:DSR;mode:"verify"|"fulfill"|"reject"}|null>(null); const [note,setNote]=useState("");
  const rCols: Column<ConsentRecord>[] = [
    {key:"c",header:"Contact",cell:r=><span className="font-mono text-xs">{r.contact}</span>},
    {key:"ch",header:"Channel",cell:r=><span className="text-xs">{r.channel}</span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="granted"?"success":"muted"}>{r.status}</StatusBadge>},
    {key:"src",header:"Source / wording",cell:r=><span className="text-xs">{r.source} · {r.origin}</span>},
    {key:"ts",header:"When",sortValue:r=>r.timestamp,cell:r=><span className="text-xs">{relativeTime(r.timestamp)}</span>},
    {key:"ev",header:"Evidence",cell:r=><code className="text-[10px]">{r.evidence}</code>},
  ];
  const dCols: Column<DSR>[] = [
    {key:"c",header:"Contact",cell:r=><span className="font-mono text-xs">{r.contact}<span className="block text-[10px] text-muted-foreground">{r.assignee||"unassigned"}</span></span>},
    {key:"t",header:"Type",cell:r=><span className="text-xs flex items-center gap-1">{r.type==="erasure"?<Trash2 className="h-3 w-3" />:<FileDown className="h-3 w-3" />}{r.type}</span>},
    {key:"s",header:"Status",cell:r=><StatusBadge tone={r.status==="done"?"success":r.status==="rejected"?"danger":r.status==="new"?"warning":"info"}>{r.status.replace("_"," ")}</StatusBadge>},
    {key:"sla",header:"SLA due",cell:r=>{const h=Math.round((new Date(r.slaDue).getTime()-Date.now())/3600000); return <StatusBadge tone={h<8?"danger":h<24?"warning":"muted"}>{h}h</StatusBadge>;}},
    {key:"act",header:"Actions",cell:r=><span className="text-[10px] text-muted-foreground">{r.actions.length} step(s)</span>},
    {key:"a",header:"",cell:r=><div className="flex flex-wrap gap-1 justify-end">
      {r.status==="new"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setAct({dsr:r,mode:"verify"});setNote("");}}>Verify ID</Button>}
      {(r.status==="verifying"||r.status==="in_progress")&&<Button size="sm" className="h-6 text-[10px]" onClick={()=>{setAct({dsr:r,mode:"fulfill"});setNote(r.type==="erasure"?"Erasure executed; certificate issued":"Export package generated and delivered");}}><Check className="h-3 w-3 mr-1"/>Fulfill</Button>}
      {r.status!=="done"&&r.status!=="rejected"&&<Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={()=>{setAct({dsr:r,mode:"reject"});setNote("");}}><X className="h-3 w-3"/>Reject</Button>}
    </div>},
  ];
  return (
    <Page>
      <PageHeader title="Consent Receipts & DSR Queue" description="Immutable consent receipts and full DSR workflow (verify identity → fulfill export/erasure with certificate → reject with reason), SLA-tracked." icon={Shield}
        actions={<Button size="sm" variant="outline" onClick={()=>{recordAudit({action:"consent.export",entity:"receipts",entityId:"all",summary:"Exported consent receipts",module:"marketing"}); toast({title:"Receipts exported"});}}>Export receipts</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Receipts" value={String(receipts.length)} /><MetricCard label="Open DSRs" value={String(dsrs.filter(d=>!["done","rejected"].includes(d.status)).length)} tone="warning" /><MetricCard label="Done" value={String(dsrs.filter(d=>d.status==="done").length)} tone="positive" /><MetricCard label="SLA at risk (<8h)" value={String(dsrs.filter(d=>(new Date(d.slaDue).getTime()-Date.now())<8*3600000 && !["done","rejected"].includes(d.status)).length)} tone="negative" />
        </div>
        <Tabs defaultValue="dsr"><TabsList><TabsTrigger value="dsr">DSR queue</TabsTrigger><TabsTrigger value="receipts">Consent receipts</TabsTrigger></TabsList>
          <TabsContent value="dsr" className="mt-3"><DataTable columns={dCols} data={dsrs} rowKey={r=>r.id} pageSize={8} /></TabsContent>
          <TabsContent value="receipts" className="mt-3"><DataTable columns={rCols} data={receipts} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.contact} ${r.channel} ${r.origin}`} /></TabsContent>
        </Tabs>
      </PageContent>
      <Dialog open={!!act} onOpenChange={o=>!o&&setAct(null)}><DialogContent><DialogHeader><DialogTitle>{act?.mode} DSR — {act?.dsr.type}</DialogTitle><DialogDescription>{act?.dsr.contact}. Audited. {act?.mode==="fulfill" && act.dsr.type==="erasure" ? "Issues certificate of erasure." : act?.mode==="fulfill" ? "Generates export package." : "Provide reason/note."}</DialogDescription></DialogHeader>
        <Input value={note} onChange={e=>setNote(e.target.value)} placeholder={act?.mode==="reject"?"Rejection reason (required)":"Note / evidence"} />
        <DialogFooter><Button variant="outline" onClick={()=>setAct(null)}>Cancel</Button><Button disabled={!note.trim()} variant={act?.mode==="reject"?"destructive":"default"} onClick={()=>{if(!act)return; if(act.mode==="verify") verifyDSR(act.dsr.id,note); else if(act.mode==="fulfill") fulfillDSR(act.dsr.id,note); else rejectDSR(act.dsr.id,note); recordAudit({action:`dsr.${act.mode}`,entity:"dsr",entityId:act.dsr.id,summary:`DSR ${act.mode} (${act.dsr.type}) ${act.dsr.contact}: ${note}`,module:"marketing"}); toast({title:`DSR ${act.mode}d`}); setAct(null); tick(n=>n+1);}}>Confirm</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
