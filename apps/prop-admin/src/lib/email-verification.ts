/**
 * Email verification state (audit D #5).
 *
 * Single source for the operator's email-verified flag, shared by the
 * `/verify-email` workflow and the profile status indicator so the two
 * surfaces can never disagree. Persisted in localStorage (frontend-only
 * demo, no backend). Defaults to unverified — a new operator sees the
 * verification prompt until they complete it.
 */

export const EMAIL_VERIFIED_KEY = "pfaas:prop:emailVerified";

/** Verified? Safe during SSR — defaults to false (unverified). */
export function isEmailVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EMAIL_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the verified flag (or clear it when an address changes). */
export function setEmailVerified(verified: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (verified) {
      window.localStorage.setItem(EMAIL_VERIFIED_KEY, "1");
    } else {
      window.localStorage.removeItem(EMAIL_VERIFIED_KEY);
    }
  } catch {
    /* storage unavailable — flag stays session-local */
  }
}
