"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraEmpty,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraPayouts } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";
import { getPayoutStage } from "@/lib/status-progression";
import { usePayoutRequests, type DisplayPayout } from "@/lib/payouts/payout-requests-store";
import { submitPayoutAppeal, type PayoutRejectionReason } from "@/lib/appeals/claims-store";
const fixturePayouts: DisplayPayout[] = terraPayouts.map((p) => ({
  ...p,
  rejection: p.rejection ?? null,
  isUserRequest: false,
  methodId: undefined,
  currency: "USD",
}));

export function PayoutDetailContent({
  id,
  embedded = false,
}: {
  id: string | null;
  /** true when rendered inside the quick-view dialog (page chrome hidden). */
  embedded?: boolean;
}) {
  const storeRequests = usePayoutRequests();
  const payout =
    (id ? storeRequests.find((p) => p.id === id) : null) ??
    (id ? fixturePayouts.find((p) => p.id === id) : null) ??
    fixturePayouts[0];

  const rejected = payout.status === "rejected" && payout.rejection != null;

  // Use the progression helper to derive the current stage and its ETA
  const payoutStage = getPayoutStage(
    payout.status,
    payout.status === "processing"
      ? payout.expectedAt
        ? "Processing window open"
        : "Typically 1-3 business days"
      : undefined,
  );

  const timeline = rejected
    ? [
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
          label: "Rejected",
          at: payout.rejection!.at,
          done: true,
          note: payout.rejection!.summary,
        },
      ]
    : [
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
          label: payoutStage.label,
          at: payout.status === "processing" ? payout.requestedAt : null,
          done: payout.status !== "paid",
          note: payoutStage.eta,
        },
        {
          label: "Paid",
          at: payout.status === "paid" ? payout.expectedAt : null,
          done: payout.status === "paid",
          note: "Received in your account",
        },
      ];

  const statusTone =
    payout.status === "paid" ? "success" : payout.status === "rejected" ? "error" : "tertiary";

  // R12 GAP-T6 — payout appeal UI shown only when request is rejected
  const canAppeal = payout.status === "rejected" && !payout.rejection?.appealed;

  const handleDownloadReceipt = () => {
    // Real artifact: print/save the receipt (window.print is the browser's
    // native save-to-PDF path; no fabricated email delivery).
    window.print();
    toast({
      title: "Receipt ready to save",
      description: `${payout.reference} — ${formatMoney(payout.amount)} via ${payout.method} (${payout.status}). Use your browser's print dialog to save as PDF.`,
    });
  };

  const handleRetry = () => {
    if (!payout.reference) return;
    // R12 GAP-T4 — retry navigation to the request page with the original
    // reference so the form can be pre-filled.
    window.location.href = `/payout-request?retry=${payout.id}`;
  };

  if (!payout) {
    return (
      <div className="space-y-6">
        <TerraPageHeader title="Payout not found" />
        <TerraEmpty title="No payout found" description="The requested payout could not be located." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <TerraPageHeader
          title="Payout Detail"
          description={`${payout.account} • Login #${payout.accountLogin}`}
          actions={<TerraBadge tone={statusTone}>{payout.status}</TerraBadge>}
        />
      )}

      {/* Status timeline — always visible so traders know exactly where
          their request sits in the process (audit #2). */}
      <TerraCard>
        <TerraSectionTitle
          title={rejected ? "Rejected — timeline" : "Status timeline"}
          description={
            rejected
              ? "This request was reviewed and rejected. See the reason below."
              : "Live progression from submission to settlement."
          }
        />
        <div className="space-y-4">
          {timeline.map((step, i) => (
            <div
              key={step.label}
              className={`flex items-start gap-4 ${!step.done ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col items-center">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.done
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                {!step.done && i < timeline.length - 1 && (
                  <span className="w-0.5 h-8 bg-outline-variant mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-on-surface">{step.label}</p>
                {step.at && (
                  <p className="text-xs text-on-surface-variant">
                    {new Date(step.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {step.note && <p className="text-sm text-on-surface-variant">{step.note}</p>}
              </div>
            </div>
          ))}
        </div>

        {rejected && payout.rejection && (
          <div className="mt-6 rounded-xl border border-error/40 bg-error-container/40 p-4 text-sm">
            <p className="font-bold text-error">Rejection reason</p>
            <p className="mt-1 text-on-error-container">{payout.rejection.summary}</p>
            {payout.rejection.checks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {payout.rejection.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-on-error-container">
                    <span aria-hidden>✗</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs font-semibold text-on-error-container">
              Next steps: {payout.rejection.nextSteps.join("; ")}
            </p>
          </div>
        )}

        {/* R12 GAP-T6 — payout appeal: dispute a rejected request */}
        {canAppeal && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-primary-container/40 p-4">
            <p className="font-semibold text-primary">Appeal this rejection</p>
            <p className="text-sm text-on-primary-container">
              You may dispute this rejection by providing additional evidence or context.
              Appeals are reviewed by the firm within 2 business days (Demo).
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/payout-request?retry=${payout.id}`;
              }}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Submit Appeal
            </button>
          </div>
        )}

        {/* R12 GAP-T11 — partial approval representation */}
        {payout.partialApproved && (
          <div className="mt-6 rounded-xl border border-success/40 bg-success-container/40 p-4">
            <p className="font-semibold text-success">Partial approval</p>
            <p className="text-sm text-on-success">
              Your payout request has been partially approved. The firm is paying
              {payout.reducedAmount ? formatMoney(payout.reducedAmount) : formatMoney(payout.amount)} {payout.currency}
              of the requested {payout.originalAmount} {payout.currency}.
            </p>
            <p className="text-sm text-on-success-container mt-2">
              Delta: {payout.amountDelta !== undefined ? formatMoney(payout.amountDelta) : '0'} reduced from original
              request.
            </p>
            <button
              type="button"
              onClick={() => window.location.href = `/payout-request?retry=${payout.id}`}
              className="rounded-xl bg-success px-5 py-2.5 text-sm font-bold text-on-success hover:bg-success/90"
              disabled={payout.partialApprovedAt !== undefined}
            >
              Acknowledge partial approval
            </button>
          </div>
        )}
      </TerraCard>

      {/* Detail panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TerraCard>
          <TerraSectionTitle title="Payout summary" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Reference</dt>
              <dd className="font-mono font-bold text-on-surface">{payout.reference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Amount</dt>
              <dd className="font-bold text-on-surface">{formatMoney(payout.amount)} {payout.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Method</dt>
              <dd className="text-on-surface">{payout.method}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Requested</dt>
              <dd className="text-on-surface">{new Date(payout.requestedAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Expected by</dt>
              <dd className="text-on-surface">{new Date(payout.expectedAt).toLocaleString()}</dd>
            </div>
            {payout.paidAt && (
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Paid at</dt>
                <dd className="text-on-surface">{new Date(payout.paidAt).toLocaleString()}</dd>
              </div>
            )}
            {payout.failedAt && (
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Failed at</dt>
                <dd className="text-on-surface">{new Date(payout.failedAt).toLocaleString()}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-outline-variant/40 pt-2">
              <dt className="text-on-surface-variant">Currency</dt>
              <dd className="font-bold text-on-surface">{payout.currency}</dd>
            </div>
            {payout.partialApproved && (
              <div className="mt-2 text-sm text-on-success">
                <div className="font-medium">Partial approval</div>
                <div className="text-on-success/80">Original: {payout.originalAmount ? formatMoney(payout.originalAmount) : formatMoney(payout.amount)} {payout.currency}</div>
                <div className="text-on-success/80">Paid: {payout.reducedAmount ? formatMoney(payout.reducedAmount) : formatMoney(payout.amount)} {payout.currency}</div>
                <div className="text-on-success/80 mt-1">Delta: {payout.amountDelta !== undefined ? formatMoney(payout.amountDelta) : '0'} reduced</div>
              </div>
            )}
          </dl>

          {rejected && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Retry payout
              </button>
            </div>
          )}
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Actions" />
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="w-full rounded-xl border border-outline-variant/60 px-4 py-3 text-left text-sm font-semibold text-on-surface hover:bg-surface-container-low"
            >
              <span className="flex items-center justify-between">
                <span>Download receipt</span>
                <span aria-hidden>⌘P</span>
              </span>
            </button>
            {!embedded && (
              <Link
                href="/payout-history"
                className="block rounded-xl border border-outline-variant/60 px-4 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container-low"
              >
                Back to history
              </Link>
            )}
          </div>
        </TerraCard>
      </div>
    </div>
  );
}

export function PayoutDetailPage() {
  const params = useSearchParams();
  const id = params.get("id");
  return <PayoutDetailContent id={id} />;
}