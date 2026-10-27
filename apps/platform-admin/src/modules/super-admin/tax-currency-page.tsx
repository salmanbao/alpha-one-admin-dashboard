"use client";

/**
 * Tax & Currency Page — Tax rules and multi-currency configuration (M13 Settings).
 *
 * Stitch screen: (new)
 * Tier 3 — Currency registry, tax rates by region, rounding/precision settings.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Percent,
  Globe,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  ArrowLeftRight,
} from "lucide-react";

const demoCurrencies = [
  { code: "USD", name: "US Dollar", symbol: "$", rate: 1.0, enabled: true, isDefault: true, precision: 2 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 0.92, enabled: true, isDefault: false, precision: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", rate: 0.79, enabled: true, isDefault: false, precision: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", rate: 3.67, enabled: true, isDefault: false, precision: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", rate: 1.52, enabled: false, isDefault: false, precision: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", rate: 149.5, enabled: false, isDefault: false, precision: 0 },
];

const demoTaxRules = [
  { id: "tax-001", region: "European Union", type: "VAT", rate: 21, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-002", region: "United Kingdom", type: "VAT", rate: 20, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-003", region: "United States (CA)", type: "Sales Tax", rate: 8.5, inclusive: false, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-004", region: "United States (NY)", type: "Sales Tax", rate: 8.0, inclusive: false, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-005", region: "UAE", type: "VAT", rate: 5, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-006", region: "Australia", type: "GST", rate: 10, inclusive: true, appliesTo: "All subscription plans", status: "disabled" },
];

const statusTones: Record<string, "success" | "warning"> = {
  active: "success",
  disabled: "warning",
};

export function TaxCurrencyPage() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ currencies: demoCurrencies, taxRules: demoTaxRules }), { delayMs: 450 }), []);
  const data = loadedData ?? { currencies: [], taxRules: [] };
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [taxSearch, setTaxSearch] = useState("");

  const filteredTaxRules = useMemo(() => {
    return data.taxRules.filter(
      (r) => taxSearch === "" || r.region.toLowerCase().includes(taxSearch.toLowerCase()) || r.type.toLowerCase().includes(taxSearch.toLowerCase())
    );
  }, [data.taxRules, taxSearch]);

  const stats = useMemo(() => ({
    enabledCurrencies: data.currencies.filter((c) => c.enabled).length,
    totalCurrencies: data.currencies.length,
    activeTaxRules: data.taxRules.filter((t) => t.status === "active").length,
    regions: new Set(data.taxRules.map((t) => t.region)).size,
  }), [data]);

  const saveRate = (code: string) => {
    toast({ title: "Exchange rate saved", description: `${code} rate updated to ${rateDraft}. Rate refresh scheduled.` });
    setEditingRate(null);
  };

  return (
    <Page>
      <PageHeader
        title="Tax & Currency"
        description="Currency registry, exchange rates, and tax rules by region."
        icon={Percent}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Rates refreshed", description: "Exchange rates synced from provider. Next sync in 1h." })}>
              <ArrowLeftRight className="mr-1 h-4 w-4" /> Refresh Rates
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New tax rule", description: "Tax rule form: region, type, rate, applicability." })}>
              <Plus className="mr-1 h-4 w-4" /> Add Tax Rule
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading tax & currency settings…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Enabled Currencies" value={stats.enabledCurrencies} icon={Globe} tone="positive" />
          <MetricCard label="Available Currencies" value={stats.totalCurrencies} icon={ArrowLeftRight} />
          <MetricCard label="Active Tax Rules" value={stats.activeTaxRules} icon={Percent} />
          <MetricCard label="Tax Regions" value={stats.regions} icon={Landmark} />
        </div>

        {/* Currencies */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Currencies</h2>
              <Button size="sm" variant="outline" onClick={() => toast({ title: "Add currency", description: "Currency form: code, symbol, exchange rate, precision." })}>
                <Plus className="mr-1 h-3 w-3" /> Add Currency
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate (vs USD)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Precision</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.currencies.map((cur) => (
                    <tr key={cur.code} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-bold">{cur.code}</Badge>
                          {cur.isDefault && <Badge className="text-[9px]">Default</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{cur.name}</td>
                      <td className="px-4 py-3 text-sm font-mono">{cur.symbol}</td>
                      <td className="px-4 py-3">
                        {editingRate === cur.code ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.0001"
                              value={rateDraft}
                              onChange={(e) => setRateDraft(e.target.value)}
                              className="h-7 w-28 text-xs"
                            />
                            <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => saveRate(cur.code)}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setEditingRate(null)}>✕</Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm font-mono hover:underline"
                            onClick={() => { setEditingRate(cur.code); setRateDraft(String(cur.rate)); }}
                          >
                            {cur.rate}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{cur.precision} dp</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={cur.enabled ? "success" : "warning"}>{cur.enabled ? "enabled" : "disabled"}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: cur.enabled ? "Currency disabled" : "Currency enabled", description: `${cur.code} ${cur.enabled ? "disabled for new charges" : "enabled"}. Audited.` })}>
                          {cur.enabled ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tax rules */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Tax Rules</h2>
              <div className="relative w-64">
                <Input
                  placeholder="Search region or type..."
                  value={taxSearch}
                  onChange={(e) => setTaxSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applies To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTaxRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{rule.region}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{rule.type}</Badge></td>
                      <td className="px-4 py-3 text-sm font-bold">{rule.rate}%</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{rule.inclusive ? "Tax inclusive" : "Tax exclusive"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{rule.appliesTo}</td>
                      <td className="px-4 py-3"><StatusBadge tone={statusTones[rule.status]}>{rule.status}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Edit rule", description: `Editing tax rule for ${rule.region}.` })}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: rule.status === "active" ? "Rule disabled" : "Rule enabled", description: `${rule.region} tax rule ${rule.status === "active" ? "disabled" : "enabled"}. Audited.` })}>
                            {rule.status === "active" ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTaxRules.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Percent className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 font-medium">No tax rules found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary note */}
        <Card>
          <CardContent className="pt-6 text-xs text-muted-foreground">
            Taxes are applied at checkout based on the customer&apos;s billing country. Exchange rates refresh hourly; historical
            rates are pinned at invoice time for reconciliation. Changes to tax rules require <strong className="text-foreground">Billing: Manage</strong> permission and are written to the audit log.
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
