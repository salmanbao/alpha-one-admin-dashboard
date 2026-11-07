"use client";
/** N7 — A/B Test Builder & Results (Wave 2, P1). Variants (2-4), split, winner criterion, auto-promote/manual pick, significance indication. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";
import { FlaskConical, Trophy } from "lucide-react";
import { listAB, promoteWinner } from "../marketing-ops-store";

export function CampaignABPage() {
  const [, tick] = useState(0);
  const tests = listAB();
  const test = tests[0];
  function rate(v:{impressions:number;clicks:number;conversions:number}, c:string){ if(c==="open_rate") return ((v.clicks/Math.max(1,v.impressions))*100*1.6); if(c==="click_rate") return (v.clicks/Math.max(1,v.impressions))*100; return (v.conversions/Math.max(1,v.impressions))*100; }
  const winner = test ? test.variants.reduce((a,b)=> rate(a,test.criterion)>rate(b,test.criterion)?a:b) : null;
  return (
    <Page>
      <PageHeader title="A/B Test Builder & Results" description="Define 2–4 variants, split, winner criterion (open/click/conversion), auto-promote or manual pick." icon={FlaskConical} />
      <PageContent>
        {!test ? <p className="text-sm text-muted-foreground">No tests. Create variants from the Campaign Composer (A/B mode).</p> : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Test" value={test.name} />
              <MetricCard label="Criterion" value={test.criterion.replace("_"," ")} />
              <MetricCard label="Status" value={test.status} tone={test.status==="running"?"info":"positive"} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {test.variants.map(v=>{
                const r = rate(v,test.criterion);
                const isWin = winner?.id===v.id;
                const conf = Math.min(99, Math.round(60 + (r/Math.max(0.1, rate(test.variants.find(x=>x.id!==v.id)||v,test.criterion))*18)));
                return (
                  <Card key={v.id} className={isWin&&test.status==="completed"?"border-emerald-400":""}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{v.name} {isWin&&<StatusBadge tone="success"><Trophy className="mr-1 h-3 w-3 inline" />leader</StatusBadge>}</CardTitle><p className="text-xs text-muted-foreground">Split {v.split}% · {v.impressions.toLocaleString()} impressions</p></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded border p-2"><p className="text-muted-foreground">Clicks</p><p className="font-semibold">{v.clicks.toLocaleString()}</p></div><div className="rounded border p-2"><p className="text-muted-foreground">Conversions</p><p className="font-semibold">{v.conversions}</p></div><div className="rounded border p-2"><p className="text-muted-foreground">Rate</p><p className="font-semibold">{r.toFixed(2)}%</p></div></div>
                      <div><p className="text-[11px] text-muted-foreground mb-1">Confidence (indicative): {conf}%</p><Progress value={conf} /></div>
                      <Button size="sm" variant={test.winner===v.id?"default":"outline"} disabled={test.status==="completed"} onClick={()=>{ promoteWinner(test.id,v.id); recordAudit({action:"ab.promote",entity:"ab-test",entityId:test.id,summary:`Promoted variant ${v.name} to full send.`,module:"marketing"}); toast({title:"Winner promoted",description:`${v.name} promoted to 100% send.`}); tick(n=>n+1); }}>Promote to full send</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">Auto-promote: {test.autoPromote?"on":"off"}. Significance is indicative (dummy). In production the gateway waits for the configured duration/sample before declaring a winner.</p>
          </div>
        )}
      </PageContent>
    </Page>
  );
}
