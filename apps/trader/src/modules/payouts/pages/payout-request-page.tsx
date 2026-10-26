"use client";

/**
 * Payout Request — converted from stitch_screens/payout_request
 * Payout request form with amount, method and submit.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraPayouts, withdrawalMethods, terraAccounts } from "@/lib/fixtures/terra-fixtures";

export function PayoutRequestPage() {
  const params = useSearchParams();
  const accountId = params.get("id") || "acc-100030";
  const acc = terraAccounts.find((a) => a.id === accountId) ?? terraAccounts[0];
  const minPayout = 100;
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("wm-wise");
  const [submitted, setSubmitted] = useState(false);
  const method = withdrawalMethods.find((m) => m.id === methodId) ?? withdrawalMethods[0];

  const asked = Number(amount);
  const valid =
    Number.isFinite(asked) &&
    asked >= minPayout &&
    asked <= acc.balance * 0.5 &&
    asked <= acc.equity - 2000;

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary-fixed p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Payout Request Submitted</h2>
          <p className="mt-2 text-on-surface-variant">
            Your request for {formatMoney(asked)} via {method.name} has been received.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Reference: PO-2026-0415 • Expected processing: {method.eta}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/payout-history"
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            View Payout History
          </Link>
          <Link
            href="/overview"
            className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Request Payout"
        description={`${acc.name} • Login #${acc.login}`}
        actions={
          <TerraBadge tone="primary">
            Balance {formatMoney(acc.balance)}
          </TerraBadge>
        }
      />

      {terraPayouts.length > 0 && (
        <TerraBadge tone="secondary">
          Last payout: {formatMoney(terraPayouts[0].amount)} · PO-{terraPayouts[0].reference.replace("PO-", "")}
        </TerraBadge>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Payout details" />
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Withdrawal amount
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest pl-7 pr-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary"
                  />
                </div>
                <p className="text-xs text-on-surface-variant">
                  Min {formatMoney(minPayout)} • Max {formatMoney(acc.balance * 0.5)} (50% of balance)
                </p>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Payout amount (after fee)
                  </span>
                  <p className={`text-sm font-bold tabular-nums ${valid ? "text-primary" : "text-error"}`}>
                    {valid ? formatMoney(asked) : "—"}
                  </p>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Processing time
                  </span>
                  <p className="text-sm font-bold text-on-surface">{method.eta}</p>
                </label>
              </div>
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Payout methods" />
            <div className="space-y-2">
              {withdrawalMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    methodId === m.id
                      ? "border-primary bg-primary-fixed/40"
                      : "border-outline-variant/60 hover:bg-surface-container-low"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{m.name}</p>
                    <p className="text-xs text-on-surface-variant">{m.detail}</p>
                  </div>
                  <span className="text-xs text-on-surface-variant">{m.fee}</span>
                </button>
              ))}
            </div>
          </TerraCard>
        </div>

        <TerraCard className="sticky top-24 flex flex-col gap-4">
          <TerraSectionTitle title="Request" />
          <div className="space-y-3 rounded-xl bg-surface-container-low p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Method</span>
              <span className="font-semibold text-on-surface">{method.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Amount</span>
              <span className={`font-bold tabular-nums ${valid ? "text-primary" : "text-error"}`}>
                {valid ? formatMoney(asked) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Fee</span>
              <span className="text-on-surface-variant">{method.fee}</span>
            </div>
            <div className="flex justify-between border-t border-outline-variant/40 pt-2">
              <span className="font-bold text-on-surface">Total</span>
              <span className="font-bold text-on-surface">{valid ? formatMoney(asked) : "—"}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => setSubmitted(true)}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {valid ? "Submit Payout Request" : "Enter a valid amount"}
          </button>
          <p className="text-center text-[11px] text-on-surface-variant">
            Payouts are reviewed within 1 business day.
          </p>
        </TerraCard>
      </div>
    </div>
  );
}
