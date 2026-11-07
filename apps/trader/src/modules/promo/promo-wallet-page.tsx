"use client";

/**
 * Promo Wallet — upgraded per M8 spec Section 12.4 (View ID /promos)
 *
 * Where campaign coupons (M4) become trader-visible assets.
 *
 * Layout regions (Table 152):
 * - Tabs: Active / Used & Expired.
 * - Active coupon cards: brand banner, discount value (percent or fixed),
 *   code masked with reveal toggle + copy, expiry countdown chip, eligible
 *   items line, Apply button routing to marketplace checkout with the promo
 *   pre-applied, and an eligibility hint line + action deep link when
 *   conditions are unmet.
 * - Used & Expired cards: dimmed, with outcome state — Used on date with an
 *   order link, Expired on date, and a Restore request link where firm
 *   policy allows it.
 * - Summary strip: active count, total potential savings, next expiring
 *   coupon chip.
 *
 * Interactions (Table 153):
 * - Apply validates eligibility at tap; ineligible coupons disable Apply
 *   with the reason inline (not only the hint), expired coupons never hand
 *   the promo to checkout.
 * - Copy and Apply fire toasts.
 *
 * States (Table 153): empty states per tab (active → "No active offers"
 * with a browse-marketplace CTA; used → informational); card skeletons
 * while loading; an eligibility validation failure renders a retryable
 * error on the card without navigating.
 *
 * Data shown: coupons with conditions, expiry, eligibility evaluation,
 * usage history, order references. All data is local dummy data.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton, cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  formatMoney,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Tag,
  XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Model + dummy data                                                  */
/* ------------------------------------------------------------------ */

interface Coupon {
  id: string;
  code: string;
  brand: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  expiry: string; // ISO
  eligibleItems: string;
  conditions: string;
  status: "active" | "used" | "expired";
  /** Live eligibility evaluation (plain-language reasons for failures). */
  eligible: boolean;
  ineligibleReason?: string;
  /** Hint line + deep link shown when conditions are unmet. */
  hint?: { text: string; action: { label: string; href: string } };
  potentialSavings: number; // drives the summary strip
  usedAt?: string;
  orderId?: string;
  /** First Apply fails the validation service → retryable card error. */
  validationFlaky?: boolean;
  /** Expired-with-usage-credit: firm policy allows a restore request. */
  restoreAllowed?: boolean;
}

const demoCoupons: Coupon[] = [
  {
    id: "promo-001",
    code: "WELCOME25",
    brand: "Alpha Capital",
    discountType: "percent",
    discountValue: 25,
    expiry: "2026-12-31T23:59:59Z",
    eligibleItems: "Challenge fees $25K and above",
    conditions: "First purchase only. One redemption per trader.",
    status: "active",
    eligible: true,
    potentialSavings: 125,
  },
  {
    id: "promo-002",
    code: "FLASH25",
    brand: "Terra Flash",
    discountType: "percent",
    discountValue: 25,
    expiry: "2026-11-30T23:59:59Z",
    eligibleItems: "Terra Flash Instant $10K accounts",
    conditions: "Requires an active Flash $10K account on your profile.",
    status: "active",
    eligible: false,
    ineligibleReason: "You don't have a Terra Flash $10K account yet — this code only applies at Flash checkout.",
    hint: {
      text: "Buy a Flash $10K challenge by Nov 30 to unlock",
      action: { label: "Browse Flash challenges", href: "/marketplace" },
    },
    potentialSavings: 75,
  },
  {
    id: "promo-003",
    code: "TERRA10",
    brand: "TerraTrader",
    discountType: "percent",
    discountValue: 10,
    expiry: "2026-11-12T23:59:59Z",
    eligibleItems: "All challenge programs",
    conditions: "Stacks with campaign offers; excludes add-ons.",
    status: "active",
    eligible: true,
    potentialSavings: 49,
    validationFlaky: true,
  },
  {
    id: "promo-004",
    code: "REFERRAL10",
    brand: "Beta Trading",
    discountType: "fixed",
    discountValue: 100,
    expiry: "2026-01-15T23:59:59Z",
    eligibleItems: "Challenge fees $25K and above",
    conditions: "Redeemed against order ORD-83921.",
    status: "used",
    eligible: false,
    usedAt: "2026-01-10T14:32:00Z",
    orderId: "ORD-83921",
    potentialSavings: 100,
  },
  {
    id: "promo-005",
    code: "EARLYBIRD15",
    brand: "Alpha Capital",
    discountType: "percent",
    discountValue: 15,
    expiry: "2026-10-31T23:59:59Z",
    eligibleItems: "All challenge programs",
    conditions: "Expired during the early-bird campaign window.",
    status: "expired",
    eligible: false,
    ineligibleReason: "Expired on Oct 31, 2026 — checkout never receives this promo.",
    restoreAllowed: true,
    potentialSavings: 15,
  },
  {
    id: "promo-006",
    code: "SUMMER20",
    brand: "Gamma Futures",
    discountType: "fixed",
    discountValue: 50,
    expiry: "2026-09-30T23:59:59Z",
    eligibleItems: "Futures challenges",
    conditions: "Seasonal campaign — no restorations offered.",
    status: "expired",
    eligible: false,
    ineligibleReason: "Expired on Sep 30, 2026 — checkout never receives this promo.",
    potentialSavings: 50,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const daysUntilExpiry = (expiry: string) =>
  Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);

const isExpired = (expiry: string) => new Date(expiry) < new Date();

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function countdownLabel(expiry: string): string {
  const days = daysUntilExpiry(expiry);
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  if (days <= 14) return `Expires in ${days} days`;
  return `Expires ${fmtDay(expiry)}`;
}

function countdownTone(expiry: string): "success" | "tertiary" | "error" {
  const days = daysUntilExpiry(expiry);
  if (days <= 3) return "error";
  if (days <= 14) return "tertiary";
  return "success";
}

function discountLabel(c: Coupon): string {
  return c.discountType === "percent"
    ? `${c.discountValue}% off`
    : `${formatMoney(c.discountValue)} off`;
}

function discountShort(c: Coupon): string {
  return c.discountType === "percent"
    ? `${c.discountValue}% OFF`
    : `${formatMoney(c.discountValue).replace(".00", "")} OFF`;
}

function brandInitials(brand: string): string {
  return brand
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* Loading skeleton (Table 153 — card skeletons). */
function WalletSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PromoWalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "used">("active");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [validationErrorId, setValidationErrorId] = useState<string | null>(null);
  const [validatedOnce, setValidatedOnce] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const activeCoupons = useMemo(
    () => demoCoupons.filter((c) => c.status === "active"),
    [],
  );
  const historyCoupons = useMemo(
    () => demoCoupons.filter((c) => c.status !== "active"),
    [],
  );

  const activeCount = activeCoupons.length;
  const totalPotentialSavings = activeCoupons.reduce(
    (sum, c) => sum + c.potentialSavings,
    0,
  );
  const nextExpiring = [...activeCoupons]
    .filter((c) => !isExpired(c.expiry))
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())[0];

  /* ---- Interactions --------------------------------------------- */

  const handleCopy = (coupon: Coupon) => {
    navigator.clipboard?.writeText(coupon.code).catch(() => undefined);
    toast({
      title: "Code copied",
      description: `${coupon.code} copied to clipboard.`,
    });
  };

  const toggleReveal = (id: string) =>
    setRevealed((r) => ({ ...r, [id]: !r[id] }));

  /** Apply validates eligibility at tap (Table 153). Ineligible/expired
   *  coupons keep Apply disabled with the reason inline, so checkout never
   *  receives their promo. */
  const handleApply = (coupon: Coupon) => {
    if (applyingId) return;
    if (isExpired(coupon.expiry) || !coupon.eligible) return;
    setValidationErrorId(null);
    setApplyingId(coupon.id);
    setTimeout(() => {
      setApplyingId(null);
      if (coupon.validationFlaky && !validatedOnce.includes(coupon.id)) {
        setValidatedOnce((v) => [...v, coupon.id]);
        setValidationErrorId(coupon.id);
        toast({
          title: "Eligibility check failed",
          description: "The promo service didn't respond — nothing was navigated.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Promo applied",
        description: `${coupon.code} will be applied at marketplace checkout.`,
      });
      router.push(`/checkout?promo=${encodeURIComponent(coupon.code)}`);
    }, 700);
  };

  const handleRestore = (coupon: Coupon) => {
    toast({
      title: "Restore requested",
      description: `A policy review to restore ${coupon.code} was sent to support.`,
    });
  };

  /* ---- Render ---------------------------------------------------- */

  if (loading) return <WalletSkeleton />;

  const coupons = activeTab === "active" ? activeCoupons : historyCoupons;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Promo Wallet"
        description="Campaign coupons — active offers, eligibility and redemption history"
      />

      {/* ---------------------------------------------- Summary strip */}
      <TerraCard className="p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Active offers
            </p>
            <p className="font-headline text-2xl font-bold tabular-nums text-on-surface">
              {activeCount}
            </p>
          </div>
          <div className="h-10 w-px bg-outline-variant/60" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Total potential savings
            </p>
            <p className="font-headline text-2xl font-bold tabular-nums text-primary">
              {formatMoney(totalPotentialSavings)}
            </p>
          </div>
          <div className="h-10 w-px bg-outline-variant/60" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Next expiring
            </p>
            {nextExpiring ? (
              <TerraBadge tone={countdownTone(nextExpiring.expiry)} dot pulse>
                <Clock className="h-3 w-3" />
                {nextExpiring.code} · {countdownLabel(nextExpiring.expiry)}
              </TerraBadge>
            ) : (
              <p className="text-sm font-semibold text-on-surface-variant">
                Nothing expiring soon
              </p>
            )}
          </div>
        </div>
      </TerraCard>

      {/* --------------------------------------------------- Tabs */}
      <div
        role="tablist"
        aria-label="Coupon status"
        className="flex items-center gap-1 rounded-xl bg-surface-container-low p-1"
      >
        <button
          key="active"
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          onClick={() => setActiveTab("active")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all",
            activeTab === "active"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          <Tag className="h-4 w-4" />
          Active
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              activeTab === "active"
                ? "bg-on-primary/20 text-on-primary"
                : "bg-surface-container-high text-on-surface-variant",
            )}
          >
            {activeCount}
          </span>
        </button>
        <button
          key="used"
          type="button"
          role="tab"
          aria-selected={activeTab === "used"}
          onClick={() => setActiveTab("used")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all",
            activeTab === "used"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          <History className="h-4 w-4" />
          Used &amp; Expired
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              activeTab === "used"
                ? "bg-on-primary/20 text-on-primary"
                : "bg-surface-container-high text-on-surface-variant",
            )}
          >
            {historyCoupons.length}
          </span>
        </button>
      </div>

      {/* ------------------------------------------ Coupon cards */}
      {coupons.length === 0 ? (
        activeTab === "active" ? (
          <TerraEmpty
            icon={<Tag className="h-10 w-10" />}
            title="No active offers"
            description="When a campaign sends you a coupon it appears here — with its conditions and expiry."
            actionLabel="Browse marketplace"
            actionHref="/marketplace"
          />
        ) : (
          <TerraEmpty
            icon={<RefreshCw className="h-10 w-10" />}
            title="No used or expired offers yet"
            description="Redemptions and expired campaigns show up here, linked to their orders."
          />
        )
      ) : (
        <div className="space-y-4">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.expiry) || coupon.status === "expired";
            const dimmed = coupon.status !== "active";
            const shown = revealed[coupon.id];
            const applying = applyingId === coupon.id;
            const validationFailed = validationErrorId === coupon.id;
            const applyBlocked = !coupon.eligible || expired;
            const blockedReason =
              expired && coupon.status === "expired"
                ? coupon.ineligibleReason ??
                  `Expired on ${fmtDay(coupon.expiry)} — checkout never receives this promo.`
                : expired
                  ? `Expired on ${fmtDay(coupon.expiry)} — checkout never receives this promo.`
                  : coupon.ineligibleReason ?? "This offer's conditions aren't met yet.";

            return (
              <TerraCard
                key={coupon.id}
                className={cn(
                  "space-y-4 transition-opacity",
                  dimmed && "opacity-70 saturate-50",
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: brand banner + value + eligible items */}
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div
                      className={cn(
                        "flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl",
                        dimmed
                          ? "bg-surface-container text-on-surface-variant"
                          : "bg-primary-fixed text-on-primary-fixed-variant",
                      )}
                    >
                      <span className="font-headline text-lg font-bold">
                        {brandInitials(coupon.brand)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                        {coupon.brand.split(" ")[0]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-headline text-lg font-bold text-on-surface">
                          {coupon.brand}
                        </h3>
                        <TerraBadge
                          tone={coupon.discountType === "percent" ? "primary" : "secondary"}
                        >
                          {discountShort(coupon)}
                        </TerraBadge>
                        {coupon.status === "active" ? (
                          <TerraBadge tone={countdownTone(coupon.expiry)} dot pulse={daysUntilExpiry(coupon.expiry) <= 3}>
                            <Clock className="h-3 w-3" />
                            {countdownLabel(coupon.expiry)}
                          </TerraBadge>
                        ) : coupon.status === "used" ? (
                          <TerraBadge tone="neutral">
                            <CheckCircle2 className="h-3 w-3" />
                            Used
                          </TerraBadge>
                        ) : (
                          <TerraBadge tone="error">
                            <XCircle className="h-3 w-3" />
                            Expired
                          </TerraBadge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-on-surface-variant">
                        Eligible: <span className="font-semibold text-on-surface">{coupon.eligibleItems}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {coupon.conditions}
                      </p>

                      {/* Outcome line for used / expired cards */}
                      {coupon.status === "used" && coupon.usedAt && (
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-on-surface">
                            Used on {fmtDay(coupon.usedAt)}
                          </span>
                          {coupon.orderId && (
                            <Link
                              href={`/purchase-history?orderId=${coupon.orderId}`}
                              className="font-bold text-primary underline hover:text-primary/80"
                            >
                              View order {coupon.orderId}
                            </Link>
                          )}
                        </p>
                      )}
                      {coupon.status === "expired" && (
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <XCircle className="h-3.5 w-3.5 text-error" />
                          <span className="font-semibold text-on-surface">
                            Expired on {fmtDay(coupon.expiry)}
                          </span>
                          {coupon.restoreAllowed && (
                            <button
                              type="button"
                              onClick={() => handleRestore(coupon)}
                              className="flex items-center gap-1 font-bold text-primary underline hover:text-primary/80"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Request restore
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: code + primary action */}
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <div className="flex items-center gap-1.5">
                      <code className="rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-2 font-mono text-sm font-bold tabular-nums tracking-wider text-on-surface">
                        {shown ? coupon.code : "••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() => toggleReveal(coupon.id)}
                        aria-label={shown ? "Hide code" : "Reveal code"}
                        title={shown ? "Hide code" : "Reveal code"}
                        className="rounded-lg border border-outline-variant/50 p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                      >
                        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(coupon)}
                        aria-label="Copy code"
                        title="Copy code"
                        className="rounded-lg border border-outline-variant/50 p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Apply — disabled with the reason inline when blocked */}
                    {coupon.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => handleApply(coupon)}
                        disabled={applyBlocked || applying}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                          applyBlocked
                            ? "cursor-not-allowed bg-surface-container text-on-surface-variant opacity-70"
                            : "bg-primary text-on-primary hover:bg-primary/90",
                        )}
                      >
                        {applying ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Checking…
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4" />
                            Apply
                          </>
                        )}
                      </button>
                    ) : coupon.status === "used" ? (
                      <TerraBadge tone="success">
                        <CheckCircle2 className="h-3 w-3" />
                        Used {coupon.usedAt ? fmtDay(coupon.usedAt) : ""}
                      </TerraBadge>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface-variant/70"
                      >
                        <XCircle className="h-4 w-4" />
                        Apply
                      </button>
                    )}
                  </div>
                </div>

                {/* Apply blocked — inline reason (not only the hint) */}
                {applyBlocked && coupon.status === "active" && (
                  <p className="flex items-start gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-xs text-error">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="font-semibold">{blockedReason}</span>
                  </p>
                )}
                {expired && coupon.status === "expired" && (
                  <p className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 px-3 py-2 text-xs text-error">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="font-semibold">{blockedReason}</span>
                  </p>
                )}

                {/* Eligibility hint + deep link (unmet conditions) */}
                {coupon.status === "active" && coupon.hint && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-tertiary/40 bg-tertiary-container/40 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {coupon.hint.text}
                    </span>
                    <Link
                      href={coupon.hint.action.href}
                      className="flex items-center gap-1 text-xs font-bold text-primary underline hover:text-primary/80"
                    >
                      {coupon.hint.action.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {/* Validation failure — retryable error on the card,
                    no navigation (Table 153) */}
                {validationFailed && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-error/40 bg-error-container/25 px-3 py-2"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-error" />
                    <span className="min-w-0 flex-1 text-xs font-semibold text-error">
                      Eligibility validation failed — the promo service didn't respond.
                      Nothing was applied.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApply(coupon)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </TerraCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
