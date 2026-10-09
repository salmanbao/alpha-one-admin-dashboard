"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Building2, Server, Layers, Network, Cpu, Shield, Database, Globe, Zap, Activity, GitBranch, BarChart3, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ArchitecturePillar {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "active" | "beta" | "deprecated";
  modules: string[];
  statusCode: string;
}

const pillars: ArchitecturePillar[] = [
  { id: "mod-01", title: "Modular Frontend Runtime", description: "Composable micro-frontend architecture with dynamic module loading, tenant-scoped navigation trees, and feature-flag-gated widget surfaces.", icon: Layers, status: "active", modules: ["super-admin", "prop-admin", "trader", "kyc", "payouts", "challenges", "risk", "analytics"], statusCode: "v4.2.8" },
  { id: "mod-02", title: "Multi-Tenant RBAC Enclaves", description: "Isolated permission enclaves per tenant with role hierarchies, permission matrices, audit trails, and impersonation controls.", icon: Shield, status: "active", modules: ["super-admin", "prop-admin", "trader"], statusCode: "v3.1.2" },
  { id: "mod-03", title: "Trading Bridge & Execution", description: "MT5/MT4 bridge integration with position sync, trade copy, drawdown calculation, and real-time market data pipelines.", icon: Zap, status: "active", modules: ["trading", "challenges", "risk"], statusCode: "v2.8.4" },
  { id: "mod-04", title: "Payout & Settlement Rails", description: "Multi-currency payout engine with crypto on-ramps, bank statement reconciliation, and compliance audit trails.", icon: Database, status: "active", modules: ["payouts", "settings"], statusCode: "v1.9.3" },
  { id: "mod-05", title: "KYC & Compliance Engine", description: "Identity verification pipeline with provider marketplace, risk scoring, AML case management, and document review workflows.", icon: Shield, status: "active", modules: ["kyc", "compliance"], statusCode: "v2.1.0" },
  { id: "mod-06", title: "AI/ML Inference Fabric", description: "Model deployment pipeline with SHAP attribution, cost tracking, quota enforcement, and cryptographic audit logging.", icon: Cpu, status: "beta", modules: ["ai-insights", "predictive-analytics", "fine-tuning"], statusCode: "v0.9.2" },
];

export function PlatformArchitecturePage() {
  const [search, setSearch] = useState("");
  const activePillars = pillars.filter((p) => p.status === "active").length;

  const filtered = pillars.filter((p) => {
    const q = search.toLowerCase();
    return !search || p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.modules.some((m) => m.includes(q));
  });

  return (
    <Page>
      <PageHeader
        title="Platform Architecture"
        description="How the PFaaS platform composes modular frontends, multi-tenant RBAC enclaves, trading bridges, and institutional data pipelines."
        icon={Building2}
        actions={
          <>
            <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> Whitepaper</Button>
            <Button size="sm" variant="outline"><Search className="mr-1 h-4 w-4" /> Inspect Manifest</Button>
          </>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active Pillars" value={activePillars} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Beta Modules" value={pillars.filter((p) => p.status === "beta").length} icon={Activity} />
          <MetricCard label="Total Modules" value={pillars.reduce((s, p) => s + p.modules.length, 0)} icon={Layers} />
          <MetricCard label="Schema" value="v4.2.8" icon={GitBranch} />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Network className="h-4 w-4" /> PFaaS Architecture Blueprint v4.2
          </div>
          <p className="mt-1">Schema: v4.2.8 · Kernel: micro-frontend-runtime-nitro · Active tenants: 8 enclaves · Composition: STATIC_SSR + DYNAMIC_CLIENT</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pillars, modules…" className="flex-1" />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No pillars found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((p) => (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <p.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold">{p.title}</h3>
                            <Badge variant="outline" className="text-[9px]">{p.id}</Badge>
                            <Badge variant={p.status === "active" ? "secondary" : p.status === "beta" ? "outline" : "destructive"} className="text-[9px]">{p.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.modules.map((m) => (
                              <Badge key={m} variant="secondary" className="text-[9px]">{m}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">{p.statusCode}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Composition</span></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Rendering</span><span className="font-medium">STATIC_SSR + DYNAMIC_CLIENT</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Runtime</span><span className="font-medium">micro-frontend-runtime-nitro</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Kernel</span><span className="font-medium">v4.2.8</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Tenant enclaves</span><span className="font-medium">8 active</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Module Distribution</span></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Core modules</span><span className="font-medium">6 active</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Beta modules</span><span className="font-medium">1 (AI/ML)</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Deprecated</span><span className="font-medium">0</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Total modules</span><span className="font-medium">7</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Compliance</span></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-500" /> SOC 2 Type II</span><span className="font-medium">Certified</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-500" /> SEC 17a-4</span><span className="font-medium">Compliant</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1"><Database className="h-3 w-3 text-amber-500" /> WORM store</span><span className="font-medium">Enabled</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Schema hash</span><span className="font-mono text-[10px]">0x9f4a...21c4</span></div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
