"use client";

/**
 * Marketing Banner Edit / Create page (UX Constitution §12, §25-27).
 *
 * Enhanced banner create/edit form:
 *  - Image File Upload (accept image/*) with preview thumbnail
 *  - Title (input)
 *  - Display Settings: Is Active (Switch), Sort Order (number), Position
 *    (Top Bar / Sidebar / Modal / Floating)
 *  - Destination: Link Type (External URL / Internal Page / None), External
 *    URL (when type = External URL), Internal Page (when type = Internal Page)
 *  - Scheduling (collapsible, starts collapsed): Start Date, End Date,
 *    "Runs indefinitely" checkbox (disables end date when checked)
 *  - Targeting (collapsible): Target Audience (All Users / Logged In /
 *    Funded Traders / New Users), Countries checkbox list
 *  - Action buttons: Save / Save and add another / Save and continue editing /
 *    Delete (AlertDialog)
 *  - Live preview area (simple colored bar with title text)
 *
 * Pre-fills from an existing banner when router.params.id resolves to one;
 * otherwise renders an empty "new banner" form. All state is local
 * useState — no mutations to mock data.
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getBanners, type Banner } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Megaphone,
  Save,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Link2,
  Layout,
  Globe,
  Target,
  Calendar,
  Settings2,
  Eye,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static option pools                                                  */
/* ------------------------------------------------------------------ */

const POSITION_OPTIONS = [
  { value: "top", label: "Top Bar", icon: Layout },
  { value: "sidebar", label: "Sidebar", icon: Layout },
  { value: "modal", label: "Modal", icon: Layout },
  { value: "floating", label: "Floating", icon: Layout },
] as const;

const LINK_TYPES = ["external", "internal", "none"] as const;

const INTERNAL_PAGES = [
  "Dashboard",
  "Challenges",
  "Payouts",
  "Account",
  "Pricing",
  "Leaderboard",
  "KYC",
  "Support",
] as const;

const AUDIENCES = [
  "All Users",
  "Logged In",
  "Funded Traders",
  "New Users",
] as const;

const COUNTRIES = [
  "US",
  "GB",
  "AE",
  "SG",
  "DE",
  "FR",
  "BR",
  "IN",
  "ZA",
  "CA",
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function positionTone(
  position: string,
): "info" | "warning" | "success" | "muted" {
  switch (position) {
    case "top":
      return "info";
    case "modal":
      return "warning";
    case "sidebar":
      return "muted";
    case "floating":
      return "success";
    default:
      return "muted";
  }
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function MarketingBannerEditPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const existing = useMemo(
    () => (id ? getBanners().find((b) => b.id === id) : undefined),
    [id],
  );
  const isNew = !existing;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(existing?.status === "active");
  const [sortOrder, setSortOrder] = useState("0");
  const [position, setPosition] = useState<string>(
    existing?.position ?? "top",
  );
  const [linkType, setLinkType] = useState<(typeof LINK_TYPES)[number]>(
    "none",
  );
  const [externalUrl, setExternalUrl] = useState("");
  const [internalPage, setInternalPage] = useState<string>("Dashboard");
  const [startDate, setStartDate] = useState(
    existing?.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState(
    existing?.endDate?.slice(0, 10) ?? "",
  );
  const [runsIndefinitely, setRunsIndefinitely] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [targetingOpen, setTargetingOpen] = useState(false);
  const [audience, setAudience] =
    useState<(typeof AUDIENCES)[number]>("All Users");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setImageUrl("");
    setIsActive(true);
    setSortOrder("0");
    setPosition("top");
    setLinkType("none");
    setExternalUrl("");
    setInternalPage("Dashboard");
    setStartDate("");
    setEndDate("");
    setRunsIndefinitely(false);
    setAudience("All Users");
    setSelectedCountries([]);
  };

  const onSave = () => {
    toast({
      title: "Banner saved",
      description: `${title || "Untitled banner"} was saved successfully.`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Banner saved",
      description: `${title || "Untitled banner"} saved. Form cleared for the next banner.`,
    });
    resetForm();
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `${title || "Untitled banner"} updated. Continuing edits.`,
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Banner deleted",
      description: `${title || "Untitled banner"} was permanently deleted.`,
    });
    navigate("banner-management");
  };

  const toggleCountry = (c: string) => {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const previewBanner: Banner = {
    id: existing?.id ?? "preview",
    type: existing?.type ?? "marketing",
    title: title || "Untitled banner",
    content: content || "Banner copy appears here…",
    status: isActive ? "active" : "inactive",
    startDate: startDate || new Date().toISOString(),
    endDate:
      runsIndefinitely || !endDate
        ? new Date().toISOString()
        : new Date(endDate).toISOString(),
    position: (position as Banner["position"]) ?? "top",
  };

  return (
    <Page>
      <PageHeader
        title={isNew ? "New Marketing Banner" : "Edit Marketing Banner"}
        description={
          isNew
            ? "Compose a promotional banner with image, destination, schedule, and targeting."
            : `Editing “${existing?.title ?? ""}”.`
        }
        icon={Megaphone}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("banner-management")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Banners
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Form column */}
          <div className="flex flex-col gap-4">
            {/* Basic + image */}
            <SectionCard
              title="Basic Information"
              description="Banner image, title, and copy shown to traders."
              icon={Megaphone}
            >
              <div className="grid gap-4">
                {/* Image upload */}
                <div className="space-y-1.5">
                  <LabelWithHelp help="Shown as the banner's background or hero image. Recommended size 1200×200px for top bar, 600×800 for sidebar.">
                    Banner Image
                  </LabelWithHelp>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-20 w-40 items-center justify-center rounded-md border border-dashed bg-muted/30">
                      {imageUrl ? (
                         
                        <img
                          src={imageUrl}
                          alt="Banner preview"
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-[10px] uppercase">No image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageUrl(URL.createObjectURL(file));
                          } else {
                            setImageUrl("");
                          }
                        }}
                        className="max-w-xs text-xs"
                      />
                      {imageUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-fit px-2 text-xs"
                          onClick={() => setImageUrl("")}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Remove image
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ban-title">Title</Label>
                  <Input
                    id="ban-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. EXPO2026 Deal Live!"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ban-content">Content</Label>
                  <Textarea
                    id="ban-content"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Short banner copy visible to traders."
                  />
                </div>
              </div>
            </SectionCard>

            {/* Display Settings */}
            <SectionCard
              title="Display Settings"
              description="Active toggle, sort order, and on-screen position."
              icon={Settings2}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex flex-col">
                    <Label
                      htmlFor="ban-active"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Is Active
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Inactive banners are hidden from traders.
                    </span>
                  </div>
                  <Switch
                    id="ban-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>

                <div className="space-y-1.5">
                  <LabelWithHelp help="Controls the stacking order — higher numbers appear on top when multiple banners are visible at once.">
                    Sort Order
                  </LabelWithHelp>
                  <Input
                    id="ban-sort"
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select position…" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="inline-flex items-center gap-1">
                            <Layout className="h-3 w-3" />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SectionCard>

            {/* Destination */}
            <SectionCard
              title="Destination"
              description="What happens when a trader clicks the banner."
              icon={Link2}
            >
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Link Type</Label>
                  <Select
                    value={linkType}
                    onValueChange={(v) =>
                      setLinkType(v as (typeof LINK_TYPES)[number])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">External URL</SelectItem>
                      <SelectItem value="internal">Internal Page</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {linkType === "external" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ban-url">External URL</Label>
                    <Input
                      id="ban-url"
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://yourfirm.com/promo"
                    />
                    <p className="text-xs text-muted-foreground">
                      Opens in a new tab when the banner is clicked.
                    </p>
                  </div>
                ) : null}

                {linkType === "internal" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ban-internal">Internal Page</Label>
                    <Select
                      value={internalPage}
                      onValueChange={setInternalPage}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNAL_PAGES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Navigates the trader to the selected dashboard page.
                    </p>
                  </div>
                ) : null}

                {linkType === "none" ? (
                  <p className="text-xs text-muted-foreground">
                    No destination — the banner acts as a passive announcement.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {/* Scheduling — collapsible (starts collapsed per spec) */}
            <Collapsible open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <section className="rounded-lg border bg-card p-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                        <Calendar className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          Scheduling
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Optional — when the banner is visible. Defaults to
                          always-on.
                        </p>
                      </div>
                    </div>
                    {scheduleOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ban-start-date">Start Date</Label>
                      <Input
                        id="ban-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ban-end-date">End Date</Label>
                      <Input
                        id="ban-end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={runsIndefinitely}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <Checkbox
                        id="ban-indefinite"
                        checked={runsIndefinitely}
                        onCheckedChange={(v) => setRunsIndefinitely(Boolean(v))}
                      />
                      <Label
                        htmlFor="ban-indefinite"
                        className="cursor-pointer text-sm"
                      >
                        Runs indefinitely (no end date)
                      </Label>
                    </div>
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* Targeting — collapsible */}
            <Collapsible open={targetingOpen} onOpenChange={setTargetingOpen}>
              <section className="rounded-lg border bg-card p-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                        <Target className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          Targeting
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Optional — narrow who sees this banner.
                        </p>
                      </div>
                    </div>
                    {targetingOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 grid gap-4">
                    <div className="space-y-1.5">
                      <Label>Target Audience</Label>
                      <Select
                        value={audience}
                        onValueChange={(v) =>
                          setAudience(v as (typeof AUDIENCES)[number])
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIENCES.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <LabelWithHelp help="Restrict visibility to traders from these countries. Empty selection applies worldwide.">
                        Countries
                      </LabelWithHelp>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {COUNTRIES.map((c) => {
                          const checked = selectedCountries.includes(c);
                          return (
                            <label
                              key={c}
                              className="flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted/30"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleCountry(c)}
                              />
                              <span>{c}</span>
                            </label>
                          );
                        })}
                      </div>
                      {selectedCountries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No countries selected — banner visible worldwide.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            Visible in:
                          </span>
                          {selectedCountries.map((c) => (
                            <Badge
                              key={c}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* Action bar — one primary action (§13) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                {isNew
                  ? "Creating a new marketing banner."
                  : `Editing banner · ${previewBanner.status} · ${previewBanner.position}`}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isNew ? (
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove{" "}
                          <span className="font-medium text-foreground">
                            {title || "this banner"}
                          </span>{" "}
                          from all trader experiences. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={onDelete}
                        >
                          Delete banner
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
                </Button>
                <Button size="sm" variant="outline" onClick={onSaveAndContinue}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save and continue editing
                </Button>
                <Button size="sm" onClick={onSave}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          </div>

          {/* Preview column */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <SectionCard
              title="Live Preview"
              description="How the banner will appear (top bar shown below)."
              icon={Eye}
            >
              <div className="flex flex-col gap-3">
                {/* Top bar preview */}
                <div className="overflow-hidden rounded-md border bg-background">
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      background: imageUrl
                        ? "linear-gradient(90deg, rgba(74,124,89,0.92), rgba(74,124,89,0.78))"
                        : "#4a7c59",
                      color: "#faf6f0",
                    }}
                  >
                    {imageUrl ? (
                       
                      <img
                        src={imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-50"
                        aria-hidden
                      />
                    ) : null}
                    <div className="relative flex min-w-0 flex-1 items-center gap-2">
                      <Megaphone className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {previewBanner.title}
                        </p>
                        <p className="truncate text-xs opacity-80">
                          {previewBanner.content}
                        </p>
                      </div>
                    </div>
                    {linkType !== "none" ? (
                      <span className="relative shrink-0 rounded bg-black/20 px-2 py-1 text-[10px] uppercase tracking-wide">
                        {linkType === "external"
                          ? "Learn more"
                          : internalPage}
                      </span>
                    ) : null}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>State:</span>
                  <StatusBadge tone={previewBanner.status === "active" ? "success" : "muted"}>
                    {previewBanner.status}
                  </StatusBadge>
                  <span>·</span>
                  <StatusBadge tone={positionTone(previewBanner.position)}>
                    {previewBanner.position}
                  </StatusBadge>
                  <span>·</span>
                  <span>
                    Audience:{" "}
                    <span className="font-medium text-foreground">{audience}</span>
                  </span>
                </div>

                {selectedCountries.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>Visible in:</span>
                    {selectedCountries.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-md border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Schedule:</span>{" "}
                  {startDate || "Now"} →{" "}
                  {runsIndefinitely ? "indefinite" : endDate || "—"}
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
