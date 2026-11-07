"use client";

/**
 * M5.2 — Ad Spend Dashboard, normalized (spec §9.2; upgraded in place).
 * Provider-ingested spend with reconciliation: auto-ingested rows are
 * labeled, manual rows remain possible, and overlaps are surfaced
 * (never silently double-counted). Keeps MarketingAdSpendPage export.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { Megaphone, Download, Plug, ExternalLink, AlertTriangle, DollarSign } from "lucide-react";
import { exportToCsv } from "@/lib/platform/export-utils";
import { listBudgets, pendingRequestFor, useBudgetVersion } from "../ad-budget-store";

type Source = "auto"|"manual";
interface SpendRow {
  id:string; campaign:string; provider:string; account:string; range:string;
  impressions:number; clicks:number; spend:number; ctr:number; cpl:number; source:Source; status:"synced"|"pending"|"overlap";
}

const BASE: SpendRow[] = [
  {id:"s1",campaign:"Scale-Up Oct",provider:"Meta Ads",account:"act_9182",range:"Oct 1–31",impressions:142000,clicks:4820,spend:6240,ctr:3.39,cpl:18.4,source:"auto",status:"synced"},
  {id:"s2",campaign:"Search — Funding",provider:"Google Ads",account:"882-110-4421",range:"Oct 1–31",impressions:98000,clicks:6110,spend:8120,ctr:6.23,cpl:22.1,source:"auto",status:"synced"},
  {id:"s3",campaign:"TikTok Challenge Push",provider:"TikTok Ads",account:"adv_7710",range:"Oct 5–31",impressions:210000,clicks:9340,spend:4410,ctr:4.45,cpl:14.8,source:"auto",status:"pending"},
  {id:"s4",campaign:"Influencer retainer (manual)",provider:"Manual",account:"—",range:"Oct 1–31",impressions:0,clicks:0,spend:2000,ctr:0,cpl:0,source:"manual",status:"synced"},
  {id:"s5",campaign:"Scale-Up Oct (overlap entry)",provider:"Manual",account:"—",range:"Oct 10–20",impressions:0,clicks:0,spend:900,ctr:0,cpl:0,source:"manual",status:"overlap"},
];

export function MarketingAdSpendPage() {
  const { navigate } = usePlatform();
  const [sourceFilter, setSourceFilter] = useState<"all"|"auto"|"manual">("all");
  const [rows, setRows] = useState(BASE);
  const [drill, setDrill] = useState<SpendRow | null>(null);
  const [resolve, setResolve] = useState<SpendRow | null>(null);

  // R3-05 (AC-2): approved caps only; pending raises are flagged, never applied.
  useBudgetVersion();
  const budgets = listBudgets();

  const filtered = useMemo(() => rows.filter((r) => sourceFilter==="all" || r.source===sourceFilter), [rows, sourceFilter]);
  const totals = useMemo(() => {
    // overlap manual rows excluded from totals until resolved (never double-counted)
    const counted = rows.filter(r => !(r.source==="manual" && r.status==="overlap"));
    const spend = counted.reduce((s,r)=>s+r.spend,0);
    const auto = rows.filter(r=>r.source==="auto").reduce((s,r)=>s+r.spend,0);
    return { spend, autoShare: spend?Math.round((auto/spend)*100):0, syncing: new Set(rows.filter(r=>r.source==="auto").map(r=>r.account)).size };
  }, [rows]);
  const overlaps = rows.filter(r=>r.status==="overlap");

  const cols: Column<SpendRow>[] = [
    { key:"campaign", header:"Campaign", sortValue:r=>r.campaign, cell:r=> <button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDrill(r)}>{r.campaign}</button> },
    { key:"provider", header:"Provider", cell:r=> <span className="text-xs">{r.provider}<span className="block text-[10px] text-muted-foreground">{r.account}</span></span> },
    { key:"source", header:"Source", cell:r=> <Badge variant={r.source==="auto"?"secondary":"outline"} className="text-[10px]">{r.source==="auto"?"Auto":"Manual"}</Badge> },
    { key:"status", header:"Status", cell:r=> <StatusBadge tone={r.status==="synced"?"success":r.status==="pending"?"warning":"danger"}>{r.status==="overlap"?"Overlap flagged":r.status}</StatusBadge> },
    { key:"spend", header:"Spend", numeric:true, sortValue:r=>r.spend, cell:r=> <span className="tabular-nums">${r.spend.toLocaleString()}</span> },
    { key:"clicks", header:"Clicks", numeric:true, sortValue:r=>r.clicks, cell:r=> <span className="tabular-nums">{r.clicks.toLocaleString()}</span> },
    { key:"cpl", header:"CPL", numeric:true, sortValue:r=>r.cpl, cell:r=> <span className="tabular-nums">${r.cpl.toFixed(2)}</span> },
  ];

  function resolveOverlap(row:SpendRow, rule:"keep-manual"|"prefer-auto"|"split"){
    setRows(rs=>rs.map(r=>r.id===row.id?{...r,status:"synced",spend:rule==="prefer-auto"?0:rule==="split"?Math.round(r.spend/2):r.spend}:r));
    setResolve(null);
    toast({title:"Overlap resolved",description:`${row.campaign}: ${rule.replace("-"," ")} — totals recomputed.`});
  }

  const trend = useMemo(()=>Array.from({length:30},(_,i)=>({name:`D${i+1}`,spend:Math.round(400+Math.sin(i*0.35)*180+i*6)})),[]);
  const byProv = useMemo(()=>Object.entries(filtered.reduce((a,r)=>{a[r.provider]=(a[r.provider]||0)+r.spend;return a;},{} as Record<string,number>)).map(([name,spend])=>({name,spend})),[filtered]);

  return (
    <Page>
      <PageHeader title="Ad Spend" description="Provider-ingested spend with reconciliation — overlaps are surfaced, never double-counted." icon={Megaphone}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>navigate("marketing-ad-accounts")}><Plug className="mr-1 h-4 w-4" />Ad Accounts</Button><Button variant="outline" size="sm" onClick={()=>{ exportToCsv(filtered.map(r=>({campaign:r.campaign,provider:r.provider,source:r.source,status:r.status,spend:r.spend})), [{key:"campaign",header:"Campaign",value:r=>r.campaign},{key:"provider",header:"Provider",value:r=>r.provider},{key:"source",header:"Source",value:r=>r.source},{key:"status",header:"Status",value:r=>r.status},{key:"spend",header:"Spend",value:r=>r.spend}], "ad-spend.csv"); }}><Download className="mr-1 h-4 w-4" />Export</Button></div>} />
      <PageContent>
        {overlaps.length>0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /><div><p className="font-medium">Manual entries overlap auto-ingested ranges</p><p className="text-xs text-muted-foreground">{overlaps.length} conflict(s) — not double-counted until resolved.</p></div></div>
            <Button size="sm" variant="outline" onClick={()=>setResolve(overlaps[0])}>Resolve</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Source:</span>
          {(["all","auto","manual"] as const).map(s=>(
            <button key={s} type="button" onClick={()=>setSourceFilter(s)} className={`rounded-full border px-2.5 py-1 text-xs ${sourceFilter===s?"border-primary bg-primary/10 text-primary":"text-muted-foreground"}`}>{s==="all"?"All":s==="auto"?"Auto-ingested":"Manual"}</button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total spend (deduped)" value={`$${totals.spend.toLocaleString()}`} />
          <MetricCard label="Auto-ingested share" value={`${totals.autoShare}%`} tone="info" />
          <MetricCard label="Accounts syncing" value={String(totals.syncing)} />
          <MetricCard label="Ingest lag" value="14 min" tone="positive" deltaLabel="provider data freshness" />
        </div>

        {/* R3-05 (AC-2) — only approved budgets; pending raises flagged, never applied */}
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold"><DollarSign className="h-4 w-4" />Approved budgets</p>
              <p className="text-[11px] text-muted-foreground">Only approved caps appear here (AC-2). Raises sit in the four-eyes queue and are flagged until approved — pending changes are never applied.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("ad-budget-approvals")}>Approval queue</Button>
          </div>
          <div className="space-y-1.5">
            {budgets.map(b => {
              const pend = pendingRequestFor(b.id);
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{b.campaign}</p>
                    <p className="text-[10px] text-muted-foreground">{b.provider} · <span className="font-mono">{b.adAccountId}</span> · approved by {b.approvedBy} · v{b.version}</p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <p>${b.dailyCap}/day · ${b.monthlyCap.toLocaleString()}/mo</p>
                    <p className="text-[10px] text-muted-foreground">approved {new Date(b.approvedAt).toLocaleDateString()}</p>
                  </div>
                  {pend ? (
                    <button type="button" onClick={() => navigate("ad-budget-approvals")}
                      className="rounded-full border border-amber-500/60 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                      title={`${pend.id} — requested by ${pend.requester}, awaiting approval`}>
                      raise pending: ${pend.currentDaily} → ${pend.requestedDaily}/day
                    </button>
                  ) : <StatusBadge tone="success">approved</StatusBadge>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Spend trend (30d)</p><AreaSeries data={trend} xKey="name" yKey="spend" height={180} color="hsl(var(--primary))" /></div>
          <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Spend by provider</p><BarSeries data={byProv} xKey="name" yKey="spend" height={180} color="hsl(var(--primary))" /></div>
        </div>

        {filtered.length===0 ? <EmptyState title="No spend data" description="Connect ad accounts to ingest spend automatically, or add a manual entry." action={<Button size="sm" onClick={()=>navigate("marketing-ad-accounts")}>Connect ad accounts</Button>} /> :
          <DataTable columns={cols} data={filtered} rowKey={r=>r.id} searchableText={r=>`${r.campaign} ${r.provider} ${r.account}`} pageSize={10} emptyTitle="No rows" onRowClick={setDrill} />}

        <p className="text-[11px] text-muted-foreground">Manual entries remain possible. Auto-ingested rows are labeled; overlaps are flagged and excluded from totals until you choose a resolution.</p>
      </PageContent>

      {/* Drilldown */}
      <Sheet open={!!drill} onOpenChange={o=>!o&&setDrill(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {drill && <><SheetHeader><SheetTitle>{drill.campaign}</SheetTitle><SheetDescription>{drill.provider} · {drill.account} · {drill.range}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">{[["Impressions",drill.impressions.toLocaleString()],["Clicks",drill.clicks.toLocaleString()],["Spend",`$${drill.spend.toLocaleString()}`],["CTR",`${drill.ctr}%`],["CPL",`$${drill.cpl}`],["Source",drill.source],["Status",drill.status]].map(([k,v])=><div key={k as string} className="rounded border p-2"><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v as string}</p></div>)}</div>
              <div className="rounded-lg border p-3"><p className="mb-2 text-xs font-semibold">30-day spend trend</p><AreaSeries data={trend} xKey="name" yKey="spend" height={140} color="hsl(var(--primary))" /></div>
              {drill.source==="auto" && <Button variant="outline" size="sm" onClick={()=>toast({title:"Opening provider campaign",description:`Deep link to ${drill.provider} (where supported).`})}><ExternalLink className="mr-1 h-3.5 w-3.5" />Open in {drill.provider}</Button>}
            </div></>}
        </SheetContent>
      </Sheet>

      {/* Reconciliation */}
      <Dialog open={!!resolve} onOpenChange={o=>!o&&setResolve(null)}>
        <DialogContent><DialogHeader><DialogTitle>Resolve overlap</DialogTitle><DialogDescription>Manual entry overlaps auto-ingested spend for the same account/range. Choose how to reconcile — totals recompute immediately.</DialogDescription></DialogHeader>
          {resolve && <p className="text-sm"><strong>{resolve.campaign}</strong> — ${resolve.spend.toLocaleString()} ({resolve.range})</p>}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={()=>resolve&&resolveOverlap(resolve,"keep-manual")}>Keep manual</Button>
            <Button variant="outline" onClick={()=>resolve&&resolveOverlap(resolve,"prefer-auto")}>Prefer auto</Button>
            <Button onClick={()=>resolve&&resolveOverlap(resolve,"split")}>Split</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
