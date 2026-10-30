"use client";

/**
 * Affiliate Coupon Detail — summary + edit form for a single coupon code.
 *
 * Extracted from the Coupons list's inline CouponSheet (view mode) into
 * the detail-overlay pattern: a row click (or the Edit action) opens this
 * screen as a sheet (?panel=affiliate-coupon-detail&id=CPN-…) and the
 * same component renders full-page from ?view=affiliate-coupon-detail
 * (new tab / overlay header's "New tab" button).
 *
 * Progressive disclosure (AGENTS.md): read-only summary by default with
 * an "Edit" toggle that unlocks the editable fields (Code, Description,
 * Discount, Caps, Validity, Plans, Affiliate, Status). Redemption stats
 * and attribution remain read-only — they reflect actual redemptions.
 *
 * Create mode stays in the parent's CouponSheet drawer; this screen is
 * always bound to an existing coupon resolved via router.params.id.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getCoupon,
  couponStatusTone,
  formatDiscountValue,
  formatDate,
  generateCode,
  copyToClipboard,
  ALL_PLANS,
  type Coupon,
  type DiscountType,
  type PlanName,
} from "@/modules/affiliates/pages/affiliate-coupons-page";
import { Page, PageContent } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Ban,
  ChevronRight,
  Copy,
  Files,
  Pencil,
  Percent,
  DollarSign,
  Gift,
  Coins,
  RefreshCw,
  Save,
  ShieldAlert,
  Ticket,
  X,
} from "lucide-react";

/** Tone + icon for the discount type badge (read-only display). */
function discountTypeLabelIcon(type: DiscountType) {
  switch (type) {
    case "Percentage":
      return Percent;
    case "Flat":
      return DollarSign;
    case "Free Trial":
      return Gift;
    case "Bonus Credit":
    default:
      return Coins;
  }
}

export function AffiliateCouponDetailPage() {
  const { router, navigate, runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  const coupon = getCoupon(router.params.id ?? "");
  const [editing, setEditing] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  // Editable form state — lazy initializers seed from the coupon on
  // mount (no setState-in-effect). Mock data: saves are demo toasts, so
  // staying seeded from the original coupon is fine.
  const [codeValue, setCodeValue] = useState(() => coupon?.code ?? "");
  const [description, setDescription] = useState(() => coupon?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(() => coupon?.discountType ?? "Percentage");
  const [discountValue, setDiscountValue] = useState(() => String(coupon?.discountValue ?? 0));
  const [minPurchase, setMinPurchase] = useState(() => String(coupon?.minPurchase ?? 0));
  const [limit, setLimit] = useState(() => String(coupon?.limit ?? 0));
  const [unlimited, setUnlimited] = useState(() => coupon?.limit === 0);
  const [validFrom, setValidFrom] = useState(() => coupon?.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(() => coupon?.expires ?? "");
  const [plans, setPlans] = useState<PlanName[]>(() => coupon?.applicablePlans ?? []);
  const [affiliate, setAffiliate] = useState<string>(() => coupon?.affiliateId ?? "AFF-001");
  const [active, setActive] = useState(() => coupon?.status === "active");
  const [seed, setSeed] = useState(1);

  const close = () => navigate("affiliate-coupons");

  if (!coupon) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Coupon not found</p>
            <p className="text-sm text-muted-foreground">
              This coupon code doesn&apos;t exist or was removed.
            </p>
            <Button size="sm" variant="outline" onClick={close}>
              <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back to Coupons
            </Button>
          </div>
        </PageContent>
      </Page>
    );
  }

  const handleGenerate = () => {
    const next = seed + 1;
    setSeed(next);
    setCodeValue(generateCode(next));
  };

  const togglePlan = (p: PlanName) => {
    setPlans((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));
  };

  const handleSave = () => {
    if (!codeValue.trim()) {
      toast({ title: "Code required", description: "Generate or type a coupon code first.", variant: "destructive" });
      return;
    }
    toast({
      title: "Coupon saved",
      description: `${codeValue} — ${discountType} ${formatDiscountValue(discountType, Number(discountValue) || 0, currency)}${plans.length ? ` · ${plans.length} plan${plans.length === 1 ? "" : "s"}` : ""}.`,
    });
    setEditing(false);
  };

  const handleDuplicate = () => {
    toast({
      title: "Coupon duplicated",
      description: `${codeValue}-COPY draft created in the Coupons table.`,
    });
  };

  const handleDisable = () => {
    toast({
      title: "Coupon disabled",
      description: `${coupon.code} no longer accepts redemptions.`,
      variant: "destructive",
    });
    setDisableOpen(false);
  };

  const TypeIcon = discountTypeLabelIcon(coupon.discountType);

  return (
    <Page>
      {/* Breadcrumb — Coupon Codes > [code] */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="cursor-pointer text-muted-foreground"
            >
              <button type="button" onClick={close}>
                Coupon Codes
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">{coupon.code}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          {/* Header — code + status + edit toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-muted p-2">
                <Ticket className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <span className="font-mono">{coupon.code}</span>
                  <StatusBadge tone={couponStatusTone(coupon.status)} className="capitalize">
                    {coupon.status}
                  </StatusBadge>
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {coupon.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last redeemed {coupon.used} times · limit {coupon.limit === 0 ? "unlimited" : coupon.limit} · owned by {coupon.affiliateName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {editing ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel editing">
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel edit
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label="Edit this coupon">
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={close} aria-label="Close detail">
                Close
              </Button>
            </div>
          </div>

          {!editing ? (
            /* ---------------- Read-only summary ---------------- */
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Discount</p>
                  <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
                    <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDiscountValue(coupon.discountType, coupon.discountValue, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{coupon.discountType}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Min Purchase</p>
                  <p className="mt-1 font-medium tabular-nums text-foreground">
                    {coupon.minPurchase === 0 ? "None" : formatCurrency(coupon.minPurchase, currency)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Redemptions</p>
                  <p className="mt-1 font-medium tabular-nums text-foreground">
                    {coupon.used}
                    <span className="text-muted-foreground"> / {coupon.limit === 0 ? "∞" : coupon.limit}</span>
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Validity</p>
                  <p className="mt-1 text-xs text-foreground">
                    {formatDate(coupon.validFrom)} → {formatDate(coupon.expires)}
                  </p>
                </div>
              </div>

              {/* Code + copy */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Code</span>
                <span className="font-mono text-sm font-medium text-foreground">{coupon.code}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(coupon.code, "Coupon code")}
                  aria-label={`Copy coupon code ${coupon.code}`}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              {/* Applicable plans */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Applicable Plans</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coupon.applicablePlans.length > 0 ? (
                    coupon.applicablePlans.map((p) => (
                      <span key={p} className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs">{p}</span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Any plan</span>
                  )}
                </div>
              </div>

              {/* 30d attribution stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Redemptions (30d)</p>
                  <p className="mt-1 font-medium tabular-nums">{coupon.redemptions30d}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Discount Given (30d)</p>
                  <p className="mt-1 font-medium tabular-nums text-rose-600">{formatCurrency(coupon.discountGiven30d, currency)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Revenue (30d)</p>
                  <p className="mt-1 font-medium tabular-nums text-emerald-600">{formatCurrency(coupon.revenueAttributed30d, currency)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Conversion Rate</p>
                  <p className="mt-1 font-medium tabular-nums">{coupon.conversionRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* Footer actions — §22 contextual */}
              <div className="flex flex-row flex-wrap gap-2 border-t pt-4">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={handleDuplicate}>
                  <Files className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                {coupon.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto text-rose-600 hover:text-rose-700"
                    onClick={() => setDisableOpen(true)}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" /> Disable
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ---------------- Edit form ---------------- */
            <div className="mt-4 space-y-4">
              {/* Code field with Generate button */}
              <div className="space-y-1.5">
                <Label htmlFor="cpn-code" className="text-xs">
                  <LabelWithHelp help="The code {trader}s type at checkout. Use 6-12 uppercase alphanumeric characters. Avoid I, O, 0, 1 for legibility.">
                    Code
                  </LabelWithHelp>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cpn-code"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
                    className="font-mono text-sm"
                    aria-label="Coupon code"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerate}
                    aria-label="Generate random coupon code"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="cpn-desc" className="text-xs">Description</Label>
                <Input
                  id="cpn-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-label="Coupon description"
                />
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount Type</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                    <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Discount type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">Percentage off</SelectItem>
                      <SelectItem value="Flat">Flat amount off</SelectItem>
                      <SelectItem value="Free Trial">Free trial days</SelectItem>
                      <SelectItem value="Bonus Credit">Bonus credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpn-value" className="text-xs">
                    {discountType === "Percentage"
                      ? "Percent (%)"
                      : discountType === "Free Trial"
                        ? "Trial days"
                        : `Amount (${currency})`}
                  </Label>
                  <Input
                    id="cpn-value"
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    aria-label="Discount value"
                  />
                </div>
              </div>

              <Separator />

              {/* Min purchase + Max redemptions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpn-min" className="text-xs">
                    <LabelWithHelp help="Minimum cart subtotal required before the coupon applies. Set to 0 for no minimum.">
                      Min Purchase ({currency})
                    </LabelWithHelp>
                  </Label>
                  <Input
                    id="cpn-min"
                    type="number"
                    min={0}
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                    aria-label="Minimum purchase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpn-limit" className="text-xs">
                    <LabelWithHelp help="Maximum total redemptions across all {trader}s. Once hit, the coupon stops accepting new redemptions.">
                      Max Redemptions
                    </LabelWithHelp>
                  </Label>
                  <Input
                    id="cpn-limit"
                    type="number"
                    min={0}
                    value={limit}
                    disabled={unlimited}
                    aria-label="Maximum redemptions"
                    className={unlimited ? "opacity-50" : ""}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={unlimited} onCheckedChange={(v) => setUnlimited(v === true)} aria-label="Unlimited redemptions" />
                    Unlimited
                  </label>
                </div>
              </div>

              {/* Valid From / Valid Until */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpn-from" className="text-xs">Valid From</Label>
                  <Input
                    id="cpn-from"
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    aria-label="Valid from date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpn-until" className="text-xs">Valid Until</Label>
                  <Input
                    id="cpn-until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    aria-label="Valid until date"
                  />
                </div>
              </div>

              {/* Applicable Plans — multi-select */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <LabelWithHelp help="Restricts the coupon to specific plans at checkout. Leave all unchecked for any plan.">
                    Applicable Plans
                  </LabelWithHelp>
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_PLANS.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
                    >
                      <Checkbox
                        checked={plans.includes(p)}
                        onCheckedChange={() => togglePlan(p)}
                        aria-label={`Apply to ${p} plan`}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Affiliate select */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <LabelWithHelp help="The affiliate who earns commission on each redemption. Choose 'Any' to allow all affiliates to share the coupon.">
                    Owning Affiliate
                  </LabelWithHelp>
                </Label>
                <Select value={affiliate} onValueChange={setAffiliate}>
                  <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Owning affiliate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFF-001">Alex Trader</SelectItem>
                    <SelectItem value="AFF-002">Sarah Marketing</SelectItem>
                    <SelectItem value="AFF-003">Maria Lopez</SelectItem>
                    <SelectItem value="AFF-004">David Chen</SelectItem>
                    <SelectItem value="AFF-005">Emma Wilson</SelectItem>
                    <SelectItem value="any">Any affiliate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status toggle */}
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Status</span>
                  <span className="text-[11px] text-muted-foreground">
                    {active ? "Accepting redemptions" : "Disabled — no new redemptions"}
                  </span>
                </div>
                <Switch checked={active} onCheckedChange={setActive} aria-label="Coupon status" />
              </div>

              {/* Edit footer */}
              <div className="flex flex-row flex-wrap gap-2 border-t pt-4">
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleDuplicate}>
                  <Files className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContent>

      {/* Disable Coupon AlertDialog — destructive friction §24 */}
      <AlertDialog open={disableOpen} onOpenChange={(o) => !o && setDisableOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable coupon {coupon.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              The coupon will stop accepting new redemptions immediately.{" "}
              {coupon.used} trader{coupon.used === 1 ? "" : "s"} have already
              redeemed this code — those discounts remain honored. Existing
              tracked links continue to work but return a &quot;code
              disabled&quot; error to the trader at checkout. This action is
              logged in the audit trail and can be reversed by re-enabling the
              coupon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep coupon</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDisable}
            >
              Disable coupon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
