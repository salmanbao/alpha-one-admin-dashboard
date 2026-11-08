"use client";
/** R2-02 — Forms & Lead Capture list. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Plus } from "lucide-react";
import { listForms, createForm, type FormDef } from "../forms-store";

export function FormsListPage() {
  const { navigate } = usePlatform();
  const [, tick] = useState(0);
  const rows = listForms();
  const [open,setOpen]=useState(false); const [name,setName]=useState("");
  const cols: Column<FormDef>[] = [
    {key:"name",header:"Form",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>navigate("form-editor",{id:r.id})}>{r.name}</button>},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={r.status==="published"?"success":"warning"}>{r.status}</StatusBadge>},
    {key:"embed",header:"Embed target",cell:r=><span className="text-xs">{r.embedTarget}</span>},
    {key:"sub",header:"Submissions",numeric:true,cell:r=>r.submissions.toLocaleString()},
    {key:"conv",header:"Conversion",numeric:true,cell:r=>r.conversion?`${r.conversion}%`:"—"},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>navigate("form-editor",{id:r.id})}>Edit</Button>},
  ];
  return (
    <Page>
      <PageHeader title="Forms & Lead Capture" description="Collect leads into CRM, segments and flows with consent receipts. Embed in landing pages, popups or external sites." icon={ClipboardList}
        actions={<Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-1 h-4 w-4"/>New Form</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Forms" value={String(rows.length)} /><MetricCard label="Submissions (total)" value={rows.reduce((s,r)=>s+r.submissions,0).toLocaleString()} tone="positive" /><MetricCard label="Published" value={String(rows.filter(r=>r.status==="published").length)} /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.name} ${r.embedTarget}`} />
      </PageContent>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New form</DialogTitle></DialogHeader>
        <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Form name" />
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={()=>{const rec=createForm(name.trim()); recordAudit({action:"form.create",entity:"form",entityId:rec.id,summary:`Created form ${rec.name}.`,module:"marketing"}); toast({title:"Form created"}); setOpen(false); setName(""); tick(n=>n+1); navigate("form-editor",{id:rec.id});}}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
    </Page>
  );
}
