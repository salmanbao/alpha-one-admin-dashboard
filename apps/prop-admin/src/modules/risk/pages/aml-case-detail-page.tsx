"use client";
/** R2-07 — AML case detail: KYC artifacts, sanctions/PEP, movements, explainability, disposition, escalation, SAR/STR stub, payouts hold hook. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, FileWarning } from "lucide-react";
import { getAmlCase, listAmlAlerts, dispositionAml, updateAmlCase } from "../aml-store";
import { payoutsHeldByCase } from "@/modules/payouts/payout-store";

export function AmlCaseDetailPage(){
  const { router, navigate, user } = usePlatform();
  // R3-F02 AC-3 — four-eyes: only a compliance.aml.approve holder may
  // release the payout freeze; viewing the case is compliance.aml.read.
  const canRelease = hasPermission(user, "compliance.aml.approve");
  const releaseTitle = canRelease ? undefined : "Requires compliance.aml.approve";
  const id = router.params.id || listAmlAlerts()[0]?.id;
  const base = useMemo(()=> id? getAmlCase(id): undefined,[id]);
  const [,tick]=useState(0); const c = base;
  const [rationale,setRationale]=useState(""); const [pending,setPending]=useState<string|null>(null);
  if(!c) return <Page><PageContent><p className="text-sm text-muted-foreground">No case. <button className="underline" onClick={()=>navigate("aml-alerts")}>Back</button></p></PageContent></Page>;
  // R3-F02 — payouts this case's freeze currently blocks (hook output).
  const held = payoutsHeldByCase(c.id);
  function act(dec:string){ setPending(dec); }
  function confirm(){ if(!pending) return; dispositionAml(c!.id, pending as any, rationale || `Operator ${pending}`); toast({title:"Disposition recorded",description:`${pending} (audit logged). Payouts hook reflects hold state.`}); setPending(null); setRationale(""); tick(n=>n+1); }
  return (
    <Page>
      <PageHeader title={`AML Case ${c.id}`} description={`${c.traderName} · ${c.typology} · ${c.currency} ${c.amount.toLocaleString()}`} icon={ShieldAlert}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>navigate("aml-alerts")}>Back to queue</Button><Button variant="outline" size="sm" onClick={()=>{updateAmlCase(c.id,{status:"escalated"},{action:"aml.escalate",summary:`Escalated ${c.id}`}); toast({title:"Escalated"}); tick(n=>n+1);}}>Escalate</Button><Button variant="outline" size="sm" onClick={()=>{updateAmlCase(c.id,{status:"sar_filed"},{action:"aml.sar_stub",summary:`SAR/STR stub recorded for ${c.id} (regulatory filing handled outside UI)`}); toast({title:"SAR/STR stub recorded",description:"Regulatory submission is out of band; stub audit-logged."}); tick(n=>n+1);}}><FileWarning className="mr-1 h-4 w-4"/>SAR/STR stub</Button></div>} />
      <PageContent>
        <div className="flex flex-wrap gap-2 text-xs"><StatusBadge tone={c.risk==="critical"?"danger":c.risk==="high"?"warning":"info"}>{c.risk} risk</StatusBadge><StatusBadge tone={c.status==="cleared"?"success":c.status==="blocked"?"danger":"warning"}>{c.status.replace("_"," ")}</StatusBadge>{c.payoutHold&&<StatusBadge tone="danger">payout held (hook → payouts module)</StatusBadge>}{c.kyc.pep&&<StatusBadge tone="warning">PEP</StatusBadge>}</div>
        {c.payoutHold && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="font-medium">Payout freeze active (R3-F02 hook).</span>
            <span>Approve/Process blocked for {held.length > 0 ? held.map(p=>p.reference).join(", ") : "this trader's pending payouts"} — {held.length} payout{held.length === 1 ? "" : "s"} in queue.</span>
            <span className="text-muted-foreground">Release requires compliance.aml.approve.</span>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card><CardContent className="p-3 text-sm space-y-1"><p className="font-semibold text-xs uppercase text-muted-foreground">KYC & screening</p><p>KYC: {c.kyc.status} · {c.kyc.address}</p><p>Docs: {c.kyc.docs.join(", ")}</p>{c.kyc.sanctionsHit&&<p className="text-destructive">Hit: {c.kyc.sanctionsHit}</p>}{c.screening.map((s,i)=><div key={i} className="rounded border p-2 text-xs">{s.provider}: <strong>{s.result}</strong> — {s.detail}</div>)}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm space-y-1"><p className="font-semibold text-xs uppercase text-muted-foreground">Explainability (model/rule drivers)</p><p>Score: <strong>{c.explainability.score}</strong>/100</p><ul className="list-disc pl-4 text-xs space-y-0.5">{c.explainability.drivers.map(d=><li key={d}>{d}</li>)}</ul></CardContent></Card>
          <Card><CardContent className="p-3 text-sm space-y-1"><p className="font-semibold text-xs uppercase text-muted-foreground">Cash movements</p>{c.movements.map((m,i)=><div key={i} className="flex justify-between text-xs border-b py-1"><span>{m.type} · {m.method} <span className="text-muted-foreground">{m.note}</span></span><span className="font-mono">{m.amount.toLocaleString()}</span></div>)}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm space-y-2"><p className="font-semibold text-xs uppercase text-muted-foreground">Disposition (compliance.aml.approve)</p>
            <Textarea value={rationale} onChange={e=>setRationale(e.target.value)} rows={2} placeholder="Rationale (required for audit)" className="text-xs" />
            <div className="flex flex-wrap gap-2">{[["release","Release payout"],["hold","Hold"],["block","Block"],["escalate","Escalate"],["sar_str","SAR/STR path"]].map(([d,l])=><Button key={d} size="sm" variant={d==="release"?"default":"outline"} className="h-7 text-xs" title={d==="release"?releaseTitle:undefined} onClick={()=>act(d)} disabled={(!rationale.trim() && d!=="escalate") || (d==="release" && !canRelease)}>{l}</Button>)}</div>
            {c.disposition&&<p className="text-xs text-muted-foreground">Last: {c.disposition.decision} by {c.disposition.by} — {c.disposition.rationale}</p>}
          </CardContent></Card>
        </div>
        <Card><CardContent className="p-3 text-sm"><p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Timeline (audit)</p><div className="space-y-1 text-xs">{c.timeline.map((t,i)=><div key={i} className="flex gap-2"><span className="text-muted-foreground w-40 shrink-0">{new Date(t.at).toLocaleString()}</span><span><strong>{t.actor}</strong>: {t.action}</span></div>)}</div></CardContent></Card>
      </PageContent>
      <AlertDialog open={!!pending} onOpenChange={o=>!o&&setPending(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm {pending}</AlertDialogTitle><AlertDialogDescription>This disposition is audit-logged and updates payout hold state via the AML hook. Ensure rationale is accurate.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirm}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Page>
  );
}
