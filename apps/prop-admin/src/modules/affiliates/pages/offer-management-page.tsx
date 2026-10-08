"use client";

/**
 * Offers & Promotions page (UX Constitution §25-27).
 *
 * Operational table of coupon offers with search, status filter,
 * and an inline detail panel (§27 — choose drawer-vs-page by task
 * complexity; offer inspection is a quick-review task → inline
 * panel beneath the table is the right fit, not a separate page).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getOffers, type Offer } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import {
  Tag,
  Plus,
  Pencil,
  Eye,
  History,
  Filter,
  Globe,
  Users,
  Calendar,
  Ticket,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function offerStatusTone(status: Offer["status"]): "success" | "danger" | "info" {
  if (status === "active") return "success";
  if (status === "expired") return "danger";
  return "info";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Inline detail panel                                                 */
/* ------------------------------------------------------------------ */

function OfferDetailPanel({ offer, onEdit, onChangeHistory }: { offer: Offer; onEdit: (o: Offer) => void; onChangeHistory: (o: Offer) => void }) {
  return (
    <div className="border-t bg-muted/20 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left column — offer basics */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Offer
            </p>
            <p className="text-sm font-semibold text-foreground">{offer.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{offer.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DetailRow icon={Ticket} label="Coupon" value={offer.couponCode} mono />
            <DetailRow icon={Tag} label="Discount" value={`${offer.discountPct}%`} />
            <DetailRow icon={Calendar} label="Start" value={formatDate(offer.startDate)} />
            <DetailRow icon={Calendar} label="End" value={formatDate(offer.endDate)} />
            <DetailRow icon={Users} label="Matching users" value={String(offer.matchingUsers)} />
            <DetailRow
              icon={Tag}
              label="Status"
              value={<StatusBadge tone={offerStatusTone(offer.status)}>{offer.status}</StatusBadge>}
            />
          </div>
        </div>

        {/* Right column — targeting */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Globe className="h-3 w-3" /> Target Countries
            </p>
            {offer.targetCountries.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">All countries (no geographic restriction)</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {offer.targetCountries.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="h-3 w-3" /> Target Segments
            </p>
            {offer.targetSegments.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">No segments specified</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {offer.targetSegments.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{offer.matchingUsers.toLocaleString()}</span>{" "}
            user{offer.matchingUsers === 1 ? "" : "s"} currently match this offer's targeting rules.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChangeHistory(offer)}
        >
          <History className="mr-1 h-3.5 w-3.5" /> View Change History
        </Button>
        <Button
          size="sm"
          onClick={() => onEdit(offer)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Offer
        </Button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function OfferManagementPage() {
  const { navigate } = usePlatform();
  const offers = getOffers();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Wire the orphan buttons to real navigation targets — fixes the prior
  // bug where Edit / View Change History fired toast-only and left the
  // OfferEditPage / OfferChangeHistoryPage orphaned from the table.
  const handleEdit = (o: Offer) => navigate("offer-edit", { id: o.id });
  const handleViewChangeHistory = (o: Offer) =>
    navigate("offer-change-history", { id: o.id });

  const filtered = useMemo(
    () => (statusFilter === "all" ? offers : offers.filter((o) => o.status === statusFilter)),
    [offers, statusFilter],
  );

  const columns: Column<Offer>[] = [
    {
      key: "name",
      header: "Name",
      cell: (o) => <span className="font-medium text-foreground">{o.name}</span>,
      sortValue: (o) => o.name,
    },
    {
      key: "couponCode",
      header: "Coupon",
      cell: (o) => <span className="font-mono text-xs">{o.couponCode}</span>,
      sortValue: (o) => o.couponCode,
    },
    {
      key: "discountPct",
      header: "Discount",
      cell: (o) => `${o.discountPct}%`,
      sortValue: (o) => o.discountPct,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (o) => <StatusBadge tone={offerStatusTone(o.status)}>{o.status}</StatusBadge>,
      sortValue: (o) => o.status,
    },
    {
      key: "startDate",
      header: "Start",
      cell: (o) => <span className="text-xs">{formatDate(o.startDate)}</span>,
      sortValue: (o) => o.startDate,
    },
    {
      key: "endDate",
      header: "End",
      cell: (o) => <span className="text-xs">{formatDate(o.endDate)}</span>,
      sortValue: (o) => o.endDate,
    },
    {
      key: "countries",
      header: "Countries",
      cell: (o) =>
        o.targetCountries.length === 0 ? (
          <span className="text-xs text-muted-foreground">All</span>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            <Globe className="mr-1 h-3 w-3" />
            {o.targetCountries.length}
          </Badge>
        ),
      sortValue: (o) => o.targetCountries.length,
      numeric: true,
    },
    {
      key: "matchingUsers",
      header: "Matches",
      cell: (o) => <span className="tabular-nums">{o.matchingUsers.toLocaleString()}</span>,
      sortValue: (o) => o.matchingUsers,
      numeric: true,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (o) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId((id) => (id === o.id ? null : o.id));
            }}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(o);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Offers & Promotions"
        description="Manage discount coupons, scheduled promotions, and trader targeting rules."
        icon={Tag}
        actions={
          <Button
            size="sm"
            onClick={() => toast({ title: "Add offer", description: "The new offer form would open here. (demo)" })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Offer
          </Button>
        }
      />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            All Offers
            <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(o) => o.id}
            searchableText={(o) => `${o.name} ${o.couponCode} ${o.description} ${o.targetCountries.join(" ")}`}
            searchPlaceholder="Search by name or coupon…"
            pageSize={10}
            onRowClick={(o) => setExpandedId((id) => (id === o.id ? null : o.id))}
            toolbar={
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger size="sm" className="h-8 w-40 text-xs">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
            emptyTitle="No offers"
            emptyDescription="No offers match the current filter or search."
          />

          {/* Inline expansion below the table for the selected offer */}
          {expandedId ? (
            <div className="mt-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                <ChevronDown className="h-4 w-4" />
                Offer detail
              </div>
              {(() => {
                const o = filtered.find((x) => x.id === expandedId);
                if (!o) return null;
                return (
                  <OfferDetailPanel
                    offer={o}
                    onEdit={handleEdit}
                    onChangeHistory={handleViewChangeHistory}
                  />
                );
              })()}
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              Click any row to inspect full targeting and audience details.
            </p>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
