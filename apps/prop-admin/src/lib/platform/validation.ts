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
