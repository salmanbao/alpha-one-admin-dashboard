"use client";

/**
 * Offer Change History page (UX Constitution §28 — Per-object audit trail).
 *
 * Shows every change made to a specific offer — who changed it, when, what
 * changed, and the before/after values. Reached from the Offer Edit page's
 * "View Change History" navigation link.
 *
 * Layout:
 *  - PageHeader with offer name + back action
 *  - Toolbar: search by user / field, filter by action type, export CSV
 *  - DataTable: Date/Time (sortable), User (email + role badge),
 *    Action (e.g. Added, Changed Image, Modified Targeting),
 *    Description (brief explanation), Old → New values
 *
 * Mock data is generated deterministically from the offer id — every offer
 * has its own consistent change history timeline for the demo.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getOffers } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  History,
  ChevronLeft,
  Filter,
  Download,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ActionType =
  | "added"
  | "image_changed"
  | "targeting_modified"
  | "discount_updated"
  | "activated"
  | "deactivated";

interface ChangeEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: "Admin" | "Marketer" | "System" | "Super Admin";
  action: ActionType;
  field: string;
  oldValue: string;
  newValue: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Action labels & tones                                              */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<ActionType, string> = {
  added: "Added",
  image_changed: "Changed Image",
  targeting_modified: "Modified Targeting",
  discount_updated: "Updated Discount",
  activated: "Activated",
  deactivated: "Deactivated",
};

/* ------------------------------------------------------------------ */
/* Deterministic generator                                             */
/* ------------------------------------------------------------------ */

const ACTORS: Array<{ email: string; role: ChangeEntry["actorRole"] }> = [
  { email: "sarah.chen@yourfirm.com", role: "Admin" },
  { email: "marcus.webb@yourfirm.com", role: "Marketer" },
  { email: "priya.nair@yourfirm.com", role: "Admin" },
  { email: "system@yourfirm.com", role: "System" },
  { email: "admin@yourfirm.com", role: "Super Admin" },
];

const TEMPLATES: Array<{
  action: ActionType;
  field: string;
  old: string;
  new: string;
  description: string;
}> = [
  { action: "added", field: "offer", old: "—", new: "EXPO2026 BUNDLE DEAL", description: "Offer created with coupon EXPO2026 and 40% discount." },
  { action: "image_changed", field: "imageUrl", old: "(none)", new: "expo2026-banner.png", description: "Uploaded offer banner image (1.2MB)." },
  { action: "targeting_modified", field: "targetCountries", old: "US, GB", new: "US, GB, AE, SG", description: "Added AE and SG to country targeting." },
  { action: "targeting_modified", field: "targetSegments", old: "all", new: "new_users, no_purchase", description: "Narrowed segment to new and non-purchasing users." },
  { action: "discount_updated", field: "discountPct", old: "20%", new: "40%", description: "Increased discount from 20% to 40% for EXPO launch." },
  { action: "discount_updated", field: "discountPct", old: "10%", new: "20%", description: "Adjusted initial discount to 20%." },
  { action: "activated", field: "status", old: "scheduled", new: "active", description: "Offer activated — visible to eligible traders." },
  { action: "deactivated", field: "status", old: "active", new: "scheduled", description: "Offer paused — moved back to scheduled state." },
  { action: "targeting_modified", field: "endDate", old: "2026-09-15", new: "2026-09-30", description: "Extended offer end date by 15 days." },
];

/** ISO timestamp helper — N hours ago. */
function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function generateHistory(offerId: string): ChangeEntry[] {
  let seed = 13;
  for (let i = 0; i < offerId.length; i++) {
    seed = (seed * 17 + offerId.charCodeAt(i)) >>> 0;
  }
  const count = 8 + (seed % 8); // 8–15 entries
  const out: ChangeEntry[] = [];
  for (let i = 0; i < count; i++) {
    const s = (seed + i * 2654435761) >>> 0;
    const tpl = TEMPLATES[i % TEMPLATES.length];
    const actor = ACTORS[(s >> 3) % ACTORS.length];
    out.push({
      id: `ch-${offerId}-${i + 1}`,
      timestamp: hoursAgoIso(i * 18 + (s % 12)),
      actorEmail: actor.email,
      actorRole: actor.role,
      action: tpl.action,
      field: tpl.field,
      oldValue: tpl.old,
      newValue: tpl.new,
      description: tpl.description,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function OfferChangeHistoryPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const offer = useMemo(() => getOffers().find((o) => o.id === id), [id]);
  const entries = useMemo(() => (offer ? generateHistory(offer.id) : []), [offer]);

  const [actionFilter, setActionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (actionFilter === "all") return entries;
    return entries.filter((e) => e.action === actionFilter);
  }, [entries, actionFilter]);

  const columns: Column<ChangeEntry>[] = [
    {
      key: "timestamp",
      header: "Date / Time",
      cell: (e) => (
        <span className="text-xs text-foreground">
          {new Date(e.timestamp).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
      sortValue: (e) => e.timestamp,
      width: "180px",
    },
    {
      key: "actor",
      header: "User",
      cell: (e) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-foreground">{e.actorEmail}</span>
          <Badge variant="outline" className={`w-fit text-[10px] ${roleBadgeClass(e.actorRole)}`}>
            {e.actorRole}
          </Badge>
        </div>
      ),
      sortValue: (e) => e.actorEmail,
      width: "220px",
    },
    {
      key: "action",
      header: "Action",
      cell: (e) => (
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${actionBadgeClass(e.action)}`}>
          {ACTION_LABELS[e.action]}
        </span>
      ),
      sortValue: (e) => e.action,
      width: "160px",
    },
    {
      key: "description",
      header: "Description",
      cell: (e) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-foreground">{e.description}</span>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{e.field}:</span>
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {e.oldValue}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {e.newValue}
            </span>
          </div>
        </div>
      ),
    },
  ];

  if (!offer) {
    return (
      <Page>
        <PageHeader
          title="Change History"
          description="No offer selected."
          icon={History}
          actions={
            <Button size="sm" variant="outline" onClick={() => navigate("offer-management")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Offers
            </Button>
          }
        />
        <PageContent>
          <EmptyState
            icon={History}
            title="Offer not found"
            description="The offer you're looking for no longer exists or was deleted."
            hint="Return to the offers list and select an offer to inspect its history."
          />
        </PageContent>
      </Page>
    );
  }

  const onExportCsv = () => {
    const header = "Date/Time,User,Role,Action,Field,Old Value,New Value,Description\n";
    const rows = filtered
      .map((e) =>
        [
          new Date(e.timestamp).toISOString(),
          e.actorEmail,
          e.actorRole,
          ACTION_LABELS[e.action],
          e.field,
          e.oldValue,
          e.newValue,
          e.description,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    try {
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `offer-${offer.id}-history.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "CSV exported",
        description: `Exported ${filtered.length} change entries.`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Couldn't generate the CSV file in this browser.",
      });
    }
  };

  return (
    <Page>
      <PageHeader
        title={`Change History — ${offer.name}`}
        description="A complete audit trail of every change made to this offer, including who changed it, when, and what the previous value was."
        icon={History}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onExportCsv}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("offer-edit", { id })}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Offer
            </Button>
          </div>
        }
      />

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Change Entries
              <Badge variant="outline" className="ml-2 text-[10px]">
                {filtered.length}
              </Badge>
            </p>
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {entries.length} total
            </span>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(e) => e.id}
            searchableText={(e) => `${e.actorEmail} ${e.field} ${e.description} ${ACTION_LABELS[e.action]}`}
            searchPlaceholder="Search by user, field, or description…"
            pageSize={12}
            toolbar={
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger size="sm" className="h-8 w-44 text-xs">
                    <SelectValue placeholder="All action types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All action types</SelectItem>
                    <SelectItem value="added">Added</SelectItem>
                    <SelectItem value="image_changed">Changed Image</SelectItem>
                    <SelectItem value="targeting_modified">Modified Targeting</SelectItem>
                    <SelectItem value="discount_updated">Updated Discount</SelectItem>
                    <SelectItem value="activated">Activated</SelectItem>
                    <SelectItem value="deactivated">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
            emptyTitle="No changes found"
            emptyDescription="No changes match the current filter or search."
          />
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Badge class helpers (Terra palette, no blue/indigo)                */
/* ------------------------------------------------------------------ */

function actionBadgeClass(a: ActionType): string {
  switch (a) {
    case "added":
    case "activated":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "deactivated":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "image_changed":
    case "targeting_modified":
    case "discount_updated":
    default:
      return "bg-muted text-foreground";
  }
}

function roleBadgeClass(r: ChangeEntry["actorRole"]): string {
  switch (r) {
    case "Super Admin":
      return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
    case "Admin":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
    case "Marketer":
    case "System":
    default:
      return "border-border text-muted-foreground";
  }
}
