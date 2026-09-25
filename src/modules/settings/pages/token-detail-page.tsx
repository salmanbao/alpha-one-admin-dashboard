"use client";

/**
 * Settings — Token Detail Page
 *
 * Single API token view + edit form. Reached from the Token Management list
 * (click-through on a token row) or directly via router.params.id — where
 * the id parameter IS the token hash itself (e.g. the 40-char SHA-1 string
 * like `ffc261a8fba610812e2bc0c93a6137d90afda52b`). When no id resolves to
 * a known token, the form renders a "new token" layout with an auto-generated
 * key on save.
 *
 * Layout follows AGENTS.md progressive disclosure: the Key field is read-only
 * (it's the token hash); editable fields are User, Expiration Date, Scopes,
 * IP Whitelist, and Is Active. Audit fields (Last Used / Created / Created By)
 * are read-only. The destructive "Delete Token" action requires an
 * AlertDialog confirmation per AGENTS.md §24.
 *
 * Save variants (Save / Save & add another / Save & continue editing) +
 * "Regenerate Key" follow the established pattern on certificate-detail-page
 * and other settings detail editors.
 *
 * A "Token Usage Stats" card below the form surfaces high-level traffic
 * telemetry: total calls, 24h calls, last IP used, most-called endpoint.
 *
 * Uses ContextualHelp / LabelWithHelp (§33) for inline field explanations.
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  traders as allTraders,
  users as authUsers,
  type Trader,
} from "@/lib/platform/mock-data";
import type { AuthUser } from "@/lib/platform/types";
import { Page, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCompact } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  History,
  Trash2,
  Save,
  Plus,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  Activity,
  Globe,
  Server,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  Eye,
  Copy,
  TrendingUp,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & static option pools                                         */
/* ------------------------------------------------------------------ */

interface TokenScope {
  id: string;
  label: string;
  description: string;
}

const SCOPES: TokenScope[] = [
  { id: "read:trades", label: "Read Trades", description: "View open and closed positions, order history, and trade activity." },
  { id: "write:trades", label: "Write Trades", description: "Open, modify, and close positions on behalf of the linked account." },
  { id: "read:accounts", label: "Read Accounts", description: "View account balances, equity, margin, and metadata." },
  { id: "write:accounts", label: "Write Accounts", description: "Update account configuration (leverage, labels) where allowed." },
  { id: "read:payouts", label: "Read Payouts", description: "View payout history, pending requests, and payout methods." },
  { id: "approve:payouts", label: "Approve Payouts", description: "Approve, reject, or hold pending payout requests." },
  { id: "read:analytics", label: "Read Analytics", description: "Access aggregated firm analytics and trader performance metrics." },
  { id: "admin:all", label: "Admin Access", description: "Full administrative access — manage users, tenants, and all resources." },
];

/** User options for the User dropdown. */
function getUserOptions(tid: string): { id: string; email: string; name: string }[] {
  const tenantTraders = getTenantTraders(tid);
  // Platform tenant sees the full cross-tenant admin pool; a regular
  // tenant only sees its own auth users (no cross-tenant PII leak).
  const scopedAuthUsers = tid === "platform" ? authUsers : authUsers.filter((u) => u.tenantId === tid);
  const combined: (AuthUser | Trader)[] = [...scopedAuthUsers, ...tenantTraders];
  if (combined.length === 0) return [{ id: "system", email: "system@pfaas.io", name: "System" }];
  const seen = new Set<string>();
  const out: { id: string; email: string; name: string }[] = [];
  for (const u of combined) {
    if (seen.has(u.email)) continue;
    seen.add(u.email);
    out.push({ id: u.id, email: u.email, name: u.name });
    if (out.length >= 20) break;
  }
  return out;
}

/** Deterministic seed derived from a token hash string. */
function hashSeed(hash: string): number {
  let n = 0;
  for (let i = 0; i < hash.length; i++) {
    n = (n * 31 + hash.charCodeAt(i)) >>> 0;
  }
  return n;
}

/** Build a 40-character hex token hash from a seed. */
function hashFromSeed(seed: number): string {
  let s = seed >>> 0;
  let out = "";
  for (let i = 0; i < 40; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out += ((s >> 16) & 0xf).toString(16);
  }
  return out;
}

interface AdminByRecord {
  id: string;
  name: string;
  email: string;
}

interface TokenDetail {
  /** Full token hash — the identity of the token, also the URL id. */
  key: string;
  userId: string;
  userEmail: string;
  userName: string;
  expirationDate: string; // ISO datetime or empty
  scopes: string[];
  ipWhitelist: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: AdminByRecord;
}

interface TokenUsageStats {
  totalCalls: number;
  last24hCalls: number;
  lastIpUsed: string;
  mostCalledEndpoint: string;
}

/** Deterministic token detail derived from the id (the token hash itself). */
function buildTokenDetail(id: string, tid: string): TokenDetail {
  // Treat the id as the token hash. If it's missing or looks like a sentinel
  // (e.g. "new" or empty), generate a fresh hash so the form can show a
  // realistic example for the new-token flow.
  const isNew = !id || id === "new";
  const seed = isNew ? (Date.now() & 0xffffffff) >>> 0 : hashSeed(id);
  const key = isNew ? hashFromSeed(seed) : id;

  const userOptions = getUserOptions(tid);
  const userIndex = seed % userOptions.length;
  const user = userOptions[userIndex];

  // Scopes — start with read:trades always, then add 1-3 more based on seed.
  const scopePool = SCOPES.map((s) => s.id).filter((s) => s !== "read:trades");
  const additional = (seed % 4); // 0..3
  const extra: string[] = [];
  for (let i = 0; i < additional; i++) {
    const idx = (seed + i * 7) % scopePool.length;
    const candidate = scopePool[idx];
    if (!extra.includes(candidate)) extra.push(candidate);
  }
  const scopes = ["read:trades", ...extra];

  // Expiration: ~50% of tokens have one, set 30-180 days in the future
  // (or past for revoked tokens).
  const hasExpiration = (seed % 2) === 0;
  const expirationDate = hasExpiration
    ? new Date(Date.now() + (30 + (seed % 150)) * 24 * 60 * 60 * 1000).toISOString()
    : "";

  // IP whitelist: ~30% have one with 1-3 IPs.
  const hasIpList = (seed % 3) === 0;
  const ipWhitelist = hasIpList
    ? Array.from({ length: 1 + (seed % 3) }, (_, i) => {
        const a = 50 + ((seed + i * 13) % 200);
        const b = 10 + ((seed + i * 17) % 240);
        const c = (seed + i * 19) % 256;
        const d = 1 + (seed + i * 23) % 254;
        return `${a}.${b}.${c}.${d}`;
      }).join(", ")
    : "";

  // Active: ~85% active
  const isActive = (seed % 7) !== 0;

  // Created: 1-365 days ago.
  const createdDays = 1 + (seed % 365);
  const createdAt = new Date(Date.now() - createdDays * 24 * 60 * 60 * 1000).toISOString();

  // Last used: 0-72 hours ago if active, null if revoked.
  const lastUsedAt = isActive
    ? new Date(Date.now() - (seed % 72) * 60 * 60 * 1000).toISOString()
    : null;

  // Created by: deterministic admin user (scoped to the calling tenant —
  // platform tenant sees the full admin pool; regular tenants only see
  // their own admins, no cross-tenant staff leak).
  const scopedAuth = tid === "platform" ? authUsers : authUsers.filter((u) => u.tenantId === tid);
  const adminOptions = scopedAuth.filter((u) =>
    u.roles?.some((r) => r === "super-admin" || r === "prop-admin"),
  );
  const adminPool = adminOptions.length > 0 ? adminOptions : scopedAuth;
  const admin = adminPool[seed % adminPool.length] ?? {
    id: "user-super",
    name: "Alex Morgan",
    email: "alex@pfaas.io",
  };

  return {
    key,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    expirationDate,
    scopes,
    ipWhitelist,
    isActive,
    lastUsedAt,
    createdAt,
    createdBy: { id: admin.id, name: admin.name, email: admin.email },
  };
}

/** Deterministic token usage stats derived from the token hash. */
function buildUsageStats(seed: number): TokenUsageStats {
  const totalCalls = 12000 + (seed % 8000); // 12,000 – 19,999
  const last24hCalls = 50 + (seed % 400); // 50 – 449
  const a = 10 + ((seed >> 2) % 240);
  const b = 1 + ((seed >> 3) % 254);
  const c = 1 + ((seed >> 4) % 254);
  const d = (seed >> 5) % 256;
  const lastIpUsed = `${a}.${b}.${c}.${d}`;
  const endpoints = [
    "GET /api/v1/accounts",
    "GET /api/v1/trades",
    "GET /api/v1/positions",
    "POST /api/v1/orders",
    "GET /api/v1/payouts",
  ];
  const mostCalledEndpoint = endpoints[seed % endpoints.length];
  return { totalCalls, last24hCalls, lastIpUsed, mostCalledEndpoint };
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export function TokenDetailPage() {
  const { runtime, navigate, router } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const id = router.params.id ?? "";
  const isNew = !id || id === "new";

  const seedToken = useMemo(() => buildTokenDetail(id, tid), [id, tid]);
  // Local working state — initialized from the seed. As with the other
  // detail pages (certificate-detail-page), we don't re-sync on id change:
  // navigation between tokens happens via the parent list, not in-place.
  const [working, setWorking] = useState<TokenDetail>(seedToken);
  const userOptions = useMemo(() => getUserOptions(tid), [tid]);
  const usage = useMemo(() => buildUsageStats(hashSeed(seedToken.key)), [seedToken.key]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const update = (patch: Partial<TokenDetail>) =>
    setWorking((w) => ({ ...w, ...patch }));

  const toggleScope = (scopeId: string) => {
    setWorking((w) => {
      const has = w.scopes.includes(scopeId);
      return {
        ...w,
        scopes: has
          ? w.scopes.filter((s) => s !== scopeId)
          : [...w.scopes, scopeId],
      };
    });
  };

  const onUserChange = (email: string) => {
    const u = userOptions.find((o) => o.email === email);
    if (!u) return;
    update({ userId: u.id, userEmail: u.email, userName: u.name });
  };

  const onSave = () => {
    toast({
      title: "Token saved",
      description: `Changes to ${working.key.slice(0, 12)}… were saved. (demo)`,
    });
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `Token ${working.key.slice(0, 12)}… updated. Continuing edits. (demo)`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Token saved",
      description: "Token saved. Create another? (demo)",
    });
    // Reset to a fresh-token form for the operator.
    setWorking(buildTokenDetail("new", tid));
  };

  const onRegenerateKey = () => {
    toast({
      title: "New key generated",
      description: "The old key is immediately invalid. (demo)",
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Token deleted",
      description: `Token ${working.key.slice(0, 12)}… was permanently revoked. (demo)`,
    });
    navigate("token-management");
  };

  const onHistory = () => {
    toast({
      title: "Token usage history",
      description: "Token usage history would show IP addresses and timestamps.",
    });
  };

  const onUserProfile = () => {
    toast({
      title: "User profile",
      description: "User profile would open here.",
    });
  };

  const onCopyKey = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(working.key);
        toast({
          title: "Key copied",
          description: "Full token hash copied to clipboard.",
        });
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      toast({
        title: "Couldn't copy automatically",
        description: "Copy the key manually from the field below.",
      });
    }
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
                onClick={() => navigate("token-management")}
              >
                Tokens
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <span className="text-muted-foreground">/</span>
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {working.key.slice(0, 16)}…
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted p-2">
            <KeyRound className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {isNew ? "New API Token" : "API Token"}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {working.key.slice(0, 24)}…
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={working.isActive ? "success" : "muted"}>
            {working.isActive ? "Active" : "Revoked"}
          </StatusBadge>
          <Button size="sm" variant="outline" onClick={onHistory}>
            <History className="mr-1 h-3.5 w-3.5" /> History
          </Button>
        </div>
      </div>

      <PageContent>
        {/* Form grid — 2 columns on lg, stacks on smaller screens */}
        <TokenForm
          key={working.key}
          working={working}
          userOptions={userOptions}
          showKey={showKey}
          onToggleShowKey={() => setShowKey((s) => !s)}
          onUserChange={onUserChange}
          onFieldChange={update}
          onToggleScope={toggleScope}
          onCopyKey={onCopyKey}
          onUserProfile={onUserProfile}
        />

        <Separator />

        {/* Token Usage Stats */}
        <section className="rounded-lg border bg-card p-4">
          <header className="mb-4 flex items-start gap-2">
            <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
              <Activity className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Token Usage Stats
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rolling telemetry for this token across all API calls. Use the
                History button above for the full IP-level breakdown.
              </p>
            </div>
          </header>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Total API Calls"
              value={formatCompact(usage.totalCalls)}
              icon={Zap}
              tone="default"
            />
            <MetricCard
              label="Last 24h Calls"
              value={formatCompact(usage.last24hCalls)}
              icon={TrendingUp}
              tone="positive"
            />
            <MetricCard
              label="Last IP Used"
              value={usage.lastIpUsed}
              icon={Globe}
              tone="default"
            />
            <MetricCard
              label="Most Called Endpoint"
              value={usage.mostCalledEndpoint}
              icon={Server}
              tone="default"
            />
          </div>
        </section>

        <Separator />

        {/* Footer action bar — destructive on the left, save variants on right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Token
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Delete this token?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The token will be permanently revoked. Any API integrations
                  using this token will immediately stop working. This action
                  cannot be undone.
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
            <Button size="sm" variant="outline" onClick={onRegenerateKey}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate Key
            </Button>
            <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
            </Button>
            <Button size="sm" variant="outline" onClick={onSaveAndContinue}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
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

function TokenForm({
  working,
  userOptions,
  showKey,
  onToggleShowKey,
  onUserChange,
  onFieldChange,
  onToggleScope,
  onCopyKey,
  onUserProfile,
}: {
  working: TokenDetail;
  userOptions: { id: string; email: string; name: string }[];
  showKey: boolean;
  onToggleShowKey: () => void;
  onUserChange: (email: string) => void;
  onFieldChange: (patch: Partial<TokenDetail>) => void;
  onToggleScope: (scopeId: string) => void;
  onCopyKey: () => void;
  onUserProfile: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Key + User */}
      <FormSection
        title="Identification"
        icon={KeyRound}
        description="The token hash and the user it belongs to."
      >
        <div className="space-y-3">
          {/* Key — read-only, monospace, with show/hide toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <LabelWithHelp
                help="The full SHA-1 token hash. This is the token's identity — it is read-only. Use Regenerate Key to mint a new hash if this one is compromised."
                className="text-sm font-medium"
              >
                Key<span className="text-rose-600"> *</span>
              </LabelWithHelp>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={onToggleShowKey}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? (
                    <>
                      <Eye className="mr-1 h-3 w-3" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1 h-3 w-3" /> Show
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={onCopyKey}
                  aria-label="Copy key"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Input
              value={
                showKey ? working.key : `${working.key.slice(0, 12)}${"•".repeat(28)}`
              }
              readOnly
              className="font-mono text-xs"
              aria-label="Token key"
            />
            <p className="text-xs text-muted-foreground">
              Stored as a one-way hash — full plaintext is shown only once at
              generation time.
            </p>
          </div>

          {/* User — Select with 3-dot menu */}
          <div className="space-y-1.5">
            <LabelWithHelp
              help="The user this token authenticates as. Tokens inherit the user's permissions and tenant scope."
              className="text-sm font-medium"
            >
              User<span className="text-rose-600"> *</span>
            </LabelWithHelp>
            <div className="flex items-center gap-1.5">
              <Select
                value={working.userEmail}
                onValueChange={onUserChange}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((u) => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.email} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 shrink-0 px-2"
                onClick={onUserProfile}
                aria-label="User quick actions"
                title="User quick actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {working.userName} · {working.userId}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Scopes + Expiration */}
      <FormSection
        title="Capabilities & Lifetime"
        icon={ShieldCheck}
        description="What the token can do and when it expires."
      >
        <div className="space-y-3">
          {/* Expiration Date */}
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Leave empty for tokens that don't expire. Set a date for automatic token revocation. When the date passes, the token flips to Revoked and any further API calls are rejected."
              className="text-sm font-medium"
            >
              Expiration Date
            </LabelWithHelp>
            <Input
              type="datetime-local"
              value={
                working.expirationDate
                  ? new Date(working.expirationDate).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                onFieldChange({
                  expirationDate: v
                    ? new Date(v).toISOString()
                    : "",
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for tokens that don&apos;t expire. Set a date for
              automatic token revocation.
            </p>
          </div>

          {/* Scopes */}
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Each scope grants a specific capability. Read scopes are safe to audit; Write / Approve / Admin scopes carry operational risk — grant the minimum needed."
              className="text-sm font-medium"
            >
              Scopes
            </LabelWithHelp>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SCOPES.map((scope) => {
                const checked = working.scopes.includes(scope.id);
                return (
                  <label
                    key={scope.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted/30",
                      checked && "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
                    )}
                    title={scope.description}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleScope(scope.id)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {scope.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {scope.id}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {working.scopes.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No scopes selected — the token cannot do anything.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Active:</span>
                {working.scopes.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="font-mono text-[10px]"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {/* IP Whitelist + Active */}
      <FormSection
        title="Access Control"
        icon={Globe}
        description="Restrict which IPs can use this token and toggle its status."
      >
        <div className="space-y-3">
          {/* IP Whitelist */}
          <div className="space-y-1.5">
            <LabelWithHelp
              help="Comma-separated IP addresses allowed to use this token. Leave empty to allow all IPs. Restricting IPs is recommended for high-privilege tokens (Admin / Write)."
              className="text-sm font-medium"
            >
              IP Whitelist
            </LabelWithHelp>
            <Textarea
              rows={3}
              value={working.ipWhitelist}
              onChange={(e) =>
                onFieldChange({ ipWhitelist: e.target.value })
              }
              placeholder="e.g. 192.168.1.50, 10.0.0.20"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated IP addresses allowed to use this token. Leave
              empty to allow all IPs.
            </p>
          </div>

          <Separator />

          {/* Is Active */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <Label
                htmlFor="tok-active"
                className="cursor-pointer text-sm font-medium"
              >
                Is Active
              </Label>
              <span className="text-xs text-muted-foreground">
                Revoked tokens immediately reject all API calls.
              </span>
            </div>
            <Switch
              id="tok-active"
              checked={working.isActive}
              onCheckedChange={(v) =>
                onFieldChange({ isActive: Boolean(v) })
              }
            />
          </div>
        </div>
      </FormSection>

      {/* Audit metadata */}
      <FormSection
        title="Audit Metadata"
        icon={Calendar}
        description="Read-only fields set when the token was created and last used."
      >
        <div className="space-y-3">
          <ReadOnlyField
            icon={Clock}
            label="Last Used"
            value={
              working.lastUsedAt
                ? new Date(working.lastUsedAt).toLocaleString()
                : "never"
            }
            help="When the token was last used for authentication."
          />
          <ReadOnlyField
            icon={Calendar}
            label="Created"
            value={new Date(working.createdAt).toLocaleString()}
            help="When the token was created."
          />
          <ReadOnlyField
            icon={User}
            label="Created By"
            value={`${working.createdBy.name} (${working.createdBy.email})`}
            help="The admin user who created the token."
          />
        </div>
      </FormSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
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
  icon: Icon,
  label,
  value,
  help,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <LabelWithHelp
        help={help ?? "Read-only."}
        className="text-sm font-medium"
      >
        {label}
      </LabelWithHelp>
      <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
