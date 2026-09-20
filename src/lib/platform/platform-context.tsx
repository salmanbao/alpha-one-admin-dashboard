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

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(users[1]); // Sarah Chen — prop-admin
  const [tenant, setTenant] = useState<TenantContext>(
    tenants.find((t) => t.id === user.tenantId) ?? platformTenant,
  );
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [router, setRouter] = useState<RouterState>({
    view: "overview",
    params: {},
    history: ["overview"],
  });
  const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const navigate = useCallback((view: string, params: Record<string, string> = {}) => {
    setRouter((r) => ({ view, params, history: [...r.history, view].slice(-32) }));
  }, []);

  const back = useCallback(() => {
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
    availableTenants: [platformTenant, ...tenants],
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
