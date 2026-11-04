/**
 * Risk case explainers — audit finding #5 (MEDIUM).
 *
 * Risk cases listed WHAT fired (signal + one-line detail) but a reviewer
 * had to investigate manually to learn which rule was violated, what it
 * means for the trader's account, and what to do next. This map gives
 * every seeded signal a plain-language explanation block:
 *
 *   • rule        — the specific rule the activity violates
 *   • trigger     — the mechanism that produced the signal
 *   • implication — what it does to the account / payouts
 *   • action      — the recommended next step for the reviewer
 *
 * Deterministic fixture content keyed by the exact `signal` strings the
 * risk-case store seeds; `explainSignal` falls back gracefully for
 * operator-created cases with free-text signals. Educational links go to
 * the Rules Editor (the canonical rules reference in this app).
 */

export interface SignalExplainer {
  /** Specific rule the flagged activity violates. */
  rule: string;
  /** Plain-language description of what mechanically triggered it. */
  trigger: string;
  /** Consequences for the account, payouts and exposure. */
  implication: string;
  /** Recommended next step before resolving or escalating. */
  action: string;
}

const SIGNAL_EXPLAINERS: Record<string, SignalExplainer> = {
  "Drawdown anomaly": {
    rule: "Daily loss limit & max drawdown rules (risk.drawdown)",
    trigger:
      "Intraday equity fell past the tenant's daily loss ceiling — measured from the 00:00 UTC rollover watermark — or the trailing max-drawdown floor was touched.",
    implication:
      "The account is soft-breached: payouts are held and new position sizing is throttled until equity recovers. A second breach inside the same cycle suspends the account.",
    action:
      "Compare the equity curve with the trade log for the flagged window, then resolve with a drawdown template (within rules) or escalate if the breach is confirmed.",
  },
  "Trading pattern anomaly": {
    rule: "No copy-trading or shared-signal accounts (risk.copy-trading)",
    trigger:
      "Position correlation with another trader's entries exceeded the 87% threshold across the flagged window.",
    implication:
      "Confirmed mirror trading voids profit split on the affected trades and can terminate the funded account under the originality clause.",
    action:
      "Diff entry/exit timestamps across the correlated accounts, request the trader's strategy declaration, then resolve as explained behavior or escalate as a violation.",
  },
  "Multiple account behavior": {
    rule: "One active funded account per trader (risk.account-farming)",
    trigger:
      "Two funded accounts show identical entries, lot sizing and holding periods for the same trader.",
    implication:
      "Exposure doubles against a single strategy; duplicate accounts are terminated and their losses count against the surviving account.",
    action:
      "Confirm shared control using the device/IP evidence, close the duplicate account and notify the trader with the one-account rule text.",
  },
  "Suspicious payout pattern": {
    rule: "Payout velocity & minimum trading days (payout.velocity)",
    trigger:
      "A withdrawal was requested shortly after funding with an unusual cadence relative to the trader's history.",
    implication:
      "The payout stays on hold until eligibility re-checks pass; repeated velocity flags route the trader to manual fraud review.",
    action:
      "Re-run the payout eligibility checklist (minimum days, drawdown, KYC, prior payouts) and check payout history before approving — reject with a reason if any item is unmet.",
  },
  "False positive — device cluster": {
    rule: "Device/IP uniqueness heuristic (risk.device-cluster)",
    trigger:
      "Device fingerprints matched across accounts — explained by a shared office NAT or household devices rather than duplicate traders.",
    implication:
      "No violation: the case closes as explained behavior while the heuristic stays armed for genuinely shared accounts.",
    action:
      "Record the benign explanation in the case notes and dismiss so the signal stops re-firing for this trader.",
  },
};

const FALLBACK: SignalExplainer = {
  rule: "Tenant-configured risk policy",
  trigger: "",
  implication:
    "Exposure stays flagged and any linked payout hold applies until the case is resolved or dismissed.",
  action:
    "Work the evidence checklist below, then resolve with a template or escalate for supervisory review.",
};

/**
 * Explanation for a case's signal; unknown (operator-created) signals
 * fall back to a generic block seeded with the case's own detail line.
 */
export function explainSignal(signal: string, signalDetail = ""): SignalExplainer {
  const known = SIGNAL_EXPLAINERS[signal];
  if (known) return known;
  return { ...FALLBACK, trigger: signalDetail };
}
