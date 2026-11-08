/**
 * Verification draft — SF-01 Unified Verification Wizard.
 *
 * The trader's KYC path used to live in three screens that shared no
 * state: /account-verification-1 typed identity, /account-verification-2
 * re-collected documents and stranded the trader on submit, and
 * /kyc-onboarding repeated the whole form a third way. Identity details
 * were typed 2-3× and leaving mid-flow lost everything.
 *
 * This module owns the single draft behind the unified /verification
 * wizard, using the same sessionStorage hand-off pattern as
 * checkout-recovery (guarded access, degrades to the demo defaults in
 * SSR / privacy mode). Storage keys follow the pfaas:<app>:<name>
 * convention.
 *
 * The wizard's steps are *derived* from this draft — never from local
 * step state — so a returning trader lands on the first incomplete
 * step and never re-sees one they have already finished:
 *
 *   submitted → status → identity → documents → review
 */

/** The four steps of the unified wizard, in order. */
export type VerificationStepId = "identity" | "documents" | "review" | "status";

export const verificationSteps: { id: VerificationStepId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
  { id: "status", label: "Status" },
];

/** Parse a `?step=` deep link — null when absent or unknown. */
export function parseVerificationStep(value: string | null): VerificationStepId | null {
  return verificationSteps.some((s) => s.id === value) ? (value as VerificationStepId) : null;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type VerificationDocKey = "governmentId" | "proofOfAddress";

export interface VerificationDocFile {
  name: string;
  size: number;
  type: string;
}

export const verificationDocs: {
  key: VerificationDocKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "governmentId",
    label: "Government ID (passport or driver's license)",
    hint: "Photo must be sharp with all four corners visible.",
  },
  {
    key: "proofOfAddress",
    label: "Proof of address (utility bill < 90 days)",
    hint: "Recent bank statement, utility bill or council letter.",
  },
];

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export interface VerificationIdentity {
  fullName: string;
  dob: string;
  country: string;
  phone: string;
  address: string;
  postalCode: string;
}

/** Field order in the identity form and the review summary. */
export const identityFieldOrder: (keyof VerificationIdentity)[] = [
  "fullName",
  "dob",
  "country",
  "phone",
  "address",
  "postalCode",
];

export const identityFieldLabels: Record<keyof VerificationIdentity, string> = {
  fullName: "Full legal name",
  dob: "Date of birth",
  country: "Country of residence",
  phone: "Phone number",
  address: "Residential address",
  postalCode: "Postal code",
};

/**
 * Demo values — the trader's details are pre-filled with dummy data so
 * the flow can be walked without typing (no network calls anywhere).
 */
export const defaultIdentity: VerificationIdentity = {
  fullName: "Tom Allen",
  dob: "1990-04-12",
  country: "United States",
  phone: "+1 (415) 555-0142",
  address: "123 Market St, San Francisco",
  postalCode: "94103",
};

export const identityValidators: Record<keyof VerificationIdentity, (value: string) => string> = {
  fullName: (v) => (!v.trim() ? "Full legal name is required." : ""),
  dob: (v) => {
    if (!v.trim()) return "Date of birth is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return "Use YYYY-MM-DD format.";
    return "";
  },
  country: (v) => (!v.trim() ? "Country of residence is required." : ""),
  phone: (v) => {
    if (!v.trim()) return "Phone number is required.";
    if (v.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
    return "";
  },
  address: (v) => (!v.trim() ? "Residential address is required." : ""),
  postalCode: (v) => (!v.trim() ? "Postal code is required." : ""),
};

/* ------------------------------------------------------------------ */
/* Draft                                                               */
/* ------------------------------------------------------------------ */

export interface VerificationDraft {
  /** Identity values as typed — restored on return to the wizard. */
  identity: VerificationIdentity;
  /** The identity step was confirmed (Continue) — drives step skip. */
  identityDone: boolean;
  /** Uploaded file metadata for each required document. */
  documents: Partial<Record<VerificationDocKey, VerificationDocFile>>;
  /** The documents step was confirmed (Continue). */
  documentsDone: boolean;
  /** Submitted for review — lands the trader on the status step. */
  submitted: boolean;
  submittedAt?: string;
}

export function emptyVerificationDraft(): VerificationDraft {
  return {
    identity: { ...defaultIdentity },
    identityDone: false,
    documents: {},
    documentsDone: false,
    submitted: false,
  };
}

const DRAFT_KEY = "pfaas:trader:verificationDraft";

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort */
  }
}

function removeKey(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

/** Read the saved draft (missing/partial storage degrades to defaults). */
export function readVerificationDraft(): VerificationDraft {
  const raw = readJson<Partial<VerificationDraft>>(DRAFT_KEY);
  if (!raw) return emptyVerificationDraft();
  return {
    ...emptyVerificationDraft(),
    ...raw,
    identity: { ...defaultIdentity, ...(raw.identity ?? {}) },
    documents: { ...(raw.documents ?? {}) },
  };
}

export function writeVerificationDraft(draft: VerificationDraft): void {
  writeJson(DRAFT_KEY, draft);
}

export function clearVerificationDraft(): void {
  removeKey(DRAFT_KEY);
}

/** Both required documents are attached. */
export function documentsComplete(draft: VerificationDraft): boolean {
  return verificationDocs.every((d) => draft.documents[d.key]);
}

/**
 * The step a trader should see — completed steps are never re-rendered
 * (SF-01: "a returning user never re-sees a completed step").
 */
export function stepFromDraft(draft: VerificationDraft): VerificationStepId {
  if (draft.submitted) return "status";
  if (!draft.identityDone) return "identity";
  if (!(draft.documentsDone && documentsComplete(draft))) return "documents";
  return "review";
}
