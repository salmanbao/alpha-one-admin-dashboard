/**
 * @pfaas/platform-core — public entry point.
 *
 * Barrel export consumed via the bare "@pfaas/platform-core" specifier.
 * Deep subpath exports (e.g. "@pfaas/platform-core/types") remain available
 * and unchanged.
 */

/* ── Runtime context ───────────────────────────────────────────────────── */
export {
  PlatformProvider,
  PlatformContext,
  usePlatform,
  useTenant,
  useAuth,
  useRouter,
  useRuntime,
  useUserSwitcher,
} from "./platform-context";
export type { PlatformContextValue, RouterState } from "./platform-context";

/* ── Permissions ───────────────────────────────────────────────────────── */
export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
  can,
  makeCan,
} from "./lib/platform/permission-engine";

/* ── Shared types ──────────────────────────────────────────────────────── */
export type {
  ApplicationId,
  AuthUser,
  TenantContext,
  PermissionCheck,
  NavigationItem,
  RouteDefinition,
  WidgetDefinition,
  FrontendModule,
  ModuleManifest,
  AuditEntry,
  AppNotification,
} from "./lib/platform/types";
