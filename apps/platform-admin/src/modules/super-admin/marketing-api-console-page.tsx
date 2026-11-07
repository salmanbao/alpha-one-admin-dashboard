"use client";
/** R2-12 — Marketing API Gateway Console (P2). Products/keys/scopes/tiers + 30d usage, playground, breaking-change feed. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/platform/console-store";
import { AreaSeries } from "@/components/platform/charts";
import { Code2, Key, Play, GitBranch, AlertTriangle } from "lucide-react";
import {
  recordRun, recordBreach, listRuns, listBreaches, useApiConsoleVersion,
} from "./marketing-api-console-store";

type Scope = "segments:read"|"segments:write"|"campaigns:read"|"campaigns:write"|"events:relay"|"consent:read"|"consent:write";
interface ApiKey { id:string; tenant:string; name:string; scopes:Scope[]; tier:"sandbox"|"standard"|"premium"; created:string; lastUsed:string; usage30d:number[]; breaches:number; version:number }
const now=()=>new Date().toISOString();
const SEED: ApiKey[] = [
  {id:"k1",tenant:"ApexFunded",name:"connector-prod",scopes:["segments:read","segments:write","events:relay"],tier:"standard",created:now(),lastUsed:now(),usage30d:Array.from({length:30},(_,i)=>Math.round(400+Math.sin(i/3)*180+(i>24?600:0))),breaches:2,version:3},
  {id:"k2",tenant:"TradeMax",name:"webhook2-consumer",scopes:["campaigns:read","consent:read"],tier:"premium",created:now(),lastUsed:now(),usage30d:Array.from({length:30},(_,i)=>Math.round(900+Math.cos(i/4)*200)),breaches:0,version:1},
  {id:"k3",tenant:"SandboxCo",name:"sandbox-test",scopes:["segments:write","consent:write"],tier:"sandbox",created:now(),lastUsed:now(),usage30d:Array.from({length:30},(_,i)=>Math.round(20+i*2)),breaches:0,version:1},
];
const PRODUCTS = [
  {name:"Segments API",scopes:"segments:read, segments:write",desc:"Create segments, enroll contacts"},
  {name:"Campaigns API",scopes:"campaigns:read, campaigns:write",desc:"Create/schedule campaigns"},
  {name:"Events / CAPI relay",scopes:"events:relay",desc:"Server-side event forwarding"},
  {name:"Consent API",scopes:"consent:read, consent:write",desc:"Write consent receipts (N10)"},
];
const CHANGES = [
  {v:"2026-11-01",note:"Segments API: `filter.nested` deprecated — migrate to `filter.groups` (breaks 2027-01).",sev:"breaking"},
  {v:"2026-10-15",note:"Consent API: added `receipt.channel` field (non-breaking).",sev:"minor"},
];
export function MarketingApiConsolePage(){
  const { pushNotification } = usePlatform();
  useApiConsoleVersion();
  const runs = listRuns();
  const breaches = listBreaches();
  const [keys,setKeys]=useState(SEED); const [sel,setSel]=useState(keys[0].id);
  const key = keys.find(k=>k.id===sel)||keys[0];
  const [scope,setScope]=useState<Scope>("segments:read");
  const [playTenant,setPlayTenant]=useState("SandboxCo");
  const [body,setBody]=useState('{\n  "name": "High-intent EU",\n  "filter": { "country": ["DE","FR"] }\n}');
  const [resp,setResp]=useState("");
  const breachTotal = keys.reduce((s,k)=>s+k.breaches,0);
  const cols: Column<ApiKey>[] = [
    {key:"name",header:"Key",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setSel(r.id)}>{r.name}<span className="block text-[10px] text-muted-foreground">{r.tenant} · v{r.version}</span></button>},
    {key:"tier",header:"Tier",cell:r=><StatusBadge tone={r.tier==="premium"?"success":r.tier==="sandbox"?"muted":"info"}>{r.tier}</StatusBadge>},
    {key:"scopes",header:"Scopes",cell:r=><span className="font-mono text-[10px]">{r.scopes.join(", ")}</span>},
    {key:"br",header:"30d breaches",numeric:true,cell:r=><span className={r.breaches?"text-destructive":""}>{r.breaches}</span>},
    {key:"lu",header:"Last used",cell:r=><span className="text-xs">{new Date(r.lastUsed).toLocaleDateString()}</span>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{const ns=key.scopes.includes(scope)?key.scopes.filter(s=>s!==scope):[...key.scopes,scope]; setKeys(ks=>ks.map(k=>k.id===r.id?{...k,scopes:ns,version:k.version+1}:k)); recordAudit({actor:"operator",action:"api.scope_change",target:r.id,detail:`Scope change on ${r.name}: ${scope} (v${r.version+1})`,severity:"warning"}); toast({title:"Scope updated",description:`Versioned (v${r.version+1}) & audit-logged (AC-3).`});}}><Key className="mr-1 h-3 w-3"/>Scope</Button><Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={()=>{setKeys(ks=>ks.filter(k=>k.id!==r.id)); recordAudit({actor:"operator",action:"api.key_revoke",target:r.id,detail:`Revoked key ${r.name}`,severity:"critical"}); toast({title:"Key revoked"}); if(sel===r.id) setSel(keys[0].id);}}>Revoke</Button></div>},
  ];
  const run = ()=>{
    if(key.tier==="sandbox" && /segments/.test(body) && key.scopes.includes("segments:write")){
      const resp = `HTTP/1.1 201 Created\n{\n  "segment_id": "seg_${Math.random().toString(36).slice(2,9)}",\n  "enrolled": 1,\n  "contact": "playground@example.com",\n  "note": "Sandbox key created segment + enrolled contact (AC-1)"\n}`;
      setResp(resp);
      recordRun({ tenant: playTenant, keyId: key.id, keyName: key.name, tier: key.tier, request: body, status: 201, response: resp, note: "created segment + enrolled contact (AC-1)" });
      recordAudit({actor:"operator",action:"api.playground",target:key.id,detail:`Playground: created segment + enrolled contact via ${key.name}`,severity:"info"});
      toast({title:"201 Created",description:"Sandbox key created a segment and enrolled a contact (AC-1)."});
    } else { const resp = `HTTP/1.1 403 Forbidden\n{\n  "error": "insufficient_scope",\n  "required": "${/segments/.test(body)?"segments:write":"consent:write"}",\n  "key_tier": "${key.tier}"\n}`; setResp(resp); recordRun({ tenant: playTenant, keyId: key.id, keyName: key.name, tier: key.tier, request: body, status: 403, response: resp, note: "insufficient scope / tier" }); }
  };
  return (
    <Page>
      <PageHeader title="Marketing API Gateway Console" description="Marketing-scoped API surface: products, keys, scopes (versioned), rate-limit tiers, 30-day usage, playground, breaking changes." icon={Code2} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4"><MetricCard label="API products" value={String(PRODUCTS.length)}/><MetricCard label="Active keys" value={String(keys.length)}/><MetricCard label="Rate-limit breaches (30d)" value={String(breachTotal)} tone={breachTotal?"negative":"positive"}/><MetricCard label="Sandbox keys" value={String(keys.filter(k=>k.tier==="sandbox").length)}/></div>
        <Tabs defaultValue="keys"><TabsList><TabsTrigger value="keys">Keys & usage</TabsTrigger><TabsTrigger value="playground">Playground</TabsTrigger><TabsTrigger value="runs">Runs &amp; breaches</TabsTrigger><TabsTrigger value="changes">Breaking changes</TabsTrigger></TabsList>
          <TabsContent value="keys" className="mt-3 space-y-3">
            <Card><CardContent className="p-3 grid gap-2 sm:grid-cols-4 text-xs">{PRODUCTS.map(p=><div key={p.name} className="rounded border p-2"><p className="font-semibold">{p.name}</p><p className="text-muted-foreground">{p.desc}</p><code className="text-[10px]">{p.scopes}</code></div>)}</CardContent></Card>
            <div className="grid gap-3 lg:grid-cols-[1fr_300px]"><DataTable columns={cols} data={keys} rowKey={r=>r.id} pageSize={6}/>
              <Card><CardContent className="p-3 space-y-2 text-xs"><p className="font-semibold">30d usage — {key.name}</p><AreaSeries data={key.usage30d.map((v,i)=>({i,v}))} xKey="i" yKey="v" height={120} color="hsl(var(--primary))"/>{key.breaches>0&&<p className="text-destructive flex items-center gap-1">⚠ {key.breaches} rate-limit breach(es) — surfaces in tenant-api-usage alerts (AC-2).</p>}<div className="flex gap-2"><Select value={scope} onValueChange={v=>setScope(v as Scope)}><SelectTrigger className="h-7"><SelectValue/></SelectTrigger><SelectContent>{["segments:read","segments:write","campaigns:read","campaigns:write","events:relay","consent:read","consent:write"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" className="h-7" onClick={()=>{const ns=key.scopes.includes(scope)?key.scopes.filter(s=>s!==scope):[...key.scopes,scope]; setKeys(ks=>ks.map(k=>k.id===key.id?{...k,scopes:ns,version:k.version+1}:k)); recordAudit({actor:"operator",action:"api.scope_change",target:key.id,detail:`Scope ${scope} ${key.scopes.includes(scope)?"removed":"added"} on ${key.name} → v${key.version+1}`,severity:"warning"}); toast({title:"Scope versioned",description:`v${key.version+1} audit-logged (AC-3).`});}}>Apply scope change</Button></div></CardContent></Card></div>
          </TabsContent>
          <TabsContent value="playground" className="mt-3 space-y-3">
            <Card><CardContent className="p-3 space-y-2 text-xs"><div className="flex gap-2"><Select value={playTenant} onValueChange={setPlayTenant}><SelectTrigger className="w-48 h-8"><SelectValue/></SelectTrigger><SelectContent>{["SandboxCo","ApexFunded","TradeMax"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><span className="text-muted-foreground">Key: {key.name} ({key.tier}) · POST https://api.alpha.one/v2/marketing/segments</span></div><textarea className="w-full h-40 rounded border bg-transparent p-2 font-mono text-xs" value={body} onChange={e=>setBody(e.target.value)}/><div className="flex gap-2"><Button size="sm" onClick={run}><Play className="mr-1 h-3 w-3"/>Run request</Button><span className="text-muted-foreground self-center">Ready-made requests against sandbox tenants (AC-1).</span></div>{resp&&<pre className="rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">{resp}</pre>}</CardContent></Card>
          </TabsContent>
          <TabsContent value="runs" className="mt-3 space-y-3">
            <Card><CardContent className="p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Recent playground runs ({runs.length})</p>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                  recordBreach({ keyId: key.id, keyName: key.name, tenant: key.tenant, count: 1, severity: "warning" });
                  pushNotification({ title: "Rate-limit breach", message: `${key.name} (${key.tenant}) hit the rate limit — recorded in the gateway console.`, severity: "warning", module: "marketing" });
                  toast({ title: "Breach recorded", description: "Pushed to the tenant alert subscription (AC-2)." });
                }}><AlertTriangle className="mr-1 h-3 w-3"/>Simulate breach</Button>
              </div>
              {runs.length === 0 && <p className="text-muted-foreground">No runs yet — execute a request in the Playground tab.</p>}
              {runs.slice(0,8).map(r => (
                <div key={r.id} className="rounded border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.keyName} <span className="text-muted-foreground">· {r.tenant} · {r.tier}</span></span>
                    <StatusBadge tone={r.status === 201 ? "success" : "danger"}>{r.status}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{r.note} · {new Date(r.at).toLocaleString()}</p>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardContent className="p-3 space-y-2 text-xs">
              <p className="font-semibold">Rate-limit breaches ({breaches.length})</p>
              {breaches.length === 0 && <p className="text-muted-foreground">No breaches recorded. Use "Simulate breach" or wait for real traffic.</p>}
              {breaches.slice(0,8).map(b => (
                <div key={b.id} className="rounded border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{b.keyName} <span className="text-muted-foreground">· {b.tenant}</span></span>
                    <StatusBadge tone={b.severity === "critical" ? "danger" : "warning"}>{b.severity}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{b.count} hit(s) · {new Date(b.at).toLocaleString()}</p>
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="changes" className="mt-3">
            <Card><CardContent className="p-3 space-y-2 text-xs">{CHANGES.map(c=><div key={c.v} className="rounded border p-2 flex gap-2 items-start"><GitBranch className="h-3.5 w-3.5 mt-0.5"/><div><p className="font-mono text-[10px]">{c.v} · <StatusBadge tone={c.sev==="breaking"?"danger":"muted"}>{c.sev}</StatusBadge></p><p>{c.note}</p></div></div>)}<p className="text-muted-foreground">Feed ties to the platform changelog page.</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
