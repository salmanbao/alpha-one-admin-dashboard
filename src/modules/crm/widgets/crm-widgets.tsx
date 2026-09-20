"use client";

/**
 * CRM Module — widgets.
 *
 *   1. CrmOverviewWidget — metric row of KPIs (total, leads, qualified, customers, churned)
 *   2. PipelineWidget    — bar chart of contacts per pipeline stage
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantContacts } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { BarSeries } from "@/components/platform/charts";
import { Users, UserPlus, CheckCircle2, Crown, UserMinus } from "lucide-react";

export function CrmOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const contacts = getTenantContacts(tid);
  const leads = contacts.filter((c) => c.stage === "lead").length;
  const qualified = contacts.filter((c) => c.stage === "qualified").length;
  const customers = contacts.filter((c) => c.stage === "customer").length;
  const churned = contacts.filter((c) => c.stage === "churned").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Total Contacts" value={contacts.length} delta={5} icon={Users} tone="positive" />
      <MetricCard label="Leads" value={leads} delta={9} icon={UserPlus} />
      <MetricCard label="Qualified" value={qualified} delta={7} icon={CheckCircle2} tone="positive" />
      <MetricCard label="Customers" value={customers} delta={3} icon={Crown} tone="positive" />
      <MetricCard label="Churned" value={churned} delta={-2} icon={UserMinus} tone="negative" />
    </div>
  );
}

export function PipelineWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const contacts = getTenantContacts(tid);
  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const data = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));
  return <BarSeries data={data} xKey="name" yKey="value" color="#0891b2" height={200} />;
}
