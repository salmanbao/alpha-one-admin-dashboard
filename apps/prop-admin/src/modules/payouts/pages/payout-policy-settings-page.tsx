"use client";

/**
 * S1 (Prop-Admin Payouts Gap Analysis) — Payout Policy Settings.
 *
 * Replaces the hard-coded payout constants (minimum/maximum request,
 * cadence, processing fee, method availability) with an editable,
 * validated policy form. Every field is a real control with real
 * validation — the save path shows a confirmation and the values live
 * in component state for the session (demo persistence seam: swap
 * `useState` for the tenant settings store when a backend lands).
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

interface PayoutPolicy {
  minimumRequest: number;
  maximumRequest: number;
  cadenceDays: number;
  processingFee: number;
  methodEnabled: boolean;
}

export function PayoutPolicySettingsPage() {
  const [policy, setPolicy] = useState<PayoutPolicy>({
    minimumRequest: 100,
    maximumRequest: 25000,
    cadenceDays: 14,
    processingFee: 20,
    methodEnabled: true,
  });

  /** Numeric field updater — coerces the input value and clamps at 0. */
  const numberChange = (field: keyof PayoutPolicy) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(e.target.value);
    setPolicy((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : prev[field],
    }));
  };

  const isValid = useMemo(
    () =>
      policy.minimumRequest > 0 &&
      policy.maximumRequest >= policy.minimumRequest &&
      policy.cadenceDays > 0 &&
      policy.processingFee >= 0,
    [policy],
  );

  const saveSettings = () => {
    if (!isValid) {
      toast({
        title: "Invalid policy",
        description: "Maximum must be ≥ minimum, and cadence must be at least 1 day.",
        variant: "destructive",
      });
      return;
    }
    // Demo persistence seam: wire to the tenant settings store when a
    // backend lands. For now the values are confirmed + displayed.
    toast({
      title: "Payout policy saved",
      description: `Min ${policy.minimumRequest} · Max ${policy.maximumRequest} · Cadence ${policy.cadenceDays}d · Fee ${policy.processingFee}% · Method ${policy.methodEnabled ? "enabled" : "disabled"} (Demo)`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Payout Policy Settings"
        description="Configure payout request limits, cadence, processing fee and method availability for this tenant."
        icon={Settings}
        actions={
          <Button onClick={saveSettings} disabled={!isValid}>
            <Save className="mr-1 h-4 w-4" /> Save Policy
          </Button>
        }
      />
      <PageContent>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Request limits & cadence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <Label className="block text-sm font-medium">
                  Minimum Request Amount (USD)
                </Label>
                <Input
                  type="number"
                  className="mt-1 w-full"
                  value={policy.minimumRequest}
                  onChange={numberChange("minimumRequest")}
                  min={0}
                  step={1}
                />
              </div>

              <div>
                <Label className="block text-sm font-medium">
                  Maximum Request Amount (USD)
                </Label>
                <Input
                  type="number"
                  className="mt-1 w-full"
                  value={policy.maximumRequest}
                  onChange={numberChange("maximumRequest")}
                  min={0}
                  step={1}
                />
                {policy.maximumRequest < policy.minimumRequest && (
                  <p className="mt-1 text-xs text-destructive">
                    Maximum must be greater than or equal to the minimum.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Payout Cadence</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={policy.cadenceDays}
                  onChange={numberChange("cadenceDays")}
                  min={1}
                />
                <Label className="text-sm text-muted-foreground">days</Label>
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Processing Fee</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={policy.processingFee}
                  onChange={numberChange("processingFee")}
                  min={0}
                />
                <Label className="text-sm text-muted-foreground">% fee</Label>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm font-medium">Enable Payout Method</Label>
                <Switch
                  checked={policy.methodEnabled}
                  onCheckedChange={(v) => setPolicy((prev) => ({ ...prev, methodEnabled: v }))}
                  aria-label="Enable payout method"
                />
              </div>
            </div>

            <div className="pt-6">
              <Button variant="default" onClick={saveSettings} disabled={!isValid} className="w-full">
                <Save className="mr-1 h-4 w-4" /> Save Payout Policy Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
