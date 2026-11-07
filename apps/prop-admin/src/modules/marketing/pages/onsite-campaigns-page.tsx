"use client";
/** R2-03 — On-Site Studio: campaigns list. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { MousePointerClick, Plus, Copy, FlaskConical } from "lucide-react";
import { listOnsite, createOnsite, duplicateOnsite, type OnsiteCampaign } from "../onsite-store";

const stTone = (s:string)=>s==="active"?"success":s==="paused"?"warning":"muted";
export function OnsiteCampaignsPage(){
  const { navigate } = usePlatform();
  const [,tick]=useState(0); const rows=listOnsite();
  const [open,setOpen]=useState(false); const [name,setName]=useState(""); const [type,setType]=useState("popup"); const [tpl,setTpl]=useState("welcome offer");
  const cols: Column<OnsiteCampaign>[] = [
    {key:"name",header:"Campaign",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>navigate("onsite-designer",{id:r.id})}>{r.name}<span className="block text-[10px] text-muted-foreground">{r.type} · {r.template}</span></button>},
    {key:"tr",header:"Trigger / audience",cell:r=><span className="text-xs">{r.trigger.kind}{r.trigger.value?` (${r.trigger.value})`:""} · {r.audience.segment||"all"}</span>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={stTone(r.status) as any}>{r.status}</StatusBadge>},
    {key:"perf",header:"Perf",numeric:true,cell:r=><span className="text-xs tabular-nums">{r.impressions.toLocaleString()} imp · {r.clicks} clk · {r.dismissals} dism · {r.conversions} conv</span>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>{duplicateOnsite(r.id); recordAudit({action:"onsite.duplicate",entity:"onsite",entityId:r.id,summary:`Duplicated ${r.name}`,module:"marketing"}); tick(n=>n+1); toast({title:"Duplicated"});}}><Copy className="h-3 w-3"/></Button><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>navigate("campaign-ab")}><FlaskConical className="h-3 w-3"/>A/B</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={()=>navigate("onsite-designer",{id:r.id})}>Edit</Button></div>},
  ];
  return (
    <Page>
      <PageHeader title="On-Site Studio" description="Campaign-grade popups, banners, slabs and inline units with trigger/targeting/frequency rules (M3 segments, N9 governance caps)." icon={MousePointerClick}
        actions={<Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>New campaign</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Campaigns" value={String(rows.length)}/><MetricCard label="Active" value={String(rows.filter(r=>r.status==="active").length)} tone="positive"/><MetricCard label="Conversions" value={String(rows.reduce((s,r)=>s+r.conversions,0))} tone="positive"/><MetricCard label="Dismiss rate" value={`${rows.reduce((s,r)=>s+r.impressions,0)?Math.round(rows.reduce((s,r)=>s+r.dismissals,0)/rows.reduce((s,r)=>s+r.impressions,1)*100):0}%`}/></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.type} ${r.template}`} />
      </PageContent>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New on-site campaign</DialogTitle><DialogDescription>Pick a type and template.</DialogDescription></DialogHeader>
        <div className="space-y-2 text-xs"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Campaign name"/><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["popup","banner","slab","inline"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={tpl} onValueChange={setTpl}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["welcome offer","challenge discount","exit intent","KYC nudge","deposit boost"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={()=>{const rec=createOnsite(name.trim(),type as any,tpl); recordAudit({action:"onsite.create",entity:"onsite",entityId:rec.id,summary:`Created ${rec.name}`,module:"marketing"}); toast({title:"Created"}); setOpen(false); setName(""); tick(n=>n+1); navigate("onsite-designer",{id:rec.id});}}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
