"use client";
/** N8 — Campaign Report / Postmortem (Wave 2, P1). Delivery funnel to business outcome, attribution, cost/ROI, breakdowns, export. */
import { useMemo } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarSeries } from "@/components/platform/charts";
import { toast } from "@/hooks/use-toast";
import { FileText, Download } from "lucide-react";
import { listCampaigns } from "../campaign-studio-store";

export function CampaignReportPage() {
  const campaigns = listCampaigns();
  const c = campaigns[0];
  const delivered = Math.round((c?.audienceSize ?? 12400) * 0.959);
  const opened = c?.opens ?? Math.round(delivered * 0.42);
  const clicked = c?.clicks ?? Math.round(delivered * 0.11);
  const converted = 286;
  const funnel = useMemo(()=>[{name:"Sent",v:c?.audienceSize ?? 12400},{name:"Delivered",v:delivered},{name:"Opened",v:opened},{name:"Clicked",v:clicked},{name:"Converted",v:converted}], [c]);
  const breakdown = [{seg:"Funded traders",rev:8420},{seg:"KYC pending",rev:1240},{seg:"Dormant 60d",rev:680}];
  return (
    <Page>
      <PageHeader title="Campaign Report / Postmortem" description="Delivery funnel to business outcome — attribution (events manager), cost (ad spend), ROI, export." icon={FileText}
        actions={<Button size="sm" variant="outline" onClick={()=>toast({title:"Exported",description:"Campaign report exported as CSV/PDF (dummy)."})}><Download className="mr-1 h-4 w-4" />Export</Button>} />
      <PageContent>
        <p className="text-sm"><span className="text-muted-foreground">Campaign:</span> <strong>{c?.name ?? "Payout celebration"}</strong> · <span className="text-muted-foreground">Compare vs previous</span> (delta chips shown on KPIs)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Revenue attributed" value="$10,340" tone="positive" delta={12.4} />
          <MetricCard label="Cost (ad spend)" value="$1,820" />
          <MetricCard label="ROI" value="5.68x" tone="positive" />
          <MetricCard label="Conversions" value={String(converted)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="p-3"><p className="mb-2 text-sm font-semibold">Delivery funnel</p><BarSeries data={funnel.map(f=>({name:f.name,v:f.v}))} xKey="name" yKey="v" height={180} color="hsl(var(--primary))" /></CardContent></Card>
          <Card><CardContent className="p-3"><p className="mb-2 text-sm font-semibold">Revenue by segment</p><BarSeries data={breakdown} xKey="seg" yKey="rev" height={180} color="hsl(var(--primary))" /></CardContent></Card>
        </div>
        <p className="text-[11px] text-muted-foreground">Attribution sourced from Events Manager (M5.3); cost from Ad Spend (M5.2). Once the send gateway is live, delivered/opened/clicked reflect real events.</p>
      </PageContent>
    </Page>
  );
}
