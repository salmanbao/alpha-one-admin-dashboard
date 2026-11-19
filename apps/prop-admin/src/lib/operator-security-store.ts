"use client";

/**
 * R10-F1 — Operator security policy pack (P0).
 *
 * 2FA used to be a derived display column and the role catalog a static
 * fixture: nothing enforced passwords, sessions, IPs, or offboarding.
 * This store owns the operator (staff) security policy:
 *
 *   • password policy (complexity, reuse, expiry, lockout),
 *   • session policy (max duration, idle timeout, re-auth window),
 *   • 2FA enforcement policy (roles, grace period, methods),
 *   • admin IP allow/blocklist,
 *   • SSO/SAML configuration,
 *   • offboarding (token/session revocation) + role-change controls,
 *   • a security event log (last 500) fed by `security.event` emissions.
 *
 * Validation helpers (`validatePassword`, `isIPAllowed`,
 * `checkTwoFactorRequired`, `checkSessionTimeout`) are the enforcement
 * API — the user-management and session surfaces consult them instead of
 * assuming a compliant operator.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events (`security.event`, payload carries the type)
 * - recordAudit for audit trails
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Policy types                                                        */
/* ------------------------------------------------------------------ */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  /** Previous passwords that may not be reused. */
  preventReuse: number;
  /** Password expiry in days (0 = never expires). */
  maxAgeDays: number;
  lockoutAttempts: number;
  lockoutDurationMinutes: number;
}

export interface SessionPolicy {
  maxSessionDurationHours: number;
  idleTimeoutMinutes: number;
  rememberMeDurationDays: number;
  requireReauthForSensitiveActions: boolean;
  reauthTimeoutMinutes: number;
}

export interface TwoFactorPolicy {
  enabled: boolean;
  enforceForAllRoles: boolean;
  enforceForRoles: string[];
  gracePeriodDays: number;
  backupCodesCount: number;
  allowTotp: boolean;
  allowSms: boolean;
  allowEmail: boolean;
}

export interface IPPolicy {
  enabled: boolean;
  allowlist: string[];
  blocklist: string[];
  alertOnUnknownIp: boolean;
}

export interface SSOPolicy {
  enabled: boolean;
  provider: "okta" | "azure-ad" | "google" | "auth0" | "custom";
  metadataUrl?: string;
  entityId?: string;
  attributeMapping: Record<string, string>;
  enforceSso: boolean;
  allowLocalFallback: boolean;
}

export interface OffboardingPolicy {
  requireApproval: boolean;
  approvalRoles: string[];
  autoRevokeTokens: boolean;
  revokeSessions: boolean;
  exportDataBeforeDelete: boolean;
  retainDataDays: number;
  notifyUser: boolean;
}

export interface RoleChangePolicy {
  requireApproval: boolean;
  approvalRoles: string[];
  notifyUser: boolean;
  auditAllChanges: boolean;
  cooldownHours: number;
}

export type SecurityEventType =
  | "login-failed"
  | "login-success"
  | "password-changed"
  | "two-factor-enabled"
  | "session-expired"
  | "ip-blocked"
  | "sso-login"
  | "offboarding-initiated"
  | "offboarding-completed"
  | "role-changed"
  | "token-revoked"
  | "policy-violation";

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  userId: string;
  userName: string;
  ipAddress?: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

export interface SecurityState {
  passwordPolicy: PasswordPolicy;
  sessionPolicy: SessionPolicy;
  twoFactorPolicy: TwoFactorPolicy;
  ipPolicy: IPPolicy;
  ssoPolicy: SSOPolicy;
  offboardingPolicy: OffboardingPolicy;
  roleChangePolicy: RoleChangePolicy;
  /** Security event log (most recent first, capped). */
  securityEvents: SecurityEvent[];
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const securityEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.enum([
    "login-failed",
    "login-success",
    "password-changed",
    "two-factor-enabled",
    "session-expired",
    "ip-blocked",
    "sso-login",
    "offboarding-initiated",
    "offboarding-completed",
    "role-changed",
    "token-revoked",
    "policy-violation",
  ]),
  userId: z.string(),
  userName: z.string(),
  ipAddress: z.string().optional(),
  details: z.record(z.string(), z.unknown()),
  severity: z.enum(["info", "warning", "critical"]),
});

const securityStateSchema = z.object({
  passwordPolicy: z.object({
    minLength: z.number().min(8).max(64),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumbers: z.boolean(),
    requireSpecialChars: z.boolean(),
    preventReuse: z.number().min(0).max(24),
    maxAgeDays: z.number().min(0).max(365),
    lockoutAttempts: z.number().min(1).max(10),
    lockoutDurationMinutes: z.number().min(1).max(1440),
  }),
  sessionPolicy: z.object({
    maxSessionDurationHours: z.number().min(1).max(168),
    idleTimeoutMinutes: z.number().min(1).max(1440),
    rememberMeDurationDays: z.number().min(0).max(30),
    requireReauthForSensitiveActions: z.boolean(),
    reauthTimeoutMinutes: z.number().min(1).max(60),
  }),
  twoFactorPolicy: z.object({
    enabled: z.boolean(),
    enforceForAllRoles: z.boolean(),
    enforceForRoles: z.array(z.string()),
    gracePeriodDays: z.number().min(0).max(90),
    backupCodesCount: z.number().min(5).max(20),
    allowTotp: z.boolean(),
    allowSms: z.boolean(),
    allowEmail: z.boolean(),
  }),
  ipPolicy: z.object({
    enabled: z.boolean(),
    allowlist: z.array(z.string()),
    blocklist: z.array(z.string()),
    alertOnUnknownIp: z.boolean(),
  }),
  ssoPolicy: z.object({
    enabled: z.boolean(),
    provider: z.enum(["okta", "azure-ad", "google", "auth0", "custom"]),
    metadataUrl: z.string().optional(),
    entityId: z.string().optional(),
    attributeMapping: z.record(z.string(), z.string()),
    enforceSso: z.boolean(),
    allowLocalFallback: z.boolean(),
  }),
  offboardingPolicy: z.object({
    requireApproval: z.boolean(),
    approvalRoles: z.array(z.string()),
    autoRevokeTokens: z.boolean(),
    revokeSessions: z.boolean(),
    exportDataBeforeDelete: z.boolean(),
    retainDataDays: z.number().min(0).max(3650),
    notifyUser: z.boolean(),
  }),
  roleChangePolicy: z.object({
    requireApproval: z.boolean(),
    approvalRoles: z.array(z.string()),
    notifyUser: z.boolean(),
    auditAllChanges: z.boolean(),
    cooldownHours: z.number().min(0).max(72),
  }),
  securityEvents: z.array(securityEventSchema),
  lastProcessedSeq: z.number(),
});

type SecurityStateType = z.infer<typeof securityStateSchema>;

/* ------------------------------------------------------------------ */
/* Default policies                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_STATE: SecurityStateType = {
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 5,
    maxAgeDays: 90,
    lockoutAttempts: 5,
    lockoutDurationMinutes: 15,
  },
  sessionPolicy: {
    maxSessionDurationHours: 12,
    idleTimeoutMinutes: 30,
    rememberMeDurationDays: 7,
    requireReauthForSensitiveActions: true,
    reauthTimeoutMinutes: 5,
  },
  twoFactorPolicy: {
    enabled: true,
    enforceForAllRoles: false,
    enforceForRoles: ["admin", "super-admin"],
    gracePeriodDays: 30,
    backupCodesCount: 10,
    allowTotp: true,
    allowSms: true,
    allowEmail: true,
  },
  ipPolicy: { enabled: false, allowlist: [], blocklist: [], alertOnUnknownIp: true },
  ssoPolicy: {
    enabled: false,
    provider: "okta",
    attributeMapping: { email: "email", name: "displayName", role: "groups" },
    enforceSso: false,
    allowLocalFallback: true,
  },
  offboardingPolicy: {
    requireApproval: true,
    approvalRoles: ["admin", "super-admin"],
    autoRevokeTokens: true,
    revokeSessions: true,
    exportDataBeforeDelete: true,
    retainDataDays: 30,
    notifyUser: true,
  },
  roleChangePolicy: {
    requireApproval: true,
    approvalRoles: ["super-admin"],
    notifyUser: true,
    auditAllChanges: true,
    cooldownHours: 24,
  },
  securityEvents: [],
  lastProcessedSeq: 0,
};

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "operator-security";
let state: SecurityStateType = loadDemoState(SLOT, securityStateSchema, DEFAULT_STATE);
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useSecurityVersion(): number {
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

/* ------------------------------------------------------------------ */
/* Policy management (each mutation persists + audits)                 */
/* ------------------------------------------------------------------ */

type PolicyKey =
  | "passwordPolicy"
  | "sessionPolicy"
  | "twoFactorPolicy"
  | "ipPolicy"
  | "ssoPolicy"
  | "offboardingPolicy"
  | "roleChangePolicy";

const POLICY_LABELS: Record<PolicyKey, string> = {
  passwordPolicy: "Password",
  sessionPolicy: "Session",
  twoFactorPolicy: "Two-factor",
  ipPolicy: "IP allowlist",
  ssoPolicy: "SSO",
  offboardingPolicy: "Offboarding",
  roleChangePolicy: "Role change",
};

export function getSecurityState(): SecurityState {
  return state;
}

export function updatePolicy<K extends PolicyKey>(
  key: K,
  updates: Partial<SecurityState[K]>,
  actor: string,
): void {
  const current = state[key] as Record<string, unknown>;
  state = {
    ...state,
    [key]: { ...current, ...(updates as Record<string, unknown>) },
  } as SecurityStateType;
  notify();

  recordAudit({
    action: `Updated ${POLICY_LABELS[key].toLowerCase()} policy`,
    entity: "security-policy",
    entityId: key,
    summary: `${POLICY_LABELS[key]} policy updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

/* Convenience getters used by the UI + enforcement helpers. */

export function getPasswordPolicy(): PasswordPolicy {
  return state.passwordPolicy;
}
export function getSessionPolicy(): SessionPolicy {
  return state.sessionPolicy;
}
export function getTwoFactorPolicy(): TwoFactorPolicy {
  return state.twoFactorPolicy;
}
export function getIPPolicy(): IPPolicy {
  return state.ipPolicy;
}
export function getSSOPolicy(): SSOPolicy {
  return state.ssoPolicy;
}
export function getOffboardingPolicy(): OffboardingPolicy {
  return state.offboardingPolicy;
}
export function getRoleChangePolicy(): RoleChangePolicy {
  return state.roleChangePolicy;
}

/* ------------------------------------------------------------------ */
/* Security event log                                                  */
/* ------------------------------------------------------------------ */

export function logSecurityEvent(
  event: Omit<SecurityEvent, "id" | "timestamp">,
): void {
  const entry: SecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  state.securityEvents = [entry, ...state.securityEvents].slice(0, 500);
  notify();

  emitLifecycle({
    entity: { kind: "user", id: event.userId },
    name: "security.event",
    actor: "system",
    key: `sec:${entry.id}`,
    payload: {
      type: event.type,
      userId: event.userId,
      userName: event.userName,
      severity: event.severity,
      ipAddress: event.ipAddress ?? null,
      ...event.details,
    },
  });

  if (event.severity === "critical") {
    recordAudit({
      action: `Security event: ${event.type}`,
      entity: "security-event",
      entityId: event.userId,
      summary: `${event.type} for ${event.userName} from ${event.ipAddress ?? "unknown IP"}`,
      severity: "critical",
    });
  }
}

export function getSecurityEvents(
  filters?: {
    userId?: string;
    type?: SecurityEventType;
    severity?: SecurityEvent["severity"];
  },
): SecurityEvent[] {
  let events = [...state.securityEvents];
  if (filters?.userId) events = events.filter((e) => e.userId === filters.userId);
  if (filters?.type) events = events.filter((e) => e.type === filters.type);
  if (filters?.severity) events = events.filter((e) => e.severity === filters.severity);
  return events;
}

/* ------------------------------------------------------------------ */
/* Enforcement helpers (the API other surfaces consult)                */
/* ------------------------------------------------------------------ */

export function validatePassword(
  password: string,
  policy: PasswordPolicy = state.passwordPolicy,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < policy.minLength)
    errors.push(`Must be at least ${policy.minLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    errors.push("Must contain an uppercase letter");
  if (policy.requireLowercase && !/[a-z]/.test(password))
    errors.push("Must contain a lowercase letter");
  if (policy.requireNumbers && !/\d/.test(password)) errors.push("Must contain a digit");
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?/]/.test(password))
    errors.push("Must contain a special character");
  return { valid: errors.length === 0, errors };
}

function ipMatches(ip: string, pattern: string): boolean {
  if (pattern.includes("/")) {
    // CIDR — prefix match on the network portion (demo-grade, documented).
    const [subnet, bitsStr] = pattern.split("/");
    const bits = Number(bitsStr);
    if (!Number.isFinite(bits)) return false;
    const octets = Math.floor(bits / 8);
    const ipParts = ip.split(".");
    const subParts = subnet.split(".");
    for (let i = 0; i < octets; i++) {
      if (ipParts[i] !== subParts[i]) return false;
    }
    return true;
  }
  return ip === pattern;
}

export function isIPAllowed(ip: string): boolean {
  const policy = state.ipPolicy;
  if (!policy.enabled) return true;
  if (policy.blocklist.some((b) => ipMatches(ip, b))) return false;
  if (policy.allowlist.length > 0)
    return policy.allowlist.some((a) => ipMatches(ip, a));
  return true;
}

/** True when the operator's role MUST have 2FA under the policy. */
export function checkTwoFactorRequired(role: string): boolean {
  const policy = state.twoFactorPolicy;
  if (!policy.enabled) return false;
  if (policy.enforceForAllRoles) return true;
  return policy.enforceForRoles.includes(role);
}

export function checkSessionTimeout(lastActivityAt: string): {
  timedOut: boolean;
  remainingMinutes: number;
} {
  const idleMinutes = (Date.now() - new Date(lastActivityAt).getTime()) / 60_000;
  const limit = state.sessionPolicy.idleTimeoutMinutes;
  return {
    timedOut: idleMinutes >= limit,
    remainingMinutes: Math.max(0, Math.round(limit - idleMinutes)),
  };
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

function freshEvents(log: LifecycleEvent[]): LifecycleEvent[] {
  const fresh: LifecycleEvent[] = [];
  let max = state.lastProcessedSeq;
  for (const e of log) {
    const seq = Number(String(e.id).split(":")[0]);
    if (!Number.isFinite(seq)) continue;
    if (seq <= state.lastProcessedSeq) continue;
    fresh.push(e);
    if (seq > max) max = seq;
  }
  if (fresh.length) {
    state.lastProcessedSeq = max;
    saveDemoState(SLOT, state);
  }
  return fresh;
}

export function useSecurityEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  useEffect(() => {
    for (const e of freshEvents(log)) {
      // Password rotation (emitted by account password-reset flows).
      if (e.name === "account.password-reset") {
        logSecurityEvent({
          type: "password-changed",
          userId: typeof e.payload?.userId === "string" ? e.payload.userId : e.entity.id,
          userName:
            typeof e.payload?.name === "string" ? e.payload.name : e.entity.id,
          details: { source: "lifecycle:account.password-reset" },
          severity: "info",
        });
      } else if (e.name === "account.blocked") {
        // Suspension/offboarding of an operator-adjacent account: revoke
        // posture is recorded so the trail shows tokens were killed.
        logSecurityEvent({
          type: "offboarding-initiated",
          userId: typeof e.payload?.userId === "string" ? e.payload.userId : e.entity.id,
          userName:
            typeof e.payload?.name === "string" ? e.payload.name : e.entity.id,
          details: { source: "lifecycle:account.blocked" },
          severity: "warning",
        });
      } else if (e.name === "account.re-enabled") {
        logSecurityEvent({
          type: "login-success",
          userId: typeof e.payload?.userId === "string" ? e.payload.userId : e.entity.id,
          userName:
            typeof e.payload?.name === "string" ? e.payload.name : e.entity.id,
          details: { source: "lifecycle:account.re-enabled" },
          severity: "info",
        });
      }
    }
  }, [log]);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getSecurityStats(): {
  totalEvents: number;
  criticalEvents: number;
  warningEvents: number;
  failedLogins: number;
  passwordChanges: number;
  roleChanges: number;
  tokenRevocations: number;
} {
  const events = state.securityEvents;
  return {
    totalEvents: events.length,
    criticalEvents: events.filter((e) => e.severity === "critical").length,
    warningEvents: events.filter((e) => e.severity === "warning").length,
    failedLogins: events.filter((e) => e.type === "login-failed").length,
    passwordChanges: events.filter((e) => e.type === "password-changed").length,
    roleChanges: events.filter((e) => e.type === "role-changed").length,
    tokenRevocations: events.filter((e) => e.type === "token-revoked").length,
  };
}
