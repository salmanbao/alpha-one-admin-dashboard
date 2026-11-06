"use client";

/**
 * Checkout Validation — checkout form-validation recovery route
 * (audit finding #1).
 *
 * The journey map had no screen for checkout validation errors. The
 * checkout already validates billing fields inline (and focuses the
 * first invalid field on submit — finding #5); this route is the
 * "explain and correct" companion: it replays the exact same billing
 * validators over the draft saved at the last failed submit, then
 * shows each field's entered value, its specific error, and how to
 * fix it — so the trader can read every problem at once instead of
 * fixing them one blur at a time.
 *
 * The draft is read after a deferred gate so the first paint matches
 * SSR (outage-recovery-banner pattern). Direct entry without a draft
 * falls back to the plain checklist of what we verify.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import {
  billingFieldFixes,
  billingFieldLabels,
  billingFieldOrder,
  billingValidators,
  readCheckoutDraft,
  type CheckoutDraft,
} from "@/lib/checkout/checkout-recovery";

/** undefined = draft still loading (first paint, matches SSR),
 *  null = no failed submit recorded in this session. */
type DraftState = CheckoutDraft | null | undefined;

const checks = [
  {
    title: "Name as billed",
    note: "First and last name are required — they must match the payment method for verification.",
  },
  {
    title: "Reachable email",
    note: "Must be a real address in “name@domain.tld” form — receipts and provisioning credentials go there.",
  },
  {
    title: "Issue country",
    note: "The country your payment method is issued in — it drives tax and fraud checks.",
  },
];

export function CheckoutValidationPage() {
  const [draft, setDraft] = useState<DraftState>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Deferred gate — first paint matches SSR, then the saved draft
  // lands (react-hooks/set-state-in-effect wants the timer).
  useEffect(() => {
    const t = setTimeout(() => setDraft(readCheckoutDraft()), 0);
    return () => clearTimeout(t);
  }, []);

  // Focus the heading once the real content mounts so keyboard /
  // screen-reader users start at the explanation (finding #1/#5).
  useEffect(() => {
    if (draft === undefined) return;
    headingRef.current?.focus();
  }, [draft]);

  if (draft === undefined) return <PageSkeleton />;

  // Replay the shared validators over the saved values — identical
  // messages to the inline field errors the checkout showed.
  const results =
    draft === null
      ? null
      : billingFieldOrder.map((field) => {
          const value = draft[field];
          const error = billingValidators[field](value);
          return { field, value, error };
        });
  const invalid = results?.filter((r) => r.error) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-headline text-2xl font-bold text-on-surface outline-none"
        >
          Checkout validation
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-on-surface-variant">
            {results
              ? invalid.length > 0
                ? `${invalid.length} of ${results.length} billing fields need attention — values from your last failed submit.`
                : "All billing fields pass now — return to checkout and press Pay again."
              : "What we check before charging your payment method."}
          </p>
          {results && invalid.length > 0 && (
            <TerraBadge tone="error" dot>Fix required</TerraBadge>
          )}
        </div>
      </div>

      {results && (
        <TerraCard>
          <TerraSectionTitle
            title="Your last submission"
            description="Values from the form when you pressed Pay. Fix them in the billing form — the checkout focuses the first problem field for you."
          />
          <div className="space-y-2">
            {results.map(({ field, value, error }) => (
              <div
                key={field}
                className={`rounded-xl border px-4 py-3 ${
                  error
                    ? "border-error/40 bg-error-container/30"
                    : "border-outline-variant/60 bg-surface-container-low"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-on-surface">
                    {billingFieldLabels[field]}
                  </p>
                  <span
                    className={`text-[11px] font-bold ${error ? "text-error" : "text-primary"}`}
                  >
                    {error ? "✗ Needs attention" : "✓ Looks good"}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-on-surface-variant">
                  {value.trim() ? value : "(empty)"}
                </p>
                {error && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-on-error-container">{error}</p>
                    <p className="text-xs text-on-error-container/80">
                      {billingFieldFixes[field]}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TerraCard>
      )}

      <TerraCard>
        <TerraSectionTitle title="What we verify before charging you" />
        <ol className="space-y-3">
          {checks.map((c, i) => (
            <li key={c.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">{c.title}</p>
                <p className="text-xs text-on-surface-variant">{c.note}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
          Validation runs when you press Pay — nothing is charged and no payment attempt is
          used while a field is invalid.
        </p>
      </TerraCard>

      <div className="flex flex-col gap-2">
        <Link
          href="/checkout"
          className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Back to checkout
        </Link>
        <Link
          href="/support?topic=checkout-validation"
          className="rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
