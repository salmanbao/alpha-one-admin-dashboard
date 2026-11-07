"use client";
/** R2-07 — AML & Transaction Monitoring alerts queue. */
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/lib/platform/platform-context";
import { ShieldAlert } from "lucide-react";
import { listAmlAlerts, type AmlCase } from "../aml-store";

const tone = (r:string)=> r==="critical"?"danger":r==="high"?"warning":r==="medium"?"info":"muted";
const stTone = (s:string)=> s==="cleared"?"success":s==="blocked"||s==="sar_filed"?"danger":s==="escalated"?"warning":"info";
export function AmlAlertsPage(){
  const { navigate } = usePlatform();
  const rows = listAmlAlerts();
  const cols: Column<AmlCase>[] = [
    {key:"id",header:"Alert",cell:r=><button type="button" className="text-left font-medium text-primary hover:underline" onClick={()=>navigate("aml-case",{id:r.id})}>{r.id}<span className="block text-[10px] text-muted-foreground font-normal">{r.typology}</span></button>},
    {key:"trader",header:"Trader",cell:r=><span>{r.traderName}<span className="block text-[10px] text-muted-foreground">{r.email}</span></span>},
    {key:"risk",header:"Risk",cell:r=><StatusBadge tone={tone(r.risk) as any}>{r.risk}</StatusBadge>},
    {key:"amt",header:"Amount",numeric:true,cell:r=>`${r.currency} ${r.amount.toLocaleString()}`},
    {key:"st",header:"Status",cell:r=><StatusBadge tone={stTone(r.status) as any}>{r.status.replace("_"," ")}</StatusBadge>},
    {key:"hold",header:"Payout",cell:r=>r.payoutHold?<StatusBadge tone="danger">held</StatusBadge>:<StatusBadge tone="muted">clear</StatusBadge>},
    {key:"a",header:"",cell:r=><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>navigate("aml-case",{id:r.id})}>Review</Button>},
  ];
  return (
    <Page>
      <PageHeader title="AML & Transaction Monitoring" description="Alerts queue for suspicious activity, sanctions/PEP hits, and payout holds. Dispositions and SAR/STR stubs are audit-logged." icon={ShieldAlert} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricCard label="Open alerts" value={String(rows.filter(r=>["open","investigating","escalated"].includes(r.status)).length)} tone="negative" />
          <MetricCard label="Critical" value={String(rows.filter(r=>r.risk==="critical").length)} tone="negative" />
          <MetricCard label="Payout holds" value={String(rows.filter(r=>r.payoutHold).length)} tone="warning" />
          <MetricCard label="Cleared (sample)" value={String(rows.filter(r=>r.status==="cleared").length)} tone="positive" />
        </div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.id} ${r.traderName} ${r.email} ${r.typology}`} />
      </PageContent>
    </Page>
  );
}
