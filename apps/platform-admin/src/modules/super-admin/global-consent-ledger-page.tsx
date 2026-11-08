"use client";
/**
 * R2-10 — Global Consent & Suppression Ledger (round-3 depth uplift).
 *
 * Evidence drill-down: every ledger row opens its contributing-tenant
 * receipts/events (consent wording, policy version, source, provider ref,
 * capture context) instead of one-line strings — AC-2 traces. The stub
 * "exported (dummy)" toast is replaced by a real ESP-importable
 * suppression CSV built in the store and downloaded here.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/platform/console-store";
import { Shield, Download, FileText } from "lucide-react";
import { downloadText } from "./bundle-utils";
import {
  listLedger, exportSuppression, useLedgerVersion,
  type LedgerRow, type TenantReceipt,
} from "./global-consent-ledger-store";

const KIND_LABEL: Record<TenantReceipt["kind"], string> = {
  "consent-receipt": "consent receipt",
  "optout-receipt": "opt-out receipt",
  "complaint-event": "complaint event",
  "bounce-event": "bounce event",
  "spamtrap-event": "trap/rule hit",
};

export function GlobalConsentLedgerPage(){
  const { user } = usePlatform();
  useLedgerVersion();
  const rows = listLedger();
  const [enforce,setEnforce]=useState(true);
  const [detail,setDetail]=useState<LedgerRow|null>(null);
  const [openRcpt,setOpenRcpt]=useState<TenantReceipt|null>(null);
  const [q,setQ]=useState("");
  const filtered = useMemo(()=>rows.filter(r=>r.identity.includes(q)),[rows,q]);

  function tryAddBlocked(identity:string){
    if(enforce){ recordAudit({action:"suppression.block_readd",target:identity,actor:user?.name??"operator",detail:"Global enforcement ON: blocked re-add across tenants",severity:"warning"}); toast({title:"Re-add blocked",description:"Address suppressed on another tenant; attempt logged (AC-1).",variant:"destructive" as any}); }
  }

  const cols: Column<LedgerRow>[] = [
    {key:"id",header:"Identity (hashed)",cell:r=><button type="button" className="text-left font-mono text-xs text-primary hover:underline" onClick={()=>{setOpenRcpt(null);setDetail(r);}}>{r.identity}</button>},
    {key:"st",header:"Global state",cell:r=><StatusBadge tone={r.state==="clear"?"success":"danger"}>{r.state.replace("_"," ")}</StatusBadge>},
    {key:"ten",header:"Tenants",cell:r=><span className="text-xs">{r.tenants.join(", ")}</span>},
    {key:"ev",header:"Evidence",numeric:true,cell:r=>r.receipts.length},
    {key:"at",header:"Latest",cell:r=><span className="text-xs">{r.latest}</span>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>tryAddBlocked(r.identity)}>Test re-add</Button>},
  ];

  return (
    <Page>
      <PageHeader title="Global Consent & Suppression Ledger" description="Cross-tenant suppression for abuse prevention and regulator queries. Every row drills down to contributing-tenant receipts and delivery events." icon={Shield}
        actions={<Button size="sm" variant="outline" disabled={filtered.length===0} onClick={()=>{
          const res = exportSuppression(filtered, user?.name ?? "operator");
          if(!res.ok){ toast({title:"Nothing to export",variant:"destructive"}); return; }
          downloadText(res.content,res.filename,res.mime);
          toast({title:`Exported ${res.count} identity(ies)`,description:`${res.filename} — ESP-importable CSV with evidence refs (audit-logged).`});
        }}><Download className="mr-1 h-4 w-4"/>Export (ESP sync)</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="Suppressed/bounced" value={String(rows.filter(r=>r.state!=="clear").length)} tone="warning"/><MetricCard label="Contributing tenants" value={String(new Set(rows.flatMap(r=>r.tenants)).size)}/><MetricCard label="Global enforcement" value={enforce?"ON":"OFF"} tone={enforce?"positive":"warning"}/><MetricCard label="Evidence links" value={String(rows.reduce((s,r)=>s+r.receipts.length,0))}/></div>
        <Card><CardContent className="p-3 flex items-center justify-between text-sm"><div><p className="font-semibold">Global vs per-tenant suppression</p><p className="text-xs text-muted-foreground">When ON, an address suppressed on tenant A cannot be re-added as sendable on tenant B (logged).</p></div><Switch checked={enforce} onCheckedChange={v=>{setEnforce(!!v); recordAudit({action:`suppression.enforcement.${v?"on":"off"}`,target:"global",actor:user?.name??"operator",detail:`Global enforcement ${v?"enabled":"disabled"}`,severity:"warning"});}}/></CardContent></Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search hashed identity…" className="mb-2 max-w-sm"/><DataTable columns={cols} data={filtered} rowKey={r=>r.id} pageSize={8}/></div>
          <Card><CardContent className="p-3 text-xs space-y-2"><p className="font-semibold">Enforcement rules / hit stats</p>{RULES.map(r=><div key={r.name} className="flex justify-between rounded border p-2"><span>{r.name}</span><span className="font-mono">{r.hits} hits</span></div>)}</CardContent></Card>
        </div>
      </PageContent>

      {/* Row → contributing receipts → receipt detail (two-level drill-down) */}
      <Sheet open={!!detail} onOpenChange={o=>{if(!o){setDetail(null);setOpenRcpt(null);}}}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="font-mono text-base">{detail?.identity}</SheetTitle>
            <SheetDescription>Every row traces to contributing-tenant receipts / delivery events (AC-2).</SheetDescription>
          </SheetHeader>
          {detail&&<div className="mt-3 space-y-3 px-4 pb-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={detail.state==="clear"?"success":"danger"}>{detail.state.replace("_"," ")}</StatusBadge>
              <span className="text-muted-foreground">{detail.tenants.join(" · ")}</span>
              <span className="text-muted-foreground">first {detail.first} → latest {detail.latest}</span>
            </div>

            {!openRcpt ? (
              <>
                <p className="font-semibold">Contributing evidence ({detail.receipts.length}) — select to inspect</p>
                <div className="space-y-1.5">
                  {detail.receipts.map(e=>(
                    <button key={e.id} type="button" className="flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left hover:bg-muted"
                      onClick={()=>setOpenRcpt(e)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.summary}</span>
                        <span className="block text-[10px] text-muted-foreground">{e.tenant} · {KIND_LABEL[e.kind]} · {e.id}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(e.at).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Exports include these refs so a provider import and a regulator review read the same artifact.</p>
              </>
            ) : (
              <ReceiptDetail receipt={openRcpt} onBack={()=>setOpenRcpt(null)}/>
            )}
          </div>}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Receipt drill-down                                                  */
/* ------------------------------------------------------------------ */

function ReceiptDetail({ receipt, onBack }: { receipt: TenantReceipt; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBack}>← All evidence</Button>
        <Badge variant="outline" className="text-[10px]">{KIND_LABEL[receipt.kind]}</Badge>
      </div>
      <Card><CardContent className="space-y-1.5 p-3 text-xs">
        <p className="font-semibold">{receipt.summary}</p>
        <p className="text-muted-foreground">Tenant <strong>{receipt.tenant}</strong> · receipt <code>{receipt.id}</code></p>
        <p className="text-muted-foreground">Captured {new Date(receipt.at).toLocaleString()}</p>
      </CardContent></Card>

      <Card><CardContent className="space-y-1.5 p-3 text-xs">
        <p className="mb-1 flex items-center gap-1 font-semibold uppercase text-muted-foreground"><FileText className="h-3 w-3"/> Evidence fields</p>
        {receipt.wording && <p><span className="text-muted-foreground">Wording shown to user:</span> “{receipt.wording}”</p>}
        {receipt.source && <p><span className="text-muted-foreground">Source:</span> {receipt.source}</p>}
        {receipt.channel && <p><span className="text-muted-foreground">Channel:</span> {receipt.channel}</p>}
        {receipt.policyVersion && <p><span className="text-muted-foreground">Policy version:</span> {receipt.policyVersion}</p>}
        {receipt.providerRef && <p><span className="text-muted-foreground">Provider ref:</span> <code>{receipt.providerRef}</code></p>}
        {receipt.ip && <p><span className="text-muted-foreground">Capture IP:</span> {receipt.ip}</p>}
      </CardContent></Card>

      <p className="text-[10px] text-muted-foreground">
        Reference format: <code>tenant:receipt-id</code> — the same key the suppression CSV carries, so a
        provider import can be reconciled back to this drill-down.
      </p>
    </div>
  );
}

const RULES = [{name:"Disposable domains",hits:142,enabled:true},{name:"Role addresses",hits:38,enabled:true},{name:"Seed-list hits",hits:6,enabled:true}];
