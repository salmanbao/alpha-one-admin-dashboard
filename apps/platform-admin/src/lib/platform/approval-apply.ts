"use client";

/**
 * Maker-checker application layer (gap S-09 / P0-2).
 *
 * The initiator stages the exact mutation on the approval request
 * (`payload`, persisted with the console store), so the change survives
 * reloads and does not depend on any page staying mounted. The moment a
 * second operator approves, the bridge applies it exactly once:
 *
 *   status "approved" → handler runs → markApprovalExecuted
 *     → status "executed" → skipped on every later pass.
 *
 * Rejected or expired requests never reach the handler: the store has
 * already audited the decision and the staged payload dies with the
 * request. Each domain (role, API key, staff) registers one handler —
 * all registrations live together in the approval bridge so a handler
 * is never missing just because its page was never visited.
 */

import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { markApprovalExecuted, useConsoleStore, type ApprovalRequest } from "./console-store";

/** What the operator sees once the staged change has landed. */
export interface AppliedOutcome {
  title: string;
  description: string;
}

type ApprovalHandler = (request: ApprovalRequest) => AppliedOutcome | void;

const handlers = new Map<string, ApprovalHandler>();

/** Register the applier for an action-key prefix (`role.`, `apikey.`, `staff.`). */
export function registerApprovalHandler(prefix: string, handler: ApprovalHandler): void {
  handlers.set(prefix, handler);
}

function findHandler(actionKey: string): ApprovalHandler | undefined {
  for (const [prefix, handler] of handlers) {
    if (actionKey.startsWith(prefix)) return handler;
  }
  return undefined;
}

/**
 * The typed reason (CON-15) the initiator recorded — SensitiveActionDialog
 * appends it to `detail` as " · reason: …". Appliers fold it into their
 * audit row so state, audit and toast all tell the same story.
 */
export function requestReason(request: ApprovalRequest): string | undefined {
  const detail = request.detail;
  if (!detail) return undefined;
  const marker = "· reason:";
  const idx = detail.indexOf(marker);
  if (idx === -1) return undefined;
  return detail.slice(idx + marker.length).trim() || undefined;
}

/**
 * Apply every approved-but-unapplied request that has a registered
 * handler. Mount once (AppShell) so approvals execute no matter which
 * screen operator B happens to be on.
 */
export function useApprovalApplier(): void {
  const store = useConsoleStore();
  useEffect(() => {
    for (const request of store.approvals) {
      if (request.status !== "approved") continue;
      const handler = findHandler(request.actionKey);
      if (!handler) continue;
      const outcome = handler(request);
      markApprovalExecuted(request.id);
      if (outcome) toast(outcome);
    }
  }, [store.approvals]);
}
