"use client";

/**
 * PFaaS Platform — Platform Context
 *
 * Spec sections 10, 11, 60, 61. Central runtime context: auth + tenant +
 * permissions + module runtime. Also owns the lightweight client-side
 * "router" (view state) since only `/` is user-visible.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ApplicationId,
  AppNotification,
  AuthUser,
  ModuleRuntimeContext,
  TenantContext,
} from "./types";
import {
  platformTenant,
  tenants,
  users,
} from "./mock-data";
import {
  useConsoleStore,
  recordAudit,
  type ApprovalRequest,
  startImpersonation as startConsoleImpersonation,
  endImpersonation as endConsoleImpersonation,
  renewImpersonation as renewConsoleImpersonation,
} from "./console-store";
import { requestReason } from "./approval-apply";
import { toast } from "@/hooks/use-toast";
import { applyTenantBranding, applyThemeMode } from "./theme-engine";

/* ------------------------------------------------------------------ */
/* Router (client-side view state)                                     */
/* ------------------------------------------------------------------ */

export interface RouterState {
  view: string;
  params: Record<string, string>;
  history: string[];
}

/* ------------------------------------------------------------------ */
/* Context shape                                                       */
/* ------------------------------------------------------------------ */

export interface PlatformContextValue {
  /* auth */
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  /** Merge profile edits into the current user and persist across reloads. */
  updateUser: (patch: Partial<AuthUser>) => void;
  /* tenant */
  tenant: TenantContext;
  setTenant: (t: TenantContext) => void;
  availableTenants: TenantContext[];
  /* tenants created at runtime via Create Tenant wizard */
  registerTenant: (t: TenantContext) => void;
  /* theme */
  themeMode: "light" | "dark";
  setThemeMode: (mode: "light" | "dark") => void;
  /* router */
  router: RouterState;
  navigate: (view: string, params?: Record<string, string>) => void;
  back: () => void;
  /* module runtime */
  runtime: ModuleRuntimeContext;
  /* notifications */
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  /* impersonation — single source of truth is the console store (P0-1):
   * both entry points write the same audited session; the banner, the
   * read-only gate and the auto-restore below all derive from it. */
  isImpersonating: boolean;
  impersonationSession: { tenantId: string; tenantName?: string; started: number; expires: number } | null;
  startImpersonation: (session: { tenantId: string; tenantName?: string; operator?: { id: string; name: string } }) => void;
  endImpersonation: () => void;
  renewImpersonation: () => void;
  /* command menu */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  /* sidebar */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  /* dashboard customization (spec §23) */
  hiddenWidgets: Set<string>;
  toggleWidget: (widgetId: string) => void;
  resetDashboard: () => void;
  setHiddenWidgets: (widgets: Set<string>) => void;
  customizeOpen: boolean;
  setCustomizeOpen: (open: boolean) => void;
  /* global search (spec §38) */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

// Exported so surfaces that mount widget components into imperative DOM
// containers (e.g. GridStack previews) can wrap them in a context override.
export const PlatformContext = createContext<PlatformContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Default notifications (seeded for demo)                             */
/* ------------------------------------------------------------------ */

const seedNotifications: AppNotification[] = [
  {
    id: "n1",
    title: "New payout request",
    message: "Tom Allen requested a $4,250 withdrawal.",
    severity: "info",
    module: "payouts",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    actionLabel: "Review",
    actionHref: "cross-tenant-queues",
  },
  {
    id: "n2",
    title: "Breach detected",
    message: "Max drawdown exceeded on account acct-beta-7.",
    severity: "critical",
    module: "risk",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    actionLabel: "Investigate",
    actionHref: "abuse-signals",
  },
  {
    id: "n3",
    title: "KYC review needed",
    message: "5 KYC submissions pending review for > 24h.",
    severity: "warning",
    module: "kyc",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    actionLabel: "Open",
    actionHref: "cross-tenant-queues",
  },
  {
    id: "n4",
    title: "Module enabled",
    message: "Analytics module was enabled for this tenant.",
    severity: "success",
    module: "settings",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

// Demo user/tenant persistence (survives page reloads — the app is a demo
// switcher, so restoring the last-used identity is far less confusing than
// snapping back to the default user on every F5).
const DEMO_USER_KEY = "pfaas:demoUser";
const DEMO_TENANT_KEY = "pfaas:demoTenant";
const ROUTE_PARAM = "view";

const USER_OVERRIDES_KEY = "pfaas:userOverrides";
/** Same-tab signal: patchUserOverride fired → subscribers re-read. */
const USER_OVERRIDES_EVENT = "pfaas:user-overrides-changed";

/** Profile edits (name/email/avatar) persisted per user id. */
export function readUserOverrides(): Record<string, Partial<AuthUser>> {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(USER_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Partial<AuthUser>>) : {};
    } catch { /* ignore */ }
  }
  return {};
}

/**
 * Patch any operator's persisted overrides (gap S-01 / P0-3): the
 * directory's Edit / Suspend / Activate actions write here — the same
 * `pfaas:userOverrides` key profile edits already use, so no new
 * storage key exists and patches merge (never clobber) per user id.
 * A same-tab event keeps mounted surfaces (the directory) in sync;
 * cross-tab sync rides the native `storage` event.
 */
export function patchUserOverride(id: string, patch: Partial<AuthUser>): void {
  if (typeof window === "undefined") return;
  try {
    const all = readUserOverrides();
    all[id] = { ...(all[id] ?? {}), ...patch };
    window.localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(USER_OVERRIDES_EVENT));
  } catch { /* ignore quota */ }
}

/**
 * Live view of persisted per-operator overrides (S-01/P0-3). The
 * directory merges these over its seed users, so lifecycle transitions
 * approved on *any* page — and patches from other tabs — show up here
 * without a manual refresh.
 */
export function useUserOverrides(): Record<string, Partial<AuthUser>> {
  const [overrides, setOverrides] = useState<Record<string, Partial<AuthUser>>>(readUserOverrides);
  useEffect(() => {
    const sync = () => setOverrides(readUserOverrides());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === USER_OVERRIDES_KEY) sync();
    };
    window.addEventListener(USER_OVERRIDES_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(USER_OVERRIDES_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return overrides;
}

/**
 * Staged directory mutation (gap S-01/S-02 — P0-3): profile/MFA edits and
 * lifecycle transitions, applied exactly once by the approval bridge.
 */
export type OperatorMutation = {
  kind: "suspend" | "activate" | "edit";
  userId: string;
  name: string;
  email: string;
  mfa?: AuthUser["mfa"];
};

/**
 * Apply an approved `operator.*` request (gap S-01/S-02 lifecycle —
 * called exactly once by the approval bridge). Guards are re-checked at
 * apply time: an approval can never suspend the operator who approved
 * it (the initiator-side self-suspend button is already disabled).
 */
export function applyOperatorApproval(
  request: ApprovalRequest,
): { title: string; description: string } | void {
  const payload = request.payload as OperatorMutation | undefined;
  if (!payload?.userId || !payload.kind) return;
  const { kind, userId, name } = payload;
  const approver = request.approver?.name ?? "second operator";
  const reason = requestReason(request);
  const because = reason ? `; reason: ${reason}` : "";

  if (kind === "suspend" && request.approver?.id === userId) {
    return {
      title: "Self-suspension blocked",
      description: `${name} approved this request — an operator can never suspend their own access.`,
    };
  }

  if (kind === "suspend") {
    patchUserOverride(userId, { status: "suspended" });
    recordAudit({
      actor: approver,
      action: "operator.suspended",
      target: name ?? userId,
      severity: "warning",
      detail: `Suspended operator ${name} (${payload.email ?? userId}) — console access revoked; initiated by ${request.initiator.name}${because}`,
    });
    return {
      title: "Operator suspended",
      description: `${name} lost console access — status, audit row and this toast agree.`,
    };
  }

  if (kind === "activate") {
    patchUserOverride(userId, { status: "active" });
    recordAudit({
      actor: approver,
      action: "operator.activated",
      target: name ?? userId,
      severity: "info",
      detail: `Reactivated operator ${name} (${payload.email ?? userId}) — console access restored; initiated by ${request.initiator.name}${because}`,
    });
    return {
      title: "Operator reactivated",
      description: `${name} can sign in again — status, audit row and this toast agree.`,
    };
  }

  if (kind === "edit") {
    // Diff against the *effective* value (seed merged with overrides) so
    // the audit names exactly the fields that really changed.
    const seed = users.find((u) => u.id === userId);
    const before = { ...seed, ...readUserOverrides()[userId] };
    patchUserOverride(userId, {
      name: payload.name,
      email: payload.email,
      mfa: payload.mfa,
    });
    const changed = [
      before.name !== payload.name ? "name" : null,
      before.email !== payload.email ? "email" : null,
      (before.mfa ?? "enabled") !== payload.mfa ? "MFA status" : null,
    ].filter(Boolean);
    recordAudit({
      actor: approver,
      action: "operator.updated",
      target: payload.name ?? userId,
      severity: "info",
      detail: `Updated operator ${payload.name}: ${changed.join(", ") || "profile fields"} to their new values; initiated by ${request.initiator.name}${because}`,
    });
    return {
      title: "Operator updated",
      description: `${payload.name}'s profile change is saved and audited.`,
    };
  }

  return {
    title: "Nothing applied",
    description: `Unknown operator mutation "${kind}" — the staged payload was ignored.`,
  };
}

function readStoredUser(): AuthUser {
  if (typeof window !== "undefined") {
    try {
      const id = window.localStorage.getItem(DEMO_USER_KEY);
      const found = (id && users.find((u) => u.id === id)) || users[0];
      // Merge persisted profile edits so name/email/avatar survive reloads
      const patch = readUserOverrides()[found.id];
      return patch ? { ...found, ...patch } : found;
    } catch { /* ignore */ }
  }
  return users[0]; // Alex Morgan — super-admin (default)
}

function readStoredTenantId(): string | null {
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(DEMO_TENANT_KEY);
    } catch { /* ignore */ }
  }
  return null;
}

/** Parse the current URL (?view=tenant-detail&id=…) into router state. */
function routerStateFromUrl(): RouterState {
  const fallback: RouterState = { view: "super-overview", params: {}, history: ["super-overview"] };
  if (typeof window === "undefined") return fallback;
  try {
    const usp = new URLSearchParams(window.location.search);
    const view = usp.get(ROUTE_PARAM);
    if (!view) return fallback;
    const params: Record<string, string> = {};
    usp.forEach((v, k) => {
      if (k !== ROUTE_PARAM) params[k] = v;
    });
    return { view, params, history: [view] };
  } catch {
    return fallback;
  }
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(readStoredUser); // persisted, falls back to Alex Morgan (super-admin)
  const [customTenants, setCustomTenants] = useState<TenantContext[]>(() => {
    // Tenants created at runtime (Create Tenant wizard) persist across reloads.
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("pfaas:customTenants");
      return raw ? (JSON.parse(raw) as TenantContext[]) : [];
    } catch { return []; }
  });
  const [tenant, setTenant] = useState<TenantContext>(() => {
    const storedId = readStoredTenantId();
    if (storedId) {
      const all = [...tenants, ...customTenants];
      return all.find((t) => t.id === storedId) ?? platformTenant;
    }
    // No stored tenant: pick the tenant that matches the (default) user.
    // Super-admin users use the platform pseudo-tenant; tenant-bound users
    // use their own tenant.
    const userTenant = users.find((u) => u.id === user.id)?.tenantId;
    if (userTenant) {
      const all = [...tenants, ...customTenants];
      return all.find((t) => t.id === userTenant) ?? platformTenant;
    }
    return platformTenant;
  });
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    // Persist theme choice so F5 doesn't reset it
    if (typeof window === "undefined") return "light";
    try {
      const t = window.localStorage.getItem("pfaas:theme");
      return t === "dark" ? "dark" : "light";
    } catch { return "light"; }
  });
  const [router, setRouter] = useState<RouterState>(() => {
    // First-boot: land on the platform overview. Legacy bookmarks with the
    // removed `?view=overview` sentinel (copied from prop-admin) fall back too.
    const url = routerStateFromUrl();
    if (url.view && url.view !== "overview") return url;
    return { view: "super-overview", params: {}, history: ["super-overview"] };
  });
  const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Persist per-tenant sidebar collapse so F5 keeps the operator's choice
    // and so different tenants can have different layouts (mirrors the
    // per-tenant hiddenWidgets key below).
    if (typeof window === "undefined") return false;
    try {
      const tid = window.localStorage.getItem(DEMO_TENANT_KEY) ?? "platform";
      return window.localStorage.getItem(`pfaas:sidebarCollapsed:${tid}`) === "1";
    } catch { return false; }
  });
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    // Load persisted hidden widgets from localStorage, scoped per-tenant
    // so Sarah (Alpha) hiding a widget doesn't affect Daniel (Beta) —
    // the previous global key caused cross-tenant state leakage.
    if (typeof window === "undefined") return new Set();
    try {
      const tid = window.localStorage.getItem(DEMO_TENANT_KEY) ?? "platform";
      const stored = window.localStorage.getItem(`pfaas:hiddenWidgets:${tid}`);
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        return new Set(arr);
      }
    } catch { /* ignore parse errors */ }
    return new Set();
  });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  /* Impersonation — the console store is the single source of truth
   * (gap P0-1): the View-As page and tenant-detail "Login as" both
   * write the same audited 15-minute session, and the banner, the
   * read-only gate and the auto-restore below all derive from it, so
   * banner and store can never disagree (X-17). The 1-second sweeper
   * (started on first subscribe) auto-ends expired sessions here too. */
  const consoleState = useConsoleStore();
  const activeImpersonation =
    consoleState.impersonations.find((i) => !i.endedAt) ?? null;
  const isImpersonating = activeImpersonation !== null;
  const impersonationSession = activeImpersonation
    ? {
        tenantId: activeImpersonation.tenantId,
        tenantName: activeImpersonation.tenantName,
        started: activeImpersonation.startedAt,
        expires: activeImpersonation.expiresAt,
      }
    : null;
  /* Operator identity captured the moment a session starts — restored
   * automatically when it ends (manual, from any surface, or by the
   * deadline sweeper). */
  const preImpersonationRef = useRef<{ user: AuthUser; tenant: TenantContext } | null>(null);

  // Reload hiddenWidgets + sidebarCollapsed whenever the active tenant
  // changes — otherwise switching tenants leaves stale per-tenant state.
  // This deliberately syncs from external storage (localStorage) to React
  // state on tenant change; the rule against setState-in-effect targets
  // cascading renders on every tick, which doesn't apply here since the
  // effect only fires on tenant.id change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(`pfaas:hiddenWidgets:${tenant.id}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHiddenWidgets(stored ? new Set(JSON.parse(stored) as string[]) : new Set());
      setSidebarCollapsed(window.localStorage.getItem(`pfaas:sidebarCollapsed:${tenant.id}`) === "1");
    } catch { /* ignore parse errors */ }
  }, [tenant.id]);

  // Persist hidden widgets to per-tenant localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `pfaas:hiddenWidgets:${tenant.id}`,
        JSON.stringify(Array.from(hiddenWidgets)),
      );
    } catch { /* ignore quota errors */ }
  }, [hiddenWidgets, tenant.id]);

  // Persist sidebar collapse per-tenant
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`pfaas:sidebarCollapsed:${tenant.id}`, sidebarCollapsed ? "1" : "0");
    } catch { /* ignore quota errors */ }
  }, [sidebarCollapsed, tenant.id]);

  // Persist demo user/tenant selection so F5 doesn't reset identity
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEMO_USER_KEY, user.id);
      window.localStorage.setItem(DEMO_TENANT_KEY, tenant.id);
    } catch { /* ignore quota errors */ }
  }, [user, tenant]);

  // Persist theme mode so reloads keep the operator's preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pfaas:theme", themeMode);
    } catch { /* ignore quota errors */ }
  }, [themeMode]);

  // Persist runtime-created tenants so they survive reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pfaas:customTenants", JSON.stringify(customTenants));
    } catch { /* ignore quota errors */ }
  }, [customTenants]);

  const registerTenant = useCallback((t: TenantContext) => {
    // Persist synchronously: tenant-store (and the go-live wizard, which
    // sets progress.tenantId in the same handler) read localStorage
    // directly and must see the tenant immediately — not after the
    // mirror effect below flushes (R2-W3-04).
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("pfaas:customTenants");
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed)
          ? parsed.filter((x): x is TenantContext => !!x && typeof (x as TenantContext).id === "string")
          : [];
        if (!list.some((x) => x.id === t.id)) {
          window.localStorage.setItem("pfaas:customTenants", JSON.stringify([...list, t]));
        }
      } catch { /* ignore quota errors */ }
    }
    setCustomTenants((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
  }, []);

  // Profile edits: merge into live user + persist per user id (survive reloads)
  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      patchUserOverride(next.id, patch);
      return next;
    });
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  }, []);

  const resetDashboard = useCallback(() => {
    setHiddenWidgets(new Set());
  }, []);

  // Apply branding + theme mode whenever they change
  useEffect(() => {
    applyTenantBranding(tenant.branding);
  }, [tenant]);

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  // Cmd+K to open command menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sync router view/params into the URL so refresh, browser back/forward,
  // bookmarks and shared links all work (the app is a single `/` route).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const usp = new URLSearchParams();
      if (router.view && router.view !== "super-overview") usp.set(ROUTE_PARAM, router.view);
      Object.entries(router.params).forEach(([k, v]) => usp.set(k, v));
      const qs = usp.toString();
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      if (window.location.search !== (qs ? `?${qs}` : "")) {
        window.history.pushState({ view: router.view }, "", nextUrl);
      }
    } catch { /* ignore */ }
  }, [router.view, router.params]);

  // Browser back/forward → sync router from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const s = routerStateFromUrl();
      setRouter((r) => ({ ...s, history: [...r.history, s.view].slice(-32) }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((view: string, params: Record<string, string> = {}) => {
    setRouter((r) => ({ view, params, history: [...r.history, view].slice(-32) }));
  }, []);

  const back = useCallback(() => {
    // Prefer real browser history (keeps the URL in sync via popstate)
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    setRouter((r) => {
      if (r.history.length < 2) return r;
      const history = r.history.slice(0, -1);
      const view = history[history.length - 1] ?? "super-overview";
      return { view, params: {}, history };
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }, []);
  const markAllRead = useCallback(() => {
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  }, []);
  const pushNotification = useCallback(
  (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((list) => [
      {
        ...n,
        id: `n-${Date.now()}`,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...list,
    ]);
  },
  [],
);
  // Impersonation helpers — every path delegates to the console store
  // (audited start/renew/end, 15-minute TTL, sweeper-enforced), so the
  // tenant-detail entry point gains the audit, expiry and deny-list
  // coverage the View-As page always had (gap P0-1). start captures the
  // pre-session identity for the auto-restore below.
  const startImpersonation = (session: { tenantId: string; tenantName?: string; operator?: { id: string; name: string } }) => {
    if (!activeImpersonation) {
      preImpersonationRef.current = { user, tenant };
    }
    startConsoleImpersonation({
      tenantId: session.tenantId,
      tenantName: session.tenantName ?? session.tenantId,
      operator: session.operator ?? { id: user.id, name: user.name },
    });
  };
  const endImpersonation = () => {
    if (!activeImpersonation) return;
    const name = activeImpersonation.tenantName;
    endConsoleImpersonation(activeImpersonation.id, "manual");
    toast({
      title: "View-As session ended",
      description: `Returned to platform operator view — ${name} session logged (audited).`,
    });
  };
  const renewImpersonation = () => {
    if (!activeImpersonation) return;
    renewConsoleImpersonation(activeImpersonation.id);
    toast({
      title: "Session extended",
      description: `${activeImpersonation.tenantName} — renewed for another 15 minutes (audited).`,
    });
  };

  /* Auto-restore (P0-1/X-17): the moment the active session ends —
   * however it ends (banner End, View-As End, 15-minute sweeper) —
   * return to the operator identity captured at start. Sessions that
   * survived a reload have no captured identity and fall back to the
   * platform operator. Sweeper (expiry) endings toast here so state,
   * audit and toast describe the same outcome; manual endings already
   * toast from endImpersonation above. */
  const lastImpersonationIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = activeImpersonation?.id ?? null;
    const previous = lastImpersonationIdRef.current;
    lastImpersonationIdRef.current = id;
    if (!previous || id) return;
    const pre = preImpersonationRef.current;
    preImpersonationRef.current = null;
    if (pre) {
      setUser(pre.user);
      setTenant(pre.tenant);
    } else {
      const superUser = users.find((u) => u.application === "super-admin");
      if (superUser) setUser(superUser);
      setTenant(platformTenant);
    }
    // Expiry (15-minute deadline) — the store already wrote the
    // `console.impersonation_ended` audit row; surface the same outcome.
    const ended = consoleState.impersonations.find((s) => s.id === previous);
    if (ended?.endReason === "expired") {
      toast({
        title: "View-As session expired",
        description: `${ended.tenantName} — 15-minute deadline reached, session auto-ended and operator view restored (audited).`,
      });
    }
  }, [activeImpersonation?.id, setUser, setTenant, consoleState.impersonations]);

  // Compute the module runtime context
  const runtime: ModuleRuntimeContext = useMemo(
    () => ({
      application: user.application,
      tenant,
      user,
      permissions: user.permissions,
      enabledModules: tenant.enabledModules,
      enabledFeatures: tenant.enabledFeatures,
    }),
    [user, tenant],
  );

  const value: PlatformContextValue = {
    user,
    setUser,
    updateUser,
    tenant,
    setTenant,
    availableTenants: [platformTenant, ...tenants, ...customTenants],
    registerTenant,
    themeMode,
    setThemeMode,
    router,
    navigate,
    back,
    runtime,
    notifications,
    markRead,
    markAllRead,
    pushNotification,
    commandOpen,
    setCommandOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    hiddenWidgets,
    toggleWidget,
    resetDashboard,
    setHiddenWidgets,
    customizeOpen,
    setCustomizeOpen,
    searchOpen,
    setSearchOpen,
    isImpersonating,
    impersonationSession,
    startImpersonation,
    endImpersonation,
    renewImpersonation,
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
}

export function useTenant() {
  return usePlatform().tenant;
}

export function useAuth() {
  const { user, setUser } = usePlatform();
  return { user, setUser };
}

export function useRouter() {
  const { router, navigate, back } = usePlatform();
  return { router, navigate, back };
}

export function useRuntime() {
  return usePlatform().runtime;
}

/* Switch user convenience that also updates tenant to match. */
export function useUserSwitcher() {
  const { setUser, setTenant, availableTenants, user, tenant } = usePlatform();
  const switchUser = (u: AuthUser) => {
    setUser(u);
    if (u.application === "super-admin") {
      setTenant(availableTenants[0]); // platform pseudo-tenant
    } else {
      const t = availableTenants.find((x) => x.id === u.tenantId);
      if (t) setTenant(t);
    }
  };
  return { switchUser, currentUser: user, currentTenant: tenant };
}
