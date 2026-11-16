"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { emitLifecycle } from "@pfaas/lifecycle";

export type UserStatus = "active" | "suspended" | "invited";

const userStatusSchema = z.record(
  z.string(),
  z.object({ status: z.enum(["active", "suspended", "invited"]), at: z.string() }),
);

const SLOT = "user-management";
const listeners = new Set<() => void>();
let version = 0;

type Override = { status: UserStatus; at: string };
const overrides = new Map<string, Override>(
  Object.entries(loadDemoState(SLOT, userStatusSchema, {})),
);

function emit() {
  version += 1;
  saveDemoState(SLOT, Object.fromEntries(overrides));
  listeners.forEach((l) => l());
}

export function applyUserStatus(userId: string, status: UserStatus, name?: string) {
  overrides.set(userId, { status, at: new Date().toISOString() });
  recordAudit({
    action: status === "suspended" ? "Suspended user" : status === "active" ? "Reactivated user" : "Invited user",
    entity: "trader",
    entityId: userId,
    summary: `${name ?? userId} — status ${status}`,
    severity: status === "suspended" ? "warning" : "info",
  });
  emitLifecycle({
    entity: { kind: "trader", id: userId },
    name: status === "suspended" ? "trader.suspended" : "trader.reactivated",
    actor: "prop-admin",
    key: `${userId}:${status}`,
    payload: { name: name ?? userId, status },
  });
  emit();
}

export function getUserStatus(userId: string): UserStatus | undefined {
  return overrides.get(userId)?.status;
}

export function useUserManagementVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}