"use client";

/**
 * Promo Wallet — Trader Engagement Suite (M8)
 *
 * Campaign coupons become trader-visible assets:
 * - Active coupons with masked codes and apply-to-checkout
 * - Eligibility hints that explain conditions in plain language
 * - History of used and expired offers closing the attribution loop for M4 campaigns
 *
 * Spec: Section 12.4 — Promo Wallet
 */

import { useState, useMemo } from "react";
import { cn } from "@pfaas/ui";
import { useRouter } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  formatMoney,
} from "@/components/terra/terra-ui";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  CheckCircle2,
  Clock,
  Tag,
  ArrowRight,
  Eye,
  EyeOff,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  brand: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  expiry: string; // ISO date
  eligibleItems: string;
  conditions: string;
  status: "active" | "used" | "expired";
  usedAt?: string;
  orderId?: string;
  minDeposit?: number;
  applicableChallenges?: string[];
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
    conditions: "First purchase only. Deposit by Dec 30 to unlock.",
    status: "active",
    minDeposit: 25000,
    applicableChallenges: ["challenge-10k", "challenge-25k", "challenge-50k"],
  },
  {
    id: "promo-002",
    code: "SPRING20",
    brand: "Beta Trading",
    discountType: "percent",
    discountValue: 20,
    expiry: "2026-06-30T23:59:59Z",
    eligibleItems: "All challenge programs",
    conditions: "Valid for new challenges started before June 30.",
    status: "active",
    applicableChallenges: ["challenge-10k", "challenge-25k", "challenge-50k", "challenge-instant"],
  },
  {
    id: "promo-003",
    code: "VIP50",
    brand: "Gamma Futures",
    discountType: "fixed",
    discountValue: 50,
    expiry: "2026-03-15T23:59:59Z",
    eligibleItems: "Challenge fees $50K only",
    conditions: "Requires $50K deposit within 48 hours of applying.",
    status: "active",
    minDeposit: 50000,
    applicableChallenges: ["challenge-50k"],
  },
  {
    id: "promo-004",
    code: "EARLYBIRD15",
    brand: "Alpha Capital",
    discountType: "percent",
    discountValue: 15,
    expiry: "2025-11-30T23:59:59Z",
    eligibleItems: "All challenge programs",
    conditions: "Expired — was valid for challenges started before Nov 30.",
    status: "expired",
  },
  {
    id: "promo-005",
    code: "REFERRAL10",
    brand: "Beta Trading",
    discountType: "fixed",
    discountValue: 100,
    expiry: "2026-01-15T23:59:59Z",
    eligibleItems: "Challenge fees $25K and above",
    conditions: "Used on order #ORD-83921",
    status: "used",
    usedAt: "2026-01-10T14:32:00Z",
    orderId: "ORD-83921",
  },
];

function getDaysUntilExpiry(expiry: string): number {
  const now = new Date();
  const expiryDate = new Date(expiry);
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isExpired(expiry: string): boolean {
  return new Date(expiry) < new Date();
}

export function PromoWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"active" | "used">("active");
  const [showCode, setShowCode] = useState<Record<string, boolean>>({});
  const [expandedCoupon, setExpandedCoupon] = useState<string | null>(null);

  const activeCoupons = useMemo(
    () => demoCoupons.filter((c) => c.status === "active"),
    []
  );
  const usedCoupons = useMemo(
    () => demoCoupons.filter((c) => c.status === "used" || c.status === "expired"),
    []
  );

  const activeCount = activeCoupons.length;
  const totalPotentialSavings = activeCoupons.reduce((sum, c) => sum + c.discountValue, 0);
  const nextExpiring = activeCoupons
    .filter((c) => !isExpired(c.expiry))
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())[0];

  const handleCopy = (coupon: Coupon) => {
    navigator.clipboard.writeText(coupon.code);
    toast({
      title: "Code copied",
      description: `${coupon.code} copied to clipboard.`,
    });
  };

  const handleReveal = (couponId: string) => {
    setShowCode((prev) => ({ ...prev, [couponId]: !prev[couponId] }));
  };

  const handleApply = (coupon: Coupon) => {
    if (isExpired(coupon.expiry)) {
      toast({
        title: "Coupon expired",
        description: "This coupon has expired and cannot be applied.",
        variant: "destructive",
      });
      return;
    }

    if (coupon.minDeposit) {
      toast({
        title: "Eligibility check",
        description: `This coupon requires a minimum deposit of $${coupon.minDeposit.toLocaleString()}. Navigating to marketplace with promo pre-applied...`,
      });
    }

    router.push(`/marketplace?promo=${coupon.code}`);
    toast({
      title: "Promo applied",
      description: `Coupon ${coupon.code} has been applied to your checkout.`,
    });
  };

  const handleRestore = (coupon: Coupon) => {
    toast({
      title: "Restore requested",
      description: `A request to restore ${coupon.code} has been sent to support.`,
    });
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === "percent") {
      return `${coupon.discountValue}% off`;
    }
    return formatMoney(coupon.discountValue, "USD");
  };

  const formatExpiry = (expiry: string) => {
    const days = getDaysUntilExpiry(expiry);
    if (days <= 0) return "Expired";
    if (days === 1) return "Expires tomorrow";
    if (days <= 7) return `Expires in ${days} days`;
    return new Date(expiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getExpiryTone = (expiry: string): "success" | "tertiary" | "error" => {
    const days = getDaysUntilExpiry(expiry);
    if (days <= 0) return "error";
    if (days <= 3) return "error";
    if (days <= 7) return "tertiary";
    return "success";
  };

  const activeTabCoupons = activeTab === "active" ? activeCoupons : usedCoupons;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Promo Wallet"
        description="Your campaign coupons — active offers, eligibility, and redemption history"
      />

      {/* Summary strip */}
      <TerraCard className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Active Offers</p>
            <p className="font-headline text-2xl font-bold text-on-surface">{activeCount}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Potential Savings</p>
            <p className="font-headline text-2xl font-bold text-primary">{formatMoney(totalPotentialSavings, "USD")}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Next Expiring</p>
            <p className="font-headline text-sm font-bold text-on-surface flex items-center gap-1.5">
              {nextExpiring ? (
                <>
                  <Clock className="h-3.5 w-3.5 text-on-surface-variant" />
                  {nextExpiring.code} — {formatExpiry(nextExpiring.expiry)}
                </>
              ) : (
                "None"
              )}
            </p>
          </div>
        </div>
      </TerraCard>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-surface-container-low p-1">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2",
            activeTab === "active"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          <Tag className="h-4 w-4" />
          Active
          {activeCount > 0 && (
            <TerraBadge tone="primary" className="ml-1">{activeCount}</TerraBadge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("used")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2",
            activeTab === "used"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Used & Expired
          <TerraBadge tone="neutral" className="ml-1">{usedCoupons.length}</TerraBadge>
        </button>
      </div>

      {/* Coupon cards */}
      {activeTabCoupons.length === 0 ? (
        <TerraCard className="text-center py-12">
          {activeTab === "active" ? (
            <>
              <Tag className="h-12 w-12 mx-auto text-on-surface-variant/50 mb-4" />
              <p className="font-headline font-semibold text-on-surface mb-1">No active offers</p>
              <p className="text-sm text-on-surface-variant mb-6">
                When campaigns are sent to you, active coupons will appear here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Browse Marketplace
              </button>
            </>
          ) : (
            <>
              <RefreshCw className="h-12 w-12 mx-auto text-on-surface-variant/50 mb-4" />
              <p className="font-headline font-semibold text-on-surface mb-1">No used or expired offers</p>
              <p className="text-sm text-on-surface-variant">
                Your redemption history will appear here after you apply coupons at checkout.
              </p>
            </>
          )}
        </TerraCard>
      ) : (
        <div className="space-y-4">
          {activeTabCoupons.map((coupon) => (
            <TerraCard
              key={coupon.id}
              className={cn(
                "flex flex-col gap-4",
                coupon.status === "expired" && "opacity-60",
                coupon.status === "used" && "opacity-70",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Brand banner */}
                  <div className="h-14 w-14 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)20" }}>
                    <Tag className="h-7 w-7" style={{ color: "var(--primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-headline text-lg font-semibold text-on-surface truncate">{coupon.brand}</h3>
                      <TerraBadge tone={coupon.discountType === "percent" ? "primary" : "secondary"}>
                        {formatDiscount(coupon)}
                      </TerraBadge>
                      <TerraBadge tone={getExpiryTone(coupon.expiry)} dot={coupon.status === "active" && getDaysUntilExpiry(coupon.expiry) <= 7}>
                        {coupon.status === "active" ? formatExpiry(coupon.expiry) : coupon.status === "used" ? "Used" : "Expired"}
                      </TerraBadge>
                    </div>
                    <p className="mt-0.5 text-sm text-on-surface-variant truncate">{coupon.eligibleItems}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 sm:flex-row">
                  {/* Code reveal */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <code className="rounded bg-surface-container px-3 py-2 text-sm font-mono font-bold tabular-nums text-on-surface">
                        {showCode[coupon.id] ? coupon.code : "••••••••"}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReveal(coupon.id)}
                      aria-label={showCode[coupon.id] ? "Hide code" : "Reveal code"}
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      {showCode[coupon.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(coupon)}
                      aria-label="Copy code"
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Primary action */}
                  {coupon.status === "active" && !isExpired(coupon.expiry) ? (
                    <button
                      type="button"
                      onClick={() => handleApply(coupon)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 flex items-center gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Apply
                    </button>
                  ) : coupon.status === "used" ? (
                    <button
                      type="button"
                      onClick={() => coupon.orderId && router.push(`/purchase-history?orderId=${coupon.orderId}`)}
                      className="rounded-xl bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Used on {new Date(coupon.usedAt!).toLocaleDateString()}
                    </button>
                  ) : coupon.status === "expired" ? (
                    <button
                      type="button"
                      className="rounded-xl bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface-variant opacity-50 cursor-not-allowed"
                    >
                      <XCircle className="h-4 w-4" />
                      Expired
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Eligibility hint / conditions expandable */}
              <div className="border-t border-outline-variant/40 pt-3">
                <button
                  type="button"
                  onClick={() => setExpandedCoupon(expandedCoupon === coupon.id ? null : coupon.id)}
                  className="flex items-center justify-between w-full text-left p-0"
                  aria-expanded={expandedCoupon === coupon.id}
                >
                  <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                    {coupon.status === "active" && !isExpired(coupon.expiry) ? (
                      <>
                        <Clock className="h-3 w-3" />
                        Eligibility & conditions
                      </>
                    ) : coupon.status === "used" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        Redemption details
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-error" />
                        Expiry details
                      </>
                    )}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {expandedCoupon === coupon.id ? "Hide" : "Show"}
                  </span>
                </button>

                {expandedCoupon === coupon.id && (
                  <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {coupon.conditions}
                    </p>
                    {coupon.minDeposit && (
                      <p className="flex items-start gap-2 pl-5">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        Minimum deposit required: {formatMoney(coupon.minDeposit, "USD")}
                      </p>
                    )}
                    {coupon.applicableChallenges && coupon.applicableChallenges.length > 0 && (
                      <p className="flex items-start gap-2 pl-5">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        Applicable challenges: {coupon.applicableChallenges.join(", ")}
                      </p>
                    )}
                    {coupon.usedAt && (
                      <p className="flex items-start gap-2 pl-5 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Redeemed on {new Date(coupon.usedAt).toLocaleDateString()} at {new Date(coupon.usedAt).toLocaleTimeString()}
                        {coupon.orderId && <span className="ml-2 font-mono text-xs">({coupon.orderId})</span>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TerraCard>
          ))}
        </div>
      )}
    </div>
  );
}