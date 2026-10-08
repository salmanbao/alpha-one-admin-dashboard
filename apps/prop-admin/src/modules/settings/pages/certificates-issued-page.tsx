"use client";

/**
 * Certificates Issued Page — searchable list of certificates awarded to
 * traders for passing challenges and reaching milestones.
 *
 * Spec sections 12, 25, 26, 27, 30. Includes:
 *   - KPI row: Total Issued, Valid, Expired, Revoked
 *   - Search by trader name / email / certificate type
 *   - Filters: Certificate Type, Status
 *   - DataTable with Account, Trader Name, Certificate Type (badge),
 *     Challenge Name, Issue Date, Certificate URL (clickable link, new tab),
 *     Status (ExplainableStateBadge), Actions (3-dot menu)
 *   - Export CSV button (toast)
 *   - "Issue Certificate" primary action (toast)
 *
 * Mock data is generated from getTenantTraders(tid) so the trader names /
 * emails match what the operator sees elsewhere on the platform. The mock
 * generator is shared with the certificate detail page (so the row's "View
 * Certificate" menu action can navigate to a matching record).
 *
 * Terra palette — emerald / amber / rose accents, no blue / indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  traders as allTraders,
  type Trader,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { StatusBadge } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Award,
  Search,
  Plus,
  Download,
  Filter,
  X,
  MoreVertical,
  ExternalLink,
  Eye,
  Ban,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ScrollText,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CertType = "Challenge Passed" | "Funded Trader" | "Competition Winner";
export type CertStatus = "valid" | "expired" | "revoked";

export interface IssuedCertificate {
  id: string;
  accountEmail: string;
  traderName: string;
  traderId: string;
  certType: CertType;
  challengeName: string;
  /** ISO date string — when the certificate was issued. */
  issueDate: string;
  certUrl: string;
  status: CertStatus;
  /** Links to certificateTemplates[id]. */
  templateId: string;
  /** Optional linked withdrawal id (mock). */
  withdrawalId?: string;
  withdrawalAmount: number;
  /** ISO date — when the record was created. */
  createdAt: string;
}

export const CERT_TYPES: CertType[] = [
  "Challenge Passed",
  "Funded Trader",
  "Competition Winner",
];

const CERT_STATUSES: CertStatus[] = ["valid", "expired", "revoked"];

const CHALLENGE_NAMES = [
  "2-Step Evaluation",
  "1-Step Evaluation",
  "Instant Funded",
  "3-Step Evaluation",
  "Free Trial",
  "Trader Competition",
];

/* ------------------------------------------------------------------ */
/* Mock data generators (shared with the detail page)                  */
/* ------------------------------------------------------------------ */

/** Hash a string to a 32-bit unsigned int (deterministic). */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Inline days-ago helper (mock-data.ts keeps its own private). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * Resolve a trader for a given id deterministically. Falls back to the
 * global traders list when the tenant has no traders (e.g. platform tenant).
 */
function resolveTrader(tid: string, seed: number): Trader {
  const tenantTraders = getTenantTraders(tid);
  const pool = tenantTraders.length > 0 ? tenantTraders : allTraders;
  if (pool.length === 0) {
    // Hard-coded synthetic fallback so the page never crashes.
    const fallback: Trader = {
      id: `trader-fallback-${seed}`,
      tenantId: tid,
      name: "Jordan Rivera",
      email: "jordan.rivera@email.com",
      country: "US",
      status: "active",
      joinedAt: isoDaysAgo(120),
      challengePhase: "funded",
      accountBalance: 25000,
      equity: 27000,
      totalPnl: 2000,
      winRate: 58,
      trades: 132,
    };
    return fallback;
  }
  return pool[seed % pool.length];
}

/**
 * Synthesize a single IssuedCertificate for the given id. The same id always
 * yields the same record, so list row clicks can navigate to the detail
 * page with a matching record.
 */
export function synthesizeCertificate(id: string, tid: string): IssuedCertificate {
  const h = hashString(id);
  const t = resolveTrader(tid, h);
  const certType = CERT_TYPES[h % CERT_TYPES.length];
  const challengeName = CHALLENGE_NAMES[h % CHALLENGE_NAMES.length];
  // ~70% valid, ~15% expired, ~15% revoked
  const statusRoll = h % 20;
  const status: CertStatus =
    statusRoll < 14 ? "valid" : statusRoll < 17 ? "expired" : "revoked";
  const issueDate = isoDaysAgo(20 + (h % 360));
  return {
    id,
    accountEmail: t.email,
    traderName: t.name,
    traderId: t.id,
    certType,
    challengeName,
    issueDate,
    certUrl: `https://certs.pfaas.io/${id}`,
    status,
    templateId: `cert-${(h % 3) + 1}`,
    withdrawalId: `wd-${1000 + (h % 200)}`,
    withdrawalAmount: 250 + (h % 40) * 250,
    createdAt: issueDate,
  };
}

/**
 * Generate the seeded list of issued certificates for a tenant. The list
 * always contains 10 entries with stable ids so the detail page can look
 * them up.
 */
export function getIssuedCertificates(tid: string): IssuedCertificate[] {
  return Array.from({ length: 10 }, (_, i) =>
    synthesizeCertificate(`ci-${tid}-${i + 1}`, tid),
  );
}

/**
 * Look up a single issued certificate by id. If the id isn't in the seeded
 * list (e.g. navigated from elsewhere), synthesize one deterministically so
 * the detail page can still render something meaningful.
 */
export function getIssuedCertificate(
  id: string,
  tid: string,
): IssuedCertificate {
  const seeded = getIssuedCertificates(tid).find((c) => c.id === id);
  return seeded ?? synthesizeCertificate(id || "ci-unknown", tid);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Tone for the Certificate Type badge. */
function certTypeTone(
  certType: CertType,
): "info" | "warning" | "success" | "muted" {
  switch (certType) {
    case "Challenge Passed":
      return "success";
    case "Funded Trader":
      return "info";
    case "Competition Winner":
      return "warning";
    default:
      return "muted";
  }
}

/** Escape a CSV cell value. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export function CertificatesIssuedPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const certificates = useMemo(() => getIssuedCertificates(tid), [tid]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter((c) => {
      if (typeFilter !== "all" && c.certType !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const haystack = `${c.traderName} ${c.accountEmail} ${c.certType} ${c.challengeName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [certificates, search, typeFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = certificates.length;
    const valid = certificates.filter((c) => c.status === "valid").length;
    const expired = certificates.filter((c) => c.status === "expired").length;
    const revoked = certificates.filter((c) => c.status === "revoked").length;
    return { total, valid, expired, revoked };
  }, [certificates]);

  const activeFilters =
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const onIssue = () =>
    toast({
      title: "Issue certificate",
      description: "Issue form would open here (demo).",
    });

  const onExport = () =>
    toast({
      title: "Export started",
      description: `Exporting ${filtered.length} certificates as CSV.`,
    });

  const onRevoke = (c: IssuedCertificate) =>
    toast({
      title: "Revoke certificate",
      description: `Certificate ${c.id} for ${c.traderName} would be revoked (demo).`,
    });

  const onResend = (c: IssuedCertificate) =>
    toast({
      title: "Certificate email re-sent",
      description: `A copy of the certificate was emailed to ${c.accountEmail}.`,
    });

  const onView = (c: IssuedCertificate) => {
    navigate("certificate-detail", { id: c.id });
  };

  const columns: Column<IssuedCertificate>[] = [
    {
      key: "account",
      header: "Account",
      cell: (c) => (
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">
            {c.accountEmail}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {c.traderId}
          </span>
        </div>
      ),
      sortValue: (c) => c.accountEmail,
    },
    {
      key: "traderName",
      header: "Trader Name",
      cell: (c) => (
        <span className="font-medium text-foreground">{c.traderName}</span>
      ),
      sortValue: (c) => c.traderName,
    },
    {
      key: "certType",
      header: "Certificate Type",
      cell: (c) => (
        <StatusBadge tone={certTypeTone(c.certType)}>{c.certType}</StatusBadge>
      ),
      sortValue: (c) => c.certType,
    },
    {
      key: "challengeName",
      header: "Challenge Name",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">{c.challengeName}</span>
      ),
      sortValue: (c) => c.challengeName,
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {new Date(c.issueDate).toLocaleDateString()}
        </span>
      ),
      sortValue: (c) => c.issueDate,
    },
    {
      key: "certUrl",
      header: "Certificate URL",
      cell: (c) => (
        <a
          href={c.certUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[220px] items-center gap-1 truncate text-xs text-emerald-700 underline-offset-2 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
          title={c.certUrl}
        >
          <span className="truncate">{c.certUrl}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ),
      sortValue: (c) => c.certUrl,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <ExplainableStateBadge
          status={c.status}
          entityType="certificate"
          detail={`Certificate URL: ${c.certUrl}`}
        />
      ),
      sortValue: (c) => c.status,
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Actions for ${c.traderName}'s certificate`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Certificate actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onView(c)}>
                <Eye className="h-3.5 w-3.5" />
                View Certificate
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={c.status === "revoked"}
                onClick={() => onRevoke(c)}
              >
                <Ban className="h-3.5 w-3.5" />
                Revoke Certificate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onResend(c)}>
                <Send className="h-3.5 w-3.5" />
                Re-send Email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      width: "60px",
    },
  ];

  const emptyTitle =
    certificates.length === 0
      ? "No certificates issued yet"
      : "No certificates match your filters";
  const emptyDescription =
    certificates.length === 0
      ? "Certificates are automatically issued when traders pass challenges."
      : "Try clearing filters or widening your search.";

  return (
    <Page>
      <PageHeader
        title="Issued Certificates"
        description="Certificates awarded to traders for passing challenges and reaching milestones."
        icon={Award}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" onClick={onIssue}>
              <Plus className="mr-1 h-4 w-4" /> Issue Certificate
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Issued"
            value={kpis.total}
            icon={ScrollText}
            tone="default"
          />
          <MetricCard
            label="Valid"
            value={kpis.valid}
            icon={CheckCircle2}
            tone="positive"
          />
          <MetricCard
            label="Expired"
            value={kpis.expired}
            icon={AlertTriangle}
            tone={kpis.expired > 0 ? "warning" : "positive"}
          />
          <MetricCard
            label="Revoked"
            value={kpis.revoked}
            icon={XCircle}
            tone={kpis.revoked > 0 ? "negative" : "positive"}
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
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by trader name, email, or certificate type…"
              className="h-8 pl-8 text-xs"
              aria-label="Search issued certificates"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              className="h-8 w-[180px] text-xs"
              aria-label="Filter by certificate type"
            >
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CERT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="h-8 w-[160px] text-xs"
              aria-label="Filter by status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CERT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            {filtered.length} of {certificates.length} certificates
          </span>
        </div>

        {/* Table */}
        <div className={cn("rounded-lg border bg-card")}>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            onRowClick={onView}
            searchPlaceholder="Search certificates…"
            searchableText={(c) =>
              `${c.traderName} ${c.accountEmail} ${c.certType} ${c.challengeName}`
            }
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            pageSize={10}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Certificates are issued automatically when a trader passes a
          challenge phase, reaches funded status, or wins a competition. The
          URL is publicly verifiable while the certificate is valid.
        </p>
      </PageContent>
    </Page>
  );
}
