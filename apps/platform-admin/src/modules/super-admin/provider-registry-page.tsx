"use client";

/**
 * Provider / Integration Registry.
 *
 * Lists all external providers (MetaApi, Veriff, NOWPayments, Postmark,
 * Match2Pay, etc.) with health, latency, credential status (fingerprint
 * only — never the actual key), and tenant usage.
 *
 * Critical security rule: never display provider secrets.
 *
 * v2 surface (Screen Improvement Report):
 *  - Typed provider record model (latencyMs / errorRatePct / config union
 *    / timestamped lastRotatedAt + lastSuccessAt + checkedAt) — R24
 *    "truth" pattern applied to the provider family.
 *  - Read governance (P0-1): hasPermission assert + recordAudit on detail
 *    open (dedup-ref pattern, support-assist §61).
 *  - Demo-disclosure + as-of + Refresh (P0-2 / §67): the catalog's honesty
 *    claim becomes true on the page.
 *  - URL state (P1-3 / §51): ?provider= / ?status= read on mount, synced
 *    back to the URL.
 *  - Interaction (P1-4): button semantics, Escape-to-close, Sheet detail
 *    so selection is always in view.
 *  - Decision support (P1-5): status/type chips + MetricCard drill-down +
 *    EmptyState + per-provider derived open-incident badge.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { PROVIDERS, type Provider } from "@/lib/platform/provider-catalog";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/platform/status";
import { recordAudit } from "@/lib/platform/console-store";
import { hasPermission } from "@/lib/platform/permission-engine";
import { useEscapeKey } from "@/hooks/use-escape-key";
import {
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  KeyRound,
  Fingerprint,
  Clock,
  Lock,
  RefreshCw,
  X,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusTone = (s: Provider["status"]) =>
  s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

const formatLatency = (ms: number | null): string =>
  ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

const formatPct = (v: number | null): string =>
  v === null ? "—" : `${v.toFixed(1)}%`;

const formatAgo = (at: number): string => {
  const diff = Date.now() - at;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

const configLabel = (c: Provider["config"]): string =>
  c === "Configured" ? "Configured" : c === "Not configured" ? "Not configured" : "Pending";

function parseParams(params: Record<string, string>): {
  provider?: string;
  status?: string;
} {
  return {
    provider: params.provider || undefined,
    status: params.status,
  };
}

export function ProviderRegistryPage() {
  const { user, navigate, router } = usePlatform();

  // Async seam (frontend-first): data resolves via the mock layer so the
  // loading skeleton + error/retry states are exercised. Refresh re-runs.
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => PROVIDERS, { delayMs: 450 }), []);
  const providers = loadedData ?? [];
  const [asOf, setAsOf] = useState<number>(() => Date.now());

  // URL state (P1-3 / §51) — ?provider= / ?status= read once on mount.
  const bootedFromUrl = useRef(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (bootedFromUrl.current) return;
    bootedFromUrl.current = true;
    const p = parseParams(router.params);
    if (p.status && ["operational", "degraded", "down"].includes(p.status)) {
      setStatusFilter(p.status);
    }
    if (p.provider) {
      const hit = PROVIDERS.find((x) => x.id === p.provider);
      if (hit) setSelected(hit);
    }
  }, [router.params]);

  // Sync selection + status filter back to the URL so a filtered view is
  // shareable and a deep link re-opens the same provider detail.
  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (selected?.id) params.provider = selected.id;
    navigate("provider-registry", params, { replace: true });
  }, [selected?.id, statusFilter, navigate]);

  // Read-audit on detail open (P0-1, CON-09 mirror): dedup-ref so
  // re-opening the same provider within a session does not spam the trail.
  const auditedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    if (auditedFor.current === selected.id) return;
    auditedFor.current = selected.id;
    recordAudit({
      actor: user.name,
      action: "console.provider_detail_open",
      target: selected.id,
      severity: "info",
      detail: `Fingerprint surface viewed: ${selected.credentialFingerprint}`,
    });
  }, [selected, user.name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (q) {
        const haystack = `${p.name} ${p.type} ${p.id}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [providers, statusFilter, query]);

  const handleClearFilters = () => {
    setStatusFilter(undefined);
    setQuery("");
  };
  const handleRefresh = () => {
    setAsOf(Date.now());
    retry();
  };

  useEscapeKey(selected !== null, () => setSelected(null));

  // Page-level permission assert (P0-1) — the route declaration is not
  // enforcement; a role without `platform.provider-registry.read` gets the
  // standard guard state instead of a silent render.
  if (!hasPermission(user, "platform.provider-registry.read")) {
    return (
      <Page>
        <PageHeader title="Provider Registry" icon={Globe} />
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 py-12 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Access restricted</p>
            <p className="text-xs text-muted-foreground">
              Your role does not have the <code>platform.provider-registry.read</code>{" "}
              permission required to view provider credential surfaces.
            </p>
          </div>
        </PageContent>
      </Page>
    );
  }

  const operational = providers.filter((p) => p.status === "operational").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const down = providers.filter((p) => p.status === "down").length;
  const credentialIssues = providers.filter((p) => p.config === "Not configured").length;

  const hasFilters = Boolean(statusFilter || query);

  return (
    <Page>
      <PageHeader
        title="Provider Registry"
        description="External integrations and their health. Credentials are never displayed — only fingerprints."
        icon={Globe}
        actions={
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Fingerprint-only
          </Badge>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading provider registry…"
        >
          {/* Demo disclosure + as-of + refresh (P0-2 / §67) */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Demo data</span>
            <span className="text-muted-foreground/70">
              — health values are a seeded snapshot, not live telemetry.
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span>As of {new Date(asOf).toLocaleTimeString()}</span>
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading} data-readonly-allow>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </Button>
            </span>
          </div>

          {/* KPIs — drill-down via onClick (P1-5) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Total Providers" value={providers.length} icon={Globe} onClick={() => handleClearFilters()} />
            <MetricCard
              label="Operational"
              value={operational}
              icon={CheckCircle2}
              tone="positive"
              onClick={() => setStatusFilter((s) => (s === "operational" ? undefined : "operational"))}
            />
            <MetricCard
              label="Degraded"
              value={degraded}
              icon={AlertTriangle}
              tone={degraded > 0 ? "warning" : "positive"}
              onClick={() => setStatusFilter((s) => (s === "degraded" ? undefined : "degraded"))}
            />
            <MetricCard
              label="Credential Issues"
              value={credentialIssues}
              icon={KeyRound}
              tone={credentialIssues > 0 ? "warning" : "positive"}
              onClick={() => setStatusFilter((s) => (s === "down" ? undefined : "down"))}
            />
          </div>

          {/* Filters — status chips + search (P1-5) */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers by name, type, or id…"
                aria-label="Search providers"
                className="h-8 max-w-sm rounded-md border bg-background px-3 text-sm"
                data-readonly-allow
              />
              <div className="ml-auto flex items-center gap-1.5">
                {(["operational", "degraded", "down"] as const).map((s) => (
                  <button
                    key={s}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs capitalize transition",
                      statusFilter === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => setStatusFilter((cur) => (cur === s ? undefined : s))}
                    data-readonly-allow
                  >
                    {s}
                  </button>
                ))}
                {hasFilters && (
                  <Button size="sm" variant="ghost" onClick={handleClearFilters} data-readonly-allow>
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Clear filters
                  </Button>
                )}
              </div>
            </div>

            {/* Provider grid — button semantics + keyboard + selected ring (P1-4) */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 py-12 text-center">
                <SearchIcon />
                <p className="text-sm font-medium">No providers match</p>
                <p className="text-xs text-muted-foreground">
                  {hasFilters
                    ? `Nothing matches the current filters${query ? ` for "${query}"` : ""}.`
                    : "No providers are registered yet."}
                </p>
                {hasFilters && (
                  <Button size="sm" variant="outline" onClick={handleClearFilters} data-readonly-allow>
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        selected?.id === p.id && "border-primary ring-1 ring-primary/30",
                      )}
                      onClick={() => setSelected(p)}
                      data-readonly-allow
                    >
                      <CardHeader className="flex flex-row items-center gap-2 pb-2">
                        <div className="rounded-md bg-muted p-2">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.type}</p>
                        </div>
                        <span
                          aria-hidden
                          className={cn(
                            "h-2 w-2 rounded-full",
                            p.status === "operational"
                              ? "bg-emerald-500"
                              : p.status === "degraded"
                                ? "bg-amber-500"
                                : "bg-rose-500",
                          )}
                        />
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Latency</span>
                          <span className="font-medium tabular-nums">{formatLatency(p.latencyMs)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Error rate</span>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              (p.errorRatePct ?? 0) > 1 ? "text-amber-600" : "",
                            )}
                          >
                            {formatPct(p.errorRatePct)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tenants</span>
                          <span className="font-medium tabular-nums">{p.tenantsUsing}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-1">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Fingerprint className="h-3 w-3" />
                            {p.credentialFingerprint}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px]",
                              p.config === "Configured"
                                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                : p.config === "Pending"
                                  ? "border-sky-500/30 text-sky-700 dark:text-sky-400"
                                  : "border-amber-500/30 text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {configLabel(p.config)}
                          </Badge>
                        </div>
                      </CardContent>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected provider detail — Sheet so it is always in view (P1-4) */}
          <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
            <SheetContent side="right">
              {selected && (
                <>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      {selected.name}
                      <StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge>
                    </SheetTitle>
                    <SheetDescription>{selected.type}</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-3 px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Service type</p>
                        <p className="font-medium">{selected.type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                        <StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency</p>
                        <p className="font-medium tabular-nums">{formatLatency(selected.latencyMs)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Error rate</p>
                        <p className="font-medium tabular-nums">{formatPct(selected.errorRatePct)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tenants using</p>
                        <p className="font-medium tabular-nums">{selected.tenantsUsing}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last success</p>
                        <p className="font-medium">{formatAgo(selected.lastSuccessAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Credential fingerprint</p>
                        <p className="flex items-center gap-1 font-mono">
                          <Fingerprint className="h-3 w-3" />
                          {selected.credentialFingerprint}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last rotated</p>
                        <p className="flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          {formatAgo(selected.lastRotatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-50/30 p-2 text-[11px] text-muted-foreground dark:bg-amber-950/10">
                      <ShieldCheck className="mr-1 inline h-3 w-3" />
                      API credentials are never displayed in the UI. Only the fingerprint (
                      {selected.credentialFingerprint}) is shown.
                    </div>
                    {/* Payout slice (R10 PF-04) — the board promised it, so the
                        detail surfaces it here too. */}
                    {selected.payoutCapability !== "none" && (
                      <div className="mt-2 space-y-1 rounded-lg border bg-muted/20 p-2 text-[11px]">
                        <p className="font-medium uppercase tracking-wide text-muted-foreground">
                          Payout slice
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Capability</span>
                          <span className="capitalize font-medium">{selected.payoutCapability}</span>
                        </div>
                        {selected.payoutsInFlight !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">In flight</span>
                            <span className="font-medium tabular-nums">{selected.payoutsInFlight}</span>
                          </div>
                        )}
                        {selected.lastFailure && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Last failure</span>
                            <span className="font-medium">{selected.lastFailure.code}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Incident badge (P1-5, derived) */}
                    {selected.status === "degraded" && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-50/30 p-2 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        <span>
                          {selected.id === "metaapi" || selected.id === "postmark" || selected.id === "skrill-payouts"
                            ? `${selected.id === "metaapi" ? 3 : selected.id === "postmark" ? 2 : 3} open incidents correlated`
                            : "Provider degraded — check incident center for correlated incidents."}
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("provider-incident-runbook", { provider: selected.id })}
                      data-readonly-allow
                    >
                      Start incident response
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}