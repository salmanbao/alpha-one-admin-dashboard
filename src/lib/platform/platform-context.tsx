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

interface PlatformContextValue {
  /* auth */
  user: AuthUser;
  setUser: (u: AuthUser) => void;
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

const PlatformContext = createContext<PlatformContextValue | null>(null);

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
    actionHref: "payouts",
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
    actionHref: "breaches",
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
    actionHref: "kyc",
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

function readStoredUser(): AuthUser {
  if (typeof window !== "undefined") {
    try {
      const id = window.localStorage.getItem(DEMO_USER_KEY);
      if (id) {
        const found = users.find((u) => u.id === id);
        if (found) return found;
      }
    } catch { /* ignore */ }
  }
  return users[1]; // Sarah Chen — prop-admin (default)
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
  const fallback: RouterState = { view: "overview", params: {}, history: ["overview"] };
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
  const [user, setUser] = useState<AuthUser>(readStoredUser); // persisted, falls back to Sarah Chen
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
    const all = [...tenants, ...customTenants];
    return all.find((t) => t.id === storedId)
      ?? all.find((t) => t.id === user.tenantId)
      ?? platformTenant;
  });
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [router, setRouter] = useState<RouterState>(routerStateFromUrl);
  const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    // Load persisted hidden widgets from localStorage (spec §23 — user customization)
    if (typeof window === "undefined") return new Set();
    try {
      const stored = window.localStorage.getItem("pfaas:hiddenWidgets");
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        return new Set(arr);
      }
    } catch { /* ignore parse errors */ }
    return new Set();
  });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Persist hidden widgets to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pfaas:hiddenWidgets", JSON.stringify(Array.from(hiddenWidgets)));
    } catch { /* ignore quota errors */ }
  }, [hiddenWidgets]);

  // Persist demo user/tenant selection so F5 doesn't reset identity
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEMO_USER_KEY, user.id);
      window.localStorage.setItem(DEMO_TENANT_KEY, tenant.id);
    } catch { /* ignore quota errors */ }
  }, [user, tenant]);

  // Persist runtime-created tenants so they survive reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pfaas:customTenants", JSON.stringify(customTenants));
    } catch { /* ignore quota errors */ }
  }, [customTenants]);

  const registerTenant = useCallback((t: TenantContext) => {
    setCustomTenants((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
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
      if (router.view && router.view !== "overview") usp.set(ROUTE_PARAM, router.view);
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
      const view = history[history.length - 1] ?? "overview";
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
