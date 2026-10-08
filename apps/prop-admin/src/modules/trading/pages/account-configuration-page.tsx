"use client";

/**
 * Account Configuration Page — comprehensive account admin form with 5
 * collapsible sections, account-health widget, KPI roll-up, and
 * destructive Block/Reset actions guarded by AlertDialog (UX §24, §25).
 *
 * Sections (progressive disclosure §12):
 *  1. Account Configuration          (starts expanded)
 *  2. Balance & Drawdown Metrics     (starts expanded, read-only)
 *  3. Broker Details                 (starts collapsed)
 *  4. Account Status Details         (starts collapsed)
 *  5. Extra Settings                 (starts collapsed)
 *
 * Uses deterministic derivation from the trading account so the demo is
 * stable across reloads — no Math.random anywhere.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts, type TradingAccount } from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
  EntityHeader,
} from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { AccountHealthWidget } from "@/components/platform/account-health";
import { LabelWithHelp, ContextualHelp } from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Save,
  Ban,
  RotateCcw,
  Link2,
  RefreshCw,
  Send,
  ChevronDown,
  Settings2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  CalendarClock,
  ShieldCheck,
  AlertTriangle,
  Server,
  Lock,
  CircleDollarSign,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const PAYOUT_FREQUENCIES = ["Weekly", "Bi-Weekly", "Monthly", "Quarterly"] as const;
const ACCOUNT_LABELS = ["Paid", "Giveaway", "Third Party", "Standard"] as const;
const BROKER_TYPES = ["MetaTrader5", "MetaTrader4", "DXTrade", "MatchTrader"] as const;
const STATUS_REASONS = [
  "None",
  "Manual Review",
  "Policy Violation",
  "Risk Concern",
  "Documentation Issue",
  "Payment Failed",
] as const;

const SOURCE_OPTIONS = ["Webhook", "Manual"] as const;

/* ------------------------------------------------------------------ */
/* Derive deterministic account config                                */
/* ------------------------------------------------------------------ */

interface AccountConfig {
  userEmail: string;
  phase: string;
  startDate: string;
  endDate: string; // "" → no end date
  profitSplit: number;
  payoutFrequency: string;
  firstWithdrawalDelay: string;
  order: string;
  nextWithdrawalDate: string;
  source: string;
  accountLabel: string;

  initialBalance: number;
  liveBalance: number;
  liveEquity: number;
  profitLoss: number;
  dailyStartingBalance: number;
  dailyDrawdownAmount: number;
  dailyDrawdownPct: number;
  profitTargetAmount: number;
  globalDrawdownAmount: number;
  globalDrawdownPct: number;
  dailyDrawdownExpiry: string;
  drawdownLocked: boolean;

  login: string;
  brokerType: string;
  mtTradingAccount: string;
  matchTraderTradingAccount: string;

  status: string;
  statusReason: string;
  statusFinalisedAt: string;
  customStatusReason: string;
  copyTradingDetected: boolean;
  failedReviewReason: string;

  hideAccount: boolean;
  publicTrackRecord: boolean;
  publicBalance: boolean;
  publicTradeHistory: boolean;
  publicLots: boolean;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  // datetime-local expects YYYY-MM-DDTHH:mm
  return iso.slice(0, 16);
}

function deriveAccountConfig(account: TradingAccount): AccountConfig {
  const seed = hashStr(account.id) || 1;
  const userEmail = `${account.traderName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
  const phase = account.phase === "phase-1" ? "Phase 1" : account.phase === "phase-2" ? "Phase 2" : "Funded";

  const startDaysAgo = (seed % 60) + 5;
  const startDateIso = new Date(Date.now() - startDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  // 60% of accounts have end date, 40% leave empty
  const hasEnd = seed % 5 !== 0;
  const endDays = (seed % 30) + 30;
  const endDateIso = hasEnd
    ? new Date(Date.now() + endDays * 24 * 60 * 60 * 1000).toISOString()
    : "";

  const profitSplit = 60 + (seed % 21); // 60..80
  const payoutFrequency = PAYOUT_FREQUENCIES[seed % PAYOUT_FREQUENCIES.length];
  const firstWithdrawalDelay = `${7 + (seed % 21)} days`;
  // Order id pattern
  const orderNum = 10000 + (seed % 9999);
  const order = `ORD-${orderNum}`;
  const nextWithdrawalDateIso = new Date(Date.now() + (seed % 14 + 3) * 24 * 60 * 60 * 1000).toISOString();
  const source = SOURCE_OPTIONS[seed % SOURCE_OPTIONS.length];
  const accountLabel = ACCOUNT_LABELS[seed % ACCOUNT_LABELS.length];

  // Balance & drawdown
  const initialBalance = account.balance;
  const liveBalance = account.balance + Math.round((account.equity - account.balance));
  const liveEquity = account.equity;
  const profitLoss = liveEquity - initialBalance;
  const dailyStartingBalance = initialBalance + Math.round(profitLoss * 0.4);
  const dailyDrawdownAmount = Math.round(initialBalance * 0.03 + (seed % 200));
  const dailyDrawdownPct = Math.round((dailyDrawdownAmount / initialBalance) * 1000) / 10;
  const profitTargetAmount = Math.round(initialBalance * (0.08 + (seed % 5) * 0.005));
  const globalDrawdownAmount = Math.round(initialBalance * 0.05 + (seed % 350));
  const globalDrawdownPct = Math.round((globalDrawdownAmount / initialBalance) * 1000) / 10;
  const expiryMs = Date.now() - ((seed % 8) + 1) * 60 * 60 * 1000;
  const dailyDrawdownExpiry = new Date(expiryMs).toISOString();
  const drawdownLocked = seed % 7 === 0;

  // Broker details
  const login = account.login;
  const brokerType = BROKER_TYPES[seed % BROKER_TYPES.length];
  const mtTradingAccount = `${account.login}@mt5-acmebroker`;
  const matchTraderTradingAccount = `mt_${account.login}@matchtrader`;

  // Account status details
  const status = account.status;
  const statusReason = STATUS_REASONS[seed % STATUS_REASONS.length];
  const finalisedMs = Date.now() - ((seed % 24) + 1) * 60 * 60 * 1000;
  const statusFinalisedAt = new Date(finalisedMs).toISOString();
  const customStatusReason = seed % 3 === 0 ? "Trader requested manual review during KYC." : "";
  const copyTradingDetected = seed % 11 === 0;
  const failedReviewReason = seed % 9 === 0 ? "Risk team flagged for inverse-trading pattern with account 530012." : "";

  // Extra settings
  const hideAccount = seed % 5 === 0;
  const publicTrackRecord = seed % 3 !== 0;
  const publicBalance = seed % 4 !== 0;
  const publicTradeHistory = seed % 6 !== 0;
  const publicLots = seed % 7 !== 0;

  return {
    userEmail,
    phase,
    startDate: startDateIso,
    endDate: endDateIso,
    profitSplit,
    payoutFrequency,
    firstWithdrawalDelay,
    order,
    nextWithdrawalDate: nextWithdrawalDateIso,
    source,
    accountLabel,
    initialBalance,
    liveBalance,
    liveEquity,
    profitLoss,
    dailyStartingBalance,
    dailyDrawdownAmount,
    dailyDrawdownPct,
    profitTargetAmount,
    globalDrawdownAmount,
    globalDrawdownPct,
    dailyDrawdownExpiry,
    drawdownLocked,
    login,
    brokerType,
    mtTradingAccount,
    matchTraderTradingAccount,
    status,
    statusReason,
    statusFinalisedAt,
    customStatusReason,
    copyTradingDetected,
    failedReviewReason,
    hideAccount,
    publicTrackRecord,
    publicBalance,
    publicTradeHistory,
    publicLots,
  };
}

/* ------------------------------------------------------------------ */
/* Section helper                                                     */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Separator />
        <div className="p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {hint ? <ContextualHelp label={typeof label === "string" ? label : "Info"}>{hint}</ContextualHelp> : null}
      </Label>
      {children}
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  mono,
}: {
  label: React.ReactNode;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountConfigurationPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;
  const currency = runtime.tenant?.currency ?? "USD";

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const derived = useMemo(
    () => (account ? deriveAccountConfig(account) : null),
    [account],
  );

  // Order dropdown options (mock with deterministic IDs)
  const orderOptions = useMemo(() => {
    if (!account) return [];
    const seedBase = hashStr(account.id);
    return Array.from({ length: 6 }, (_, i) => {
      const num = 10000 + ((seedBase + i * 137) % 9999);
      return `ORD-${num}`;
    });
  }, [account]);

  // Local editable draft state — mirrors derived on first paint
  const [draft, setDraft] = useState<AccountConfig | null>(null);
  const draftReady = draft ?? derived;
  const update = <K extends keyof AccountConfig>(key: K, value: AccountConfig[K]) =>
    setDraft((d) => ({ ...(d ?? derived!), [key]: value }));

  if (!account || !derived || !draftReady) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-accounts")} className="w-fit">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </Page>
    );
  }

  // Days remaining computation
  const daysRemaining = derived.endDate
    ? Math.max(0, Math.ceil((new Date(derived.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : Infinity;

  const drawdownPct = derived.globalDrawdownPct;

  // Toast handlers — demo-only (no persistence layer yet). Honest
  // copy: "(demo)" so the operator isn't misled into thinking the
  // changes were committed to the broker bridge.
  const handleSave = () =>
    toast({
      title: "Account configuration saved (demo)",
      description: `Login ${account.login} configuration would be committed in production.`,
    });
  const handleSaveContinue = () =>
    toast({
      title: "Saved — keep editing (demo)",
      description: "Changes saved; staying on this screen.",
    });
  const handleSync = () =>
    toast({
      title: "Syncing with broker platform (demo)",
      description: "Would pull live balance, equity and positions from the bridge.",
    });
  const handleResend = () =>
    toast({
      title: "Credentials resent to trader (demo)",
      description: `Login link + temp password would be sent to ${derived.userEmail}.`,
    });
  const handleReset = () =>
    toast({
      title: "Account reset to initial state (demo)",
      description: "Would discard all progress and restore initial capital.",
      variant: "destructive",
    });
  const handleBlock = () =>
    toast({
      title: "Account blocked (demo)",
      description: `Login ${account.login} would be blocked from trading. Logged in audit trail.`,
      variant: "destructive",
    });

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        // "Back to Account" → actually navigate to the account workspace
        // (the parent view). Previously mislabeled and went to trader-detail.
        onClick={() => navigate("account-workspace", { id: account.id })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Account
      </Button>

      <PageHeader
        title="Account Configuration"
        description="Comprehensive configuration, balances, drawdown, broker details, status and extra settings."
        icon={Settings2}
      />

      {/* Entity header — concise identity */}
      <EntityHeader
        title={`Login ${account.login}`}
        subtitle={`${account.traderName} · ${account.platform} · ${derived.phase}`}
        badges={
          <>
            <Badge variant="outline" className="text-[10px]">{account.type}</Badge>
            <ExplainableStateBadge status={account.status} entityType="account" />
            <StatusBadge
              tone={
                derived.source === "Webhook" ? "info" : "muted"
              }
            >
              {derived.source}
            </StatusBadge>
            <StatusBadge tone="default">{derived.accountLabel}</StatusBadge>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Equity"
          value={formatCurrency(derived.liveEquity, currency)}
          icon={Wallet}
        />
        <MetricCard
          label="Balance"
          value={formatCurrency(derived.liveBalance, currency)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="P&L"
          value={`${derived.profitLoss >= 0 ? "+" : ""}${formatCurrency(derived.profitLoss, currency)}`}
          tone={derived.profitLoss >= 0 ? "positive" : "negative"}
          icon={derived.profitLoss >= 0 ? TrendingUp : TrendingDown}
        />
        <MetricCard
          label="Drawdown %"
          value={`${drawdownPct}%`}
          tone={drawdownPct >= 8 ? "negative" : drawdownPct >= 5 ? "warning" : "default"}
          icon={Percent}
        />
        <MetricCard
          label="Days Remaining"
          value={daysRemaining === Infinity ? "∞" : `${daysRemaining}`}
          deltaLabel={daysRemaining === Infinity ? "no limit" : "to end date"}
          icon={CalendarClock}
          tone={daysRemaining === Infinity ? "default" : daysRemaining <= 7 ? "negative" : daysRemaining <= 14 ? "warning" : "default"}
        />
      </div>

      {/* Account Health widget */}
      <div className="rounded-lg border bg-card p-4">
        <AccountHealthWidget
          dailyLoss={{ current: derived.dailyDrawdownAmount, limit: Math.round(derived.initialBalance * 0.05) }}
          maxDrawdown={{ current: derived.globalDrawdownAmount, limit: Math.round(derived.initialBalance * 0.1) }}
          profitTarget={{ current: Math.max(0, derived.profitLoss), limit: derived.profitTargetAmount }}
          accountBalance={derived.liveBalance}
        />
      </div>

      <PageContent className="gap-4">
        {/* Section 1 — Account Configuration */}
        <SectionCard
          title="Account Configuration"
          description="Core account parameters — trading window, profit split, payout schedule, source."
          icon={Settings2}
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* User email (read-only, link icon) */}
            <ReadonlyField
              label={
                <LabelWithHelp help="Trader's email on file. To change it, edit the trader record, not the account.">
                  User email
                </LabelWithHelp>
              }
              value={derived.userEmail}
            />
            {/* Phase */}
            <ReadonlyField label="Phase" value={derived.phase} />
            {/* Start date */}
            <Field
              label={
                <LabelWithHelp help="When the account became active. Reset to re-open trading windows.">
                  Start date
                </LabelWithHelp>
              }
            >
              <Input
                type="datetime-local"
                value={toLocalInputValue(draftReady.startDate)}
                onChange={(e) =>
                  update("startDate", new Date(e.target.value).toISOString())
                }
                className="h-9 text-xs"
              />
            </Field>
            {/* End date */}
            <Field
              label={
                <LabelWithHelp help="Account expiry. Leave empty for accounts without time limits (e.g. Funded accounts).">
                  End date
                </LabelWithHelp>
              }
            >
              <Input
                type="datetime-local"
                value={toLocalInputValue(draftReady.endDate)}
                onChange={(e) =>
                  update("endDate", e.target.value ? new Date(e.target.value).toISOString() : "")
                }
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Leave empty for accounts without time limits.
              </p>
            </Field>
            {/* Profit split */}
            <Field
              label={
                <LabelWithHelp help="Trader's share of profits. The remainder goes to the prop firm. Range 0-100.">
                  Profit split (%)
                </LabelWithHelp>
              }
            >
              <Input
                type="number"
                min={0}
                max={100}
                value={draftReady.profitSplit}
                onChange={(e) => update("profitSplit", Number(e.target.value))}
                className="h-9 text-xs"
              />
            </Field>
            {/* Payout frequency */}
            <Field label="Payout frequency">
              <select
                value={draftReady.payoutFrequency}
                onChange={(e) => update("payoutFrequency", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {PAYOUT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            {/* First withdrawal delay */}
            <Field
              label={
                <LabelWithHelp help="Delay before the first withdrawal can be requested. Expressed as a duration like '14 days'.">
                  First withdrawal delay
                </LabelWithHelp>
              }
            >
              <Input
                value={draftReady.firstWithdrawalDelay}
                onChange={(e) => update("firstWithdrawalDelay", e.target.value)}
                className="h-9 text-xs"
              />
            </Field>
            {/* Order (searchable dropdown — mock) */}
            <Field
              label={
                <LabelWithHelp help="The order that triggered the account creation. Linked back to billing.">
                  Order
                </LabelWithHelp>
              }
            >
              <select
                value={draftReady.order}
                onChange={(e) => update("order", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {orderOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            {/* Next withdrawal date */}
            <Field
              label={
                <LabelWithHelp help="Date the next payout will be eligible to process.">
                  Next withdrawal date
                </LabelWithHelp>
              }
            >
              <Input
                type="datetime-local"
                value={toLocalInputValue(draftReady.nextWithdrawalDate)}
                onChange={(e) =>
                  update("nextWithdrawalDate", new Date(e.target.value).toISOString())
                }
                className="h-9 text-xs"
              />
            </Field>
            {/* Source */}
            <ReadonlyField label="Source" value={derived.source} />
            {/* Account label */}
            <Field label="Account label">
              <select
                value={draftReady.accountLabel}
                onChange={(e) => update("accountLabel", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {ACCOUNT_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          {/* Email link row */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3" />
            <span>
              Email is linked to the trader record —{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => navigate("trader-detail", { id: account.traderId })}
              >
                open trader profile
              </button>
              .
            </span>
          </div>
        </SectionCard>

        {/* Section 2 — Balance & Drawdown Metrics */}
        <SectionCard
          title="Balance & Drawdown Metrics"
          description="Live balance, equity, P&L and drawdown limits. Read-only — sourced from broker sync."
          icon={Wallet}
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField label="Initial balance" value={formatCurrency(derived.initialBalance, currency)} mono />
            <ReadonlyField label="Live account balance" value={formatCurrency(derived.liveBalance, currency)} mono />
            <ReadonlyField label="Live account equity" value={formatCurrency(derived.liveEquity, currency)} mono />
            <Field label="Profit / loss">
              <div
                className={cn(
                  "flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-medium tabular-nums",
                  derived.profitLoss >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {derived.profitLoss >= 0 ? "+" : ""}
                {formatCurrency(derived.profitLoss, currency)}
              </div>
            </Field>
            <ReadonlyField label="Daily starting balance" value={formatCurrency(derived.dailyStartingBalance, currency)} mono />
            <Field label="Daily drawdown amount">
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm tabular-nums">
                <span>{formatCurrency(derived.dailyDrawdownAmount, currency)}</span>
                <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-400">
                  {derived.dailyDrawdownPct}%
                </Badge>
              </div>
            </Field>
            <ReadonlyField label="Profit target amount" value={formatCurrency(derived.profitTargetAmount, currency)} mono />
            <Field label="Global drawdown amount">
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm tabular-nums">
                <span>{formatCurrency(derived.globalDrawdownAmount, currency)}</span>
                <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-400">
                  {derived.globalDrawdownPct}%
                </Badge>
              </div>
            </Field>
            <ReadonlyField
              label={
                <LabelWithHelp help="Timestamp when the daily drawdown window resets.">
                  Daily drawdown expiry
                </LabelWithHelp>
              }
              value={new Date(derived.dailyDrawdownExpiry).toLocaleString()}
            />
            {/* Drawdown locked */}
            <Field
              label={
                <LabelWithHelp help="When locked, the daily drawdown calculation is frozen and will not reset at midnight server time.">
                  Drawdown locked
                </LabelWithHelp>
              }
            >
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={draftReady.drawdownLocked}
                  onCheckedChange={(v) => update("drawdownLocked", v)}
                  className={cn(
                    draftReady.drawdownLocked &&
                      "data-[state=checked]:bg-rose-500 data-[state=unchecked]:bg-input",
                  )}
                />
                {draftReady.drawdownLocked ? (
                  <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-400">
                    <Lock className="mr-1 h-3 w-3" /> Locked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                    Unlocked
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                When locked, the daily drawdown calculation is frozen and will not reset.
              </p>
            </Field>
          </div>
        </SectionCard>

        {/* Section 3 — Broker Details */}
        <SectionCard
          title="Broker Details"
          description="Login credentials, broker type and linked trading accounts."
          icon={Server}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField label="Login" value={derived.login} mono />
            <Field label="Broker type">
              <select
                value={draftReady.brokerType}
                onChange={(e) => update("brokerType", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {BROKER_TYPES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field
              label={
                <LabelWithHelp help="The MetaTrader trading account reference linked to this account.">
                  MetaTrader trading account
                </LabelWithHelp>
              }
            >
              <Input
                value={draftReady.mtTradingAccount}
                onChange={(e) => update("mtTradingAccount", e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </Field>
            <Field
              label={
                <LabelWithHelp help="The MatchTrader trading account reference linked to this account.">
                  Match trader trading account
                </LabelWithHelp>
              }
            >
              <Input
                value={draftReady.matchTraderTradingAccount}
                onChange={(e) => update("matchTraderTradingAccount", e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={handleSync} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Sync Account
            </Button>
            <Button size="sm" variant="outline" onClick={handleResend} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Resend Credentials
            </Button>
          </div>
        </SectionCard>

        {/* Section 4 — Account Status Details */}
        <SectionCard
          title="Account Status Details"
          description="Status, reason, finalised timestamp and reviewer notes."
          icon={ShieldCheck}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Status">
              <div className="flex h-9 items-center">
                <ExplainableStateBadge status={derived.status} entityType="account" />
              </div>
            </Field>
            <Field label="Status reason">
              <select
                value={draftReady.statusReason}
                onChange={(e) => update("statusReason", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {STATUS_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Backdate status changes if needed. Audit trail will show actual vs finalised timestamp.">
                  Status finalised timestamp
                </LabelWithHelp>
              }
            >
              <Input
                type="datetime-local"
                value={toLocalInputValue(draftReady.statusFinalisedAt)}
                onChange={(e) =>
                  update("statusFinalisedAt", new Date(e.target.value).toISOString())
                }
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Backdate status changes if needed.</p>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Free-form reason recorded against the status. Visible to other admins.">
                  Custom status reason
                </LabelWithHelp>
              }
            >
              <Textarea
                rows={2}
                value={draftReady.customStatusReason}
                onChange={(e) => update("customStatusReason", e.target.value)}
                className="text-xs"
                placeholder="Add notes for the audit trail…"
              />
            </Field>
            <Field
              label={
                <LabelWithHelp help="Toggle on when copy-trading patterns have been detected by the risk engine. Triggers a manual review.">
                  Copy trading detected
                </LabelWithHelp>
              }
            >
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={draftReady.copyTradingDetected}
                  onCheckedChange={(v) => update("copyTradingDetected", v)}
                  className={cn(
                    draftReady.copyTradingDetected &&
                      "data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-input",
                  )}
                />
                {draftReady.copyTradingDetected ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mr-1 h-3 w-3" /> Flagged
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Not flagged</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Flag this account if copy trading patterns have been detected.
              </p>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Reason captured when the risk team fails the account during manual review.">
                  Failed review reason
                </LabelWithHelp>
              }
            >
              <Textarea
                rows={2}
                value={draftReady.failedReviewReason}
                onChange={(e) => update("failedReviewReason", e.target.value)}
                className="text-xs"
                placeholder="Describe the failure reason…"
              />
            </Field>
          </div>
        </SectionCard>

        {/* Section 5 — Extra Settings */}
        <SectionCard
          title="Extra Settings"
          description="Account flags controlling public visibility."
          icon={Lock}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FlagRow
              checked={draftReady.hideAccount}
              onCheckedChange={(v) => update("hideAccount", v)}
              label="HIDE_ACCOUNT"
              description="Hide this account from public leaderboards"
            />
            <FlagRow
              checked={draftReady.publicTrackRecord}
              onCheckedChange={(v) => update("publicTrackRecord", v)}
              label="PUBLIC_TRACK_RECORD"
              description="Allow public viewing of track record"
            />
            <FlagRow
              checked={draftReady.publicBalance}
              onCheckedChange={(v) => update("publicBalance", v)}
              label="PUBLIC_BALANCE"
              description="Allow public viewing of account balance"
            />
            <FlagRow
              checked={draftReady.publicTradeHistory}
              onCheckedChange={(v) => update("publicTradeHistory", v)}
              label="PUBLIC_TRADE_HISTORY"
              description="Allow public viewing of trade history"
            />
            <FlagRow
              checked={draftReady.publicLots}
              onCheckedChange={(v) => update("publicLots", v)}
              label="PUBLIC_LOTS"
              description="Allow public viewing of lot sizes"
            />
          </div>
        </SectionCard>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveContinue} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save and continue editing
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5">
                  <Ban className="h-3.5 w-3.5" /> Block Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Block this account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The account will be immediately blocked. The trader will lose all
                    trading access. This action is logged in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                    onClick={handleBlock}
                  >
                    Block account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Account
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Flag row helper                                                    */
/* ------------------------------------------------------------------ */

function FlagRow({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label
      htmlFor={`flag-${label}`}
      className="flex cursor-pointer items-start gap-2 rounded-md border bg-muted/20 p-3 hover:bg-muted/40"
    >
      <Checkbox
        id={`flag-${label}`}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <p className="text-xs font-mono font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
