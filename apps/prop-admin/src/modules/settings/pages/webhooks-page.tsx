"use client";

/**
 * M6.3 — Webhooks 2.0 (spec §10.3, upgraded in place).
 * Event catalog browser, endpoints with signing-secret rotation,
 * delivery logs with retry/bulk replay, and auto-pause protection.
 * Terra palette retained. Dummy data only.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Webhook, Plus, Send, RefreshCw, KeyRound, Eye, EyeOff, Pencil, Trash2, Pause, Play, Copy, AlertTriangle, BookOpen, RotateCcw } from "lucide-react";

type EpStatus = "active"|"paused"|"failing"|"autopaused";
interface Delivery { id:string; ts:string; event:string; code:number; ms:number; attempt:number; replay?:boolean }
interface Endpoint { id:string; url:string; description:string; events:string[]; status:EpStatus; success24h:number; rotatedAt:string; secret:string; graceUntil?:string; deliveries:Delivery[]; pausedSince?:string; queued?:number; lastError?:string }

const CATALOG: Array<{ domain:string; events:Array<{name:string; desc:string; schema:string; subs:number}> }> = [
  { domain:"payouts.*", events:[
    {name:"payout.requested",desc:"Trader requests a withdrawal.",schema:"{ id, trader_id, amount, currency, method }",subs:2},
    {name:"payout.approved",desc:"Finance approves the payout.",schema:"{ id, approved_by, paid_at?, amount }",subs:2},
    {name:"payout.paid",desc:"Funds sent to the trader.",schema:"{ id, provider_ref, amount, currency }",subs:1},
  ]},
  { domain:"kyc.*", events:[
    {name:"kyc.submitted",desc:"Trader submits verification documents.",schema:"{ trader_id, session_id, provider }",subs:1},
    {name:"kyc.approved",desc:"Verification passed.",schema:"{ trader_id, session_id, level }",subs:2},
    {name:"kyc.rejected",desc:"Verification failed.",schema:"{ trader_id, reason, retryable }",subs:1},
  ]},
  { domain:"challenges.*", events:[
    {name:"challenge.passed",desc:"Trader passes evaluation/verification.",schema:"{ account_id, phase, trader_id }",subs:2},
    {name:"challenge.breached",desc:"Risk rule breach closes the challenge.",schema:"{ account_id, rule, equity, trader_id }",subs:1},
    {name:"challenge.funded",desc:"Account promoted to funded.",schema:"{ account_id, plan, trader_id }",subs:1},
  ]},
  { domain:"marketing.*", events:[
    {name:"campaign.sent",desc:"Campaign dispatched to recipients.",schema:"{ campaign_id, channel, recipients, segment_id }",subs:1},
    {name:"segment.updated",desc:"Segment membership recomputed.",schema:"{ segment_id, size, consent_coverage }",subs:0},
    {name:"flow.enrolled",desc:"Contact enrolled in an automation flow.",schema:"{ flow_id, contact_id, trigger }",subs:1},
  ]},
  { domain:"trading.*", events:[
    {name:"trade.opened",desc:"New position opened.",schema:"{ trade_id, account_id, symbol, side, lots }",subs:1},
    {name:"trade.closed",desc:"Position closed with P/L.",schema:"{ trade_id, pnl, close_price, duration_s }",subs:1},
    {name:"trade.copied",desc:"Copy-trade execution replicated.",schema:"{ trade_id, master_id, follower_id, symbol }",subs:0},
  ]},
];
const ALL_EVENTS = CATALOG.flatMap((d) => d.events.map((e) => e.name));

const ago = (m:number)=>new Date(Date.now()-m*60000).toISOString();
const mkDels = (evs:string[],ok:boolean):Delivery[] => evs.slice(0,4).flatMap((ev,i)=>[
  {id:`d${Math.random()}`,ts:ago(12+i*25),event:ev,code:ok?200:500,ms:ok?120+i*30:8200,attempt:ok?1:3},
  ...(ok?[]:[{id:`d${Math.random()}`,ts:ago(8+i*25),event:ev,code:502,ms:4100,attempt:4}]),
]);

let EPS: Endpoint[] = [
  {id:"ep-1",url:"https://hooks.acme.io/payouts",description:"Finance ERP",events:["payout.requested","payout.approved","payout.paid"],status:"active",success24h:99.2,rotatedAt:ago(60*24*9),secret:"whsec_live_4f2a…9bd1",deliveries:mkDels(["payout.requested","payout.paid"],true)},
  {id:"ep-2",url:"https://api.crm.internal/webhooks",description:"Internal CRM",events:["kyc.approved","challenge.passed","campaign.sent","trade.opened"],status:"active",success24h:97.6,rotatedAt:ago(60*24*30),secret:"whsec_live_81cc…2e40",deliveries:mkDels(["kyc.approved","challenge.passed"],true)},
  {id:"ep-3",url:"https://failing.example.com/hook",description:"Legacy sink (failing)",events:["marketing.*","flow.enrolled"],status:"autopaused",success24h:12,rotatedAt:ago(60*24*60),secret:"whsec_live_dead…beef",deliveries:mkDels(["campaign.sent","flow.enrolled"],false),pausedSince:ago(55),queued:148,lastError:"5xx beyond retry threshold (last 502)"},
];

const randSecret=()=>`whsec_live_${Math.random().toString(36).slice(2,10)}${Math.random().toString(36).slice(2,10)}`;
const hostPath=(u:string)=>{ try{ const x=new URL(u); return x.host + x.pathname; }catch{return u;} };

export function WebhooksPage() {
  const [eps, setEps] = useState<Endpoint[]>(EPS);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editEp, setEditEp] = useState<Endpoint | null>(null);
  const [logEp, setLogEp] = useState<Endpoint | null>(null);
  const [delEp, setDelEp] = useState<Endpoint | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ep:Endpoint; val:string}|null>(null);
  const [form, setForm] = useState({ url:"", description:"", events:[] as string[] });

  const commit = (next:Endpoint[]) => { EPS = next; setEps(next); };
  const patch = (id:string, p:Partial<Endpoint>) => commit(eps.map(e=>e.id===id?{...e,...p}:e));

  const autoPaused = eps.find(e=>e.status==="autopaused");
  const deliveries24h = eps.reduce((s,e)=>s+e.deliveries.length*6,0);
  const successRate = eps.length ? (eps.reduce((s,e)=>s+e.success24h,0)/eps.length) : 100;
  const failing = eps.filter(e=>e.status==="failing"||e.status==="autopaused").length;

  const epCols: Column<Endpoint>[] = [
    { key:"url", header:"Endpoint", sortValue:e=>e.url, cell:e=> <span className="font-mono text-xs" title={e.lastError}>{hostPath(e.url)}</span> },
    { key:"status", header:"Status", cell:e=> <StatusBadge tone={e.status==="active"?"success":e.status==="failing"||e.status==="autopaused"?"danger":"muted"}>{e.status==="autopaused"?"Paused (auto)":e.status==="failing"?"Failing":e.status}</StatusBadge> },
    { key:"evs", header:"Events subscribed", cell:e=> (
      <Popover><PopoverTrigger asChild><button type="button" className="text-xs underline decoration-dotted">{e.events.length} events</button></PopoverTrigger>
        <PopoverContent className="w-64 space-y-0.5 p-2">{e.events.map(x=><div key={x} className="font-mono text-[10px]">{x}</div>)}</PopoverContent></Popover>
    )},
    { key:"rate", header:"Success 24h", sortValue:e=>e.success24h, cell:e=> <div className="w-24"><div className="flex justify-between text-[10px]"><span className={e.success24h<90?"text-destructive":""}>{e.success24h}%</span></div><Progress value={e.success24h} className="h-1.5" /></div> },
    { key:"rot", header:"Secret rotated", sortValue:e=>e.rotatedAt, cell:e=> <span className="text-xs">{relativeTime(e.rotatedAt)}</span> },
    { key:"act", header:"", cell:e=> (
      <div className="flex flex-wrap justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>{ setEditEp(e); setForm({url:e.url,description:e.description,events:e.events}); }}><Pencil className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>setNewSecret({ep:e,val:randSecret()})}><KeyRound className="mr-1 h-3 w-3" />Rotate</Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>{ const paused=e.status==="paused"||e.status==="autopaused"; patch(e.id,{status:paused?"active":"paused",pausedSince:paused?undefined:new Date().toISOString(),queued:paused?undefined:e.queued}); toast({title:paused?"Endpoint resumed":"Endpoint paused",description:e.url}); }}>{(e.status==="paused"||e.status==="autopaused")?<><Play className="h-3 w-3" /></>:<><Pause className="h-3 w-3" /></>}</Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>setLogEp(e)}>Logs</Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-destructive" onClick={()=>setDelEp(e)}><Trash2 className="h-3 w-3" /></Button>
      </div>
    )},
  ];

  function saveForm(mode:"add"|"edit"){
    if(!/^https?:\/\//.test(form.url)){ toast({title:"Invalid URL",description:"Endpoint URL must start with http(s)://"}); return; }
    if(form.events.length===0){ toast({title:"Select events",description:"Subscribe to at least one event."}); return; }
    if(mode==="add"){
      commit([{id:`ep-${Date.now()}`,url:form.url,description:form.description,events:form.events,status:"active",success24h:100,rotatedAt:new Date().toISOString(),secret:randSecret(),deliveries:[]},...eps]);
      setAddOpen(false);
      toast({title:"Endpoint added",description:form.url});
    } else if(editEp){
      patch(editEp.id,{url:form.url,description:form.description,events:form.events});
      setEditEp(null);
      toast({title:"Endpoint updated"});
    }
    recordAudit({action:"webhook.save",entity:"webhook-endpoint",entityId:form.url,summary:`${mode==="add"?"Added":"Updated"} endpoint ${form.url}`,module:"settings"});
  }

  return (
    <Page>
      <PageHeader title="Webhooks & Events" description="Event subscriptions with signing, delivery logs, replay and auto-pause protection." icon={Webhook}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setCatalogOpen(true)}><BookOpen className="mr-1 h-4 w-4" />Event Catalog</Button><Button size="sm" onClick={()=>{ setForm({url:"",description:"",events:[]}); setAddOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add Endpoint</Button></div>} />
      <PageContent>
        {autoPaused && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><div><p className="font-medium text-destructive">Endpoint auto-paused: {hostPath(autoPaused.url)}</p><p className="text-xs text-muted-foreground">Paused {autoPaused.pausedSince?relativeTime(autoPaused.pausedSince):"recently"} · {autoPaused.queued??0} queued events · {autoPaused.lastError}</p></div></div>
            <Button size="sm" variant="outline" onClick={()=>{ patch(autoPaused.id,{status:"active",pausedSince:undefined,queued:0,deliveries:[...autoPaused.deliveries,{id:`d${Date.now()}`,ts:new Date().toISOString(),event:autoPaused.events[0]??"replay",code:200,ms:140,attempt:1,replay:true}]}); toast({title:"Endpoint resumed with replay",description:`${autoPaused.queued??0} queued events requeued.`}); }}>Resume with replay</Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Endpoints" value={String(eps.length)} />
          <MetricCard label="Deliveries (24h)" value={deliveries24h.toLocaleString()} />
          <MetricCard label="Success rate" value={`${successRate.toFixed(1)}%`} tone={successRate<95?"warning":"positive"} />
          <MetricCard label="Failing" value={String(failing)} tone={failing>0?"negative":"positive"} />
        </div>

        {eps.length===0 ? <EmptyState title="No endpoints" description="Add a webhook endpoint to receive platform events." icon={Webhook} hint="See the Event Catalog for available events."
          action={<Button size="sm" onClick={()=>setAddOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Endpoint</Button>} /> :
          <DataTable columns={epCols} data={eps} rowKey={e=>e.id} searchableText={e=>`${e.url} ${e.description} ${e.events.join(" ")}`} pageSize={8} emptyTitle="No endpoints" />}
      </PageContent>

      {/* Event catalog */}
      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Event catalog</SheetTitle><SheetDescription>Grouped by domain — payload summaries and current subscribers.</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-4">
            {CATALOG.map(d=>(
              <div key={d.domain} className="rounded-lg border p-3">
                <p className="mb-2 font-mono text-xs font-semibold">{d.domain}</p>
                <div className="space-y-2">{d.events.map(ev=>(
                  <div key={ev.name} className="rounded border p-2 text-xs"><div className="flex items-center justify-between"><span className="font-mono font-medium">{ev.name}</span><Badge variant="outline" className="text-[9px]">{ev.subs} subs</Badge></div><p className="text-muted-foreground">{ev.desc}</p><code className="mt-1 block text-[10px] text-muted-foreground">{ev.schema}</code></div>
                ))}</div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit dialog */}
      <Dialog open={addOpen||!!editEp} onOpenChange={(o)=>{ if(!o){ setAddOpen(false); setEditEp(null);} }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editEp?"Edit endpoint":"Add endpoint"}</DialogTitle><DialogDescription>Subscribe to events and receive signed deliveries.</DialogDescription></DialogHeader>
          <div className="space-y-3"><div><Label className="text-xs">URL</Label><Input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://hooks.example.com/ingest" className="mt-1 font-mono text-xs" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Subscribe to events</Label><div className="mt-1 max-h-40 space-y-1 overflow-auto rounded border p-2">{CATALOG.map(d=>{ const names=d.events.map(e=>e.name); const allOn=names.every(n=>form.events.includes(n)); return (
              <div key={d.domain}><label className="flex items-center gap-2 text-xs font-semibold"><Checkbox checked={allOn} onCheckedChange={(v)=>setForm({...form,events:v?Array.from(new Set([...form.events,...names])):form.events.filter(x=>!names.includes(x))})} />{d.domain}</label>
                <div className="ml-5">{names.map(n=><label key={n} className="flex items-center gap-2 font-mono text-[10px]"><Checkbox checked={form.events.includes(n)} onCheckedChange={(v)=>setForm({...form,events:v?[...form.events,n]:form.events.filter(x=>x!==n)})} />{n}</label>)}</div>
              </div>
            );})}</div></div></div>
          <DialogFooter><Button variant="outline" onClick={()=>{ setAddOpen(false); setEditEp(null); }}>Cancel</Button><Button onClick={()=>saveForm(editEp?"edit":"add")}>{editEp?"Save":"Add endpoint"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endpoint drawer (logs + secret + replay) */}
      <Sheet open={!!logEp} onOpenChange={(o)=>!o&&setLogEp(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {logEp && (()=>{
            const ep = eps.find(e=>e.id===logEp.id) ?? logEp;
            const revealed = revealId===ep.id;
            return (<>
              <SheetHeader><SheetTitle>{hostPath(ep.url)}</SheetTitle><SheetDescription>{ep.description} · {ep.events.length} events subscribed</SheetDescription></SheetHeader>
              <div className="mt-4 space-y-4">
                {ep.graceUntil && <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/30">Secret rotated — old secret remains valid until <strong>{absoluteTime(ep.graceUntil)}</strong> (24h grace). New deliveries use the new secret now.</div>}

                <div className="rounded-lg border p-3">
                  <p className="mb-1 text-xs font-semibold">Signing secret</p>
                  <div className="flex items-center gap-2"><code className="flex-1 rounded bg-muted px-2 py-1 text-[10px]">{revealed?ep.secret:"whsec_live_••••••••••••"}</code>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={()=>setRevealId(revealed?null:ep.id)} aria-label="Reveal">{revealed?<EyeOff className="h-3.5 w-3.5" />:<Eye className="h-3.5 w-3.5" />}</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={()=>{ navigator.clipboard?.writeText(ep.secret); toast({title:"Secret copied"}); }}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setNewSecret({ep,val:randSecret()})}><RotateCcw className="mr-1 h-3 w-3" />Rotate</Button></div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">Delivery log</p>
                    <div className="flex items-center gap-1"><Select defaultValue="1h" onValueChange={()=>{}}>
                      <SelectTrigger className="h-7 w-[110px] text-[10px]"><SelectValue placeholder="Replay range" /></SelectTrigger>
                      <SelectContent><SelectItem value="15m">Last 15 min</SelectItem><SelectItem value="1h">Last 1 hour</SelectItem><SelectItem value="6h">Last 6 hours</SelectItem><SelectItem value="24h">Last 24 hours</SelectItem></SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={()=>{ const n=Math.max(1,ep.deliveries.length); const replay:Delivery={id:`d${Date.now()}`,ts:new Date().toISOString(),event:ep.events[0]??"replay",code:200,ms:130,attempt:1,replay:true}; patch(ep.id,{deliveries:[replay,...ep.deliveries]}); toast({title:"Replay queued",description:`${n} events requeued for the selected window (respecting current subscriptions).`}); }}>Replay range</Button></div>
                  </div>
                  <DataTable columns={[
                    {key:"ts",header:"Timestamp",sortValue:(d:Delivery)=>d.ts,cell:(d:Delivery)=><span className="text-[10px]">{relativeTime(d.ts)}</span>},
                    {key:"ev",header:"Event",cell:(d:Delivery)=><span className="font-mono text-[10px]">{d.event}{d.replay?" (replay)":""}</span>},
                    {key:"code",header:"Code",numeric:true,cell:(d:Delivery)=><StatusBadge tone={d.code<400?"success":"danger"}>{String(d.code)}</StatusBadge>},
                    {key:"ms",header:"Duration",numeric:true,cell:(d:Delivery)=><span className="text-[10px] tabular-nums">{d.ms}ms</span>},
                    {key:"att",header:"Attempt",numeric:true,cell:(d:Delivery)=><span className="text-[10px] tabular-nums">{d.attempt}</span>},
                    {key:"a",header:"",cell:(d:Delivery)=> d.code>=400?<Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>{ patch(ep.id,{deliveries:ep.deliveries.map(x=>x.id===d.id?{...x,code:200,attempt:x.attempt+1}:x)}); toast({title:"Delivery retried",description:d.event}); }}>Retry</Button>:null},
                  ]} data={ep.deliveries} rowKey={(d:Delivery)=>d.id} pageSize={6} emptyTitle="No deliveries yet" />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={()=>{ patch(ep.id,{status:ep.status==="paused"||ep.status==="autopaused"?"active":"paused"}); toast({title:ep.status==="active"?"Endpoint paused":"Endpoint resumed"}); }}>{ep.status==="active"?<><Pause className="mr-1 h-3.5 w-3.5" />Pause endpoint</>:<><Play className="mr-1 h-3.5 w-3.5" />Resume endpoint</>}</Button>
                  <Button variant="ghost" size="sm" onClick={()=>toast({title:"Test event sent",description:`Ping delivered to ${hostPath(ep.url)} (200, 94ms).`})}><Send className="mr-1 h-3.5 w-3.5" />Test send</Button>
                </div>
              </div>
            </>);
          })()}
        </SheetContent>
      </Sheet>

      {/* Rotate secret: show once */}
      <Dialog open={!!newSecret} onOpenChange={(o)=>!o&&setNewSecret(null)}>
        <DialogContent><DialogHeader><DialogTitle>New signing secret</DialogTitle><DialogDescription>Copy it now — it will not be shown again. The old secret remains valid for 24 hours.</DialogDescription></DialogHeader>
          {newSecret && <div className="space-y-2"><code className="block rounded bg-muted p-2 text-xs break-all">{newSecret.val}</code><Button variant="outline" size="sm" onClick={()=>{ navigator.clipboard?.writeText(newSecret.val); toast({title:"Copied"}); }}><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button></div>}
          <DialogFooter><Button onClick={()=>{ if(newSecret){ const grace=new Date(Date.now()+24*3600000).toISOString(); patch(newSecret.ep.id,{secret:newSecret.val,rotatedAt:new Date().toISOString(),graceUntil:grace}); recordAudit({action:"webhook.secret.rotate",entity:"webhook-endpoint",entityId:newSecret.ep.id,summary:`Rotated secret for ${hostPath(newSecret.ep.url)} (24h grace).`,severity:"warning",module:"settings"}); toast({title:"Secret rotated",description:"Old secret valid for 24 hours."}); setLogEp(eps.find(e=>e.id===newSecret.ep.id)??null);} setNewSecret(null); }}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!delEp} onOpenChange={(o)=>!o&&setDelEp(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete endpoint?</AlertDialogTitle><AlertDialogDescription>{delEp?.url} will stop receiving events. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>{ if(delEp){ commit(eps.filter(e=>e.id!==delEp.id)); recordAudit({action:"webhook.delete",entity:"webhook-endpoint",entityId:delEp.id,summary:`Deleted webhook ${delEp.url}`,severity:"warning",module:"settings"}); toast({title:"Endpoint deleted"});} setDelEp(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
