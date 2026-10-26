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
 * V2 surface. Reads the shared `supportTickets` mock keyed by tenant.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { supportTickets, type SupportTicket } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/platform/guards";
import { recordAudit } from "@/lib/platform/console-store";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  Inbox,
  Lock,
  MessageSquare,
  Search,
  User,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */

const statusTone = (s: SupportTicket["status"]) =>
  s === "open"
    ? "default"
    : s === "in-progress"
      ? "secondary"
      : s === "waiting"
        ? "outline"
        : "secondary";

const priorityTone = (p: SupportTicket["priority"]) =>
  p === "urgent" ? "destructive" : p === "high" ? "default" : "secondary";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SupportAssistPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { availableTenants, navigate, user } = usePlatform();
  const tenantsWithTickets = useMemo(
    () =>
      availableTenants.filter((t) =>
        supportTickets.some((s) => s.tenantId === t.id),
      ),
    [availableTenants],
  );

  const [tenantId, setTenantId] = useState<string | null>(
    tenantsWithTickets[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const tenant = availableTenants.find((t) => t.id === tenantId) ?? null;
  const tickets = useMemo(
    () => supportTickets.filter((s) => s.tenantId === tenantId),
    [tenantId],
  );

  /* ---- Audit the read (CON-09 mirror: every cross-tenant read audited) ---- */
  const auditedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!tenant || auditedFor.current === tenant.id) return;
    auditedFor.current = tenant.id;
    recordAudit({
      actor: user.name,
      action: "console.support_assist_open",
      target: tenant.id,
      tenantId: tenant.id,
      severity: "info",
      detail: `Read-only support view opened for ${tenant.name} (${tickets.length} tickets) — CON-27 impersonation pattern`,
    });
  }, [tenant, tickets.length, user.name]);

  /* Reset selection when the tenant changes. */
  useEffect(() => {
    setSelected(null);
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.traderName.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [tickets, query]);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent").length;
  const inProgress = tickets.filter((t) => t.status === "in-progress").length;

  return (
    <Page>
      <PageHeader
        title="Support assist"
        description="Cross-tenant, read-only view of a tenant's support tickets (CON-27). The console mirrors the impersonation pattern — there is no reply or resolve here; triage happens in the tenant's own support panel (docs/18)."
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
        {/* ── Tenant picker ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Tenant:</span>
          {tenantsWithTickets.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={t.id === tenantId ? "default" : "outline"}
              onClick={() => setTenantId(t.id)}
            >
              {t.name}
            </Button>
          ))}
        </div>

        {!tenant ? (
          <EmptyState
            title="No tenant selected"
            description="Pick a tenant above to view its support queue."
            icon={Inbox}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Open" value={openCount} icon={Inbox} tone={openCount > 0 ? "warning" : "positive"} />
              <MetricCard label="In progress" value={inProgress} icon={MessageSquare} />
              <MetricCard label="Urgent" value={urgentCount} icon={AlertTriangle} tone={urgentCount > 0 ? "negative" : "positive"} />
              <MetricCard label="Total tickets" value={tickets.length} icon={Inbox} />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${tenant.name} tickets by subject, trader, or id…`}
                  className="pl-8"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No tickets match"
                description={query ? `Nothing matches "${query}".` : `${tenant.name} has no tickets yet.`}
                icon={Search}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* ── Ticket list ──────────────────────────────────── */}
                <Card>
                  <CardContent className="divide-y p-0">
                    {filtered.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          selected?.id === t.id && "bg-muted/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.subject}</span>
                          <Badge variant={statusTone(t.status)} className="shrink-0 text-[9px] capitalize">
                            {t.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3" /> {t.traderName}
                          <span>·</span>
                          <span className="capitalize">{t.category}</span>
                          <span>·</span>
                          <span>{t.messages} msgs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={priorityTone(t.priority)} className="text-[9px] capitalize">
                            {t.priority}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{t.createdAt}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* ── Detail pane ──────────────────────────────────── */}
                {selected ? (
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{selected.subject}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {selected.id} · opened {selected.createdAt}
                          </p>
                        </div>
                        <Badge variant={statusTone(selected.status)} className="capitalize">
                          {selected.status}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trader</p>
                          <p className="font-medium">{selected.traderName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</p>
                          <p className="font-medium capitalize">{selected.category}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority</p>
                          <p className="font-medium capitalize">{selected.priority}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Messages</p>
                          <p className="font-medium">{selected.messages}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assignee</p>
                          <p className="font-medium">{selected.assignee ?? "Unassigned"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last reply</p>
                          <p className="font-medium">{selected.lastReplyAt ?? "—"}</p>
                        </div>
                      </div>

                      <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                        <p className="flex items-center gap-1 font-medium text-foreground">
                          <Eye className="h-3 w-3" /> Read-only view
                        </p>
                        <p className="mt-1">
                          Replying, resolving, or reassigning happens in {tenant.name}&apos;s support
                          panel (docs/18). This console view is for cross-tenant context only —
                          opened reads are audited (CON-09).
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("tenant-detail", { id: tenant.id })}
                      >
                        Open {tenant.name} detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex h-full items-center justify-center p-8">
                      <EmptyState
                        title="Select a ticket"
                        description="Pick a ticket from the list to read its details."
                        icon={MessageSquare}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How support assist works (CON-27)</p>
              <p className="mt-1">
                The tenant realm has no console access (AUTH-16), so when support needs a
                cross-tenant look, the console opens a read-only mirror of that tenant&apos;s
                ticket queue — the same impersonation pattern as View-As (CON-07), minus the
                action surface. Every open is recorded in the audit trail. V2 surface; action
                stays in the tenant&apos;s own support tooling (docs/18).
              </p>
            </div>
          </>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
