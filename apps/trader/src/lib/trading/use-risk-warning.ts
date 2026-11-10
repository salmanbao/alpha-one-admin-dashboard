"use client";

import { useEffect, useMemo, useRef } from "react";
import { terraRiskLimits, type TerraAccount } from "@/lib/fixtures/terra-fixtures";
import { formatMoney } from "@/components/terra/terra-ui";
import { useActiveAccount } from "@/lib/platform/account-context";
import { computeRiskWarning, RISK_WARNING_THRESHOLD_PCT, type RiskWarningState } from "@/lib/trading/risk-warning";
import { pushInboxMessage, type InboxMessage } from "@/lib/inbox/inbox-store";

/**
 * Risk-warning hook (R3-05 / AUDIT-R3 §6 item 5).
 *
 * Reads the active account's remaining daily-loss / max-drawdown
 * allowances against the program limits and reports when either is at or
 * below 30% — the point at which the trader should cut size before the
 * first breach. On warning onset it pushes a `risk.warning` inbox message
 * (deduped per account so reloads don't re-send) so the warning reaches
 * the trader even off the dashboard.
 *
 * Demo aid (disclosed): sessionStorage key
 * `pfaas:trader:demo:risk-warning-override` — JSON `{ dailyPct?, maxDdPct? }`
 * — forces the computed percentages so the warning branch can be
 * exercised without editing fixtures (no fixture account sits at ≤30%
 * remaining). Survives only until the tab closes.
 */

const OVERRIDE_KEY = "pfaas:trader:demo:risk-warning-override";
const PUSHED_KEY = (accountId: string) => `pfaas:trader:inbox:risk.warning:${accountId}`;

interface UseRiskWarningResult extends RiskWarningState {
  account: TerraAccount | null;
  limits: { daily: number; maxDd: number } | null;
  dailyRemaining: number;
  maxDdRemaining: number;
}

export function useRiskWarning(): UseRiskWarningResult {
  const { activeAccount: account } = useActiveAccount();
  const limits =
    account && terraRiskLimits[account.id]
      ? terraRiskLimits[account.id]
      : account
        ? { daily: 1000, maxDd: 5000 }
        : null;

  // Primitive copies kept stable for effect deps.
  const accountId = account?.id ?? "";
  const dailyRemaining = account?.dailyLossRemaining ?? 0;
  const maxDdRemaining = account?.maxDdRemaining ?? 0;
  const dailyLimit = limits?.daily ?? 0;
  const maxDdLimit = limits?.maxDd ?? 0;

  const base = computeRiskWarning(account, limits ?? undefined);

  // Demo override — forces percentages for walkthrough verification.
  const override = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem(OVERRIDE_KEY);
      return raw ? (JSON.parse(raw) as { dailyPct?: number; maxDdPct?: number }) : undefined;
    } catch {
      return undefined;
    }
  }, []);
  const dailyPct = override?.dailyPct ?? base.dailyPct;
  const maxDdPct = override?.maxDdPct ?? base.maxDdPct;
  const warned = dailyPct <= RISK_WARNING_THRESHOLD_PCT || maxDdPct <= RISK_WARNING_THRESHOLD_PCT;
  const breach =
    dailyPct <= RISK_WARNING_THRESHOLD_PCT && maxDdPct <= RISK_WARNING_THRESHOLD_PCT
      ? "daily"
      : dailyPct <= RISK_WARNING_THRESHOLD_PCT
        ? "daily"
        : maxDdPct <= RISK_WARNING_THRESHOLD_PCT
          ? "maxDd"
          : null;

  const state: RiskWarningState = { dailyPct, maxDdPct, warned, breach };

  // Push the inbox message once per warning onset per account (deduped by
  // sessionStorage key so a reload never re-sends it).
  const reported = useRef(false);
  useEffect(() => {
    if (!warned || reported.current || !accountId) return;
    const pushedKey = PUSHED_KEY(accountId);
    if (sessionStorage.getItem(pushedKey)) return;
    const metric = breach === "maxDd" ? "max drawdown" : "daily loss";
    const pct = breach === "maxDd" ? maxDdPct : dailyPct;
    const remaining = breach === "maxDd" ? maxDdRemaining : dailyRemaining;
    const cap = breach === "maxDd" ? maxDdLimit : dailyLimit;
    const message: InboxMessage = {
      id: `risk.warning:${accountId}`,
      subject: `Risk alert: ${metric} limit approaching`,
      body:
        `Your ${metric} allowance is at ${pct}% remaining (${formatMoney(remaining)} of ${formatMoney(cap)}) — ` +
        `at or below the ${RISK_WARNING_THRESHOLD_PCT}% warning threshold. ` +
        `Reduce position sizes or pause trading to avoid a breach; breaches are permanent for the account.`,
      category: "Trading",
      sender: "Risk Team",
      at: new Date().toISOString(),
      read: false,
    };
    pushInboxMessage(message);
    sessionStorage.setItem(pushedKey, "1");
    reported.current = true;
  }, [warned, accountId, dailyLimit, maxDdLimit, dailyRemaining, maxDdRemaining, breach]);

  return { ...state, account, limits, dailyRemaining, maxDdRemaining };
}
