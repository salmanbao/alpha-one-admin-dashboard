"use client";

import { useState, useMemo } from "react";
import { usePayoutPolicyStore } from "@/lib/platform/payout-policy-store";
import { useGlobalPayoutPolicy, usePayoutPolicyOverrides, useTenantPayoutPolicy, getTenantName, type GlobalPayoutPolicy } from "@/lib/platform/payout-policy-store";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Settings2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_SLA_DAYS = 1;
const MAX_SLA_DAYS = 30;
const MIN_FEE_BPS = 0;
const MAX_FEE_BPS = 500;
const MIN_VELOCITY = 0;
const MAX_VELOCITY = 50;
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 1_000_000;

export function PayoutPolicyConsolePage() {
  const store = usePayoutPolicyStore();
  const globalPolicy = useGlobalPayoutPolicy();
  const overrides = usePayoutPolicyOverrides();

  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editingPatch, setEditingPatch] = useState<Partial<{
    onTimeSlaDays: number;
    minRequest: number;
    maxRequest: number;
    processingFeeBps: number;
    cadenceDays: number;
    velocityLimit: number;
    largeAmountThreshold: number;
    methodEnabled: boolean;
    availableMethods: string[];
  }>>({});

  const tenantIds = ["tenant-alpha", "tenant-beta", "tenant-gamma"];

  const effectivePolicies = useMemo(() => {
    const map: Record<string, GlobalPayoutPolicy> = {};
    tenantIds.forEach((tid) => {
      map[tid] = store.getEffectivePolicy(tid);
    });
    // Also include tenants with no override (they use global defaults)
    ["tenant-alpha", "tenant-beta", "tenant-gamma"].forEach((tid) => {
      if (!map[tid]) {
        map[tid] = { ...globalPolicy };
      }
    });
    return map;
  }, [globalPolicy, overrides]);

  const onSaveGlobal = () => {
    toast({
      title: "Global policy updated",
      description: `SLA: ${globalPolicy.onTimeSlaDays}d · Max request: $${globalPolicy.defaultMaxRequest} · Fee: ${globalPolicy.defaultProcessingFeeBps}bps · Velocity: ${globalPolicy.defaultVelocityLimit}/cadence`,
    });
  };

  const onSaveTenant = () => {
    if (!editingTenant) return;

    const { global } = store;
    const override: any = {
      tenantId: editingTenant,
    };
    // Apply non-null patches
    if (editingPatch.onTimeSlaDays !== undefined) override.onTimeSlaDays = editingPatch.onTimeSlaDays;
    if (editingPatch.minRequest !== undefined) override.minRequest = editingPatch.minRequest;
    if (editingPatch.maxRequest !== undefined) override.maxRequest = editingPatch.maxRequest;
    if (editingPatch.processingFeeBps !== undefined) override.processingFeeBps = editingPatch.processingFeeBps;
    if (editingPatch.cadenceDays !== undefined) override.cadenceDays = editingPatch.cadenceDays;
    if (editingPatch.velocityLimit !== undefined) override.velocityLimit = editingPatch.velocityLimit;
    if (editingPatch.largeAmountThreshold !== undefined) override.largeAmountThreshold = editingPatch.largeAmountThreshold;
    if (editingPatch.methodEnabled !== undefined) override.methodEnabled = editingPatch.methodEnabled;
    if (editingPatch.availableMethods !== undefined) override.availableMethods = editingPatch.availableMethods;

    store.setTenantOverride(override);

    toast({
      title: "Tenant policy saved",
      description: `Policy applied for ${getTenantName(editingTenant)}`,
    });

    setEditingTenant(null);
    setEditingPatch({});
  };

  return (
    <Page>
      <PageHeader
        title="Payout Policy Console"
        description="Cross-tenant payout policy engine — global defaults and per-tenant overrides. Money-denominated liability and operational thresholds."
        icon={Settings2}
      />
      <PageContent>
        {/* Global defaults card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-semibold">Global Defaults</span>
            <StatusBadge tone="default">Active across all tenants</StatusBadge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>On-time SLA (days)</Label>
                <Input
                  type="number"
                  min={MIN_SLA_DAYS}
                  max={MAX_SLA_DAYS}
                  value={globalPolicy.onTimeSlaDays}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_SLA_DAYS && v <= MAX_SLA_DAYS) {
                      store.updateGlobalDefaults({ onTimeSlaDays: v });
                    }
                  }}
                />
              </div>
              <div>
                <Label>Default Min Request (USD)</Label>
                <Input
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  value={globalPolicy.defaultMinRequest}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_AMOUNT) {
                      store.updateGlobalDefaults({ defaultMinRequest: v });
                    }
                  }}
                />
              </div>
              <div>
                <Label>Default Max Request (USD)</Label>
                <Input
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  value={globalPolicy.defaultMaxRequest}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_AMOUNT) {
                      store.updateGlobalDefaults({ defaultMaxRequest: v });
                    }
                  }}
                />
              </div>
              <div>
                <Label>Processing Fee (bps)</Label>
                <Input
                  type="number"
                  min={MIN_FEE_BPS}
                  max={MAX_FEE_BPS}
                  value={globalPolicy.defaultProcessingFeeBps}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_FEE_BPS) {
                      store.updateGlobalDefaults({ defaultProcessingFeeBps: v });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">(100 = 1%)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default Cadence (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={globalPolicy.defaultCadenceDays}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 1) {
                      store.updateGlobalDefaults({ defaultCadenceDays: v });
                    }
                  }}
                />
              </div>
              <div>
                <Label>Velocity Limit per Cadence</Label>
                <Input
                  type="number"
                  min={MIN_VELOCITY}
                  max={MAX_VELOCITY}
                  value={globalPolicy.defaultVelocityLimit}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_VELOCITY) {
                      store.updateGlobalDefaults({ defaultVelocityLimit: v });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">max payouts</span>
              </div>
              <div>
                <Label>Large-Amount Review Threshold (USD)</Label>
                <Input
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  value={globalPolicy.largeAmountThreshold}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= MIN_AMOUNT) {
                      store.updateGlobalDefaults({ largeAmountThreshold: v });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">above triggers review</span>
              </div>
              <div>
                <Label>Available Methods</Label>
                <div className="grid grid-cols-2 gap-1">
                  <label>
                    <Input
                      type="checkbox"
                      checked={globalPolicy.availableMethods.includes("bank-transfer")}
                      onChange={(e) =>
                        store.updateGlobalDefaults({
                          availableMethods: e.target.checked
                            ? ["bank-transfer", "crypto", "paypal", "skrill"]
                            : ["crypto", "paypal", "skrill"],
                        })
                      }
                    />
                    Bank Transfer
                  </label>
                  <label>
                    <Input
                      type="checkbox"
                      checked={globalPolicy.availableMethods.includes("crypto")}
                      onChange={(e) =>
                        store.updateGlobalDefaults({
                          availableMethods: e.target.checked
                            ? ["bank-transfer", "crypto", "paypal", "skrill"]
                            : ["bank-transfer", "crypto", "skrill"],
                        })
                      }
                    />
                    Crypto
                  </label>
                  <label>
                    <Input
                      type="checkbox"
                      checked={globalPolicy.availableMethods.includes("paypal")}
                      onChange={(e) =>
                        store.updateGlobalDefaults({
                          availableMethods: e.target.checked
                            ? ["bank-transfer", "crypto", "paypal", "skrill"]
                            : ["bank-transfer", "crypto", "skrill"],
                        })
                      }
                    />
                    PayPal
                  </label>
                  <label>
                    <Input
                      type="checkbox"
                      checked={globalPolicy.availableMethods.includes("skrill")}
                      onChange={(e) =>
                        store.updateGlobalDefaults({
                          availableMethods: e.target.checked
                            ? ["bank-transfer", "crypto", "paypal", "skrill"]
                            : ["bank-transfer", "crypto", "paypal"],
                        })
                      }
                    />
                    Skrill
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={onSaveGlobal}
                variant="default"
                className="w-full"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Save Global Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Per-tenant overrides section */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-semibold">Per-Tenant Overrides</span>
            <Badge variant="outline" className="text-xs">
              {overrides.length} tenant(s) customized
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenantIds.map((tid) => {
              const effective = store.getEffectivePolicy(tid);
              const tenantName = getTenantName(tid);
              const hasOverride = overrides.some((o) => o.tenantId === tid);
              return (
                <div key={tid} className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{tenantName}</span>
                    <StatusBadge tone="success">{effective.onTimeSlaDays}d SLA</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Min: {effective.defaultMinRequest}</div>
                    <div>Max: {effective.defaultMaxRequest}</div>
                    <div>Fee: {effective.defaultProcessingFeeBps}bps</div>
                    <div>Vel: {effective.defaultVelocityLimit}/cadence</div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingTenant(tid)}
                      title={hasOverride ? "Edit override" : "Create override"}
                    >
                      ⚙️
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Edit override panel */}
        {editingTenant && (
          <Card className="mt-6 max-w-md">
            <CardHeader>
              <span className="text-sm font-medium">
                Edit policy for {editingTenant === "platform" ? "Platform" : getTenantName(editingTenant)}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>On-time SLA (days)</Label>
                  <Input
                    type="number"
                    min={MIN_SLA_DAYS}
                    max={MAX_SLA_DAYS}
                    value={editingPatch.onTimeSlaDays ?? globalPolicy.onTimeSlaDays}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= MIN_SLA_DAYS && v <= MAX_SLA_DAYS) {
                        setEditingPatch((prev) => ({
                          ...prev,
                          onTimeSlaDays: v,
                        }));
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Min Request (USD)</Label>
                  <Input
                    type="number"
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    value={editingPatch.minRequest ?? globalPolicy.defaultMinRequest}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= MIN_AMOUNT) {
                        setEditingPatch((prev) => ({
                          ...prev,
                          minRequest: v,
                        }));
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Max Request (USD)</Label>
                  <Input
                    type="number"
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    value={editingPatch.maxRequest ?? globalPolicy.defaultMaxRequest}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= MIN_AMOUNT) {
                        setEditingPatch((prev) => ({
                          ...prev,
                          maxRequest: v,
                        }));
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Processing Fee (bps)</Label>
                  <Input
                    type="number"
                    min={MIN_FEE_BPS}
                    max={MAX_FEE_BPS}
                    value={editingPatch.processingFeeBps ?? globalPolicy.defaultProcessingFeeBps}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= MIN_FEE_BPS) {
                        setEditingPatch((prev) => ({
                          ...prev,
                          processingFeeBps: v,
                        }));
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">(100 = 1%)</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={onSaveTenant}
                  variant="default"
                  className="w-full"
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Save Tenant Policy
                </Button>
                <Button
                  onClick={() => {
                    setEditingTenant(null);
                    setEditingPatch({});
                  }}
                  variant="outline"
                  className="w-full mt-2"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </Page>
  );
}