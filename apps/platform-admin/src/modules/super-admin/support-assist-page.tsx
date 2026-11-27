"use client";

/**
 * Support Assist (docs/21 CON-27).
 *
 * The console's cross-tenant support read path. The tenant realm has no
 * console access (AUTH-16), so SUP/ADM operators view a tenant's tickets
 * here — the same impersonation pattern as View-As (CON-07), but strictly
 * read-only and scoped to tenant-staff support. There is no reply /
 * resolve / escalate control in the console: triage and action happen in
 * the tenant's own support panel (docs/18). Opening a tenant's view is
 * recorded in the audit trail (CON-09 mirror).
 *
 * v3 surface — reads the shared support contract (support-store.ts).
 * All read controls carry data-readonly-allow so ReadOnlyGuard permits
 * them during View-As sessions (filtering, sorting and drilling into a
 * ticket are reads, not operations).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import { supportTickets, type SupportTicket } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/platform/guards";
import { recordAudit } from "@/lib/platform/console-store";
import { impersonationDenyReason } from "@/lib/platform/impersonation-policy";
import { cn } from "@/lib/utils";
import { useEscapeKey } from "@/hooks/use-escape-key";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Clock,
  Inbox,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* URL state (parseParams pattern)                                     */
/* ------------------------------------------------------------------ */

function parseParams(params: Record<string, string>): {
  tenant?: string;
  q?: string;
  status?: string;
  priority?: string;
  sort?: string;
  ticket?: string;
} {
  return {
    tenant: params.tenant || undefined,
    q: params.q,
    status: params.status,
    priority: params.priority,
    sort: params.sort,
    ticket: params.ticket,
  };
}

/* ------------------------------------------------------------------ */
/* Tones / labels                                                      */
/* ------------------------------------------------------------------ */

const statusTone = (s: SupportTicket["status"]) =>
  s === "open"
    ? "default"
    : s === "in-progress"
      ? "secondary"
      : s === "waiting"
        ? "outline"
        : s === "resolved"
          ? "outline"
          : "secondary";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  "in-progress": "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

/** Accepts a raw `string` so URL-derived filters can be labelled too. */
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

const priorityTone = (p: SupportTicket["priority"]) =>
  p === "urgent" ? "destructive" : p === "high" ? "default" : "secondary";

/** Tenant lifecycle dot for the scope picker (report §P1-5). */
const TENANT_STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  trial: "bg-teal-500",
  invited: "bg-teal-500",
  offboarding: "bg-amber-500",
  provisioning: "bg-sky-500",
  onboarding: "bg-sky-500",
  suspended: "bg-rose-500",
  provisioning_failed: "bg-rose-500",
  terminated: "bg-slate-400",
  rolled_back: "bg-slate-400",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function SupportAssistPage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { navigate, router, user } = usePlatform();
  const tenants = useTenants();

  /* `tenantId === null` is the all-tenants aggregate scope (report §P1-5)
   * — the default, so a bare ?view=support-assist already shows data
   * instead of an empty "pick a tenant" dead end. */
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<"newest" | "priority">("newest");
  const [asOf, setAsOf] = useState<number>(() => Date.now());

  useEscapeKey(selected !== null, () => setSelected(null));

  /* Deep-link: read ?tenant= / ?q= / ?status= / ?priority= / ?sort= /
   * ?ticket= once on mount. Runs in an effect (not a lazy useState) so
   * the server render and the first client render agree — router.params
   * is empty during SSR. */
  const bootedFromUrl = useRef(false);
  useEffect(() => {
    if (bootedFromUrl.current) return;
    bootedFromUrl.current = true;
    const p = parseParams(router.params);
    if (p.tenant) setTenantId(p.tenant);
    if (p.q) setQuery(p.q);
    if (p.status) setStatusFilter(p.status);
    if (p.priority) setPriorityFilter(p.priority);
    if (p.sort === "priority") setSortDirection("priority");
    if (p.ticket) {
      const t = supportTickets.find((x) => x.id === p.ticket);
      // Only honour the ticket deep-link when its tenant is in scope.
      if (t && (!p.tenant || t.tenantId === p.tenant)) setSelected(t);
    }
  }, []);

  /* Sync state back to the URL (§51) so a filtered view is shareable. */
  useEffect(() => {
    const params: Record<string, string> = {};
    if (tenantId) params.tenant = tenantId;
    if (selected?.id) params.ticket = selected.id;
    if (query) params.q = query;
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (sortDirection !== "newest") params.sort = sortDirection;
    navigate("support-assist", params, { replace: true });
  }, [tenantId, selected?.id, query, statusFilter, priorityFilter, sortDirection, navigate]);

  const isAggregate = tenantId === null;
  const tenant = tenantId ? (tenants.find((t) => t.id === tenantId) ?? null) : null;
  /** A `?tenant=` that no longer resolves — surfaced, never silently dropped. */
  const unknownTenant = tenantId !== null && tenant === null;

  const tickets = useMemo(
    () => (isAggregate ? supportTickets : supportTickets.filter((s) => s.tenantId === tenantId)),
    [tenantId, isAggregate],
  );

  /* Tenants that actually have tickets — the scope picker only offers
   * scopes that render something, and an empty picker gets its own
   * distinct state (report §P1-5). */
  const tenantsWithTickets = useMemo(
    () => tenants.filter((t) => supportTickets.some((s) => s.tenantId === t.id)),
    [tenants],
  );
  const tenantNameById = useMemo(
    () => new Map(tenants.map((t) => [t.id, t.name])),
    [tenants],
  );

  const statuses = ["open", "in-progress", "waiting", "resolved", "closed"] as const;
  const priorities = ["urgent", "high", "medium", "low"] as const;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = tickets.filter((t) => {
      if (q) {
        const tenantName = tenantNameById.get(t.tenantId) ?? "";
        const haystack =
          `${t.subject} ${t.traderName} ${t.id} ${t.category} ${t.assignee ?? ""} ${tenantName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
    if (sortDirection === "priority") {
      const pRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      result = [...result].sort(
        (a, b) =>
          (pRank[a.priority] ?? 99) - (pRank[b.priority] ?? 99) ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    } else {
      result = [...result].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return result;
  }, [tickets, query, statusFilter, priorityFilter, sortDirection, tenantNameById]);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in-progress").length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent").length;

  /* CON-09 mirror — opening a scope is audited once per scope. */
  const denyReason = tenant ? impersonationDenyReason(tenant) : null;
  const scopeKey = tenant?.id ?? (isAggregate ? "all-tenants" : null);
  const auditedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!scopeKey || auditedFor.current === scopeKey) return;
    auditedFor.current = scopeKey;
    const count = tickets.length;
    recordAudit({
      actor: user.name,
      action: "console.support_assist_open",
      target: scopeKey,
      ...(tenant ? { tenantId: tenant.id } : {}),
      severity: "info",
      detail: tenant
        ? denyReason
          ? `Read-only support view opened for ${tenant.name} (${count} tickets) — CON-27 impersonation pattern [impersonation-exempt: ${denyReason}]`
          : `Read-only support view opened for ${tenant.name} (${count} tickets) — CON-27 impersonation pattern`
        : `Cross-tenant support view opened (all tenants, ${count} tickets) — CON-27 impersonation pattern`,
    });
  }, [scopeKey, tenant, tickets.length, user.name, denyReason]);

  /* Changing scope must not leave a ticket detail from the old scope. */
  useEffect(() => {
    setSelected((prev) => (prev && tenantId && prev.tenantId !== tenantId ? null : prev));
  }, [tenantId]);

  const hasFilters = Boolean(query || statusFilter || priorityFilter);
  const handleClearFilters = () => {
    setQuery("");
    setStatusFilter(undefined);
    setPriorityFilter(undefined);
  };
  const handleRefresh = () => {
    setAsOf(Date.now());
    retry();
  };
  const toggleStatus = (s: string) =>
    setStatusFilter((cur) => (cur === s ? undefined : s));
  const togglePriority = (p: string) =>
    setPriorityFilter((cur) => (cur === p ? undefined : p));

  return (
    <Page>
      <PageHeader
        title="Support assist"
        description="Cross-tenant, read-only view of tenant support tickets (CON-27). The console mirrors the impersonation pattern — there is no reply or resolve here; triage happens in the tenant's own support panel (docs/18)."
        icon={Inbox}
        actions={
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Read-only
          </Badge>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading support context…"
        >
          {tenantsWithTickets.length === 0 ? (
            <EmptyState
              title="No support tickets on record"
              description="No tenant has raised a ticket yet. Tickets appear here as soon as a trader or operator opens one in their tenant's support panel (docs/18)."
              icon={Inbox}
            />
          ) : (
            <>
              {/* Scope picker — all-tenants aggregate + per-tenant scopes,
                  each carrying its lifecycle dot (report §P1-5). */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Scope:</span>
                <Button
                  size="sm"
                  variant={isAggregate ? "default" : "outline"}
                  onClick={() => setTenantId(null)}
                  data-readonly-allow
                >
                  All tenants
                  <span className="text-[10px] opacity-70">{supportTickets.length}</span>
                </Button>
                {tenantsWithTickets.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={tenantId === t.id ? "default" : "outline"}
                    onClick={() => setTenantId(t.id)}
                    data-readonly-allow
                  >
                    {t.name}
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
                    <span className="text-[10px] opacity-70">
                      · {t.status.replace("_", " ")}
                    </span>
                  </Button>
                ))}
              </div>

              {/* P1-1 — impersonation-denied tenants stay visible here:
                  the deny reason is surfaced, not silently swallowed. */}
              {tenant && denyReason && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">View-As blocked for {tenant.name}:</span>{" "}
                    {denyReason}. Support Assist is exempt (CON-27) — this read-only mirror
                    stays available; only the impersonated session is refused.
                  </span>
                </div>
              )}

              {unknownTenant ? (
                <EmptyState
                  title="Unknown tenant"
                  description={`No tenant with id "${tenantId}" exists — the link may be stale or the tenant may have been deleted.`}
                  icon={Search}
                  action={
                    <Button size="sm" variant="outline" onClick={() => setTenantId(null)} data-readonly-allow>
                      Show all tenants
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MetricScope>
                      <MetricCard
                        label="Open"
                        value={openCount}
                        icon={Inbox}
                        tone={openCount > 0 ? "warning" : "positive"}
                        onClick={() => toggleStatus("open")}
                      />
                    </MetricScope>
                    <MetricScope>
                      <MetricCard
                        label="In progress"
                        value={inProgress}
                        icon={MessageSquare}
                        onClick={() => toggleStatus("in-progress")}
                      />
                    </MetricScope>
                    <MetricScope>
                      <MetricCard
                        label="Urgent"
                        value={urgentCount}
                        icon={AlertTriangle}
                        tone={urgentCount > 0 ? "negative" : "positive"}
                        onClick={() => togglePriority("urgent")}
                      />
                    </MetricScope>
                    <MetricScope>
                      <MetricCard
                        label="Total tickets"
                        value={tickets.length}
                        icon={Inbox}
                        onClick={handleClearFilters}
                      />
                    </MetricScope>
                  </div>

                  {/* Filters — status/priority chips, sort toggle, clear,
                      as-of stamp + refresh (report §P1-4 / §P2-2). */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                          isAggregate
                            ? "Search all tickets by subject, trader, tenant, or id…"
                            : `Search ${tenant?.name ?? "tenant"} tickets by subject, trader, or id…`
                        }
                        aria-label="Search support tickets"
                        className="h-8 max-w-sm text-sm"
                        data-readonly-allow
                      />
                      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        <span>As of {new Date(asOf).toLocaleTimeString()}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRefresh}
                          disabled={loading}
                          data-readonly-allow
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Status:</span>
                      <ChipButton active={statusFilter === undefined} onClick={() => setStatusFilter(undefined)}>
                        All
                      </ChipButton>
                      {statuses.map((s) => (
                        <ChipButton
                          key={s}
                          active={statusFilter === s}
                          onClick={() => toggleStatus(s)}
                        >
                          {statusLabel(s)}
                        </ChipButton>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Priority:</span>
                      <ChipButton active={priorityFilter === undefined} onClick={() => setPriorityFilter(undefined)}>
                        All
                      </ChipButton>
                      {priorities.map((p) => (
                        <ChipButton
                          key={p}
                          active={priorityFilter === p}
                          onClick={() => togglePriority(p)}
                        >
                          <span className="capitalize">{p}</span>
                        </ChipButton>
                      ))}

                      <div className="ml-auto flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSortDirection((d) => (d === "newest" ? "priority" : "newest"))
                          }
                          data-readonly-allow
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                          {sortDirection === "newest" ? "Newest first" : "Priority first"}
                        </Button>
                        {hasFilters && (
                          <Button size="sm" variant="ghost" onClick={handleClearFilters} data-readonly-allow>
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-4",
                      selected ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "",
                    )}
                  >
                    <div className="min-w-0">
                      {filtered.length === 0 ? (
                        <EmptyState
                          title="No tickets match"
                          description={
                            hasFilters
                              ? `Nothing in this scope matches the current filters${query ? ` for "${query}"` : ""}.`
                              : `${isAggregate ? "The platform" : tenant?.name ?? "This tenant"} has no tickets yet.`
                          }
                          icon={Search}
                          action={
                            hasFilters ? (
                              <Button size="sm" variant="outline" onClick={handleClearFilters} data-readonly-allow>
                                <X className="h-3.5 w-3.5" aria-hidden />
                                Clear filters
                              </Button>
                            ) : undefined
                          }
                        />
                      ) : (
                        <div className="grid gap-3">
                          {filtered.map((t) => (
                            <button
                              key={t.id}
                              className={cn(
                                "flex w-full flex-col gap-1 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40",
                                selected?.id === t.id && "border-primary ring-1 ring-primary/30",
                              )}
                              onClick={() => setSelected(t)}
                              data-readonly-allow
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">{t.subject}</span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <Badge variant={statusTone(t.status)} className="text-[9px] capitalize">
                                    {statusLabel(t.status)}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <User className="h-3 w-3" aria-hidden /> {t.traderName}
                                {isAggregate && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{tenantNameById.get(t.tenantId) ?? t.tenantId}</span>
                                  </>
                                )}
                                <span aria-hidden>·</span>
                                <span className="capitalize">{t.category}</span>
                                <span aria-hidden>·</span>
                                <span>{t.messages} msgs</span>
                                {t.assignee && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{t.assignee}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={priorityTone(t.priority)} className="text-[9px] capitalize">
                                  {t.priority}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(t.createdAt)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ticket detail + thread preview (report §P2-5) —
                        read-only: close + jump to the tenant's own panel. */}
                    {selected && (
                      <Card className="h-fit lg:sticky lg:top-4">
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{selected.subject}</p>
                              <p className="text-[11px] text-muted-foreground">{selected.id}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Close ticket detail"
                              className="size-7 shrink-0"
                              onClick={() => setSelected(null)}
                              data-readonly-allow
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={statusTone(selected.status)} className="text-[10px]">
                              {statusLabel(selected.status)}
                            </Badge>
                            <Badge variant={priorityTone(selected.priority)} className="text-[10px] capitalize">
                              {selected.priority}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {selected.category}
                            </Badge>
                            {isAggregate && (
                              <Badge variant="outline" className="text-[10px]">
                                {tenantNameById.get(selected.tenantId) ?? selected.tenantId}
                              </Badge>
                            )}
                          </div>

                          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            <DetailField label="Trader" value={selected.traderName} />
                            <DetailField label="Assignee" value={selected.assignee ?? "Unassigned"} />
                            <DetailField label="Opened" value={formatDate(selected.createdAt)} />
                            <DetailField
                              label="Last reply"
                              value={selected.lastReplyAt ? formatDate(selected.lastReplyAt) : "—"}
                            />
                          </dl>

                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Thread preview · {selected.messages} message{selected.messages === 1 ? "" : "s"}
                            </p>
                            <div className="mt-2 space-y-2 text-xs">
                              <div>
                                <p className="font-medium">
                                  {selected.traderName}{" "}
                                  <span className="font-normal text-muted-foreground">
                                    · {formatDate(selected.createdAt)}
                                  </span>
                                </p>
                                <p className="text-muted-foreground">{selected.subject}</p>
                              </div>
                              {selected.lastReplyAt && (
                                <div>
                                  <p className="font-medium">
                                    {selected.assignee ?? "Support Team"}{" "}
                                    <span className="font-normal text-muted-foreground">
                                      · {formatDate(selected.lastReplyAt)}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Latest reply — {Math.max(0, selected.messages - 1)} follow-up
                                    message{selected.messages - 1 === 1 ? "" : "s"} in the thread.
                                  </p>
                                </div>
                              )}
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              The full thread lives in the tenant&apos;s own support panel
                              (docs/18) — this mirror is read-only.
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate("tenant-detail", { id: selected.tenantId })}
                            data-readonly-allow
                          >
                            Open tenant detail
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">How support assist works (CON-27)</p>
                    <p className="mt-1">
                      The tenant realm has no console access (AUTH-16), so when support needs a
                      cross-tenant look, the console opens a read-only mirror of the tenant
                      ticket queue — the same impersonation pattern as View-As (CON-07), minus
                      the action surface. Every scope open is recorded in the audit trail;
                      tenants blocked from View-As stay visible here with the reason shown.
                      Action stays in the tenant&apos;s own support tooling (docs/18).
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

/**
 * MetricCard drill-downs are reads, but MetricCard renders no DOM
 * attributes of its own — wrap it in a `display: contents` marker so
 * ReadOnlyGuard's `closest("[data-readonly-allow]")` lets the click
 * through without perturbing the grid.
 */
function MetricScope({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents" data-readonly-allow>
      {children}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-7 px-2.5 text-xs"
      onClick={onClick}
      data-readonly-allow
    >
      {children}
    </Button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
