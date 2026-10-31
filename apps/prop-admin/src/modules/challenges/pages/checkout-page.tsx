"use client";

/**
 * Checkout — order review + payment for a new challenge.
 *
 * Audit finding #9 (HIGH): payment failure had no recovery path — the
 * Pay button always toasted "processing… (demo)" and navigated to the
 * success screen. Failures now route to a dedicated panel that explains
 * the SPECIFIC reason (insufficient funds, card declined, expired card,
 * network timeout), lists actionable fix steps, and offers:
 *
 *   • "Try again" — re-runs the payment with the same method (its
 *     state never left the form, so it stays pre-selected).
 *   • "Change payment method" — returns to the form, scrolls the
 *     Payment method card into view and moves focus there.
 *   • "Contact support" — opens the contact form with the failure
 *     context (reason, method, amount, order) passed as params.
 */

import { useEffect, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/components/platform/status";
import { ShoppingCart, ShieldCheck, ArrowRight, Check, AlertTriangle, RotateCcw, CreditCard, LifeBuoy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const paymentMethods = [
  { id: "card", label: "Credit Card" },
  { id: "crypto", label: "Crypto (USDT)" },
  { id: "paypal", label: "PayPal" },
  { id: "skrill", label: "Skrill" },
] as const;

/** Specific failure reasons — what happened and how to fix it (finding #9). */
const paymentFailureReasons = [
  {
    code: "insufficient_funds",
    title: "Insufficient funds",
    detail: "Your card or account doesn't have enough balance to cover this purchase.",
    fix: "Check your balance, or pick a different payment method below.",
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
    detail: "The expiry date on the card has passed, so the issuer rejected the charge.",
    fix: "Update the expiry date (and CVC) to the current values on your card, then pay again.",
  },
  {
    code: "network_timeout",
    title: "Network timeout",
    detail: "The payment didn't complete because the connection dropped.",
    fix: "Check your internet connection and try again — your card was not charged.",
  },
] as const;

type PaymentFailureCode = (typeof paymentFailureReasons)[number]["code"];

/* ------------------------------------------------------------------ */
/* Payment failure panel — dedicated recovery screen (finding #9)      */
/* ------------------------------------------------------------------ */

function PaymentFailurePanel({
  reason,
  methodLabel,
  amountLabel,
  orderLabel,
  onRetrySameMethod,
  onChangeMethod,
  onContactSupport,
}: {
  reason: PaymentFailureCode;
  methodLabel: string;
  amountLabel: string;
  orderLabel: string;
  onRetrySameMethod: () => void;
  onChangeMethod: () => void;
  onContactSupport: () => void;
}) {
  const info = paymentFailureReasons.find((r) => r.code === reason)!;

  return (
    <Card className="border-rose-500/40 bg-rose-50/60 dark:bg-rose-950/20">
      <CardContent className="space-y-4 p-4">
        {/* What failed */}
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Payment failed — {info.title}</p>
              <Badge variant="outline" className="font-mono text-[10px] text-rose-600 dark:text-rose-400">{reason}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{info.detail} — your account was not charged.</p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-medium">{orderLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium tabular-nums">{amountLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-medium">{methodLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Failure code</dt>
                <dd className="font-mono">{reason}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* How to fix it */}
        <div className="rounded-md border border-rose-500/20 bg-background/60 p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">How to fix this</p>
          <ol className="space-y-1.5">
            {[
              { title: info.fix, note: "Most failures clear on retry or with a different method." },
              { title: "Try a different payment method", note: "Switch between card, crypto, PayPal, or Skrill — a different issuer or network often works." },
              { title: "Contact support if it persists", note: "We'll verify the payment manually and provision your challenge." },
            ].map((s, i) => (
              <li key={s.title} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Recovery actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRetrySameMethod}>
            <RotateCcw className="mr-1 h-4 w-4" /> Try again with {methodLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={onChangeMethod}>
            <CreditCard className="mr-1 h-4 w-4" /> Change payment method
          </Button>
          <Button size="sm" variant="outline" onClick={onContactSupport}>
            <LifeBuoy className="mr-1 h-4 w-4" /> Contact support
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Your selection stays as-is — no re-entry needed. “Change payment method” jumps to the method choices.
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CheckoutPage() {
  const { runtime, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const [method, setMethod] = useState("card");
  const [promo, setPromo] = useState("");
  const challenge = { name: "2-Step Standard", accountSize: 100000, price: 990 };
  const discount = promo.toUpperCase() === "WELCOME10" ? Math.round(challenge.price * 0.1) : 0;
  const tax = Math.round((challenge.price - discount) * 0.05);
  const total = challenge.price - discount + tax;

  const [processing, setProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState<{ reason: PaymentFailureCode } | null>(null);

  // "Change payment method" from the failure panel: scroll the payment
  // card into view and move focus there (nonce — effect only reruns on
  // explicit action, no state updates inside the effect).
  const methodCardRef = useRef<HTMLDivElement>(null);
  const [methodFocusNonce, setMethodFocusNonce] = useState(0);
  useEffect(() => {
    if (methodFocusNonce === 0) return;
    methodCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    methodCardRef.current?.focus({ preventScroll: true });
  }, [methodFocusNonce]);

  const methodLabel =
    paymentMethods.find((m) => m.id === method)?.label ?? paymentMethods[0].label;
  const amountLabel = formatCurrency(total, currency);
  const orderLabel = `${challenge.name} · ${formatCurrency(challenge.accountSize, currency)}`;

  function pay() {
    setPaymentFailed(null);
    setProcessing(true);
    // Simulate the payment provider (demo): ~1 in 3 attempts fails.
    setTimeout(() => {
      setProcessing(false);
      if (Math.random() > 0.3) {
        // Real reason from the table so the panel explains the specific
        // failure instead of a generic error.
        const picked =
          paymentFailureReasons[Math.floor(Math.random() * paymentFailureReasons.length)];
        setPaymentFailed({ reason: picked.code });
      } else {
        navigate("purchase-completed");
      }
    }, 1200);
  }

  return (
    <Page>
      <PageHeader title="Checkout" description="Review your order and complete your purchase." icon={ShoppingCart} />
      <PageContent>
        {/* Dedicated failure recovery — shown above the form (finding #9) */}
        {paymentFailed && (
          <div className="mb-4">
            <PaymentFailurePanel
              reason={paymentFailed.reason}
              methodLabel={methodLabel}
              amountLabel={amountLabel}
              orderLabel={orderLabel}
              // Same method, immediate re-pay — its state never left the
              // form, so it is still pre-selected underneath.
              onRetrySameMethod={() => pay()}
              // Different method — back to the form, focused on choices.
              onChangeMethod={() => {
                setPaymentFailed(null);
                setMethodFocusNonce((n) => n + 1);
                toast({
                  title: "Choose a different payment method",
                  description: `${methodLabel} is still selected — pick another, then pay again.`,
                });
              }}
              // Support form with the failure context attached.
              onContactSupport={() => {
                const info = paymentFailureReasons.find((r) => r.code === paymentFailed.reason)!;
                navigate("support-contact", {
                  topic: "payment-failed",
                  reason: paymentFailed.reason,
                  reasonTitle: info.title,
                  method: methodLabel,
                  amount: amountLabel,
                  order: orderLabel,
                });
                toast({
                  title: "Support contact opened",
                  description: "The form references this failed payment: " + info.title + ".",
                });
              }}
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            {/* Order summary */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Order summary</span></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Challenge</span><span className="font-medium">{challenge.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account size</span><span className="font-medium">{formatCurrency(challenge.accountSize, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{formatCurrency(challenge.price, currency)}</span></div>
                {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount (WELCOME10)</span><span>-{formatCurrency(discount, currency)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes & fees</span><span className="font-medium">{formatCurrency(tax, currency)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
              </CardContent>
            </Card>

            {/* Payment method — focus target when returning from the
                failure panel via "Change payment method" (finding #9) */}
            <div
              ref={methodCardRef}
              tabIndex={-1}
              aria-label="Payment method — choose how to pay, then press Pay again"
              className="rounded-md outline-none"
            >
              <Card>
                <CardHeader className="pb-2"><span className="text-sm font-medium">Payment method</span></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((m) => (
                      <button key={m.id} onClick={() => setMethod(m.id)} className={`flex items-center gap-2 rounded-md border p-3 text-sm transition ${method === m.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                        {method === m.id && <Check className="h-3 w-3 text-emerald-500" />}{m.label}
                      </button>
                    ))}
                  </div>
                  {method === "card" && <div className="space-y-2">
                    <div><Label className="text-xs">Card number</Label><Input placeholder="4242 4242 4242 4242" className="text-sm" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Expiry</Label><Input placeholder="12/28" className="text-sm" /></div>
                      <div><Label className="text-xs">CVC</Label><Input placeholder="123" className="text-sm" /></div>
                    </div>
                  </div>}
                </CardContent>
              </Card>
            </div>

            {/* Promo code */}
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <Input placeholder="Promo code (try WELCOME10)" value={promo} onChange={(e) => setPromo(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" onClick={() => toast({ title: discount > 0 ? "Promo applied!" : "Invalid code", description: discount > 0 ? `10% discount applied` : "Try WELCOME10" })}>Apply</Button>
              </CardContent>
            </Card>
          </div>

          {/* Trust + CTA */}
          <div className="space-y-4">
            <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Secure payment</p>
                <p className="text-xs text-muted-foreground">Your payment is processed via encrypted connection. We never store your card details.</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>· Challenge terms accepted at checkout</p>
                  <p>· Refund available before account activation</p>
                  <p>· 30-day evaluation period starts on first trade</p>
                </div>
              </CardContent>
            </Card>
            <Button size="lg" className="w-full" onClick={pay} disabled={processing}>
              {processing
                ? "Processing payment…"
                : paymentFailed
                  ? `Try again — ${amountLabel}`
                  : `Pay ${amountLabel} & Start Challenge`}
              {!processing && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {paymentFailed
                ? `Retries with ${methodLabel} — switch methods on the left if it fails again.`
                : "You'll only be charged once — failed attempts are never billed."}
            </p>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
