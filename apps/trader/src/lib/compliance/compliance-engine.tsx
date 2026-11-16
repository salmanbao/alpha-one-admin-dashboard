"use client";

/**
 * Compliance engine (R7 I2) — re-evaluates every account's rules
 * whenever the trading store changes (a close, a session start, a
 * reload). New breaks land in `pfaas:trader:compliance` and are emitted
 * as `compliance.violation` / `compliance.buffer-warning`; the app-shell
 * inbox bridge is the named consumer (receipts). Mounted once inside
 * <TradingProvider> in components/platform/providers.tsx.
 */

import { useEffect } from "react";
import { useTrading } from "@/lib/trading/trading-context";
import {
  runComplianceEvaluation,
  useComplianceStore,
} from "@/lib/compliance/compliance-store";

export function ComplianceEngine(): null {
  const { positions, closedTrades, realizedByAccount } = useTrading();
  // Subscribing to the store re-runs after our own writes too — the
  // evaluation is idempotent (stable violation ids + event keys), so the
  // second pass is a no-op and cannot loop.
  const state = useComplianceStore();

  useEffect(() => {
    runComplianceEvaluation({ positions, closedTrades, realizedByAccount });
  }, [state, positions, closedTrades, realizedByAccount]);

  return null;
}
