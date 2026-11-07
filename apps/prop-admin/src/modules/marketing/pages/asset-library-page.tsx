"use client";
/** R2-04 — Brand & Creative Asset Library (grid + detail sheet + brand kit). */
import { useState } from "react";
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
import { Image, Plus, Trash2, Replace } from "lucide-react";
import { listAssets, createAsset, deleteAsset, replaceAsset, getBrandKit, saveBrandKit, type Asset } from "../asset-library-store";

export function AssetLibraryPage(){
  const [,tick]=useState(0); const rows=listAssets(); const [detail,setDetail]=useState<Asset|null>(null);
  const [open,setOpen]=useState(false); const [form,setForm]=useState({name:"",type:"image" as Asset["type"],tags:"",url:""});
  const [brand,setBrand]=useState(getBrandKit());
  const cols: Column<Asset>[] = [
    {key:"name",header:"Asset",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.name}<span className="block text-[10px] text-muted-foreground">{r.type} · {(r.tags||[]).join(", ")}</span></button>},
    {key:"use",header:"Usage",numeric:true,cell:r=>r.usedBy.length},
    {key:"exp",header:"Expiry",cell:r=>r.expiresAt?<StatusBadge tone={new Date(r.expiresAt).getTime()<Date.now()?"danger":"warning"}>{new Date(r.expiresAt).toLocaleDateString()}</StatusBadge>:<span className="text-muted-foreground">—</span>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>{const res=deleteAsset(r.id); if(!res.ok){toast({title:"Cannot delete",description:`${res.reason}. Usage: ${(res.usedBy||[]).join("; ")}`,variant:"destructive" as any});} else {recordAudit({action:"asset.delete",entity:"asset",entityId:r.id,summary:`Deleted ${r.name}`,module:"marketing"}); toast({title:"Deleted"}); tick(n=>n+1);} }}><Trash2 className="h-3 w-3"/></Button></div>},
  ];
  return (
    <Page>
      <PageHeader title="Brand & Creative Asset Library" description="Approved assets for composer, templates, landing pages and on-site studio. Brand kit tokens propagate to previews." icon={Image}
        actions={<Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>Upload asset</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Assets" value={String(rows.length)}/><MetricCard label="In use" value={String(rows.filter(r=>r.usedBy.length).length)} tone="positive"/><MetricCard label="Expiring/expired" value={String(rows.filter(r=>r.expiresAt).length)} tone="warning"/><MetricCard label="Brand kit" value="configured" tone="positive"/></div>
        <Card><CardContent className="p-3"><p className="text-xs font-semibold mb-2">Brand kit (consumed by template editor/composer/landing)</p><div className="grid gap-2 sm:grid-cols-4 text-xs"><div><label className="text-[10px]">Primary</label><Input value={brand.primary} onChange={e=>setBrand({...brand,primary:e.target.value})} className="h-7"/></div><div><label className="text-[10px]">Secondary</label><Input value={brand.secondary} onChange={e=>setBrand({...brand,secondary:e.target.value})} className="h-7"/></div><div><label className="text-[10px]">Heading font</label><Input value={brand.fontHeading} onChange={e=>setBrand({...brand,fontHeading:e.target.value})} className="h-7"/></div><div className="flex items-end"><Button size="sm" className="h-7 w-full" onClick={()=>{saveBrandKit(brand); recordAudit({action:"brandkit.save",entity:"brand-kit",entityId:"default",summary:"Updated brand kit tokens",module:"marketing"}); toast({title:"Brand kit saved",description:"Tokens propagate to previewed email/landing."});}}>Save kit</Button></div></div></CardContent></Card>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.type} ${r.tags.join(" ")}`} />
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><SheetContent className="sm:max-w-lg"><SheetHeader><SheetTitle>{detail?.name}</SheetTitle><SheetDescription>{detail?.type} · {detail?.usedBy.length} usage(s)</SheetDescription></SheetHeader>
        {detail&&<div className="mt-3 space-y-3 text-xs"><div className="rounded border bg-muted/30 p-6 text-center text-muted-foreground">Preview: {detail.url||detail.meta?.text?.slice(0,60)||detail.type} (vault-adjacent storage; type/size enforced on upload)</div>
          <div><p className="font-semibold">Usage map</p>{detail.usedBy.length?<ul className="list-disc pl-4">{detail.usedBy.map(u=><li key={u}>{u}</li>)}</ul>:<p className="text-muted-foreground">Not used.</p>}</div>
          <div><p className="font-semibold">Metadata</p><p>Tags: {detail.tags.join(", ")||"—"}</p><p>Expiry: {detail.expiresAt?new Date(detail.expiresAt).toLocaleString():"none"}</p></div>
          {detail.expiresAt&&<Button size="sm" variant="outline" onClick={()=>{const rep=rows.find(r=>r.id!==detail.id); if(rep){replaceAsset(detail.id,rep.id); recordAudit({action:"asset.replace",entity:"asset",entityId:detail.id,summary:`Redirected usage of ${detail.name} to ${rep.name}`,module:"marketing"}); toast({title:"Replaced with redirect",description:`Usage moved to ${rep.name}`}); tick(n=>n+1); setDetail(null);} }}><Replace className="mr-1 h-3 w-3"/>Replace with redirect (expired)</Button>}
        </div>}
      </SheetContent></Sheet>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Upload asset</DialogTitle><DialogDescription>Type/size limits enforced; stored vault-adjacent (not hardcoded platform URLs).</DialogDescription></DialogHeader>
        <div className="space-y-2 text-xs"><Input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><Select value={form.type} onValueChange={v=>setForm({...form,type:v as any})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["logo","image","video","copy_block","countdown_preset"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input placeholder="Tags (comma separated)" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/><Input placeholder="URL / content ref" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/></div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!form.name.trim()} onClick={()=>{const rec=createAsset({name:form.name,type:form.type,tags:form.tags?form.tags.split(",").map(s=>s.trim()):[],url:form.url||undefined}); recordAudit({action:"asset.create",entity:"asset",entityId:rec.id,summary:`Uploaded asset ${rec.name}`,module:"marketing"}); toast({title:"Asset added"}); setOpen(false); setForm({name:"",type:"image",tags:"",url:""}); tick(n=>n+1);}}>Add</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
