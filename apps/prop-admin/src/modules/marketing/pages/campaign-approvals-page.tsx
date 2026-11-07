"use client";
/** N6 — Campaign Approvals (depth: R2-F04 snapshots, content diff, comments timeline, SLA, delegate). */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { CheckCircle, MessageSquare, GitCompare, UserPlus, Clock } from "lucide-react";
import { listApprovals, submitForReview, approveItem, rejectItem, commentApproval, delegateApproval, type ApprovalItem } from "../marketing-ops-store";

const tone = (s:string):"success"|"danger"|"warning"|"info"|"muted" => s==="approved"||s==="scheduled"?"success":s==="rejected"?"danger":s==="in_review"?"warning":"muted";

export function CampaignApprovalsPage() {
  const [, tick] = useState(0);
  const rows = listApprovals();
  const [act, setAct] = useState<{item:ApprovalItem; mode:"approve"|"reject"}|null>(null);
  const [detail,setDetail]=useState<ApprovalItem|null>(null);
  const [note, setNote] = useState("");
  const [comment,setComment]=useState("");
  const [delegate,setDelegate]=useState("");
  function sla(s?:string){ if(!s)return "—"; const d=Date.now()-new Date(s).getTime(); return d>0?`overdue by ${Math.round(d/3600000)}h`:`due in ${Math.round(-d/3600000)}h`; }
  const cols: Column<ApprovalItem>[] = [
    {key:"name",header:"Campaign",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.name}<span className="block text-[10px] text-muted-foreground">{r.audience} · {r.channel}</span></button>},
    {key:"spend",header:"Est. spend",numeric:true,cell:r=><span className="tabular-nums">${r.spendEst.toLocaleString()}</span>},
    {key:"req",header:"Requested",cell:r=><span className="text-xs">{r.requestedBy} · {relativeTime(r.requestedAt)}</span>},
    {key:"assignee",header:"Assignee/SLA",cell:r=><span className="text-xs">{r.assignee||"Unassigned"}<span className="block text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5"/>{sla(r.slaDue)}</span></span>},
    {key:"policy",header:"Policy",cell:r=>r.policyHit?<StatusBadge tone="warning">threshold</StatusBadge>:<span className="text-xs text-muted-foreground">—</span>},
    {key:"state",header:"State",cell:r=><StatusBadge tone={tone(r.state)}>{r.state.replace("_"," ")}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">
      {r.state==="draft"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{submitForReview(r.id); recordAudit({action:"campaign.review.submit",entity:"campaign",entityId:r.id,summary:`Submitted ${r.name} for review (snapshot captured).`,module:"marketing"}); toast({title:"Submitted for review",description:"Content snapshot captured at submit (R2-F04)"}); tick(n=>n+1);}}>Submit</Button>}
      {r.state==="in_review"&&<><Button size="sm" className="h-6 text-[10px]" onClick={()=>{setAct({item:r,mode:"approve"});setNote("");}}>Approve</Button><Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={()=>{setAct({item:r,mode:"reject"});setNote("");}}>Reject</Button></>}
    </div>},
  ];
  const cur = detail;
  return (
    <Page>
      <PageHeader title="Campaign Approvals" description="Dual-control review gate with snapshots, side-by-side diff, comments timeline, SLA, and delegation." icon={CheckCircle} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Pending review" value={String(rows.filter(r=>r.state==="in_review").length)} tone="warning" />
          <MetricCard label="Approved" value={String(rows.filter(r=>r.state==="approved"||r.state==="scheduled").length)} tone="positive" />
          <MetricCard label="Policy-routed" value={String(rows.filter(r=>r.policyHit).length)} />
          <MetricCard label="Overdue SLA" value={String(rows.filter(r=>r.slaDue && Date.now()>new Date(r.slaDue).getTime() && r.state==="in_review").length)} tone="negative" />
        </div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.requestedBy} ${r.state}`} />
      </PageContent>
      <Dialog open={!!act} onOpenChange={o=>!o&&setAct(null)}>
        <DialogContent><DialogHeader><DialogTitle>{act?.mode==="approve"?"Approve campaign":"Reject campaign"}</DialogTitle><DialogDescription>Snapshots enable diffing in detail view. Add an audited comment.</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Reviewer comment (required)" rows={3} />
          <DialogFooter><Button variant="outline" onClick={()=>setAct(null)}>Cancel</Button><Button disabled={!note.trim()} variant={act?.mode==="reject"?"destructive":"default"} onClick={()=>{ if(!act) return; if(act.mode==="approve") approveItem(act.item.id,"You",note); else rejectItem(act.item.id,"You",note); recordAudit({action:`campaign.review.${act.mode}`,entity:"campaign",entityId:act.item.id,summary:`${act.mode} ${act.item.name}: ${note}`,module:"marketing"}); toast({title:act.mode==="approve"?"Approved":"Rejected"}); setAct(null); tick(n=>n+1); }}>{act?.mode==="approve"?"Approve":"Reject"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!cur} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {cur&&(<><SheetHeader><SheetTitle>{cur.name}</SheetTitle><SheetDescription>{cur.channel} · {cur.audience} · Est ${cur.spendEst.toLocaleString()} · Policy: {cur.policyHit?"routed":"ok"}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs"><Card><CardContent className="p-2"><p className="text-muted-foreground">State</p><StatusBadge tone={tone(cur.state)}>{cur.state.replace("_"," ")}</StatusBadge></CardContent></Card><Card><CardContent className="p-2"><p className="text-muted-foreground">Assignee/SLA</p><p>{cur.assignee||"—"} · {sla(cur.slaDue)}</p></CardContent></Card><Card><CardContent className="p-2"><p className="text-muted-foreground">Delegate</p><p>{cur.delegateTo||"—"}</p></CardContent></Card></div>
              <Card><CardContent className="p-2"><p className="text-xs font-semibold mb-1 flex items-center gap-1"><GitCompare className="h-3 w-3"/>Content diff (R2-F04 snapshots)</p>
                <div className="grid md:grid-cols-2 gap-2 text-xs"><div className="rounded border p-2"><p className="text-muted-foreground">At submit {cur.snapshotAtSubmit?.at&&`(${relativeTime(cur.snapshotAtSubmit.at)})`}</p><p className="font-medium">{cur.snapshotAtSubmit?.subject||"—"}</p><p className="text-muted-foreground">{cur.snapshotAtSubmit?.preheader||""}</p><pre className="mt-1 whitespace-pre-wrap text-[11px]">{cur.snapshotAtSubmit?.body||"No snapshot captured."}</pre></div><div className="rounded border p-2"><p className="text-muted-foreground">At approve {cur.snapshotAtApprove?.at&&`(${relativeTime(cur.snapshotAtApprove.at)})`}</p><p className="font-medium">{cur.snapshotAtApprove?.subject||cur.snapshotAtSubmit?.subject||"—"}</p><pre className="mt-1 whitespace-pre-wrap text-[11px]">{cur.snapshotAtApprove?.body||cur.snapshotAtSubmit?.body||"—"}</pre></div></div>
              </CardContent></Card>
              <Card><CardContent className="p-2"><p className="text-xs font-semibold mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3"/>Comments timeline</p>
                <div className="space-y-1 text-xs mb-2">{cur.comments.map((c,i)=><div key={i} className="rounded border p-1">{c}</div>)}</div>
                <div className="flex gap-2"><Input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add comment" className="h-7 text-xs"/><Button size="sm" className="h-7 text-xs" disabled={!comment.trim()} onClick={()=>{commentApproval(cur.id,"You",comment); recordAudit({action:"campaign.review.comment",entity:"campaign",entityId:cur.id,summary:comment,module:"marketing"}); setComment(""); tick(n=>n+1);}}>Add</Button></div>
              </CardContent></Card>
              <Card><CardContent className="p-2"><p className="text-xs font-semibold mb-1 flex items-center gap-1"><UserPlus className="h-3 w-3"/>Delegate</p>
                <div className="flex gap-2"><Input value={delegate} onChange={e=>setDelegate(e.target.value)} placeholder="Delegate to (name/email)" className="h-7 text-xs"/><Button size="sm" variant="outline" className="h-7 text-xs" disabled={!delegate.trim()} onClick={()=>{delegateApproval(cur.id,delegate.trim()); recordAudit({action:"campaign.review.delegate",entity:"campaign",entityId:cur.id,summary:`Delegated to ${delegate.trim()}`,module:"marketing"}); setDelegate(""); tick(n=>n+1);}}>Delegate</Button></div>
              </CardContent></Card>
            </div></>)}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
