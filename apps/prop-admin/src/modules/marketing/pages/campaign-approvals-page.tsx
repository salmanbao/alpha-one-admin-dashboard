"use client";
/** N6 — Campaign Approval Workflow (Wave 2, P1). Draft→review→approved/rejected→scheduled with reviewer comments; mirrors payouts approval pattern. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { CheckCircle } from "lucide-react";
import { listApprovals, submitForReview, approveItem, rejectItem, type ApprovalItem } from "../marketing-ops-store";

const tone = (s:string):"success"|"danger"|"warning"|"info"|"muted" => s==="approved"||s==="scheduled"?"success":s==="rejected"?"danger":s==="in_review"?"warning":"muted";

export function CampaignApprovalsPage() {
  const [, tick] = useState(0);
  const rows = listApprovals();
  const [act, setAct] = useState<{item:ApprovalItem; mode:"approve"|"reject"}|null>(null);
  const [note, setNote] = useState("");
  const cols: Column<ApprovalItem>[] = [
    {key:"name",header:"Campaign",cell:r=><span className="font-medium">{r.name}<span className="block text-[10px] text-muted-foreground">{r.audience} · {r.channel}</span></span>},
    {key:"spend",header:"Est. spend",numeric:true,cell:r=><span className="tabular-nums">${r.spendEst.toLocaleString()}</span>},
    {key:"req",header:"Requested",cell:r=><span className="text-xs">{r.requestedBy} · {relativeTime(r.requestedAt)}</span>},
    {key:"policy",header:"Policy",cell:r=>r.policyHit?<StatusBadge tone="warning">threshold</StatusBadge>:<span className="text-xs text-muted-foreground">—</span>},
    {key:"state",header:"State",cell:r=><StatusBadge tone={tone(r.state)}>{r.state.replace("_"," ")}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">
      {r.state==="draft"&&<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{submitForReview(r.id); recordAudit({action:"campaign.review.submit",entity:"campaign",entityId:r.id,summary:`Submitted ${r.name} for review.`,module:"marketing"}); toast({title:"Submitted for review"}); tick(n=>n+1);}}>Submit</Button>}
      {r.state==="in_review"&&<><Button size="sm" className="h-6 text-[10px]" onClick={()=>{setAct({item:r,mode:"approve"});setNote("");}}>Approve</Button><Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={()=>{setAct({item:r,mode:"reject"});setNote("");}}>Reject</Button></>}
    </div>},
  ];
  return (
    <Page>
      <PageHeader title="Campaign Approvals" description="Dual-control review gate: draft → in review → approved/rejected → scheduled (policy-routed above spend/audience thresholds)." icon={CheckCircle} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Pending review" value={String(rows.filter(r=>r.state==="in_review").length)} tone="warning" />
          <MetricCard label="Approved" value={String(rows.filter(r=>r.state==="approved"||r.state==="scheduled").length)} tone="positive" />
          <MetricCard label="Policy-routed" value={String(rows.filter(r=>r.policyHit).length)} />
        </div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.requestedBy} ${r.state}`} />
      </PageContent>
      <Dialog open={!!act} onOpenChange={o=>!o&&setAct(null)}>
        <DialogContent><DialogHeader><DialogTitle>{act?.mode==="approve"?"Approve campaign":"Reject campaign"}</DialogTitle><DialogDescription>Checklist (consent, domain auth, budget) assumed reviewed. Add a comment (audited).</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Reviewer comment (required)" rows={3} />
          <DialogFooter><Button variant="outline" onClick={()=>setAct(null)}>Cancel</Button><Button disabled={!note.trim()} variant={act?.mode==="reject"?"destructive":"default"} onClick={()=>{ if(!act) return; if(act.mode==="approve") approveItem(act.item.id,"You",note); else rejectItem(act.item.id,"You",note); recordAudit({action:`campaign.review.${act.mode}`,entity:"campaign",entityId:act.item.id,summary:`${act.mode} ${act.item.name}: ${note}`,module:"marketing"}); toast({title:act.mode==="approve"?"Approved":"Rejected"}); setAct(null); tick(n=>n+1); }}>{act?.mode==="approve"?"Approve":"Reject"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
