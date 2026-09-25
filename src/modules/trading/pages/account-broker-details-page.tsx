"use client";

/**
 * Account Broker Details Page — broker / trading-platform details for a
 * single trading account (spec §14, §15, §33).
 *
 * Read-only form layout with an explicit "Edit" toggle so operators can
 * scan the configuration quickly and switch to editing without losing
 * context. Three sections (Login credentials, Broker configuration,
 * Trading account matching) map directly to the underlying bridge sync
 * record. A KPI row above the form shows live account balance, equity,
 * margin, free margin, and margin level so the operator never has to
 * jump back to the accounts list.
 *
 * All "Save", "Sync" and "Resync" actions surface a toast — this page
 * is wired to mock data only.
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
import {
  LabelWithHelp,
  ContextualHelp,
} from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Pencil,
  Save,
  RefreshCw,
  Plug,
  PlugZap,
  Server,
  KeyRound,
  ShieldCheck,
  Wallet,
  Scale,
  CircleDollarSign,
  Gauge,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const BROKER_TYPES = [
  { id: "MT5", label: "MetaTrader 5 (MT5)" },
  { id: "DXTrade", label: "DXTrade" },
] as const;

const SERVERS = [
  "mt5-alpha.acmebroker.com:443",
  "mt5-beta.acmebroker.com:443",
  "dxtrade.acmebroker.com",
];

/**
 * Derive a deterministic broker config from a trading account so the demo
 * is stable across reloads. Everything is deterministic per-account.
 */
function deriveBrokerConfig(account: TradingAccount) {
  // Use account login as a seed
  const seed = parseInt(account.login, 10) || 1;
  const server = SERVERS[seed % SERVERS.length];
  const bridgeConnected = seed % 4 !== 0; // 75% connected
  const lastSyncMinutesAgo = (seed * 7) % 90;
  const lastSync = new Date(Date.now() - lastSyncMinutesAgo * 60 * 1000).toISOString();
  const matchedAccount = seed % 5 !== 0; // 80% matched
  const margin = Math.round(account.equity * 0.18);
  const freeMargin = Math.max(0, account.equity - margin);
  const marginLevel = margin > 0 ? Math.round((account.equity / margin) * 10000) / 100 : 0;
  const accountGroup =
    account.type === "funded"
      ? "funded-pro"
      : account.phase === "phase-2"
      ? "phase-2-verification"
      : "phase-1-evaluation";
  const passwordMasked = "•".repeat(8);
  const investorPasswordMasked = "•".repeat(8);
  return {
    server,
    bridgeConnected,
    lastSync,
    matchedAccount,
    margin,
    freeMargin,
    marginLevel,
    accountGroup,
    passwordMasked,
    investorPasswordMasked,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountBrokerDetailsPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;
  const currency = runtime.tenant?.currency ?? "USD";

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const config = useMemo(
    () => (account ? deriveBrokerConfig(account) : null),
    [account],
  );

  const [editing, setEditing] = useState(false);
  // Editable copy — only used when editing is toggled on.
  const [draft, setDraft] = useState<{
    brokerType: string;
    leverage: string;
    accountGroup: string;
    currency: string;
    server: string;
  } | null>(null);

  if (!account || !config) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-accounts")} className="w-fit">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </Page>
    );
  }

  const startEdit = () => {
    setDraft({
      brokerType: account.platform,
      leverage: account.leverage,
      accountGroup: config.accountGroup,
      currency: account.currency,
      server: config.server,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };

  const saveChanges = () => {
    toast({
      title: "Changes saved",
      description: `Broker configuration for login ${account.login} updated. (demo)`,
    });
    setEditing(false);
    setDraft(null);
  };

  const triggerSync = () => {
    toast({
      title: "Sync queued",
      description: `Pulling latest state from ${config.server}. (demo)`,
    });
  };

  const resyncAccount = () => {
    toast({
      title: "Resync started",
      description: "Reconciling account equity and open positions from the bridge. (demo)",
    });
  };

  const effectiveLeverage = draft?.leverage ?? account.leverage;
  const effectiveBrokerType = draft?.brokerType ?? account.platform;
  const effectiveAccountGroup = draft?.accountGroup ?? config.accountGroup;
  const effectiveCurrency = draft?.currency ?? account.currency;
  const effectiveServer = draft?.server ?? config.server;

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("trader-detail", { id: account.traderId })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to trader
      </Button>

      <PageHeader
        title="Account Broker Details"
        description="Broker / trading-platform configuration and live bridge sync state."
        icon={Server}
        actions={
          <>
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveChanges} className="gap-1.5">
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={resyncAccount}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" /> Resync Account
            </Button>
          </>
        }
      />

      {/* Entity header — concise identity for the account */}
      <EntityHeader
        title={`Login ${account.login}`}
        subtitle={`${account.traderName} · ${account.platform} · ${account.phase}`}
        badges={
          <>
            <Badge variant="outline" className="text-[10px]">{account.type}</Badge>
            <StatusBadge
              tone={
                account.status === "active"
                  ? "success"
                  : account.status === "breached"
                  ? "danger"
                  : account.status === "passed"
                  ? "info"
                  : "warning"
              }
            >
              {account.status}
            </StatusBadge>
          </>
        }
      />

      {/* KPI row — live account metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Account Balance"
          value={formatCurrency(account.balance, account.currency)}
          icon={Wallet}
        />
        <MetricCard
          label="Equity"
          value={formatCurrency(account.equity, account.currency)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Margin"
          value={formatCurrency(config.margin, currency)}
          icon={Scale}
        />
        <MetricCard
          label="Free Margin"
          value={formatCurrency(config.freeMargin, currency)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Margin Level"
          value={`${config.marginLevel}%`}
          tone={
            config.marginLevel > 500
              ? "positive"
              : config.marginLevel > 100
              ? "default"
              : "negative"
          }
          icon={Gauge}
        />
      </div>

      <PageContent className="grid gap-4 lg:grid-cols-3">
        {/* Section 1 — Login credentials */}
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <LabelWithHelp help="Credentials issued by the broker platform. The investor password grants read-only trade viewing; the main password grants full trading access.">
              Login Credentials
            </LabelWithHelp>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReadonlyField label="Login ID" value={account.login} mono />
            <ReadonlyField
              label={
                <LabelWithHelp help="The main trading password. Required to place orders, modify positions and close trades.">
                  Password
                </LabelWithHelp>
              }
              value={config.passwordMasked}
              mono
            />
            <ReadonlyField
              label={
                <LabelWithHelp help="Broker server hostname the trading terminal connects to. Different servers may serve different regions.">
                  Server
                </LabelWithHelp>
              }
              value={effectiveServer}
              mono
            />
            <ReadonlyField
              label={
                <LabelWithHelp help="Read-only password allowing investors or auditors to view trades without being able to modify them.">
                  Investor Password
                </LabelWithHelp>
              }
              value={config.investorPasswordMasked}
              mono
            />
          </div>
        </div>

        {/* Section 2 — Broker configuration */}
        <div className="rounded-lg border bg-card p-4 lg:col-span-1">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <LabelWithHelp help="Broker-side configuration applied to this account on the trading platform.">
              Broker Configuration
            </LabelWithHelp>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Broker Type">
              <select
                value={effectiveBrokerType}
                disabled={!editing}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, brokerType: e.target.value } : d))
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-[box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {BROKER_TYPES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Leverage applied to the account. Higher leverage amplifies both profits and losses, and is bounded by the challenge risk rules.">
                  Leverage
                </LabelWithHelp>
              }
            >
              <Input
                value={effectiveLeverage}
                disabled={!editing}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, leverage: e.target.value } : d))
                }
                className="font-mono text-xs"
              />
            </Field>
            <Field
              label={
                <LabelWithHelp help="Account group assigned by the broker. Groups determine swap rates, spreads and symbol visibility.">
                  Account Group
                </LabelWithHelp>
              }
            >
              <Input
                value={effectiveAccountGroup}
                disabled={!editing}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, accountGroup: e.target.value } : d))
                }
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Currency">
              <Input
                value={effectiveCurrency}
                disabled={!editing}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, currency: e.target.value } : d))
                }
                className="font-mono text-xs"
              />
            </Field>
          </div>
        </div>

        {/* Section 3 — Trading account matching + bridge state */}
        <div className="rounded-lg border bg-card p-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Plug className="h-4 w-4 text-muted-foreground" />
            <LabelWithHelp help="Bridge state tracks whether the internal platform record matches the broker-side trading account. A disconnected bridge means live equity and positions may be stale.">
              Trading Account Matching
            </LabelWithHelp>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label={
                <LabelWithHelp help="Indicates whether the platform trading account has been successfully matched to the broker-side login.">
                  Matched Account
                </LabelWithHelp>
              }
            >
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  checked={config.matchedAccount}
                  disabled
                  aria-label="Account matched to broker login"
                />
                <span className="text-xs text-muted-foreground">
                  {config.matchedAccount ? "Matched to broker login" : "Awaiting match"}
                </span>
              </div>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Connection state of the bridge that relays trade and account updates between the broker and this platform.">
                  Bridge Status
                </LabelWithHelp>
              }
            >
              <div className="flex h-9 items-center">
                {config.bridgeConnected ? (
                  <StatusBadge tone="success">
                    <span className="inline-flex items-center gap-1">
                      <PlugZap className="h-3 w-3" /> Connected
                    </span>
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">
                    <span className="inline-flex items-center gap-1">
                      <Plug className="h-3 w-3" /> Disconnected
                    </span>
                  </StatusBadge>
                )}
              </div>
            </Field>
            <Field
              label={
                <LabelWithHelp help="Timestamp of the most recent successful sync between the broker and the platform.">
                  Last Sync
                </LabelWithHelp>
              }
            >
              <div className="flex h-9 items-center">
                <span className="text-xs text-muted-foreground">
                  {new Date(config.lastSync).toLocaleString()}
                </span>
              </div>
            </Field>
            <Field label="Sync Action">
              <div className="flex h-9 items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={triggerSync}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Sync Now
                </Button>
              </div>
            </Field>
          </div>

          {/* Inline footer help — non-intrusive */}
          <div className="mt-4 flex items-start gap-2 border-t pt-3 text-[11px] text-muted-foreground">
            <ContextualHelp
              label="Bridge sync"
              iconClassName="mt-0.5"
            >
              The bridge polls the broker at a configurable interval and on
              demand. Manual sync forces an immediate poll and reconciliation
              of equity, open positions and recent trade history.
            </ContextualHelp>
            <span>
              Manual sync forces an immediate poll of the broker and refreshes
              equity, positions and recent trade history.
            </span>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Field helpers                                                      */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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
