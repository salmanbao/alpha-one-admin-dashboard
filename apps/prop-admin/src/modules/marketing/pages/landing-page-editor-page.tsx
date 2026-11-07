"use client";
/** R2-01 — Landing Page Editor (editor screen). Block palette/canvas/inspector (simplified), device switcher, SEO, version history, publish schedule. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { FileEdit, Save, Eye, History, Rocket, Smartphone, Monitor, Tablet } from "lucide-react";
import { getLandingPage, saveLandingPage, publishLandingPage, unpublishLandingPage, listLandingPages } from "../landing-pages-store";

const PALETTE = ["hero","benefit list","pricing table","testimonial","FAQ","countdown","form embed (R2-02)","video","trust badges"];
export function LandingPageEditorPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id || listLandingPages()[0]?.id;
  const base = useMemo(()=> id? getLandingPage(id): undefined,[id]);
  const [page,setPage]=useState(base);
  const [device,setDevice]=useState<"desktop"|"tablet"|"mobile">("desktop");
  const [hist,setHist]=useState(false); const [restore,setRestore]=useState<number|null>(null);
  if(!page) return <Page><PageContent><p className="text-sm text-muted-foreground">No page selected. <button className="underline" onClick={()=>navigate("landing-pages")}>Back to list</button></p></PageContent></Page>;
  function addBlock(type:string){ setPage(p=>p?{...p,blocks:[...p.blocks,{id:`b${Date.now()}`,type,label:type}]}:p); }
  function save(){ if(!page) return; saveLandingPage(page); recordAudit({action:"landing.save",entity:"landing-page",entityId:page.id,summary:`Saved ${page.name} v${(page.version||1)+1}.`,module:"marketing"}); toast({title:"Saved",description:`Draft v${(page.version||1)+1} saved (live stays on v${page.publishedVersion ?? "—"} until republished).`}); setPage({...page,version:(page.version||1)+1}); }
  function publish(){ if(!page) return; publishLandingPage(page.id); recordAudit({action:"landing.publish",entity:"landing-page",entityId:page.id,summary:`Published ${page.name}.`,module:"marketing"}); toast({title:"Published",description:`${page.name} published to preview URL (dummy). View/conversion events tracked.`}); setPage({...page,status:"published",publishedVersion:page.version}); }
  return (
    <Page>
      <PageHeader title={`Editor: ${page.name}`} description={`/${page.slug} · v${page.version}${page.publishedVersion?` · live v${page.publishedVersion}`:""} · ${page.status}`} icon={FileEdit}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>toast({title:"Preview opened",description:"Trader-look frame (dummy)."})}><Eye className="mr-1 h-4 w-4"/>Preview</Button><Button variant="outline" size="sm" onClick={()=>setHist(true)}><History className="mr-1 h-4 w-4"/>Versions</Button><Button variant="outline" size="sm" onClick={save}><Save className="mr-1 h-4 w-4"/>Save</Button><Button size="sm" onClick={publish}><Rocket className="mr-1 h-4 w-4"/>Publish</Button></div>} />
      <PageContent>
        <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Device:</span>{[["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]].map(([d,I]:any)=><Button key={d} size="sm" variant={device===d?"default":"outline"} className="h-7" onClick={()=>setDevice(d)}><I className="h-3.5 w-3.5"/></Button>)}
          {page.status==="published"&&<Button size="sm" variant="ghost" className="text-destructive h-7" onClick={()=>{unpublishLandingPage(page.id); recordAudit({action:"landing.unpublish",entity:"landing-page",entityId:page.id,summary:`Unpublished ${page.name}.`,severity:"warning",module:"marketing"}); setPage({...page,status:"draft"}); toast({title:"Unpublished"});}}>Unpublish</Button>}
        </div>
        <div className="grid gap-3 lg:grid-cols-[200px_1fr_260px]">
          <Card><CardContent className="p-2 space-y-1"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Block palette</p>{PALETTE.map(b=><button key={b} type="button" className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={()=>addBlock(b)}>+ {b}</button>)}</CardContent></Card>
          <Card><CardContent className={`p-3 space-y-2 ${device==="mobile"?"max-w-[360px]":device==="tablet"?"max-w-[720px]":""} mx-auto`}><p className="text-[10px] text-muted-foreground text-center">Canvas ({device}) — drag order; edits never touch live URL until republished</p>{page.blocks.map((b,i)=><div key={b.id} className="rounded border p-2 text-xs flex items-center justify-between"><span><strong>{i+1}. {b.label}</strong> <span className="text-muted-foreground">({b.type})</span>{b.visibility&&<Badge variant="secondary" className="ml-1 text-[9px]">visibility: {b.visibility}</Badge>}</span><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>toast({title:"Visibility rule",description:"Evaluates against M3 segment engine (e.g. KYC-verified, not deposited)."})}>Rules</Button></div>)}</CardContent></Card>
          <Card><CardContent className="p-2 space-y-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Inspector & SEO</p>
            <div><label className="text-[10px]">Page title</label><Input value={page.seo.title} onChange={e=>setPage({...page,seo:{...page.seo,title:e.target.value}})} className="h-7 text-xs mt-0.5" /></div>
            <div><label className="text-[10px]">Meta description</label><Textarea value={page.seo.description} onChange={e=>setPage({...page,seo:{...page.seo,description:e.target.value}})} rows={2} className="text-xs mt-0.5" /></div>
            <div><label className="text-[10px]">OG image (R2-04)</label><Input value={page.seo.ogImage??""} onChange={e=>setPage({...page,seo:{...page.seo,ogImage:e.target.value}})} className="h-7 text-xs mt-0.5" placeholder="asset ref" /></div>
            <div><label className="text-[10px]">Canonical</label><Input value={page.seo.canonical??""} onChange={e=>setPage({...page,seo:{...page.seo,canonical:e.target.value}})} className="h-7 text-xs mt-0.5" /></div>
            <div><label className="text-[10px]">Publish schedule (optional)</label><Input type="datetime-local" className="h-7 text-xs mt-0.5" onChange={e=>page&&publishLandingPage(page.id,e.target.value)} /></div>
          </CardContent></Card>
        </div>
      </PageContent>
      <Sheet open={hist} onOpenChange={setHist}><SheetContent><SheetHeader><SheetTitle>Version history</SheetTitle><SheetDescription>Restore-with-confirm; published version is pinned.</SheetDescription></SheetHeader>
        <div className="mt-4 space-y-2">{[page.version,page.version-1,page.version-2].filter(v=>v>0).map(v=><div key={v} className="flex items-center justify-between rounded border p-2 text-sm"><span>v{v} {v===page.publishedVersion?<Badge variant="secondary" className="text-[9px]">live</Badge>:v===page.version?<Badge variant="outline" className="text-[9px]">draft</Badge>:""}</span><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setRestore(v)}>Restore</Button></div>)}</div>
      </SheetContent></Sheet>
      <AlertDialog open={restore!=null} onOpenChange={o=>!o&&setRestore(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore v{restore}?</AlertDialogTitle><AlertDialogDescription>Creates a new draft from v{restore}. The live URL is not changed until you republish.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>{toast({title:"Restored",description:`v${restore} restored as new draft.`}); setRestore(null);}}>Restore</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Page>
  );
}
