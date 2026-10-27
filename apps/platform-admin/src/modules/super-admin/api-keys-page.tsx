"use client";

/**
 * API Keys Page — API key management (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Create, revoke, rotate API keys; scope management.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Key,
  Search,
  Plus,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  ShieldCheck,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

const demoApiKeys = [
  { id: "key-001", name: "Alpha Capital — Production", tenant: "Alpha Capital", scopes: ["read:accounts", "write:trades", "read:balances"], status: "active", lastUsed: "2026-10-08T14:30:00Z", createdAt: "2026-01-15T10:00:00Z", prefix: "sk_live_a1b2…", rateLimitTier: "enterprise" },
  { id: "key-002", name: "Alpha Capital — Staging", tenant: "Alpha Capital", scopes: ["read:accounts", "read:trades"], status: "active", lastUsed: "2026-10-08T13:00:00Z", createdAt: "2026-01-15T10:00:00Z", prefix: "sk_test_c3d4…", rateLimitTier: "development" },
  { id: "key-003", name: "Beta Trading — Integration", tenant: "Beta Trading", scopes: ["read:accounts", "write:orders", "read:positions"], status: "active", lastUsed: "2026-10-07T18:45:00Z", createdAt: "2026-02-20T14:30:00Z", prefix: "sk_live_e5f6…", rateLimitTier: "standard" },
  { id: "key-004", name: "Gamma Futures — Webhook Receiver", tenant: "Gamma Futures", scopes: ["read:accounts"], status: "revoked", lastUsed: "2026-09-30T09:00:00Z", createdAt: "2025-12-05T16:00:00Z", prefix: "sk_live_g7h8…", rateLimitTier: "standard" },
  { id: "key-005", name: "Gamma Futures — Mobile App", tenant: "Gamma Futures", scopes: ["read:accounts", "read:trades", "write:trades"], status: "active", lastUsed: "2026-10-08T12:15:00Z", createdAt: "2026-03-10T11:20:00Z", prefix: "sk_live_i9j0…", rateLimitTier: "enterprise" },
  { id: "key-006", name: "Alpha Capital — Reporting", tenant: "Alpha Capital", scopes: ["read:accounts", "read:reports"], status: "active", lastUsed: "2026-10-06T08:00:00Z", createdAt: "2026-04-01T09:00:00Z", prefix: "sk_live_k1l2…", rateLimitTier: "standard" },
  { id: "key-007", name: "Beta Trading — Analytics Export", tenant: "Beta Trading", scopes: ["read:analytics", "read:reports"], status: "active", lastUsed: "2026-10-05T15:30:00Z", createdAt: "2026-05-12T10:00:00Z", prefix: "sk_live_m3n4…", rateLimitTier: "standard" },
  { id: "key-008", name: "Legacy — Old Integration", tenant: "Alpha Capital", scopes: ["read:accounts"], status: "revoked", lastUsed: "2026-08-15T00:00:00Z", createdAt: "2025-11-01T12:00:00Z", prefix: "sk_live_o5p6…", rateLimitTier: "development" },
];

const statusTones: Record<string, "success" | "danger" | "warning"> = {
  active: "success",
  revoked: "danger",
  expired: "warning",
};

const scopeColors: Record<string, string> = {
  "read:accounts": "#4a7c59",
  "write:trades": "#705c30",
  "read:balances": "#6b6358",
  "read:trades": "#4a7c59",
  "write:orders": "#705c30",
  "read:positions": "#6b6358",
  "read:reports": "#4a7c59",
  "read:analytics": "#705c30",
};

export function ApiKeysPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => demoApiKeys, { delayMs: 500 }), []);
  const apiKeys = loadedData ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return apiKeys.filter((key) => {
      const matchesSearch =
        search === "" ||
        key.name.toLowerCase().includes(search.toLowerCase()) ||
        key.tenant.toLowerCase().includes(search.toLowerCase()) ||
        key.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || key.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [apiKeys, search, statusFilter]);

  const stats = useMemo(() => ({
    total: apiKeys.length,
    active: apiKeys.filter((k) => k.status === "active").length,
    revoked: apiKeys.filter((k) => k.status === "revoked").length,
    tenants: new Set(apiKeys.map((k) => k.tenant)).size,
  }), [apiKeys]);

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Page>
      <PageHeader
        title="API Keys"
        description="Manage API keys, scopes, and rate limit tiers."
        icon={Key}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("rate-limits")}>
              <Lock className="mr-1 h-4 w-4" /> Rate Limits
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("api-analytics")}>
              <Activity className="mr-1 h-4 w-4" /> API Analytics
            </Button>
            <Button size="sm" onClick={() => toast({ title: "Create key", description: "Create API key form opened. Requires tenant selection + scope config." })}>
              <Plus className="mr-1 h-4 w-4" /> Create Key
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
          loadingLabel="Loading API keys…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Keys" value={stats.total} icon={Key} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Revoked" value={stats.revoked} icon={Trash2} tone="negative" />
          <MetricCard label="Tenants Using API" value={stats.tenants} icon={Users} />
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by key name, tenant, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusFilter("active")}
              className="text-[10px]"
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "revoked" ? "default" : "outline"}
              onClick={() => setStatusFilter("revoked")}
              className="text-[10px]"
            >
              Revoked
            </Button>
          </div>
        </div>

        {/* Keys table */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">API Keys</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scopes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate Tier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Used</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((key) => (
                    <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{key.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{key.tenant}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                            {showKeys[key.id] ? `${key.prefix}${key.id.slice(-4)}` : `${key.prefix.slice(0, 6)}••••••••`}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={showKeys[key.id] ? "Hide key" : "Show key"}
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {showKeys[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label="Copy key"
                            onClick={() => toast({ title: "Copied", description: `API key for ${key.name} copied to clipboard.` })}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.slice(0, 2).map((scope) => (
                            <Badge
                              key={scope}
                              variant="outline"
                              className="text-[9px]"
                              style={{ borderColor: scopeColors[scope] || "#6b6358", color: scopeColors[scope] || "#6b6358" }}
                            >
                              {scope}
                            </Badge>
                          ))}
                          {key.scopes.length > 2 && (
                            <Badge variant="secondary" className="text-[9px]">+{key.scopes.length - 2} more</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {key.rateLimitTier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(key.lastUsed).toLocaleDateString()} {new Date(key.lastUsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTones[key.status]}>{key.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => toast({ title: "Rotate key", description: `Key ${key.name} rotation initiated. New secret will be generated.` })}
                          >
                            <RefreshCw className="h-3 w-3" /> Rotate
                          </Button>
                          {key.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => toast({ title: "Revoke key", description: `Key ${key.name} revoked. Audited.` })}
                            >
                              Revoke
                            </Button>
                          )}
                          {key.status === "revoked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => toast({ title: "Key already revoked", description: `Key ${key.name} was revoked. Cannot re-activate.` })}
                              disabled
                            >
                              <Lock className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center p-8 text-center">
                  <Key className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 font-medium">No API keys found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}

// Import Activity icon to avoid circular import issues
import { Activity } from "lucide-react";
