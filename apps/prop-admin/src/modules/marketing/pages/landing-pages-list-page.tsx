"use client";
/** R2-01 — Landing Pages list (Pages list screen). */
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
import { FileEdit, Plus, Eye } from "lucide-react";
import { listLandingPages, createLandingPage, type LandingPage } from "../landing-pages-store";

const tone = (s:string)=>s==="published"?"success":s==="archived"?"muted":"warning";
export function LandingPagesListPage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const rows = listLandingPages();
  const [open,setOpen]=useState(false); const [name,setName]=useState(""); const [tpl,setTpl]=useState("challenge promo");
  const cols: Column<LandingPage>[] = [
    {key:"name",header:"Page",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>navigate("landing-page-editor",{id:r.id})}>{r.name}<span className="block text-[10px] text-muted-foreground font-normal">/{r.slug} · {r.template}</span></button>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={tone(r.status) as any}>{r.status}</StatusBadge>},
    {key:"f",header:"Funnel step",cell:r=>r.funnelStep??"—"},
    {key:"v",header:"Version",cell:r=>`v${r.version}${r.publishedVersion?` (live v${r.publishedVersion})`:""}`},
    {key:"vis",header:"Visits",numeric:true,cell:r=>r.visits.toLocaleString()},
    {key:"conv",header:"Conversion",numeric:true,cell:r=>r.visits?`${((r.conversions/r.visits)*100).toFixed(1)}%`:"—"},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>toast({title:"Preview",description:`Preview URL opened for ${r.name} (dummy).`})}><Eye className="mr-1 h-3 w-3"/>Preview</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={()=>navigate("landing-page-editor",{id:r.id})}>Edit</Button></div>},
  ];
  return (
    <Page>
      <PageHeader title="Landing Pages & Funnels" description="Build and version conversion pages per challenge/region/promo. Blocks can target segments (M3)." icon={FileEdit}
        actions={<Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>New Page</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Pages" value={String(rows.length)} /><MetricCard label="Published" value={String(rows.filter(r=>r.status==="published").length)} tone="positive" /><MetricCard label="Avg conversion" value="6.1%" tone="positive" /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.slug} ${r.template}`} />
      </PageContent>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New landing page</DialogTitle><DialogDescription>Pick a template to start.</DialogDescription></DialogHeader>
        <div className="space-y-3"><div><label className="text-xs">Name</label><Input value={name} onChange={e=>setName(e.target.value)} className="mt-1" placeholder="e.g. Spring Deposit Offer" /></div>
          <div><label className="text-xs">Template</label><Select value={tpl} onValueChange={setTpl}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["challenge promo","webinar signup","deposit offer","leaderboard"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div></div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={()=>{ const rec=createLandingPage(tpl,name.trim()); recordAudit({action:"landing.create",entity:"landing-page",entityId:rec.id,summary:`Created landing page ${rec.name} from ${tpl}.`,module:"marketing"}); toast({title:"Page created"}); setOpen(false); setName(""); tick(n=>n+1); navigate("landing-page-editor",{id:rec.id}); }}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
