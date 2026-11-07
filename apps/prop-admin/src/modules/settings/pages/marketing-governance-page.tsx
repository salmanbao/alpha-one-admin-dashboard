"use client";
/** N9 — Frequency & Budget Caps (Wave 3/P2). Per-segment/channel frequency rules, monthly budget with alert thresholds, quiet hours, override via approval. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Gauge } from "lucide-react";

interface Rule { id:string; scope:string; channel:string; limit:string; used:number; status:"ok"|"near"|"breach" }
export function MarketingGovernancePage() {
  const [rules,setRules]=useState<Rule[]>([
    {id:"r1",scope:"All segments",channel:"email",limit:"5 / week / contact",used:62,status:"ok"},
    {id:"r2",scope:"Dormant 60d",channel:"sms",limit:"2 / week / contact",used:88,status:"near"},
    {id:"r3",scope:"All segments",channel:"whatsapp",limit:"3 / week / contact",used:41,status:"ok"},
  ]);
  const [budget]=useState({monthly:5000,spent:3180,alert:80});
  const cols: Column<Rule>[] = [
    {key:"scope",header:"Scope",cell:r=>r.scope},{key:"ch",header:"Channel",cell:r=>r.channel},
    {key:"lim",header:"Limit",cell:r=>r.limit},
    {key:"used",header:"Usage vs cap",cell:r=><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded bg-muted"><div className={`h-1.5 rounded ${r.used>=90?"bg-destructive":r.used>=80?"bg-amber-500":"bg-primary"}`} style={{width:`${r.used}%`}}/></div><span className="text-xs tabular-nums">{r.used}%</span></div>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="breach"?"danger":r.status==="near"?"warning":"success"}>{r.status}</StatusBadge>},
  ];
  return (
    <Page>
      <PageHeader title="Marketing Governance" description="Frequency rules, monthly budget + alert thresholds, quiet hours. Overrides require approval (N6)." icon={Gauge}
        actions={<Button size="sm" onClick={()=>toast({title:"Rule saved",description:"Frequency rule created (dummy)."})}>Add rule</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Monthly budget" value={`$${budget.spent.toLocaleString()} / $${budget.monthly.toLocaleString()}`} tone={budget.spent/budget.monthly>budget.alert/100?"warning":"positive"} />
          <MetricCard label="Alert threshold" value={`${budget.alert}%`} />
          <MetricCard label="Rules in breach" value={String(rules.filter(r=>r.status==="breach").length)} tone={rules.some(r=>r.status==="breach")?"negative":"positive"} />
        </div>
        <DataTable columns={cols} data={rules} rowKey={r=>r.id} pageSize={6} />
        <div className="rounded-lg border p-3 space-y-2"><p className="text-sm font-semibold">Quiet hours policy</p><div className="flex flex-wrap items-center gap-2 text-sm"><span>Suppress non-transactional sends between</span><Input className="h-8 w-24" defaultValue="21:00" /><span>and</span><Input className="h-8 w-24" defaultValue="08:00" /><span>(recipient local time)</span><Switch defaultChecked /></div><Button size="sm" variant="outline" onClick={()=>toast({title:"Override requested",description:"Override routed through Campaign Approval (N6)."})}>Request override</Button></div>
      </PageContent>
    </Page>
  );
}
