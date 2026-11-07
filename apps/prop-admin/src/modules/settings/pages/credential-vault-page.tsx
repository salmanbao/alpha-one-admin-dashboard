"use client";
/** N12 — Credential Vault UI (Wave 2, P1). Vault refs replace pasted secrets: rotation schedule, last-rotated, access log, connector binding. */
import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { relativeTime, absoluteTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Lock as Vault, RotateCcw, KeyRound, Link2 } from "lucide-react";
import { listVault, rotateVault, type VaultEntry } from "@/modules/marketing/marketing-ops-store";

export function CredentialVaultPage() {
  const [, tick] = useState(0);
  const rows = listVault();
  const [detail, setDetail] = useState<VaultEntry|null>(null);
  const cols: Column<VaultEntry>[] = [
    {key:"name",header:"Credential",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>setDetail(r)}>{r.name}<span className="block text-[10px] text-muted-foreground font-normal">{r.provider} · {r.kind}</span></button>},
    {key:"status",header:"Status",cell:r=><StatusBadge tone={r.status==="active"?"success":r.status==="rotating"?"warning":"danger"}>{r.status}</StatusBadge>},
    {key:"rot",header:"Last rotated",sortValue:r=>r.rotatedAt,cell:r=><span className="text-xs">{relativeTime(r.rotatedAt)}</span>},
    {key:"sched",header:"Schedule",cell:r=><span className="text-xs">{r.schedule}</span>},
    {key:"bind",header:"Bound to",cell:r=><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" />{r.boundTo.join(", ")||"—"}</span>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>{rotateVault(r.id); recordAudit({action:"vault.rotate",entity:"vault",entityId:r.id,summary:`Rotated ${r.name}.`,severity:"warning",module:"settings"}); toast({title:"Rotation initiated",description:`${r.name} is rotating. Connectors use the new ref on next refresh.`}); tick(n=>n+1);}}><RotateCcw className="mr-1 h-3 w-3" />Rotate</Button>},
  ];
  return (
    <Page>
      <PageHeader title="Credential Vault" description="Vault references replace pasted secrets. Rotation schedules, access logs, and connector bindings." icon={Vault} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Credentials" value={String(rows.length)} />
          <MetricCard label="Active" value={String(rows.filter(r=>r.status==="active").length)} tone="positive" />
          <MetricCard label="Rotating now" value={String(rows.filter(r=>r.status==="rotating").length)} tone="warning" />
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" />Connector config secret fields reference vault entries (e.g. <code>vault/email/sendgrid</code>) instead of holding raw values (addresses F-08).</p>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8} />
      </PageContent>
      <Sheet open={!!detail} onOpenChange={o=>!o&&setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {detail&&<><SheetHeader><SheetTitle>{detail.name}</SheetTitle><SheetDescription>{detail.provider} · {detail.kind} · {detail.schedule}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="rounded border p-2 text-xs"><p className="text-muted-foreground">Last rotated</p><p className="font-medium">{absoluteTime(detail.rotatedAt)}</p></div>
              <div className="rounded border p-2 text-xs"><p className="text-muted-foreground">Bound connectors</p><p className="font-mono">{detail.boundTo.join(", ")||"None"}</p></div>
              <div className="rounded border p-2"><p className="mb-1 text-xs font-semibold">Access log</p>{detail.accessLog.length===0?<p className="text-xs text-muted-foreground">No recent access.</p>:<ul className="space-y-1 text-[11px]">{detail.accessLog.map((a,i)=><li key={i}>{relativeTime(a.ts)} · {a.action} <span className="text-muted-foreground">({a.actor})</span></li>)}</ul>}</div>
              <Button className="w-full" variant="outline" onClick={()=>{rotateVault(detail.id); recordAudit({action:"vault.rotate",entity:"vault",entityId:detail.id,summary:`Rotated ${detail.name}.`,severity:"warning",module:"settings"}); toast({title:"Rotation initiated"}); setDetail({...detail,status:"rotating",rotatedAt:new Date().toISOString()}); tick(n=>n+1);}}><RotateCcw className="mr-1 h-4 w-4" />Rotate now</Button>
            </div></>}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
