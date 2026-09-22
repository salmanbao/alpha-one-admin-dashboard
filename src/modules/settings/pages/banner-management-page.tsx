"use client";

/**
 * Banner Management Page — manage marketing & announcement banners.
 *
 * Spec sections 12, 25, 27. Tabs split banners by type; each tab shows a
 * DataTable. Row click opens an inline editor (title, content, status,
 * start/end dates, position, save).
 *
 * No blue/indigo accents — neutral, emerald, amber, rose tones only.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getBanners, type Banner } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Pencil,
  Save,
  X,
  ToggleLeft,
  Calendar,
  Layout,
} from "lucide-react";

const POSITION_OPTIONS = ["top", "sidebar", "modal"] as const;

/** Truncate long text for table cells. */
function truncate(text: string, max = 56): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Position badge tone. */
function positionTone(
  position: Banner["position"],
): "info" | "warning" | "muted" {
  switch (position) {
    case "top":
      return "info";
    case "modal":
      return "warning";
    case "sidebar":
    default:
      return "muted";
  }
}

export function BannerManagementPage() {
  const { runtime } = usePlatform();
  void runtime;
  const [tab, setTab] = useState<"announcement" | "marketing">(
    "announcement",
  );
  const [selected, setSelected] = useState<{ type: "announcement" | "marketing"; id: string } | null>(
    null,
  );
  // Working copies per id (cross-tab safe).
  const [working, setWorking] = useState<Record<string, Banner>>({});

  const banners = getBanners(tab);
  const activeBanner = selected
    ? working[selected.id] ??
      getBanners().find((b) => b.id === selected.id) ??
      null
    : null;

  const onRowClick = (b: Banner) => {
    setSelected({ type: b.type, id: b.id });
    setWorking((w) => ({
      ...w,
      [b.id]: w[b.id] ?? { ...b },
    }));
  };

  const updateField = (id: string, patch: Partial<Banner>) => {
    setWorking((w) => ({
      ...w,
      [id]: {
        ...(w[id] ?? getBanners().find((b) => b.id === id)!),
        ...patch,
      },
    }));
  };

  const onAdd = () =>
    toast({
      title: "Add banner",
      description: `Banner composer would open for ${tab} type (demo).`,
    });

  const onToggle = (b: Banner) => {
    const next: Banner["status"] =
      b.status === "active" ? "inactive" : "active";
    updateField(b.id, { status: next });
    toast({
      title: next === "active" ? "Banner activated" : "Banner deactivated",
      description: `“${b.title}” is now ${next}.`,
    });
  };

  const onSave = (b: Banner) => {
    toast({
      title: "Banner saved",
      description: `“${b.title}” updated successfully.`,
    });
  };

  const columns: Column<Banner>[] = [
    {
      key: "title",
      header: "Title",
      cell: (b) => (
        <span className="font-medium text-foreground">{b.title}</span>
      ),
      sortValue: (b) => b.title,
    },
    {
      key: "content",
      header: "Content",
      cell: (b) => (
        <span className="text-xs text-muted-foreground" title={b.content}>
          {truncate(b.content)}
        </span>
      ),
      sortValue: (b) => b.content,
    },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <StatusBadge tone={b.status === "active" ? "success" : "muted"}>
          {b.status}
        </StatusBadge>
      ),
      sortValue: (b) => b.status,
    },
    {
      key: "startDate",
      header: "Start",
      cell: (b) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(b.startDate).toLocaleDateString()}
        </span>
      ),
      sortValue: (b) => b.startDate,
    },
    {
      key: "endDate",
      header: "End",
      cell: (b) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(b.endDate).toLocaleDateString()}
        </span>
      ),
      sortValue: (b) => b.endDate,
    },
    {
      key: "position",
      header: "Position",
      cell: (b) => (
        <StatusBadge tone={positionTone(b.position)}>{b.position}</StatusBadge>
      ),
      sortValue: (b) => b.position,
    },
    {
      key: "actions",
      header: "",
      cell: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(b);
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
              onToggle(b);
            }}
            aria-label={`Toggle status for ${b.title}`}
          >
            <ToggleLeft className="h-3.5 w-3.5" />
            <span className="sr-only">Toggle</span>
          </Button>
        </div>
      ),
      width: "100px",
    },
  ];

  // Filter the active banner by the current tab; if selected across tabs,
  // the editor persists in working state but the table shows only the
  // current tab.
  const visibleActiveBanner =
    activeBanner && activeBanner.type === tab ? activeBanner : null;

  return (
    <Page>
      <PageHeader
        title="Banner Management"
        description="Promotional and announcement banners shown across the trader experience."
        icon={Megaphone}
        actions={
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add Banner
          </Button>
        }
      />
      <PageContent>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "announcement" | "marketing")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="announcement">Announcement</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
          </TabsList>

          <TabsContent value="announcement">
            <BannerTabContent
              banners={getBanners("announcement")}
              columns={columns}
              onRowClick={onRowClick}
              activeBanner={visibleActiveBanner}
              onChange={updateField}
              onSave={onSave}
              onClose={() => setSelected(null)}
            />
          </TabsContent>

          <TabsContent value="marketing">
            <BannerTabContent
              banners={getBanners("marketing")}
              columns={columns}
              onRowClick={onRowClick}
              activeBanner={visibleActiveBanner}
              onChange={updateField}
              onSave={onSave}
              onClose={() => setSelected(null)}
            />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}

function BannerTabContent({
  banners,
  columns,
  onRowClick,
  activeBanner,
  onChange,
  onSave,
  onClose,
}: {
  banners: Banner[];
  columns: Column<Banner>[];
  onRowClick: (b: Banner) => void;
  activeBanner: Banner | null;
  onChange: (id: string, patch: Partial<Banner>) => void;
  onSave: (b: Banner) => void;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      {/* Master: table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">
            Banners{" "}
            <span className="ml-1 text-xs text-muted-foreground">
              ({banners.length})
            </span>
          </p>
        </div>
        <DataTable
          columns={columns}
          data={banners}
          rowKey={(b) => b.id}
          onRowClick={onRowClick}
          searchableText={(b) => `${b.title} ${b.content} ${b.position}`}
          searchPlaceholder="Search banners…"
          emptyTitle="No banners in this category"
          emptyDescription="Create one to broadcast announcements or promotions."
          pageSize={8}
        />
      </div>

      {/* Detail: editor */}
      <div className="rounded-lg border bg-card p-4">
        {activeBanner ? (
          <BannerEditor
            banner={activeBanner}
            onChange={(patch) => onChange(activeBanner.id, patch)}
            onSave={() => onSave(activeBanner)}
            onClose={onClose}
          />
        ) : (
          <EmptyState
            icon={Megaphone}
            title="No banner selected"
            description="Select a banner to edit its content, schedule, and placement."
            hint="Tip: position determines where the banner appears — top bar, sidebar, or modal."
          />
        )}
      </div>
    </div>
  );
}

function BannerEditor({
  banner,
  onChange,
  onSave,
  onClose,
}: {
  banner: Banner;
  onChange: (patch: Partial<Banner>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isActive = banner.status === "active";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{banner.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Type:{" "}
            <span className="font-mono">{banner.type}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={isActive ? "success" : "muted"}>
          {banner.status}
        </StatusBadge>
        <StatusBadge tone={positionTone(banner.position)}>
          {banner.position}
        </StatusBadge>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="ban-title">Title</Label>
        <Input
          id="ban-title"
          value={banner.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ban-content">Content</Label>
        <Textarea
          id="ban-content"
          rows={4}
          value={banner.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="ban-status"
            className="cursor-pointer text-sm font-medium"
          >
            Active
          </Label>
          <span className="text-xs text-muted-foreground">
            Display this banner to traders.
          </span>
        </div>
        <Switch
          id="ban-status"
          checked={isActive}
          onCheckedChange={(checked) =>
            onChange({ status: checked ? "active" : "inactive" })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ban-start">Start Date</Label>
          <Input
            id="ban-start"
            type="date"
            value={banner.startDate.slice(0, 10)}
            onChange={(e) =>
              onChange({ startDate: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ban-end">End Date</Label>
          <Input
            id="ban-end"
            type="date"
            value={banner.endDate.slice(0, 10)}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Position</Label>
        <Select
          value={banner.position}
          onValueChange={(v) =>
            onChange({ position: v as Banner["position"] })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select position…" />
          </SelectTrigger>
          <SelectContent>
            {POSITION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="capitalize">
                <span className="inline-flex items-center gap-1">
                  <Layout className="h-3 w-3" />
                  {opt}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          Save Banner
        </Button>
      </div>
    </div>
  );
}
