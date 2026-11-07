"use client";
/** R2-03 — On-Site Designer: canvas + trigger/targeting/frequency + preview. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { MousePointerClick, Save, Eye, Smartphone, Monitor } from "lucide-react";
import { getOnsite, saveOnsite, listOnsite } from "../onsite-store";

const PALETTE=["headline","body","CTA button","form embed (R2-02)","countdown","image (R2-04)","trust badges"];
export function OnsiteDesignerPage(){
  const { router, navigate } = usePlatform();
  const id = router.params.id || listOnsite()[0]?.id;
  const base = useMemo(()=> id? getOnsite(id): undefined,[id]);
  const [c,setC]=useState(base); const [preview,setPreview]=useState(false); const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
  if(!c) return <Page><PageContent><p className="text-sm text-muted-foreground">No campaign. <button className="underline" onClick={()=>navigate("onsite-campaigns")}>Back</button></p></PageContent></Page>;
  function save(){ if(!c)return; saveOnsite(c); recordAudit({action:"onsite.save",entity:"onsite",entityId:c.id,summary:`Saved ${c.name} (trigger ${c.trigger.kind}, freq ${c.frequency.mode}).`,module:"marketing"}); toast({title:"Saved"}); }
  return (
    <Page>
      <PageHeader title={`On-Site: ${c.name}`} description={`${c.type} · ${c.status} · trigger ${c.trigger.kind}`} icon={MousePointerClick}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setPreview(true)}><Eye className="mr-1 h-4 w-4"/>Preview</Button><Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4"/>Save</Button><Button size="sm" variant={c.status==="active"?"outline":"default"} onClick={()=>{saveOnsite({id:c.id,status:c.status==="active"?"paused":"active"}); setC({...c,status:c.status==="active"?"paused":"active"}); recordAudit({action:`onsite.${c.status==="active"?"pause":"activate"}`,entity:"onsite",entityId:c.id,summary:`${c.status==="active"?"Paused":"Activated"} ${c.name}`,module:"marketing"}); toast({title:c.status==="active"?"Paused":"Activated"});}}>{c.status==="active"?"Pause":"Activate"}</Button></div>} />
      <PageContent>
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_300px]">
          <Card><CardContent className="p-2 space-y-1 text-xs"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Blocks (R2-01 canvas)</p>{PALETTE.map(b=><button key={b} type="button" className="w-full rounded border px-2 py-1 text-left hover:bg-muted" onClick={()=>setC({...c,blocks:[...c.blocks,{id:`b${Date.now()}`,type:b,label:b}]})}>+ {b}</button>)}<p className="text-[10px] text-muted-foreground pt-1">Uses design-system tokens (no visual fork). Conversions attribute to marketing-performance.</p></CardContent></Card>
          <Card><CardContent className="p-3 space-y-2"><p className="text-[10px] text-muted-foreground">Canvas ({c.type})</p>{c.blocks.map((b,i)=><div key={b.id} className="rounded border p-2 text-xs"><strong>{i+1}. {b.label}</strong> <span className="text-muted-foreground">({b.type})</span></div>)}</CardContent></Card>
          <div className="space-y-2">
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Trigger</p><Select value={c.trigger.kind} onValueChange={v=>setC({...c,trigger:{...c.trigger,kind:v as any}})}><SelectTrigger className="h-7"><SelectValue/></SelectTrigger><SelectContent>{["page_view","scroll","exit_intent","time_on_page","click"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input value={c.trigger.value||""} onChange={e=>setC({...c,trigger:{...c.trigger,value:e.target.value}})} placeholder="value (e.g. scroll %, /path)" className="h-7"/></CardContent></Card>
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Targeting (M3 segment engine)</p><Input value={c.audience.segment||""} onChange={e=>setC({...c,audience:{...c.audience,segment:e.target.value}})} placeholder="Segment" className="h-7"/><Input value={c.audience.country||""} onChange={e=>setC({...c,audience:{...c.audience,country:e.target.value}})} placeholder="Country" className="h-7"/><Select value={c.audience.device||"any"} onValueChange={v=>setC({...c,audience:{...c.audience,device:v==="any"?undefined:v}})}><SelectTrigger className="h-7"><SelectValue/></SelectTrigger><SelectContent>{["any","desktop","mobile"].map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2"><Switch checked={!!c.audience.loggedIn} onCheckedChange={v=>setC({...c,audience:{...c.audience,loggedIn:!!v}})}/>Logged-in only</label></CardContent></Card>
            <Card><CardContent className="p-2 text-xs space-y-2"><p className="font-semibold">Frequency (N9 governance caps)</p><Select value={c.frequency.mode} onValueChange={v=>setC({...c,frequency:{...c.frequency,mode:v as any}})}><SelectTrigger className="h-7"><SelectValue/></SelectTrigger><SelectContent>{["once","session","every_n_days","suppress_after_conversion"].map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>{c.frequency.mode==="every_n_days"&&<Input type="number" value={String(c.frequency.n||1)} onChange={e=>setC({...c,frequency:{...c.frequency,n:parseInt(e.target.value)||1}})} className="h-7" placeholder="N days"/>}<p className="text-[10px] text-muted-foreground">Dismissal state persists per trader across sessions.</p></CardContent></Card>
          </div>
        </div>
      </PageContent>
      <Sheet open={preview} onOpenChange={setPreview}><SheetContent side="bottom" className="h-[70vh]"><SheetHeader><SheetTitle>Preview ({device})</SheetTitle><SheetDescription>Mocked trader page; fires only for targeted audience & respects frequency cap.</SheetDescription></SheetHeader>
        <div className="mt-2 flex gap-2"><Button size="sm" variant={device==="desktop"?"default":"outline"} onClick={()=>setDevice("desktop")}><Monitor className="h-3 w-3"/></Button><Button size="sm" variant={device==="mobile"?"default":"outline"} onClick={()=>setDevice("mobile")}><Smartphone className="h-3 w-3"/></Button></div>
        <div className={`mt-3 mx-auto rounded border bg-muted/30 p-4 ${device==="mobile"?"max-w-[360px]":"max-w-3xl"} relative min-h-[300px]`}><p className="text-xs text-muted-foreground text-center mb-8">Mocked trader dashboard</p><div className={`rounded-lg border bg-background p-3 shadow-lg ${c.type==="banner"?"":"max-w-sm mx-auto"}`}><p className="font-semibold text-sm">{c.blocks[0]?.label||c.name}</p><p className="text-xs text-muted-foreground mt-1">Template: {c.template} · Trigger: {c.trigger.kind} · Segment: {c.audience.segment||"all"}</p><div className="mt-2 flex gap-2"><Button size="sm" className="h-7 text-xs">CTA</Button><Button size="sm" variant="ghost" className="h-7 text-xs">Dismiss</Button></div></div></div>
      </SheetContent></Sheet>
    </Page>
  );
}
