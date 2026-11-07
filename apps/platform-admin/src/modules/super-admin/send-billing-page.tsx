"use client";
/** N16 — Send-Based Usage Billing Rollup (Wave 3/P2). Metered sends per tenant → billing: unit costs, margin, monthly rollup export. */
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Receipt, Download } from "lucide-react";

const rows = [
  {id:"r1",tenant:"ApexFunded",email:482000,sms:12400,whatsapp:8200,cost:412.4,margin:28},
  {id:"r2",tenant:"TradeMax",email:210000,sms:4400,whatsapp:0,cost:148.2,margin:30},
  {id:"r3",tenant:"FundedHub",email:98000,sms:18200,whatsapp:3100,cost:221.7,margin:25},
];
export function SendBillingPage() {
  const cols: Column<typeof rows[number]>[] = [
    {key:"t",header:"Tenant",cell:r=><span className="font-medium">{r.tenant}</span>},
    {key:"e",header:"Email sends",numeric:true,cell:r=>r.email.toLocaleString()},
    {key:"s",header:"SMS",numeric:true,cell:r=>r.sms.toLocaleString()},
    {key:"w",header:"WhatsApp",numeric:true,cell:r=>r.whatsapp.toLocaleString()},
    {key:"c",header:"Provider cost",numeric:true,cell:r=>`$${r.cost.toFixed(2)}`},
    {key:"m",header:"Margin %",numeric:true,cell:r=>`${r.margin}%`},
    {key:"bill",header:"Billable",numeric:true,cell:r=>`$${(r.cost*(1+r.margin/100)).toFixed(2)}`},
  ];
  return (
    <Page>
      <PageHeader title="Send-Based Usage Billing Rollup" description="Metered marketing sends per tenant rolled into billing (per-channel unit costs, margin, monthly export)." icon={Receipt}
        actions={<Button size="sm" variant="outline" onClick={()=>toast({title:"Billing export generated",description:"Monthly rollup exported for reconciliation against provider invoices."})}><Download className="mr-1 h-4 w-4" />Generate export</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Billable (month)" value="$1,011.16" tone="positive" /><MetricCard label="Provider cost" value="$782.30" /><MetricCard label="Avg margin" value="27.7%" tone="default" /></div>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={8} />
        <p className="text-[11px] text-muted-foreground">Rate card editable per channel (dummy). Depends on M2 send-gateway runtime for real metering.</p>
      </PageContent>
    </Page>
  );
}
