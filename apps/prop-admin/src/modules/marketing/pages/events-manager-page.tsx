"use client";

/**
 * M5.3 — Conversion Events Manager (spec §9.3).
 * Event catalog mapped to destinations (GA4, Meta CAPI, TikTok Events
 * API) with per-destination toggles, delivery status, dedup keys and
 * a test console. First-class view replacing the gated stitch depth.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Activity, Send, Zap, CheckCircle2, XCircle } from "lucide-react";

type Dest = "ga4"|"meta_capi"|"tiktok";
const DEST_LABEL: Record<Dest,string> = { ga4:"GA4", meta_capi:"Meta CAPI", tiktok:"TikTok Events" };
interface EventDef { id:string; name:string; domain:string; desc:string; payload:string[]; dedupKey:string; dests:Record<Dest,boolean>; deliveries24h:number; success:number; lastSent:string }

let EVENTS: EventDef[] = [
  {id:"ev1",name:"signup_completed",domain:"Acquisition",desc:"Trader completes registration.",payload:["trader_id","email_hash","source","utm_campaign"],dedupKey:"trader_id+event_id",dests:{ga4:true,meta_capi:true,tiktok:true},deliveries24h:342,success:99.1,lastSent:new Date(Date.now()-4*60000).toISOString()},
  {id:"ev2",name:"kyc_approved",domain:"Activation",desc:"KYC verification passes.",payload:["trader_id","level","provider"],dedupKey:"trader_id+session_id",dests:{ga4:true,meta_capi:true,tiktok:false},deliveries24h:128,success:100,lastSent:new Date(Date.now()-12*60000).toISOString()},
  {id:"ev3",name:"challenge_purchased",domain:"Revenue",desc:"Trader buys a challenge.",payload:["trader_id","value","currency","plan"],dedupKey:"order_id",dests:{ga4:true,meta_capi:true,tiktok:true},deliveries24h:96,success:97.9,lastSent:new Date(Date.now()-7*60000).toISOString()},
  {id:"ev4",name:"challenge_passed",domain:"Activation",desc:"Evaluation/verification passed.",payload:["account_id","trader_id","phase"],dedupKey:"account_id+phase",dests:{ga4:true,meta_capi:false,tiktok:false},deliveries24h:41,success:100,lastSent:new Date(Date.now()-40*60000).toISOString()},
  {id:"ev5",name:"payout_requested",domain:"Revenue",desc:"Funded trader requests payout.",payload:["trader_id","amount","currency"],dedupKey:"payout_id",dests:{ga4:true,meta_capi:true,tiktok:false},deliveries24h:18,success:94.4,lastSent:new Date(Date.now()-90*60000).toISOString()},
];

export function EventsManagerPage() {
  const [rows,setRows]=useState(EVENTS);
  const [testOpen,setTestOpen]=useState(false);
  const [testEvent,setTestEvent]=useState(EVENTS[0].id);
  const [testDest,setTestDest]=useState<Dest>("ga4");
  const [testResult,setTestResult]=useState<{ok:boolean;msg:string;ms:number}|null>(null);
  const [sending,setSending]=useState(false);

  function toggle(evId:string,d:Dest,v:boolean){
    const next=rows.map(r=>r.id===evId?{...r,dests:{...r.dests,[d]:v}}:r); EVENTS=next; setRows(next);
    recordAudit({action:"events.dest.toggle",entity:"conversion-event",entityId:evId,summary:`${v?"Enabled":"Disabled"} ${DEST_LABEL[d]} for ${rows.find(r=>r.id===evId)?.name}.`,module:"marketing"});
  }

  function runTest(){
    setSending(true); setTestResult(null);
    setTimeout(()=>{
      const ok = testDest!=="tiktok" || Math.random()>0.3;
      setTestResult(ok?{ok:true,msg:`${DEST_LABEL[testDest]} accepted the event (deduped by key).`,ms:142}:{ok:false,msg:`${DEST_LABEL[testDest]} returned 400 — missing required parameter \`ttclid\`.`,ms:210});
      setSending(false);
    },700);
  }

  const cols: Column<EventDef>[] = [
    {key:"name",header:"Event",sortValue:r=>r.name,cell:r=><span><span className="font-mono text-xs font-medium">{r.name}</span><span className="block text-[10px] text-muted-foreground">{r.domain} · {r.desc}</span></span>},
    {key:"ga4",header:"GA4",cell:r=><Switch checked={r.dests.ga4} onCheckedChange={v=>toggle(r.id,"ga4",v)} aria-label={`GA4 ${r.name}`} />},
    {key:"meta",header:"Meta CAPI",cell:r=><Switch checked={r.dests.meta_capi} onCheckedChange={v=>toggle(r.id,"meta_capi",v)} aria-label={`Meta CAPI ${r.name}`} />},
    {key:"tt",header:"TikTok",cell:r=><Switch checked={r.dests.tiktok} onCheckedChange={v=>toggle(r.id,"tiktok",v)} aria-label={`TikTok ${r.name}`} />},
    {key:"del",header:"Deliveries 24h",numeric:true,sortValue:r=>r.deliveries24h,cell:r=><span className="tabular-nums text-xs">{r.deliveries24h}</span>},
    {key:"ok",header:"Success",numeric:true,sortValue:r=>r.success,cell:r=><StatusBadge tone={r.success>98?"success":r.success>95?"warning":"danger"}>{r.success}%</StatusBadge>},
    {key:"last",header:"Last sent",sortValue:r=>r.lastSent,cell:r=><span className="text-xs">{relativeTime(r.lastSent)}</span>},
  ];

  const active = rows.reduce((s,r)=>s+Object.values(r.dests).filter(Boolean).length,0);
  const avg = rows.reduce((s,r)=>s+r.success,0)/rows.length;

  return (
    <Page>
      <PageHeader title="Events Manager" description="Map conversion events to GA4, Meta CAPI and TikTok Events API with delivery monitoring." icon={Activity}
        actions={<Button size="sm" onClick={()=>setTestOpen(true)}><Zap className="mr-1 h-4 w-4" />Test console</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Events defined" value={String(rows.length)} />
          <MetricCard label="Active destinations" value={String(active)} tone="info" />
          <MetricCard label="Avg delivery success" value={`${avg.toFixed(1)}%`} tone={avg>98?"positive":"warning"} />
        </div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} searchableText={r=>`${r.name} ${r.domain} ${r.desc}`} pageSize={10} emptyTitle="No events" />
        <p className="text-[11px] text-muted-foreground">Server-side events include dedup keys to avoid double-counting browser pixels. Meta/TikTok IDs (fbp, ttclid) are attached when available.</p>
      </PageContent>

      <Sheet open={testOpen} onOpenChange={setTestOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Test console</SheetTitle><SheetDescription>Send a sample event to a destination and inspect the response.</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-3">
            <div><Label className="text-xs">Event</Label><Select value={testEvent} onValueChange={setTestEvent}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{rows.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Destination</Label><Select value={testDest} onValueChange={v=>setTestDest(v as Dest)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ga4">GA4</SelectItem><SelectItem value="meta_capi">Meta CAPI</SelectItem><SelectItem value="tiktok">TikTok Events API</SelectItem></SelectContent></Select></div>
            <Card><CardContent className="p-2"><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Sample payload</p><pre className="overflow-auto text-[10px]">{JSON.stringify({event_name:rows.find(r=>r.id===testEvent)?.name,event_time:Math.floor(Date.now()/1000),action_source:"website",user_data:{external_id:"hash:…"},custom_data:{currency:"USD",value:299}},null,2)}</pre></CardContent></Card>
            <Button className="w-full" onClick={runTest} disabled={sending}><Send className="mr-1 h-4 w-4" />{sending?"Sending…":"Send test event"}</Button>
            {testResult&&<div className={`rounded-lg border p-3 text-sm ${testResult.ok?"border-emerald-400/50":"border-destructive/50"}`}>{testResult.ok?<CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />:<XCircle className="mr-1 inline h-4 w-4 text-destructive" />}{testResult.msg}<span className="ml-2 text-xs text-muted-foreground">{testResult.ms}ms</span></div>}
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  );
}
