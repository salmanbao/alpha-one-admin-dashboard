"use client";
/** R2-13 — Push Opt-In & Channel Status (trader). Closes R2-F03: requests browser notification permission. */
import { useEffect, useMemo, useState } from "react";
import { Bell, Mail, MessageSquare, Smartphone, AppWindow, Send, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import { loadPrefs, savePrefs, TOPIC_LABEL, type MarketingTopic } from "@/lib/marketing-preferences";

type Perm = "granted" | "denied" | "default" | "unsupported";
const PUSH_KEY = "pfaas:trader:pushChannel";
interface PushState { topicPush: Record<MarketingTopic, boolean>; quietStart:string; quietEnd:string; lastTest?:string }
function loadPush(): PushState { if(typeof window==="undefined") return {topicPush:{promotions:false,education:true,product_news:true},quietStart:"22:00",quietEnd:"07:00"}; try{const r=localStorage.getItem(PUSH_KEY); return r?JSON.parse(r):{topicPush:{promotions:false,education:true,product_news:true},quietStart:"22:00",quietEnd:"07:00"};}catch{return {topicPush:{promotions:false,education:true,product_news:true},quietStart:"22:00",quietEnd:"07:00"};} }
function savePush(s:PushState){ if(typeof window!=="undefined") try{localStorage.setItem(PUSH_KEY,JSON.stringify(s));}catch{} }

export function PushChannelStatusPage(){
  const [perm,setPerm]=useState<Perm>("default");
  const [explain,setExplain]=useState(false);
  const [push,setPush]=useState<PushState>({topicPush:{promotions:false,education:true,product_news:true},quietStart:"22:00",quietEnd:"07:00"});
  const [prefs,setPrefs]=useState(loadPrefs());
  useEffect(()=>{ setPush(loadPush()); setPrefs(loadPrefs()); if(typeof window==="undefined"||!("Notification" in window)) {setPerm("unsupported"); return;} setPerm(Notification.permission as Perm); },[]);
  const channels = useMemo(()=>[
    {id:"push",label:"Push notifications",icon:Smartphone,enabled:perm==="granted",last:"—",hint:perm==="granted"?"Opted in on this device":"Enable to receive alerts"},
    {id:"email",label:"Email",icon:Mail,enabled:Object.values(prefs).some(t=>t.email),last:"2h ago",hint:"Managed in preferences"},
    {id:"sms",label:"SMS",icon:MessageSquare,enabled:Object.values(prefs).some(t=>t.sms),last:"—",hint:"Managed in preferences"},
    {id:"whatsapp",label:"WhatsApp",icon:AppWindow,enabled:Object.values(prefs).some(t=>t.whatsapp),last:"—",hint:"Managed in preferences"},
    {id:"in_app",label:"In-app",icon:Bell,enabled:true,last:"just now",hint:"Always on"},
  ],[perm,prefs]);
  function inQuietHours(){ const [sh,sm]=push.quietStart.split(":").map(Number); const [eh,em]=push.quietEnd.split(":").map(Number); const d=new Date(); const m=d.getHours()*60+d.getMinutes(); const s=sh*60+sm,e=eh*60+em; return s<=e? m>=s&&m<e : m>=s||m<e; }
  async function requestPush(){
    if(!("Notification" in window)) {toast({title:"Not supported",description:"This browser does not support notifications."}); return;}
    const p = await Notification.requestPermission();
    setPerm(p as Perm);
    toast({title:p==="granted"?"Push enabled":"Permission not granted",description:p==="granted"?"You'll receive push alerts on this device (topic/granularity below).":p==="denied"?"Notifications blocked — see re-permission guidance below.":"You can enable push later."});
  }
  function testSend(){
    if(perm!=="granted") {toast({title:"Enable push first",variant:"destructive" as any}); return;}
    if(inQuietHours()) {toast({title:"Quiet hours active",description:`Test suppressed until ${push.quietEnd} (quiet hours ${push.quietStart}-${push.quietEnd}).`}); return;}
    try{ new Notification("AlphaOne test push",{body:"Demo notification while tab is open. Channel states sync to your marketing preferences."}); setPush(s=>{const n={...s,lastTest:new Date().toISOString()}; savePush(n); return n;}); toast({title:"Test push sent"});}catch{ toast({title:"Test push (simulated)",description:"Notification API blocked in this context; demo recorded."}); }
  }
  function setTopic(topic:MarketingTopic,val:boolean){ setPush(s=>{const n={...s,topicPush:{...s.topicPush,[topic]:val}}; savePush(n); return n;}); }
  return (
    <div className="space-y-6">
      <TerraPageHeader title="Push Opt-In & Channel Status" description="Enable push and manage outreach channels. States sync to your Marketing Preference Center." />
      <div className="flex items-center justify-between"><TerraSectionTitle title="Channel status" /><Button onClick={()=>setExplain(true)}><Smartphone className="mr-1 h-4 w-4"/>Enable push notifications</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map(c=>(<TerraCard key={c.id} className="p-4"><div className="flex items-start gap-3"><c.icon className="h-5 w-5 mt-0.5"/><div className="flex-1"><p className="font-medium text-sm">{c.label}</p><p className="text-xs text-muted-foreground">{c.hint}</p><div className="mt-2 flex items-center gap-2 text-[11px]"><span className={c.enabled?"text-emerald-600":"text-muted-foreground"}>{c.enabled?"Enabled":"Off"}</span><span>· Last: {c.last}</span><span>· Open rate: —</span></div></div></div>{c.id==="push"&&<div className="mt-2 text-[11px]">Permission: <strong>{perm}</strong></div>}</TerraCard>))}
      </div>
      {perm==="denied"&&<TerraCard className="p-4 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"><p className="font-medium text-sm flex items-center gap-2"><Info className="h-4 w-4"/>Re-permission guidance (permanently denied)</p><p className="text-xs mt-1">Notifications are blocked in your browser/OS. Re-enable via: browser site settings → Notifications → Allow for this site (Chrome/Edge: lock icon; Firefox: shield/settings; Safari: Websites → Notifications). After allowing, return and tap Enable push.</p></TerraCard>}
      <TerraSectionTitle title="Quiet hours & per-topic push (syncs to your preferences)" />
      <TerraCard className="p-4 space-y-3 text-sm">
        <div className="flex items-center gap-3 flex-wrap"><Clock className="h-4 w-4"/><span>Quiet hours</span><input type="time" value={push.quietStart} onChange={e=>setPush(s=>{const n={...s,quietStart:e.target.value}; savePush(n); return n;})} className="rounded border px-2 py-1 text-xs bg-transparent"/><span>to</span><input type="time" value={push.quietEnd} onChange={e=>setPush(s=>{const n={...s,quietEnd:e.target.value}; savePush(n); return n;})} className="rounded border px-2 py-1 text-xs bg-transparent"/><span className="text-xs text-muted-foreground">{inQuietHours()?"Currently in quiet hours (test sends suppressed).":"Outside quiet hours."}</span></div>
        <div className="space-y-2">{(Object.keys(TOPIC_LABEL) as MarketingTopic[]).map(t=>(<div key={t} className="flex items-center justify-between rounded border p-2"><span className="text-sm">{TOPIC_LABEL[t]} (push)</span><Switch checked={!!push.topicPush[t]} onCheckedChange={v=>setTopic(t,!!v)} disabled={perm!=="granted"}/></div>))}</div>
        <p className="text-xs text-muted-foreground">Denying push blocks topic pushes but not email/SMS/WhatsApp/in-app (managed in Marketing Preferences). Channel states sync to your marketing preferences.</p>
      </TerraCard>
      <div className="flex gap-2"><Button variant="outline" onClick={testSend}><Send className="mr-1 h-4 w-4"/>Send test push</Button><Button variant="ghost" onClick={()=>toast({title:"Synced",description:"Channel/topic states reflected in your Marketing Preference Center."})}>Sync to preferences</Button></div>
      <Sheet open={explain} onOpenChange={setExplain}><SheetContent><SheetHeader><SheetTitle>Enable push notifications</SheetTitle><SheetDescription>Pre-prompt explainer (why/what/when) before the OS/browser prompt.</SheetDescription></SheetHeader>
        <div className="mt-4 space-y-3 text-sm"><p><strong>Why:</strong> Get time-sensitive alerts (payout status, risk notices, challenge milestones).</p><p><strong>What:</strong> You control topics and quiet hours below. No marketing pushes unless you opt in per topic.</p><p><strong>When:</strong> Only outside quiet hours; you can disable anytime. Denying blocks push only (other channels unaffected).</p><Button className="w-full" onClick={async()=>{setExplain(false); await requestPush();}}>Continue to browser prompt</Button></div>
      </SheetContent></Sheet>
    </div>
  );
}
