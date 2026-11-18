"use client";

/**
 * Trader App — View Router
 *
 * Maps view ids to their page components.
 * Trader-only views with trader.self permission.
 *
 * View mapping:
 * - closed-positions      -> My Closed Positions (closed-positions)
 * - comms-history         -> Communication History (R3-04)
 */

import { hasPermission, usePlatform } from "@pfaas/platform-core";
import type {
  NavigationItem,
  RouteDefinition,
  FrontendModule,
} from "@pfaas/platform-core";
import { EmptyState, Skeleton } from "@pfaas/ui";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  LayoutGrid,
  Package,
  Archive,
  CandlestickChart,
  ShieldAlert,
  Mail,
  Award,
} from "lucide-react";

const ViewSkeleton = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
    <Skeleton className="h-48 w-full max-w-xl" />
  </div>
);

/** R9 W5 UC-T10 — registry wrapper: resolve [handle] from the URL. */
const TraderRecordPageDynamic = dynamic(
  () =>
    import("../../modules/record/pages/trader-record-page").then((m) => ({
      default: m.TraderRecordPage,
    })),
  { loading: ViewSkeleton },
);

function TraderRecordView() {
  const params = useParams<{ handle: string }>();
  const handle = typeof params?.handle === "string" ? params.handle : "unknown";
  return <TraderRecordPageDynamic handle={handle} />;
}

const viewMap: Record<string, ComponentType> = {
  "closed-positions": dynamic(
    () =>
      import("../../modules/trading/pages/closed-positions-page").then((m) => ({
        default: m.ClosedPositionsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "comms-history": dynamic(
    () =>
      import("../../modules/account/pages/comms-history-page").then((m) => ({
        default: m.CommsHistoryPage,
      })),
    { loading: ViewSkeleton },
  ),
  // R9 W1 UC-T7 — outage claims (file a claim, see verdicts)
  "outage-claim": dynamic(
    () =>
      import("../../modules/appeals/pages/outage-claim-page").then((m) => ({
        default: m.OutageClaimPage,
      })),
    { loading: ViewSkeleton },
  ),
  // R9 W5 UC-T10 — public shareable track record (read-only; the
  // file-system route /trader-record/[handle] is the canonical entry, this
  // registry key exists for census parity). The handle comes from the URL.
  "trader-record": dynamic(
    () => Promise.resolve({ default: TraderRecordView }),
    { loading: ViewSkeleton },
  ),
};

/**
 * The trader app's routes. Each route is permission-gated to trader.self.
 */
export const traderRoutes: RouteDefinition[] = [
  {
    path: "closed-positions",
    viewId: "closed-positions",
    label: "My Closed Positions",
    icon: Archive,
    permission: "trader.self",
    module: "trading",
  },
  // R3-04 — trader-side mirror of the message archive (self-scoped)
  {
    path: "comms-history",
    viewId: "comms-history",
    label: "Communication History",
    icon: Mail,
    permission: "trader.self",
    module: "marketing",
  },
  // R9 W1 UC-T7 — outage claim filing + verdict history
  {
    path: "outage-claim",
    viewId: "outage-claim",
    label: "Outage Claim",
    icon: ShieldAlert,
    permission: "trader.self",
    module: "trading",
  },
  // R9 W5 UC-T10 — public shareable track record (read-only). The
  // file-system route /trader-record/[handle] renders it; this declaration
  // keeps registry ↔ route parity (nav census).
  {
    path: "trader-record/[handle]",
    viewId: "trader-record",
    label: "Track Record",
    icon: Award,
    permission: "trader.self",
    module: "trading",
  },
];

/**
 * The trader app's sidebar navigation entries.
 */
export const traderNavigation: NavigationItem[] = [
  {
    id: "nav-open-positions",
    label: "My Open Positions",
    href: "/trading-positions",
    icon: Package,
    permission: "trader.self",
    application: ["trader"],
  },
  {
    id: "nav-closed-positions",
    label: "My Closed Positions",
    href: "/closed-positions",
    icon: Archive,
    permission: "trader.self",
    application: ["trader"],
  },
  // R3-04 — communication history is self-scoped (trader.self reuse)
  {
    id: "nav-comms-history",
    label: "Communication History",
    href: "/comms-history",
    icon: Mail,
    permission: "trader.self",
    application: ["trader"],
  },
];

/**
 * TraderView — resolves a viewId, permission-gates it, renders the page.
 * Mounted by the route pages under src/app/*.
 */
export function TraderView({ viewId }: { viewId: string }) {
  const { user } = usePlatform();
  const route = traderRoutes.find((r) => r.viewId === viewId);

  if (!route || !hasPermission(user, route.permission)) {
    return (
      <EmptyState
        title="No access"
        description="You don't have permission to view this page."
        icon={ShieldAlert}
      />
    );
  }

  const Page = viewMap[viewId];

  if (!Page) {
    return (
      <EmptyState
        title="No access"
        description="You don't have permission to view this page."
        icon={ShieldAlert}
      />
    );
  }

  return <Page />;
}

/**
 * TraderModule — the module manifest for the trader app.
 */
export const traderModule: FrontendModule = {
  manifest: {
    id: "trader",
    name: "Trader",
    version: "1.0.0",
    description:
      "Trader dashboard — My Workspace, My Open Positions, My Closed Positions",
    capabilities: ["trading.dashboard", "trading.positions", "trading.history"],
    category: "core",
    supportedApplications: ["trader"],
    permissions: [
      { id: "trader.self", label: "Self: View and manage your own data" },
    ],
    icon: LayoutGrid,
    accentColor: "#1e40af",
  },
  navigation: traderNavigation,
  routes: traderRoutes,
  widgets: [],
  settings: [
    {
      id: "trading-settings",
      label: "Trading",
      module: "trading",
      viewId: "settings-trading",
      icon: CandlestickChart,
      order: 30,
    },
  ],
};
