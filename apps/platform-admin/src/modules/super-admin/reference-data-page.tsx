"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { CURRENCIES } from "@/lib/platform/currency";
import { BookOpen, Globe, DollarSign, Server, Layers, Flag, FileText } from "lucide-react";

interface RefEntry {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
}

const currencies: RefEntry[] = CURRENCIES.map((c) => ({
  id: `cur-${c.code}`,
  code: c.code,
  name: c.name,
  category: "Currencies",
  description: `Symbol: ${c.symbol} · Rate: 1 USD = ${(1 / c.rate).toFixed(4)} ${c.code}`,
}));

const countries: RefEntry[] = [
  { id: "ctry-us", code: "US", name: "United States", category: "Countries", description: "North America" },
  { id: "ctry-gb", code: "GB", name: "United Kingdom", category: "Countries", description: "Europe" },
  { id: "ctry-ae", code: "AE", name: "United Arab Emirates", category: "Countries", description: "Middle East" },
  { id: "ctry-sg", code: "SG", name: "Singapore", category: "Countries", description: "Asia" },
  { id: "ctry-de", code: "DE", name: "Germany", category: "Countries", description: "Europe" },
  { id: "ctry-fr", code: "FR", name: "France", category: "Countries", description: "Europe" },
  { id: "ctry-br", code: "BR", name: "Brazil", category: "Countries", description: "South America" },
  { id: "ctry-in", code: "IN", name: "India", category: "Countries", description: "Asia" },
  { id: "ctry-za", code: "ZA", name: "South Africa", category: "Countries", description: "Africa" },
  { id: "ctry-ca", code: "CA", name: "Canada", category: "Countries", description: "North America" },
];

const platforms: RefEntry[] = [
  { id: "plt-mt5", code: "MT5", name: "MetaTrader 5", category: "Trading Platforms", description: "MetaQuotes · FX/CFD/Multi-asset" },
  { id: "plt-mt4", code: "MT4", name: "MetaTrader 4", category: "Trading Platforms", description: "MetaQuotes · Legacy FX" },
  { id: "plt-dx", code: "DXTrade", name: "DXTrade", category: "Trading Platforms", description: "Devexperts · Institutional" },
];

const ruleTypes: RefEntry[] = [
  { id: "rt-dd", code: "daily-drawdown", name: "Daily Drawdown", category: "Rule Types", description: "Daily loss limit (default 5%)" },
  { id: "rt-md", code: "max-drawdown", name: "Max Drawdown", category: "Rule Types", description: "Maximum drawdown limit (default 10%)" },
  { id: "rt-ptm", code: "profit-target-miss", name: "Profit Target Miss", category: "Rule Types", description: "Failed to reach profit target" },
  { id: "rt-tl", code: "time-limit", name: "Time Limit", category: "Rule Types", description: "Challenge time limit exceeded" },
];

const accountTypes: RefEntry[] = [
  { id: "at-challenge", code: "challenge", name: "Challenge Account", category: "Account Types", description: "Evaluation phase account" },
  { id: "at-funded", code: "funded", name: "Funded Account", category: "Account Types", description: "Post-evaluation live account" },
  { id: "at-demo", code: "demo", name: "Demo Account", category: "Account Types", description: "Practice / sandbox account" },
];

const allEntries = [...currencies, ...countries, ...platforms, ...ruleTypes, ...accountTypes];

const columns: Column<RefEntry>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs font-medium">{r.code}</span>, sortValue: (r) => r.code },
  { key: "name", header: "Name", cell: (r) => <span className="text-sm">{r.name}</span>, sortValue: (r) => r.name },
  { key: "category", header: "Category", cell: (r) => <Badge variant="outline" className="text-[10px]">{r.category}</Badge>, sortValue: (r) => r.category },
  { key: "description", header: "Description", cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span> },
];

export function ReferenceDataPage() {
  const categories = Array.from(new Set(allEntries.map((e) => e.category)));

  return (
    <Page>
      <PageHeader title="Master Reference Data" description="Controlled reference data — currencies, countries, platforms, rule types, account types, status definitions." icon={BookOpen} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Currencies" value={currencies.length} icon={DollarSign} />
          <MetricCard label="Countries" value={countries.length} icon={Globe} />
          <MetricCard label="Platforms" value={platforms.length} icon={Server} />
          <MetricCard label="Rule Types" value={ruleTypes.length} icon={Layers} />
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Data governance</p>
          <p className="mt-1">This is an administrative data-governance workspace. Reference data changes affect ALL tenants. Modifications should be rare, reviewed, and audited. Do not casually modify these values.</p>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Reference entries ({allEntries.length})</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={allEntries} rowKey={(r) => r.id} searchableText={(r) => `${r.code} ${r.name} ${r.category}`} searchPlaceholder="Search reference data…" pageSize={20} emptyTitle="No entries" emptyDescription="Reference data will appear here." />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
