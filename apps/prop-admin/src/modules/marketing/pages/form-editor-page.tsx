"use client";
/** R2-02 — Form Editor. Field palette, canvas, validation/conditional logic, submission routing (CRM/segment/webhook/flow), consent capture, embed snippets. */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Save, Eye, Code } from "lucide-react";
import { getForm, saveForm, listForms } from "../forms-store";

const PALETTE = ["name","email","phone","country","experience level","account size intent","consent checkbox","hidden/UTM"];
export function FormEditorPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id || listForms()[0]?.id;
  const base = useMemo(()=> id? getForm(id): undefined,[id]);
  const [form,setForm]=useState(base);
  const [embed,setEmbed]=useState(false);
  if(!form) return <Page><PageContent><p className="text-sm text-muted-foreground">No form. <button className="underline" onClick={()=>navigate("forms")}>Back</button></p></PageContent></Page>;
  function addField(type:string){ setForm(f=>f?{...f,fields:[...f.fields,{id:`f${Date.now()}`,type,label:type,required:type==="email"||type==="consent checkbox"}]}:f); }
  function save(){ if(!form) return; saveForm(form); recordAudit({action:"form.save",entity:"form",entityId:form.id,summary:`Saved form ${form.name} (routing: CRM ${form.routing.createCrm}, consent ${form.routing.consentCapture}).`,module:"marketing"}); toast({title:"Form saved",description:"Client+server validation/conditional logic enforced on publish (dummy)."}); }
  return (
    <Page>
      <PageHeader title={`Form: ${form.name}`} description={`${form.submissions} submissions · ${form.embedTarget}`} icon={ClipboardList}
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setEmbed(true)}><Code className="mr-1 h-4 w-4"/>Embed</Button><Button variant="outline" size="sm" onClick={()=>toast({title:"Preview",description:"Form preview with validation (dummy)."})}><Eye className="mr-1 h-4 w-4"/>Preview</Button><Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4"/>Save</Button></div>} />
      <PageContent>
        <div className="grid gap-3 lg:grid-cols-[200px_1fr_280px]">
          <Card><CardContent className="p-2 space-y-1"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Field palette</p>{PALETTE.map(b=><button key={b} type="button" className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted" onClick={()=>addField(b)}>+ {b}</button>)}</CardContent></Card>
          <Card><CardContent className="p-3 space-y-2"><p className="text-[10px] text-muted-foreground">Canvas — drag-ordered fields; conditional logic: show field B when A=value</p>{form.fields.map((f,i)=><div key={f.id} className="rounded border p-2 text-xs flex items-center justify-between"><span><strong>{i+1}. {f.label}</strong> <span className="text-muted-foreground">({f.type})</span>{f.required&&<Badge variant="secondary" className="ml-1 text-[9px]">required</Badge>}{f.condition&&<Badge variant="outline" className="ml-1 text-[9px]">if {f.condition}</Badge>}</span><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>toast({title:"Conditional logic",description:"Show/hide rules + validation (enforced client+server)."})}>Rules</Button></div>)}
            <div className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">Spam protection: honeypot + rate limit. UTM params pass through to contact record (R2-06).</div>
          </CardContent></Card>
          <Card><CardContent className="p-2 space-y-2 text-xs"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Submission routing</p>
            <label className="flex items-center gap-2"><Checkbox checked={form.routing.createCrm} onCheckedChange={v=>setForm({...form,routing:{...form.routing,createCrm:!!v}})} />Create/update CRM contact</label>
            <label className="flex items-center gap-2"><Checkbox checked={form.routing.consentCapture} onCheckedChange={v=>setForm({...form,routing:{...form.routing,consentCapture:!!v}})} />Capture consent receipt (N10, timestamped)</label>
            <div><label className="text-[10px]">Add to segment</label><Input value={form.routing.segment??""} onChange={e=>setForm({...form,routing:{...form.routing,segment:e.target.value}})} className="h-7 text-xs mt-0.5" placeholder="segment name/id" /></div>
            <div><label className="text-[10px]">Enroll in flow (M4)</label><Input value={form.routing.flow??""} onChange={e=>setForm({...form,routing:{...form.routing,flow:e.target.value}})} className="h-7 text-xs mt-0.5" placeholder="flow name" /></div>
            <div><label className="text-[10px]">Fire webhook</label><Input value={form.routing.webhook??""} onChange={e=>setForm({...form,routing:{...form.routing,webhook:e.target.value}})} className="h-7 text-xs mt-0.5" placeholder="https://..." /></div>
            <p className="text-[10px] text-muted-foreground">Submissions appear in drawer and can enroll contacts in automation flows (visible in flow run list).</p>
          </CardContent></Card>
        </div>
      </PageContent>
      {embed&&<Card className="m-4"><CardContent className="p-3 space-y-2 text-xs"><p className="font-semibold">Embed (R2-02 AC-4)</p><p>JS snippet: <code className="bg-muted px-1">{`<script src="https://cdn.alpha.one/forms/${form.id}.js"></script>`}</code></p><p>iframe: <code className="bg-muted px-1">{`<iframe src="/f/${form.id}"></iframe>`}</code></p><p>Direct link (UTM passthrough): <code className="bg-muted px-1">https://alpha.one/f/{form.id}?utm_source=...</code></p><Button size="sm" variant="outline" onClick={()=>{navigator.clipboard?.writeText(`https://alpha.one/f/${form.id}`); toast({title:"Copied"});}}>Copy link</Button> <Button size="sm" variant="ghost" onClick={()=>setEmbed(false)}>Close</Button></CardContent></Card>}
    </Page>
  );
}
