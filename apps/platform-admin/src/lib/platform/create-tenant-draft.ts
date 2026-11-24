/**
 * Create-tenant draft persistence — create-tenant report, P1-3.
 *
 * The wizard kept every field in component-local `useState`, so a refresh
 * (or the previously unconfirmed Cancel) silently destroyed up to five
 * steps of configuration while the onboarding run kept its timestamps.
 * Drafts are now persisted under a `pfaas:*` key, matching how the
 * platform already persists operator state (`pfaas:customTenants`,
 * `pfaas:theme`), and restored through a Resume / Discard banner.
 *
 * The draft is deliberately generic over the state shape: the wizard owns
 * `WizardState`; this module only owns versioning, storage and the
 * quota-safe try/catch every other `pfaas:*` writer uses.
 */

export const CREATE_TENANT_DRAFT_KEY = "pfaas:createTenantDraft";

/**
 * Bump when the wizard state shape changes incompatibly — `loadDraft`
 * refuses to resume a draft it cannot interpret rather than hydrating a
 * half-broken form.
 */
export const CREATE_TENANT_DRAFT_VERSION = 1;

export interface CreateTenantDraft<TState> {
  version: number;
  state: TState;
  /** 0-based wizard step the operator had reached. */
  step: number;
  /** Template chip that seeded the state, if any (UI marker only). */
  activeTemplate: string | null;
  savedAt: string;
}

/** Persist a draft. Never throws — storage failures must not break typing. */
export function saveDraft<TState>(draft: CreateTenantDraft<TState>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CREATE_TENANT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota or private-mode failure — draft persistence is best-effort */
  }
}

/** Read the stored draft, or `null` when absent / unreadable / stale. */
export function loadDraft<TState>(): CreateTenantDraft<TState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CREATE_TENANT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateTenantDraft<TState>>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== CREATE_TENANT_DRAFT_VERSION ||
      !parsed.state ||
      typeof parsed.state !== "object" ||
      typeof parsed.step !== "number" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    return parsed as CreateTenantDraft<TState>;
  } catch {
    return null;
  }
}

/** Drop the draft — on successful create, or when the operator discards. */
export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CREATE_TENANT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
