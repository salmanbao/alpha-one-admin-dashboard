"use client";

/**
 * Closed Position Detail Page — single closed trade view + edit form.
 *
 * Reached from the Closed Positions list (row click) or directly via
 * `router.params.id`. Breadcrumb: "Closed Positions > [Position ID]".
 *
 * Layout (UX §12, §25-27 — progressive disclosure, predictable detail view):
 *  - Breadcrumb + header row showing the Position ID, direction, state
 *  - Read-only detail grid grouped into six sections (Identity, Volume &
 *    Pricing, Timing, Order IDs, P&L, Risk, Flags) — every field the
 *    operator might audit on a closed trade.
 *  - Footer actions: destructive "Delete Closed Position" wrapped in an
 *    AlertDialog (UX §24 — irreversible action confirmation with
 *    consequence text), Save / Save and continue editing (outline),
 *    Back to Closed Positions (ghost, navigate).
 *
 * Mock data is generated deterministically from the position id, mirroring
 * the `generateClosedPositions` pattern on closed-positions-page.tsx — same
 * symbol list + base prices, same sin-seeded pseudo-randoms. That way the
 * detail view stays in sync with the list view if the operator opens a row
 * that exists there.
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantTraders,
  getTenantPositions,
} from "@/lib/platform/mock-data";
import { Page, PageContent } from "@/components/platform/page";
import { formatCurrency } from "@/components/platform/status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Hash,
  TrendingUp,
  TrendingDown,
  Clock,
  Receipt,
  Coins,
  ShieldAlert,
  Flag,
  Trash2,
  Save,
  Pencil,
  Check,
  User,
  CreditCard,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type CloseReason = "TP" | "SL" | "Manual" | "System" | "Liquidation";
type ClosedSide = "buy" | "sell";
type PositionType = "Market" | "Pending";
type EntryType = "In" | "Out";

interface ClosedPositionDetail {
  id: string;
  uid: string;
  direction: ClosedSide;
  state: "CLOSED";
  symbol: string;
  symbolDescription: string;
  positionType: PositionType;
  entryType: EntryType;
  volume: number;
  openPrice: number;
  closePrice: number;
  currentPrice: number;
  openTime: string;
  closeTime: string;
  durationMs: number;
  openOrderId: string;
  closeOrderId: string;
  profit: number;
  commission: number;
  swap: number;
  netProfit: number;
  stopLoss: number | null;
  takeProfit: number | null;
  rrRatio: number | null;
  isPartial: boolean;
  closeReason: CloseReason;
  traderId: string;
  traderName: string;
  accountId: string;
  accountLogin: string;
}

const CLOSE_REASONS: CloseReason[] = [
  "TP",
  "SL",
  "Manual",
  "System",
  "Liquidation",
];

const BASE_SYMBOLS: Array<[string, number, number, string]> = [
  // symbol, base price, contract multiplier (units per 1.0 volume), description.
  // FX majors: 1 lot = 100,000 units (was 10,000 — under-stated FX P&L by 10x).
  // JPY pairs need /currentPrice conversion to land in USD (see grossPnl below).
  ["EURUSD", 1.085, 100_000, "Euro vs US Dollar — Major FX pair"],
  ["GBPUSD", 1.271, 100_000, "British Pound vs US Dollar — Major FX pair (Cable)"],
  ["USDJPY", 151.4, 100_000, "US Dollar vs Japanese Yen — Major FX pair"],
  ["XAUUSD", 2348.5, 100, "Spot Gold vs US Dollar — precious metal"],
  ["BTCUSD", 67250, 1, "Bitcoin vs US Dollar — flagship cryptocurrency"],
  ["ETHUSD", 3480, 1, "Ethereum vs US Dollar — smart-contract crypto"],
  ["SP500", 5230, 1, "S&P 500 Index — US large-cap equity benchmark"],
  ["NAS100", 18420, 1, "Nasdaq 100 Index — US tech equity benchmark"],
];

/** Deterministic pseudo-random generator from a numeric seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

/** Hash a string id to a stable integer seed. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/**
 * Generate a single deterministic closed position from an id. The shape
 * mirrors `generateClosedPositions` on the list page so opening a row
 * there would show matching data.
 */
function generateClosedPositionDetail(
  id: string,
  tenantId: string,
): ClosedPositionDetail {
  const accounts = getTenantAccounts(tenantId);
  const traders = getTenantTraders(tenantId);
  const openPositions = getTenantPositions(tenantId);

  const seed = hashSeed(id);
  const idx = seed % Math.max(openPositions.length, 1);
  const base = openPositions[idx] ?? openPositions[0];

  const [sym, basePrice, mult, description] =
    BASE_SYMBOLS[(seed - 1) % BASE_SYMBOLS.length];

  const r1 = seededRandom(seed + 0.1);
  const r2 = seededRandom(seed + 0.5);
  const r3 = seededRandom(seed + 1.7);
  const r4 = seededRandom(seed + 3.3);

  const side: ClosedSide = base.side;
  const entry = base.entryPrice;
  const movePct = (r1 - 0.5) * 0.04; // ±2%
  const close = entry * (1 + movePct);
  const pnlPerUnit = side === "buy" ? close - entry : entry - close;
  const volume = base.volume;
  // JPY-quoted pairs (USDJPY, …) need /currentPrice conversion to land
  // in USD — otherwise P&L was 150x too high for USDJPY (the raw value
  // is in JPY, not USD).
  const isJpyQuote = sym.endsWith("JPY");
  const grossPnlRaw = pnlPerUnit * mult * volume;
  const grossPnl = isJpyQuote ? grossPnlRaw / close : grossPnlRaw;
  // Commission: 4 bps on notional value (volume × contract size × price).
  // For JPY-quoted pairs the notional is in JPY, so divide by close to
  // land in USD — previously the missing `mult` factor produced
  // effectively zero commission for FX pairs ($0.02 instead of $19.53).
  // Mirrors the same fix applied to closed-positions-page (Round 4).
  const commission = Math.round((volume * basePrice * mult * 0.0004 / (isJpyQuote ? close : 1)) * 100) / 100;
  const swap = Math.round(Math.sin(seed) * 5 * 100) / 100;
  // Net profit = gross - commission - swap. Previously `profit` already
  // subtracted commission+swap, then `netProfit` subtracted them AGAIN —
  // displaying a value that was off by exactly (commission + swap).
  const profit = Math.round((grossPnl - commission - swap) * 100) / 100;
  const netProfit = profit;

  // Determine close reason from P&L direction
  let closeReason: CloseReason;
  if (profit >= Math.abs(grossPnl) * 0.5 && profit > 0) closeReason = "TP";
  else if (profit <= -Math.abs(grossPnl) * 0.3 && profit < 0) closeReason = "SL";
  else if (r4 > 0.92) closeReason = "Liquidation";
  else if (r4 > 0.8) closeReason = "System";
  else closeReason = "Manual";

  // SL / TP — derive from side and entry
  const slDistance = entry * 0.012;
  const tpDistance = entry * 0.024;
  const stopLoss =
    side === "buy" ? entry - slDistance : entry + slDistance;
  const takeProfit =
    side === "buy" ? entry + tpDistance : entry - tpDistance;
  const rrRatio =
    Math.abs(takeProfit - entry) > 0 && Math.abs(entry - stopLoss) > 0
      ? Math.round(
          (Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss)) * 100,
        ) / 100
      : null;

  // Open / close timestamps
  const now = Date.now();
  const openedMsAgo = Math.floor((1 + r2 * 90 * 24 * 60)) * 60 * 1000;
  const durationMs = Math.floor((r3 * 48 * 60 + 5) * 60 * 1000);
  const closedMsAgo = Math.max(openedMsAgo - durationMs, 60 * 1000);
  const openTime = new Date(now - openedMsAgo).toISOString();
  const closeTime = new Date(now - closedMsAgo).toISOString();

  const trader = traders.find((t) => t.id === base.traderId);
  const account = accounts.find((a) => a.id === base.accountId);

  return {
    id,
    uid: `uid-${seed.toString(16).padStart(8, "0")}`,
    direction: side,
    state: "CLOSED",
    symbol: sym,
    symbolDescription: description,
    positionType: "Market",
    entryType: "In",
    volume,
    openPrice: Math.round(entry * 100000) / 100000,
    closePrice: Math.round(close * 100000) / 100000,
    currentPrice: Math.round(close * 100000) / 100000,
    openTime,
    closeTime,
    durationMs,
    openOrderId: `ord-${(seed % 90000) + 1000}`,
    closeOrderId: `ord-${(seed % 90000) + 1000 + 7}`,
    profit,
    commission,
    swap,
    netProfit,
    stopLoss: Math.round(stopLoss * 100000) / 100000,
    takeProfit: Math.round(takeProfit * 100000) / 100000,
    rrRatio,
    isPartial: r4 > 0.85,
    closeReason,
    traderId: trader?.id ?? "trader-unknown",
    traderName: trader?.name ?? "Unknown trader",
    accountId: account?.id ?? base.accountId,
    accountLogin: account?.login ?? "—",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function reasonTone(reason: CloseReason): "success" | "danger" | "warning" | "muted" {
  switch (reason) {
    case "TP":
      return "success";
    case "SL":
    case "Liquidation":
      return "danger";
    case "System":
      return "warning";
    case "Manual":
    default:
      return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ClosedPositionDetailPage() {
  const { runtime, navigate, router } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const id = router.params.id ?? "cpos-unknown";
  const seed = useMemo(
    () => generateClosedPositionDetail(id, tid),
    [id, tid],
  );

  // Working copy — local state so edits don't mutate mock data.
  const [working, setWorking] = useState<ClosedPositionDetail>(seed);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Render-time resync — when the URL `id` changes (in-app navigation
  // between two closed positions), the useState initial value above is
  // already stale. Without this guard, the page briefly renders the
  // previous position's data until the user edits a field. Mirrors the
  // pattern in profile-page.tsx.
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setWorking(seed);
  }

  // Recompute working when the seed changes (navigating to another id).
  // Use a key-based remount of the inner form below to flush stale edits.
  const update = (patch: Partial<ClosedPositionDetail>) =>
    setWorking((w) => ({ ...w, ...patch }));

  const onToggleEdit = () => {
    if (editing) {
      // Discard local edits on toggle-off.
      setWorking(seed);
    }
    setEditing((e) => !e);
  };

  const onSave = () => {
    setEditing(false);
    toast({
      title: "Position updated",
      description: `Changes to ${working.id} were saved. (demo)`,
    });
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `Position ${working.id} updated. Continuing edits. (demo)`,
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Closed position deleted",
      description: `${working.id} was permanently deleted along with its P&L and audit trail. (demo)`,
    });
    navigate("closed-positions");
  };

  return (
    <Page>
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button
                type="button"
                onClick={() => navigate("closed-positions")}
              >
                Closed Positions
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {working.id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted p-2">
            <Activity className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              <span className="font-mono">{working.id}</span>
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {working.symbol}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {working.symbolDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Direction badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              working.direction === "buy"
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                : "border-rose-500/40 text-rose-700 dark:text-rose-400",
            )}
          >
            {working.direction === "buy" ? "LONG" : "SHORT"}
          </Badge>
          <Badge
            variant="outline"
            className="border-muted-foreground/30 text-[10px] font-medium text-muted-foreground"
          >
            {working.state}
          </Badge>
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={onToggleEdit}
            aria-pressed={editing}
          >
            {editing ? (
              <>
                <Check className="h-3.5 w-3.5" /> Done
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </>
            )}
          </Button>
        </div>
      </div>

      <PageContent>
        {/* Key remount on id change so local working state resets */}
        <ClosedPositionForm
          key={seed.id}
          working={working}
          editing={editing}
          currency={currency}
          onFieldChange={update}
        />

        <Separator />

        {/* Footer action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Closed Position
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Delete closed position?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This trade record will be permanently deleted. The position
                  data, P&amp;L, and audit trail will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800",
                  )}
                  onClick={onDelete}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("closed-positions")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Closed Positions
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveAndContinue}
            >
              <Save className="h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Form sub-component                                                  */
/* ------------------------------------------------------------------ */

function ClosedPositionForm({
  working,
  editing,
  currency,
  onFieldChange,
}: {
  working: ClosedPositionDetail;
  editing: boolean;
  currency: string;
  onFieldChange: (patch: Partial<ClosedPositionDetail>) => void;
}) {
  const { navigate } = usePlatform();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Identity */}
      <FormSection
        title="Identity"
        icon={Hash}
        description="Core identifiers for this position."
      >
        <div className="space-y-3">
          <ReadOnlyField label="Uid" value={working.uid} />
          {/* Trader + Account cross-links (UX §22 — contextual actions
              where the user's decision happens). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <LabelWithHelp
                help="The trader who opened this position. Click to open the Trader Workspace."
                className="text-sm font-medium"
              >
                Trader
              </LabelWithHelp>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-9 w-full justify-between gap-2 rounded-md border bg-muted/30 px-3 text-sm font-medium text-foreground hover:bg-muted/50 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                onClick={() =>
                  navigate("trader-detail", { id: working.traderId })
                }
                aria-label={`View trader ${working.traderName}`}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{working.traderName}</span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  View <ArrowUpRight className="h-3 w-3" />
                </span>
              </Button>
            </div>
            <div className="space-y-1.5">
              <LabelWithHelp
                help="The trading account this position was opened on. Click to open the Account Workspace."
                className="text-sm font-medium"
              >
                Account
              </LabelWithHelp>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-9 w-full justify-between gap-2 rounded-md border bg-muted/30 px-3 font-mono text-xs text-foreground hover:bg-muted/50 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                onClick={() =>
                  navigate("account-workspace", { id: working.accountId })
                }
                aria-label={`View account ${working.accountLogin}`}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{working.accountLogin}</span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  View <ArrowUpRight className="h-3 w-3" />
                </span>
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              help="LONG = buy side (profit when price rises). SHORT = sell side (profit when price falls)."
              className="text-sm font-medium"
            >
              Direction
            </LabelWithHelp>
            <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  working.direction === "buy"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-500/40 text-rose-700 dark:text-rose-400",
                )}
              >
                {working.direction === "buy" ? "LONG" : "SHORT"}
              </Badge>
            </div>
          </div>
          <ReadOnlyField label="State" value={working.state} />
          <ReadOnlyField label="Symbol" value={working.symbol} mono />
          <ReadOnlyField
            label="Symbol description"
            value={working.symbolDescription}
          />
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Market = filled immediately at the current quote. Pending = waiting at a specified price (limit/stop)."
              className="text-sm font-medium"
            >
              Position type
            </LabelWithHelp>
            <Select
              value={working.positionType}
              onValueChange={(v) =>
                onFieldChange({ positionType: v as PositionType })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select position type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Market">Market</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              help="In = position opened by an aggressive (market) order. Out = position opened by a passive (limit) order against an existing quote."
              className="text-sm font-medium"
            >
              Entry type
            </LabelWithHelp>
            <Select
              value={working.entryType}
              onValueChange={(v) => onFieldChange({ entryType: v as EntryType })}
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select entry type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In">In</SelectItem>
                <SelectItem value="Out">Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Volume & Pricing */}
      <FormSection
        title="Volume & Pricing"
        icon={Coins}
        description="Volume traded and price points."
      >
        <div className="space-y-3">
          <ReadOnlyField label="Volume" value={String(working.volume)} />
          <ReadOnlyField
            label="Open price"
            value={working.openPrice.toFixed(5)}
            mono
          />
          <ReadOnlyField
            label="Close price"
            value={working.closePrice.toFixed(5)}
            mono
          />
          <ReadOnlyField
            label="Mark at close"
            value={working.currentPrice.toFixed(5)}
            mono
            help="Live quote at the moment the position was closed."
          />
        </div>
      </FormSection>

      {/* Timing */}
      <FormSection
        title="Timing"
        icon={Clock}
        description="When the position was open and for how long."
      >
        <div className="space-y-3">
          <ReadOnlyField
            label="Open time"
            value={new Date(working.openTime).toLocaleString()}
          />
          <ReadOnlyField
            label="Close time"
            value={new Date(working.closeTime).toLocaleString()}
          />
          <ReadOnlyField
            label="Duration"
            value={formatDuration(working.durationMs)}
            help="Calculated from open time to close time."
          />
        </div>
      </FormSection>

      {/* Order IDs */}
      <FormSection
        title="Order IDs"
        icon={Receipt}
        description="The orders that opened and closed this position."
      >
        <div className="space-y-3">
          <ReadOnlyField
            label="Open order ID"
            value={working.openOrderId}
            mono
          />
          <ReadOnlyField
            label="Close order ID"
            value={working.closeOrderId}
            mono
          />
        </div>
      </FormSection>

      {/* P&L */}
      <FormSection
        title="P&L"
        icon={working.profit >= 0 ? TrendingUp : TrendingDown}
        description="Profit, fees, and net result."
      >
        <div className="space-y-3">
          <PnlField
            label="Profit"
            value={working.profit}
            currency={currency}
          />
          <ReadOnlyField
            label="Commission"
            value={formatCurrency(working.commission, currency)}
            help="Brokerage commission charged when the order filled."
          />
          <ReadOnlyField
            label="Swap"
            value={formatCurrency(working.swap, currency)}
            help="Overnight financing fee accrued while the position was open."
          />
          <Separator />
          <PnlField
            label="Net profit"
            value={working.netProfit}
            currency={currency}
            strong
            help="Net of commission and swap — what the trader actually realizes."
          />
        </div>
      </FormSection>

      {/* Risk */}
      <FormSection
        title="Risk"
        icon={ShieldAlert}
        description="Risk limits and reward-to-risk ratio."
      >
        <div className="space-y-3">
          <ReadOnlyField
            label="Stop Loss (SL)"
            value={
              working.stopLoss != null
                ? working.stopLoss.toFixed(5)
                : "—"
            }
            mono
            help="Price at which the position would automatically close to limit losses."
          />
          <ReadOnlyField
            label="Take Profit (TP)"
            value={
              working.takeProfit != null
                ? working.takeProfit.toFixed(5)
                : "—"
            }
            mono
            help="Price at which the position would automatically close to lock in gains."
          />
          <ReadOnlyField
            label="RR Ratio"
            value={
              working.rrRatio != null
                ? `${working.rrRatio.toFixed(2)} : 1`
                : "—"
            }
            help="Reward-to-risk ratio, calculated as |TP-entry| / |entry-SL|."
          />
        </div>
      </FormSection>

      {/* Flags */}
      <FormSection
        title="Flags"
        icon={Flag}
        description="Partial-close flag and close reason."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <LabelWithHelp
                help="Marks whether this position was partially closed before the final close. Partial closes keep the original position alive with a reduced volume."
                className="text-sm font-medium"
              >
                Is partial
              </LabelWithHelp>
              <span className="text-xs text-muted-foreground">
                Read-only — set by the broker.
              </span>
            </div>
            <Switch checked={working.isPartial} disabled aria-readonly />
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp
              help="TP = closed by take-profit. SL = closed by stop-loss. Manual = trader closed by hand. System = closed by platform rule. Liquidation = margin call closed the position."
              className="text-sm font-medium"
            >
              Close reason
            </LabelWithHelp>
            <Select
              value={working.closeReason}
              onValueChange={(v) =>
                onFieldChange({ closeReason: v as CloseReason })
              }
              disabled={!editing}
            >
              <SelectTrigger className="w-full" disabled={!editing}>
                <SelectValue placeholder="Select close reason…" />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "TP"
                      ? "Take Profit"
                      : r === "SL"
                      ? "Stop Loss"
                      : r === "Manual"
                      ? "Manual"
                      : r === "System"
                      ? "System"
                      : "Liquidation"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-1">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium",
                  reasonTone(working.closeReason) === "success"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    : reasonTone(working.closeReason) === "danger"
                    ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                    : reasonTone(working.closeReason) === "warning"
                    ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                    : "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {working.closeReason}
              </Badge>
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function FormSection({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-start gap-2">
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <Separator />
      {children}
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
  help,
  mono,
}: {
  label: string;
  value: string;
  help?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <LabelWithHelp
        help={help ?? "Read-only."}
        className="text-sm font-medium"
      >
        {label}
      </LabelWithHelp>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PnlField({
  label,
  value,
  currency,
  strong,
  help,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
  help?: string;
}) {
  const positive = value >= 0;
  return (
    <div className="space-y-1.5">
      <LabelWithHelp
        help={help ?? "Calculated field."}
        className="text-sm font-medium"
      >
        {label}
      </LabelWithHelp>
      <div
        className={cn(
          "flex h-9 items-center justify-between rounded-md border bg-muted/30 px-3 text-sm tabular-nums",
          positive
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-700 dark:text-rose-400",
          strong && "font-semibold",
        )}
      >
        <span>
          {positive ? "+" : ""}
          {formatCurrency(value, currency)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {positive ? "profit" : "loss"}
        </span>
      </div>
    </div>
  );
}
