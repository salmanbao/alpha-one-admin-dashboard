"use client";
/** N13 — Tenant Channel Entitlements (Wave 2, P1, platform-admin). Per-tenant channel enablement/quotas/cost ceilings. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Radio, Settings2 } from "lucide-react";
import { tenants as tenantList } from "@/lib/platform/mock-data";

type Ch = "email"|"sms"|"whatsapp"|"push";
interface Ent { tenantId:string; name:string; channels:Record<Ch,boolean>; caps:Record<Ch,number>; costCeilings:Record<Ch,number>; delegated:boolean }

function seed(): Ent[] {
  return (tenantList||[]).slice(0,8).map((t:any,i:number)=>({
    tenantId:t.id, name:t.name||t.slug||t.id, delegated: i%3===0,
    channels:{email:true,sms:i%2===0,whatsapp:i%3===0,push:true},
    caps:{email:50000-i*2000,sms:5000,whatsapp:2000,push:100000},
    costCeilings:{email:500,sms:300,whatsapp:250,push:100},
  }));
}

export function TenantChannelEntitlementsPage() {
  const [rows,setRows]=useState<Ent[]>(seed);
  const [edit,setEdit]=useState<Ent|null>(null);
  const cols: Column<Ent>[] = [
    {key:"name",header:"Tenant",cell:r=><span className="font-medium">{r.name}</span>},
    {key:"ch",header:"Channels",cell:r=><div className="flex gap-1">{(["email","sms","whatsapp","push"] as Ch[]).map(c=><StatusBadge key={c} tone={r.channels[c]?"success":"muted"}>{c}</StatusBadge>)}</div>},
    {key:"caps",header:"Daily caps (email/sms)",cell:r=><span className="text-xs tabular-nums">{r.caps.email.toLocaleString()} / {r.caps.sms.toLocaleString()}</span>},
    {key:"cost",header:"Cost ceilings ($/mo)",cell:r=><span className="text-xs">${r.costCeilings.email} email</span>},
    {key:"del",header:"Delegated",cell:r=><StatusBadge tone={r.delegated?"info":"muted"}>{r.delegated?"tenant admin":"platform"}</StatusBadge>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setEdit(JSON.parse(JSON.stringify(r)))}><Settings2 className="mr-1 h-3 w-3" />Edit</Button>},
  ];
  function save(e:Ent){ setRows(rs=>rs.map(r=>r.tenantId===e.tenantId?e:r)); recordAudit({actor:"You",action:"channel.entitlement",target:e.tenantId,detail:`Updated channel entitlements for ${e.name}.`,severity:"warning"}); toast({title:"Entitlements updated",description:`${e.name} — quotas/caps saved.`}); setEdit(null); }
  return (
    <Page>
      <PageHeader title="Tenant Channel Entitlements" description="Enable/disable channels per tenant and set per-channel daily/monthly caps and cost ceilings. Closes the loop with N1." icon={Radio} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Tenants" value={String(rows.length)} /><MetricCard label="WhatsApp enabled" value={String(rows.filter(r=>r.channels.whatsapp).length)} tone="default" /><MetricCard label="Delegated to tenant" value={String(rows.filter(r=>r.delegated).length)} /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.tenantId} pageSize={10} searchableText={r=>r.name} />
        <p className="text-[11px] text-muted-foreground">Operator console meters usage (M7); this screen governs what each tenant may use and at what caps.</p>
      </PageContent>
      <Sheet open={!!edit} onOpenChange={o=>!o&&setEdit(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {edit&&<><SheetHeader><SheetTitle>{edit.name} — entitlements</SheetTitle><SheetDescription>Enable channels, set caps/cost ceilings, or delegate to tenant admin.</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold">Channels</p>
              {(["email","sms","whatsapp","push"] as Ch[]).map(c=><label key={c} className="flex items-center justify-between rounded border p-2 text-sm"><span className="flex items-center gap-2"><Checkbox checked={edit.channels[c]} onCheckedChange={v=>setEdit({...edit,channels:{...edit.channels,[c]:!!v}})} />{c}</span><span className="flex items-center gap-2 text-xs">cap <Input className="h-7 w-24 text-xs" type="number" value={edit.caps[c]} onChange={e=>setEdit({...edit,caps:{...edit.caps,[c]:Number(e.target.value||0)}})} /> $ <Input className="h-7 w-20 text-xs" type="number" value={edit.costCeilings[c]} onChange={e=>setEdit({...edit,costCeilings:{...edit.costCeilings,[c]:Number(e.target.value||0)}})} /></span></label>)}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.delegated} onCheckedChange={v=>setEdit({...edit,delegated:!!v})} />Delegate channel management to tenant admin</label>
              <Button className="w-full" onClick={()=>save(edit)}>Save entitlements</Button>
            </div></>}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
