"use client";
/** N14 — Deliverability Incident Console (depth). Escalation, quarantine, timeline, cross-tenant impact, playbook. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Activity, AlertTriangle, ShieldAlert } from "lucide-react";

interface Incident { id:string; severity:"critical"|"warning"|"info"; title:string; provider:string; tenants:string[]; impact:string; state:"open"|"ack"|"escalated"|"quarantined"|"closed"; ts:string; timeline:Array<{at:string;event:string}>; playbook:string[] }
const now=()=>new Date().toISOString();
const seed: Incident[] = [
  {id:"inc1",severity:"warning",title:"Reputation dip on Meta WhatsApp pool",provider:"Meta WA",tenants:["ApexFunded","TradeMax"],impact:"Template quality degraded; ~12% delivery risk for 2 tenants",state:"open",ts:new Date(Date.now()-3*3600000).toISOString(),timeline:[{at:now(),event:"Detected quality rating drop"},{at:now(),event:"Affected tenants identified"}],playbook:["Pause WA campaigns for affected tenants","Review template compliance","Switch to backup WABA"]},
  {id:"inc2",severity:"critical",title:"Blocklist hit — sending IP flagged",provider:"SendGrid",tenants:["FundedHub"],impact:"Outbound email blocked for FundedHub; 1 tenant quarantined candidate",state:"ack",ts:new Date(Date.now()-8*3600000).toISOString(),timeline:[{at:now(),event:"Spamhaus listing detected"},{at:now(),event:"Acknowledged by operator"}],playbook:["Quarantine tenant subaccount","Failover to alternate IP/domain","Request delisting"]},
];
export function DeliverabilityIncidentsPage() {
  const [rows,setRows]=useState(seed); const [detail,setDetail]=useState<Incident|null>(null);
  function patch(id:string,p:Partial<Incident>,audit:string,sev:Incident["severity"]){ setRows(rs=>rs.map(x=>x.id===id?{...x,...p,timeline:[...x.timeline,{at:now(),event:audit}]}:x)); recordAudit({actor:"operator",action:"deliverability.incident",target:id,detail:audit,severity:sev}); }
  const cols: Column<Incident>[] = [
    {key:"sev",header:"Severity",cell:r=><StatusBadge tone={r.severity==="critical"?"danger":r.severity==="warning"?"warning":"info"}>{r.severity}</StatusBadge>},
    {key:"t",header:"Incident",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.title}<span className="block text-[10px] text-muted-foreground">{r.provider} · {new Date(r.ts).toLocaleString()}</span></button>},
    {key:"ten",header:"Cross-tenant impact",cell:r=><span className="text-xs">{r.tenants.join(", ")}<span className="block text-[10px] text-muted-foreground">{r.impact}</span></span>},
    {key:"st",header:"State",cell:r=><StatusBadge tone={r.state==="open"||r.state==="quarantined"?"danger":r.state==="closed"?"success":"warning"}>{r.state}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">{r.state!=="closed"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{const ns=r.state==="open"?"ack":"escalated"; patch(r.id,{state:ns},`Advanced to ${ns}`,r.severity); toast({title:"Incident updated"});}}>Ack/Escalate</Button>}{(r.state==="open"||r.state==="ack"||r.state==="escalated")&&<Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={()=>{patch(r.id,{state:"quarantined"},`Quarantined ${r.tenants.join(", ")} from provider pool`, "critical"); toast({title:"Tenant(s) quarantined",description:"Removed from provider pool (see Provider Pool)."});}}><ShieldAlert className="mr-1 h-3 w-3"/>Quarantine</Button>}</div>},
  ];
  return (
    <Page>
      <PageHeader title="Deliverability Incident Console" description="Platform-wide reputation alerts, quarantine, blocklists, escalation, timelines and playbooks (feeds tenant R2-09)." icon={Activity} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Open" value={String(rows.filter(r=>r.state==="open").length)} tone="negative" /><MetricCard label="Escalated/quarantined" value={String(rows.filter(r=>["escalated","quarantined"].includes(r.state)).length)} tone="warning" /><MetricCard label="Tenants affected" value={String(new Set(rows.flatMap(r=>r.tenants)).size)} /><MetricCard label="Provider pools healthy" value="2 / 3" /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8} />
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-lg overflow-y-auto"><SheetHeader><SheetTitle>{detail?.title}</SheetTitle><SheetDescription>{detail?.provider} · {detail?.severity} · {detail?.state}</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs"><Card><CardContent className="p-2"><p className="font-semibold">Cross-tenant impact</p><p>{detail.impact}</p><p className="mt-1">Tenants: {detail.tenants.join(", ")}</p></CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Timeline</p>{detail.timeline.map((t,i)=><div key={i}>{new Date(t.at).toLocaleString()} — {t.event}</div>)}</CardContent></Card>
          <Card><CardContent className="p-2"><p className="font-semibold mb-1">Playbook</p><div className="flex flex-wrap gap-2">{detail.playbook.map(a=><Button key={a} size="sm" variant="outline" className="h-7 text-xs" disabled={detail.state==="closed"} onClick={()=>{patch(detail.id,{},`Playbook: ${a}`,detail.severity); toast({title:"Action recorded",description:a}); setDetail({...detail,timeline:[...detail.timeline,{at:now(),event:`Playbook: ${a}`}]});}}>{a}</Button>)}</div></CardContent></Card>
          {detail.state!=="closed"&&<Button className="w-full" onClick={()=>{patch(detail.id,{state:"closed"},`Closed incident (tenant R2-09 can confirm resolution)`,detail.severity); setDetail(null); toast({title:"Closed"});}}>Close incident</Button>}
        </div>}
      </SheetContent></Sheet>
    </Page>
  );
}
