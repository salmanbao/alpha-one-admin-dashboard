"use client";

/**
 * Settings — User Management Page
 *
 * Comprehensive user directory: KYC + 2FA status, revenue, account counts,
 * status, last-active, and per-row actions. Search + status/KYC filters +
 * pagination + Add/Import/Export toasts.
 *
 * Combines the platform AuthUser list with tenant traders to give the operator
 * a single view of every identity on the platform. KYC and 2FA are derived
 * (admins are always verified; traders carry KYC status from kycRecords).
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantKyc,
  getTenantPayouts,
  getTenantTraders,
  users as authUsers,
  type Trader,
} from "@/lib/platform/mock-data";
import type { AuthUser } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import {
  formatCurrency,
  formatCompact,
  kycStatusTone,
  StatusBadge,
  traderStatusTone,
} from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Users,
  ShieldCheck,
  KeyRound,
  UserX,
  Search,
  Plus,
  Upload,
  Download,
  Pencil,
  Eye,
  Filter,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type UserStatus = "active" | "invited" | "suspended" | "breached";
type KycStatus = "approved" | "review" | "pending" | "rejected" | "expired" | "verified";

interface UserRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** KYC verification status badge value. */
  kyc: KycStatus;
  /** Two-factor authentication enabled? */
  twoFactor: boolean;
  revenue: number;
  accountCount: number;
  status: UserStatus;
  lastActive: string;
  /** Whether the row represents a platform admin (vs a trader). */
  isAdmin: boolean;
}

const REVENUE_PER_TRADER = 260;

export function UserManagementPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);
  const kyc = useMemo(() => getTenantKyc(tid), [tid]);
  // Auth users scoped to THIS tenant only — previously showed all platform
  // staff (Sarah Chen Alpha, Marcus Beta, Priya Gamma, Alex Platform super-
  // admin) on every tenant's User Management page. A tenant admin should
  // only see their own staff + their traders; super-admin (tid === "platform")
  // intentionally sees everyone.
  const authUserList = useMemo<AuthUser[]>(
    () => (tid === "platform" ? authUsers : authUsers.filter((u) => u.tenantId === tid)),
    [tid],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kycFilter, setKycFilter] = useState<string>("all");

  // Build user rows: auth users (admins) first, then traders.
  const allRows = useMemo<UserRow[]>(() => {
    const rows: UserRow[] = [];

    // Admin users (auth users) — KYC is "verified" (skipped for staff),
    // 2FA is enabled for all admins, revenue is N/A (0), accounts = 0.
    for (const u of authUserList) {
      const lastActive = u.lastActiveAt;
      // Auth-user "status" is always active — they're staff who just logged
      // status always active in prop-admin context
      // dead ternary that always returned "active".)
      const status: UserStatus = "active";
      rows.push({
        id: u.id,
        name: u.name,
        email: u.email,
        initials: u.initials,
        kyc: "verified",
        twoFactor: true,
        revenue: 0,
        accountCount: 0,
        status,
        lastActive,
        isAdmin: true,
      });
    }

    // Traders — derive KYC + revenue + accounts.
    const kycByTrader = new Map<string, KycStatus>();
    for (const k of kyc) kycByTrader.set(k.traderId, k.status);

    for (const t of traders) {
      const traderAccounts = accounts.filter((a) => a.traderId === t.id);
      const traderPayouts = payouts.filter((p) => p.traderId === t.id);
      const revenue =
        REVENUE_PER_TRADER +
        (traderAccounts.filter((a) => a.type === "funded").length * 280);
      const twoFactor = (parseInt(t.id.replace(/[^0-9]/g, "").slice(-2) || "0", 10) % 3) !== 0;
      rows.push({
        id: t.id,
        name: t.name,
        email: t.email,
        initials: t.name
          .split(/\s+/)
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
        kyc: kycByTrader.get(t.id) ?? (t.status === "invited" ? "pending" : "approved"),
        twoFactor,
        revenue,
        accountCount: traderAccounts.length,
        status: t.status,
        lastActive: t.joinedAt,
        isAdmin: false,
      });
    }

    return rows;
  }, [authUserList, traders, accounts, payouts, kyc]);

  // Filter rows.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kycFilter !== "all" && r.kyc !== kycFilter) return false;
      if (q && !`${r.name} ${r.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRows, search, statusFilter, kycFilter]);

  // KPI totals — use the unfiltered set.
  const totalUsers = allRows.length;
  // "Verified KYC" should only count real traders who completed KYC —
  // admin staff have a synthetic "verified" status that doesn't reflect
  // an actual KYC submission, so exclude them.
  const verifiedKyc = allRows.filter((r) => !r.isAdmin && r.kyc === "approved").length;
  const twoFactorEnabled = allRows.filter((r) => r.twoFactor).length;
  const suspendedUsers = allRows.filter((r) => r.status === "suspended").length;

  const columns: Column<UserRow>[] = [
    {
      key: "user",
      header: "User",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className={cn("text-[10px] font-medium", r.isAdmin ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted")}>
              {r.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{r.name}</span>
              {r.isAdmin ? (
                <Badge variant="outline" className="bg-emerald-50 text-[9px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  staff
                </Badge>
              ) : null}
            </div>
            <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
          </div>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "kyc",
      header: "KYC",
      cell: (r) => (
        <StatusBadge tone={kycStatusTone(r.kyc)}>
          {r.kyc}
        </StatusBadge>
      ),
      sortValue: (r) => r.kyc,
    },
    {
      key: "twoFactor",
      header: "2FA",
      cell: (r) => (
        r.twoFactor ? (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> on
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-rose-500/40 text-rose-700 dark:text-rose-400">
            <XCircle className="h-3 w-3" /> off
          </Badge>
        )
      ),
      sortValue: (r) => (r.twoFactor ? 1 : 0),
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (r) => (
        r.isAdmin ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{formatCurrency(r.revenue, currency)}</span>
        )
      ),
      sortValue: (r) => r.revenue,
      numeric: true,
    },
    {
      key: "accountCount",
      header: "Accounts",
      cell: (r) => (
        r.isAdmin ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{r.accountCount}</span>
        )
      ),
      sortValue: (r) => r.accountCount,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={traderStatusTone(r.status)}>{r.status}</StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "lastActive",
      header: "Last Active",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.lastActive).toLocaleDateString()}
        </span>
      ),
      sortValue: (r) => r.lastActive,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              toast({
                title: "Edit user",
                description: `Editing “${r.name}” (demo).`,
              });
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              toast({
                title: "View user",
                description: `Opening “${r.name}” profile (demo).`,
              });
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="sr-only">View</span>
          </Button>
        </div>
      ),
      width: "100px",
    },
  ];

  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (kycFilter !== "all" ? 1 : 0) + (search ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKycFilter("all");
  };

  return (
    <Page>
      <PageHeader
        title="User Management"
        description="Comprehensive directory of platform admins and tenant traders."
        icon={Users}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast({
                  title: "Import started",
                  description: "CSV import dialog would open here (demo).",
                })
              }
            >
              <Upload className="mr-1 h-4 w-4" /> Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast({
                  title: "Export started",
                  description: `Exporting ${filtered.length} users as CSV. (demo)`,
                })
              }
            >
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() =>
                toast({
                  title: "Add user",
                  description: "User creation form would open here (demo).",
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add User
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Users" value={totalUsers} icon={Users} tone="default" />
          <MetricCard label="Verified KYC" value={verifiedKyc} icon={ShieldCheck} tone="positive" />
          <MetricCard label="2FA Enabled" value={twoFactorEnabled} icon={KeyRound} tone="positive" />
          <MetricCard label="Suspended" value={suspendedUsers} icon={UserX} tone={suspendedUsers > 0 ? "negative" : "positive"} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilters > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {activeFilters}
              </Badge>
            ) : null}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="h-8 pl-8 text-xs"
              aria-label="Search users"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
            <option value="breached">Breached</option>
          </select>
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by KYC"
          >
            <option value="all">All KYC</option>
            <option value="verified">Verified (staff)</option>
            <option value="approved">Approved</option>
            <option value="review">Review</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
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
            {filtered.length} of {allRows.length} users
          </span>
        </div>

        {/* Users table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            pageSize={10}
            emptyTitle="No users match your filters"
            emptyDescription="Try clearing filters or widening your search."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {formatCompact(filtered.length)} of {formatCompact(allRows.length)} users ·
          Admin staff carry verified KYC by default; traders carry KYC from the KYC module.
        </p>
      </PageContent>
    </Page>
  );
}
