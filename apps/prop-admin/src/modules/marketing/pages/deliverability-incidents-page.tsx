"use client";
/** R2-09 — Deliverability Incident Center (tenant mirror of N14). */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { listIncidents, resolveIncident, applyPlaybook, type DeliveryIncident } from "../deliverability-incidents-store";

export function DeliverabilityIncidentsPage(){
  const [,tick]=useState(0); const rows=listIncidents(); const [detail,setDetail]=useState<DeliveryIncident|null>(null);
  const openCount=rows.filter(r=>r.status!=="resolved").length;
  const cols: Column<DeliveryIncident>[]=[
    {key:"type",header:"Incident",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.type.replace(/_/g," ")}<span className="block text-[10px] text-muted-foreground">{r.source} · {r.affected.join(", ")}</span></button>},
    {key:"sev",header:"Severity",cell:r=><StatusBadge tone={r.severity==="critical"?"danger":r.severity==="high"?"warning":"info"}>{r.severity}</StatusBadge>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="resolved"?"success":r.status==="mitigating"?"warning":"danger"}>{r.status}</StatusBadge>},
    {key:"at",header:"Detected",cell:r=><span className="text-xs">{new Date(r.detectedAt).toLocaleString()}</span>},
  ];
  return (
    <Page>
      <PageHeader title="Deliverability Incident Center" description="Platform-originated and tenant-detected incidents with playbook actions (audited, feeds the platform incident center)." icon={AlertTriangle} />
      <PageContent>
        {openCount>0&&<Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Active deliverability incident(s)</AlertTitle><AlertDescription>{openCount} open/mitigating incident(s). Playbook actions can pause affected campaigns via composer schedule API (dummy) and are recorded in N11 audit.</AlertDescription></Alert>}
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Open/mitigating" value={String(openCount)} tone={openCount?"negative":"positive"}/><MetricCard label="Platform-originated" value={String(rows.filter(r=>r.source==="platform").length)}/><MetricCard label="Resolved" value={String(rows.filter(r=>r.status==="resolved").length)} tone="positive"/></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8}/>
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-lg overflow-y-auto"><SheetHeader><SheetTitle>{detail?.type.replace(/_/g," ")}</SheetTitle><SheetDescription>{detail?.source} · {detail?.severity} · {detail?.status}</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs"><Card><CardContent className="p-2"><p className="font-semibold">Affected</p><p>{detail.affected.join(", ")}</p></CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Timeline (detection → platform → tenant)</p>{detail.timeline.map((t,i)=><div key={i}>{new Date(t.at).toLocaleString()} — {t.event}</div>)}</CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Playbook (one-click, audited)</p><div className="flex flex-wrap gap-2">{detail.playbook.map(a=><Button key={a} size="sm" variant="outline" className="h-7 text-xs" disabled={detail.status==="resolved"} onClick={()=>{applyPlaybook(detail.id,a); recordAudit({action:"incident.playbook",entity:"incident",entityId:detail.id,summary:`Playbook: ${a} (${detail.id}) — pauses affected campaigns via composer schedule API (dummy)`,module:"marketing"}); toast({title:"Action applied",description:a}); tick(n=>n+1); setDetail({...detail,status:"mitigating"});}}>{a}</Button>)}</div></CardContent></Card>
          {detail.status!=="resolved"&&<Button className="w-full" onClick={()=>{resolveIncident(detail.id); recordAudit({action:"incident.resolve",entity:"incident",entityId:detail.id,summary:`Tenant confirmed resolution for ${detail.id} (fed back to N14)`,module:"marketing"}); toast({title:"Resolved",description:"Resolution confirmation fed back to platform console (N14)."}); setDetail(null); tick(n=>n+1);}}><CheckCircle className="mr-1 h-4 w-4"/>Confirm resolution (→ N14)</Button>}
        </div>}
      </SheetContent></Sheet>
    </Page>
  );
}
