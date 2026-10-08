"use client";

/**
 * Checkout — converted from stitch_screens/checkout
 * Order summary + billing details + payment method selection.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

const paymentMethods = [
  { id: "card", label: "Credit / Debit Card", note: "Visa, Mastercard, Amex" },
  { id: "crypto", label: "Crypto (USDT)", note: "TRC-20 / ERC-20" },
  { id: "paypal", label: "PayPal", note: "Buyer protection" },
];

export function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const ch =
    terraChallenges.find((c) => c.id === params.get("id")) ?? terraChallenges[1];
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);

  function pay() {
    setProcessing(true);
    setTimeout(() => router.push("/purchase-completed"), 700);
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader title="Checkout" description={`Order for ${ch.name}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form column */}
        <div className="space-y-6 lg:col-span-3">
          <TerraCard>
            <TerraSectionTitle title="Billing details" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["First name", "Tom"],
                ["Last name", "Allen"],
                ["Email", "tom.allen@terra.trader"],
                ["Country", "United States"],
              ].map(([label, value]) => (
                <label key={label} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {label}
                  </span>
                  <input
                    defaultValue={value}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              ))}
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Payment method" />
            <div className="space-y-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                    method === m.id
                      ? "border-primary bg-primary-fixed/40"
                      : "border-outline-variant/60 hover:bg-surface-container-low",
                  )}
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{m.label}</p>
                    <p className="text-xs text-on-surface-variant">{m.note}</p>
                  </div>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2",
                      method === m.id ? "border-primary bg-primary" : "border-outline-variant",
                    )}
                  >
                    {method === m.id && <span className="h-2 w-2 rounded-full bg-on-primary" />}
                  </span>
                </button>
              ))}
            </div>
          </TerraCard>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <TerraCard className="sticky top-24 flex flex-col gap-4">
            <TerraSectionTitle title="Order summary" />
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {ch.name} {formatMoney(ch.accountSize, "USD").replace(".00", "")}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {ch.tag === "instant" ? "Instant funding" : "Two-phase evaluation"}
                </p>
              </div>
              {ch.popular && <TerraBadge tone="tertiary">Popular</TerraBadge>}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Challenge fee</span>
                <span className="font-semibold text-on-surface">{formatMoney(ch.price)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Processing fee</span>
                <span className="font-semibold text-on-surface">$0.00</span>
              </div>
              <div className="flex justify-between border-t border-outline-variant/40 pt-2 text-base font-bold text-on-surface">
                <span>Total</span>
                <span>{formatMoney(ch.price)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={pay}
              disabled={processing}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {processing ? "Processing…" : `Pay ${formatMoney(ch.price)}`}
            </button>
            <p className="text-center text-[11px] text-on-surface-variant">
              By continuing you agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms &amp; Policies
              </Link>
              .
            </p>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
