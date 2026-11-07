"use client";

/**
 * M6.4 — API Token Scoping (spec §10.4, upgraded in place).
 * Permission-engine-aligned scopes, expiry/IP allowlisting, usage
 * telemetry and strict rotation. Never-expiry requires a warning.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { KeyRound, Plus, Copy, RotateCcw, ShieldAlert, Trash2, Pencil } from "lucide-react";

type Call = { id:string; ts:string; endpoint:string; status:number; note?:string };
interface Token { id:string; name:string; preview:string; full:string; scopes:string[]; expiresAt?:string; never:boolean; lastUsed?:string; usage:number[]; calls:Call[]; audit:Array<{ts:string;actor:string;change:string}>; status:"active"|"revoked"; allowIps:string[]; }

const SCOPE_GROUPS: Array<{ module:string; scopes:Array<{id:string; label:string; write?:boolean}> }> = [
  { module:"Trading", scopes:[{id:"trading.read",label:"Read trades & positions"},{id:"trading.write",label:"Write trades",write:true}] },
  { module:"Marketing", scopes:[{id:"marketing.read",label:"Read campaigns & segments"},{id:"marketing.write",label:"Write campaigns & segments",write:true}] },
  { module:"Segments", scopes:[{id:"segments.read",label:"Read segments"},{id:"segments.write",label:"Write segments",write:true}] },
  { module:"Payouts", scopes:[{id:"payouts.read",label:"Read payouts"},{id:"payouts.write",label:"Approve/issue payouts",write:true}] },
  { module:"Risk", scopes:[{id:"risk.read",label:"Read risk signals"},{id:"risk.write",label:"Configure risk",write:true}] },
  { module:"Analytics", scopes:[{id:"analytics.read",label:"Read analytics"}] },
  { module:"Audit", scopes:[{id:"audit.read",label:"Read audit log"}] },
  { module:"Settings", scopes:[{id:"settings.read",label:"Read settings"},{id:"settings.write",label:"Manage settings",write:true}] },
];
const ALL_SCOPES = SCOPE_GROUPS.flatMap(g=>g.scopes.map(s=>s.id));
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/;
const ago=(d:number)=>new Date(Date.now()-d*86400000).toISOString();
const spark=(seed:number)=>Array.from({length:30},(_,i)=>Math.max(0,Math.round((Math.sin(i*0.6+seed)*20+30)*(1+(seed%3)*0.2))));

let TOKENS: Token[] = [
  {id:"tok-1",name:"Marketing read-only bot",preview:"pfaas_mr9f…k2a1",full:"pfaas_mr9f8a11bb22cc33dd44k2a1",scopes:["marketing.read","segments.read","analytics.read"],expiresAt:ago(-60),never:false,lastUsed:ago(0),usage:spark(1),calls:[
    {id:"c1",ts:ago(0),endpoint:"GET /marketing/campaigns",status:200},
    {id:"c2",ts:ago(0),endpoint:"POST /marketing/segments",status:403,note:"missing scope segments.write"},
    {id:"c3",ts:ago(1),endpoint:"GET /segments",status:200},
  ],audit:[{ts:ago(30),actor:"S. Malik",change:"Created with marketing.read, segments.read, analytics.read"}],status:"active",allowIps:[]},
  {id:"tok-2",name:"Finance payout integration",preview:"pfaas_fn4c…p9x0",full:"pfaas_fn4c55dd66ee77ff88p9x0",scopes:["payouts.read","payouts.write","audit.read"],expiresAt:ago(-5),never:false,lastUsed:ago(2),usage:spark(2),calls:[{id:"c4",ts:ago(2),endpoint:"POST /payouts/approve",status:200}],audit:[{ts:ago(90),actor:"A. Khan",change:"Created"}],status:"active",allowIps:["203.0.113.0/24"]},
  {id:"tok-3",name:"Legacy CI (indefinite)",preview:"pfaas_ci0z…old1",full:"pfaas_ci0zlegacyold1token",scopes:["settings.read","trading.read"],never:true,lastUsed:ago(14),usage:spark(3),calls:[{id:"c5",ts:ago(14),endpoint:"GET /settings",status:200}],audit:[{ts:ago(200),actor:"R. Idris",change:"Created with never-expiry (warning acknowledged)"}],status:"active",allowIps:[]},
];
const gen=()=>`pfaas_${Math.random().toString(36).slice(2,14)}${Math.random().toString(36).slice(2,10)}`;

function Spark({ data }:{data:number[]}){ const m=Math.max(...data,1); const pts=data.map((v,i)=>`${(i/(data.length-1))*80},${18-(v/m)*16}`).join(" "); return <svg viewBox="0 0 80 20" className="h-5 w-20"><polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" /></svg>; }

export function TokenManagementPage() {
  const [rows,setRows]=useState<Token[]>(TOKENS);
  const [detail,setDetail]=useState<Token|null>(null);
  const [editScopes,setEditScopes]=useState<Token|null>(null);
  const [createOpen,setCreateOpen]=useState(false);
  const [reveal,setReveal]=useState<{name:string;val:string;never:boolean}|null>(null);
  const [rotate,setRotate]=useState<Token|null>(null);
  const [strict,setStrict]=useState(true);
  const [revoke,setRevoke]=useState<Token|null>(null);
  // create form
  const [cName,setCName]=useState(""); const [cScopes,setCScopes]=useState<string[]>(SCOPE_GROUPS.flatMap(g=>g.scopes.filter(s=>!s.write).map(s=>s.id)));
  const [cExpiry,setCExpiry]=useState<"30"|"90"|"365"|"never">("90"); const [cIps,setCIps]=useState(""); const [cIpErr,setCIpErr]=useState("");

  const commit=(n:Token[])=>{ TOKENS=n; setRows(n); };
  const patch=(id:string,p:Partial<Token>)=>commit(rows.map(t=>t.id===id?{...t,...p}:t));
  const tok=(id:string)=>rows.find(t=>t.id===id);

  const validateIps = (raw:string) => { const parts=raw.split(/[,\n]/).map(s=>s.trim()).filter(Boolean); const bad=parts.filter(p=>!CIDR_RE.test(p)); return {parts,bad}; };

  function createToken(){
    const {parts,bad}=validateIps(cIps); if(bad.length){ setCIpErr(`Invalid CIDR: ${bad.join(", ")}`); return; }
    const full=gen(); const never=cExpiry==="never"; const days=cExpiry==="never"?0:Number(cExpiry);
    const rec:Token={id:`tok-${Date.now()}`,name:cName||"Untitled token",preview:full.slice(0,10)+"…"+full.slice(-4),full,scopes:[...cScopes],expiresAt:never?undefined:ago(-days),never,lastUsed:undefined,usage:Array(30).fill(0),calls:[],audit:[{ts:new Date().toISOString(),actor:"You",change:`Created (${cScopes.length} scopes${never?", never-expiry acknowledged":""})`}],status:"active",allowIps:parts};
    commit([rec,...rows]); setCreateOpen(false); setReveal({name:rec.name,val:full,never}); setCName(""); setCIps(""); setCIpErr("");
    recordAudit({action:"token.create",entity:"api-token",entityId:rec.id,summary:`Created token ${rec.name} (${rec.scopes.length} scopes).`,module:"settings"});
  }

  const cols: Column<Token>[] = [
    {key:"name",header:"Token",sortValue:t=>t.name,cell:t=><button type="button" className="text-left" onClick={()=>setDetail(t)}><span className="block text-sm font-medium">{t.name}</span><span className="font-mono text-[10px] text-muted-foreground">{t.preview}</span></button>},
    {key:"scopes",header:"Scopes",cell:t=>(
      <Popover><PopoverTrigger asChild><button type="button" className="flex flex-wrap gap-1">{t.scopes.slice(0,2).map(s=><Badge key={s} variant="outline" className="font-mono text-[9px]">{s}</Badge>)}{t.scopes.length>2&&<Badge variant="outline" className="text-[9px]">+{t.scopes.length-2}</Badge>}</button></PopoverTrigger>
        <PopoverContent className="w-64 space-y-0.5 p-2">{t.scopes.map(s=><div key={s} className="font-mono text-[10px]">{s}</div>)}</PopoverContent></Popover>
    )},
    {key:"exp",header:"Expiry",sortValue:t=>t.expiresAt??"9999",cell:t=>{
      if(t.never) return <Badge variant="secondary" className="text-[9px]">indefinite</Badge>;
      const daysLeft=t.expiresAt?Math.round((new Date(t.expiresAt).getTime()-Date.now())/86400000):99;
      return <StatusBadge tone={daysLeft<7?"danger":daysLeft<30?"warning":"muted"}>{t.expiresAt?new Date(t.expiresAt).toLocaleDateString():"—"}{daysLeft<7?" (<7d)":""}</StatusBadge>;
    }},
    {key:"last",header:"Last used",sortValue:t=>t.lastUsed??"",cell:t=><span className="text-xs">{t.lastUsed?relativeTime(t.lastUsed):"Never"}</span>},
    {key:"use",header:"Usage (30d)",cell:t=><Spark data={t.usage} />},
    {key:"a",header:"",cell:t=>(
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>setEditScopes(t)}><Pencil className="mr-1 h-3 w-3" />Scopes</Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={()=>setRotate(t)}><RotateCcw className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-destructive" onClick={()=>setRevoke(t)}><Trash2 className="h-3 w-3" /></Button>
      </div>
    )},
  ];

  return (
    <Page>
      <PageHeader title="API Tokens" description="Scoped tokens aligned to the permission engine — least privilege by default." icon={KeyRound}
        actions={<Button size="sm" onClick={()=>setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />New Token</Button>} />
      <PageContent>
        {rows.length===0 ? <EmptyState title="No API tokens" description="Create a scoped token (read by default, write opt-in) instead of an all-powerful key." icon={KeyRound} action={<Button size="sm" onClick={()=>setCreateOpen(true)}>New Token</Button>} /> :
          <DataTable columns={cols} data={rows.filter(t=>t.status==="active")} rowKey={t=>t.id} searchableText={t=>`${t.name} ${t.scopes.join(" ")}`} pageSize={10} emptyTitle="No tokens" />}
      </PageContent>

      {/* New token */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>New API token</SheetTitle><SheetDescription>Read scopes are preselected; write scopes are opt-in. The token is shown once.</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-4">
            <div><Label className="text-xs">Name</Label><Input value={cName} onChange={e=>setCName(e.target.value)} placeholder="e.g. Marketing read-only bot" className="mt-1" /></div>
            <div><p className="mb-1 text-xs font-semibold">Scopes (permission-engine IDs)</p><div className="max-h-52 space-y-2 overflow-auto rounded border p-2">{SCOPE_GROUPS.map(g=>(
              <div key={g.module}><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.module}</p>{g.scopes.map(s=>(
                <label key={s.id} className="flex items-center gap-2 text-xs"><Checkbox checked={cScopes.includes(s.id)} onCheckedChange={v=>setCScopes(v?[...cScopes,s.id]:cScopes.filter(x=>x!==s.id))} /><span className="font-mono text-[10px]">{s.id}</span><span className="text-muted-foreground">— {s.label}</span>{s.write&&<Badge variant="secondary" className="text-[9px]">write</Badge>}</label>
              ))}</div>
            ))}</div></div>
            <div><p className="mb-1 text-xs font-semibold">Expiry</p><RadioGroup value={cExpiry} onValueChange={v=>setCExpiry(v as any)} className="grid grid-cols-2 gap-1 text-xs">{[{v:"30",l:"30 days"},{v:"90",l:"90 days"},{v:"365",l:"365 days"},{v:"never",l:"Never"}].map(o=><label key={o.v} className="flex items-center gap-2 rounded border p-2"><RadioGroupItem value={o.v} />{o.l}</label>)}</RadioGroup>
              {cExpiry==="never"&&<div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/30"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600" /><span><strong>Never-expiry warning:</strong> indefinite tokens are a long-lived risk. Prefer a 90/365-day expiry and rotate. Creation requires this acknowledgement.</span></div>}</div>
            <div><Label className="text-xs">IP allowlist (optional, CIDR per line/comma)</Label><Input value={cIps} onChange={e=>{ setCIps(e.target.value); const {bad}=validateIps(e.target.value); setCIpErr(bad.length?`Invalid CIDR: ${bad.join(", ")}`:""); }} placeholder="203.0.113.0/24" className="mt-1 font-mono text-xs" />{cIpErr&&<p className="mt-1 text-[11px] text-destructive">{cIpErr}</p>}</div>
            <Button className="w-full" disabled={!cName.trim()||cScopes.length===0||!!cIpErr} onClick={createToken}>Create token</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* One-time reveal */}
      <Dialog open={!!reveal} onOpenChange={o=>!o&&setReveal(null)}>
        <DialogContent><DialogHeader><DialogTitle>Token created — {reveal?.name}</DialogTitle><DialogDescription>Copy it now. It will not be shown again.</DialogDescription></DialogHeader>
          {reveal&&<div className="space-y-2"><code className="block break-all rounded bg-muted p-2 text-xs">{reveal.val}</code>{reveal.never&&<Badge variant="secondary">indefinite</Badge>}<Button variant="outline" size="sm" onClick={()=>{ navigator.clipboard?.writeText(reveal.val); toast({title:"Copied"}); }}><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button></div>}
          <DialogFooter><Button onClick={()=>setReveal(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {detail&&(()=>{ const t=tok(detail.id)??detail; return (<>
            <SheetHeader><SheetTitle>{t.name}</SheetTitle><SheetDescription><span className="font-mono text-[10px]">{t.preview}</span> · {t.never?"indefinite":t.expiresAt?`expires ${new Date(t.expiresAt).toLocaleDateString()}`:""}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-4">
              <div><p className="mb-1 text-xs font-semibold">Usage (30 days)</p><svg viewBox="0 0 300 60" className="h-16 w-full rounded border bg-muted/20">{t.usage.map((v,i)=>{const m=Math.max(...t.usage,1); const h=(v/m)*50; return <rect key={i} x={i*10+1} y={55-h} width="8" height={h} fill="hsl(var(--primary))" opacity="0.7" rx="1" />;})}</svg></div>
              <div><p className="mb-1 text-xs font-semibold">Scopes & effective permissions</p><div className="space-y-1">{t.scopes.map(s=><div key={s} className="rounded border px-2 py-1 text-[10px]"><span className="font-mono font-medium">{s}</span><span className="text-muted-foreground"> — grants {s.endsWith(".write")?"read+write":"read-only"} access to the {s.split(".")[0]} resource.</span></div>)}</div></div>
              <div><p className="mb-1 text-xs font-semibold">Recent calls</p><DataTable columns={[
                {key:"ts",header:"Time",cell:(c:Call)=><span className="text-[10px]">{relativeTime(c.ts)}</span>},
                {key:"ep",header:"Endpoint",cell:(c:Call)=><span className="font-mono text-[10px]">{c.endpoint}</span>},
                {key:"st",header:"Status",cell:(c:Call)=><StatusBadge tone={c.status<400?"success":"danger"}>{String(c.status)}</StatusBadge>},
                {key:"n",header:"Note",cell:(c:Call)=><span className="text-[10px] text-muted-foreground">{c.note??"—"}</span>},
              ]} data={t.calls} rowKey={(c:Call)=>c.id} pageSize={5} emptyTitle="No calls yet" /></div>
              <div><p className="mb-1 text-xs font-semibold">Scope change audit</p><ul className="space-y-1 text-[11px] text-muted-foreground">{t.audit.map((a,i)=><li key={i}><span className="font-mono text-[10px]">{absoluteTime(a.ts)}</span> — {a.change} <span className="text-foreground">({a.actor})</span></li>)}</ul></div>
            </div>
          </>);})()}
        </SheetContent>
      </Sheet>

      {/* Edit scopes */}
      <Sheet open={!!editScopes} onOpenChange={o=>!o&&setEditScopes(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Edit scopes — {editScopes?.name}</SheetTitle><SheetDescription>Changes take effect on next use.</SheetDescription></SheetHeader>
          {editScopes&&(()=>{ const t=tok(editScopes.id)??editScopes; return (
            <div className="mt-4 space-y-3"><div className="max-h-72 space-y-2 overflow-auto rounded border p-2">{SCOPE_GROUPS.map(g=>(
              <div key={g.module}><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.module}</p>{g.scopes.map(s=>(
                <label key={s.id} className="flex items-center gap-2 text-xs"><Checkbox checked={t.scopes.includes(s.id)} onCheckedChange={v=>{ const next=v?[...t.scopes,s.id]:t.scopes.filter(x=>x!==s.id); patch(t.id,{scopes:next,audit:[{ts:new Date().toISOString(),actor:"You",change:`${v?"Granted":"Revoked"} ${s.id}`},...t.audit]}); setEditScopes({...t,scopes:next}); }} /><span className="font-mono text-[10px]">{s.id}</span></label>
              ))}</div>
            ))}</div><Button onClick={()=>{ recordAudit({action:"token.scopes",entity:"api-token",entityId:t.id,summary:`Updated scopes for ${t.name}.`,module:"settings"}); toast({title:"Scopes updated",description:"Takes effect on next use. Affected token notified in-product."}); setEditScopes(null); }}>Save</Button></div>
          );})()}
        </SheetContent>
      </Sheet>

      {/* Rotate */}
      <Dialog open={!!rotate} onOpenChange={o=>!o&&setRotate(null)}>
        <DialogContent><DialogHeader><DialogTitle>Rotate token — {rotate?.name}</DialogTitle><DialogDescription>Generate a new secret. Choose strict (immediate invalidation) or a 24-hour overlap.</DialogDescription></DialogHeader>
          <label className="flex items-center justify-between rounded border p-2 text-sm"><span>Strict mode <span className="block text-xs text-muted-foreground">Old secret invalidates immediately</span></span><Switch checked={strict} onCheckedChange={setStrict} /></label>
          <DialogFooter><Button variant="outline" onClick={()=>setRotate(null)}>Cancel</Button><Button onClick={()=>{ if(!rotate) return; const full=gen(); patch(rotate.id,{full,preview:full.slice(0,10)+"…"+full.slice(-4),audit:[{ts:new Date().toISOString(),actor:"You",change:`Rotated (${strict?"strict, old invalidated":"24h overlap"})`},...rotate.audit]}); recordAudit({action:"token.rotate",entity:"api-token",entityId:rotate.id,summary:`Rotated ${rotate.name} (${strict?"strict":"24h overlap"}).`,severity:"warning",module:"settings"}); setReveal({name:rotate.name,val:full,never:rotate.never}); setRotate(null); toast({title:"Token rotated",description:strict?"Old secret invalidated.":"Old secret valid for 24 hours."}); }}>Rotate & reveal</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke */}
      <Dialog open={!!revoke} onOpenChange={o=>!o&&setRevoke(null)}>
        <DialogContent><DialogHeader><DialogTitle>Revoke {revoke?.name}?</DialogTitle><DialogDescription>The token stops working immediately.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={()=>setRevoke(null)}>Cancel</Button><Button variant="destructive" onClick={()=>{ if(revoke){ patch(revoke.id,{status:"revoked"}); recordAudit({action:"token.revoke",entity:"api-token",entityId:revoke.id,summary:`Revoked ${revoke.name}.`,severity:"warning",module:"settings"}); toast({title:"Token revoked"});} setRevoke(null); }}>Revoke</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
