"use client";

/**
 * Payout Detail — converted from stitch_screens/payout_detail
 * Single payout with status timeline and details.
 */

import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraPayouts } from "@/lib/fixtures/terra-fixtures";

export function PayoutDetailPage() {
  const params = useSearchParams();
  const payout = terraPayouts.find((p) => p.id === params.get("id")) ?? terraPayouts[0];

  const timeline = [
    {
      label: "Requested",
      at: payout.requestedAt,
      done: true,
      note: `Via ${payout.method}`,
    },
    {
      label: "Under review",
      at: payout.requestedAt,
      done: true,
      note: "Compliance and risk checks",
    },
    {
      label: "Processing",
      at: payout.status === "processing" ? payout.requestedAt : null,
      done: payout.status !== "paid",
      note: "Funds being transferred",
    },
    {
      label: "Paid",
      at: payout.status === "paid" ? payout.expectedAt : null,
      done: payout.status === "paid",
      note: "Received in your account",
    },
  ];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Payout ${payout.reference}`}
        description={`Account #${payout.accountLogin} • ${payout.method}`}
        actions={
          <TerraBadge tone={payout.status === "paid" ? "success" : "tertiary"} dot pulse={payout.status === "processing"}>
            {payout.status}
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title="Status timeline" />
          <ol className="space-y-5">
            {timeline.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {s.done ? "✓" : "•"}
                </span>
                <div>
                  <p className={`text-sm font-bold ${s.done ? "text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                  {s.at && (
                    <p className="text-[11px] text-on-surface-variant">
                      {new Date(s.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </TerraCard>

        <TerraCard className="flex flex-col gap-4">
          <TerraSectionTitle title="Summary" />
          <div className="rounded-xl bg-surface-container-low p-5 text-center">
            <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Amount
            </span>
            <span className="font-headline text-3xl font-bold tabular-nums text-on-surface">
              {formatMoney(payout.amount)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Reference</span>
              <span className="font-mono font-semibold text-on-surface">{payout.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Method</span>
              <span className="font-semibold text-on-surface">{payout.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Requested</span>
              <span className="text-on-surface">{payout.requestedAt.slice(0, 10)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Expected</span>
              <span className="text-on-surface">{payout.expectedAt.slice(0, 10)}</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Download receipt
          </button>
        </TerraCard>
      </div>
    </div>
  );
}
