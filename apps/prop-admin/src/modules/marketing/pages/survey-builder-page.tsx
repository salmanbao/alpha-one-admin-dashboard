"use client";
/** R2-05 — Survey Builder + Responses (screen 2). Question editor + skip logic, distribution, responses (score dist, verbatim+sentiment, create segment). */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Save, Plus, Users } from "lucide-react";
import { getSurvey, listSurveys, saveSurvey, addQuestion, removeQuestion, segmentFromResponses, type Survey } from "../surveys-store";

const QTYPES=["rating","multiple_choice","free_text"] as const;
export function SurveyBuilderPage(){
  const { router, navigate } = usePlatform();
  const id = router.params.id || listSurveys()[0]?.id;
  const base=useMemo(()=> id? getSurvey(id):undefined,[id]);
  const [s,setS]=useState(base);
  const [,tick]=useState(0);
  if(!s) return <Page><PageContent><p className="text-sm text-muted-foreground">No survey. <button className="underline" onClick={()=>navigate("surveys")}>Back</button></p></PageContent></Page>;
  const resp=s.respList;
  const dist={detractor:resp.filter(r=>r.sentiment==="detractor").length,passive:resp.filter(r=>r.sentiment==="passive").length,promoter:resp.filter(r=>r.sentiment==="promoter").length};
  const nps=resp.length? Math.round(((dist.promoter-dist.detractor)/resp.length)*100) : null;
  return (
    <Page>
      <PageHeader title={`Survey: ${s.name}`} description={`${s.type} · ${s.channel} · ${s.status} · trigger ${s.trigger.event||"—"} · segment ${s.segment||"all"}`} icon={ClipboardList}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>toast({title:"Preview",description:"Live survey preview (dummy)."})}>Preview</Button><Button size="sm" onClick={()=>{saveSurvey(s); recordAudit({action:"survey.save",entity:"survey",entityId:s.id,summary:`Saved ${s.name} (${s.questions.length} q, trigger ${s.trigger.event||"—"})`,module:"marketing"}); toast({title:"Saved"});}}><Save className="mr-1 h-4 w-4"/>Save</Button></div>} />
      <PageContent>
        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <Tabs defaultValue="builder"><TabsList><TabsTrigger value="builder">Builder</TabsTrigger><TabsTrigger value="responses">Responses ({resp.length})</TabsTrigger></TabsList>
            <TabsContent value="builder" className="mt-3 space-y-3">
              <Card><CardContent className="p-3 space-y-2 text-xs"><p className="font-semibold">Distribution (AC-1: triggered after payout event delivers via email)</p><div className="grid sm:grid-cols-3 gap-2"><div><label className="text-[10px]">Trigger event</label><Input value={s.trigger.event||""} onChange={e=>{setS({...s,trigger:{...s.trigger,event:e.target.value}});}} placeholder="e.g. payout_completed" className="h-7 mt-0.5"/></div><div><label className="text-[10px]">Milestone</label><Input value={s.trigger.milestone||""} onChange={e=>setS({...s,trigger:{...s.trigger,milestone:e.target.value}})} placeholder="e.g. first payout" className="h-7 mt-0.5"/></div><div><label className="text-[10px]">Audience segment</label><Input value={s.segment||""} onChange={e=>setS({...s,segment:e.target.value})} placeholder="segment (M3)" className="h-7 mt-0.5"/></div></div><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={s.anonymousMode} onChange={e=>setS({...s,anonymousMode:e.target.checked})}/>Anonymous mode (flagged in consent receipt — AC-3)</label></CardContent></Card>
              <Card><CardContent className="p-3 space-y-2"><p className="font-semibold text-xs">Questions (skip logic: show field B when A = value)</p>{s.questions.length===0&&<p className="text-xs text-muted-foreground">No questions yet.</p>}{s.questions.map((q,i)=><div key={q.id} className="rounded border p-2 text-xs"><div className="flex items-center justify-between"><span><strong>{i+1}. {q.text}</strong> <StatusBadge tone="muted">{q.type}</StatusBadge>{q.required&&<StatusBadge tone="warning">required</StatusBadge>}</span><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>{removeQuestion(s.id,q.id); setS({...s,questions:s.questions.filter(x=>x.id!==q.id)}); tick(n=>n+1);}}>Remove</Button></div>{q.showIf&&<p className="text-[10px] text-muted-foreground mt-1">if {q.showIf}</p>}</div>)}<div className="flex gap-2"><Select onValueChange={v=>{addQuestion(s.id,{type:v as any,text:"New question",required:false,scale:v==="rating"?{min:0,max:10}:undefined,options:v==="multiple_choice"?["Option A","Option B"]:undefined}); setS(getSurvey(s.id)); tick(n=>n+1);}}><SelectTrigger className="w-48 h-8"><SelectValue placeholder="Add question"/></SelectTrigger><SelectContent>{QTYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
            </TabsContent>
            <TabsContent value="responses" className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Responses</p><p className="text-xl font-semibold">{resp.length}</p></CardContent></Card><Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">NPS</p><p className="text-xl font-semibold">{nps??"—"}</p></CardContent></Card><Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Promoters</p><p className="text-xl font-semibold">{dist.promoter}</p></CardContent></Card><Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Detractors</p><p className="text-xl font-semibold">{dist.detractor}</p></CardContent></Card></div>
              <Card><CardContent className="p-3 text-xs"><p className="font-semibold mb-2">Score distribution</p><div className="flex gap-2">{(["detractor","passive","promoter"] as const).map(k=><div key={k} className="flex-1"><div className="h-20 flex items-end bg-muted rounded"><div className="w-full rounded-t" style={{height:`${resp.length?Math.round(dist[k]/resp.length*100):0}%`,background:k==="detractor"?"hsl(var(--destructive))":k==="passive"?"hsl(var(--warning))":"hsl(var(--primary))"}}/></div><p className="mt-1 text-center">{k} ({dist[k]})</p></div>)}</div></CardContent></Card>
              <Card><CardContent className="p-3 space-y-2 text-xs"><p className="font-semibold">Verbatim + sentiment</p>{resp.map(r=><div key={r.id} className="rounded border p-2 flex justify-between gap-2"><span>{r.anonymous?<em>Anonymous</em>:r.contact}: {r.answers.q2||"—"}</span><StatusBadge tone={r.sentiment==="detractor"?"danger":r.sentiment==="promoter"?"success":"muted"}>{r.sentiment}</StatusBadge></div>)}{resp.length===0&&<p className="text-muted-foreground">No responses yet.</p>}</CardContent></Card>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{const seg=segmentFromResponses(s.id,"detractor"); recordAudit({action:"survey.segment",entity:"survey",entityId:s.id,summary:`Created segment from detractors: ${seg}`,module:"marketing"}); toast({title:"Segment created",description:`${seg} usable in segment builder (AC-2).`});}}><Users className="mr-1 h-3 w-3"/>Segment: detractors</Button><Button size="sm" variant="outline" onClick={()=>{const seg=segmentFromResponses(s.id,"promoter"); recordAudit({action:"survey.segment",entity:"survey",entityId:s.id,summary:`Created segment from promoters: ${seg}`,module:"marketing"}); toast({title:"Segment created",description:seg});}}><Users className="mr-1 h-3 w-3"/>Segment: promoters</Button></div>
            </TabsContent>
          </Tabs>
          <Card><CardContent className="p-3 space-y-2 text-xs"><p className="font-semibold">Settings</p><Select value={s.status} onValueChange={v=>setS({...s,status:v as any})}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent>{["draft","active","paused","closed"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><p className="text-muted-foreground">On-site delivery uses R2-03 units; email uses R2-04 branded templates. Anonymous mode flagged in consent receipt (N10).</p></CardContent></Card>
        </div>
      </PageContent>
    </Page>
  );
}
