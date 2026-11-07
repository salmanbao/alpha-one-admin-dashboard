"use client";

/**
 * M5.1 — Ad Account Connections (spec §9.1, rebuilt from stitch mockup).
 * OAuth connections to Meta Marketing API, Google Ads, TikTok Ads with
 * token lifecycle management, consent interstitial and account picker.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Plug, RefreshCw, Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type ProviderKey = "meta"|"google"|"tiktok";
interface AdAccount { id:string; provider:ProviderKey; name:string; accountId:string; currency:string; status:"active"|"token_expiring"|"error"; expiresInDays:number; flowing:string[]; lastIngest:string }
interface Provider { key:ProviderKey; name:string; apiVersion:string; scopes:string[]; scopePlain:string[] }

const PROVIDERS: Provider[] = [
  { key:"meta", name:"Meta Marketing API", apiVersion:"v21.0", scopes:["ads_read","ads_management","business_management"], scopePlain:["Read your ad accounts and campaign performance","Manage ads and audiences on your behalf","Access Business Manager assets you select"] },
  { key:"google", name:"Google Ads", apiVersion:"v17", scopes:["adwords"], scopePlain:["Read and report on your Google Ads campaigns and spend","No changes are made to bids or creatives by this connection"] },
  { key:"tiktok", name:"TikTok Ads", apiVersion:"v1.3", scopes:["Ads.Management","Reporting"], scopePlain:["Read TikTok ad account performance and spend","Manage conversion event configuration you approve"] },
];

const PICKER: Record<ProviderKey, Array<{id:string;name:string;currency:string;role:string}>> = {
  meta:[{id:"act_9182",name:"ApexFunded Main",currency:"USD",role:"Admin"},{id:"act_2201",name:"ApexFunded EU",currency:"EUR",role:"Analyst"}],
  google:[{id:"882-110-4421",name:"ApexFunded Search",currency:"USD",role:"Admin"},{id:"882-110-9990",name:"ApexFunded Brand",currency:"GBP",role:"Standard"}],
  tiktok:[{id:"adv_7710",name:"ApexFunded TikTok",currency:"USD",role:"Operator"}],
};

const seed: AdAccount[] = [
  {id:"aa1",provider:"meta",name:"ApexFunded Main",accountId:"act_9182",currency:"USD",status:"token_expiring",expiresInDays:3,flowing:["spend","conversions"],lastIngest:new Date(Date.now()-18*60000).toISOString()},
  {id:"aa2",provider:"google",name:"ApexFunded Search",accountId:"882-110-4421",currency:"USD",status:"active",expiresInDays:42,flowing:["spend"],lastIngest:new Date(Date.now()-9*60000).toISOString()},
];

export function AdAccountsPage() {
  const [accounts,setAccounts]=useState(seed);
  const [connecting,setConnecting]=useState<Provider|null>(null);
  const [consentStep,setConsentStep]=useState<"consent"|"exchanging"|"picker"|"result">("consent");
  const [oauthResult,setOauthResult]=useState<{kind:"ok"|"cancel"|"scope"|"error";msg:string}|null>(null);
  const [picked,setPicked]=useState<string[]>([]);
  const [revoke,setRevoke]=useState<AdAccount|null>(null);
  const [revokeText,setRevokeText]=useState("");
  const expiring = accounts.filter(a=>a.expiresInDays<7);

  function startConnect(p:Provider){ setConnecting(p); setConsentStep("consent"); setOauthResult(null); setPicked([]); }
  function consentContinue(){
    setConsentStep("exchanging");
    setTimeout(()=>{ // mock: 80% ok
      setConsentStep("picker");
    }, 700);
  }
  function importPicked(){
    if(!connecting) return;
    const toAdd = (PICKER[connecting.key]||[]).filter(x=>picked.includes(x.id)).map(x=>({
      id:`aa-${Date.now()}-${x.id}`, provider:connecting.key, name:x.name, accountId:x.id, currency:x.currency,
      status:"active" as const, expiresInDays:60, flowing:["spend"], lastIngest:new Date().toISOString(),
    }));
    setAccounts([...toAdd,...accounts]);
    recordAudit({action:"ad.oauth.connect",entity:"ad-account",entityId:connecting.key,summary:`Connected ${toAdd.length} ${connecting.name} account(s) via OAuth.`,module:"marketing"});
    toast({title:"Accounts connected",description:`${toAdd.length} ${connecting.name} account(s) imported. Ingestion started.`});
    setConnecting(null);
  }
  function refreshToken(a:AdAccount){
    setAccounts(as=>as.map(x=>x.id===a.id?{...x,status:"active",expiresInDays:60}:x));
    toast({title:"Token refreshed",description:`${a.name} re-authenticated non-destructively.`});
  }
  function syncNow(a:AdAccount){
    setAccounts(as=>as.map(x=>x.id===a.id?{...x,lastIngest:new Date().toISOString()}:x));
    toast({title:"Sync started",description:`${a.name} ingest queued.`});
  }

  const cols: Column<AdAccount>[] = [
    {key:"provider",header:"Provider",cell:a=><Badge variant="outline" className="text-[10px]">{PROVIDERS.find(p=>p.key===a.provider)?.name??a.provider}</Badge>},
    {key:"name",header:"Account",sortValue:a=>a.name,cell:a=><span className="text-sm font-medium">{a.name}<span className="block font-mono text-[10px] text-muted-foreground">{a.accountId}</span></span>},
    {key:"cur",header:"Currency",cell:a=><span className="text-xs">{a.currency}</span>},
    {key:"status",header:"Status",cell:a=><StatusBadge tone={a.status==="active"?"success":a.status==="token_expiring"?"warning":"danger"}>{a.status.replace("_"," ")}</StatusBadge>},
    {key:"token",header:"Token health",sortValue:a=>a.expiresInDays,cell:a=><StatusBadge tone={a.expiresInDays<7?"danger":a.expiresInDays<14?"warning":"success"}>expires in {a.expiresInDays}d</StatusBadge>},
    {key:"flow",header:"Data flowing",cell:a=><div className="flex gap-1">{a.flowing.map(f=><Badge key={f} variant="secondary" className="text-[9px]">{f}</Badge>)}</div>},
    {key:"ingest",header:"Last ingest",sortValue:a=>a.lastIngest,cell:a=><span className="text-xs">{relativeTime(a.lastIngest)}</span>},
    {key:"act",header:"",cell:a=>(
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={()=>refreshToken(a)}><RefreshCw className="mr-1 h-3 w-3" />Refresh token</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={()=>syncNow(a)}>Sync now</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={()=>{setRevoke(a);setRevokeText("");}}>Revoke</Button>
      </div>
    )},
  ];

  return (
    <Page>
      <PageHeader title="Ad Accounts" description="OAuth connections to Meta, Google Ads and TikTok with token lifecycle management." icon={Plug}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>{ accounts.forEach(refreshToken); }}>Refresh all tokens</Button></div>} />
      <PageContent>
        {expiring.length>0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>{expiring.length} token(s) expire within 7 days — refresh to avoid ingestion gaps.</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {PROVIDERS.map(p=>{
            const count=accounts.filter(a=>a.provider===p.key).length;
            return (
              <div key={p.key} className="rounded-lg border p-4">
                <div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p><StatusBadge tone={count?"success":"muted"}>{count?`${count} connected`:"Disconnected"}</StatusBadge></div>
                <p className="mt-1 text-[11px] text-muted-foreground">API {p.apiVersion} · scopes: {p.scopes.join(", ")}</p>
                <Button size="sm" className="mt-3 w-full" variant={count?"outline":"default"} onClick={()=>startConnect(p)}>Connect via OAuth</Button>
              </div>
            );
          })}
        </div>

        {accounts.length===0 ? <EmptyState title="No ad accounts connected" description="Connect Meta, Google Ads or TikTok above to ingest spend and conversions." icon={Plug} /> :
          <DataTable columns={cols} data={accounts} rowKey={a=>a.id} searchableText={a=>`${a.name} ${a.accountId} ${a.provider}`} pageSize={8} emptyTitle="No accounts" />}
      </PageContent>

      {/* OAuth interstitial + picker */}
      <Dialog open={!!connecting} onOpenChange={o=>!o&&setConnecting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />{connecting?.name} — authorization</DialogTitle>
            <DialogDescription>{consentStep==="consent"?"Review the requested scopes in plain language.":consentStep==="exchanging"?"Exchanging authorization code…":consentStep==="picker"?"Select the ad accounts to import.":"Result"}</DialogDescription></DialogHeader>

          {consentStep==="consent" && connecting && (
            <div className="space-y-2"><p className="text-xs font-semibold">This app is requesting:</p>{connecting.scopePlain.map(s=><div key={s} className="flex items-start gap-2 text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /><span>{s}</span></div>)}<p className="text-[10px] text-muted-foreground">Provider branding: {connecting.name} ({connecting.apiVersion}). You can revoke access at any time.</p></div>
          )}
          {consentStep==="exchanging" && <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Completing OAuth exchange…</div>}
          {consentStep==="picker" && connecting && (
            <div className="space-y-2">{(PICKER[connecting.key]||[]).map(x=>(
              <label key={x.id} className="flex items-center justify-between rounded border p-2 text-xs"><span className="flex items-center gap-2"><Checkbox checked={picked.includes(x.id)} onCheckedChange={v=>setPicked(v?[...picked,x.id]:picked.filter(i=>i!==x.id))} />{x.name}<span className="font-mono text-[10px] text-muted-foreground">{x.id}</span></span><span className="text-muted-foreground">{x.currency} · {x.role}</span></label>
            ))}</div>
          )}
          {oauthResult && <div className={`rounded-lg border p-3 text-sm ${oauthResult.kind==="ok"?"border-emerald-400/50":"border-destructive/50"}`}>{oauthResult.kind==="ok"?<CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />:<XCircle className="mr-1 inline h-4 w-4 text-destructive" />}{oauthResult.msg}</div>}

          <DialogFooter>
            {consentStep==="consent" && <><Button variant="outline" onClick={()=>{ setOauthResult({kind:"cancel",msg:"OAuth canceled by user. No account added, no partial state persisted."}); setConsentStep("result"); }}>Cancel</Button><Button onClick={consentContinue}>Continue</Button></>}
            {consentStep==="picker" && <><Button variant="outline" onClick={()=>setConnecting(null)}>Cancel</Button><Button disabled={picked.length===0} onClick={importPicked}>Import selected ({picked.length})</Button></>}
            {consentStep==="result" && <Button onClick={()=>{ if(oauthResult?.kind!=="ok"&&connecting){ startConnect(connecting); } else setConnecting(null); }}>{oauthResult?.kind==="ok"?"Done":"Retry"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke */}
      <AlertDialog open={!!revoke} onOpenChange={o=>!o&&setRevoke(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke {revoke?.name}?</AlertDialogTitle><AlertDialogDescription>Spend ingestion stops for this account. Type the account ID to confirm.</AlertDialogDescription></AlertDialogHeader>
          <Input value={revokeText} onChange={e=>setRevokeText(e.target.value)} placeholder={revoke?.accountId} />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={revokeText!==revoke?.accountId} onClick={()=>{ if(!revoke) return; setAccounts(as=>as.filter(x=>x.id!==revoke.id)); recordAudit({action:"ad.oauth.revoke",entity:"ad-account",entityId:revoke.id,summary:`Revoked ${revoke.name} (${revoke.accountId}); ingestion stopped.`,severity:"warning",module:"marketing"}); toast({title:"Account revoked",description:"Ingestion stopped and row removed."}); setRevoke(null); }}>Revoke</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
