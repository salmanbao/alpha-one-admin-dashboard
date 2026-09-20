"use client";

/**
 * CRM Module — pages.
 *
 *   1. CrmOverviewPage  — KPIs + pipeline bar chart
 *   2. CrmContactsPage — DataTable of contacts
 *   3. CrmPipelinePage — pipeline stages visualization with counts
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantContacts, type CrmContact } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { BarSeries } from "@/components/platform/charts";
import { Users, UserPlus, CheckCircle2, Crown, UserMinus, Contact, GitBranch, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const STAGE_COLOR: Record<CrmContact["stage"], string> = {
  lead: "#94a3b8",
  qualified: "#0891b2",
  opportunity: "#f59e0b",
  customer: "#059669",
  churned: "#dc2626",
};

export function CrmOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);
  const leads = contacts.filter((c) => c.stage === "lead").length;
  const qualified = contacts.filter((c) => c.stage === "qualified").length;
  const customers = contacts.filter((c) => c.stage === "customer").length;
  const churned = contacts.filter((c) => c.stage === "churned").length;
  const pipelineValue = contacts.filter((c) => c.stage !== "churned").reduce((s, c) => s + c.value, 0);

  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const pipelineData = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));

  return (
    <Page>
      <PageHeader
        title="CRM"
        description="Contacts, leads, and pipeline."
        icon={Contact}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast({ title: "Export started", description: "CRM contacts exporting (demo)." })}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Total Contacts" value={contacts.length} delta={5} icon={Users} tone="positive" />
          <MetricCard label="Leads" value={leads} delta={9} icon={UserPlus} />
          <MetricCard label="Qualified" value={qualified} delta={7} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Customers" value={customers} delta={3} icon={Crown} tone="positive" />
          <MetricCard label="Churned" value={churned} delta={-2} icon={UserMinus} tone="negative" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Pipeline by Stage</p>
            <BarSeries data={pipelineData} xKey="name" yKey="value" color="#0891b2" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Pipeline Value</p>
              <Badge variant="secondary" className="text-xs">{formatCurrency(pipelineValue, currency)}</Badge>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              {stages.map((stage) => {
                const count = contacts.filter((c) => c.stage === stage).length;
                const value = contacts.filter((c) => c.stage === stage).reduce((s, c) => s + c.value, 0);
                const total = contacts.length || 1;
                return (
                  <div key={stage} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{stage}</span>
                      <span className="font-medium text-foreground">
                        {count} · {formatCurrency(value, currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(count / total) * 100}%`, background: STAGE_COLOR[stage] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function CrmContactsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);

  const columns: Column<CrmContact>[] = [
    { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    { key: "email", header: "Email", cell: (c) => <span className="text-xs text-muted-foreground">{c.email}</span>, sortValue: (c) => c.email },
    { key: "source", header: "Source", cell: (c) => c.source, sortValue: (c) => c.source },
    {
      key: "stage",
      header: "Stage",
      cell: (c) => (
        <Badge variant="outline" className="capitalize" style={{ color: STAGE_COLOR[c.stage], borderColor: STAGE_COLOR[c.stage] }}>
          {c.stage}
        </Badge>
      ),
      sortValue: (c) => c.stage,
    },
    { key: "owner", header: "Owner", cell: (c) => c.owner, sortValue: (c) => c.owner },
    { key: "value", header: "Value", cell: (c) => <span className="font-semibold">{formatCurrency(c.value, currency)}</span>, sortValue: (c) => c.value },
    {
      key: "lastInteraction",
      header: "Last Interaction",
      cell: (c) => <span className="text-xs text-muted-foreground">{new Date(c.lastInteraction).toLocaleDateString()}</span>,
      sortValue: (c) => c.lastInteraction,
    },
  ];

  return (
    <Page>
      <PageHeader title="Contacts" description="All CRM contacts for this tenant." icon={Users} />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Contacts ({contacts.length})</p>
          <DataTable
            columns={columns}
            data={contacts}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.name} ${c.email} ${c.source} ${c.stage} ${c.owner}`}
            searchPlaceholder="Search contacts…"
            emptyTitle="No contacts yet"
            emptyDescription="Add your first contact or import a list to start."
          />
        </div>
      </PageContent>
    </Page>
  );
}

export function CrmPipelinePage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const contacts = getTenantContacts(tid);

  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const pipelineData = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));

  return (
    <Page>
      <PageHeader title="Pipeline" description="Lead → Qualified → Opportunity → Customer journey." icon={GitBranch} />
      <PageContent>
        {/* Stage flow visualization */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Pipeline Stages</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {stages.map((stage, i) => {
              const stageContacts = contacts.filter((c) => c.stage === stage);
              const value = stageContacts.reduce((s, c) => s + c.value, 0);
              return (
                <div key={stage} className="relative">
                  {i < stages.length - 1 && (
                    <div className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 -translate-y-1/2 bg-border md:block" />
                  )}
                  <div className="rounded-lg border p-3" style={{ borderColor: STAGE_COLOR[stage] }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_COLOR[stage] }} />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stage}</span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{stageContacts.length}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(value, currency)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Contacts per Stage</p>
          <BarSeries data={pipelineData} xKey="name" yKey="value" color="#0891b2" />
        </div>
      </PageContent>
    </Page>
  );
}
