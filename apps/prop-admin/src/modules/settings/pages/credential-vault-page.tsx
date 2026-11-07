"use client";
/** N12 — Credential Vault UI (depth R2-F06: CRUD, masked reveal/break-glass, rotation scheduling, usage map). */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Lock as Vault, RotateCcw, KeyRound, Link2, Plus, Eye, Trash2, CalendarClock } from "lucide-react";
import { listVault, rotateVault, createVaultEntry, updateVaultEntry, deleteVaultEntry, revealVault, type VaultEntry } from "@/modules/marketing/marketing-ops-store";

export function CredentialVaultPage() {
  const [, tick] = useState(0);
  const rows = listVault();
  const [detail, setDetail] = useState<VaultEntry|null>(null);
  const [create,setCreate]=useState(false);
  const [reveal,setReveal]=useState<{id:string;name:string}|null>(null);
  const [reason,setReason]=useState("");
  const [del,setDel]=useState<VaultEntry|null>(null);
  const [form,setForm]=useState({name:"",provider:"",kind:"api_key" as VaultEntry["kind"],schedule:"90 days",boundTo:""});
  const cols: Column<VaultEntry>[] = [
    {key:"name",header:"Credential",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.name}<span className="block text-[10px] text-muted-foreground font-normal">{r.provider} · {r.kind} · {r.masked}</span></button>},
    {key:"status",header:"Status",cell:r=><StatusBadge tone={r.status==="active"?"success":r.status==="rotating"||r.status==="scheduled"?"warning":"danger"}>{r.status}</StatusBadge>},
    {key:"rot",header:"Last/next rotation",sortValue:r=>r.rotatedAt,cell:r=><span className="text-xs">{relativeTime(r.rotatedAt)}<span className="block text-[10px] text-muted-foreground">next: {r.nextRotation?relativeTime(r.nextRotation):"—"}</span></span>},
    {key:"sched",header:"Schedule",cell:r=><span className="text-xs flex items-center gap-1"><CalendarClock className="h-3 w-3"/>{r.schedule}</span>},
    {key:"bind",header:"Usage map",cell:r=><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" />{r.usageMap?.length||0} binding(s)</span>},
    {key:"a",header:"",cell:r=><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={()=>setReveal({id:r.id,name:r.name})}><Eye className="mr-1 h-3 w-3"/>Reveal</Button><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{rotateVault(r.id); recordAudit({action:"vault.rotate",entity:"vault",entityId:r.id,summary:`Rotated ${r.name}.`,severity:"warning",module:"settings"}); toast({title:"Rotation initiated"}); tick(n=>n+1);}}><RotateCcw className="mr-1 h-3 w-3" />Rotate</Button></div>},
  ];
  return (
    <Page>
      <PageHeader title="Credential Vault" description="Vault refs replace pasted secrets. CRUD, masked reveal (break-glass, audited), rotation scheduling, and usage map." icon={Vault}
        actions={<Button size="sm" onClick={()=>setCreate(true)}><Plus className="mr-1 h-4 w-4"/>Add credential</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Credentials" value={String(rows.length)} />
          <MetricCard label="Active" value={String(rows.filter(r=>r.status==="active").length)} tone="positive" />
          <MetricCard label="Rotating/scheduled" value={String(rows.filter(r=>r.status==="rotating"||r.status==="scheduled").length)} tone="warning" />
          <MetricCard label="Break-glass events" value={String(rows.reduce((s,r)=>s+r.accessLog.filter(a=>a.action.includes("BREAK-GLASS")).length,0))} tone="warning" />
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" />Secrets are stored as vault refs (e.g. <code>vault/email/sendgrid</code>). Raw values are never shown in normal UI (R2-F06 / F-08).</p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} />
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail&&<><SheetHeader><SheetTitle>{detail.name}</SheetTitle><SheetDescription>{detail.provider} · {detail.kind} · {detail.masked}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3 text-xs">
              <Card><CardContent className="p-2 grid grid-cols-2 gap-2"><div><p className="text-muted-foreground">Last rotated</p><p className="font-medium">{absoluteTime(detail.rotatedAt)}</p></div><div><p className="text-muted-foreground">Next rotation</p><p className="font-medium">{detail.nextRotation?absoluteTime(detail.nextRotation):"—"}</p></div></CardContent></Card>
              <Card><CardContent className="p-2 space-y-2"><p className="font-semibold">Rotation scheduling</p><Select value={detail.schedule} onValueChange={v=>{updateVaultEntry(detail.id,{schedule:v}); recordAudit({action:"vault.schedule",entity:"vault",entityId:detail.id,summary:`Set rotation schedule ${v} for ${detail.name}.`,module:"settings"}); setDetail({...detail,schedule:v}); tick(n=>n+1);}}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent>{["30 days","60 days","90 days","180 days","Manual only"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></CardContent></Card>
              <Card><CardContent className="p-2"><p className="font-semibold mb-1">Usage map (where bound)</p>{(detail.usageMap||[]).length===0?<p className="text-muted-foreground">No bindings.</p>:<ul className="space-y-1">{(detail.usageMap||[]).map((u,i)=><li key={i} className="rounded border p-1 font-mono">{u.system} → {u.ref}</li>)}</ul>}<p className="mt-1 text-muted-foreground">Bound connectors: {detail.boundTo.join(", ")||"—"}</p></CardContent></Card>
              <Card><CardContent className="p-2"><p className="font-semibold mb-1">Access log (audited)</p><ul className="space-y-1">{detail.accessLog.map((a,i)=><li key={i}>{relativeTime(a.ts)} · <strong>{a.actor}</strong>: {a.action}</li>)}</ul></CardContent></Card>
              <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={()=>{rotateVault(detail.id); recordAudit({action:"vault.rotate",entity:"vault",entityId:detail.id,summary:`Rotated ${detail.name}.`,severity:"warning",module:"settings"}); toast({title:"Rotation initiated"}); setDetail({...detail,status:"rotating",rotatedAt:new Date().toISOString()}); tick(n=>n+1);}}><RotateCcw className="mr-1 h-4 w-4"/>Rotate now</Button><Button variant="destructive" onClick={()=>setDel(detail)}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button></div>
            </div></>}
        </SheetContent>
      </Sheet>
      <Dialog open={create} onOpenChange={setCreate}><DialogContent><DialogHeader><DialogTitle>Add credential</DialogTitle><DialogDescription>Value is stored as a vault reference; raw secret is not retained in the UI.</DialogDescription></DialogHeader>
        <div className="space-y-2 text-xs"><Input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><Input placeholder="Provider" value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}/>
          <Select value={form.kind} onValueChange={v=>setForm({...form,kind:v as any})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["api_key","oauth","cert","webhook_secret"].map(k=><SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
          <Select value={form.schedule} onValueChange={v=>setForm({...form,schedule:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["30 days","60 days","90 days","180 days","Manual only"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Secret value (ingested once, then masked)" type="password" /><Input placeholder="Bound to (comma-separated connector refs)" value={form.boundTo} onChange={e=>setForm({...form,boundTo:e.target.value})}/></div>
        <DialogFooter><Button variant="outline" onClick={()=>setCreate(false)}>Cancel</Button><Button disabled={!form.name.trim()} onClick={()=>{const rec=createVaultEntry({name:form.name,provider:form.provider||"Custom",kind:form.kind,rotatedAt:new Date().toISOString(),schedule:form.schedule,boundTo:form.boundTo?form.boundTo.split(",").map(s=>s.trim()):[],usageMap:[],breakGlass:false}); recordAudit({action:"vault.create",entity:"vault",entityId:rec.id,summary:`Created vault credential ${rec.name} (${rec.kind}).`,module:"settings"}); toast({title:"Credential created",description:"Stored as vault ref."}); setCreate(false); setForm({name:"",provider:"",kind:"api_key",schedule:"90 days",boundTo:""}); tick(n=>n+1);}}>Create</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={!!reveal} onOpenChange={o=>!o&&setReveal(null)}><DialogContent><DialogHeader><DialogTitle>Break-glass reveal</DialogTitle><DialogDescription>Revealing a secret is audited and should be rare. Provide a reason.</DialogDescription></DialogHeader>
        <Textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for reveal (required)" rows={3}/>
        <DialogFooter><Button variant="outline" onClick={()=>setReveal(null)}>Cancel</Button><Button variant="destructive" disabled={!reason.trim()} onClick={()=>{if(!reveal)return; const val=revealVault(reveal.id,reason); recordAudit({action:"vault.reveal",entity:"vault",entityId:reveal.id,summary:`BREAK-GLASS reveal: ${reason}`,severity:"warning",module:"settings"}); toast({title:"Reveal (secure channel)",description:val}); setReveal(null); setReason(""); tick(n=>n+1);}}>Reveal (audited)</Button></DialogFooter>
      </DialogContent></Dialog>
      <AlertDialog open={!!del} onOpenChange={o=>!o&&setDel(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete credential?</AlertDialogTitle><AlertDialogDescription>Bound connectors will break until rebound. This is audited.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>{if(!del)return; deleteVaultEntry(del.id); recordAudit({action:"vault.delete",entity:"vault",entityId:del.id,summary:`Deleted vault credential ${del.name}.`,severity:"warning",module:"settings"}); toast({title:"Deleted"}); setDel(null); setDetail(null); tick(n=>n+1);}}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Page>
  );
}
