"use client";

/**
 * Verified shareable track record — R9 W5 UC-T10.
 *
 * Read-only public page at `/trader-record/[handle]`: masked stats
 * (gain %, payout count, total payout value) derived from the REAL payout
 * history (store rows + fixture paid rows) and the issued certificates —
 * nothing is hand-written. Identity is masked (handle + account logins),
 * proof ids are masked to their last 4 characters, and a share-link copy
 * button publishes the route.
 *
 * No state change → no audit/event (read-only projection). Footer states
 * plainly that proofs are simulated (honest labeling, §1 rule 3).
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import {
  terraAccounts,
  terraCertificates,
  terraPayouts,
} from "@/lib/fixtures/terra-fixtures";
import { readPayoutRequests, type DisplayPayout } from "@/lib/payouts/payout-requests-store";

/** Mask an id to its last 4 characters (`PO-2187` → `••••2187`). */
function maskId(id: string): string {
  const tail = id.slice(-4);
  return `••••${tail}`;
}

/** Mask a login to its last 3 digits (`92841` → `•••841`). */
function maskLogin(login: string): string {
  return `•••${login.slice(-3)}`;
}

export function TraderRecordPage({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  // Real history: trader-submitted store rows + fixture paid rows.
  const allPayouts: DisplayPayout[] = [
    ...readPayoutRequests(),
    ...terraPayouts.map((p) => ({
      ...p,
      rejection: p.rejection ?? null,
      isUserRequest: false,
      currency: "USD",
      methodId: undefined,
      promisedBy: p.expectedAt,
    })),
  ];
  const paid = allPayouts.filter((p) => p.status === "paid");
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);

  // Starting capital of every account that has ever been paid — the
  // denominator for the gain % (derived, never invented).
  const paidAccountIds = new Set(paid.map((p) => p.account));
  const startingCapital = terraAccounts
    .filter((a) => paidAccountIds.has(a.id))
    .reduce((s, a) => s + a.startingBalance, 0);
  const gainPct = startingCapital > 0 ? (totalPaid / startingCapital) * 100 : 0;

  const issuedCerts = terraCertificates.filter((c) => c.status === "issued");

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trader-record/${handle}`
      : `/trader-record/${handle}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Share link copied",
        description: `${shareUrl} — anyone with the link sees this read-only record (Demo).`,
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: `Copy this link manually: ${shareUrl}`,
        variant: "destructive",
      });
    }
  };

  if (paid.length === 0 && issuedCerts.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <TerraPageHeader title={`Track record — @${handle}`} description="Verified trading record" />
        <TerraEmpty
          title="No public record yet"
          description="Paid payouts and issued certificates will appear here once this trader has them."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title={`Track record — @${handle}`}
        description="Read-only verified record — masked stats derived from paid payouts and issued certificates"
        actions={
          <button
            type="button"
            onClick={copyShare}
            aria-label="Copy share link to clipboard"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            {copied ? "✓ Copied" : "Copy share link"}
          </button>
        }
      />

      {/* Masked headline stats */}
      <TerraCard>
        <TerraSectionTitle
          title="Performance (masked)"
          description={`Public view for @${handle} — account identities are masked`}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <TerraStatLike label="Gain" value={`${gainPct.toFixed(2)}%`} sub="of paid-out starting capital" />
          <TerraStatLike label="Payouts" value={String(paid.length)} sub="paid, all time" />
          <TerraStatLike label="Total value" value={formatMoney(totalPaid)} sub="paid out" />
        </div>
        <p className="mt-4 text-[11px] text-on-surface-variant">
          Accounts {paid.map((p) => maskLogin(p.accountLogin)).join(", ") || "—"} · stats are
          computed from this trader&apos;s payout history — no figures are entered by hand.
        </p>
      </TerraCard>

      {/* Proof list — masked ids */}
      <TerraCard>
        <TerraSectionTitle
          title="Proofs"
          description="Payout receipts and credentials — ids masked for privacy"
        />
        <ul className="divide-y divide-outline-variant/60">
          {paid.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-on-surface">
                  Payout {maskId(p.reference)} · {formatMoney(p.amount)}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Paid {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.requestedAt).toLocaleDateString()} ·{" "}
                  {p.method}
                </p>
              </div>
              <TerraBadge tone="success">Paid</TerraBadge>
            </li>
          ))}
          {issuedCerts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-on-surface">{c.title}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {c.program} · credential {maskId(c.credentialId)} · issued{" "}
                  {new Date(c.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <TerraBadge tone="primary">Issued</TerraBadge>
            </li>
          ))}
        </ul>
      </TerraCard>

      {/* Share */}
      <TerraCard>
        <TerraSectionTitle title="Share" description="Anyone with this link can view this record" />
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface">
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={copyShare}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
      </TerraCard>

      {/* Honest footer */}
      <p className="pb-4 text-center text-[11px] text-on-surface-variant">
        Demo — proofs are simulated. Identities and account numbers are masked; figures are
        derived from this demo tenant&apos;s payout history.
      </p>
    </div>
  );
}

/** Small stat cell — local to keep the page self-contained (Terra look). */
function TerraStatLike({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="block truncate text-lg font-bold tabular-nums text-on-surface">{value}</span>
      <span className="block truncate text-[10px] font-medium text-on-surface-variant">{sub}</span>
    </div>
  );
}
