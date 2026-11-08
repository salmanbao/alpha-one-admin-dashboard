"use client";

/**
 * Promo Wallet - simplified version using unified catalog
 *
 * Demonstrates using the unified promo catalog for all surfaces.
 * Shows active, used, and expired coupon states.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton, cn } from "@pfaas/ui";
import { Clock, Tag, History, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  formatMoney,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  PromoCatalogEntry,
  promoCatalogByCode,
  livePromoCodes,
} from "@/lib/promos/promo-catalog";

/* ------------------------------------------------------------------ */
/* Model + data (unified catalog)                                    */
/* ------------------------------------------------------------------ */

/** Personal status tracking for each coupon code */
interface CouponStatus {
  /** The unified catalog entry */
  catalog: PromoCatalogEntry;
  /** Personal status: active, used, or expired */
  status: "active" | "used" | "expired";
  /** When was this coupon used? */
  usedAt?: string;
  /** Whether we've validated this coupon once */
  validatedOnce?: boolean;
  /** Whether we're currently applying this coupon */
  applying?: boolean;
  /** Validation error ID for retry */
  validationErrorId?: string;
}

/** Reveal state per code */
type RevealedMap = Record<string, boolean>;

/* ------------------------------------------------------------------ */
/* Loading skeleton (Table 153 — card skeletons).                     */
/* ------------------------------------------------------------------ */
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
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Days until expiry as a human-readable label */
function countdownLabel(expiry: string): string {
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  if (days <= 14) return `Expires in ${days} days`;
  return `Expires ${new Date(expiry).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

/** Countdown tone for UI */
function countdownTone(expiry: string): "success" | "tertiary" | "error" {
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days <= 3) return "error";
  if (days <= 14) return "tertiary";
  return "success";
}

/** Check if expired */
function isExpired(expiry: string): boolean {
  return new Date(expiry) < new Date();
}

/** Format day */
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Get brand initials */
function brandInitials(brand: string): string {
  return brand
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Format short discount label */
function discountShort(catalog: PromoCatalogEntry): string {
  return catalog.discountType === "percent"
    ? `${catalog.discountValue}% OFF`
    : `${formatMoney(catalog.discountValue).replace(".00", "")} OFF`;
}

/** Days until expiry */
function daysUntilExpiry(expiry: string): number {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Page                                                              */
/* ------------------------------------------------------------------ */
export function PromoWalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "used">("active");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [couponStatuses, setCouponStatuses] = useState<Record<string, CouponStatus>>({});

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  /* Personal status initialization */
  useEffect(() => {
    // Initialize all coupons from catalog with active status
    livePromoCodes.forEach((coupon) => {
      setCouponStatuses((prev) => ({
        ...prev,
        [coupon.code.toUpperCase()]: {
          catalog: coupon,
          status: "active",
        },
      }));
    });
  }, []);

  /* Active coupons */
  const activeCoupons = useMemo(
    () =>
      Object.values(couponStatuses).filter((status) => status.status === "active"),
    [couponStatuses],
  );

  /* History coupons */
  const historyCoupons = useMemo(
    () =>
      Object.values(couponStatuses).filter((status) => status.status !== "active"),
    [couponStatuses],
  );

  const activeCount = activeCoupons.length;

  const totalPotentialSavings = activeCoupons.reduce(
    (sum, status) => sum + status.catalog.potentialSavings,
    0,
  );

  const nextExpiring = useMemo(() => {
    const active = activeCoupons;
    const expiring = active
      .filter((status) => {
        const now = new Date();
        return new Date(status.catalog.expiry) > now;
      })
      .sort(
        (a, b) =>
          new Date(a.catalog.expiry).getTime() -
          new Date(b.catalog.expiry).getTime(),
      );
    return expiring.length > 0 ? expiring[0] : null;
  }, [activeCoupons]);

  /* ---- Interactions --------------------------------------------- */

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      /* clipboard unavailable */
    }
    toast({
      title: "Code copied",
      description: `${code} copied to clipboard.`,
    });
  };

  const handleApply = (code: string) => {
    const status = couponStatuses[code.toUpperCase()];
    if (!status || status.status !== "active" || applyingId) return;

    setApplyingId(code.toUpperCase());
    toast({
      title: "Promo selected",
      description: `${code} will be applied at checkout.`,
    });
    router.push(`/checkout?promo=${encodeURIComponent(code)}`);
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
              <TerraBadge tone={countdownTone(nextExpiring.catalog.expiry)} dot pulse>
                <Clock className="h-3 w-3" />
                {nextExpiring.catalog.code} · {countdownLabel(nextExpiring.catalog.expiry)}
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
          Used & Expired
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
          {coupons.map((status) => {
            const coupon = status.catalog;
            const code = coupon.code.toUpperCase();
            const expired = isExpired(coupon.expiry) || status.status === "expired";
            const dimmed = status.status !== "active";
            const shown = revealed[code];
            const applying = applyingId === code;

            return (
              <TerraCard
                key={code}
                className={cn(
                  "space-y-4 transition-opacity",
                  dimmed && "opacity-70 saturate-50",
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: brand banner + value + eligible items */}
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div
                      className="flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-container-low"
                    >
                      <span className="font-headline text-lg font-bold text-on-surface">
                        {brandInitials(coupon.brand)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant opacity-80">
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
                        {status.status === "active" ? (
                          <TerraBadge tone={countdownTone(coupon.expiry)} dot pulse={daysUntilExpiry(coupon.expiry) <= 3}>
                            <Clock className="h-3 w-3" />
                            {countdownLabel(coupon.expiry)}
                          </TerraBadge>
                        ) : status.status === "used" ? (
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
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRevealed((r) => ({ ...r, [code]: !r[code] }))}
                          className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2.5 py-1 font-mono text-xs font-bold text-on-surface hover:bg-surface-container-low"
                          aria-label={shown ? `Hide code ${code}` : `Reveal code ${code}`}
                        >
                          {shown ? code : "••••••••"}
                        </button>
                        <span className="text-[11px] text-on-surface-variant">
                          {shown ? "Tap to hide" : "Tap to reveal code"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {status.status === "active" && !expired && (
                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => handleCopy(code)}
                        className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low"
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => handleApply(code)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60"
                      >
                        {applying ? "Opening checkout…" : "Apply at checkout"}
                      </button>
                    </div>
                  )}
                </div>
              </TerraCard>
            );
          })}
        </div>
      )}
    </div>
  );
}