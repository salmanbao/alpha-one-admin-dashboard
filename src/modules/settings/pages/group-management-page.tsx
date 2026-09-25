"use client";

/**
 * Settings — Group Management Page
 *
 * Organize platform users into groups. A simple list of groups (with
 * checkboxes for bulk selection) sits on the left; clicking a group reveals
 * a detail panel on the right showing its members.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders, users as authUsers, type Trader } from "@/lib/platform/mock-data";
import type { AuthUser } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, traderStatusTone } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Users,
  UsersRound,
  Plus,
  Search,
  Filter,
  X,
  Crown,
  Shield,
  User,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  /** IDs of users assigned to this group (admin staff + traders). */
  memberIds: string[];
  /** Display color (Terra palette). */
  color: string;
}

/** Build a deterministic set of groups from the seed data. */
function buildGroups(allUsers: (AuthUser | Trader)[]): Group[] {
  const admins = allUsers.filter((u) => "application" in u && (u as AuthUser).application !== "trader" && (u as AuthUser).application === "super-admin");
  const propAdmins = allUsers.filter((u) => "application" in u && (u as AuthUser).application === "prop-admin");
  const traders = allUsers.filter((u) => "application" in u && (u as AuthUser).application === "trader");

  return [
    {
      id: "grp-admins",
      name: "Platform Admins",
      description: "Super-admin staff with full platform access.",
      createdAt: "2025-01-12T10:00:00Z",
      memberIds: (admins as (AuthUser | Trader)[]).map((u) => u.id),
      color: "#4a7c59",
    },
    {
      id: "grp-propadmins",
      name: "Prop Firm Admins",
      description: "Tenant admins responsible for managing trader cohorts.",
      createdAt: "2025-02-03T11:30:00Z",
      memberIds: (propAdmins as (AuthUser | Trader)[]).map((u) => u.id),
      color: "#059669",
    },
    {
      id: "grp-vip-traders",
      name: "VIP Traders",
      description: "Top-performing funded traders with elevated payout limits.",
      createdAt: "2025-03-15T09:15:00Z",
      memberIds: (traders as (AuthUser | Trader)[]).slice(0, Math.min(5, traders.length)).map((u) => u.id),
      color: "#d97706",
    },
    {
      id: "grp-new-traders",
      name: "New Traders",
      description: "Recently onboarded traders still in evaluation.",
      createdAt: "2025-04-22T14:45:00Z",
      memberIds: (traders as (AuthUser | Trader)[]).slice(5, Math.min(15, traders.length)).map((u) => u.id),
      color: "#0f766e",
    },
    {
      id: "grp-risk-watch",
      name: "Risk Watch",
      description: "Traders under active risk monitoring.",
      createdAt: "2025-05-08T16:20:00Z",
      memberIds: (traders as (AuthUser | Trader)[])
        .filter((t) => (t as Trader).status === "breached" || (t as Trader).status === "suspended")
        .slice(0, 6)
        .map((u) => u.id),
      color: "#e11d48",
    },
  ];
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  status: string;
  isAdmin: boolean;
}

export function GroupManagementPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const tenantTraders = useMemo(() => getTenantTraders(tid), [tid]);
  // Platform tenant sees the full cross-tenant admin pool; a regular
  // tenant only sees its own auth users (no cross-tenant PII leak).
  const scopedAuthUsers = useMemo(
    () => (tid === "platform" ? authUsers : authUsers.filter((u) => u.tenantId === tid)),
    [tid],
  );
  const allUsers = useMemo<(AuthUser | Trader)[]>(() => [...scopedAuthUsers, ...tenantTraders], [scopedAuthUsers, tenantTraders]);

  const groups = useMemo(() => buildGroups(allUsers), [allUsers]);

  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("grp-admins");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter groups by search.
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q),
    );
  }, [groups, search]);

  // Map for quick user lookup.
  const userMap = useMemo(() => {
    const m = new Map<string, AuthUser | Trader>();
    for (const u of allUsers) m.set(u.id, u);
    return m;
  }, [allUsers]);

  // Selected group's members.
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  const members: MemberRow[] = useMemo(() => {
    if (!selectedGroup) return [];
    const out: MemberRow[] = [];
    for (const id of selectedGroup.memberIds) {
      const u = userMap.get(id);
      if (!u) continue;
      const isAdmin = "application" in u && (u as AuthUser).application !== "trader";
      const status =
        "status" in u && typeof (u as Trader).status === "string"
          ? (u as Trader).status
          : "active";
      const initials =
        "initials" in u
          ? (u as AuthUser).initials
          : u.name
              .split(/\s+/)
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
      out.push({ id: u.id, name: u.name, email: u.email, initials, status, isAdmin });
    }
    return out;
  }, [selectedGroup, userMap]);

  // KPI totals.
  const totalGroups = groups.length;
  const totalMembers = Array.from(new Set(groups.flatMap((g) => g.memberIds))).length;
  const largestGroup = groups.reduce((a, b) => (a.memberIds.length > b.memberIds.length ? a : b), groups[0]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Page>
      <PageHeader
        title="Group Management"
        description="Organize users into groups for bulk actions, reporting, and risk monitoring."
        icon={UsersRound}
        actions={
          <Button
            size="sm"
            onClick={() =>
              toast({
                title: "Add group",
                description: "Group creation form would open here (demo).",
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add Group
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard label="Total Groups" value={totalGroups} icon={UsersRound} tone="default" />
          <MetricCard label="Total Members" value={totalMembers} icon={Users} tone="default" />
          <MetricCard label="Largest Group" value={largestGroup?.name ?? "—"} icon={Crown} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          {/* Group list */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Groups{" "}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({filteredGroups.length})
                </span>
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                {selectedIds.size > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() =>
                      toast({
                        title: "Bulk action",
                        description: `${selectedIds.size} groups selected for bulk action (demo).`,
                      })
                    }
                  >
                    Apply to {selectedIds.size}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="relative mb-3 w-full">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups…"
                className="h-8 pl-8 text-xs"
                aria-label="Search groups"
              />
            </div>
            <div className="flex flex-col gap-2">
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
                  <Search className="h-5 w-5" />
                  <p className="text-sm">No groups match your search.</p>
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const isSelected = g.id === selectedGroupId;
                  const isCheckbox = selectedIds.has(g.id);
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-start gap-2 rounded-md border p-3 transition-colors cursor-pointer",
                        isSelected
                          ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30"
                          : "hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedGroupId(g.id)}
                    >
                      <Checkbox
                        checked={isCheckbox}
                        onCheckedChange={() => toggleSelect(g.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select group ${g.name}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: g.color }}
                          />
                          <span className="font-medium text-foreground">{g.name}</span>
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                            {g.memberIds.length} members
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Created {new Date(g.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Group detail panel */}
          <div className="rounded-lg border bg-card p-4">
            {selectedGroup ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedGroup.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedGroup.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {members.length} members
                  </Badge>
                </div>
                <Separator />
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Member</TableHead>
                        <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Email</TableHead>
                        <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Type</TableHead>
                        <TableHead className="h-9 px-3 text-xs uppercase tracking-wide">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="p-3 text-center text-xs text-muted-foreground">
                            This group has no members yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className={cn("text-[10px]", m.isAdmin ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted")}>
                                    {m.initials}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{m.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2.5 text-xs">{m.email}</TableCell>
                            <TableCell className="px-3 py-2.5">
                              {m.isAdmin ? (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Shield className="h-3 w-3" /> staff
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <User className="h-3 w-3" /> trader
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2.5">
                              <StatusBadge tone={traderStatusTone(m.status)}>
                                {m.status}
                              </StatusBadge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Members exported",
                        description: `${members.length} members of ${selectedGroup.name} exported.`,
                      })
                    }
                  >
                    Export members
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      toast({
                        title: "Add member",
                        description: `Add a member to ${selectedGroup.name} (demo).`,
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Add member
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                <UsersRound className="h-6 w-6" />
                <p className="text-sm">Select a group to view its members.</p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
