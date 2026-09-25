"use client";

/**
 * Settings — Token Management Page
 *
 * API token / key registry: shows every issued token with its key (truncated
 * hash), owning user, creation date, last-used date, and status (active /
 * revoked). Search by key or user. Generate / revoke / copy actions.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  users as authUsers,
  type Trader,
} from "@/lib/platform/mock-data";
import type { AuthUser } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  ShieldCheck,
  Copy,
  Plus,
  Search,
  Ban,
  Activity,
  Users,
  Filter,
  X,
} from "lucide-react";

interface ApiToken {
  id: string;
  /** Truncated key hash (display only). */
  keyPreview: string;
  /** Full masked key — used for copy action. */
  keyFull: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
  /** Optional scope label. */
  scope: string;
}

/** Deterministic mock token list derived from auth users + traders. */
function buildTokens(usersList: (AuthUser | Trader)[]): ApiToken[] {
  const scopes = ["read:trades", "read:payouts", "write:accounts", "read:metrics", "admin:all"];
  const out: ApiToken[] = [];
  let n = 0;
  for (const u of usersList) {
    // Each user has 1–3 tokens.
    const count = 1 + (n % 3);
    for (let i = 0; i < count; i++) {
      n++;
      const seed = parseInt(u.id.replace(/[^0-9]/g, "").slice(-3) + String(n), 10) || n;
      const hex = seed.toString(16).padStart(8, "0") + (seed * 7).toString(16).padStart(8, "0");
      const keyPreview = `pfaas_${hex.slice(0, 12)}`;
      const keyFull = `pfaas_${hex}${(seed * 13).toString(16).padStart(8, "0")}${(seed * 19).toString(16).padStart(8, "0")}`;
      const status: ApiToken["status"] = n % 7 === 0 ? "revoked" : "active";
      const createdDays = n * 4;
      const lastUsedDays = status === "active" ? n % 5 : null;
      const created = new Date(Date.now() - createdDays * 24 * 60 * 60 * 1000).toISOString();
      const lastUsed = lastUsedDays !== null
        ? new Date(Date.now() - lastUsedDays * 60 * 60 * 1000).toISOString()
        : null;
      out.push({
        id: `tok-${u.id}-${i}`,
        keyPreview: i === 0 ? `${keyPreview}…` : `${keyPreview.slice(0, 16)}…`,
        keyFull,
        userId: u.id,
        userEmail: u.email,
        createdAt: created,
        lastUsedAt: lastUsed,
        status,
        scope: scopes[n % scopes.length],
      });
    }
  }
  return out;
}

/** Time-ago formatter for last-used. */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function TokenManagementPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const tenantTraders = useMemo(() => getTenantTraders(tid), [tid]);
  // Auth users scoped to THIS tenant only — previously showed all platform
  // staff (Sarah, Marcus, Priya, Alex) on every tenant's Token Management
  // page, mixing super-admin platform tokens into a tenant admin's view.
  // Super-admin (tid === "platform") intentionally sees everyone.
  const scopedAuthUsers = useMemo(
    () => (tid === "platform" ? authUsers : authUsers.filter((u) => u.tenantId === tid)),
    [tid],
  );
  const allUsers = useMemo<(AuthUser | Trader)[]>(() => [...scopedAuthUsers, ...tenantTraders], [scopedAuthUsers, tenantTraders]);

  const tokens = useMemo(() => buildTokens(allUsers), [allUsers]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.keyPreview.toLowerCase().includes(q) ||
        t.keyFull.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q),
    );
  }, [tokens, search]);

  // KPI totals — use the unfiltered set.
  const totalTokens = tokens.length;
  const activeTokens = tokens.filter((t) => t.status === "active").length;
  const revokedTokens = tokens.filter((t) => t.status === "revoked").length;
  const uniqueUsers = new Set(tokens.map((t) => t.userId)).size;

  const copyToken = (t: ApiToken) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(t.keyFull).catch(() => {});
    }
    toast({
      title: "Token copied",
      description: `Full key copied to clipboard (demo).`,
    });
  };

  const revokeToken = (t: ApiToken) => {
    // Demo-only — token row stays "active" in the table because there's
    // no persistence layer. Honest copy prevents the operator thinking
    // the token was actually disabled.
    toast({
      title: "Token revoked (demo)",
      description: `Token ${t.keyPreview} would no longer authenticate in production.`,
      variant: "destructive",
    });
  };

  const generateToken = () => {
    const seed = Math.random().toString(16).slice(2, 18);
    toast({
      title: "Token generated",
      description: `New key: pfaas_${seed}… — copy it now, you won't see it again.`,
    });
  };

  const columns: Column<ApiToken>[] = [
    {
      key: "keyPreview",
      header: "Key",
      cell: (t) => (
        <span className="font-mono text-xs text-foreground">{t.keyPreview}</span>
      ),
      sortValue: (t) => t.keyPreview,
    },
    {
      key: "userEmail",
      header: "User",
      cell: (t) => <span className="text-sm text-foreground">{t.userEmail}</span>,
      sortValue: (t) => t.userEmail,
    },
    {
      key: "scope",
      header: "Scope",
      cell: (t) => (
        <Badge variant="outline" className="font-mono text-[10px]">
          {t.scope}
        </Badge>
      ),
      sortValue: (t) => t.scope,
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (t) => (
        <span className="text-xs text-muted-foreground">
          {new Date(t.createdAt).toLocaleDateString()}
        </span>
      ),
      sortValue: (t) => t.createdAt,
    },
    {
      key: "lastUsedAt",
      header: "Last Used",
      cell: (t) => (
        <span
          className={cn(
            "text-xs",
            t.lastUsedAt ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {timeAgo(t.lastUsedAt)}
        </span>
      ),
      sortValue: (t) => t.lastUsedAt ?? "",
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <StatusBadge tone={t.status === "active" ? "success" : "muted"}>
          {t.status}
        </StatusBadge>
      ),
      sortValue: (t) => t.status,
    },
    {
      key: "actions",
      header: "",
      cell: (t) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              copyToken(t);
            }}
            aria-label="Copy token"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {t.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-rose-600 hover:text-rose-700"
              onClick={(e) => {
                e.stopPropagation();
                revokeToken(t);
              }}
              aria-label="Revoke token"
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ),
      width: "100px",
    },
  ];

  const activeFilters = search ? 1 : 0;
  const clearFilters = () => setSearch("");

  return (
    <Page>
      <PageHeader
        title="Token Management"
        description="Registry of API keys and tokens with revocation controls."
        icon={KeyRound}
        actions={
          <Button size="sm" onClick={generateToken}>
            <Plus className="mr-1 h-4 w-4" /> Generate Token
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Tokens" value={totalTokens} icon={KeyRound} tone="default" />
          <MetricCard label="Active Tokens" value={activeTokens} icon={ShieldCheck} tone="positive" />
          <MetricCard label="Revoked Tokens" value={revokedTokens} icon={Ban} tone={revokedTokens > 0 ? "warning" : "default"} />
          <MetricCard label="Unique Users" value={uniqueUsers} icon={Users} tone="default" />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Search</span>
            {activeFilters > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {activeFilters}
              </Badge>
            ) : null}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by key hash or user email…"
              className="h-8 pl-8 text-xs"
              aria-label="Search tokens"
            />
          </div>
          {activeFilters > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {tokens.length} tokens
          </span>
        </div>

        {/* Tokens table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(t) => t.id}
            pageSize={10}
            emptyTitle="No tokens found"
            emptyDescription="Generate a new token to get started, or clear your search."
          />
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          Keys are stored as truncated hashes — full plaintext is shown only once at generation time.
        </p>
      </PageContent>
    </Page>
  );
}
