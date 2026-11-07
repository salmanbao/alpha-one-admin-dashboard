"use client";
/** N4 — Deliverability Dashboard (Wave 2, P1). Per-provider/channel health, bounce/complaint/open trends, alerts, provider comparison. */
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { HeartPulse, AlertTriangle } from "lucide-react";
import { AreaSeries } from "@/components/platform/charts";
import { useMemo } from "react";

export function DeliverabilityPage() {
  const trend = useMemo(()=>Array.from({length:30},(_,i)=>({name:`D${i+1}`,delivered:Math.round(98-i*0.12),bounced:Math.round(1.2+i*0.05),complaints:Math.round(0.08+i*0.01)})),[]);
  const rows = [
    {id:"r1",provider:"SendGrid",channel:"email",sent:124300,delivered:98.1,bounce:1.6,complaint:0.12,reputation:"ok"},
    {id:"r2",provider:"Twilio",channel:"sms",sent:8420,delivered:99.4,bounce:0.4,complaint:0,reputation:"ok"},
    {id:"r3",provider:"Meta WhatsApp Cloud",channel:"whatsapp",sent:14560,delivered:97.8,bounce:1.2,complaint:0.04,reputation:"warn"},
  ];
  const cols: Column<typeof rows[number]>[] = [
    {key:"p",header:"Provider",cell:r=><span className="font-medium">{r.provider}<span className="block text-[10px] text-muted-foreground">{r.channel}</span></span>},
    {key:"s",header:"Sent 24h",numeric:true,cell:r=><span className="tabular-nums">{r.sent.toLocaleString()}</span>},
    {key:"d",header:"Delivered",numeric:true,cell:r=><span>{r.delivered}%</span>},
    {key:"b",header:"Bounce",numeric:true,cell:r=><span className={r.bounce>1.5?"text-destructive":""}>{r.bounce}%</span>},
    {key:"c",header:"Complaint",numeric:true,cell:r=><span className={r.complaint>0.1?"text-amber-700":""}>{r.complaint}%</span>},
    {key:"rep",header:"Reputation",cell:r=><StatusBadge tone={r.reputation==="ok"?"success":r.reputation==="warn"?"warning":"danger"}>{r.reputation}</StatusBadge>},
  ];
  return (
    <Page>
      <PageHeader title="Deliverability Dashboard" description="Per-provider/channel health, trends, alerts and provider comparison." icon={HeartPulse}
        actions={<Button size="sm" variant="outline" onClick={()=>toast({title:"Report exported",description:"Deliverability report CSV exported (dummy)."})}>Export report</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Delivered (24h)" value="98.2%" tone="positive" />
          <MetricCard label="Bounce rate" value="1.48%" tone="warning" />
          <MetricCard label="Complaint rate" value="0.09%" tone="positive" />
          <MetricCard label="Alerts open" value="2" tone="negative" />
        </div>
        <Card><CardContent className="p-3"><p className="mb-2 text-sm font-semibold">Trend (30d)</p><AreaSeries data={trend} xKey="name" yKey="delivered" height={160} color="hsl(var(--primary))" /></CardContent></Card>
        <div className="rounded-lg border"><div className="flex items-center justify-between border-b px-3 py-2"><p className="text-sm font-semibold">Provider comparison</p><span className="text-xs text-muted-foreground">From pool/quarantine forwarded from platform-admin</span></div><div className="p-2"><DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={6} /></div></div>
        <div className="rounded-lg border p-3"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Alert feed</p><ul className="space-y-1 text-xs"><li className="rounded border p-2">[Warn] Meta WhatsApp: reputation dip — review template compliance.</li><li className="rounded border p-2">[Info] SendGrid: quota 12% used, no action needed.</li></ul></div>
      </PageContent>
    </Page>
  );
}
