"use client";

/**
 * CRM Module — widgets.
 *
 *   1. CrmOverviewWidget — metric row of KPIs (total, leads, qualified, customers, churned)
 *   2. PipelineWidget    — bar chart of contacts per pipeline stage
 *
 * Reads from `useCrmContacts(tid)` so contact mutations (stage moves,
 * drawer Save, Convert, Delete) on the CRM pages instantly update the
 * dashboard widget (Round 3 wired pages; Round 4 wires widgets).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { MetricCard } from "@/components/platform/page";
import { BarSeries } from "@/components/platform/charts";
import { Users, UserPlus, CheckCircle2, Crown, UserMinus } from "lucide-react";
import { useCrmContacts } from "@/modules/crm/crm-store";

export function CrmOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const contacts = useCrmContacts(tid);
  const leads = contacts.filter((c) => c.stage === "lead").length;
  const qualified = contacts.filter((c) => c.stage === "qualified").length;
  const customers = contacts.filter((c) => c.stage === "customer").length;
  const churned = contacts.filter((c) => c.stage === "churned").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Total Contacts" value={contacts.length} icon={Users} tone="positive" />
      <MetricCard label="Leads" value={leads} icon={UserPlus} />
      <MetricCard label="Qualified" value={qualified} icon={CheckCircle2} tone="positive" />
      <MetricCard label="Customers" value={customers} icon={Crown} tone="positive" />
      <MetricCard label="Churned" value={churned} icon={UserMinus} tone={churned > 0 ? "negative" : "positive"} />
    </div>
  );
}

export function PipelineWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const contacts = useCrmContacts(tid);
  const stages = ["lead", "qualified", "opportunity", "customer", "churned"] as const;
  const data = stages.map((stage) => ({
    name: stage,
    value: contacts.filter((c) => c.stage === stage).length,
  }));
  return <BarSeries data={data} xKey="name" yKey="value" color="#0f766e" height={200} />;
}
