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

import { emitLifecycle, readLifecycleLog, type LifecycleEventName } from "@pfaas/lifecycle";
import { getDefaultKycIdentity } from "@/lib/session-store";

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
 * R4-01: the KYC pre-fill base is session-aware — `getDefaultKycIdentity()`
 * from the session store (signup identity for registered users, the Tom
 * Allen demo persona only as the honest demo fallback). The old hardcoded
 * `defaultIdentity` constant is gone so no restore path can pre-fill
 * "Tom Allen" over a real signup.
 */

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

/**
 * Review lifecycle for a verification submission.
 *
 *   not-started  → nothing done yet (dashboard shows "Not started")
 *   draft        → identity/documents being worked on, not yet sent
 *   submitted    → just handed in, awaiting first review
 *   in-review    → actively under compliance review
 *   approved     → KYC approved, payouts unlocked
 *   rejected     → sent back with reasons; attempts count toward maxAttempts
 */
export type VerificationReviewStatus =
  | "not-started"
  | "draft"
  | "submitted"
  | "in-review"
  | "approved"
  | "rejected";

const submittedReviewStatuses: VerificationReviewStatus[] = [
  "submitted",
  "in-review",
  "approved",
  "rejected",
];

export function isVerificationSubmitted(draft: VerificationDraft): boolean {
  return submittedReviewStatuses.includes(draft.reviewStatus);
}

export interface VerificationDraft {
  /** Identity values as typed — restored on return to the wizard. */
  identity: VerificationIdentity;
  /** The identity step was confirmed (Continue) — drives step skip. */
  identityDone: boolean;
  /** Uploaded file metadata for each required document. */
  documents: Partial<Record<VerificationDocKey, VerificationDocFile>>;
  /** The documents step was confirmed (Continue). */
  documentsDone: boolean;
  /**
   * Where the submission is in the review lifecycle — the single source
   * of truth for "where is my KYC" read by the dashboard card, payout
   * eligibility and the status step (W1-02).
   */
  reviewStatus: VerificationReviewStatus;
  /** Submitted for review — lands the trader on the status step. */
  submitted: boolean;
  submittedAt?: string;
  /** Resubmission attempts used / allowed (retry path). */
  attempts: number;
  maxAttempts: number;
  /** Set when reviewStatus === "rejected" — plain-language reasons. */
  rejectionReasons?: string[];
}

export function emptyVerificationDraft(): VerificationDraft {
  return {
    identity: { ...getDefaultKycIdentity() },
    identityDone: false,
    documents: {},
    documentsDone: false,
    reviewStatus: "not-started",
    submitted: false,
    attempts: 0,
    maxAttempts: 3,
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
/**
 * Deterministic, time-seeded review resolver (R2-01).
 *
 * On read, advances submitted KYC through the review lifecycle:
 *   submitted  → in-review  after REVIEW_START_HOURS
 *   in-review  → approved | rejected  after REVIEW_DECISION_HOURS
 *
 * The approved/rejected split is seeded from submittedAt (stable, no
 * randomness). Rejections increment attempts; at maxAttempts the next
 * verdict is forced approved (demo mercy rule).
 *
 * Resolved state is persisted back to sessionStorage so attempts and
 * timestamps stay consistent across reads.
 */
const REVIEW_START_HOURS = 1; // submitted → in-review
const REVIEW_DECISION_HOURS = 4; // in-review → verdict (from submittedAt)

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function resolveReviewStatus(draft: VerificationDraft): VerificationDraft {
  const { reviewStatus, submittedAt, attempts, maxAttempts } = draft;
  if (
    reviewStatus !== "submitted" &&
    reviewStatus !== "in-review"
  ) {
    return draft;
  }
  if (!submittedAt) return draft;

  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(submittedMs)) return draft;

  const now = Date.now();
  const elapsedHours = (now - submittedMs) / (1000 * 60 * 60);

  // submitted → in-review
  if (reviewStatus === "submitted" && elapsedHours >= REVIEW_START_HOURS) {
    const advanced: VerificationDraft = { ...draft, reviewStatus: "in-review" };
    if (elapsedHours < REVIEW_DECISION_HOURS) {
      writeVerificationDraft(advanced);
      return advanced;
    }
    // fall through to verdict resolution
    return resolveVerdict({ ...advanced }, submittedAt, attempts, maxAttempts);
  }

  // in-review → verdict
  if (reviewStatus === "in-review" && elapsedHours >= REVIEW_DECISION_HOURS) {
    return resolveVerdict(draft, submittedAt, attempts, maxAttempts);
  }

  return draft;
}

function resolveVerdict(
  draft: VerificationDraft,
  submittedAt: string,
  attempts: number,
  maxAttempts: number,
): VerificationDraft {
  // Deterministic 85% approved / 15% rejected, seeded by submission time
  const roll = hashSeed(submittedAt) % 100;
  const wouldApprove = roll < 85;

  if (wouldApprove || attempts >= maxAttempts) {
    const resolved: VerificationDraft = {
      ...draft,
      reviewStatus: "approved",
      rejectionReasons: undefined,
    };
    writeVerificationDraft(resolved);
    return resolved;
  }

  // Rejection: increment attempts
  const nextAttempts = attempts + 1;
  const reasons = rejectionReasonPool(hashSeed(submittedAt + String(nextAttempts)));
  const resolved: VerificationDraft = {
    ...draft,
    reviewStatus: "rejected",
    attempts: nextAttempts,
    rejectionReasons: reasons,
  };
  writeVerificationDraft(resolved);
  return resolved;
}

function rejectionReasonPool(seed: number): string[] {
  const pools = [
    ["Document image is blurry — re-upload a clear photo with all corners visible."],
    [
      "Name on ID does not match the account name.",
      "Proof of address is older than 90 days.",
    ],
    ["Selfie does not clearly match the ID photo — retake in good lighting."],
  ];
  return pools[seed % pools.length];
}

/**
 * R3-01 — the firm's verdict wins over the local seeded reviewer.
 *
 * prop-admin decides the intake row it derived from this submission
 * under `intake:<kyc.submitted event id>` (cross-app-intake.ts), never
 * under the trader's `self` entity — so a terminal `kyc.approved` /
 * `kyc.rejected` on that intake entity IS the operator's decision for
 * THIS draft. Adopt it (persisted once; the time-seeded resolver then
 * stops because the status is terminal, so the two can't fight).
 */
function foldAdminVerdict(draft: VerificationDraft): VerificationDraft {
  const log = readLifecycleLog();
  const submitted = [...log].reverse().find(
    (e) =>
      e.actor === "trader" &&
      e.name === "kyc.submitted" &&
      e.entity.kind === "kyc" &&
      e.entity.id === "self",
  );
  if (!submitted) return draft;
  const intakeId = `intake:${submitted.id}`;
  const verdict = [...log].reverse().find(
    (e) =>
      e.entity.kind === "kyc" &&
      e.entity.id === intakeId &&
      (e.name === "kyc.approved" || e.name === "kyc.rejected"),
  );
  if (!verdict) return draft;
  const want: VerificationReviewStatus = verdict.name === "kyc.approved" ? "approved" : "rejected";
  if (draft.reviewStatus === want) return draft;
  const reason =
    typeof verdict.payload?.reason === "string" && verdict.payload.reason.trim()
      ? verdict.payload.reason
      : null;
  const folded: VerificationDraft = {
    ...draft,
    reviewStatus: want,
    rejectionReasons:
      want === "rejected"
        ? reason
          ? [reason]
          : (draft.rejectionReasons ?? ["Rejected by the reviewing officer."])
        : undefined,
  };
  writeVerificationDraft(folded);
  return folded;
}

export function readVerificationDraft(): VerificationDraft {
  const raw = readJson<Partial<VerificationDraft>>(DRAFT_KEY);
  if (!raw) return emptyVerificationDraft();
  const draft: VerificationDraft = {
    ...emptyVerificationDraft(),
    ...raw,
    identity: { ...getDefaultKycIdentity(), ...(raw.identity ?? {}) },
    documents: { ...(raw.documents ?? {}) },
  };
  return foldAdminVerdict(resolveReviewStatus(draft));
}

/**
 * Raw read that does NOT run the review resolver — required inside
 * `writeVerificationDraft` (reading through the resolver from within a
 * write would recurse: resolver → write → resolver…).
 */
function peekDraft(): VerificationDraft | null {
  const raw = readJson<Partial<VerificationDraft>>(DRAFT_KEY);
  if (!raw) return null;
  return {
    ...emptyVerificationDraft(),
    ...raw,
    identity: { ...getDefaultKycIdentity(), ...(raw.identity ?? {}) },
    documents: { ...(raw.documents ?? {}) },
  };
}

/** reviewStatus → lifecycle event (R2-W3-01 publish point). */
const REVIEW_EVENT: Partial<Record<VerificationReviewStatus, LifecycleEventName>> = {
  submitted: "kyc.submitted",
  "in-review": "kyc.reviewing",
  approved: "kyc.approved",
  rejected: "kyc.rejected",
};

/**
 * Single write path for the KYC draft — also the event chokepoint
 * (R2-W3-01): any transition of `reviewStatus` publishes one typed event
 * to `@pfaas/lifecycle`. The status card, journey checklist and (across
 * apps, via the shared log) prop-admin's queue all update from that one
 * emission; nothing polls this store.
 *
 * The emission is idempotent on `${attempts}:${reviewStatus}`, so the
 * time-seeded resolver re-writing the same verdict can never stack
 * duplicate events.
 */
export function writeVerificationDraft(draft: VerificationDraft): void {
  const prev = peekDraft();
  writeJson(DRAFT_KEY, draft);

  const changed = !prev || prev.reviewStatus !== draft.reviewStatus;
  if (!changed) return;
  const eventName = REVIEW_EVENT[draft.reviewStatus];
  if (!eventName) return;
  emitLifecycle({
    entity: { kind: "kyc", id: "self" },
    name: eventName,
    actor: "trader",
    key: `${draft.attempts}:${draft.reviewStatus}`,
    payload: {
      status: draft.reviewStatus,
      attempts: draft.attempts,
      submittedAt: draft.submittedAt ?? null,
      rejectionReasons: draft.rejectionReasons ?? [],
      // Real form input carried across the demo transport so prop-admin's
      // queue shows the applicant, not a placeholder (R2-W3-01).
      applicant: draft.identity.fullName,
      country: draft.identity.country,
    },
  });
}

export function clearVerificationDraft(): void {
  removeKey(DRAFT_KEY);
}

/**
 * Demo fast-forward: push submittedAt back far enough that the
 * resolver immediately reaches a verdict on next read. Used by the
 * ?fast-forward=1 demo control on the verification page.
 */
export function fastForwardVerification(): void {
  const draft = readVerificationDraft();
  if (draft.reviewStatus !== "submitted" && draft.reviewStatus !== "in-review") return;
  const past = new Date(Date.now() - (REVIEW_DECISION_HOURS + 1) * 60 * 60 * 1000).toISOString();
  writeVerificationDraft({ ...draft, submittedAt: past });
}

/** Both required documents are attached. */
export function documentsComplete(draft: VerificationDraft): boolean {
  return verificationDocs.every((d) => draft.documents[d.key]);
}

/**
 * The step a trader should see — completed steps are never re-rendered
 * (SF-01: "a returning user never re-sees a completed step"). A draft
 * that has been handed in (submitted or beyond) always opens on status.
 */
export function stepFromDraft(draft: VerificationDraft): VerificationStepId {
  if (isVerificationSubmitted(draft)) return "status";
  if (!draft.identityDone) return "identity";
  if (!(draft.documentsDone && documentsComplete(draft))) return "documents";
  return "review";
}
