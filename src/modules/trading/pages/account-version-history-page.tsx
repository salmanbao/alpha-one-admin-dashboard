"use client";

/**
 * Account Version History Page — object versioning with diff view.
 *
 * Every change to the account record is captured as a version snapshot.
 * The Changes column shows a compact `old_value → new_value` diff (old
 * value in strikethrough rose, new value in emerald green). Clicking a
 * row expands to show the full field breakdown for that version.
 *
 * Includes search + filter by changed field + date range + changed by,
 * CSV export, "Revert to Version" per row (toast), and a "Back to
 * Account" action. Mock 15-20 deterministic versions seeded from the
 * account id.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  History,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  GitCommit,
  User,
  Clock,
  FileText,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface AccountVersion {
  id: string;
  objectName: string;
  timestamp: string;
  comment: string;
  changedBy: string;
  changedByRole: string;
  changeReason: string;
  changes: FieldChange[];
}

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "180d": 180 * 24 * 60 * 60 * 1000,
};

/* ------------------------------------------------------------------ */
/* Deterministic version seed                                          */
/* ------------------------------------------------------------------ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const ACTORS = [
  { name: "Sarah Chen", role: "Admin" },
  { name: "Marcus Webb", role: "Risk Officer" },
  { name: "Priya Nair", role: "Compliance" },
  { name: "System", role: "Automated" },
  { name: "AI Engine", role: "AI" },
];

const CHANGE_REASONS = [
  "Configuration adjustment per policy update",
  "Manual adjustment by trader request",
  "Automated risk engine update",
  "Phase progression rule applied",
  "Compliance audit correction",
  "Onboarding data sync",
];

const FIELD_LABELS: Record<string, string> = {
  profitSplit: "Profit Split",
  payoutFrequency: "Payout Frequency",
  status: "Status",
  drawdownLimit: "Drawdown Limit",
  nextWithdrawalDate: "Next Withdrawal Date",
  phase: "Phase",
  accountLabel: "Account Label",
  kycStatus: "KYC Status",
};

const FIELDS = Object.keys(FIELD_LABELS);

/**
 * Build 15-20 deterministic versions for the account. Each version
 * changes a single field — derived deterministically from the account
 * id so the demo is stable across reloads.
 */
function generateVersions(accountId: string, accountName: string): AccountVersion[] {
  const seed = hashStr(accountId) || 7;
  const count = 15 + (seed % 6); // 15..20
  const out: AccountVersion[] = [];

  for (let i = 0; i < count; i++) {
    const field = FIELDS[(seed + i * 3) % FIELDS.length];
    const oldValuePairs: Record<string, [string, string]> = {
      profitSplit: ["60%", "70%"],
      payoutFrequency: ["Weekly", "Bi-Weekly"],
      status: ["active", "manual-review"],
      drawdownLimit: ["5%", "4%"],
      nextWithdrawalDate: ["2026-09-12", "2026-09-19"],
      phase: ["phase-1", "phase-2"],
      accountLabel: ["Paid", "Standard"],
      kycStatus: ["pending", "approved"],
    };
    const [oldV, newV] = oldValuePairs[field];
    // Alternate direction so we see both asc and desc diffs
    const forward = i % 2 === 0;
    const oldActual = forward ? oldV : newV;
    const newActual = forward ? newV : oldV;
    const actor = ACTORS[(seed + i) % ACTORS.length];
    const ts = new Date(
      Date.now() - (count - i) * 18 * 60 * 60 * 1000 - (seed % 30) * 60 * 1000,
    ).toISOString();
    const comment = `${FIELD_LABELS[field]} updated`;
    out.push({
      id: `ver-${accountId}-${i + 1}`,
      objectName: accountName,
      timestamp: ts,
      comment,
      changedBy: actor.name,
      changedByRole: actor.role,
      changeReason: CHANGE_REASONS[(seed + i) % CHANGE_REASONS.length],
      changes: [{ field: FIELD_LABELS[field], oldValue: oldActual, newValue: newActual }],
    });
  }
  // Occasionally produce a multi-field version (deterministic, idx 7 or 14)
  if (count >= 8) {
    const idx = 7;
    const v = out[idx];
    const extraField = FIELDS[(seed + 11) % FIELDS.length];
    v.changes.push({
      field: FIELD_LABELS[extraField],
      oldValue: "10%",
      newValue: "8%",
    });
    v.comment = `${v.changes.length} fields updated`;
  }
  return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/* ------------------------------------------------------------------ */
/* Diff cell                                                           */
/* ------------------------------------------------------------------ */

function DiffCell({ changes }: { changes: FieldChange[] }) {
  return (
    <div className="flex flex-col gap-1">
      {changes.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">{c.field}:</span>
          <span className="font-mono text-rose-600 line-through dark:text-rose-400">
            {c.oldValue}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
            {c.newValue}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AccountVersionHistoryPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accountId = router.params.id;

  const account = useMemo(
    () => getTenantAccounts(tid).find((a) => a.id === accountId),
    [tid, accountId],
  );

  const versions = useMemo(
    () => (account ? generateVersions(account.id, `${account.traderName} · Login ${account.login}`) : []),
    [account],
  );

  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build filter option lists from data
  const allFieldsTouched = useMemo(
    () =>
      Array.from(
        new Set(versions.flatMap((v) => v.changes.map((c) => c.field))),
      ).sort(),
    [versions],
  );
  const allActors = useMemo(
    () => Array.from(new Set(versions.map((v) => v.changedBy))).sort(),
    [versions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return versions.filter((v) => {
      if (cutoff > 0 && new Date(v.timestamp).getTime() < cutoff) return false;
      if (actorFilter !== "all" && v.changedBy !== actorFilter) return false;
      if (
        fieldFilter !== "all" &&
        !v.changes.some((c) => c.field === fieldFilter)
      )
        return false;
      if (
        q &&
        !`${v.objectName} ${v.comment} ${v.changedBy} ${v.changeReason} ${v.changes
          .map((c) => `${c.field} ${c.oldValue} ${c.newValue}`)
          .join(" ")}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [versions, search, fieldFilter, dateRange, actorFilter]);

  const activeFilters =
    (search ? 1 : 0) +
    (fieldFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (actorFilter !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setFieldFilter("all");
    setDateRange("all");
    setActorFilter("all");
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Version ID", value: (v) => v.id },
        { key: "objectName", header: "Object", value: (v) => v.objectName },
        { key: "timestamp", header: "Date/Time", value: (v) => v.timestamp },
        { key: "comment", header: "Comment", value: (v) => v.comment },
        { key: "changedBy", header: "Changed By", value: (v) => v.changedBy },
        { key: "changedByRole", header: "Role", value: (v) => v.changedByRole },
        { key: "changeReason", header: "Change Reason", value: (v) => v.changeReason },
        {
          key: "changes",
          header: "Changes",
          value: (v) =>
            v.changes
              .map((c) => `${c.field}: ${c.oldValue} -> ${c.newValue}`)
              .join("; "),
        },
      ],
      `account-versions-${account?.login ?? accountId}.csv`,
    );
  };

  const handleRevert = (v: AccountVersion) => {
    toast({
      title: "Version revert queued",
      description: `Version ${v.id} would restore all fields to ${new Date(v.timestamp).toLocaleString()}.`,
    });
  };

  const toggleExpand = (v: AccountVersion) => {
    setExpandedId((cur) => (cur === v.id ? null : v.id));
  };

  if (!account) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-accounts")} className="w-fit">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </Page>
    );
  }

  const columns: Column<AccountVersion>[] = [
    {
      key: "expand",
      header: "",
      cell: (v) => (
        <button
          type="button"
          aria-label={expandedId === v.id ? "Collapse version detail" : "Expand version detail"}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(v);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          {expandedId === v.id ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ),
      width: "32px",
    },
    {
      key: "objectName",
      header: "Object",
      cell: (v) => (
        <span className="text-xs font-medium">{v.objectName}</span>
      ),
      sortValue: (v) => v.objectName,
    },
    {
      key: "timestamp",
      header: "Date/Time",
      cell: (v) => (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {new Date(v.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (v) => v.timestamp,
      width: "170px",
    },
    {
      key: "comment",
      header: "Comment",
      cell: (v) => <span className="text-xs">{v.comment}</span>,
      sortValue: (v) => v.comment,
    },
    {
      key: "changedBy",
      header: "Changed By",
      cell: (v) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{v.changedBy}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px]",
              v.changedByRole === "Automated" || v.changedByRole === "AI"
                ? "border-violet-500/40 text-violet-700 dark:text-violet-400"
                : v.changedByRole === "Risk Officer" || v.changedByRole === "Compliance"
                ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
            )}
          >
            {v.changedByRole}
          </Badge>
        </div>
      ),
      sortValue: (v) => v.changedBy,
      width: "180px",
    },
    {
      key: "changeReason",
      header: "Change Reason",
      cell: (v) => (
        <span className="text-[11px] text-muted-foreground">{v.changeReason}</span>
      ),
      sortValue: (v) => v.changeReason,
    },
    {
      key: "changes",
      header: "Changes",
      cell: (v) => <DiffCell changes={v.changes} />,
      width: "260px",
    },
    {
      key: "actions",
      header: "Action",
      cell: (v) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={(e) => {
            e.stopPropagation();
            handleRevert(v);
          }}
        >
          <RotateCcw className="h-3 w-3" /> Revert to Version
        </Button>
      ),
      width: "160px",
    },
  ];

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
        title="Version History"
        description="Complete audit trail of all field changes with before/after values"
        icon={History}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              // "Back to Account" → actually navigate to the account
              // workspace (the parent view). Previously mislabeled and
              // went to trader-detail (a different entity).
              onClick={() => navigate("account-workspace", { id: account.id })}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Versions" value={versions.length} icon={GitCommit} />
        <MetricCard
          label="Unique Actors"
          value={allActors.length}
          icon={User}
        />
        <MetricCard
          label="Fields Tracked"
          value={allFieldsTouched.length}
          icon={FileText}
        />
        <MetricCard
          label="Latest Change"
          value={
            versions.length > 0
              ? new Date(versions[0].timestamp).toLocaleDateString()
              : "—"
          }
          icon={Clock}
        />
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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search object, comment, field, value…"
          className="h-8 w-64 text-xs"
        />
        <select
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by changed field"
        >
          <option value="all">All fields</option>
          {allFieldsTouched.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by changed by"
        >
          <option value="all">All actors</option>
          {allActors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="180d">Last 180 days</option>
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {versions.length} versions
        </span>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(v) => v.id}
            onRowClick={(v) => toggleExpand(v)}
            pageSize={10}
            emptyTitle="No versions match your filters"
            emptyDescription="Try widening the date range or clearing some filters."
          />
        </div>

        {/* Expanded detail */}
        {expandedId ? (
          <ExpandedVersionDetail
            version={filtered.find((v) => v.id === expandedId) ?? null}
            onRevert={handleRevert}
          />
        ) : null}

        {/* Footer help */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          <span>
            Object versioning preserves the full state of the account at each
            change. Reverting restores all fields to that snapshot — the
            revert itself is logged as a new version.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Inline expansion panel                                             */
/* ------------------------------------------------------------------ */

function ExpandedVersionDetail({
  version,
  onRevert,
}: {
  version: AccountVersion | null;
  onRevert: (v: AccountVersion) => void;
}) {
  if (!version) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <GitCommit className="h-4 w-4 text-muted-foreground" />
          Version detail — {version.id}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          onClick={() => onRevert(version)}
        >
          <RotateCcw className="h-3 w-3" /> Revert to Version
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Object
          </dt>
          <dd className="text-xs font-medium text-foreground">
            {version.objectName}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Date/Time
          </dt>
          <dd className="text-xs font-medium text-foreground tabular-nums">
            {new Date(version.timestamp).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Changed By
          </dt>
          <dd className="text-xs font-medium text-foreground">
            {version.changedBy}{" "}
            <Badge variant="outline" className="ml-1 text-[9px]">
              {version.changedByRole}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Comment
          </dt>
          <dd className="text-xs font-medium text-foreground">{version.comment}</dd>
        </div>
      </dl>
      <Separator className="my-3" />
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Affected fields ({version.changes.length})
        </p>
        <ul className="space-y-1.5">
          {version.changes.map((c, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">{c.field}:</span>
              <span className="font-mono text-rose-600 line-through dark:text-rose-400">
                {c.oldValue}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {c.newValue}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        <span className="font-medium">Reason: </span>
        {version.changeReason}
      </div>
    </div>
  );
}
