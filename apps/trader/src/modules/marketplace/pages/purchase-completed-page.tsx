"use client";

/**
 * Purchase Completed — converted from stitch_screens/purchase_completed
 * Success confirmation with next steps (KYC → provisioning → credentials).
 */

import Link from "next/link";
import { TerraCard, TerraPageHeader, formatMoney } from "@/components/terra/terra-ui";
import { terraChallenges } from "@/lib/fixtures/terra-fixtures";

const steps = [
  { title: "Payment confirmed", done: true, note: "Just now" },
  { title: "KYC verification", done: false, note: "Takes ~10 minutes", href: "/account-verification-1" },
  { title: "Account provisioning", done: false, note: "Within 1 business hour", href: "/account-provisioning" },
  { title: "Credentials delivered", done: false, note: "Sent to your email", href: "/trading-credentials" },
];

export function PurchaseCompletedPage() {
  const ch = terraChallenges[1];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-on-primary">
          ✓
        </div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Purchase completed!
        </h1>
        <p className="text-sm text-on-surface-variant">
          Your {ch.name} {formatMoney(ch.accountSize, "USD").replace(".00", "")} challenge is
          being prepared.
        </p>
      </div>

      <TerraCard>
        <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">What happens next</h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="flex flex-col">
                {s.href && !s.done ? (
                  <Link href={s.href} className="text-sm font-bold text-primary hover:underline">
                    {s.title}
                  </Link>
                ) : (
                  <span className={`text-sm font-bold ${s.done ? "text-primary" : "text-on-surface"}`}>
                    {s.title}
                  </span>
                )}
                <span className="text-xs text-on-surface-variant">{s.note}</span>
              </div>
            </li>
          ))}
        </ol>
      </TerraCard>

      <TerraCard className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">Order #TT-48210</p>
          <p className="text-xs text-on-surface-variant">
            {formatMoney(ch.price)} paid • Receipt sent to your email
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/documents"
            className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
          >
            View Invoice
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </TerraCard>
    </div>
  );
}
