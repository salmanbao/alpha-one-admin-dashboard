"use client";
/** R2-06 — Link Tracking & UTM Manager (screen 1). Taxonomy-validated tag builder, bulk CSV, expiry/password, detail drawer. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { Link2, Plus, QrCode, Trash2, AlertTriangle } from "lucide-react";
import { listLinks, createLink, softDeleteLink, mediumValid, sourceValid, ALLOWED_MEDIUMS, ALLOWED_SOURCES, type TrackedLink } from "../link-tracking-store";

export function LinkTrackingPage(){
  const [rows,setRows]=useState(listLinks()); const [detail,setDetail]=useState<TrackedLink|null>(null);
  const [open,setOpen]=useState(false); const [bulk,setBulk]=useState(false);
  const [form,setForm]=useState({destination:"",campaign:"",source:"promo",medium:"email",content:"",expiresAt:"",password:false});
  const [csv,setCsv]=useState("");
  const err = useMemo(()=>{ const e:string[]=[]; if(form.medium&&!mediumValid(form.medium)) e.push(`Medium "${form.medium}" outside taxonomy`); if(form.source&&!sourceValid(form.source)) e.push(`Source "${form.source}" outside taxonomy`); return e; },[form.medium,form.source]);
  const cols: Column<TrackedLink>[] = [
    {key:"slug",header:"Link",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.slug}<span className="block text-[10px] text-muted-foreground font-normal">{r.destination}</span></button>},
    {key:"tags",header:"Tags",cell:r=><span className="text-[10px]">{r.campaign||"—"} · {r.source} / {r.medium} / {r.content||"—"}</span>},
    {key:"clicks",header:"Clicks",numeric:true,cell:r=>r.clicks.toLocaleString()},
    {key:"conv",header:"Conversions",numeric:true,cell:r=>r.conversions},
    {key:"exp",header:"Expiry",cell:r=>r.expiresAt?<StatusBadge tone={new Date(r.expiresAt).getTime()<Date.now()?"danger":"warning"}>{new Date(r.expiresAt).toLocaleDateString()}</StatusBadge>:<span className="text-muted-foreground">—</span>},
    {key:"pw",header:"Pw",cell:r=>r.password?<StatusBadge tone="info">on</StatusBadge>:"—"},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>{navigator.clipboard?.writeText(`https://alpha.one${r.slug}`); toast({title:"Copied",description:`Short link copied (records click + M5 attribution on visit).`});}}><Link2 className="h-3 w-3"/></Button><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>toast({title:"QR",description:`QR for ${r.slug} downloaded (dummy).`})}><QrCode className="h-3 w-3"/></Button><Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={()=>{softDeleteLink(r.id); setRows(listLinks()); recordAudit({action:"link.delete",entity:"link",entityId:r.id,summary:`Soft-deleted link ${r.slug}`,module:"marketing"}); toast({title:"Soft-deleted",description:"Reversible (AC-3)."});}}><Trash2 className="h-3 w-3"/></Button></div>},
  ];
  function create(){ const res=createLink({destination:form.destination,source:form.source,medium:form.medium,campaign:form.campaign||undefined,content:form.content||undefined,expiresAt:form.expiresAt||undefined,password:form.password}); if(!res.ok){toast({title:"Blocked (taxonomy)",description:res.reason,variant:"destructive" as any}); return;} recordAudit({action:"link.create",entity:"link",entityId:res.link.id,summary:`Created tracked link ${res.link.slug} (${res.link.source}/${res.link.medium})`,module:"marketing"}); toast({title:"Link created",description:`https://alpha.one${res.link.slug}`}); setRows(listLinks()); setOpen(false); setForm({destination:"",campaign:"",source:"promo",medium:"email",content:"",expiresAt:"",password:false}); }
  function bulkCreate(){ const lines=csv.split("\n").map(l=>l.trim()).filter(Boolean); let ok=0; for(const line of lines){ const res=createLink({destination:line,source:"promo",medium:"email"}); if(res.ok) ok++; } recordAudit({action:"link.bulk",entity:"link",entityId:"bulk",summary:`Bulk-generated ${ok} links from CSV`,module:"marketing"}); toast({title:`Bulk generated ${ok} link(s)`,description:"Importable & reversible via soft-delete (AC-3)."}); setRows(listLinks()); setBulk(false); setCsv(""); }
  return (
    <Page>
      <PageHeader title="Link Tracking & UTM Manager" description="Governed tracking links with canonical tag taxonomy, QR, expiry/password; clicks + conversions attribute under attribution windows." icon={Link2}
        actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setBulk(true)}>Bulk CSV</Button><Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>New link</Button></div>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Tracked links" value={String(rows.length)}/><MetricCard label="Clicks" value={rows.reduce((s,r)=>s+r.clicks,0).toLocaleString()}/><MetricCard label="Conversions" value={String(rows.reduce((s,r)=>s+r.conversions,0))} tone="positive"/><MetricCard label="Expiring (7d)" value={String(rows.filter(r=>r.expiresAt&&new Date(r.expiresAt).getTime()-Date.now()<7*86400000).length)} tone="warning"/></div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Taxonomy — mediums: {ALLOWED_MEDIUMS.join(", ")}; sources: {ALLOWED_SOURCES.join(", ")}. Free-text outside the set is blocked (AC-2).</p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.slug} ${r.campaign||""} ${r.source} ${r.medium}`}/>
      </PageContent>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New tracked link</DialogTitle><DialogDescription>Tag builder validates against the canonical taxonomy.</DialogDescription></DialogHeader>
        <div className="space-y-2 text-xs"><Input placeholder="Destination URL" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/><Input placeholder="Campaign" value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2"><Select value={form.source} onValueChange={v=>setForm({...form,source:v})}><SelectTrigger><SelectValue placeholder="Source"/></SelectTrigger><SelectContent>{ALLOWED_SOURCES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Select value={form.medium} onValueChange={v=>setForm({...form,medium:v})}><SelectTrigger><SelectValue placeholder="Medium"/></SelectTrigger><SelectContent>{ALLOWED_MEDIUMS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <Input placeholder="Content (e.g. hero-cta)" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/><Input type="datetime-local" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})}/><label className="flex items-center gap-2"><input type="checkbox" checked={form.password} onChange={e=>setForm({...form,password:e.target.checked})}/>Password protect</label>
          {err.length>0&&<p className="text-destructive">{err.join("; ")}</p>}</div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!form.destination.trim()||err.length>0} onClick={create}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={bulk} onOpenChange={setBulk}><DialogContent><DialogHeader><DialogTitle>Bulk generate from CSV</DialogTitle><DialogDescription>One destination URL per line. Importable & reversible (soft-delete).</DialogDescription></DialogHeader><textarea className="w-full h-32 rounded border bg-transparent p-2 text-xs" value={csv} onChange={e=>setCsv(e.target.value)} placeholder={"https://alpha.one/challenge/50k\nhttps://alpha.one/webinar"} /><DialogFooter><Button variant="outline" onClick={()=>setBulk(false)}>Cancel</Button><Button disabled={!csv.trim()} onClick={bulkCreate}>Generate</Button></DialogFooter></DialogContent></Dialog>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-lg overflow-y-auto"><SheetHeader><SheetTitle>{detail?.slug}</SheetTitle><SheetDescription>{detail?.destination}</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs"><Card><CardContent className="p-2"><p className="font-semibold">Click stream (7d)</p><div className="flex items-end gap-1 h-16 mt-1">{detail.trend.map((v,i)=><div key={i} className="flex-1 rounded-t bg-primary/60" style={{height:`${Math.max(6,(v/Math.max(...detail.trend,1))*100)}%`}} title={String(v)}/>)}</div></CardContent></Card>
          <div className="grid grid-cols-2 gap-2"><Card><CardContent className="p-2"><p className="font-semibold">Devices</p>{Object.entries(detail.devices).map(([k,v])=><div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}</CardContent></Card><Card><CardContent className="p-2"><p className="font-semibold">Geo</p>{Object.entries(detail.geo).map(([k,v])=><div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}</CardContent></Card></div>
          <Card><CardContent className="p-2"><p className="font-semibold">Attribution (M5 windows)</p><p>Conversions attributed: {detail.conversions} · Linked campaign: {detail.campaign||"—"} · Referrers: {detail.referrers.map(r=>`${r.name} ${r.pct}%`).join(", ")||"—"}</p></CardContent></Card>
          <p className="text-muted-foreground">Visit https://alpha.one{detail.slug} → redirect records click + conversion attribution (AC-1).</p></div>}
      </SheetContent></Sheet>
    </Page>
  );
}
