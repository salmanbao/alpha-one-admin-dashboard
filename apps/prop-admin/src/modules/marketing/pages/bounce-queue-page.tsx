"use client";
/** N5 — Bounce & Complaint Queue (Wave 2, P1). Process events, auto-suppression, manual review, bulk actions, links to campaign. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { AlertOctagon } from "lucide-react";
import { listBounces, suppressBounce, unsuppressBounce, type BounceEvent } from "../marketing-ops-store";

export function BounceQueuePage() {
  const [, tick] = useState(0);
  const rows = listBounces();
  const [confirm, setConfirm] = useState<{ids:string[];mode:"suppress"|"unsuppress"}|null>(null);
  const [reason, setReason] = useState("");
  const cols: Column<BounceEvent>[] = [
    {key:"email",header:"Email",cell:r=><span className="font-mono text-xs">{r.email}</span>},
    {key:"reason",header:"Reason",cell:r=><StatusBadge tone={r.reason==="complaint"||r.reason==="hard"||r.reason==="block"?"danger":"warning"}>{r.reason}</StatusBadge>},
    {key:"sev",header:"Severity",cell:r=><StatusBadge tone={r.severity==="high"?"danger":r.severity==="med"?"warning":"muted"}>{r.severity}</StatusBadge>},
    {key:"prov",header:"Provider",cell:r=><span className="text-xs">{r.provider}</span>},
    {key:"cmp",header:"Campaign",cell:r=><span className="text-xs text-muted-foreground">{r.campaignId??"—"}</span>},
    {key:"ts",header:"When",sortValue:r=>r.ts,cell:r=><span className="text-xs">{relativeTime(r.ts)}</span>},
    {key:"sup",header:"Suppressed",cell:r=><StatusBadge tone={r.suppressed?"muted":"warning"}>{r.suppressed?"yes":"no"}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">{!r.suppressed?<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setConfirm({ids:[r.id],mode:"suppress"});setReason("");}}>Suppress</Button>:<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{setConfirm({ids:[r.id],mode:"unsuppress"});setReason("");}}>Unsuppress</Button>}</div>},
  ];
  return (
    <Page>
      <PageHeader title="Bounce & Complaint Queue" description="Process events, apply suppression (synced to consent center), manual review for soft bounces." icon={AlertOctagon} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Open events" value={String(rows.filter(r=>!r.resolved).length)} tone="warning" />
          <MetricCard label="Complaints (24h)" value={String(rows.filter(r=>r.reason==="complaint").length)} tone="negative" />
          <MetricCard label="Auto-suppressed" value={String(rows.filter(r=>r.suppressed).length)} />
        </div>
        <p className="text-[11px] text-muted-foreground">Suppression changes sync to the Consent & Suppression Center. Resubscription of suppressed addresses is blocked by the send gateway.</p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.email} ${r.reason} ${r.provider}`} />
      </PageContent>
      <AlertDialog open={!!confirm} onOpenChange={o=>!o&&setConfirm(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.mode==="suppress"?"Suppress contacts?":"Remove suppression?"}</AlertDialogTitle><AlertDialogDescription>Provide a reason (audited). {confirm?.mode==="suppress"?"Contacts will be blocked from future sends.":"Re-enables sending — ensure this is safe."}</AlertDialogDescription></AlertDialogHeader>
          <Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (required)" />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!reason.trim()} onClick={()=>{ if(!confirm) return; confirm.ids.forEach(id=> confirm.mode==="suppress"?suppressBounce(id,reason):unsuppressBounce(id,reason)); recordAudit({action:`bounce.${confirm.mode}`,entity:"bounce",entityId:confirm.ids.join(","),summary:`${confirm.mode} ${confirm.ids.length} event(s): ${reason}`,module:"marketing"}); toast({title:confirm.mode==="suppress"?"Suppressed":"Unsuppressed",description:`${confirm.ids.length} contact(s) updated.`}); setConfirm(null); tick(n=>n+1); }}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
