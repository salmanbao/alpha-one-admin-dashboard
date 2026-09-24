"use client";

/**
 * Utilities page (UX Constitution §25-27).
 *
 * Management of utility links / cards surfaced in the trader dashboard
 * (helpful resources, external links, FAQ shortcuts). Reached from the
 * Settings sidebar.
 *
 * Layout:
 *  - PageHeader with "Add Utility" primary action
 *  - KPI row: Total Utilities, Active, Inactive
 *  - DataTable: Title, Description (truncated), Section (badge),
 *    Link URL (truncated, clickable), Is Active (inline Switch),
 *    Display Order (numeric), Actions (Edit/Delete)
 *  - Search + filter by section
 *  - Inline create/edit form rendered in a Dialog (no separate page needed)
 *  - Empty state when no utilities exist
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Filter,
  ExternalLink,
  Link2,
  HelpCircle,
  FileText,
  Image as ImageIcon,
  Save,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type UtilitySection = "Utility" | "Help" | "Resource" | "External";

interface UtilityLink {
  id: string;
  title: string;
  description: string;
  section: UtilitySection;
  linkUrl: string;
  iconUrl: string;
  isActive: boolean;
  displayOrder: number;
}

const UTILITIES: UtilityLink[] = [
  {
    id: "util-1",
    title: "Trader Rulebook",
    description: "Official trading rules and risk policy document.",
    section: "Resource",
    linkUrl: "https://help.yourfirm.com/rulebook.pdf",
    iconUrl: "",
    isActive: true,
    displayOrder: 1,
  },
  {
    id: "util-2",
    title: "FAQ — Withdrawals & Payouts",
    description: "Common questions about payout methods, processing times, and limits.",
    section: "Help",
    linkUrl: "https://help.yourfirm.com/payouts-faq",
    iconUrl: "",
    isActive: true,
    displayOrder: 2,
  },
  {
    id: "util-3",
    title: "Trading Platform Guide",
    description: "Step-by-step setup for MetaTrader 5 and the web terminal.",
    section: "Help",
    linkUrl: "https://help.yourfirm.com/mt5-setup",
    iconUrl: "",
    isActive: true,
    displayOrder: 3,
  },
  {
    id: "util-4",
    title: "Risk Calculator",
    description: "External risk and position size calculator by MyFxBook.",
    section: "External",
    linkUrl: "https://www.myfxbook.com/forex-calculators/position-size",
    iconUrl: "",
    isActive: true,
    displayOrder: 4,
  },
  {
    id: "util-5",
    title: "Economic Calendar",
    description: "Live economic news calendar with high-impact event filters.",
    section: "External",
    linkUrl: "https://www.forexfactory.com/calendar",
    iconUrl: "",
    isActive: false,
    displayOrder: 5,
  },
  {
    id: "util-6",
    title: "Support Ticket",
    description: "Open a support ticket with the trader success team.",
    section: "Utility",
    linkUrl: "https://yourfirm.com/support/new",
    iconUrl: "",
    isActive: true,
    displayOrder: 6,
  },
  {
    id: "util-7",
    title: "Affiliate Program",
    description: "Refer traders and earn commission on their challenge purchases.",
    section: "Resource",
    linkUrl: "https://yourfirm.com/affiliates",
    iconUrl: "",
    isActive: true,
    displayOrder: 7,
  },
];

const SECTION_OPTIONS: UtilitySection[] = ["Utility", "Help", "Resource", "External"];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sectionBadgeClass(s: UtilitySection): string {
  switch (s) {
    case "Utility":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
    case "Help":
      return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
    case "Resource":
      return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
    case "External":
    default:
      return "border-border text-muted-foreground";
  }
}

function sectionIcon(s: UtilitySection) {
  switch (s) {
    case "Help":
      return HelpCircle;
    case "Resource":
      return FileText;
    case "External":
      return ExternalLink;
    case "Utility":
    default:
      return Wrench;
  }
}

function truncate(text: string, max = 56): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* ------------------------------------------------------------------ */
/* Inline create/edit form                                             */
/* ------------------------------------------------------------------ */

interface UtilityFormValues {
  id: string; // empty for new
  title: string;
  description: string;
  section: UtilitySection;
  linkUrl: string;
  iconUrl: string;
  isActive: boolean;
  displayOrder: string;
}

const EMPTY_FORM: UtilityFormValues = {
  id: "",
  title: "",
  description: "",
  section: "Utility",
  linkUrl: "",
  iconUrl: "",
  isActive: true,
  displayOrder: "0",
};

function UtilityFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onSaveAndAdd,
  onCancel,
  isNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: UtilityFormValues;
  onSave: (values: UtilityFormValues) => void;
  onSaveAndAdd: (values: UtilityFormValues) => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [values, setValues] = useState<UtilityFormValues>(initial);

  // Reset local state when the dialog re-opens or the seed changes.
  // Using `key` on a wrapper would also work, but syncing here keeps the
  // component self-contained.
  const setField = <K extends keyof UtilityFormValues>(
    key: K,
    v: UtilityFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Reset the form on close so re-opening shows fresh values.
          setValues(initial);
          onOpenChange(false);
        } else {
          setValues(initial);
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Utility" : "Edit Utility"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Add a new utility link to the trader dashboard."
              : "Update the utility link details below."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="util-title">Title</Label>
            <Input
              id="util-title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Trader Rulebook"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="util-desc">Description</Label>
            <Textarea
              id="util-desc"
              rows={3}
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short description shown under the title."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="util-icon">Icon Upload</Label>
            <Input
              id="util-icon"
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setField("iconUrl", URL.createObjectURL(file));
                }
              }}
              className="text-xs"
            />
            {values.iconUrl ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted/30">
                  <img
                    src={values.iconUrl}
                    alt="Icon preview"
                    className="h-full w-full rounded object-contain"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setField("iconUrl", "")}
                >
                  <X className="mr-1 h-3 w-3" /> Remove
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="util-section">Section</Label>
              <Select
                value={values.section}
                onValueChange={(v) => setField("section", v as UtilitySection)}
              >
                <SelectTrigger id="util-section" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="util-order">Display Order</Label>
              <Input
                id="util-order"
                type="number"
                min={0}
                value={values.displayOrder}
                onChange={(e) => setField("displayOrder", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="util-url">Link URL</Label>
            <Input
              id="util-url"
              value={values.linkUrl}
              onChange={(e) => setField("linkUrl", e.target.value)}
              placeholder="https://…"
              className="font-mono"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="util-active" className="cursor-pointer text-sm font-medium">
                Is Active
              </Label>
              <span className="text-xs text-muted-foreground">
                Inactive utilities are hidden from traders.
              </span>
            </div>
            <Switch
              id="util-active"
              checked={values.isActive}
              onCheckedChange={(v) => setField("isActive", v)}
            />
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {isNew ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSaveAndAdd(values)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
              </Button>
            ) : null}
            <Button size="sm" onClick={() => onSave(values)}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function UtilitiesPage() {
  const [items, setItems] = useState<UtilityLink[]>(UTILITIES);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UtilityFormValues>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<UtilityLink | null>(null);

  const filtered = useMemo(() => {
    if (sectionFilter === "all") return items;
    return items.filter((u) => u.section === sectionFilter);
  }, [items, sectionFilter]);

  const kpis = useMemo(() => {
    const active = items.filter((u) => u.isActive).length;
    return { total: items.length, active, inactive: items.length - active };
  }, [items]);

  const onToggleActive = (u: UtilityLink) => {
    setItems((list) =>
      list.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)),
    );
    toast({
      title: u.isActive ? "Utility deactivated" : "Utility activated",
      description: `“${u.title}” is now ${u.isActive ? "inactive" : "active"}.`,
    });
  };

  const onOpenAdd = () => {
    setEditing(EMPTY_FORM);
    setDialogOpen(true);
  };

  const onOpenEdit = (u: UtilityLink) => {
    setEditing({
      id: u.id,
      title: u.title,
      description: u.description,
      section: u.section,
      linkUrl: u.linkUrl,
      iconUrl: u.iconUrl,
      isActive: u.isActive,
      displayOrder: String(u.displayOrder),
    });
    setDialogOpen(true);
  };

  const onSave = (values: UtilityFormValues) => {
    if (values.id) {
      setItems((list) =>
        list.map((u) =>
          u.id === values.id
            ? {
                ...u,
                title: values.title,
                description: values.description,
                section: values.section,
                linkUrl: values.linkUrl,
                iconUrl: values.iconUrl,
                isActive: values.isActive,
                displayOrder: Number(values.displayOrder) || 0,
              }
            : u,
        ),
      );
      toast({
        title: "Utility updated",
        description: `“${values.title}” was saved successfully.`,
      });
    } else {
      const newId = `util-${Date.now()}`;
      setItems((list) => [
        ...list,
        {
          id: newId,
          title: values.title,
          description: values.description,
          section: values.section,
          linkUrl: values.linkUrl,
          iconUrl: values.iconUrl,
          isActive: values.isActive,
          displayOrder: Number(values.displayOrder) || 0,
        },
      ]);
      toast({
        title: "Utility added",
        description: `“${values.title}” was added to the dashboard.`,
      });
    }
    setDialogOpen(false);
  };

  const onSaveAndAdd = (values: UtilityFormValues) => {
    // Save first, then reset the dialog for the next entry.
    onSave(values);
    setEditing(EMPTY_FORM);
    setDialogOpen(true);
    toast({
      title: "Utility saved",
      description: "Form cleared. Add another utility.",
    });
  };

  const onDelete = (u: UtilityLink) => {
    setItems((list) => list.filter((x) => x.id !== u.id));
    setDeleteTarget(null);
    toast({
      title: "Utility deleted",
      description: `“${u.title}” was permanently removed.`,
    });
  };

  const columns: Column<UtilityLink>[] = [
    {
      key: "title",
      header: "Title",
      cell: (u) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{u.title}</span>
          <span className="text-xs text-muted-foreground">
            {truncate(u.description)}
          </span>
        </div>
      ),
      sortValue: (u) => u.title,
    },
    {
      key: "section",
      header: "Section",
      cell: (u) => {
        const Icon = sectionIcon(u.section);
        return (
          <Badge variant="outline" className={cn("text-[10px]", sectionBadgeClass(u.section))}>
            <Icon className="mr-1 h-3 w-3" />
            {u.section}
          </Badge>
        );
      },
      sortValue: (u) => u.section,
      width: "140px",
    },
    {
      key: "linkUrl",
      header: "Link URL",
      cell: (u) => (
        <a
          href={u.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[220px] items-center gap-1 font-mono text-xs text-emerald-700 hover:underline dark:text-emerald-400"
          title={u.linkUrl}
        >
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{truncate(u.linkUrl, 40)}</span>
        </a>
      ),
      sortValue: (u) => u.linkUrl,
      width: "240px",
    },
    {
      key: "isActive",
      header: "Active",
      cell: (u) => (
        <div className="flex items-center justify-center">
          <Switch
            checked={u.isActive}
            onCheckedChange={(checked) => {
              if (checked === u.isActive) return;
              onToggleActive(u);
            }}
            aria-label={`Toggle active state for ${u.title}`}
          />
        </div>
      ),
      width: "90px",
    },
    {
      key: "displayOrder",
      header: "Order",
      cell: (u) => (
        <span className="tabular-nums text-foreground">{u.displayOrder}</span>
      ),
      sortValue: (u) => u.displayOrder,
      numeric: true,
      width: "80px",
    },
    {
      key: "actions",
      header: "",
      cell: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(u);
            }}
            aria-label={`Edit ${u.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(u);
            }}
            aria-label={`Delete ${u.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: "110px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Utilities"
        description="Manage utility links and helpful resources shown in the trader dashboard."
        icon={Wrench}
        actions={
          <Button size="sm" onClick={onOpenAdd}>
            <Plus className="h-4 w-4" />
            Add Utility
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Total Utilities"
            value={kpis.total}
            icon={Wrench}
            tone="default"
          />
          <MetricCard
            label="Active"
            value={kpis.active}
            icon={ImageIcon}
            tone="positive"
          />
          <MetricCard
            label="Inactive"
            value={kpis.inactive}
            icon={X}
            tone="default"
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              All Utilities
              <Badge variant="outline" className="ml-2 text-[10px]">
                {filtered.length}
              </Badge>
            </p>
            <span className="text-xs text-muted-foreground">
              Click edit to manage a utility
            </span>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No utilities yet"
              description="Add utility links to show helpful resources in the trader dashboard."
              hint="Tip: keep titles short — the dashboard renders utilities in a compact grid."
              action={
                <Button size="sm" onClick={onOpenAdd}>
                  <Plus className="mr-1 h-4 w-4" /> Add Utility
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(u) => u.id}
              searchableText={(u) => `${u.title} ${u.description} ${u.linkUrl} ${u.section}`}
              searchPlaceholder="Search utilities…"
              pageSize={8}
              onRowClick={(u) => onOpenEdit(u)}
              toolbar={
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger size="sm" className="h-8 w-40 text-xs">
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {SECTION_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              }
              emptyTitle="No utilities match"
              emptyDescription="Try a different search or section filter."
            />
          )}
        </div>
      </PageContent>

      {/* Inline create/edit dialog */}
      <UtilityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
        onCancel={() => setDialogOpen(false)}
        isNew={!editing.id}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this utility?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-medium text-foreground">“{deleteTarget?.title ?? ""}”</span> from
              the trader dashboard. Traders will no longer see the link. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleteTarget && onDelete(deleteTarget)}
            >
              Delete utility
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
