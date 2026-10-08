"use client";

/**
 * Offer Matching Users page (UX Constitution §25, §27).
 *
 * Lists the users that match an offer's targeting rules. Reached from
 * the Offer Edit page's "View Matching Users" navigation link.
 *
 * Layout:
 *  - PageHeader with offer name + back action
 *  - KPI row: Total Matches, Funded Matches, New Users, Existing Users
 *  - Search by email + DataTable (paginated at 100 rows per page)
 *  - "View User" action per row → trader-detail view
 *
 * Mock data is generated deterministically (no Math.random) from the
 * offer id so the totals stay stable for the demo. The total of 3,633
 * is surfaced in the header copy and KPI row.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getOffers } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserPlus, UserRound, ChevronLeft, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MatchingUser {
  id: string;
  email: string;
  country: string;
  accountStatus: "active" | "invited" | "suspended" | "breached";
  hasPurchased: boolean;
  funded: boolean;
}

/* ------------------------------------------------------------------ */
/* Deterministic mock generator                                        */
/* ------------------------------------------------------------------ */

const COUNTRIES = ["US", "GB", "AE", "SG", "DE", "FR", "BR", "IN", "ZA", "CA"];
const ACCOUNT_STATUSES: MatchingUser["accountStatus"][] = [
  "active",
  "active",
  "active",
  "invited",
  "suspended",
  "breached",
];
const FIRST_NAMES = [
  "Aarav", "Bianca", "Chen", "Daria", "Emeka", "Farah", "Gabriel", "Hana",
  "Ivan", "Jamal", "Kira", "Lena", "Mateo", "Noor", "Omar", "Priya",
  "Quentin", "Rina", "Sergei", "Talia", "Uma", "Victor", "Wei", "Xiomara",
  "Yusuf", "Zara",
];
const LAST_NAMES = [
  "Adams", "Bauer", "Costa", "Dimitrov", "El-Sayed", "Ferreira", "Gupta",
  "Haddad", "Ivanov", "Johnson", "Khan", "Lopez", "Müller", "Nakamura",
  "Oduya", "Petrov", "Quinn", "Rossi", "Singh", "Tanaka", "Ueda", "Vasquez",
  "Wong", "Xu", "Yamamoto", "Zubiri",
];
const DOMAINS = [
  "gmail.com", "outlook.com", "proton.me", "icloud.com", "fastmail.com",
  "yahoo.com", "tradermail.io",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Generate N matching users deterministically from the offer id. */
function generateMatchingUsers(offerId: string, total: number): MatchingUser[] {
  // Hash the offer id into a numeric seed for stable ordering.
  let seed = 7;
  for (let i = 0; i < offerId.length; i++) {
    seed = (seed * 31 + offerId.charCodeAt(i)) >>> 0;
  }
  const out: MatchingUser[] = [];
  for (let i = 0; i < total; i++) {
    const s = (seed + i * 1103515245 + 12345) >>> 0;
    const first = pick(FIRST_NAMES, s);
    const last = pick(LAST_NAMES, s >> 3);
    const domain = pick(DOMAINS, s >> 6);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${(i % 90) + 1}@${domain}`;
    const country = pick(COUNTRIES, s >> 9);
    const accountStatus = pick(ACCOUNT_STATUSES, s >> 12);
    const hasPurchased = (s >> 15) % 4 !== 0;
    const funded = hasPurchased && (s >> 18) % 3 === 0;
    out.push({
      id: `mu-${offerId}-${i + 1}`,
      email,
      country,
      accountStatus,
      hasPurchased,
      funded,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tone helpers                                                         */
/* ------------------------------------------------------------------ */

function accountStatusTone(
  status: MatchingUser["accountStatus"],
): "success" | "info" | "warning" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "invited":
      return "info";
    case "suspended":
      return "warning";
    case "breached":
      return "danger";
  }
}

function yesNoTone(yes: boolean): "success" | "muted" {
  return yes ? "success" : "muted";
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const TOTAL_MATCHES = 3633;

export function OfferMatchingUsersPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const offer = useMemo(() => getOffers().find((o) => o.id === id), [id]);

  const matches = useMemo(
    () => (offer ? generateMatchingUsers(offer.id, TOTAL_MATCHES) : []),
    [offer],
  );

  // KPI counts — derived from the deterministic mock so totals are stable.
  const fundedCount = useMemo(
    () => matches.filter((m) => m.funded).length,
    [matches],
  );
  const newUsers = useMemo(
    () => matches.filter((m) => !m.hasPurchased).length,
    [matches],
  );
  const existingUsers = TOTAL_MATCHES - newUsers;

  const [page, setPage] = useState(1);
  const pageSize = 100;

  const columns: Column<MatchingUser>[] = [
    {
      key: "email",
      header: "User Email",
      cell: (u) => <span className="font-medium text-foreground">{u.email}</span>,
      sortValue: (u) => u.email,
    },
    {
      key: "country",
      header: "Country",
      cell: (u) => <Badge variant="outline" className="text-[10px]">{u.country}</Badge>,
      sortValue: (u) => u.country,
      width: "90px",
    },
    {
      key: "accountStatus",
      header: "Account Status",
      cell: (u) => (
        <StatusBadge tone={accountStatusTone(u.accountStatus)}>{u.accountStatus}</StatusBadge>
      ),
      sortValue: (u) => u.accountStatus,
      width: "140px",
    },
    {
      key: "hasPurchased",
      header: "Has Purchased",
      cell: (u) => (
        <StatusBadge tone={yesNoTone(u.hasPurchased)}>
          {u.hasPurchased ? "Yes" : "No"}
        </StatusBadge>
      ),
      sortValue: (u) => (u.hasPurchased ? 1 : 0),
      numeric: true,
      width: "140px",
    },
    {
      key: "funded",
      header: "Funded",
      cell: (u) => (
        <StatusBadge tone={yesNoTone(u.funded)}>{u.funded ? "Yes" : "No"}</StatusBadge>
      ),
      sortValue: (u) => (u.funded ? 1 : 0),
      numeric: true,
      width: "100px",
    },
    {
      key: "actions",
      header: "",
      cell: (u) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              navigate("trader-detail", { id: u.id });
            }}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> View User
          </Button>
        </div>
      ),
      width: "140px",
    },
  ];

  if (!offer) {
    return (
      <Page>
        <PageHeader
          title="Matching Users"
          description="No offer selected."
          icon={Users}
          actions={
            <Button size="sm" variant="outline" onClick={() => navigate("offer-management")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Offers
            </Button>
          }
        />
        <PageContent>
          <EmptyState
            icon={Users}
            title="Offer not found"
            description="The offer you're looking for no longer exists or was deleted."
            hint="Return to the offers list and select an offer to inspect its matching audience."
          />
        </PageContent>
      </Page>
    );
  }

  // Page-safe slice — DataTable will further filter by search but won't
  // paginate over the full 3,633 because we already slice to a single page.
  const pageStart = (page - 1) * pageSize;
  const pageSlice = matches.slice(pageStart, pageStart + pageSize);
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));

  return (
    <Page>
      <PageHeader
        title={`Matching Users — ${offer.name}`}
        description={`Total Matching Users: ${TOTAL_MATCHES.toLocaleString()} — these traders match the targeting rules defined for this offer.`}
        icon={Users}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("offer-edit", { id })}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Offer
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Matches"
            value={TOTAL_MATCHES.toLocaleString()}
            icon={Users}
            tone="default"
          />
          <MetricCard
            label="Funded Matches"
            value={fundedCount.toLocaleString()}
            icon={UserCheck}
            tone="positive"
          />
          <MetricCard
            label="New Users"
            value={newUsers.toLocaleString()}
            icon={UserPlus}
            tone="warning"
          />
          <MetricCard
            label="Existing Users"
            value={existingUsers.toLocaleString()}
            icon={UserRound}
            tone="default"
          />
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Matching Users
              <Badge variant="outline" className="ml-2 text-[10px]">
                {TOTAL_MATCHES.toLocaleString()}
              </Badge>
            </p>
            <span className="text-xs text-muted-foreground">
              100 per page · sorted by email
            </span>
          </div>

          <DataTable
            columns={columns}
            data={pageSlice}
            rowKey={(u) => u.id}
            searchableText={(u) => u.email}
            searchPlaceholder="Search by email…"
            pageSize={pageSize}
            emptyTitle="No matching users"
            emptyDescription="No users match the current search."
          />

          {/* Pagination across all matches */}
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · showing{" "}
              {pageSlice.length.toLocaleString()} of {TOTAL_MATCHES.toLocaleString()} matches
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="font-medium text-foreground">{page} / {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  toast({
                    title: `Loaded page ${page + 1}`,
                    description: `Showing matches ${(page) * pageSize + 1}–${Math.min((page + 1) * pageSize, TOTAL_MATCHES)}.`,
                  });
                }}
              >
                Next <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
