/**
 * @pfaas/ui — public entry point.
 *
 * Barrel export of the primitives and platform building blocks consumed via
 * the bare "@pfaas/ui" specifier. Deep subpath exports (e.g. "@pfaas/ui/button")
 * remain available and unchanged.
 */

/* ── Utilities ─────────────────────────────────────────────────────────── */
export { cn } from "./lib/utils";
export { toast, useToast } from "./hooks/use-toast";

/* ── UI primitives ─────────────────────────────────────────────────────── */
export { Button, buttonVariants } from "./components/ui/button";
export { Badge, badgeVariants } from "./components/ui/badge";
export { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
export { Skeleton } from "./components/ui/skeleton";
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/alert-dialog";

/* ── Platform page building blocks ─────────────────────────────────────── */
export {
  Page,
  PageHeader,
  PageToolbar,
  PageContent,
  EntityHeader,
  MetricCard,
} from "./components/platform/page";
export { DataTable, type Column } from "./components/platform/data-table";
export {
  StatusBadge,
  traderStatusTone,
  formatCurrency,
  formatCompact,
} from "./components/platform/status";
export {
  PermissionGuard,
  ModuleGuard,
  FeatureGuard,
  LoadingState,
  EmptyState,
  ErrorState,
  ForbiddenState,
  WidgetSkeleton,
  WidgetSuspense,
} from "./components/platform/guards";
export {
  getStateExplanation,
  ExplainableStateBadge,
  StateExplanationCard,
} from "./components/platform/state-explanations";
export { AccountHealthWidget } from "./components/platform/account-health";
export { ActivityTimeline } from "./components/platform/audit";
export {
  ChartLoading,
  ChartEmpty,
  LineSeries,
  AreaSeries,
  BarSeries,
  DonutSeries,
  Sparkline,
} from "./components/platform/charts";
export {
  ContextualHelp,
  LabelWithHelp,
} from "./components/platform/contextual-help";
