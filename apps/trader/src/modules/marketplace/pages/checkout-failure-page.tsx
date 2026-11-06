"use client";

/**
 * Checkout Failure — dedicated payment-failure recovery route
 * (audit finding #1).
 *
 * The failure state used to live only inside the checkout form, so the
 * route-based probe found no screen for it. This page is the recovery
 * screen the journey map asked for:
 *
 *   • names the SPECIFIC failure reason (picked from the shared
 *     reason catalog) with its fix, and the exact order that failed
 *     (method, amount, challenge) — context handed over by the
 *     checkout via sessionStorage before it navigated here;
 *   • "Try again with the same method" → /checkout?retry=1 re-runs the
 *     payment with the failed method still pre-selected (auto-pay);
 *   • "Change payment method" → /checkout?focus=method returns to the
 *     form and moves focus to the payment-method choices;
 *   • "Contact support" carries the failure context as query params so
 *     the ticket composer opens pre-filled.
 *
 * Context is read after a deferred gate so the first paint matches SSR
 * (same pattern as the outage-recovery banner).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { toast } from "@/hooks/use-toast";
import {
  paymentFailureReasons,
  paymentMethods,
  readCheckoutFailure,
  type CheckoutFailureContext,
} from "@/lib/checkout/checkout-recovery";

/** undefined = context still loading (first paint, matches SSR),
 *  null = no failed attempt recorded (direct URL entry). */
type CtxState = CheckoutFailureContext | null | undefined;

export function CheckoutFailurePage() {
  const router = useRouter();
  const [failure, setFailure] = useState<CtxState>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Deferred gate — first paint matches SSR, then the session context
  // lands (react-hooks/set-state-in-effect wants the timer).
  useEffect(() => {
    const t = setTimeout(() => setFailure(readCheckoutFailure()), 0);
    return () => clearTimeout(t);
  }, []);

  // Move focus to the heading once the real content mounts (the first
  // paint is the skeleton) so keyboard / screen-reader users land on
  // the failure explanation, not mid-page (finding #1/#5).
  useEffect(() => {
    if (failure === undefined) return;
    headingRef.current?.focus();
  }, [failure]);

  if (failure === undefined) return <PageSkeleton />;

  // Direct entry (bookmark / refresh after storage was cleared) —
  // graceful dead end with a way forward instead of an empty page.
  if (failure === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-headline text-2xl font-bold text-on-surface outline-none"
          >
            No recent payment attempt
          </h1>
          <p className="text-sm text-on-surface-variant">
            We couldn&apos;t find a failed payment in this session — it may have cleared.
          </p>
        </div>
        <TerraCard className="flex flex-col gap-2">
          <Link
            href="/checkout"
            className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Return to checkout
          </Link>
          <Link
            href="/support?topic=payment-failed"
            className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Contact support
          </Link>
        </TerraCard>
      </div>
    );
  }

  const reasonInfo =
    paymentFailureReasons.find((r) => r.code === failure.reason) ?? paymentFailureReasons[0];
  const method =
    paymentMethods.find((m) => m.id === failure.methodId) ?? paymentMethods[0];
  const { amountLabel, challenge, attempt } = failure;

  // Support link pre-populated with the failure context (finding #2).
  const supportHref = `/support?${new URLSearchParams({
    topic: "payment-failed",
    reason: failure.reason,
    reasonTitle: reasonInfo.title,
    method: method.label,
    amount: amountLabel,
    challenge,
    attempt: String(attempt),
  }).toString()}`;

  return (
    <div className="space-y-6">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <TerraPageHeader
          title="Payment Failed"
          description={`Your challenge was not purchased — ${challenge}`}
          actions={<TerraBadge tone="error" dot>{reasonInfo.title}</TerraBadge>}
        />
      </div>

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
                    <dd className="font-mono text-on-error-container">{failure.reason}</dd>
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
              onClick={() => router.push("/checkout?retry=1")}
              className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Try again with {method.label}
            </button>
            <p className="text-center text-[11px] text-on-surface-variant">
              This method stays pre-selected — no re-entry needed.
            </p>
            <button
              type="button"
              onClick={() => {
                toast({
                  title: "Choose a different payment method",
                  description: `${method.label} is still selected — pick another, then pay again.`,
                });
                router.push("/checkout?focus=method");
              }}
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
