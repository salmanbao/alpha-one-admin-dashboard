"use client";

/**
 * Checkout — converted from stitch_screens/checkout
 * Order summary + billing details + payment method selection.
 *
 * P1 upgrades: account-size switching (same program, different size),
 * platform selection, paid add-ons, promo codes and crypto payment
 * details. The order summary recalculates live from every choice.
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";

const billingValidators = {
  firstName: (v: string) => (!v.trim() ? "First name is required." : ""),
  lastName: (v: string) => (!v.trim() ? "Last name is required." : ""),
  email: (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
    return "";
  },
  country: (v: string) => (!v.trim() ? "Country is required." : ""),
};

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

/** Account-size label — same formatter as the marketplace cards
 *  (`formatMoney(…).replace(".00", "")`), so a $100,000 account reads
 *  identically on the marketplace, the detail page and checkout
 *  (audit finding #9: the raw `$${(n/1000)}K` string drifted). */
const sizeLabel = (accountSize: number) => formatMoney(accountSize, "USD").replace(".00", "");

const paymentFailureReasons = [
  {
    code: "insufficient_funds",
    title: "Insufficient funds",
    detail: "Your card or account doesn't have enough balance to cover this purchase.",
    fix: "Check your balance, or try a different payment method below.",
  },
  {
    code: "card_declined",
    title: "Card declined",
    detail: "Your bank or card issuer declined this transaction.",
    fix: "Contact your bank to approve the charge, or try another card.",
  },
  {
    code: "expired_card",
    title: "Card expired",
    detail: "The card used for this purchase has passed its expiry date.",
    fix: "Update the expiry date and CVV, or switch to another card or payment method.",
  },
  {
    code: "network_timeout",
    title: "Network timeout",
    detail: "The payment didn't complete because the connection dropped.",
    fix: "Check your internet connection and try again.",
  },
] as const;

type PaymentFailureCode = (typeof paymentFailureReasons)[number]["code"];

/**
 * Payment Failed View — dedicated recovery screen (audit finding #2).
 *
 * Shows the SPECIFIC failure reason (picked from paymentFailureReasons)
 * with its fix, names the exact method/amount/order that failed, and
 * offers genuinely different recovery paths:
 *
 *   • "Try again with the same method" — re-runs the payment with the
 *     failed method still pre-selected (state never left the form).
 *   • "Change payment method" — returns to the form and moves focus to
 *     the Payment method card so another method can be picked.
 *   • "Contact support" — carries the failure context (reason code,
 *     method, amount, order) as query params so the support ticket
 *     composer opens pre-filled.
 */
function PaymentFailedView({
  reason,
  method,
  amountLabel,
  challenge,
  onRetrySameMethod,
  onChangeMethod,
}: {
  reason: PaymentFailureCode;
  method: { label: string; note: string };
  amountLabel: string;
  challenge: string;
  onRetrySameMethod: () => void;
  onChangeMethod: () => void;
}) {
  const reasonInfo = paymentFailureReasons.find((r) => r.code === reason)!;
  // Support link pre-populated with the failure context (finding #2).
  const supportHref = `/support?${new URLSearchParams({
    topic: "payment-failed",
    reason,
    reasonTitle: reasonInfo.title,
    method: method.label,
    amount: amountLabel,
    challenge,
  }).toString()}`;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Payment Failed"
        description={`Your challenge was not purchased — ${challenge}`}
        actions={<TerraBadge tone="error" dot>{reasonInfo.title}</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Failure explanation — what failed, with the exact order */}
          <TerraCard className="border border-error/30 bg-error-container/40">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-headline text-lg font-bold text-on-error-container">
                  {reasonInfo.title}
                </p>
                <p className="text-sm text-on-error-container/80">
                  {reasonInfo.detail} — your account was not charged.
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-on-error-container/70">Order</dt>
                    <dd className="font-semibold text-on-error-container">{challenge}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-on-error-container/70">Amount</dt>
                    <dd className="font-semibold tabular-nums text-on-error-container">{amountLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-on-error-container/70">Payment method</dt>
                    <dd className="font-semibold text-on-error-container">{method.label}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-on-error-container/70">Failure code</dt>
                    <dd className="font-mono text-on-error-container">{reason}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </TerraCard>

          {/* Recovery steps */}
          <TerraCard>
            <TerraSectionTitle title="How to fix this" />
            <ol className="space-y-4">
              {[
                {
                  title: reasonInfo.fix,
                  note: "Most payment failures clear on retry or with a different method.",
                },
                {
                  title: "Try a different payment method",
                  note: "Switch between card, crypto, or PayPal — sometimes a different issuer or network works.",
                },
                {
                  title: "Contact support if it persists",
                  note: "We'll manually verify your payment and provision your challenge.",
                },
              ].map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{s.title}</p>
                    <p className="text-xs text-on-surface-variant">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TerraCard>
        </div>

        {/* Action sidebar */}
        <div className="space-y-6">
          <TerraCard className="flex flex-col gap-2">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Recovery options
            </p>
            <button
              type="button"
              onClick={onRetrySameMethod}
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Try again with {method.label}
            </button>
            <p className="text-center text-[11px] text-on-surface-variant">
              This method stays pre-selected — no re-entry needed.
            </p>
            <button
              type="button"
              onClick={onChangeMethod}
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Change payment method
            </button>
            <p className="text-center text-[11px] text-on-surface-variant">
              Returns to the form and jumps to the payment method choices.
            </p>
            <Link
              href="/marketplace"
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Back to Marketplace
            </Link>
            <Link
              href={supportHref}
              className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Contact support
            </Link>
            <p className="text-center text-[11px] text-on-surface-variant">
              Opens a ticket pre-filled with the reason, method, and amount.
            </p>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Alternative payment" />
            <p className="text-xs text-on-surface-variant">
              You can switch to another payment method from the checkout form. Crypto
              (USDT) has the highest approval rate, and PayPal is instant for most banks.
            </p>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}

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
  // Inline promo error (finding #3) — invalid/expired codes show a
  // persistent, specific message next to the field instead of only a
  // transient toast, and clear as soon as the user edits the code.
  const [promoError, setPromoError] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("card");
  const [processing, setProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState<{ reason: PaymentFailureCode } | null>(null);
  // Deterministic failure simulation — no Math.random(): every 3rd
  // attempt succeeds, failures cycle through the reason catalog so each
  // specific explanation (incl. expired card) is reachable in the demo.
  const paymentAttempts = useRef(0);

  // "Change payment method" from the failure screen: scroll the payment
  // card into view and move focus there (nonce — effect only reruns on
  // explicit retry, no state updates inside the effect).
  const methodCardRef = useRef<HTMLDivElement>(null);
  const [methodFocusNonce, setMethodFocusNonce] = useState(0);
  useEffect(() => {
    if (methodFocusNonce === 0) return;
    methodCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    methodCardRef.current?.focus({ preventScroll: true });
  }, [methodFocusNonce]);

  // Billing details — shared validation (audit #5)
  const [firstName, setFirstName] = useState("Tom");
  const [lastName, setLastName] = useState("Allen");
  const [email, setEmail] = useState("tom.allen@terra.trader");
  const [country, setCountry] = useState("United States");
  const { field: billingField, validateAll: validateBilling } = useFormValidation(billingValidators);

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
      setPromoError(
        code
          ? `“${code}” isn’t a valid promo code. Check for typos, or the code may have expired.`
          : "Enter a promo code first, then press Apply.",
      );
      toast({
        title: "Invalid promo code",
        description: code ? `"${code}" is not a valid code.` : "Enter a code first.",
        variant: "destructive",
      });
      return;
    }
    setPromoError(null);
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
    // Validate billing details before processing (audit #5)
    if (!validateBilling({ firstName, lastName, email, country })) return;
    setProcessing(true);
    // Simulate a payment outcome deterministically: attempts 1, 2 fail
    // (cycling the reason catalog), attempt 3 succeeds.
    setTimeout(() => {
      setProcessing(false);
      paymentAttempts.current += 1;
      const attempt = paymentAttempts.current;
      if (attempt % 3 !== 0) {
        // Pick a real failure reason from the table (finding #2) so the
        // failure screen shows specific, actionable explanations instead
        // of always claiming "card declined".
        const picked =
          paymentFailureReasons[(attempt - 1) % paymentFailureReasons.length];
        setPaymentFailed({ reason: picked.code });
      } else {
        router.push("/purchase-completed");
      }
    }, 700);
  }

  if (paymentFailed) {
    const failedMethod =
      paymentMethods.find((m) => m.id === method) ?? paymentMethods[0];
    return (
      <PaymentFailedView
        reason={paymentFailed.reason}
        method={{ label: failedMethod.label, note: failedMethod.note }}
        amountLabel={formatMoney(total)}
        challenge={`${ch.name} ${sizeLabel(ch.accountSize)}`}
        // Same method, immediate re-pay — its state never left the form,
        // so it is still pre-selected on the checkout underneath.
        onRetrySameMethod={() => {
          setPaymentFailed(null);
          pay();
        }}
        // Different method — back to the form, focused on the choices.
        onChangeMethod={() => {
          setPaymentFailed(null);
          setMethodFocusNonce((n) => n + 1);
          toast({
            title: "Choose a different payment method",
            description: `${failedMethod.label} is still selected — pick another, then pay again.`,
          });
        }}
      />
    );
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
              <FormField
                id="billing-first-name"
                label="First name"
                required
                value={firstName}
                {...billingField("firstName", firstName, setFirstName)}
              />
              <FormField
                id="billing-last-name"
                label="Last name"
                required
                value={lastName}
                {...billingField("lastName", lastName, setLastName)}
              />
              <FormField
                id="billing-email"
                label="Email"
                type="email"
                required
                value={email}
                {...billingField("email", email, setEmail)}
              />
              <FormField
                id="billing-country"
                label="Country"
                required
                value={country}
                {...billingField("country", country, setCountry)}
              />
            </div>
          </TerraCard>

          {/* Payment method — focus target when returning from the
              failure screen via "Change payment method" (finding #2) */}
          <div
            ref={methodCardRef}
            tabIndex={-1}
            aria-label="Payment method — choose how to pay, then press Pay again"
            className="rounded-xl outline-none"
          >
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
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase());
                  // Editing clears the stale error (finding #3)
                  if (promoError) setPromoError(null);
                }}
                placeholder="Promo code"
                aria-label="Promo code"
                aria-invalid={promoError ? true : undefined}
                aria-describedby={promoError ? "promo-error" : undefined}
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
            {/* Inline promo failure (finding #3) — persistent, specific,
                announced to assistive tech; toast alone wasn't enough. */}
            {promoError && (
              <p
                id="promo-error"
                role="alert"
                className="rounded-lg border border-error/40 bg-error-container/40 px-3 py-2 text-xs font-semibold text-on-error-container"
              >
                {promoError}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPromoError(null);
                    setPromoInput("");
                  }}
                  className="underline underline-offset-2 hover:text-on-error-container"
                >
                  Clear and try another code
                </button>
              </p>
            )}
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
