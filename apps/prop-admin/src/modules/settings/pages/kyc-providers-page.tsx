"use client";

/**
 * KYC Providers configuration page (UX Constitution §22-§24, §33, §41).
 *
 * Lets prop-firm operators manage identity-verification providers
 * (Sumsub, Onfido, Veriff, Identity Pass, etc.) — configure
 * credentials, set the active primary provider + fallback order,
 * and see per-provider health / sync / approval metrics.
 *
 * Layout (top → bottom):
 *  1. PageHeader — "KYC Providers" + description + Export CSV action
 *     (§22 — the export action sits where the operator's reporting
 *     decision happens, not on a separate page).
 *  2. KPI row — 4 MetricCards (Active Providers / Total Verifications
 *     30d / Approval Rate % / Avg Processing Time). The 30d sublabel
 *     uses makeTermResolver(tenant) for the white-labeled "account"
 *     term so a Candidate-first firm sees "across all Candidate KYC
 *     submissions" (§55 Business Terminology).
 *  3. Primary provider card (highlighted, emerald accent) — Sumsub is
 *     the live primary. Shows logo placeholder, status badge, last
 *     sync timestamp, and 3 contextual actions: Edit / Test
 *     Connection / Deactivate (§23 — Edit is the primary CTA).
 *  4. Provider list DataTable — 8 columns covering name + logo, status
 *     badge, masked API key with show/hide toggle, webhook URL,
 *     last sync (relative), 30d verifications, approval rate with
 *     trend arrow, and per-row contextual actions (§22).
 *  5. Add-provider empty-state card — surfaces the "Connect a new KYC
 *     provider" CTA where the next onboarding decision happens
 *     (§30 Empty States) rather than burying it in a header menu.
 *  6. Fallback order section — reorderable list (up/down arrows) of
 *     providers in the order tried when the primary fails or
 *     rate-limits. Inline Collapsible explaining the contract (§33
 *     Help and Education — explains the fallback semantics in
 *     context, no external doc lookup required).
 *
 * Edit Sheet drawer (§27 Drawer vs Page — quick configuration does
 * not deserve a full page navigation) — opens when the operator
 * clicks "Edit" on a row OR on the primary card. Contains:
 *  - Provider name + status badge (read-only display)
 *  - API Key input with Show/Hide toggle + Copy button
 *  - Webhook URL input
 *  - Sandbox Mode toggle (Switch)
 *  - Auto-approve threshold (Slider 0-100, default 85)
 *  - Fallback priority (Select: Primary / Fallback #1 /
 *    Fallback #2 / Inactive)
 *  - Test Connection button (toast)
 *  - Save button (toast)
 *  - Deactivate button (destructive, AlertDialog-gated — §24 friction
 *    proportional to consequence; the consequence text explains that
 *    pending verifications will be rerouted and the audit trail
 *    will be logged)
 *
 * Terra palette — emerald (success / primary), amber (warning /
 * fallback), rose (destructive), slate (muted), sky (info only).
 * No blue/indigo/violet primary UI introduced.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { exportToCsv, type ExportColumn } from "@/lib/platform/export-utils";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Webhook,
  RefreshCw,
  Plus,
  Edit3,
  TestTube,
  Power,
  Eye,
  EyeOff,
  Copy,
  ChevronUp,
  ChevronDown,
  Activity,
  Clock,
  Crown,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type ProviderStatus = "active" | "fallback" | "inactive";

interface KycProvider {
  id: string;
  name: string;
  description: string;
  status: ProviderStatus;
  apiKeyMasked: string;
  apiKeyFull: string;
  webhookUrl: string;
  lastSync: string; // ISO timestamp OR "—"
  verifications30d: number;
  approvalRate: number; // 0-100
  approvalRateDelta: number; // signed percentage points MoM
  avgProcessingMinutes: number;
  isPrimary: boolean;
}

const KYC_PROVIDERS: KycProvider[] = [
  {
    id: "sumsub",
    name: "Sumsub",
    description: "Identity verification, AML screening, liveness detection",
    status: "active",
    apiKeyMasked: "sum_live_••••••••3a9f",
    apiKeyFull: "sum_live_sk_1234567890abcdef3a9f",
    webhookUrl: "https://api.example.com/webhooks/kyc/sumsub",
    lastSync: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    verifications30d: 184,
    approvalRate: 87.5,
    approvalRateDelta: 2.3,
    avgProcessingMinutes: 4.2,
    isPrimary: true,
  },
  {
    id: "onfido",
    name: "Onfido",
    description: "Document verification + facial biometrics",
    status: "fallback",
    apiKeyMasked: "onf_live_••••••••b7c2",
    apiKeyFull: "onf_live_sk_876543210fedcba9b7c2",
    webhookUrl: "https://api.example.com/webhooks/kyc/onfido",
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    verifications30d: 47,
    approvalRate: 82.0,
    approvalRateDelta: -1.4,
    avgProcessingMinutes: 6.1,
    isPrimary: false,
  },
  {
    id: "veriff",
    name: "Veriff",
    description: "AI-powered identity verification with video interviewing",
    status: "inactive",
    apiKeyMasked: "vrf_live_••••••••e5d8",
    apiKeyFull: "vrf_live_sk_abcd1234ef567890e5d8",
    webhookUrl: "Not configured",
    lastSync: "—",
    verifications30d: 0,
    approvalRate: 0,
    approvalRateDelta: 0,
    avgProcessingMinutes: 0,
    isPrimary: false,
  },
];

/** Logo placeholder — colored tile with the provider's initial. */
function providerInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/** Map provider status → StatusBadge tone (Terra palette). */
function providerStatusTone(status: ProviderStatus) {
  switch (status) {
    case "active":
      return "success" as const; // emerald
    case "fallback":
      return "warning" as const; // amber
    case "inactive":
    default:
      return "muted" as const; // slate
  }
}

/** Map provider status → human label. */
function providerStatusLabel(status: ProviderStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "fallback":
      return "Fallback";
    case "inactive":
    default:
      return "Inactive";
  }
}

/** Logo tile background per provider id (deterministic, Terra palette). */
function providerLogoClass(id: string): string {
  switch (id) {
    case "sumsub":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "onfido":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    case "veriff":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-muted text-foreground";
  }
}

/** Format a relative-time string from an ISO timestamp. */
function formatRelativeTime(iso: string): string {
  if (iso === "—" || !iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 1000 / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Deterministic trend arrow renderer. */
function TrendIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-muted-foreground/70">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Edit sheet state                                                    */
/* ------------------------------------------------------------------ */

type FallbackPriority = "primary" | "fallback-1" | "fallback-2" | "inactive";

interface EditFormValues {
  apiKey: string;
  webhookUrl: string;
  sandboxMode: boolean;
  autoApproveThreshold: number;
  fallbackPriority: FallbackPriority;
}

const PRIORITY_OPTIONS: { value: FallbackPriority; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "fallback-1", label: "Fallback #1" },
  { value: "fallback-2", label: "Fallback #2" },
  { value: "inactive", label: "Inactive" },
];

function priorityFromProvider(p: KycProvider): FallbackPriority {
  if (p.status === "active") return "primary";
  if (p.status === "fallback") return "fallback-1";
  return "inactive";
}

function valuesFromProvider(p: KycProvider): EditFormValues {
  return {
    apiKey: p.apiKeyFull,
    webhookUrl: p.webhookUrl === "Not configured" ? "" : p.webhookUrl,
    sandboxMode: false,
    autoApproveThreshold: 85,
    fallbackPriority: priorityFromProvider(p),
  };
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ProviderLogo({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-12 w-12 text-lg"
      : size === "sm"
        ? "h-7 w-7 text-[11px]"
        : "h-9 w-9 text-sm";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border font-semibold",
        sizeClass,
        providerLogoClass(id),
      )}
      aria-hidden="true"
    >
      {providerInitial(name)}
    </div>
  );
}

/** Primary provider highlighted card. */
function PrimaryProviderCard({
  provider,
  onEdit,
  onTest,
  onDeactivate,
}: {
  provider: KycProvider;
  onEdit: () => void;
  onTest: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-background p-4 dark:border-emerald-900 dark:from-emerald-950/30">
      <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
      <div className="flex flex-col gap-4 pl-2 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <ProviderLogo id={provider.id} name={provider.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {provider.name}
              </h3>
              <StatusBadge tone={providerStatusTone(provider.status)}>
                {providerStatusLabel(provider.status)}
              </StatusBadge>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <Crown className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {provider.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Last sync:{" "}
                <span className="font-medium text-foreground">
                  {formatRelativeTime(provider.lastSync)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {provider.verifications30d} verifications (30d)
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Avg {provider.avgProcessingMinutes.toFixed(1)} min
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onEdit}>
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onTest}>
            <TestTube className="mr-1.5 h-3.5 w-3.5" />
            Test Connection
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeactivate}>
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Per-row API key cell with show/hide toggle. */
function ApiKeyCell({
  provider,
  visible,
  onToggle,
}: {
  provider: KycProvider;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <code className="font-mono text-xs text-foreground">
        {visible ? provider.apiKeyFull : provider.apiKeyMasked}
      </code>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={onToggle}
        aria-label={visible ? "Hide API key" : "Show API key"}
        title={visible ? "Hide API key" : "Show API key"}
      >
        {visible ? (
          <EyeOff className="h-3 w-3" />
        ) : (
          <Eye className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

/** Per-row actions cell — Edit / Test / Activate as Primary. */
function RowActions({
  provider,
  onEdit,
  onTest,
  onActivatePrimary,
}: {
  provider: KycProvider;
  onEdit: () => void;
  onTest: () => void;
  onActivatePrimary: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={onEdit}>
        <Edit3 className="mr-1 h-3 w-3" />
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={onTest}>
        <TestTube className="h-3 w-3" />
        <span className="sr-only">Test connection</span>
      </Button>
      {provider.isPrimary ? (
        <Badge
          variant="outline"
          className="ml-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <Crown className="mr-1 h-3 w-3" />
          Primary
        </Badge>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={onActivatePrimary}
          disabled={provider.status === "inactive"}
          title={
            provider.status === "inactive"
              ? "Activate provider before setting as primary"
              : "Set as primary provider"
          }
        >
          <Crown className="mr-1 h-3 w-3" />
          Set Primary
        </Button>
      )}
    </div>
  );
}

/** Add-provider empty state card (§30 Empty States). */
function AddProviderCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        Connect a new KYC provider
      </h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Add Sumsub, Onfido, Veriff, Identity Pass, or another supported
        provider. Configuring a new provider does not activate it
        immediately — you control when it goes live.
      </p>
      <Button
        size="sm"
        className="mt-3"
        onClick={() =>
          toast({
            title: "Provider marketplace",
            description: "Provider marketplace would open here. (demo)",
          })
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Browse providers
      </Button>
    </div>
  );
}

/** Fallback order section (reorderable list, up/down arrows). */
function FallbackOrderSection({
  order,
  onMoveUp,
  onMoveDown,
}: {
  order: KycProvider[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Fallback order
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When the primary provider fails or rate-limits, the platform
            cascades down this list before surfacing an error.
          </p>
        </div>
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost">
              <HelpCircle className="mr-1 h-3.5 w-3.5" />
              How it works
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">Cascade contract</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Each submission tries the Primary first.</li>
                <li>
                  On error / timeout / 5xx, the next enabled provider in
                  this list is attempted within 500&nbsp;ms.
                </li>
                <li>Inactive providers are skipped automatically.</li>
                <li>
                  The audit trail logs which provider ultimately
                  resolved each verification.
                </li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator className="my-3" />
      <ul className="space-y-2">
        {order.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === order.length - 1;
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center justify-between rounded-md border p-2.5",
                p.status === "inactive" && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground">
                  {i + 1}
                </span>
                <ProviderLogo id={p.id} name={p.name} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    {i === 0 ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        Primary
                      </Badge>
                    ) : p.status === "inactive" ? (
                      <StatusBadge tone="muted">Inactive</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Fallback</StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "inactive"
                      ? "Skipped — provider not configured"
                      : `Tries after position ${i} fails · ${p.verifications30d} verifications in 30d`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={isFirst}
                  onClick={() => onMoveUp(p.id)}
                  aria-label={`Move ${p.name} up in fallback order`}
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={isLast}
                  onClick={() => onMoveDown(p.id)}
                  aria-label={`Move ${p.name} down in fallback order`}
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Edit provider Sheet drawer (§27). */
function EditProviderSheet({
  provider,
  open,
  onOpenChange,
}: {
  provider: KycProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);

  const [values, setValues] = useState<EditFormValues>(
    valuesFromProvider(provider ?? KYC_PROVIDERS[0]),
  );
  const [apiVisible, setApiVisible] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [prevProviderId, setPrevProviderId] = useState(provider?.id);

  // Sync local form state when a different provider is passed in.
  // Using React's "adjust state during render" pattern (not useEffect)
  // per https://react.dev/learn/you-might-not-need-an-effect —
  // setState during render is allowed when guarded by a prop-change
  // condition so it doesn't cascade.
  if (provider && provider.id !== prevProviderId) {
    setPrevProviderId(provider.id);
    setValues(valuesFromProvider(provider));
    setApiVisible(false);
    setDeactivateOpen(false);
  }

  if (!provider) return null;

  const setField = <K extends keyof EditFormValues>(
    key: K,
    v: EditFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleTest = () =>
    toast({
      title: "Connection test",
      description: "Connection test: Success (demo)",
    });

  const handleSave = () => {
    toast({
      title: "Saved",
      description: "Provider configuration saved (demo)",
    });
    onOpenChange(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(values.apiKey);
      toast({ title: "Copied", description: "API key copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access denied by browser.",
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = () => {
    setDeactivateOpen(false);
    onOpenChange(false);
    toast({
      title: "Provider deactivated",
      description: `${provider.name} has been deactivated. Pending verifications rerouted to next fallback. (demo)`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] overflow-y-auto"
      >
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <ProviderLogo id={provider.id} name={provider.name} size="md" />
              <div className="min-w-0">
                <SheetTitle className="text-base">{provider.name}</SheetTitle>
                <SheetDescription className="mt-0.5">
                  {provider.description}
                </SheetDescription>
              </div>
            </div>
            <StatusBadge tone={providerStatusTone(provider.status)}>
              {providerStatusLabel(provider.status)}
            </StatusBadge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          <Separator />

          {/* API key */}
          <div className="space-y-1.5">
            <Label htmlFor="kyc-api-key" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              API Key
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="kyc-api-key"
                type={apiVisible ? "text" : "password"}
                value={values.apiKey}
                onChange={(e) => setField("apiKey", e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setApiVisible((v) => !v)}
                aria-label={apiVisible ? "Hide API key" : "Show API key"}
              >
                {apiVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={handleCopy}
                aria-label="Copy API key"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stored encrypted at rest. Rotating the key invalidates pending
              webhook signatures.
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label htmlFor="kyc-webhook" className="flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              Webhook URL
            </Label>
            <Input
              id="kyc-webhook"
              type="url"
              value={values.webhookUrl}
              onChange={(e) => setField("webhookUrl", e.target.value)}
              placeholder="https://api.example.com/webhooks/kyc/<provider>"
            />
            <p className="text-[11px] text-muted-foreground">
              Provider will POST verification lifecycle events to this
              endpoint. Leave empty to disable webhooks.
            </p>
          </div>

          {/* Sandbox mode */}
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <Label
                htmlFor="kyc-sandbox"
                className="text-sm font-medium"
              >
                Sandbox mode
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Route requests to the provider&apos;s sandbox environment.
                Verifications return test data and never affect live{" "}
                {term("account").toLowerCase()} accounts.
              </p>
            </div>
            <Switch
              id="kyc-sandbox"
              checked={values.sandboxMode}
              onCheckedChange={(v) => setField("sandboxMode", v)}
            />
          </div>

          {/* Auto-approve threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="kyc-threshold" className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Auto-approve threshold
              </Label>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                ≥ {values.autoApproveThreshold}
              </span>
            </div>
            <Slider
              id="kyc-threshold"
              min={0}
              max={100}
              step={1}
              value={[values.autoApproveThreshold]}
              onValueChange={(v) =>
                setField("autoApproveThreshold", v[0] ?? 85)
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Verifications scoring at or above this threshold are auto-approved.
              Below it, they queue for manual review.
            </p>
          </div>

          {/* Fallback priority */}
          <div className="space-y-1.5">
            <Label htmlFor="kyc-priority" className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Fallback priority
            </Label>
            <Select
              value={values.fallbackPriority}
              onValueChange={(v) =>
                setField("fallbackPriority", v as FallbackPriority)
              }
            >
              <SelectTrigger id="kyc-priority" className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Determines this provider&apos;s position in the fallback cascade.
              Only one provider can be Primary at a time.
            </p>
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col sm:gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Edit3 className="mr-1.5 h-3.5 w-3.5" />
              Save changes
            </Button>
            <Button variant="outline" onClick={handleTest}>
              <TestTube className="mr-1.5 h-3.5 w-3.5" />
              Test Connection
            </Button>
          </div>
          <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30">
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Deactivate provider
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  Deactivate {provider.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Deactivating this provider will pause all pending
                  verifications and reroute them to the next available
                  fallback. The provider can be reactivated at any time.
                  Audit trail will be logged.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                <p className="font-medium">Consequence</p>
                <p className="mt-1">
                  {provider.verifications30d} in-flight 30-day verifications
                  will be re-assigned to the next enabled provider in your
                  fallback order. The provider&apos;s webhook will stop
                  receiving events immediately. This change is logged in the
                  audit trail.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeactivate}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export function KycProvidersPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);

  // Edit sheet state.
  const [editProvider, setEditProvider] = useState<KycProvider | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Per-row API key visibility (Set of provider ids).
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Fallback order — initialized from the mock data order.
  const [fallbackOrder, setFallbackOrder] = useState<string[]>(
    KYC_PROVIDERS.map((p) => p.id),
  );

  // KPI row — derived deterministically from KYC_PROVIDERS.
  const kpis = useMemo(() => {
    const activeCount = KYC_PROVIDERS.filter(
      (p) => p.status !== "inactive",
    ).length;
    const totalVerifications = KYC_PROVIDERS.reduce(
      (sum, p) => sum + p.verifications30d,
      0,
    );
    const approvedVerifications = KYC_PROVIDERS.reduce(
      (sum, p) => sum + Math.round((p.approvalRate / 100) * p.verifications30d),
      0,
    );
    const approvalRate =
      totalVerifications > 0
        ? (approvedVerifications / totalVerifications) * 100
        : 0;
    const activeForAvg = KYC_PROVIDERS.filter(
      (p) => p.status !== "inactive" && p.avgProcessingMinutes > 0,
    );
    const avgProcessing =
      activeForAvg.length > 0
        ? activeForAvg.reduce((s, p) => s + p.avgProcessingMinutes, 0) /
          activeForAvg.length
        : 0;
    return {
      activeCount,
      totalVerifications,
      approvalRate,
      avgProcessing,
    };
  }, []);

  const primary = KYC_PROVIDERS.find((p) => p.isPrimary) ?? KYC_PROVIDERS[0];

  const toggleApiKey = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (p: KycProvider) => {
    setEditProvider(p);
    setSheetOpen(true);
  };

  const handleTest = (p: KycProvider) =>
    toast({
      title: "Connection test",
      description: `Connection test for ${p.name}: Success (demo)`,
    });

  const handleDeactivateFromCard = (p: KycProvider) => {
    toast({
      title: "Open confirm dialog",
      description: `Open the edit sheet on ${p.name} to confirm deactivation.`,
    });
    openEdit(p);
  };

  const handleActivatePrimary = (p: KycProvider) => {
    if (p.status === "inactive") {
      toast({
        title: "Cannot activate",
        description: `${p.name} is inactive. Configure credentials first.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Primary updated",
      description: `${p.name} is now the primary KYC provider. (demo)`,
    });
  };

  const moveUp = (id: string) => {
    setFallbackOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (id: string) => {
    setFallbackOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };

  const orderedFallback: KycProvider[] = fallbackOrder
    .map((id) => KYC_PROVIDERS.find((p) => p.id === id))
    .filter((p): p is KycProvider => Boolean(p));

  // DataTable columns (§25 Table Design — operational workspace, not a
  // database dump; 8 columns cover the decision-relevant fields only).
  const columns: Column<KycProvider>[] = [
    {
      key: "provider",
      header: "Provider",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <ProviderLogo id={row.id} name={row.name} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {row.name}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {row.description}
            </div>
          </div>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={providerStatusTone(row.status)}>
          {providerStatusLabel(row.status)}
        </StatusBadge>
      ),
      sortValue: (row) => row.status,
    },
    {
      key: "apiKey",
      header: "API Key",
      cell: (row) => (
        <ApiKeyCell
          provider={row}
          visible={visibleKeys.has(row.id)}
          onToggle={() => toggleApiKey(row.id)}
        />
      ),
    },
    {
      key: "webhook",
      header: "Webhook URL",
      cell: (row) =>
        row.webhookUrl === "Not configured" ? (
          <span className="text-xs text-muted-foreground/70">
            Not configured
          </span>
        ) : (
          <span
            className="block max-w-[220px] truncate font-mono text-xs text-foreground"
            title={row.webhookUrl}
          >
            {row.webhookUrl}
          </span>
        ),
    },
    {
      key: "lastSync",
      header: "Last Sync",
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          {formatRelativeTime(row.lastSync)}
        </span>
      ),
      sortValue: (row) => (row.lastSync === "—" ? 0 : new Date(row.lastSync).getTime()),
    },
    {
      key: "verifications",
      header: "Verifications 30d",
      numeric: true,
      cell: (row) => (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {row.verifications30d}
        </span>
      ),
      sortValue: (row) => row.verifications30d,
    },
    {
      key: "approvalRate",
      header: "Approval Rate",
      numeric: true,
      cell: (row) =>
        row.approvalRate === 0 ? (
          <span className="text-xs text-muted-foreground/70">—</span>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {row.approvalRate.toFixed(1)}%
            </span>
            <TrendIndicator delta={row.approvalRateDelta} />
          </div>
        ),
      sortValue: (row) => row.approvalRate,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <RowActions
          provider={row}
          onEdit={() => openEdit(row)}
          onTest={() => handleTest(row)}
          onActivatePrimary={() => handleActivatePrimary(row)}
        />
      ),
      className: "text-right",
    },
  ];

  const handleExport = () => {
    const exportColumns: ExportColumn<KycProvider>[] = [
      { key: "name", header: "Provider", value: (r) => r.name },
      { key: "status", header: "Status", value: (r) => providerStatusLabel(r.status) },
      { key: "primary", header: "Is Primary", value: (r) => (r.isPrimary ? "Yes" : "No") },
      {
        key: "apiKey",
        header: "API Key (masked)",
        value: (r) => r.apiKeyMasked,
      },
      {
        key: "webhook",
        header: "Webhook URL",
        value: (r) => r.webhookUrl,
      },
      {
        key: "lastSync",
        header: "Last Sync",
        value: (r) =>
          r.lastSync === "—" ? "Never" : formatRelativeTime(r.lastSync),
      },
      {
        key: "verifications30d",
        header: "Verifications 30d",
        value: (r) => r.verifications30d,
      },
      {
        key: "approvalRate",
        header: "Approval Rate %",
        value: (r) => r.approvalRate.toFixed(1),
      },
      {
        key: "approvalRateDelta",
        header: "Approval Rate Δ MoM",
        value: (r) => r.approvalRateDelta.toFixed(1),
      },
      {
        key: "avgProcessingMinutes",
        header: "Avg Processing (min)",
        value: (r) => r.avgProcessingMinutes.toFixed(1),
      },
    ];
    exportToCsv(KYC_PROVIDERS, exportColumns, "kyc-providers.csv");
  };

  return (
    <Page>
      <PageHeader
        title="KYC Providers"
        description="Configure identity verification providers, credentials, and fallback order."
        icon={ShieldCheck}
        term={`Across all ${term("account")} KYC submissions · ${KYC_PROVIDERS.length} providers configured`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Active Providers"
            value={kpis.activeCount}
            deltaLabel={`of ${KYC_PROVIDERS.length} configured`}
            icon={ShieldCheck}
            tone="positive"
          />
          <MetricCard
            label="Total Verifications 30d"
            value={kpis.totalVerifications}
            deltaLabel={`across all ${term("account")} KYC submissions`}
            icon={Activity}
            tone="default"
          />
          <MetricCard
            label="Approval Rate"
            value={`${kpis.approvalRate.toFixed(1)}%`}
            delta={2.1}
            deltaLabel="MoM"
            icon={ShieldCheck}
            tone="positive"
          />
          <MetricCard
            label="Avg Processing Time"
            value={`${kpis.avgProcessing.toFixed(1)} min`}
            delta={-0.4}
            deltaLabel="MoM"
            icon={Clock}
            tone="positive"
          />
        </div>

        {/* Primary provider highlighted card */}
        <PrimaryProviderCard
          provider={primary}
          onEdit={() => openEdit(primary)}
          onTest={() => handleTest(primary)}
          onDeactivate={() => handleDeactivateFromCard(primary)}
        />

        {/* Provider list */}
        <DataTable
          columns={columns}
          data={KYC_PROVIDERS}
          rowKey={(row) => row.id}
          pageSize={10}
          searchableText={(row) =>
            `${row.name} ${row.description} ${row.status} ${row.webhookUrl}`
          }
          searchPlaceholder="Search providers…"
          toolbar={
            <>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Export
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast({
                    title: "Provider marketplace",
                    description: "Provider marketplace would open here.",
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Add provider
              </Button>
            </>
          }
          emptyTitle="No KYC providers configured"
          emptyDescription="Connect a provider to start collecting identity verifications."
        />

        {/* Add provider empty state */}
        <AddProviderCard />

        {/* Fallback order */}
        <FallbackOrderSection
          order={orderedFallback}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />
      </PageContent>

      {/* Edit sheet drawer */}
      <EditProviderSheet
        provider={editProvider}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </Page>
  );
}
