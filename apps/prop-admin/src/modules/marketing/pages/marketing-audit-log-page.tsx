"use client";
/** N11 — Marketing Audit Log (Wave 3/P2). Filterable audit view scoped to marketing verbs, reusing audit patterns. */
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ScrollText } from "lucide-react";

const rows = [
  {id:"a1",ts:new Date(Date.now()-30*60000).toISOString(),actor:"S. Malik",verb:"campaign.approved",target:"Q4 Scale Blitz",before:"in_review",after:"approved"},
  {id:"a2",ts:new Date(Date.now()-90*60000).toISOString(),actor:"System",verb:"flow.published",target:"Welcome & KYC nudge v3",before:"draft",after:"live"},
  {id:"a3",ts:new Date(Date.now()-4*3600000).toISOString(),actor:"A. Khan",verb:"template.edited",target:"Payout celebration",before:"v2",after:"v3"},
  {id:"a4",ts:new Date(Date.now()-6*3600000).toISOString(),actor:"S. Malik",verb:"connector.credential_rotated",target:"SendGrid (vault ref)",before:"rotated 90d ago",after:"rotation initiated"},
  {id:"a5",ts:new Date(Date.now()-8*3600000).toISOString(),actor:"You",verb:"consent.override",target:"le***@scam.net",before:"suppressed",after:"DSR erasure verified"},
];
export function MarketingAuditLogPage() {
  const cols: Column<typeof rows[number]>[] = [
    {key:"ts",header:"When",sortValue:r=>r.ts,cell:r=><span className="text-xs">{new Date(r.ts).toLocaleString()}</span>},
    {key:"actor",header:"Actor",cell:r=>r.actor},
    {key:"verb",header:"Action",cell:r=><code className="text-[10px]">{r.verb}</code>},
    {key:"target",header:"Target",cell:r=>r.target},
    {key:"ba",header:"Before → After",cell:r=><span className="text-xs text-muted-foreground">{r.before} → <span className="text-foreground">{r.after}</span></span>},
  ];
  return (
    <Page>
      <PageHeader title="Marketing Audit Log" description="Marketing-scoped changes: flow edits, approvals, templates, credential rotations, consent overrides." icon={ScrollText}
        actions={<Button size="sm" variant="outline" onClick={()=>toast({title:"Audit exported",description:"Filtered marketing audit exported (dummy)."})}>Export</Button>} />
      <PageContent>
        <DataTable columns={cols} data={rows} rowKey={r=>r.id} pageSize={10} searchableText={r=>`${r.actor} ${r.verb} ${r.target}`} />
      </PageContent>
    </Page>
  );
}
