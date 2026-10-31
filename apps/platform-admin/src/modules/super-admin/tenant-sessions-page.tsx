"use client";

/**
 * Tenant Sessions (audit finding #4).
 *
 * "My Sessions" covers the operator's own console devices — inherently
 * tenant-less. Operators also need tenant-specific session visibility:
 * which of each firm's admins/traders are signed in, from where, how
 * recently, and whether anything looks off (stale sessions, unusual
 * locations). That is this page.
 *
 * Per session: tenant attribution (badge + filter), user + role,
 * device/browser, IP + location, and an activity indicator (Active
 * <15m · Idle <24h · Stale ≥24h — stale sessions are the security
 * signal). Tenants and users come from the shared fixtures so the view
 * stays coherent with the rest of the console.
 *
 * Frontend-only demo: revocation is a local state removal behind the
 * same 2FA step-up (CON-01) every protected console action uses; a
 * production build would call the tenant-session admin API and write a
 * `console.tenant_session_revoked` audit record.
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import { tenants, users } from "@/lib/platform/mock-data";
import { timeAgo } from "@/hooks/use-countdown";
import {
  Monitor,
  Smartphone,
  AlertTriangle,
  Activity,
  MapPin,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/** A session idle ≥24h is flagged STALE (the security signal). */
const STALE_IDLE_MS = 24 * 60 * 60 * 1000;
/** Seen within 15 minutes (the console idle timeout) counts as Active. */
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

type Activity = "active" | "idle" | "stale";

interface TenantUserSession {
  id: string;
  userId: string;
  tenantId: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  /** True when the session's location differs from the user's usual one. */
  unusualLocation?: boolean;
  createdAt: number;
  lastSeenAt: number;
}

/**
 * Session seed — derived at module load from the shared user fixtures
 * (device/IP/location are session-level facts the users fixture
 * doesn't carry). Timestamps are relative so the activity indicators
 * stay deterministic on every render.
 */
function seedSessions(): TenantUserSession[] {
  const t = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  const raw: Array<
    Omit<TenantUserSession, "createdAt" | "lastSeenAt"> & { age: number; online: number }
  > = [
    // Alpha Capital
    { id: "ts-alpha-1", userId: "user-alpha-admin", tenantId: "tenant-alpha", device: "MacBook Pro", browser: "Chrome 141 · macOS", ip: "203.0.113.51", location: "New York, US", age: 90 * day, online: 2 * min },
    { id: "ts-alpha-2", userId: "user-alpha-admin", tenantId: "tenant-alpha", device: "iPhone 16", browser: "Safari · iOS 19", ip: "203.0.113.88", location: "New York, US", age: 12 * day, online: 48 * min },
    { id: "ts-alpha-3", userId: "user-alpha-risk", tenantId: "tenant-alpha", device: "ThinkPad X1", browser: "Firefox 132 · Windows", ip: "198.51.100.7", location: "New York, US", age: 40 * day, online: 3 * hour },
    { id: "ts-alpha-4", userId: "user-alpha-finance", tenantId: "tenant-alpha", device: "Dell Latitude", browser: "Edge 140 · Windows", ip: "192.0.2.190", location: "Bucharest, RO", unusualLocation: true, age: 6 * day, online: 2 * day },
    // Beta Trading
    { id: "ts-beta-1", userId: "user-beta-admin", tenantId: "tenant-beta", device: "MacBook Air", browser: "Safari 18 · macOS", ip: "198.51.100.44", location: "London, UK", age: 120 * day, online: 5 * min },
    { id: "ts-beta-2", userId: "user-beta-marketing", tenantId: "tenant-beta", device: "Pixel 10", browser: "Chrome · Android 16", ip: "192.0.2.61", location: "London, UK", age: 20 * day, online: 40 * min },
    { id: "ts-beta-3", userId: "user-trader-1", tenantId: "tenant-beta", device: "Windows Desktop", browser: "Chrome 141 · Windows", ip: "192.0.2.144", location: "Manchester, UK", age: 3 * day, online: 12 * min },
    // Gamma Futures
    { id: "ts-gamma-1", userId: "user-gamma-admin", tenantId: "tenant-gamma", device: "MacBook Pro", browser: "Chrome 141 · macOS", ip: "203.0.113.12", location: "Singapore, SG", age: 200 * day, online: 14 * min },
    { id: "ts-gamma-2", userId: "user-gamma-admin", tenantId: "tenant-gamma", device: "iPad Pro", browser: "Safari · iPadOS 19", ip: "45.33.32.156", location: "Jakarta, ID", unusualLocation: true, age: 15 * day, online: 3 * day },
  ];

  return raw.map(({ age, online, ...s }) => ({
    ...s,
    createdAt: t - age,
    lastSeenAt: t - online,
  }));
}

const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id;
const userById = (id: string) => users.find((u) => u.id === id);

const activityOf = (s: TenantUserSession, now: number): Activity => {
  const idle = now - s.lastSeenAt;
  if (idle >= STALE_IDLE_MS) return "stale";
  if (idle >= ACTIVE_WINDOW_MS) return "idle";
  return "active";
};

const ACTIVITY_META: Record<
  Activity,
  { label: string; dot: string; badge: string; Icon: typeof Activity }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    Icon: Activity,
  },
  idle: {
    label: "Idle",
    dot: "bg-amber-400",
    badge: "border-amber-500/30 text-amber-700 dark:text-amber-400",
    Icon: Monitor,
  },
  stale: {
    label: "Stale",
    dot: "bg-rose-500",
    badge: "border-rose-500/40 text-rose-700 dark:text-rose-400",
    Icon: AlertTriangle,
  },
};

const deviceIcon = (s: TenantUserSession) =>
  /iphone|ipad|android|pixel|ios/i.test(s.device + s.browser) ? Smartphone : Monitor;

export function TenantSessionsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so loading
  // and error/retry states are exercised; revocations below are local
  // interactive state once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const [sessions, setSessions] = useState<TenantUserSession[]>(seedSessions);
  const [tenantFilter, setTenantFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<"all" | Activity>("all");
  const [revokeTarget, setRevokeTarget] = useState<TenantUserSession | null>(null);

  const now = Date.now();

  const filtered = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (tenantFilter === "all" || s.tenantId === tenantFilter) &&
          (activityFilter === "all" || activityOf(s, now) === activityFilter),
      ),
    [sessions, tenantFilter, activityFilter, now],
  );

  const stale = sessions.filter((s) => activityOf(s, now) === "stale");
  const unusual = sessions.filter((s) => s.unusualLocation);
  const tenantCount = new Set(filtered.map((s) => s.tenantId)).size;

  // Group by tenant when viewing all tenants — the tenant context is
  // the primary lens on this screen.
  const grouped = useMemo(() => {
    const byTenant = new Map<string, TenantUserSession[]>();
    for (const s of filtered) {
      const list = byTenant.get(s.tenantId) ?? [];
      list.push(s);
      byTenant.set(s.tenantId, list);
    }
    return [...byTenant.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const doRevoke = (s: TenantUserSession) => {
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    const u = userById(s.userId);
    toast({
      title: "Tenant session revoked",
      description: `${u?.name ?? s.userId} on ${s.device} (${s.location}) signed out. The user must sign in again.`,
      variant: "destructive",
    });
  };

  const announce =
    `Showing ${filtered.length} session${filtered.length === 1 ? "" : "s"}` +
    ` across ${tenantCount} tenant${tenantCount === 1 ? "" : "s"}` +
    `${activityFilter !== "all" ? ` — ${ACTIVITY_META[activityFilter].label} only` : ""}.`;

  return (
    <Page>
      <PageHeader
        title="Tenant Sessions"
        description="Active user sessions per tenant — see who from each firm is signed in, from where, and flag stale or unusual-location sessions. Your own console devices are under My Sessions."
        icon={Users}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading tenant sessions…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Sessions Shown" value={filtered.length} icon={Activity} />
          <MetricCard label="Tenants" value={tenantCount} icon={Users} />
          <MetricCard
            label="Stale (≥24h)"
            value={stale.length}
            icon={AlertTriangle}
            tone={stale.length > 0 ? "warning" : "positive"}
          />
          <MetricCard
            label="Unusual Location"
            value={unusual.length}
            icon={MapPin}
            tone={unusual.length > 0 ? "warning" : "positive"}
          />
        </div>

        {(stale.length > 0 || unusual.length > 0) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {stale.length > 0 &&
                `${stale.length} session${stale.length === 1 ? "" : "s"} idle beyond 24 hours.`}
              {stale.length > 0 && unusual.length > 0 && " "}
              {unusual.length > 0 &&
                `${unusual.length} session${unusual.length === 1 ? "" : "s"} from a location that differs from the user's usual one.`}{" "}
              Review and revoke if the user doesn't recognise them.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">Sessions by tenant</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter sessions by tenant">
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1" role="group" aria-label="Filter sessions by activity">
                {(["all", "active", "idle", "stale"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={activityFilter === a}
                    onClick={() => setActivityFilter(a)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                      activityFilter === a
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {a === "all"
                      ? "All"
                      : `${ACTIVITY_META[a].label}${a === "stale" && stale.length > 0 ? ` (${stale.length})` : ""}`}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Screen-reader summary of the filtered view (finding #3
                pattern — dynamic content updates get an announcement). */}
            <p role="status" aria-live="polite" className="sr-only">
              {announce}
            </p>

            {grouped.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No sessions match the current filters.
              </p>
            ) : (
              grouped.map(([tid, list]) => (
                <div key={tid} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {tenantName(tid)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {list.length} session{list.length === 1 ? "" : "s"}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {list.map((s) => {
                    const Icon = deviceIcon(s);
                    const activity = activityOf(s, now);
                    const meta = ACTIVITY_META[activity];
                    const u = userById(s.userId);
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md border p-3",
                          activity === "stale" && "border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10",
                          s.unusualLocation && "border-amber-500/30",
                        )}
                      >
                        <div className="rounded-md bg-muted p-2">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {u?.name ?? s.userId}
                            </p>
                            {u?.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px]">
                                {r}
                              </Badge>
                            ))}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                meta.badge,
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
                              {meta.label}
                            </span>
                            {s.unusualLocation && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400"
                              >
                                <MapPin className="mr-0.5 h-2.5 w-2.5" /> Unusual location
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.device} · {s.browser} · {s.location} · {s.ip} · active{" "}
                            {timeAgo(s.lastSeenAt, now)} · signed in {timeAgo(s.createdAt, now)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 gap-1 text-rose-600 hover:text-rose-600"
                          onClick={() => setRevokeTarget(s)}
                        >
                          <LogOut className="h-3.5 w-3.5" /> Revoke
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Session visibility (CON-30)</p>
          <p className="mt-1">
            Tenant sessions time out after 15 minutes of inactivity and expire absolutely after
            24 hours. <strong>Stale</strong> marks sessions idle beyond that window;{" "}
            <strong>Unusual location</strong> marks a session from somewhere other than the user's
            usual region. Revoking forces that user to sign in again, requires 2FA (CON-01), and is
            recorded in the platform audit trail. Your own console devices are managed under{" "}
            <strong>My Sessions</strong>.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Revocation requires a 2FA step-up (CON-01) ── */}
      <TwoFactorDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRevokeTarget(null);
        }}
        title="Revoke tenant session"
        description={
          revokeTarget
            ? `Sign out ${userById(revokeTarget.userId)?.name ?? revokeTarget.userId} on ${revokeTarget.device} (${revokeTarget.location})? They must sign in again.`
            : undefined
        }
        submitLabel="Verify & revoke"
        onVerify={(code) => {
          if (code === "000000")
            return Promise.reject(new Error("Invalid code. Please try again."));
          if (revokeTarget) doRevoke(revokeTarget);
          setRevokeTarget(null);
          return undefined;
        }}
      />
    </Page>
  );
}
