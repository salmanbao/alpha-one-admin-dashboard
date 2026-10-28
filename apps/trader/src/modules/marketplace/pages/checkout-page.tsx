"use client";

/**
 * Checkout — converted from stitch_screens/checkout
 * Order summary + billing details + payment method selection.
 *
 * P1 upgrades: account-size switching (same program, different size),
 * platform selection, paid add-ons, promo codes and crypto payment
 * details. The order summary recalculates live from every choice.
 */

import { useMemo, useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

const paymentMethods = [
  { id: "card", label: "Credit / Debit Card", note: "Visa, Mastercard, Amex" },
  { id: "crypto", label: "Crypto (USDT)", note: "TRC-20 / ERC-20" },
  { id: "paypal", label: "PayPal", note: "Buyer protection" },
] as const;

/** Optional paid extras — priced once, applied to the order total. */
const addons = [
  {
    id: "swing",
    label: "Swing trading pass",
    note: "Hold positions over the weekend with zero swap adjustments.",
    price: 49,
  },
  {
    id: "double-payout",
    label: "Double payout cycle",
    note: "Request payouts weekly instead of bi-weekly once funded.",
    price: 79,
  },
  {
    id: "coach",
    label: "1:1 onboarding call",
    note: "45 minutes with a risk manager to set up your trading plan.",
    price: 99,
  },
] as const;

/** Promo codes accepted in this demo. */
const promos: Record<string, { percent: number; label: string }> = {
  TERRA10: { percent: 10, label: "10% off" },
  FLASH25: { percent: 25, label: "25% off Flash accounts" },
};

const sizeLabel = (accountSize: number) =>
  `$${(accountSize / 1000).toLocaleString("en-US")}K`;

export function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initial =
    terraChallenges.find((c) => c.id === params.get("id")) ?? terraChallenges[1];

  // Order configuration — everything the trader can change before paying.
  const [challengeId, setChallengeId] = useState(initial.id);
  const ch = terraChallenges.find((c) => c.id === challengeId) ?? initial;
  // Same program, other account sizes (e.g. Pro 50K / 100K / 200K).
  const sizeOptions = useMemo(
    () => terraChallenges.filter((c) => c.name === ch.name),
    [ch.name],
  );
  const [platform, setPlatform] = useState(initial.platforms[0]);
  // Switching size may drop the chosen platform (e.g. Pro 50K has no
  // DXtrade) — fall back to the first available one.
  const activePlatform = ch.platforms.includes(platform) ? platform : ch.platforms[0];
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [method, setMethod] = useState<string>("card");
  const [processing, setProcessing] = useState(false);

  const addonsTotal = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const subtotal = ch.price + addonsTotal;
  const discount = promo ? Math.round(subtotal * (promo.percent / 100) * 100) / 100 : 0;
  const total = subtotal - discount;

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const found = promos[code];
    if (!found) {
      setPromo(null);
      toast({
        title: "Invalid promo code",
        description: code ? `"${code}" is not a valid code.` : "Enter a code first.",
        variant: "destructive",
      });
      return;
    }
    setPromo({ code, percent: found.percent });
    toast({
      title: "Promo applied",
      description: `${code} — ${found.label} your order.`,
    });
  };

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );

  function pay() {
    setProcessing(true);
    setTimeout(() => router.push("/purchase-completed"), 700);
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader title="Checkout" description={`Order for ${ch.name} — ${activePlatform}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Account size */}
          <TerraCard>
            <TerraSectionTitle
              title="Account size"
              description={`Choose the ${ch.name} size — rules scale with the account.`}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sizeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setChallengeId(opt.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center transition-all",
                    opt.id === ch.id
                      ? "border-primary bg-primary-fixed/40"
                      : "border-outline-variant/60 hover:bg-surface-container-low",
                  )}
                >
                  <span className="block text-sm font-bold text-on-surface">
                    {sizeLabel(opt.accountSize)}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    {formatMoney(opt.price)}
                  </span>
                </button>
              ))}
            </div>
          </TerraCard>

          {/* Platform */}
          <TerraCard>
            <TerraSectionTitle
              title="Trading platform"
              description="Credentials are provisioned for the platform you pick."
            />
            <div className="grid grid-cols-3 gap-2">
              {ch.platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm font-bold transition-all",
                    activePlatform === p
                      ? "border-primary bg-primary-fixed/40 text-on-surface"
                      : "border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </TerraCard>

          {/* Add-ons */}
          <TerraCard>
            <TerraSectionTitle title="Add-ons" description="Optional extras for this order." />
            <div className="space-y-2">
              {addons.map((a) => {
                const on = selectedAddons.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAddon(a.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                      on
                        ? "border-primary bg-primary-fixed/40"
                        : "border-outline-variant/60 hover:bg-surface-container-low",
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {a.label}{" "}
                        <span className="font-semibold text-on-surface-variant">
                          · {formatMoney(a.price)}
                        </span>
                      </p>
                      <p className="text-xs text-on-surface-variant">{a.note}</p>
                    </div>
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        on ? "border-primary bg-primary" : "border-outline-variant",
                      )}
                    >
                      {on && <span className="text-[10px] font-bold text-on-primary">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </TerraCard>

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
            {method === "crypto" && (
              <div className="mt-3 space-y-2 rounded-xl bg-surface-container-low p-4 text-xs">
                <p className="font-bold text-on-surface">
                  Send exactly {formatMoney(total)} in USDT
                </p>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Network</span>
                  <strong className="text-on-surface">TRC-20 (Tron) — preferred</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Wallet</span>
                  <strong className="font-mono text-on-surface">TXyz…9f2c</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Confirmation</span>
                  <strong className="text-on-surface">~2 min after 19 confirmations</strong>
                </div>
                <p className="text-on-surface-variant">
                  The challenge is provisioned automatically once the payment confirms. Rate
                  locks for 15 minutes.
                </p>
              </div>
            )}
          </TerraCard>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <TerraCard className="sticky top-24 flex flex-col gap-4">
            <TerraSectionTitle title="Order summary" />
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {ch.name} {sizeLabel(ch.accountSize)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {ch.tag === "instant" ? "Instant funding" : "Two-phase evaluation"} • {activePlatform}
                </p>
              </div>
              {ch.popular && <TerraBadge tone="tertiary">Popular</TerraBadge>}
            </div>

            {/* Promo code */}
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                aria-label="Promo code"
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-semibold uppercase tracking-wide outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={applyPromo}
                className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
              >
                Apply
              </button>
            </div>
            {promo && (
              <p className="rounded-lg bg-primary-fixed/40 px-3 py-2 text-xs font-bold text-on-primary-fixed-variant">
                ✓ {promo.code} applied — {promo.percent}% off
              </p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Challenge fee</span>
                <span className="font-semibold text-on-surface">{formatMoney(ch.price)}</span>
              </div>
              {addons
                .filter((a) => selectedAddons.includes(a.id))
                .map((a) => (
                  <div key={a.id} className="flex justify-between text-on-surface-variant">
                    <span>{a.label}</span>
                    <span className="font-semibold text-on-surface">
                      {formatMoney(a.price)}
                    </span>
                  </div>
                ))}
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount ({promo?.code})</span>
                  <span className="font-semibold">−{formatMoney(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-on-surface-variant">
                <span>Processing fee</span>
                <span className="font-semibold text-on-surface">$0.00</span>
              </div>
              <div className="flex justify-between border-t border-outline-variant/40 pt-2 text-base font-bold text-on-surface">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={pay}
              disabled={processing}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {processing ? "Processing…" : `Pay ${formatMoney(total)}`}
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
