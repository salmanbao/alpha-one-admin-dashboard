"use client";

/**
 * Promo Error — promo/discount-code failure recovery route
 * (audit finding #1).
 *
 * The checkout shows an inline error next to the promo field, but the
 * journey map had no screen that explains WHY a code was rejected and
 * offers alternatives. This route does both:
 *
 *   • names the entered code (from ?code=) and walks through the
 *     reasons codes get rejected (typo / case, expired, wrong product,
 *     minimum spend, not combinable);
 *   • lists the codes that DO work right now — the same catalog the
 *     checkout applies (TERRA10, FLASH25) — so the trader has a
 *     working alternative instead of a dead end;
 *   • links back to the checkout (promo field focused by the trader)
 *     and to support.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { promos } from "@/lib/checkout/checkout-recovery";

const rejectionReasons = [
  {
    title: "Typo or wrong case",
    note: "Codes are compared in upper case — “terra10” and “TERRA10” are the same code, but “TERRA1O” (letter O) is not.",
  },
  {
    title: "Expired or rotated",
    note: "Promo codes are campaign-scoped. Once a campaign ends the code stops working, even if it looks valid.",
  },
  {
    title: "Not eligible for this order",
    note: "Some codes only apply to specific account sizes or “Flash” products — a code for one challenge won't discount another.",
  },
  {
    title: "Minimum spend not met",
    note: "The order total (after add-ons) must clear the campaign minimum before the discount applies.",
  },
  {
    title: "Not combinable",
    note: "Only one promo code per order — the first valid code wins.",
  },
];

export function PromoErrorPage() {
  const params = useSearchParams();
  const code = (params.get("code") ?? "").trim().toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <TerraPageHeader
        title="Promo code not applied"
        description={
          code
            ? `“${code}” didn't change your order total — here's why, and what does work.`
            : "No code was entered — here's how promo codes work and which ones are live right now."
        }
        actions={<TerraBadge tone="error" dot>Discount not applied</TerraBadge>}
      />

      {code && (
        <TerraCard className="border border-error/30 bg-error-container/40">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-headline text-lg font-bold text-on-error-container">
                “{code}” isn't a valid code for this order
              </p>
              <p className="text-sm text-on-error-container/80">
                Your order total is unchanged and nothing was charged — a rejected code never
                blocks checkout.
              </p>
            </div>
          </div>
        </TerraCard>
      )}

      <TerraCard>
        <TerraSectionTitle title="Why codes get rejected" />
        <ol className="space-y-3">
          {rejectionReasons.map((r, i) => (
            <li key={r.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">{r.title}</p>
                <p className="text-xs text-on-surface-variant">{r.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle
          title="Codes that work right now"
          description="Enter the code in the Promo code box at checkout, then press Apply (or Enter)."
        />
        <div className="space-y-2">
          {Object.entries(promos).map(([promoCode, info]) => (
            <div
              key={promoCode}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                promoCode === code
                  ? "border-error/40 bg-error-container/20"
                  : "border-outline-variant/60"
              }`}
            >
              <div>
                <p className="text-sm font-bold text-on-surface">
                  <span className="font-mono tracking-wide">{promoCode}</span>{" "}
                  <span className="font-semibold text-on-surface-variant">— {info.label}</span>
                </p>
                <p className="text-xs text-on-surface-variant">
                  {promoCode === code
                    ? "This is the code you just tried — it isn't active for this order."
                    : "Active for this checkout."}
                </p>
              </div>
              <TerraBadge tone={promoCode === code ? "error" : "tertiary"}>
                {promoCode === code ? "Rejected" : "Live"}
              </TerraBadge>
            </div>
          ))}
        </div>
      </TerraCard>

      <div className="flex flex-col gap-2">
        <Link
          href="/checkout"
          className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Back to checkout
        </Link>
        <p className="text-center text-[11px] text-on-surface-variant">
          The promo field is in the order summary — clear the old code, enter a live one, and
          press Apply.
        </p>
        <Link
          href={`/support?${new URLSearchParams({
            topic: "promo-code",
            ...(code ? { code } : {}),
          }).toString()}`}
          className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Contact support
        </Link>
        <p className="text-center text-[11px] text-on-surface-variant">
          If a live code still doesn&apos;t apply, we&apos;ll check the campaign rules on your
          order.
        </p>
      </div>
    </div>
  );
}
