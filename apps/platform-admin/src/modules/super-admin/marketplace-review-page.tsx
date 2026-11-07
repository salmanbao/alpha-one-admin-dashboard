"use client";
/** N15 — Marketplace App Review Pipeline (Wave 3/P2). Submission queue, review checklist, versioning/rollback, publish/suspend. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/platform/console-store";
import { Plug } from "lucide-react";

type State = "submitted"|"in_review"|"needs_info"|"published"|"suspended";
interface Sub { id:string; app:string; publisher:string; version:string; state:State; perms:string[]; notes:string }
const seed: Sub[] = [
  {id:"s1",app:"SignalPush",publisher:"Acme Labs",version:"1.2.0",state:"submitted",perms:["events.read","contacts.read"],notes:""},
  {id:"s2",app:"LedgerSync",publisher:"FinCo",version:"2.0.1",state:"in_review",perms:["payouts.read"],notes:""},
  {id:"s3",app:"OldWebhook",publisher:"Legacy Inc",version:"0.9.0",state:"needs_info",perms:["events.read"],notes:"Clarify data retention."},
];
export function MarketplaceReviewPage() {
  const [rows,setRows]=useState(seed);
  const [act,setAct]=useState<{r:Sub;next:State}|null>(null);
  const [msg,setMsg]=useState("");
  const cols: Column<Sub>[] = [
    {key:"app",header:"App",cell:r=><span className="font-medium">{r.app}<span className="block text-[10px] text-muted-foreground">{r.publisher} · v{r.version}</span></span>},
    {key:"perms",header:"Scopes requested",cell:r=><span className="font-mono text-[10px]">{r.perms.join(", ")}</span>},
    {key:"st",header:"State",cell:r=><StatusBadge tone={r.state==="published"?"success":r.state==="suspended"?"danger":r.state==="needs_info"?"warning":"info"}>{r.state.replace("_"," ")}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">{r.state!=="published"&&<Button size="sm" className="h-6 text-[10px]" onClick={()=>{setAct({r,next:"published"});setMsg("");}}>Publish</Button>}{r.state==="submitted"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setAct({r,next:"needs_info"});setMsg("");}}>Needs info</Button>}{r.state==="published"&&<Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={()=>{setAct({r,next:"suspended"});setMsg("");}}>Suspend</Button>}<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>toast({title:"Rollback",description:`Rolled ${r.app} back to previous version (dummy).`})}>Rollback ver.</Button></div>},
  ];
  return (
    <Page>
      <PageHeader title="Marketplace App Review Pipeline" description="Submission queue, permissions/data-handling checklist, versioning/rollback, publish/suspend." icon={Plug} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">{(["submitted","in_review","needs_info","published"] as State[]).map(s=><MetricCard key={s} label={s.replace("_"," ")} value={String(rows.filter(r=>r.state===s).length)} />)}</div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8} />
      </PageContent>
      <Dialog open={!!act} onOpenChange={o=>!o&&setAct(null)}>
        <DialogContent><DialogHeader><DialogTitle>{act?.next} — {act?.r.app}</DialogTitle><DialogDescription>Review checklist: permissions requested, data handling, webhook endpoints verified. Add note (audited).</DialogDescription></DialogHeader>
          <Textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Reviewer note / publisher communication" />
          <DialogFooter><Button variant="outline" onClick={()=>setAct(null)}>Cancel</Button><Button onClick={()=>{ if(!act) return; setRows(rs=>rs.map(x=>x.id===act.r.id?{...x,state:act.next,notes:msg}:x)); recordAudit({actor:"You",action:"marketplace.review",target:act.r.id,detail:`${act.r.app} → ${act.next}. ${msg}`,severity:act.next==='suspended'?'critical':'warning'}); toast({title:"Updated",description:`${act.r.app} is now ${act.next}.`}); setAct(null); }}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
