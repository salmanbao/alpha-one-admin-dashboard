"use client";
/** N5 — Bounce & Complaint Queue (depth). Reason codes, bulk actions, auto-suppression rules, export, links. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { AlertOctagon, Download } from "lucide-react";
import { listBounces, suppressBounce, unsuppressBounce, bulkSuppress, bulkUnsuppress, type BounceEvent } from "../marketing-ops-store";

export function BounceQueuePage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const rows = listBounces();
  // SF-13: selection owned by the DataTable API (plain id array).
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ids:string[];mode:"suppress"|"unsuppress"}|null>(null);
  const [reason, setReason] = useState("");
  const cols: Column<BounceEvent>[] = [
    {key:"email",header:"Email",cell:r=><span className="font-mono text-xs">{r.email}</span>},
    {key:"reason",header:"Reason / code",cell:r=><span><StatusBadge tone={r.reason==="complaint"||r.reason==="hard"||r.reason==="block"?"danger":"warning"}>{r.reason}</StatusBadge><span className="block text-[10px] text-muted-foreground">{r.reasonCode||""}</span></span>},
    {key:"sev",header:"Severity",cell:r=><StatusBadge tone={r.severity==="high"?"danger":r.severity==="med"?"warning":"muted"}>{r.severity}</StatusBadge>},
    {key:"prov",header:"Provider/campaign",cell:r=><span className="text-xs">{r.provider}<span className="block text-[10px] text-muted-foreground">{r.campaignId||"—"}</span></span>},
    {key:"ts",header:"When",sortValue:r=>r.ts,cell:r=><span className="text-xs">{relativeTime(r.ts)}</span>},
    {key:"sup",header:"Suppressed",cell:r=><StatusBadge tone={r.suppressed?"muted":"warning"}>{r.suppressed?"yes":"no"}</StatusBadge>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end">{!r.suppressed?<Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{setConfirm({ids:[r.id],mode:"suppress"});setReason("");}}>Suppress</Button>:<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{setConfirm({ids:[r.id],mode:"unsuppress"});setReason("");}}>Unsuppress</Button>}</div>},
  ];
  return (
    <Page>
      <PageHeader title="Bounce & Complaint Queue" description="Reason codes, bulk actions, auto-suppression rules; syncs to the consent center and informs incidents." icon={AlertOctagon}
        actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{recordAudit({action:"bounce.export",entity:"bounce-queue",entityId:"all",summary:"Exported bounce queue",module:"marketing"}); toast({title:"Exported"});}}><Download className="mr-1 h-4 w-4"/>Export</Button></div>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Open events" value={String(rows.filter(r=>!r.resolved).length)} tone="warning" /><MetricCard label="Complaints (24h)" value={String(rows.filter(r=>r.reason==="complaint").length)} tone="negative" /><MetricCard label="Auto-suppressed" value={String(rows.filter(r=>r.suppressed).length)} /><MetricCard label="Linked campaigns" value={String(new Set(rows.map(r=>r.campaignId).filter(Boolean)).size)}/></div>
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]"><div><p className="text-[11px] text-muted-foreground mb-2">Suppression syncs to Consent & Suppression Center; resubscription blocked by send gateway. <button className="underline" onClick={()=>navigate("deliverability-incidents")}>View incidents</button></p><DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.email} ${r.reason} ${r.reasonCode||""} ${r.provider}`}
            selectable selectedIds={selected} onSelectionChange={setSelected}
            bulkToolbar={<>
              <Button size="sm" variant="outline" onClick={()=>{setConfirm({ids:selected,mode:"suppress"});setReason("");}}>Bulk suppress</Button>
              <Button size="sm" variant="ghost" onClick={()=>{setConfirm({ids:selected,mode:"unsuppress"});setReason("");}}>Bulk unsuppress</Button>
            </>} /></div>
          <Card><CardContent className="p-3 text-xs space-y-2"><p className="font-semibold">Auto-suppression rules</p><ul className="list-disc pl-4 space-y-1"><li>Hard bounce → suppress immediately (on)</li><li>Complaint/FBL → suppress + notify (on)</li><li>2 soft bounces in 7d → suppress (on)</li><li>Block/reputation → review queue (on)</li></ul><p className="text-muted-foreground">Rules applied by the gateway; this view reflects their state.</p></CardContent></Card></div>
      </PageContent>
      <AlertDialog open={!!confirm} onOpenChange={o=>!o&&setConfirm(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.mode==="suppress"?"Suppress contacts?":"Remove suppression?"}</AlertDialogTitle><AlertDialogDescription>Reason required (audited). {confirm?.mode==="suppress"?"Blocks future sends.":"Re-enables sending — ensure safe."}</AlertDialogDescription></AlertDialogHeader>
          <Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (required)" />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!reason.trim()} onClick={()=>{ if(!confirm) return; if(confirm.mode==="suppress") bulkSuppress(confirm.ids,reason); else bulkUnsuppress(confirm.ids,reason); recordAudit({action:`bounce.${confirm.mode}`,entity:"bounce",entityId:confirm.ids.join(","),summary:`${confirm.mode} ${confirm.ids.length} event(s): ${reason}`,module:"marketing"}); toast({title:confirm.mode==="suppress"?"Suppressed":"Unsuppressed",description:`${confirm.ids.length} contact(s) updated.`}); setSelected([]); setConfirm(null); tick(n=>n+1); }}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
