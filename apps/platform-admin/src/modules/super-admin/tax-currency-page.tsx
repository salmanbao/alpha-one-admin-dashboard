"use client";

/**
 * Tax & Currency Page — Tax rules and multi-currency configuration (M13 Settings).
 *
 * Stitch screen: (new)
 * Tier 3 — Currency registry, tax rates by region, rounding/precision settings.
 *
 * P0-4: exchange rate saves, currency enable/disable, tax-rule edits persist under
 * pfaas:platform-admin:tax-currency. Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useState, useMemo } from "react";
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
  ArrowLeftRight,
  Landmark,
} from "lucide-react";
import {
  useTaxCurrency,
  saveExchangeRate,
  toggleCurrency,
  saveTaxRule,
  toggleTaxRule,
  type Currency,
  type TaxRule,
} from "@/lib/platform/tax-currency-store";

export function TaxCurrencyPage() {
  const data = useTaxCurrency();
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
    const rate = Number(rateDraft);
    const result = saveExchangeRate(code, rate);
    toast({ title: result.title, description: result.description });
    setEditingRate(null);
    setRateDraft("");
  };

  const toggleCurrencyEnabled = (cur: Currency) => {
    const result = toggleCurrency(cur.code, !cur.enabled);
    toast({ title: result.title, description: result.description });
  };

  const toggleTaxRuleStatus = (rule: TaxRule) => {
    const next: "active" | "disabled" = rule.status === "active" ? "disabled" : "active";
    const result = toggleTaxRule(rule.id, next);
    toast({ title: result.title, description: result.description });
  };

  return (
    <Page>
      <PageHeader
        title="Tax & Currency"
        description="Currency registry, exchange rates, and tax rules by region."
        icon={Percent}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "(demo) Rates refreshed", description: "Exchange rates synced from provider. Next sync in 1h." })}>
              <ArrowLeftRight className="mr-1 h-4 w-4" /> Refresh Rates
            </Button>
            <Button size="sm" onClick={() => toast({ title: "(demo) New tax rule", description: "Tax rule form: region, type, rate, applicability." })}>
              <Plus className="mr-1 h-4 w-4" /> Add Tax Rule
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => undefined}
          hasData={true}
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
              <Button size="sm" variant="outline" onClick={() => toast({ title: "(demo) Add currency", description: "Currency form: code, symbol, exchange rate, precision." })}>
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
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toggleCurrencyEnabled(cur)}>
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
                      <td className="px-4 py-3"><StatusBadge tone={rule.status === "active" ? "success" : "warning"}>{rule.status}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "(demo) Edit rule", description: `Editing tax rule for ${rule.region}.` })}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toggleTaxRuleStatus(rule)}>
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