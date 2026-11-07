"use client";
/** N10 — Consent Receipts & DSR Queue (Wave 2, P1). Immutable consent receipts + DSR workflow (export/erasure/objection) with SLA. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Shield, FileDown, Trash2 } from "lucide-react";
import { listDSR, advanceDSR, type DSR } from "../marketing-ops-store";
import { listConsent, type ConsentRecord } from "../segments-store";

export function ConsentReceiptsPage() {
  const [, tick] = useState(0);
  const receipts = listConsent();
  const dsrs = listDSR();
  const rCols: Column<ConsentRecord>[] = [
    {key:"c",header:"Contact",cell:r=><span className="font-mono text-xs">{r.contact}</span>},
    {key:"ch",header:"Channel",cell:r=><span className="text-xs">{r.channel}</span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="granted"?"success":"muted"}>{r.status}</StatusBadge>},
    {key:"src",header:"Source / wording",cell:r=><span className="text-xs">{r.source} · {r.origin}</span>},
    {key:"ts",header:"When",sortValue:r=>r.timestamp,cell:r=><span className="text-xs">{relativeTime(r.timestamp)}</span>},
    {key:"ev",header:"Evidence",cell:r=><code className="text-[10px]">{r.evidence}</code>},
  ];
  const dCols: Column<DSR>[] = [
    {key:"c",header:"Contact",cell:r=><span className="font-mono text-xs">{r.contact}</span>},
    {key:"t",header:"Type",cell:r=><span className="text-xs flex items-center gap-1">{r.type==="erasure"?<Trash2 className="h-3 w-3" />:<FileDown className="h-3 w-3" />}{r.type}</span>},
    {key:"s",header:"Status",cell:r=><StatusBadge tone={r.status==="done"?"success":r.status==="new"?"warning":"info"}>{r.status.replace("_"," ")}</StatusBadge>},
    {key:"sla",header:"SLA due",cell:r=>{const h=Math.round((new Date(r.slaDue).getTime()-Date.now())/3600000); return <StatusBadge tone={h<8?"danger":h<24?"warning":"muted"}>{h}h</StatusBadge>;}},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{advanceDSR(r.id,`Advanced by operator at ${new Date().toLocaleTimeString()}`); recordAudit({action:"dsr.advance",entity:"dsr",entityId:r.id,summary:`Advanced DSR ${r.type} for ${r.contact}.`,module:"marketing"}); toast({title:"DSR advanced"}); tick(n=>n+1);}}>Advance</Button>{r.type==="export"&&<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>toast({title:"Export package generated",description:"Data export package prepared (dummy)."})}>Generate export</Button>}{r.type==="erasure"&&r.status!=="done"&&<Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={()=>toast({title:"Erasure certificate",description:"Certificate of erasure issued on completion (simulated)."})}>Cert. on close</Button>}</div>},
  ];
  return (
    <Page>
      <PageHeader title="Consent Receipts & DSR Queue" description="Immutable consent receipts (who/when/where/source/wording) and data-subject requests with SLA timers." icon={Shield}
        actions={<Button size="sm" variant="outline" onClick={()=>toast({title:"Receipts exported"})}>Export receipts</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Receipts" value={String(receipts.length)} />
          <MetricCard label="Open DSRs" value={String(dsrs.filter(d=>d.status!=="done").length)} tone="warning" />
          <MetricCard label="SLA at risk (<8h)" value={String(dsrs.filter(d=>(new Date(d.slaDue).getTime()-Date.now())<8*3600000 && d.status!=="done").length)} tone="negative" />
        </div>
        <Tabs defaultValue="receipts"><TabsList><TabsTrigger value="receipts">Consent receipts</TabsTrigger><TabsTrigger value="dsr">DSR queue</TabsTrigger></TabsList>
          <TabsContent value="receipts" className="mt-3"><DataTable columns={rCols} data={receipts} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.contact} ${r.channel} ${r.origin}`} /></TabsContent>
          <TabsContent value="dsr" className="mt-3"><DataTable columns={dCols} data={dsrs} rowKey={r=>r.id} pageSize={8} emptyTitle="No DSRs" /></TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
