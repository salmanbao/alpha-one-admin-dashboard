"use client";
/** N14 — Deliverability Incident Console (Wave 3/P2). Platform-wide incidents: reputation alerts, quarantined tenants, blocklists, escalation. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Activity, AlertTriangle } from "lucide-react";

interface Incident { id:string; severity:"critical"|"warning"|"info"; title:string; provider:string; tenants:string[]; state:"open"|"ack"|"closed"; ts:string }
const seed: Incident[] = [
  {id:"inc1",severity:"warning",title:"Reputation dip on Meta WhatsApp pool",provider:"Meta WA",tenants:["ApexFunded","TradeMax"],state:"open",ts:new Date(Date.now()-3*3600000).toISOString()},
  {id:"inc2",severity:"critical",title:"Blocklist hit — sending IP flagged",provider:"SendGrid",tenants:["FundedHub"],state:"ack",ts:new Date(Date.now()-8*3600000).toISOString()},
];
export function DeliverabilityIncidentsPage() {
  const [rows,setRows]=useState(seed);
  const cols: Column<Incident>[] = [
    {key:"sev",header:"Severity",cell:r=><StatusBadge tone={r.severity==="critical"?"danger":r.severity==="warning"?"warning":"info"}>{r.severity}</StatusBadge>},
    {key:"t",header:"Incident",cell:r=><span className="font-medium">{r.title}<span className="block text-[10px] text-muted-foreground">{r.provider} · {new Date(r.ts).toLocaleString()}</span></span>},
    {key:"ten",header:"Affected tenants",cell:r=><span className="text-xs">{r.tenants.join(", ")}</span>},
    {key:"st",header:"State",cell:r=><StatusBadge tone={r.state==="open"?"danger":r.state==="ack"?"warning":"muted"}>{r.state}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">{r.state!=="closed"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setRows(rs=>rs.map(x=>x.id===r.id?{...x,state:x.state==="open"?"ack":"closed"}:x)); recordAudit({actor:"You",action:"deliverability.incident",target:r.id,detail:`Advanced incident ${r.title}.`,severity:r.severity==='critical'?'critical':'warning'}); toast({title:"Incident updated"});}}>Acknowledge/Escalate</Button>}{r.state==="open"&&<Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={()=>toast({title:"Tenant quarantined",description:`${r.tenants[0]} quarantined from provider pool (see Provider Pool).`})}>Quarantine</Button>}</div>},
  ];
  return (
    <Page>
      <PageHeader title="Deliverability Incident Console" description="Platform-wide reputation alerts, quarantined tenants, blocklist hits and failover state." icon={Activity} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Open" value={String(rows.filter(r=>r.state==="open").length)} tone="negative" /><MetricCard label="Acknowledged" value={String(rows.filter(r=>r.state==="ack").length)} tone="warning" /><MetricCard label="Provider pools healthy" value="2 / 3" tone="default" /></div>
        <div className="rounded-lg border p-3 text-xs flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />Escalations route into the Provider Pool console (quarantine/release subaccounts).</div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8} />
      </PageContent>
    </Page>
  );
}
