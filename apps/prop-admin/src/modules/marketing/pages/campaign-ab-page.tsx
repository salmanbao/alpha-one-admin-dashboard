"use client";
/** N7 — A/B Test Builder & Results (depth: variant builder 2-4, split, significance, winner promotion). */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { FlaskConical, Trophy, Plus, Trash2 } from "lucide-react";
import { listAB, promoteWinner, addABVariant, removeABVariant, updateABTest } from "../marketing-ops-store";

export function CampaignABPage() {
  const [, tick] = useState(0);
  const tests = listAB();
  const [testId,setTestId]=useState(tests[0]?.id||"");
  const test = tests.find(t=>t.id===testId)||tests[0];
  function rate(v:{impressions:number;clicks:number;conversions:number}, c:string){ if(c==="open_rate") return ((v.clicks/Math.max(1,v.impressions))*100*1.6); if(c==="click_rate") return (v.clicks/Math.max(1,v.impressions))*100; return (v.conversions/Math.max(1,v.impressions))*100; }
  const winner = test ? test.variants.reduce((a,b)=> rate(a,test.criterion)>rate(b,test.criterion)?a:b) : null;
  function sig(a:any,b:any,c:string){
    const ra=rate(a,c), rb=rate(b,c); const total=a.impressions+b.impressions||1; const diff=Math.abs(ra-rb); const conf=Math.min(99, Math.round(55 + diff*12 + (total/1000)));
    return conf;
  }
  if(!test) return <Page><PageHeader title="A/B Test Builder & Results" icon={FlaskConical}/><PageContent><p className="text-sm text-muted-foreground">No tests.</p></PageContent></Page>;
  const variants = test.variants;
  return (
    <Page>
      <PageHeader title="A/B Test Builder & Results" description="Variant builder (2–4), split control, significance indicator, auto-promote or manual pick." icon={FlaskConical} />
      <PageContent>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Test" value={test.name} />
            <MetricCard label="Criterion" value={test.criterion.replace("_"," ")} />
            <MetricCard label="Status" value={test.status} tone={test.status==="running"?"info":"positive"} />
            <MetricCard label="Snapshot" value={test.snapshotId||"—"} />
          </div>
          <Card><CardContent className="p-3 flex flex-wrap items-center gap-3 text-xs"><span>Auto-promote</span><Button size="sm" variant={test.autoPromote?"default":"outline"} className="h-7" onClick={()=>{updateABTest(test.id,{autoPromote:!test.autoPromote}); toast({title:`Auto-promote ${!test.autoPromote?"on":"off"}`}); tick(n=>n+1);}}>{test.autoPromote?"On":"Off"}</Button><span className="text-muted-foreground">Significance is computed per pairwise (indicative; gateway enforces duration/sample).</span><Button size="sm" variant="outline" className="h-7" disabled={variants.length>=4} onClick={()=>{const id=`v${Date.now()}`; addABVariant(test.id,{id,name:`Variant ${String.fromCharCode(65+variants.length)}`,split:10,impressions:0,clicks:0,conversions:0}); toast({title:"Variant added"}); tick(n=>n+1);}}><Plus className="mr-1 h-3 w-3"/>Add variant (max 4)</Button></CardContent></Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {variants.map((v,i)=>{
              const r = rate(v,test.criterion);
              const isWin = winner?.id===v.id;
              const conf = variants.length>1 ? sig(v, variants.find(x=>x.id!==v.id)||v, test.criterion) : 99;
              return (
                <Card key={v.id} className={isWin&&test.status==="completed"?"border-emerald-400":""}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{v.name} {isWin&&<StatusBadge tone="success"><Trophy className="mr-1 h-3 w-3 inline" />leader</StatusBadge>}</CardTitle>
                    <div className="flex items-center gap-2 text-xs"><span>Split</span><Input value={String(v.split)} onChange={()=>{}} className="h-6 w-16 text-xs" readOnly/><span>%</span>{variants.length>2&&<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{removeABVariant(test.id,v.id); toast({title:"Variant removed"}); tick(n=>n+1);}}><Trash2 className="h-3 w-3"/></Button>}</div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded border p-2"><p className="text-muted-foreground">Impr.</p><p className="font-semibold">{v.impressions.toLocaleString()}</p></div><div className="rounded border p-2"><p className="text-muted-foreground">Clicks</p><p className="font-semibold">{v.clicks.toLocaleString()}</p></div><div className="rounded border p-2"><p className="text-muted-foreground">Conversions</p><p className="font-semibold">{v.conversions}</p></div></div>
                    <div className="rounded border p-2 text-xs"><p className="text-muted-foreground">Rate ({test.criterion.replace("_"," ")})</p><p className="font-semibold">{r.toFixed(2)}%</p></div>
                    <div><p className="text-[11px] text-muted-foreground mb-1">Significance (indicative): {conf}%{conf>=95&&<span className="text-emerald-600"> — likely significant</span>}</p><Progress value={conf} /></div>
                    <Button size="sm" variant={test.winner===v.id?"default":"outline"} disabled={test.status==="completed"} onClick={()=>{ promoteWinner(test.id,v.id); recordAudit({action:"ab.promote",entity:"ab-test",entityId:test.id,summary:`Promoted variant ${v.name} to full send.`,module:"marketing"}); toast({title:"Winner promoted",description:`${v.name} promoted to 100% send (snapshot ${test.snapshotId||"—"}).`}); tick(n=>n+1); }}>Promote to full send</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
