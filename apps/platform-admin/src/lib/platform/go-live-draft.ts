/**
 * Go-live wizard draft persistence — go-live report, P1-b.
 *
 * The wizard persisted PROGRESS (tenant, step, completed) through
 * `go-live-store`, but the step-① form and the step-⑤ risk draft were
 * plain component state: a refresh mid-step resumed at the right step
 * with an empty form. This module snapshots the unsaved input so a
 * refresh (or a closed tab) costs nothing, mirrored from
 * `create-tenant-draft.ts`: versioned, quota-safe try/catch, restored
 * through a Resume / Discard prompt on boot.
 *
 * Only the values that never reached a target store live here — plan,
 * KYC, connector and risk choices that were SAVED are read back from
 * their stores by the review step, never from this draft.
 */

export const GO_LIVE_DRAFT_KEY = "pfaas:platform-admin:go-live-draft";

/**
 * Bump when the drafted shape changes incompatibly — `loadGoLiveDraft`
 * refuses to resume a draft it cannot interpret rather than hydrating a
 * half-broken form.
 */
export const GO_LIVE_DRAFT_VERSION = 1;

export interface GoLiveDraft<TForm, TRisk> {
  version: number;
  /** Step-① mode the operator was in. */
  mode: "new" | "existing";
  /** Step-① form fields (never written to a store until saved). */
  form: TForm;
  /** Step-⑤ risk draft — null while the stored values are shown. */
  riskDraft: TRisk | null;
  /** 0-based wizard step the operator had reached (display only — the
   *  authoritative cursor lives in `go-live-store`). */
  step: number;
  savedAt: string;
}

/** Persist a draft. Never throws — storage failures must not break typing. */
export function saveGoLiveDraft<TForm, TRisk>(draft: GoLiveDraft<TForm, TRisk>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GO_LIVE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota or private-mode failure — draft persistence is best-effort */
  }
}

/** Read the stored draft, or `null` when absent / unreadable / stale. */
export function loadGoLiveDraft<TForm, TRisk>(): GoLiveDraft<TForm, TRisk> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GO_LIVE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GoLiveDraft<TForm, TRisk>>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== GO_LIVE_DRAFT_VERSION ||
      (parsed.mode !== "new" && parsed.mode !== "existing") ||
      !parsed.form ||
      typeof parsed.form !== "object" ||
      typeof parsed.step !== "number" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    return parsed as GoLiveDraft<TForm, TRisk>;
  } catch {
    return null;
  }
}

/** Drop the draft — on run completion, restart, or operator discard. */
export function clearGoLiveDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GO_LIVE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
