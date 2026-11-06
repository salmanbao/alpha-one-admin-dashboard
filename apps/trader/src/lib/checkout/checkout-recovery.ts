/**
 * Checkout recovery — shared data + cross-route state (audit finding #1).
 *
 * The challenge-purchase failure path spans three recovery routes
 * (/checkout-failure, /promo-error, /checkout-validation) plus the
 * checkout form itself. This module owns the data all of them read and
 * the sessionStorage hand-offs that survive the route round-trip:
 *
 *   • failure context — reason + the exact order (method, amount,
 *     challenge), written by CheckoutPage immediately before it routes
 *     to /checkout-failure so the recovery screen can name what failed.
 *   • pay-attempt counter — the deterministic failure cycle (attempts
 *     1–2 fail through the reason catalog, attempt 3 succeeds) must
 *     survive leaving the form; an in-component ref would reset on
 *     every navigation and every retry would be "attempt 1".
 *   • validation draft — the billing values behind a failed submit, so
 *     checkout restores them on return and /checkout-validation can
 *     show the exact field errors instead of a generic checklist.
 *
 * Storage keys follow the pfaas:<app>:<name> convention. Every access
 * is guarded (SSR / privacy mode) and degrades to null.
 */

/** Payment methods — shared by checkout and the failure route. */
export const paymentMethods = [
  { id: "card", label: "Credit / Debit Card", note: "Visa, Mastercard, Amex" },
  { id: "crypto", label: "Crypto (USDT)", note: "TRC-20 / ERC-20" },
  { id: "paypal", label: "PayPal", note: "Buyer protection" },
] as const;

export type PaymentMethodId = (typeof paymentMethods)[number]["id"];

/**
 * Failure reason catalog — each entry is a specific, actionable
 * explanation (title + detail + fix) so the recovery screen can tell
 * the trader exactly what went wrong and how to clear it.
 */
export const paymentFailureReasons = [
  {
    code: "insufficient_funds",
    title: "Insufficient funds",
    detail: "Your card or account doesn't have enough balance to cover this purchase.",
    fix: "Check your balance, or try a different payment method below.",
  },
  {
    code: "card_declined",
    title: "Card declined",
    detail: "Your bank or card issuer declined this transaction.",
    fix: "Contact your bank to approve the charge, or try another card.",
  },
  {
    code: "expired_card",
    title: "Card expired",
    detail: "The card used for this purchase has passed its expiry date.",
    fix: "Update the expiry date and CVV, or switch to another card or payment method.",
  },
  {
    code: "network_timeout",
    title: "Network timeout",
    detail: "The payment didn't complete because the connection dropped.",
    fix: "Check your internet connection and try again.",
  },
] as const;

export type PaymentFailureCode = (typeof paymentFailureReasons)[number]["code"];

/** Promo codes accepted in this demo — checkout applies them, the
 *  /promo-error route offers them as working alternatives. */
export const promos: Record<string, { percent: number; label: string }> = {
  TERRA10: { percent: 10, label: "10% off" },
  FLASH25: { percent: 25, label: "25% off Flash accounts" },
};

/** Billing validation — shared by checkout (submit) and the
 *  /checkout-validation route (replays the same rules on the draft so
 *  both surfaces report identical errors). */
export const billingValidators = {
  firstName: (v: string) => (!v.trim() ? "First name is required." : ""),
  lastName: (v: string) => (!v.trim() ? "Last name is required." : ""),
  email: (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
    return "";
  },
  country: (v: string) => (!v.trim() ? "Country is required." : ""),
};

export type BillingField = keyof typeof billingValidators;

/** Display order for billing fields — matches the form's grid order. */
export const billingFieldOrder: BillingField[] = ["firstName", "lastName", "email", "country"];

export const billingFieldLabels: Record<BillingField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  country: "Country",
};

/** Per-field correction guidance for /checkout-validation — the
 *  validator messages say WHAT is wrong, these say how to fix it. */
export const billingFieldFixes: Record<BillingField, string> = {
  firstName: "Enter your first name as it appears on your payment method.",
  lastName: "Enter your last name as it appears on your payment method.",
  email: "Use an address you can access — purchase receipts and provisioning updates go here.",
  country: "Select the country your payment method is issued in.",
};

/* ------------------------------------------------------------------ */
/* Cross-route session state (guarded — SSR / privacy mode safe)       */
/* ------------------------------------------------------------------ */

const FAILURE_KEY = "pfaas:trader:checkoutFailure";
const ATTEMPTS_KEY = "pfaas:trader:payAttempts";
const DRAFT_KEY = "pfaas:trader:checkoutDraft";

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

/** The order that just failed — written before routing to
 *  /checkout-failure, read by that route's recovery screen. */
export interface CheckoutFailureContext {
  reason: PaymentFailureCode;
  methodId: PaymentMethodId;
  amountLabel: string;
  challenge: string;
  attempt: number;
}

export function writeCheckoutFailure(ctx: CheckoutFailureContext): void {
  writeJson(FAILURE_KEY, ctx);
}

export function readCheckoutFailure(): CheckoutFailureContext | null {
  return readJson<CheckoutFailureContext>(FAILURE_KEY);
}

export function clearCheckoutFailure(): void {
  removeKey(FAILURE_KEY);
}

/** 1-based pay attempt count for this session. Read → bump → compare
 *  (attempt % 3 !== 0 fails, attempt 3 succeeds and resets). */
export function readPayAttempt(): number {
  try {
    const n = Number(sessionStorage.getItem(ATTEMPTS_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Increment and persist the attempt counter; returns the new count. */
export function bumpPayAttempt(): number {
  const next = readPayAttempt() + 1;
  try {
    sessionStorage.setItem(ATTEMPTS_KEY, String(next));
  } catch {
    /* best effort */
  }
  return next;
}

/** Called when a payment succeeds so the next purchase restarts the
 *  deterministic cycle at attempt 1. */
export function resetPayAttempts(): void {
  removeKey(ATTEMPTS_KEY);
}

/** Billing values behind a failed submit — checkout restores them on
 *  return; /checkout-validation replays the validators over them. */
export type CheckoutDraft = Record<BillingField, string>;

export function writeCheckoutDraft(draft: CheckoutDraft): void {
  writeJson(DRAFT_KEY, draft);
}

export function readCheckoutDraft(): CheckoutDraft | null {
  return readJson<CheckoutDraft>(DRAFT_KEY);
}

export function clearCheckoutDraft(): void {
  removeKey(DRAFT_KEY);
}
