"use client";

/**
 * M5.4 — Attribution Settings (spec §9.4).
 * Model selection, UTM convention builder and a recalculation flow
 * that makes ROI reporting defensible.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { GitBranch, RefreshCw, Link2, Info } from "lucide-react";

const MODELS = [
  { id:"last_click", name:"Last click", desc:"100% credit to the final touchpoint before conversion. Simple, biased toward bottom-funnel." },
  { id:"first_click", name:"First click", desc:"100% credit to the first touchpoint. Highlights acquisition channels." },
  { id:"linear", name:"Linear", desc:"Equal credit across every touchpoint in the path." },
  { id:"time_decay", name:"Time decay", desc:"More credit to touches closer to conversion (7-day half-life)." },
  { id:"data_driven", name:"Data-driven", desc:"Algorithmic credit based on observed lift (requires sufficient volume)." },
] as const;

export function AttributionSettingsPage() {
  const [model, setModel] = useState<string>("last_click");
  const [windowDays, setWindowDays] = useState("30");
  const [utm, setUtm] = useState({ source:"{platform}", medium:"cpc", campaign:"{campaign_name}", content:"{ad_name}", term:"{keyword}" });
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalcPct, setRecalcPct] = useState(0);
  const [running, setRunning] = useState(false);

  function save(){
    recordAudit({action:"attribution.settings",entity:"attribution",summary:`Attribution model → ${model}, window ${windowDays}d, UTM convention updated.`,module:"marketing"});
    toast({title:"Attribution settings saved",description:`Model: ${MODELS.find(m=>m.id===model)?.name}. Applies to new reporting; run recalculation for history.`});
  }
  function runRecalc(){
    setRunning(true); setRecalcPct(0);
    const iv = setInterval(()=>setRecalcPct(p=>{ if(p>=100){ clearInterval(iv); setRunning(false); recordAudit({action:"attribution.recalc",entity:"attribution",summary:`Recalculated attribution under ${model} (${windowDays}d window).`,module:"marketing"}); toast({title:"Recalculation complete",description:`Historical conversions re-attributed using ${MODELS.find(m=>m.id===model)?.name}.`}); return 100;} return p+12; }), 220);
  }
  const preview = `https://app.example.com/signup?utm_source=${encodeURIComponent(utm.source)}&utm_medium=${encodeURIComponent(utm.medium)}&utm_campaign=${encodeURIComponent(utm.campaign)}&utm_content=${encodeURIComponent(utm.content)}&utm_term=${encodeURIComponent(utm.term)}`;

  return (
    <Page>
      <PageHeader title="Attribution Settings" description="Choose how conversions are credited and standardize UTM tagging for defensible ROI." icon={GitBranch}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>{ setRecalcOpen(true); setRecalcPct(0); setRunning(false); }}><RefreshCw className="mr-1 h-4 w-4" />Recalculate</Button><Button size="sm" onClick={save}>Save settings</Button></div>} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Attribution model</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup value={model} onValueChange={setModel} className="space-y-2">
                  {MODELS.map(m=>(
                    <label key={m.id} className={`flex items-start gap-3 rounded-lg border p-3 ${model===m.id?"border-primary bg-primary/5":""}`}>
                      <RadioGroupItem value={m.id} className="mt-0.5" />
                      <span><span className="block text-sm font-medium">{m.name}{m.id==="data_driven"&&<Badge variant="secondary" className="ml-1 text-[9px]">needs volume</Badge>}</span><span className="text-xs text-muted-foreground">{m.desc}</span></span>
                    </label>
                  ))}
                </RadioGroup>
                <div className="mt-3 flex items-center gap-2"><Label className="text-xs">Lookback window (days)</Label><Input value={windowDays} onChange={e=>setWindowDays(e.target.value)} className="h-8 w-24 text-xs" type="number" min={1} max={90} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1.5"><Link2 className="h-4 w-4" />UTM convention builder</CardTitle><p className="text-xs text-muted-foreground">Standardize tagging so auto-ingested spend maps cleanly to conversions. Tokens like {"{platform}"} are filled by the ad connector.</p></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {(["source","medium","campaign","content","term"] as const).map(k=>(
                  <div key={k}><Label className="text-[11px] uppercase">utm_{k}</Label><Input value={utm[k]} onChange={e=>setUtm({...utm,[k]:e.target.value})} className="mt-1 h-8 font-mono text-xs" /></div>
                ))}
                <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-2"><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Preview URL</p><code className="block break-all text-[10px]">{preview}</code></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card><CardContent className="p-4 text-sm space-y-2"><div className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">How recalculation works</p><p className="text-xs text-muted-foreground">Changing the model affects new reports immediately. Historical conversions keep their stored credit until you run a recalculation, which re-attributes the selected window using the chosen model and writes an audit entry. Large windows run as a background job (simulated).</p></div></div>
              <p className="text-xs"><span className="text-muted-foreground">Current model:</span> <strong>{MODELS.find(m=>m.id===model)?.name}</strong> · {windowDays}-day window</p>
            </CardContent></Card>
          </div>
        </div>
      </PageContent>

      <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
        <DialogContent><DialogHeader><DialogTitle>Recalculate attribution</DialogTitle><DialogDescription>Re-attribute conversions in the {windowDays}-day window using <strong>{MODELS.find(m=>m.id===model)?.name}</strong>. Stored credits update; this is audited.</DialogDescription></DialogHeader>
          {running || recalcPct>0 ? <div className="space-y-2"><Progress value={recalcPct} /><p className="text-xs text-muted-foreground">{recalcPct<100?`Processing… ${recalcPct}%`:"Complete."}</p></div> : <p className="text-sm text-muted-foreground">This may take a moment for large datasets. You can continue working; a toast confirms completion.</p>}
          <DialogFooter><Button variant="outline" onClick={()=>setRecalcOpen(false)} disabled={running}>Close</Button><Button onClick={runRecalc} disabled={running || recalcPct===100}>{recalcPct===100?"Done":"Start recalculation"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
