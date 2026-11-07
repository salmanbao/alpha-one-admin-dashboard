"use client";
/** N13 — Tenant Channel Entitlements (depth). Usage vs quota, anomaly flags, cost ceilings, approval workflow. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Radio, Settings2, AlertTriangle } from "lucide-react";
import { tenants as tenantList } from "@/lib/platform/mock-data";

type Ch = "email"|"sms"|"whatsapp"|"push";
interface Ent { tenantId:string; name:string; channels:Record<Ch,boolean>; caps:Record<Ch,number>; usage:Record<Ch,number>; costCeilings:Record<Ch,number>; costUsed:Record<Ch,number>; delegated:boolean; anomaly?:string; approval?: "pending"|"approved"|"none" }

function seed(): Ent[] {
  return (tenantList||[]).slice(0,8).map((t:any,i:number)=>({
    tenantId:t.id, name:t.name||t.slug||t.id, delegated: i%3===0,
    channels:{email:true,sms:i%2===0,whatsapp:i%3===0,push:true},
    caps:{email:50000-i*2000,sms:5000,whatsapp:2000,push:100000},
    usage:{email:42000-i*1500,sms:i%2?4200:0,whatsapp:i%3?1800:0,push:12000},
    costCeilings:{email:500,sms:300,whatsapp:250,push:100},
    costUsed:{email:410,sms:i%2?260:0,whatsapp:i%3?190:0,push:20},
    anomaly: i===1?"Usage 84% of email cap; cost near ceiling":"", approval: i===1?"pending":"none",
  }));
}

export function TenantChannelEntitlementsPage() {
  const [rows,setRows]=useState<Ent[]>(seed);
  const [edit,setEdit]=useState<Ent|null>(null);
  const cols: Column<Ent>[] = [
    {key:"name",header:"Tenant",cell:r=><span className="font-medium">{r.name}{r.anomaly&&<span className="block text-[10px] text-amber-700 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5"/>{r.anomaly}</span>}</span>},
    {key:"ch",header:"Channels",cell:r=><div className="flex flex-wrap gap-1">{(["email","sms","whatsapp","push"] as Ch[]).map(c=><StatusBadge key={c} tone={r.channels[c]?(r.usage[c]/Math.max(1,r.caps[c])>0.85?"warning":"success"):"muted"}>{c} {r.channels[c]?Math.round(r.usage[c]/Math.max(1,r.caps[c])*100)+"%":""}</StatusBadge>)}</div>},
    {key:"caps",header:"Usage/cap (email)",cell:r=><span className="text-xs tabular-nums">{r.usage.email.toLocaleString()} / {r.caps.email.toLocaleString()}</span>},
    {key:"cost",header:"Cost used/ceiling",cell:r=><span className="text-xs">${r.costUsed.email}/${r.costCeilings.email} email</span>},
    {key:"appr",header:"Approval",cell:r=>r.approval==="pending"?<div className="flex gap-1"><StatusBadge tone="warning">pending</StatusBadge><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setRows(rs=>rs.map(x=>x.tenantId===r.tenantId?{...x,approval:"approved",anomaly:""}:x)); recordAudit({actor:"operator",action:"entitlement.approve",target:r.tenantId,detail:`Approved quota/cost overage request for ${r.name}`,severity:"warning"}); toast({title:"Approved"});}}>Approve</Button></div>:<StatusBadge tone="muted">{r.approval||"—"}</StatusBadge>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setEdit(JSON.parse(JSON.stringify(r)))}><Settings2 className="mr-1 h-3 w-3" />Edit</Button>},
  ];
  function save(e:Ent){ setRows(rs=>rs.map(r=>r.tenantId===e.tenantId?e:r)); recordAudit({actor:"operator",action:"channel.entitlement",target:e.tenantId,detail:`Updated entitlements for ${e.name}.`,severity:"warning"}); toast({title:"Entitlements updated"}); setEdit(null); }
  return (
    <Page>
      <PageHeader title="Tenant Channel Entitlements" description="Enable channels, usage vs quota, cost ceilings, anomaly flags, and approval workflow. Closes loop with N1/M7." icon={Radio} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Tenants" value={String(rows.length)} /><MetricCard label="Anomalies" value={String(rows.filter(r=>r.anomaly).length)} tone="warning" /><MetricCard label="Pending approvals" value={String(rows.filter(r=>r.approval==="pending").length)} tone="warning" /><MetricCard label="Delegated" value={String(rows.filter(r=>r.delegated).length)} /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.tenantId} pageSize={10} searchableText={r=>r.name} />
      </PageContent>
      <Sheet open={!!edit} onOpenChange={o=>!o&&setEdit(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {edit&&<><SheetHeader><SheetTitle>{edit.name} — entitlements</SheetTitle><SheetDescription>Edit caps/cost ceilings; usage shown for context.</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold">Channels, caps & cost ceilings</p>
              {(["email","sms","whatsapp","push"] as Ch[]).map(c=><label key={c} className="flex flex-col gap-1 rounded border p-2 text-sm"><span className="flex items-center gap-2"><Checkbox checked={edit.channels[c]} onCheckedChange={v=>setEdit({...edit,channels:{...edit.channels,[c]:!!v}})} />{c} <span className="text-[10px] text-muted-foreground">used {edit.usage[c].toLocaleString()} (${edit.costUsed[c]})</span></span><span className="flex items-center gap-2 text-xs">daily cap <Input className="h-7 w-24 text-xs" type="number" value={edit.caps[c]} onChange={e=>setEdit({...edit,caps:{...edit.caps,[c]:Number(e.target.value||0)}})} /> $ ceiling <Input className="h-7 w-20 text-xs" type="number" value={edit.costCeilings[c]} onChange={e=>setEdit({...edit,costCeilings:{...edit.costCeilings,[c]:Number(e.target.value||0)}})} /></span></label>)}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.delegated} onCheckedChange={v=>setEdit({...edit,delegated:!!v})} />Delegate to tenant admin</label>
              <Button className="w-full" onClick={()=>save(edit)}>Save entitlements</Button>
            </div></>}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
