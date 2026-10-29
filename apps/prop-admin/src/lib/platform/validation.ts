/**
 * PFaaS Platform — Runtime Validation Schemas (zod)
 *
 * The app persists operator state in localStorage (audit session
 * entries, per-user profile patches) and accepts free-form input in
 * composers (announcements). Both cross trust boundaries — storage can
 * be corrupted or hand-edited, and form fields arrive as raw strings —
 * so every read/write validates against a schema instead of blind
 * `JSON.parse as T` casts.
 *
 * Invalid persisted payloads degrade gracefully: bad audit entries are
 * dropped (the trail keeps the valid ones), bad profile patches are
 * ignored (the seeded user wins).
 */

import { z } from "zod";
import type { AuditEntry, AuthUser } from "./types";

/* ------------------------------------------------------------------ */
/* Persisted state                                                     */
/* ------------------------------------------------------------------ */

/** One session audit entry as persisted by lib/audit.ts. */
export const auditEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().optional(),
  summary: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  module: z.string().optional(),
  tenantId: z.string().optional(),
});

/** The `pfaas:auditSession` payload — an array of entries. */
export const auditSessionSchema = z.array(auditEntrySchema);

/**
 * Parse a persisted audit-session payload, silently dropping entries
 * that don't match the schema (corrupt storage must not crash the
 * Audit page, and one bad entry must not discard the valid trail
 * around it — entries are validated individually, valid ones kept).
 */
export function parseAuditSession(raw: string): AuditEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const result = auditEntrySchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

/** Fields an operator may edit on their own profile (profile page). */
export const userPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(120).optional(),
  initials: z.string().trim().min(1).max(4).optional(),
  avatarUrl: z.string().trim().max(2048).optional(),
});

/** The `pfaas:userOverrides` payload — patch keyed by user id. */
export const userOverridesSchema = z.record(z.string(), userPatchSchema);

/**
 * Parse persisted profile overrides, dropping invalid user ids or
 * malformed patches. Never throws.
 */
export function parseUserOverrides(raw: string): Record<string, Partial<AuthUser>> {
  try {
    const parsed = userOverridesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Announcement composer                                               */
/* ------------------------------------------------------------------ */

export const announcementTypeSchema = z.enum(["info", "warning", "success", "maintenance"]);
export const announcementAudienceSchema = z.enum(["all", "active", "funded", "challenge"]);

/**
 * Announcement composer input (raw datetime-local strings — "" means
 * draft / never-expires). The refined schema enforces the conditional
 * rule the manual check used: challenge-targeted announcements must
 * name the challenge.
 */
export const announcementInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    content: z.string().trim().min(1, "Content is required").max(2000),
    type: announcementTypeSchema,
    audience: announcementAudienceSchema,
    targetChallenge: z.string(),
    publishedAt: z.string(),
    expiresAt: z.string(),
    pinned: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "challenge" && !v.targetChallenge) {
      ctx.addIssue({
        code: "custom",
        path: ["targetChallenge"],
        message: "Pick the challenge this announcement targets",
      });
    }
  });

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

/** Collect the first validation message for a field ("" = valid). */
export function announcementFieldError(
  input: AnnouncementInput,
  field: keyof AnnouncementInput,
): string {
  const result = announcementInputSchema.safeParse(input);
  if (result.success) return "";
  const issue = result.error.issues.find((i) => i.path[0] === field);
  return issue ? issue.message : "";
}

/* ------------------------------------------------------------------ */
/* Demo-session store persistence (lib/platform/demo-persistence.ts)  */
/* ------------------------------------------------------------------ */

/*
 * The nine session-scoped stores (trader, crm, kyc, payout, breach,
 * risk-case, announcement, support, evaluation) mirror their mutation
 * state into localStorage under `pfaas:demo:*` so a demo survives a
 * refresh (gap analysis quick-win #12). Payloads are validated on read:
 * corrupt or hand-edited storage falls back to the seeded data instead
 * of crashing a store. Keep the enums here in sync with the union
 * types declared in each store.
 */

/** trader-store: status overrides keyed by trader id. */
export const demoTradersSchema = z.record(
  z.string(),
  z.enum(["active", "invited", "suspended", "breached"]),
);

/** crm-store: contact patches (stage moves, notes) + deleted ids. */
export const demoCrmSchema = z.object({
  overrides: z.record(
    z.string(),
    z.object({
      stage: z.enum(["lead", "qualified", "opportunity", "customer", "churned"]).optional(),
      notes: z.string().optional(),
      owner: z.string().optional(),
      value: z.number().optional(),
      lastInteraction: z.string().optional(),
    }),
  ),
  deleted: z.array(z.string()),
});

/** kyc-store: decisions keyed by record id. */
export const demoKycSchema = z.record(
  z.string(),
  z.object({ status: z.enum(["approved", "rejected", "info-requested"]), at: z.string() }),
);

/** payout-store: decisions keyed by payout reference. */
export const demoPayoutsSchema = z.record(
  z.string(),
  z.object({
    status: z.enum(["approved", "rejected", "info-requested", "processing", "paid", "escalated"]),
    at: z.string(),
  }),
);

/** breach-store: resolved breach ids. */
export const demoBreachesSchema = z.array(z.string());

/** support-store: status overrides + in-session reply counts. */
export const demoTicketsSchema = z.object({
  statuses: z.record(z.string(), z.enum(["resolved", "in-progress"])),
  replies: z.record(z.string(), z.number().int().nonnegative()),
});

/** evaluation-store: the full effective evaluation list. */
export const demoEvaluationsSchema = z.array(
  z.object({
    id: z.string().min(1),
    traderName: z.string(),
    traderEmail: z.string(),
    accountLogin: z.string(),
    challengeName: z.string(),
    phase: z.string(),
    profitPct: z.number(),
    targetPct: z.number(),
    daysTraded: z.number().int().nonnegative(),
    minDays: z.number().int().nonnegative(),
    drawdownUsedPct: z.number(),
    requestedAt: z.string(),
    status: z.enum(["pending", "approved", "rejected", "overridden"]),
    reason: z.string().optional(),
    decidedAt: z.string().optional(),
    overrideOutcome: z.enum(["pass", "fail"]).optional(),
  }),
);

/** announcement-store: the full effective announcement list (CRUD). */
export const demoAnnouncementsSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string(),
    content: z.string(),
    type: z.enum(["info", "warning", "success", "maintenance"]),
    audience: z.enum(["all", "active", "funded", "challenge"]),
    targetChallenge: z.string().optional(),
    publishedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    pinned: z.boolean(),
    impressions: z.number().nonnegative(),
    createdAt: z.string(),
  }),
);

/** risk-case-store: per-tenant case lists + the id sequence counter. */
export const demoRiskCasesSchema = z.object({
  byTenant: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string().min(1),
        severity: z.enum(["critical", "high", "medium", "low"]),
        status: z.enum(["open", "investigating", "escalated", "action-required", "resolved", "dismissed"]),
        traderId: z.string(),
        traderName: z.string(),
        accountIds: z.array(z.string()),
        signal: z.string(),
        signalDetail: z.string(),
        currentExposure: z.number(),
        payoutHold: z.boolean(),
        payoutHoldAmount: z.number(),
        opened: z.string(),
        age: z.string(),
        assignedTo: z.string(),
        evidence: z.array(z.string()),
        notes: z.array(z.string()),
        resolution: z.string().optional(),
        actionTaken: z.enum(["warned", "account_closed", "payout_blocked", "none"]).optional(),
        resolvedAt: z.string().optional(),
      }),
    ),
  ),
  seq: z.number().int().positive(),
});
