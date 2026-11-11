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
import { recordPurchase } from "@/lib/purchases-store";
import { readSession } from "@/lib/session-store";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";
import {
  billingFieldLabels,
  billingFieldOrder,
  billingValidators,
  bumpPayAttempt,
  clearCheckoutDraft,
  paymentFailureReasons,
  paymentMethods,
  readCheckoutDraft,
  resetPayAttempts,
  writeCheckoutDraft,
  writeCheckoutFailure,
  type PaymentMethodId,
} from "@/lib/checkout/checkout-recovery";
import {
  getPromoDiscount,
  evaluatePromoEligibility,
  promoCatalogByCode,
  type PromoCatalogEntry,
} from "@/lib/promos/promo-catalog";

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

/** Account-size label — same formatter as the marketplace cards
 *  (`formatMoney(…).replace(".00", "")`), so a $100,000 account reads
 *  identically on the marketplace, the detail page and checkout
 *  (audit finding #9: the raw `$${(n/1000)}K` string drifted). */
const sizeLabel = (accountSize: number) => formatMoney(accountSize, "USD").replace(".00", "");

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
  // Unified promo: read from catalog, show inline error + alternatives.
  const [promo, setPromo] = useState<PromoCatalogEntry | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethodId>("card");
  const [processing, setProcessing] = useState(false);
  // Billing submit summary (finding #1) — set when a submit fails
  // validation, cleared on the next clean submit. The block rendered
  // from it is derived from the live field errors, so entries drop out
  // as each field is fixed.
  const [billingSubmitted, setBillingSubmitted] = useState(false);
  const [billingFocusNonce, setBillingFocusNonce] = useState(0);

  // "Change payment method" from the failure route (?focus=method):
  // start the nonce above zero so the effect below scrolls the payment
  // card into view and moves focus there on mount.
  const methodCardRef = useRef<HTMLDivElement>(null);
  const [methodFocusNonce, setMethodFocusNonce] = useState(() =>
    params.get("focus") === "method" ? 1 : 0,
  );
  useEffect(() => {
    if (methodFocusNonce === 0) return;
    methodCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    methodCardRef.current?.focus({ preventScroll: true });
  }, [methodFocusNonce]);

  // Focus the first invalid billing field after a failed submit so
  // keyboard / screen-reader users land on the problem (finding #5).
  // The effect runs after render, when validateAll has applied
  // aria-invalid to the inputs.
  useEffect(() => {
    if (billingFocusNonce === 0) return;
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [billingFocusNonce]);

  // Billing details — shared validation (audit #5). Prefilled from the
  // draft saved by a failed submit, so returning from
  // /checkout-validation restores exactly what was typed (finding #1).
  const [draft] = useState(() => readCheckoutDraft());
  const [firstName, setFirstName] = useState(() => draft?.firstName ?? "Tom");
  const [lastName, setLastName] = useState(() => draft?.lastName ?? "Allen");
  const [email, setEmail] = useState(() => draft?.email ?? "tom.allen@terra.trader");
  const [country, setCountry] = useState(() => draft?.country ?? "United States");

  // SF-06: auto-apply promo from ?promo={code} deep-link (promo-wallet push).
  // Prefills the manual entry field and applies — no new state model.
  useEffect(() => {
    const code = params.get("promo")?.trim().toUpperCase();
    if (code && !promo) {
      setPromoInput(code);
      const found = promoCatalogByCode[code];
      if (found) {
        // Check eligibility for this challenge
        const { eligible, reason } = evaluatePromoEligibility(code, ch.id);
        if (eligible) {
          setPromoError(null);
          setPromo(found);
          toast({ title: "Promo applied", description: `${code} — ${found.label} your order.` });
        } else {
          setPromoError(`“${code}” isn't valid for this challenge: ${reason}`);
          toast({ title: "Promo not eligible", description: `"${code}" doesn't apply to this challenge.`, variant: "destructive" });
        }
      } else {
        setPromoError(`“${code}” isn't a valid promo code. Check for typos, or the code may have expired.`);
        toast({ title: "Invalid promo code", description: `"${code}" is not a valid code.`, variant: "destructive" });
      }
    }
  }, [params.get("promo")]);
  const {
    field: billingField,
    validateAll: validateBilling,
    errors: billingErrors,
  } = useFormValidation(billingValidators);
  // Fields currently failing — drives the submit summary block below.
  const invalidBilling = billingFieldOrder.filter((f) => billingErrors[f]);

  const addonsTotal = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const subtotal = ch.price + addonsTotal;
  const discount = promo ? Math.round(subtotal * (promo.discountValue / 100) * 100) / 100 : 0;
  const total = subtotal - discount;

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const found = promoCatalogByCode[code];
    if (!found) {
      setPromo(null);
      setPromoError(
        code
          ? `“${code}” isn't a valid promo code. Check for typos, or the code may have expired.`
          : "Enter a promo code first, then press Apply.",
      );
      toast({
        title: "Invalid promo code",
        description: code ? `"${code}" is not a valid code.` : "Enter a code first.",
        variant: "destructive",
      });
      return;
    }
    // Check eligibility for this challenge
    const { eligible, reason } = evaluatePromoEligibility(code, ch.id);
    if (!eligible) {
      setPromo(null);
      setPromoError(`“${code}” isn't valid for this challenge: ${reason}`);
      toast({
        title: "Promo not eligible",
        description: `"${code}" doesn't apply to this challenge.`,
        variant: "destructive",
      });
      return;
    }
    setPromoError(null);
    setPromo(found);
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
    const values = { firstName, lastName, email, country };
    if (!validateBilling(values)) {
      // Save the failed draft for /checkout-validation, raise the
      // inline summary, and move focus to the first invalid field
      // (findings #1 and #5). Nothing is charged — and no pay attempt
      // is consumed — while a field is invalid.
      writeCheckoutDraft(values);
      setBillingSubmitted(true);
      setBillingFocusNonce((n) => n + 1);
      return;
    }
    // Every check passed — the saved draft is stale now.
    clearCheckoutDraft();
    setBillingSubmitted(false);
    setProcessing(true);
    // Simulate a payment outcome deterministically — no Math.random():
    // attempts 1, 2 fail (cycling the reason catalog), attempt 3
    // succeeds. The counter lives in sessionStorage so the cycle
    // survives the round-trip to /checkout-failure and back, and it
    // resets once a payment goes through.
    setTimeout(() => {
      setProcessing(false);
      const attempt = bumpPayAttempt();
      if (attempt % 3 !== 0) {
        // Pick a real failure reason from the table (finding #2) so
        // the recovery route shows a specific, actionable explanation
        // instead of always claiming "card declined".
        const picked = paymentFailureReasons[(attempt - 1) % paymentFailureReasons.length];
        writeCheckoutFailure({
          reason: picked.code,
          methodId: method,
          amountLabel: formatMoney(total),
          challenge: `${ch.name} ${sizeLabel(ch.accountSize)}`,
          attempt,
        });
        router.push("/checkout-failure");
      } else {
        resetPayAttempts();
        // R4-09: persist the order BEFORE the confirmation screen — this
        // is the payment moment, so the purchases store, the operator
        // queue and the invoice all start from this record.
        const orderId = String(Date.now()).slice(-6);
        recordPurchase({
          orderId,
          program: `${ch.name} $${Math.round(ch.accountSize / 1000)}K`,
          challengeId: ch.id,
          amount: total,
          currency: "USD",
          method: paymentMethods.find((m) => m.id === method)?.label ?? "Card",
          applicantName: readSession()?.displayName ?? null,
        });
        router.push(
          `/purchase-completed?orderId=${orderId}&challengeId=${ch.id}`,
        );
      }
    }, 700);
  }

  // Auto-retry from the failure route (?retry=1) — re-runs the payment
  // once, with the failed method still pre-selected. Deferred a tick so
  // the form paints first (and satisfies react-hooks/set-state-in-effect).
  const autoRetryUsed = useRef(false);
  useEffect(() => {
    if (params.get("retry") !== "1" || autoRetryUsed.current) return;
    autoRetryUsed.current = true;
    const t = setTimeout(() => pay(), 400);
    return () => clearTimeout(t);
  }, []);

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
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Trading platform">
              {ch.platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={activePlatform === p}
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
            {/* Submit-time billing summary (finding #1) — every field
                that failed the last Pay press, with a link to the
                dedicated validation screen. Derived from the live
                errors, so fixed fields drop out immediately. */}
            {billingSubmitted && invalidBilling.length > 0 && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-error/40 bg-error-container/40 px-4 py-3 text-xs"
              >
                <p className="font-bold text-on-error-container">
                  {invalidBilling.length === 1
                    ? "1 billing field needs attention"
                    : `${invalidBilling.length} billing fields need attention`}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {invalidBilling.map((field) => (
                    <li key={field} className="text-on-error-container/90">
                      <span className="font-semibold">{billingFieldLabels[field]}:</span>{" "}
                      {billingErrors[field]}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/checkout-validation"
                  className="mt-2 inline-block font-semibold text-on-error-container underline underline-offset-2"
                >
                  See how we check these details →
                </Link>
              </div>
            )}
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
            <div className="space-y-2" role="group" aria-label="Payment options">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={method === m.id}
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
                // Keyboard (finding #6) — Enter applies the code without
                // needing to tab to the Apply button.
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyPromo();
                  }
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
                </button>{" "}
                {/* Recovery route for rejected codes (finding #1) —
                    explains why codes fail and lists the live ones. */}
                <Link
                  href={`/promo-error?code=${encodeURIComponent(promoInput.trim().toUpperCase())}`}
                  className="underline underline-offset-2 hover:text-on-error-container"
                >
                  Why was it rejected?
                </Link>
              </p>
            )}
            {promo && (
              <p className="rounded-lg bg-primary-fixed/40 px-3 py-2 text-xs font-bold text-on-primary-fixed-variant">
                ✓ {promo.code} applied — {promo.discountValue}% off
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
              Demo environment: payment attempts are simulated; the first two declines are scripted.
            </p>
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
