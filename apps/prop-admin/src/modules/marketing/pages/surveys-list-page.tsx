"use client";
/** R2-05 — Surveys & NPS list (screen 1). */
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
import { ClipboardList, Plus, MessageSquare } from "lucide-react";
import { listSurveys, createSurvey, type Survey } from "../surveys-store";
import { AreaSeries } from "@/components/platform/charts";

const stTone=(s:string)=>s==="active"?"success":s==="paused"?"warning":s==="closed"?"muted":"info";
export function SurveysListPage(){
  const { navigate } = usePlatform();
  const [,tick]=useState(0); const rows=listSurveys();
  const [open,setOpen]=useState(false); const [name,setName]=useState(""); const [type,setType]=useState("nps"); const [ch,setCh]=useState("email");
  const cols: Column<Survey>[] = [
    {key:"name",header:"Survey",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>navigate("survey-builder",{id:r.id})}>{r.name}<span className="block text-[10px] text-muted-foreground">{r.type} · {r.channel}</span></button>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={stTone(r.status) as any}>{r.status}</StatusBadge>},
    {key:"trig",header:"Trigger / segment",cell:r=><span className="text-xs">{r.trigger.event||r.trigger.milestone||"—"} · {r.segment||"all"}</span>},
    {key:"resp",header:"Responses",numeric:true,cell:r=>r.responses.toLocaleString()},
    {key:"trend",header:"NPS trend",cell:r=><div className="w-24">{r.trend.length>1?<AreaSeries data={r.trend.map((v,i)=>({i,v}))} xKey="i" yKey="v" height={28} color="hsl(var(--primary))"/>:<span className="text-muted-foreground">—</span>}</div>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={()=>navigate("survey-builder",{id:r.id})}>Open</Button>},
  ];
  return (
    <Page>
      <PageHeader title="Surveys & NPS" description="Structured voice-of-customer: NPS after payout, post-challenge surveys; responses feed retention segments (M3) and flows (M4)." icon={ClipboardList}
        actions={<Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>New survey</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Surveys" value={String(rows.length)}/><MetricCard label="Active" value={String(rows.filter(r=>r.status==="active").length)} tone="positive"/><MetricCard label="Responses" value={String(rows.reduce((s,r)=>s+r.responses,0))}/><MetricCard label="Avg NPS" value="74" tone="positive"/></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.type} ${r.channel}`}/>
      </PageContent>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New survey</DialogTitle><DialogDescription>Type + delivery channel (on-site via R2-03, email block, or in-app).</DialogDescription></DialogHeader>
        <div className="space-y-2 text-xs"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Survey name"/><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["nps","csat","custom"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={ch} onValueChange={setCh}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["email","onsite","in_app"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={()=>{const rec=createSurvey(name.trim(),type as any,ch as any); recordAudit({action:"survey.create",entity:"survey",entityId:rec.id,summary:`Created survey ${rec.name} (${rec.type}/${rec.channel})`,module:"marketing"}); toast({title:"Created"}); setOpen(false); setName(""); tick(n=>n+1); navigate("survey-builder",{id:rec.id});}}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
