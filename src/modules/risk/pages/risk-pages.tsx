"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantBreaches, type Breach } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, breachSeverityTone } from "@/components/platform/status";
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function RiskOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const breaches = getTenantBreaches(tid);
  const open = breaches.filter((b) => b.status === "open").length;
  const critical = breaches.filter((b) => b.severity === "critical").length;
  const resolved = breaches.filter((b) => b.status === "resolved").length;

  return (
    <Page>
      <PageHeader title="Risk Management" description="Monitor drawdown, risk scores, and breaches." icon={ShieldCheck} actions={<Button size="sm" variant="outline" onClick={() => toast({ title: "Risk config", description: "Risk rules saved (demo)." })}>Configure rules</Button>} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Open Breaches" value={open} icon={ShieldAlert} tone={open > 0 ? "warning" : "positive"} />
          <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
          <MetricCard label="Resolved (30d)" value={resolved} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Platform Risk Score" value="72/100" icon={Activity} tone="positive" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Recent Breaches</p>
          <BreachesTable filter={(b) => true} />
        </div>
      </PageContent>
    </Page>
  );
}

export function BreachesPage() {
  return (
    <Page>
      <PageHeader title="Breaches" description="All rule violations." icon={ShieldAlert} />
      <PageContent>
        <BreachesTable filter={() => true} />
      </PageContent>
    </Page>
  );
}

function BreachesTable({ filter }: { filter: (b: Breach) => boolean }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const breaches = getTenantBreaches(tid).filter(filter);

  const columns: Column<Breach>[] = [
    { key: "trader", header: "Trader", cell: (b) => <span className="font-medium">{b.traderName}</span>, sortValue: (b) => b.traderName },
    { key: "type", header: "Type", cell: (b) => <Badge variant="outline" className="text-[10px]">{b.type}</Badge>, sortValue: (b) => b.type },
    { key: "rule", header: "Rule", cell: (b) => <span className="text-xs">{b.rule}</span>, sortValue: (b) => b.rule },
    {
      key: "severity",
      header: "Severity",
      cell: (b) => <StatusBadge tone={breachSeverityTone(b.severity)}>{b.severity}</StatusBadge>,
      sortValue: (b) => b.severity,
    },
    {
      key: "status",
      header: "Status",
      cell: (b) => <StatusBadge tone={b.status === "open" ? "warning" : "success"}>{b.status}</StatusBadge>,
      sortValue: (b) => b.status,
    },
    { key: "triggered", header: "Triggered", cell: (b) => <span className="text-xs text-muted-foreground">{new Date(b.triggeredAt).toLocaleString()}</span>, sortValue: (b) => b.triggeredAt },
    {
      key: "actions",
      header: "",
      cell: (b) =>
        b.status === "open" ? (
          <Button size="sm" variant="ghost" onClick={() => toast({ title: "Breach resolved", description: `${b.traderName}'s breach marked resolved.` })}>
            Resolve
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={breaches}
      rowKey={(b) => b.id}
      searchableText={(b) => `${b.traderName} ${b.type} ${b.rule}`}
      searchPlaceholder="Search breaches…"
    />
  );
}
