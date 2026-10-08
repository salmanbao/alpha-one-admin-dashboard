"use client";

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings2, Building2, DollarSign, Clock, ShieldCheck } from "lucide-react";

interface DefaultSetting {
  id: string;
  category: string;
  name: string;
  value: string;
  type: "text" | "number" | "toggle" | "select";
  options?: string[];
  isToggle?: boolean;
  toggleValue?: boolean;
  description: string;
}

const defaults: DefaultSetting[] = [
  { id: "d1", category: "Tenant", name: "Default plan", value: "scale", type: "select", options: ["starter", "scale", "enterprise"], description: "Plan assigned to new tenants by default." },
  { id: "d2", category: "Tenant", name: "Default currency", value: "USD", type: "select", options: ["USD", "EUR", "GBP", "AED", "JPY"], description: "Currency assigned to new tenants." },
  { id: "d3", category: "Tenant", name: "Default timezone", value: "UTC", type: "text", description: "Timezone for new tenants." },
  { id: "d4", category: "Trading", name: "Default leverage", value: "1:100", type: "text", description: "Default leverage for new trading accounts." },
  { id: "d5", category: "Trading", name: "Default platform", value: "MT5", type: "select", options: ["MT5", "MT4", "DXTrade"], description: "Default broker platform." },
  { id: "d6", category: "Risk", name: "Daily drawdown limit", value: "5", type: "number", description: "Default daily drawdown percentage." },
  { id: "d7", category: "Risk", name: "Max drawdown limit", value: "10", type: "number", description: "Default max drawdown percentage." },
  { id: "d8", category: "Finance", name: "Min payout amount", value: "50", type: "number", description: "Minimum withdrawal request amount." },
  { id: "d9", category: "Finance", name: "Auto-approval threshold", value: "1000", type: "number", description: "Payouts below this amount can be auto-approved." },
  { id: "d10", category: "Security", name: "Session timeout (hours)", value: "24", type: "number", description: "How long before inactive sessions expire." },
  { id: "d11", category: "Security", name: "Require 2FA for admins", value: "", type: "toggle", isToggle: true, toggleValue: true, description: "Require TOTP for all admin logins." },
  { id: "d12", category: "Security", name: "IP allowlist enabled", value: "", type: "toggle", isToggle: true, toggleValue: false, description: "Restrict admin access to allowlisted IPs." },
  { id: "d13", category: "Notifications", name: "Default email sender", value: "noreply@pfaas.io", type: "text", description: "From-address for system emails." },
  { id: "d14", category: "Notifications", name: "Quiet hours default", value: "22:00-07:00", type: "text", description: "Default quiet-hours window for notifications." },
];

export function GlobalDefaultsPage() {
  const categories = Array.from(new Set(defaults.map((d) => d.category)));

  return (
    <Page>
      <PageHeader title="Global Defaults" description="Platform-wide default settings. Tenants can override these unless marked as locked." icon={Settings2} />
      <PageContent>
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Platform defaults vs tenant overrides</p>
          <p className="mt-1">These values apply to new tenants and as fallbacks. Individual tenants may override most settings in their own Settings page. Changes here do NOT retroactively modify existing tenants.</p>
        </div>

        {categories.map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">{cat}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {defaults.filter((d) => d.category === cat).map((d) => (
                <div key={d.id} className="flex items-center gap-3 border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{d.name}</Label>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </div>
                  {d.isToggle ? (
                    <Switch checked={d.toggleValue} aria-label={d.name} />
                  ) : d.type === "select" ? (
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" defaultValue={d.value}>
                      {d.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Input className="h-8 w-32 text-xs" defaultValue={d.value} />
                  )}
                  <Badge variant="outline" className="text-[9px]">Platform default</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </PageContent>
    </Page>
  );
}
