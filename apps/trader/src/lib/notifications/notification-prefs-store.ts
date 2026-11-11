"use client";

/**
 * Notification channel preferences store (R5-H3 / rule R10).
 *
 * The preferences page used to no-op on save while its toast claimed
 * "a preference-change audit entry was recorded". This module is the
 * single write path for the trader's channel matrix + quiet hours:
 * localStorage slot, schema-validated load, honest failure signal so
 * the page can toast what actually happened.
 *
 * No lifecycle event is emitted: the catalog has no preferences event,
 * and rule R8 forbids adding one without a consumer surface.
 */

export type PrefChannel = "Email" | "SMS" | "WhatsApp" | "Push" | "In-app";
export type PrefCategoryId =
  | "security"
  | "payouts"
  | "challenges"
  | "trading"
  | "marketing"
  | "community";

export const PREF_CHANNELS: PrefChannel[] = [
  "Email",
  "SMS",
  "WhatsApp",
  "Push",
  "In-app",
];
export const PREF_CATEGORIES: PrefCategoryId[] = [
  "security",
  "payouts",
  "challenges",
  "trading",
  "marketing",
  "community",
];

export type PrefMatrix = Record<PrefCategoryId, Record<PrefChannel, boolean>>;

export interface QuietHours {
  start: string;
  end: string;
  tz: string;
}

export interface NotificationPrefsState {
  matrix: PrefMatrix;
  quiet: QuietHours;
  savedAt: string;
}

const STORAGE_KEY = "terra-notification-prefs";

function isValidMatrix(value: unknown): value is PrefMatrix {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, Record<string, unknown>>;
  return PREF_CATEGORIES.every((cat) =>
    PREF_CHANNELS.every((ch) => typeof m[cat]?.[ch] === "boolean"),
  );
}

function isValidQuiet(value: unknown): value is QuietHours {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.start === "string" &&
    typeof q.end === "string" &&
    typeof q.tz === "string"
  );
}

/** Schema-validated load — corrupted/partial state yields null (page
 *  falls back to policy defaults). */
export function readNotificationPrefs(): NotificationPrefsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefsState>;
    if (!isValidMatrix(parsed.matrix) || !isValidQuiet(parsed.quiet)) return null;
    return {
      matrix: parsed.matrix,
      quiet: parsed.quiet,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable so the caller can toast
 *  the truth instead of claiming a save that didn't happen. */
export function writeNotificationPrefs(
  state: Omit<NotificationPrefsState, "savedAt">,
): boolean {
  try {
    const payload: NotificationPrefsState = {
      ...state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearNotificationPrefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best effort */
  }
}
