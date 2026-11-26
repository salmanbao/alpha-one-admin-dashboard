"use client";

/**
 * Provider Incident Runbook — R10 PU-02.
 *
 * Rapid response workflow for provider outages affecting payouts.
 * Shows provider inventory, incident response workflow, and verification.
 *
 * Contents:
 *   • Provider pool selection (with in-flight payout count)
 *   • Incident type selection (rail-declined, invalid beneficiary, etc.)
 *   • Description field for incident details
 *   • Confirmation dialog with provider-specific impact
 *   • Audit trail logging to console
 *   • Provider status dashboard
 */
import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePayouts } from "@/lib/platform/payout-store";
import { Provider, PROVIDERS } from "@/lib/platform/provider-catalog";
import { recordAudit } from "@/lib/platform/console-store";
import { ArrowRight } from "lucide-react";

const FAILURE_LABELS: Record<string, string> = {
  "rail-declined": "Rail declined",
  "invalid-beneficiary": "Invalid beneficiary",
  "insufficient-float": "Insufficient float",
  timeout: "Timeout",
  "compliance-hold": "Compliance hold",
  "fraud-suspected": "Fraud suspected",
  duplicate: "Duplicate",
  "cancelled-by-operator": "Cancelled by operator",
  other: "Other",
};

export function ProviderIncidentRunbookPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [incidentType, setIncidentType] = useState<string>("rail-declined");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const payoutProviders = PROVIDERS.filter((p) => p.payoutCapability !== "none");
  const providerOptions = payoutProviders.map((p) => p.id);

  const activePayouts = payouts.filter((p) =>
    ["pending", "approved", "processing", "on-hold"].includes(p.status),
  );
  const inFlightPayouts = activePayouts.filter(
    (p) => ["pending", "processing"].includes(p.status),
  );
  const stuckPayouts = activePayouts.filter(
    (p) =>
      p.status === "pending" &&
      p.createdAt &&
      new Date(p.createdAt).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

  const handleProviderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvider(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmed && selectedProvider) {
      const p = PROVIDERS.find((x) => x.id === selectedProvider);
      recordAudit({
        actor: user.name,
        action: "console.incident_created",
        target: `provider-incident-${selectedProvider}`,
        severity: "critical",
        detail: `Provider incident ${incidentType}: ${description}. Provider: ${p?.name ?? selectedProvider}`,
        tenantId: undefined,
      });
      toast({
        title: "Incident initiated",
        description: `Provider ${selectedProvider} incident (${incidentType}) reported for ${description}. Recorded in audit trail.`,
        variant: "default",
      });
      setConfirmed(false);
      setSelectedProvider(null);
    }
  };

  const providerImpact = useMemo(() => {
    if (!selectedProvider) return null;
    const p = PROVIDERS.find((x) => x.id === selectedProvider);
    if (!p) return null;
    const affectedPayouts = payouts.filter(
      (po) => po.method === p.payoutCapability && IN_FLIGHT.includes(po.status),
    );
    const totalExposure = affectedPayouts.reduce((s, po) => s + po.amount, 0);
    const tenantsAffected = new Set(affectedPayouts.map((po) => po.tenantId)).size;

    return {
      provider: p,
      affectedCount: affectedPayouts.length,
      totalExposure,
      tenantsAffected,
    };
  }, [selectedProvider, payouts]);

  const IN_FLIGHT = ["pending", "approved", "processing", "on-hold"];

  return (
    <Page>
      <PageHeader
        title="Provider Incident Runbook"
        description="Rapid response workflow for provider outages affecting payouts (R10 PU-02)"
        icon={ArrowRight}
      />
      <PageContent>
        <Card className="mb-6">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Provider Incident Response</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSelectedProvider(null)}>
              Clear selection
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider ID
                  </label>
                  <select
                    value={selectedProvider ?? ""}
                    onChange={handleProviderSelect}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Provider</option>
                    {providerOptions.map((id) => (
                      <option key={id} value={id}>
                        {payoutProviders.find((p) => p.id === id)?.name || id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Incident Type
                    </span>
                  </div>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="rail-declined">Rail Decline</option>
                    <option value="invalid-beneficiary">Invalid Beneficiary</option>
                    <option value="insufficient-float">Insufficient Float</option>
                    <option value="timeout">Timeout</option>
                    <option value="compliance-hold">Compliance Hold</option>
                    <option value="fraud-suspected">Fraud Suspected</option>
                    <option value="duplicate">Duplicate Transaction</option>
                    <option value="cancelled-by-operator">Cancelled by Operator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2 mt-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Describe the incident, affected providers, and impact on payouts"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="incident-confirm"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <label htmlFor="incident-confirm" className="ml-2 text-sm text-gray-600">
                    I confirm this incident report is accurate
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setConfirmed(true)}
                  disabled={!selectedProvider || !confirmed}
                >
                  Confirm Incident
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Impact Assessment */}
        {providerImpact && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Provider Impact Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="text-sm font-bold">{providerImpact.provider.name}</p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Affected Payouts</p>
                  <p className="text-lg font-bold">{providerImpact.affectedCount}</p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Exposure</p>
                  <p className="text-lg font-bold">
                    ${providerImpact.totalExposure.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Tenants Affected</p>
                  <p className="text-lg font-bold">{providerImpact.tenantsAffected}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {providerImpact.provider.name} ({providerImpact.provider.payoutCapability}) —
                status: {providerImpact.provider.status}. Incident type: {incidentType}.
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Provider Status Dashboard</CardTitle>
            <Badge variant="secondary" className="text-xs">{payoutProviders.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Provider Inventory</h4>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-xs font-medium">ID</th>
                      <th className="px-4 py-2 text-xs font-medium">Name</th>
                      <th className="px-4 py-2 text-xs font-medium">Status</th>
                      <th className="px-4 py-2 text-xs font-medium">Tenants</th>
                      <th className="px-4 py-2 text-xs font-medium">Capability</th>
                    </tr>
                  </thead>
                  <tbody className="mt-2">
                    {payoutProviders.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="px-4 py-2">{p.id}</td>
                        <td className="px-4 py-2">{p.name}</td>
                        <td className="px-4 py-2">{p.status}</td>
                        <td className="px-4 py-2">{p.tenantsUsing}</td>
                        <td className="px-4 py-2">{p.payoutCapability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">In-Flight Payouts</h4>
                <div className="mt-2 text-sm text-gray-700">
                  {inFlightPayouts.length} payouts
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Stuck Payouts (7d+)</h4>
                <div className="mt-2 text-sm text-gray-700">
                  {stuckPayouts.length} payouts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}