"use client";

import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { TerraBadge, formatMoney } from "@/components/terra/terra-ui";
import { useComplianceSnapshot } from "@/lib/compliance/compliance-store";
import type { TerraAccount } from "@/lib/fixtures/terra-fixtures";

/**
 * Compliance summary strip (R7 I2) — one line per account card on
 * /my-accounts: buffer distance to the floor, daily-loss usage, the
 * violation count and payout readiness, all read from the compliance +
 * trading stores (nothing hand-written).
 */
export function ComplianceSummaryStrip({ account }: { account: TerraAccount }) {
  const snapshot = useComplianceSnapshot(account.id);
  if (!snapshot) return null;

  const violations = snapshot.violations.length;
  const critical = snapshot.total.bufferPct < 20 || snapshot.daily.usedPct >= 80;
  const Icon = violations > 0 ? ShieldX : critical ? ShieldAlert : ShieldCheck;
  const verdict =
    violations > 0
      ? `${violations} violation${violations === 1 ? "" : "s"}`
      : critical
        ? "Final 20% of buffer"
        : "Compliant";
  const tone = violations > 0 ? "error" : critical ? "tertiary" : "success";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2">
      <span className="flex items-center gap-1.5">
        <Icon
          className={`h-4 w-4 ${tone === "error" ? "text-error" : tone === "tertiary" ? "text-tertiary" : "text-primary"}`}
          aria-hidden
        />
        <TerraBadge tone={tone}>{verdict}</TerraBadge>
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-on-surface-variant">
        DD buffer {formatMoney(snapshot.total.buffer)} ({Math.round(snapshot.total.bufferPct)}%)
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-on-surface-variant">
        Daily {Math.round(snapshot.daily.usedPct)}% used
      </span>
      <span
        className={`text-[11px] font-semibold ${snapshot.payout.ready ? "text-primary" : "text-on-surface-variant"}`}
      >
        {snapshot.payout.ready
          ? "Payout eligible"
          : snapshot.payout.funded
            ? `${snapshot.payout.outstanding} payout requirement${snapshot.payout.outstanding === 1 ? "" : "s"} open`
            : "Payout on funding"}
      </span>
    </div>
  );
}
