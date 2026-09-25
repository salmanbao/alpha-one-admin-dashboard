"use client";

/**
 * Offer Edit / Create page (UX Constitution §12, §25-27).
 *
 * Comprehensive create/edit form for an Offer:
 *  - Basic information (title, description, image, coupon, discount, schedule, popup, url)
 *  - Country targeting (dual-list)
 *  - Challenge targeting (dual-list)
 *  - User segment rules (collapsible, progressive disclosure §12)
 *  - Save / Save & add another / Save & continue editing / Delete (§13)
 *
 * Navigation links at top connect to the matching-users view and the
 * per-object change-history view (§27 — related context surfaces next to
 * the entity being edited, not buried in a separate menu).
 *
 * Pre-fills from an existing offer when router.params.id resolves to one;
 * otherwise renders an empty "new offer" form. All form state lives in
 * local useState — no mutations to mock data.
 *
 * Terra palette — forest green primary, cream background, emerald/amber/rose
 * accents. No blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getOffers } from "@/lib/platform/mock-data";
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
  Tag,
  Users,
  History,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Image as ImageIcon,
  Globe,
  Filter,
  Layers,
  Settings2,
  Calendar,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static option pools                                                  */
/* ------------------------------------------------------------------ */

const ALL_COUNTRIES = ["US", "GB", "AE", "SG", "DE", "FR", "BR", "IN", "ZA", "CA"] as const;

const ALL_CHALLENGES = [
  "Instant Standard",
  "2-Step Turbo",
  "1-Step Gen Z",
  "3-Step Pro",
  "Free Trial",
  "Competition",
  "Instant Funded",
] as const;

const TRI_STATE = ["any", "yes", "no"] as const;
type TriState = (typeof TRI_STATE)[number];

interface SegmentRules {
  name: string;
  active: boolean;
  accountPurchased: TriState;
  competitionUser: TriState;
  hasApprovedPayout: TriState;
  fundAccountsOnly: TriState;
  hasFailedAccounts: TriState;
  accountSizeMin: string;
  accountSizeMax: string;
}

const EMPTY_SEGMENT: SegmentRules = {
  name: "",
  active: true,
  accountPurchased: "any",
  competitionUser: "any",
  hasApprovedPayout: "any",
  fundAccountsOnly: "any",
  hasFailedAccounts: "any",
  accountSizeMin: "",
  accountSizeMax: "",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function triStateLabel(s: TriState): string {
  return s === "any" ? "Any" : s === "yes" ? "Yes" : "No";
}

/* ------------------------------------------------------------------ */
/* Dual-list box                                                        */
/* ------------------------------------------------------------------ */

interface DualListProps {
  availableLabel: string;
  selectedLabel: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  availableIcon?: React.ComponentType<{ className?: string }>;
}

function DualListBox({
  availableLabel,
  selectedLabel,
  options,
  selected,
  onChange,
  availableIcon: AvailableIcon,
}: DualListProps) {
  const available = options.filter((o) => !selected.includes(o));

  const add = (value: string) => {
    if (!selected.includes(value)) onChange([...selected, value]);
  };
  const remove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };
  const addAll = () => onChange([...selected, ...available]);
  const removeAll = () => onChange([]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr]">
      {/* Available */}
      <div className="rounded-md border bg-background">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {AvailableIcon ? <AvailableIcon className="h-3 w-3" /> : null}
            {availableLabel}
          </span>
          <Badge variant="outline" className="text-[10px]">{available.length}</Badge>
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {available.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No items available.</p>
          ) : (
            available.map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => add(value)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                <span className="text-foreground">{value}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addAll}
          disabled={available.length === 0}
          aria-label="Add all"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="sr-only md:not-sr-only md:ml-1">Add all</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={removeAll}
          disabled={selected.length === 0}
          aria-label="Remove all"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="sr-only md:not-sr-only md:ml-1">Remove all</span>
        </Button>
      </div>

      {/* Selected */}
      <div className="rounded-md border bg-background">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3 w-3" />
            {selectedLabel}
          </span>
          <Badge variant="outline" className="text-[10px]">{selected.length}</Badge>
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {selected.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No selection — applies to all.
            </p>
          ) : (
            selected.map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => remove(value)}
                  className="h-3.5 w-3.5 accent-rose-500"
                />
                <span className="text-foreground">{value}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section card                                                         */
/* ------------------------------------------------------------------ */

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

export function OfferEditPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const existing = useMemo(
    () => (id ? getOffers().find((o) => o.id === id) : undefined),
    [id],
  );
  const isNew = !existing;

  const [title, setTitle] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [displayOrder, setDisplayOrder] = useState<string>("0");
  const [couponCode, setCouponCode] = useState(existing?.couponCode ?? "");
  const [discountPct, setDiscountPct] = useState<string>(
    existing ? String(existing.discountPct) : "",
  );
  const [startDate, setStartDate] = useState<string>(
    existing?.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState<string>(
    existing?.endDate?.slice(0, 10) ?? "",
  );
  const [isPopup, setIsPopup] = useState<boolean>(false);
  const [offerUrl, setOfferUrl] = useState<string>("");

  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    existing?.targetCountries ?? [],
  );
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [segmentOpen, setSegmentOpen] = useState<boolean>(false);
  const [segment, setSegment] = useState<SegmentRules>(EMPTY_SEGMENT);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);

  const setSegmentField = <K extends keyof SegmentRules>(
    key: K,
    value: SegmentRules[K],
  ) => setSegment((s) => ({ ...s, [key]: value }));

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
    setDisplayOrder("0");
    setCouponCode("");
    setDiscountPct("");
    setStartDate("");
    setEndDate("");
    setIsPopup(false);
    setOfferUrl("");
    setSelectedCountries([]);
    setSelectedChallenges([]);
    setSegment(EMPTY_SEGMENT);
  };

  const onSave = () => {
    toast({
      title: "Offer saved",
      description: `${title || "Untitled offer"} was saved successfully. (demo)`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Offer saved",
      description: `${title || "Untitled offer"} saved. Form cleared for the next offer. (demo)`,
    });
    resetForm();
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `${title || "Untitled offer"} updated. Continuing edits. (demo)`,
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Offer deleted",
      description: `${title || "Untitled offer"} was permanently deleted. (demo)`,
    });
    navigate("offer-management");
  };

  return (
    <Page>
      <PageHeader
        title={isNew ? "New Offer" : "Edit Offer"}
        description={
          isNew
            ? "Create a new discount coupon, schedule, and targeting rules."
            : `Editing “${existing?.name ?? ""}”.`
        }
        icon={Tag}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("offer-management")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Offers
          </Button>
        }
      />

      {/* Related-context navigation links (§27) */}
      {!isNew ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Related:</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => navigate("offer-matching-users", { id })}
          >
            <Users className="mr-1 h-3.5 w-3.5" /> View Matching Users
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => navigate("offer-change-history", { id })}
          >
            <History className="mr-1 h-3.5 w-3.5" /> View Change History
          </Button>
        </div>
      ) : null}

      <PageContent>
        {/* Basic Information */}
        <SectionCard
          title="Basic Information"
          description="Core offer details shown to traders and used for coupon redemption."
          icon={Tag}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="offer-title">Title</Label>
              <Input
                id="offer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. EXPO2026 Bundle Deal"
              />
            </div>
            <div className="space-y-1.5">
              <LabelWithHelp help="Number used to sort offers when several are visible at once. Lower numbers appear first.">
                Display Order
              </LabelWithHelp>
              <Input
                id="offer-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="offer-desc">Description</Label>
              <Textarea
                id="offer-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short marketing copy describing what this offer grants."
              />
            </div>

            {/* Image upload with preview */}
            <div className="space-y-1.5 md:col-span-2">
              <LabelWithHelp help="Shown as the offer banner image. Recommended size 1200×400px. JPG/PNG up to 2MB.">
                Offer Image
              </LabelWithHelp>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed bg-muted/30">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Offer preview"
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
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Use object URL for preview only — no upload backend in demo.
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
              <LabelWithHelp help="Unique code traders enter at checkout. Codes are case-insensitive.">
                Coupon Code
              </LabelWithHelp>
              <Input
                id="offer-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="EXPO2026"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <LabelWithHelp help="Percentage discount applied when the coupon is redeemed. 0–100.">
                Discount %
              </LabelWithHelp>
              <Input
                id="offer-discount"
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-start">Start Date</Label>
              <Input
                id="offer-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-end">End Date</Label>
              <Input
                id="offer-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 md:col-span-2">
              <div className="flex flex-col">
                <Label htmlFor="offer-popup" className="cursor-pointer text-sm font-medium">
                  Is Popup
                </Label>
                <span className="text-xs text-muted-foreground">
                  Show as a popup overlay when traders land on the dashboard.
                </span>
              </div>
              <Switch
                id="offer-popup"
                checked={isPopup}
                onCheckedChange={setIsPopup}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <LabelWithHelp help="Optional landing page URL for the offer. Leave blank to use the default offer popup.">
                Offer URL
              </LabelWithHelp>
              <Input
                id="offer-url"
                value={offerUrl}
                onChange={(e) => setOfferUrl(e.target.value)}
                placeholder="https://yourfirm.com/offers/expo2026"
              />
            </div>
          </div>
        </SectionCard>

        {/* Country Targeting */}
        <SectionCard
          title="Country Targeting"
          description="Restrict this offer to traders in specific countries. Empty selection applies to all countries."
          icon={Globe}
        >
          <DualListBox
            availableLabel="Available Countries"
            selectedLabel="Selected Countries"
            options={ALL_COUNTRIES}
            selected={selectedCountries}
            onChange={setSelectedCountries}
            availableIcon={Globe}
          />
          {selectedCountries.length === 0 ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3" /> No countries selected — the offer is
              visible worldwide.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
              <span className="text-xs text-muted-foreground">Active in:</span>
              {selectedCountries.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Challenge Targeting */}
        <SectionCard
          title="Challenge Targeting"
          description="Restrict this offer to specific challenge types. Empty selection applies to all challenges."
          icon={Layers}
        >
          <DualListBox
            availableLabel="Available Challenges"
            selectedLabel="Selected Challenges"
            options={ALL_CHALLENGES}
            selected={selectedChallenges}
            onChange={setSelectedChallenges}
            availableIcon={Layers}
          />
        </SectionCard>

        {/* User Segment — collapsible (§12 progressive disclosure) */}
        <Collapsible open={segmentOpen} onOpenChange={setSegmentOpen}>
          <section className="rounded-lg border bg-card p-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                    <Settings2 className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      User Segment
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Optional advanced targeting — narrow the audience by trader
                      attributes and account properties.
                    </p>
                  </div>
                </div>
                {segmentOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="seg-name">Segment Name</Label>
                    <Input
                      id="seg-name"
                      value={segment.name}
                      onChange={(e) => setSegmentField("name", e.target.value)}
                      placeholder="e.g. New funded traders — US/EU"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex flex-col">
                      <Label htmlFor="seg-active" className="cursor-pointer text-sm font-medium">
                        Segment Active
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Toggle off to disable this segment temporarily.
                      </span>
                    </div>
                    <Switch
                      id="seg-active"
                      checked={segment.active}
                      onCheckedChange={(v) => setSegmentField("active", v)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 md:grid-cols-2">
                  <TriStateSelect
                    label="Account Purchased"
                    help="Restrict to traders who have or have not purchased a challenge."
                    value={segment.accountPurchased}
                    onChange={(v) => setSegmentField("accountPurchased", v)}
                  />
                  <TriStateSelect
                    label="Competition User"
                    help="Restrict to traders who have or have not participated in a competition."
                    value={segment.competitionUser}
                    onChange={(v) => setSegmentField("competitionUser", v)}
                  />
                  <TriStateSelect
                    label="Has Approved Payout"
                    help="Restrict to traders who have or have not received an approved payout."
                    value={segment.hasApprovedPayout}
                    onChange={(v) => setSegmentField("hasApprovedPayout", v)}
                  />
                  <TriStateSelect
                    label="Fund Accounts Only"
                    help="Restrict to traders currently holding a funded account."
                    value={segment.fundAccountsOnly}
                    onChange={(v) => setSegmentField("fundAccountsOnly", v)}
                  />
                  <TriStateSelect
                    label="Has Failed Accounts"
                    help="Restrict to traders who have or have not failed any challenge."
                    value={segment.hasFailedAccounts}
                    onChange={(v) => setSegmentField("hasFailedAccounts", v)}
                  />
                  <div className="flex flex-col gap-1.5">
                    <LabelWithHelp help="Minimum account size in USD the trader must hold to qualify. Blank = no minimum.">
                      Account Size Min (USD)
                    </LabelWithHelp>
                    <Input
                      type="number"
                      min={0}
                      value={segment.accountSizeMin}
                      onChange={(e) => setSegmentField("accountSizeMin", e.target.value)}
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <LabelWithHelp help="Maximum account size in USD the trader may hold to qualify. Blank = no maximum.">
                      Account Size Max (USD)
                    </LabelWithHelp>
                    <Input
                      type="number"
                      min={0}
                      value={segment.accountSizeMax}
                      onChange={(e) => setSegmentField("accountSizeMax", e.target.value)}
                      placeholder="e.g. 100000"
                    />
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Segment preview:</span>{" "}
                  {segment.name || "Untitled segment"} —{" "}
                  <StatusBadge tone={segment.active ? "success" : "muted"}>
                    {segment.active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        {/* Action bar — one primary action (§13) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">
            {isNew ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Creating a new offer.
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Last updated{" "}
                {existing?.createdAt
                  ? new Date(existing.createdAt).toLocaleDateString()
                  : "—"}
                .
              </span>
            )}
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
                    <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove <span className="font-medium text-foreground">{title || "this offer"}</span> and stop all
                      coupon redemptions using{" "}
                      <span className="font-mono">{couponCode || "(no coupon)"}</span>.
                      Traders who already redeemed the coupon will keep their discount.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-rose-600 hover:bg-rose-700"
                      onClick={onDelete}
                    >
                      Delete offer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveAndAdd}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveAndContinue}
            >
              <Save className="mr-1 h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Tri-state select — Any/Yes/No dropdown                              */
/* ------------------------------------------------------------------ */

function TriStateSelect({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <LabelWithHelp help={help}>{label}</LabelWithHelp>
      <Select value={value} onValueChange={(v) => onChange(v as TriState)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRI_STATE.map((s) => (
            <SelectItem key={s} value={s}>
              {triStateLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
