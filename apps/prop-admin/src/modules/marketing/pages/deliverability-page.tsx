"use client";
/** N4 — Deliverability Dashboard (depth). Per-provider/channel/domain, trends, thresholds, recommendations, links to incidents (R2-09). */
import { useMemo } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { HeartPulse, AlertTriangle, ExternalLink } from "lucide-react";
import { AreaSeries } from "@/components/platform/charts";

export function DeliverabilityPage() {
  const { navigate } = usePlatform();
  const trend = useMemo(()=>Array.from({length:30},(_,i)=>({name:`D${i+1}`,delivered:Math.max(92,Math.round(98-i*0.08)),bounced:Math.round(1.2+i*0.03),complaints:+(0.06+i*0.003).toFixed(2)})),[]);
  const rows = [
    {id:"r1",provider:"SendGrid",channel:"email",domain:"mail.alpha.one",sent:124300,delivered:98.1,bounce:1.6,complaint:0.12,reputation:"ok",placement:"Inbox 94% (Gmail), 91% (Outlook)"},
    {id:"r2",provider:"Twilio",channel:"sms",sent:8420,delivered:99.4,bounce:0.4,complaint:0,reputation:"ok",placement:"Carrier deliverability 99%"},
    {id:"r3",provider:"Meta WhatsApp Cloud",channel:"whatsapp",domain:"WABA:+155501",sent:14560,delivered:97.8,bounce:1.2,complaint:0.04,reputation:"warn",placement:"Quality rating: Medium"},
  ];
  const cols: Column<typeof rows[number]>[] = [
    {key:"p",header:"Provider / domain",cell:r=><span className="font-medium">{r.provider}<span className="block text-[10px] text-muted-foreground">{r.channel} · {r.domain||"—"}</span></span>},
    {key:"s",header:"Sent 24h",numeric:true,cell:r=><span className="tabular-nums">{r.sent.toLocaleString()}</span>},
    {key:"d",header:"Delivered",numeric:true,cell:r=>r.delivered+"%"},
    {key:"b",header:"Bounce",numeric:true,cell:r=><span className={r.bounce>1.5?"text-destructive":" "}>{r.bounce}%</span>},
    {key:"c",header:"Complaint",numeric:true,cell:r=><span className={r.complaint>0.1?"text-amber-700":" "}>{r.complaint}%</span>},
    {key:"rep",header:"Reputation",cell:r=><StatusBadge tone={r.reputation==="ok"?"success":"warning"}>{r.reputation}</StatusBadge>},
    {key:"pl",header:"ISP/placement hint",cell:r=><span className="text-[10px] text-muted-foreground">{r.placement}</span>},
  ];
  return (
    <Page>
      <PageHeader title="Deliverability Dashboard" description="Per-provider/channel/domain health, 30d trends, alert thresholds, ISP placement hints, recommendations." icon={HeartPulse}
        actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>navigate("deliverability-incidents")}>Incidents (R2-09)</Button><Button size="sm" variant="outline" onClick={()=>toast({title:"Report exported",description:"Deliverability CSV (per domain/provider) exported."})}>Export report</Button></div>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Delivered (24h)" value="98.2%" tone="positive" /><MetricCard label="Bounce rate" value="1.48%" tone="warning" /><MetricCard label="Complaint rate" value="0.09%" tone="positive" /><MetricCard label="Inbox placement (est.)" value="93%" tone="positive" /><MetricCard label="Alerts open" value="2" tone="negative" />
        </div>
        <Card><CardContent className="p-3"><p className="mb-2 text-sm font-semibold">Trend (30d) — delivered/bounced/complaints</p><AreaSeries data={trend} xKey="name" yKey="delivered" height={160} color="hsl(var(--primary))" /></CardContent></Card>
        <div className="rounded-lg border"><div className="flex items-center justify-between border-b px-3 py-2"><p className="text-sm font-semibold">Provider & domain comparison</p><span className="text-xs text-muted-foreground">DMARC/SPF/DKIM status reflected; quarantine forwarded from platform</span></div><div className="p-2"><DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={6} /></div></div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border p-3"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Alerts & thresholds</p><ul className="space-y-1 text-xs"><li className="rounded border p-2">[Warn] Bounce &gt; 1.5% threshold (SendGrid). Action: review list hygiene → <button className="underline" onClick={()=>navigate("bounce-queue")}>Bounce queue</button></li><li className="rounded border p-2">[Warn] Meta WhatsApp quality dip — review template compliance. <button className="underline" onClick={()=>navigate("whatsapp-templates")}>Templates</button></li></ul></div>
          <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Recommendations</p><ul className="list-disc pl-4 text-xs space-y-1"><li>Warm alternate domain for mail.alpha.one (see R2-09 playbook).</li><li>Suppress hard bounces automatically (enabled); review soft-bounce retries.</li><li>Align consent capture (R2-02/N10) to reduce complaints.</li></ul></div>
        </div>
      </PageContent>
    </Page>
  );
}
