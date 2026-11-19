"use client";

/**
 * API Keys Page — API key management (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Create, revoke, rotate API keys; scope management.
 *
 * Gap P0-2/S-09: create/rotate/revoke used to be demo toasts on a
 * page-local const. The roster now lives in the API-key store, and
 * every mutation runs the 2FA → two-operator approval flow — the key
 * row lands (with an audit row) the moment operator B approves, from
 * any page, after reloads. Scope/expiry/IP-binding depth (S-16) lands
 * in P0-4.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useApiKeys,
  API_SCOPES,
  RATE_LIMIT_TIERS,
  type ApiKeyMutation,
  type StoredApiKey,
} from "@/lib/platform/api-key-store";
import { useTenants } from "@/lib/platform/tenant-store";
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
  CheckCircle2,
  Lock,
  Users,
  Activity,
  AlertTriangle,
} from "lucide-react";

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

type KeyAction = { kind: "rotate" | "revoke"; key: StoredApiKey } | null;

export function ApiKeysPage() {
  const { navigate } = usePlatform();
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; the store-
  // backed roster below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 500 }), []);
  const apiKeys = useApiKeys();
  const tenants = useTenants();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  /* ── Create flow (S-09): form dialog → 2FA → staged request ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTenant, setNewTenant] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>([]);
  const [newTier, setNewTier] = useState<string>("standard");
  const [createFlow, setCreateFlow] = useState<ApiKeyMutation | null>(null);

  /* ── Rotate / revoke row actions → staged request ── */
  const [keyAction, setKeyAction] = useState<KeyAction>(null);

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

  const nameOk = newName.trim().length >= 3;
  const createFormOk = nameOk && newTenant !== "" && newScopes.length > 0;

  const openCreate = () => {
    setNewName("");
    setNewTenant(tenants[0]?.name ?? "");
    setNewScopes([]);
    setNewTier("standard");
    setCreateOpen(true);
  };

  const toggleScope = (scope: string) => {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const copyKey = async (key: StoredApiKey) => {
    const value = `${key.prefix}${key.id.slice(-4)}`;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${key.name} key copied to clipboard.` });
    } catch {
      toast({
        title: "Clipboard unavailable",
        description: "Your browser blocked clipboard access — select the key manually.",
      });
    }
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
            <Button size="sm" onClick={openCreate}>
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
          hasData={hydrated !== undefined}
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
                            onClick={() => copyKey(key)}
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
                            disabled={key.status === "revoked"}
                            title={
                              key.status === "revoked"
                                ? "Revoked keys cannot be rotated"
                                : "Rotate — 2FA + second-operator approval"
                            }
                            onClick={() => setKeyAction({ kind: "rotate", key })}
                          >
                            <RefreshCw className="h-3 w-3" /> Rotate
                          </Button>
                          {key.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-[10px]"
                              title="Revoke — 2FA + second-operator approval"
                              onClick={() => setKeyAction({ kind: "revoke", key })}
                            >
                              Revoke
                            </Button>
                          )}
                          {key.status === "revoked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px]"
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

      {/* ── Create key form → maker-checker (S-09) ───────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Key creation is a two-operator action: 2FA → second operator
              approves → the key becomes active (audited).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="key-name" className="text-xs">
                Key name (required)
              </Label>
              <Input
                id="key-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Alpha Capital — Backend service"
                autoFocus
                maxLength={64}
              />
              {newName.trim() !== "" && !nameOk && (
                <p className="text-[11px] text-destructive">At least 3 characters.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-tenant" className="text-xs">
                Tenant (required)
              </Label>
              <Select value={newTenant} onValueChange={setNewTenant}>
                <SelectTrigger id="key-tenant">
                  <SelectValue placeholder="Pick a tenant…" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Scopes (required — pick at least one)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {API_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => toggleScope(scope)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                      newScopes.includes(scope)
                        ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : "text-muted-foreground hover:bg-muted/60"
                    }`}
                    aria-pressed={newScopes.includes(scope)}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-tier" className="text-xs">
                Rate limit tier
              </Label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger id="key-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_LIMIT_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="flex items-start gap-1.5 rounded-md border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              The full secret is shown once after creation — store it in your
              secrets manager; the console keeps only the masked prefix.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!createFormOk}
              onClick={() => {
                setCreateFlow({
                  kind: "create",
                  name: newName.trim(),
                  tenant: newTenant,
                  scopes: [...newScopes].sort(),
                  rateLimitTier: newTier,
                });
                setCreateOpen(false);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Continue to 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Maker-checker (S-09): create ─────────────────────────── */}
      {createFlow && createFlow.kind === "create" ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setCreateFlow(null);
          }}
          actionKey="apikey.create"
          title={`Create API key "${createFlow.name}"`}
          consequence={`Issues a new live secret for ${createFlow.tenant}.`}
          blastRadius={[
            `${createFlow.scopes.length} scopes: ${createFlow.scopes.join(", ")}`,
            `Rate limit tier: ${createFlow.rateLimitTier}`,
            "The key can authenticate against the API the moment it is approved",
            "Two-operator approval required — the request expires in 10 minutes",
          ]}
          detail={`API key creation · ${createFlow.tenant}`}
          twoOperator
          approvalPayload={createFlow}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: "Key creation pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}

      {/* ── Maker-checker (S-09): rotate / revoke ────────────────── */}
      {keyAction ? (
        <SensitiveActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setKeyAction(null);
          }}
          actionKey={keyAction.kind === "rotate" ? "apikey.rotate" : "apikey.revoke"}
          title={
            keyAction.kind === "rotate"
              ? `Rotate key "${keyAction.key.name}"`
              : `Revoke key "${keyAction.key.name}"`
          }
          consequence={
            keyAction.kind === "rotate"
              ? "The current secret stops working immediately; a new one is issued."
              : "Every request using this key starts failing immediately."
          }
          blastRadius={
            keyAction.kind === "rotate"
              ? [
                  `Old secret (${keyAction.key.prefix}) invalidated at approval`,
                  `Tenant ${keyAction.key.tenant} must deploy the new secret`,
                  "Integrations using the old secret will 401 until updated",
                  "Two-operator approval required — the request expires in 10 minutes",
                ]
              : [
                  `Key "${keyAction.key.name}" (${keyAction.key.tenant}) can no longer authenticate`,
                  `${keyAction.key.scopes.length} scopes revoked with it`,
                  "This cannot be undone — a new key must be created",
                  "Two-operator approval required — the request expires in 10 minutes",
                ]
          }
          detail={`API key ${keyAction.kind} · ${keyAction.key.id}`}
          twoOperator
          approvalPayload={{ kind: keyAction.kind, keyId: keyAction.key.id } satisfies ApiKeyMutation}
          onExecute={() => undefined}
          onApprovalInitiated={() =>
            toast({
              title: keyAction.kind === "rotate" ? "Key rotation pending approval" : "Key revocation pending approval",
              description: "Operator B must approve within 10 minutes — Approval Center.",
            })
          }
        />
      ) : null}
    </Page>
  );
}
