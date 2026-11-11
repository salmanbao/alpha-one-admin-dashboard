/**
 * session-store.ts — Demo session + identity spine for the trader app.
 *
 * R4-01 — login validates against this store and writes the active session.
 * Signup stores the registered account here so login can authenticate.
 * "Continue as demo" yields the Tom Allen persona, honestly labeled.
 *
 * Storage keys follow the pfaas:<app>:<name> convention.
 */

import type { AuthUser } from "@pfaas/platform-core";
import { useSyncExternalStore } from "react";

export interface TraderAccount {
  id: string;
  email: string;
  displayName: string;
  password: string; // demo plaintext, no hashing
  createdAt: string;
}

export interface ActiveSession {
  accountId: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  loginAt: string;
}

const ACCOUNTS_KEY = "pfaas:trader:sessionAccounts";
const SESSION_KEY = "pfaas:trader:session";

/** Demo fallback — the Tom Allen persona (honestly labeled as demo). */
export const DEMO_ACCOUNT: TraderAccount = {
  id: "demo-trader",
  email: "tom.allen@terra.trader",
  displayName: "Tom Allen",
  password: "demo123",
  createdAt: new Date().toISOString(),
};

export function readSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}

export function writeSession(session: ActiveSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* best effort */
  }
  emitSession();
}

export function removeSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* best effort */
  }
  emitSession();
}

export function continueAsDemo(): ActiveSession {
  const session: ActiveSession = {
    accountId: DEMO_ACCOUNT.id,
    email: DEMO_ACCOUNT.email,
    displayName: DEMO_ACCOUNT.displayName,
    isDemo: true,
    loginAt: new Date().toISOString(),
  };
  writeSession(session);
  return session;
}

export function registerAccount(
  account: Omit<TraderAccount, "id" | "createdAt">
): TraderAccount {
  const newAccount: TraderAccount = {
    ...account,
    id: `acc-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };

  const accounts = readAccounts();
  accounts.push(newAccount);
  writeAccounts(accounts);
  return newAccount;
}

export function readAccounts(): TraderAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TraderAccount[];
  } catch {
    return [];
  }
}

export function writeAccounts(accounts: TraderAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* best effort */
  }
}

export function findAccountByEmail(email: string): TraderAccount | null {
  return readAccounts().find((a) => a.email === email) ?? null;
}

export function verifyPassword(
  plainPassword: string,
  storedPassword: string
): boolean {
  // Demo: simple equality check
  return plainPassword === storedPassword;
}

/* ------------------------------------------------------------------ */
/* Password recovery (R5-H2 / rule R11: new auth implies recovery)     */
/* ------------------------------------------------------------------ */

const RESET_TICKET_KEY = "pfaas:trader:resetTicket";
const RESET_TTL_MS = 30 * 60 * 1000; // matches the "expires in 30 min" copy

export interface ResetTicket {
  email: string;
  accountId: string;
  token: string;
  expiresAt: number;
}

/** Issue a single-use reset ticket for a registered account (demo:
 *  the "email link" is this token — no mail is sent). */
export function createResetTicket(email: string): ResetTicket | null {
  const account = findAccountByEmail(email);
  if (!account) return null;
  const ticket: ResetTicket = {
    email: account.email,
    accountId: account.id,
    token: `rst-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    expiresAt: Date.now() + RESET_TTL_MS,
  };
  try {
    localStorage.setItem(RESET_TICKET_KEY, JSON.stringify(ticket));
  } catch {
    /* best effort */
  }
  return ticket;
}

/** Validate a token against the outstanding ticket (expired/mismatch → null). */
export function readResetTicket(token: string | null): ResetTicket | null {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(RESET_TICKET_KEY);
    if (!raw) return null;
    const ticket = JSON.parse(raw) as ResetTicket;
    if (ticket.token !== token || Date.now() > ticket.expiresAt) return null;
    return ticket;
  } catch {
    return null;
  }
}

export function clearResetTicket(): void {
  try {
    localStorage.removeItem(RESET_TICKET_KEY);
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------------------------ */
/* Login history (R5 Wave 0.5 — sessions page derives from real events) */
/* ------------------------------------------------------------------ */

const LOGIN_HISTORY_KEY = "pfaas:trader:loginHistory";
const LOGIN_HISTORY_MAX = 30;

export interface LoginHistoryEntry {
  id: string;
  at: string; // ISO timestamp of the sign-in attempt
  device: string; // parsed user agent — "Chrome • macOS"
  place: string; // timezone; the demo does no IP/geo lookup (honest)
  ok: boolean;
}

/** Best-effort user-agent label. Unknown values stay "Unknown" — the
 *  demo never fabricates a device it didn't observe. */
export function describeDevice(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} • ${os}`;
}

export function readLoginHistory(): LoginHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LoginHistoryEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as LoginHistoryEntry).id === "string" &&
        typeof (e as LoginHistoryEntry).at === "string" &&
        typeof (e as LoginHistoryEntry).ok === "boolean",
    );
  } catch {
    return [];
  }
}

/** Record a sign-in attempt (success or failure) — the sessions page's
 *  history is fed by these, not by fixtures. Returns null when storage
 *  is unavailable. */
export function recordLogin(ok: boolean): LoginHistoryEntry | null {
  const entry: LoginHistoryEntry = {
    id: `lg-${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
    device: describeDevice(),
    place:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"
        : "unknown",
    ok,
  };
  try {
    const history = readLoginHistory();
    history.unshift(entry);
    localStorage.setItem(
      LOGIN_HISTORY_KEY,
      JSON.stringify(history.slice(0, LOGIN_HISTORY_MAX)),
    );
    emitHistory();
    return entry;
  } catch {
    return null;
  }
}

/** Revoke a session by removing its history entry (persisted — the row
 *  stays gone after a reload). Returns false when storage failed. */
export function removeLoginHistory(id: string): boolean {
  try {
    const history = readLoginHistory().filter((e) => e.id !== id);
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(history));
    emitHistory();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Account deletion (R5 Wave 0.5 — real journey, no "initiated" toast)  */
/* ------------------------------------------------------------------ */

/** terra-* slots that belong to the account (terra-theme is a device
 *  preference and is intentionally left alone). */
const ACCOUNT_DATA_TERRA_KEYS = [
  "terra-inbox-state",
  "terra-notification-prefs",
  "terra-sim",
];

/** Delete the current account for real: drop its record, end the
 *  session, and clear every account-scoped storage slot (pfaas:trader:*
 *  + the terra-* data keys above). Returns false when storage failed so
 *  the caller can tell the truth either way. */
export function deleteCurrentAccount(): boolean {
  try {
    const session = readSession();
    if (session) {
      writeAccounts(
        readAccounts().filter((a) => a.id !== session.accountId),
      );
    }
    removeSession();
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("pfaas:trader:") || ACCOUNT_DATA_TERRA_KEYS.includes(key))) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
    emitSession();
    emitHistory();
    return true;
  } catch {
    return false;
  }
}

/** Rewrite a registered account's credential — the single write path
 *  password reset goes through (login keeps validating against it). */
export function updateAccountPassword(
  email: string,
  newPassword: string
): boolean {
  const accounts = readAccounts();
  const idx = accounts.findIndex(
    (a) => a.email.toLowerCase() === email.toLowerCase()
  );
  if (idx === -1) return false;
  accounts[idx] = { ...accounts[idx], password: newPassword };
  writeAccounts(accounts);
  return true;
}

/* ------------------------------------------------------------------ */
/* Reactive hooks (R5 Wave 0.5) — house pattern (competitions-store):   */
/* useSyncExternalStore over the same slots, so pages read session and  */
/* login history without setState-in-effect hydration.                  */
/* ------------------------------------------------------------------ */

const sessionListeners = new Set<() => void>();
const historyListeners = new Set<() => void>();
let sessionSnapshot: string | undefined;
let historySnapshot: string | undefined;

function emitSession(): void {
  sessionSnapshot = undefined;
  sessionListeners.forEach((l) => l());
}

function emitHistory(): void {
  historySnapshot = undefined;
  historyListeners.forEach((l) => l());
}

function subscribeSession(cb: () => void): () => void {
  sessionListeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === SESSION_KEY) emitSession();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    sessionListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSessionSnapshot(): string {
  if (sessionSnapshot === undefined) {
    sessionSnapshot = JSON.stringify(readSession());
  }
  return sessionSnapshot;
}

const SESSION_SERVER_SNAPSHOT = "null";
const getSessionServerSnapshot = (): string => SESSION_SERVER_SNAPSHOT;

/** Reactive active session (null during SSR / before hydration). */
export function useSession(): ActiveSession | null {
  const raw = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );
  return JSON.parse(raw) as ActiveSession | null;
}

function subscribeHistory(cb: () => void): () => void {
  historyListeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === LOGIN_HISTORY_KEY) emitHistory();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    historyListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getHistorySnapshot(): string {
  if (historySnapshot === undefined) {
    historySnapshot = JSON.stringify(readLoginHistory());
  }
  return historySnapshot;
}

const HISTORY_SERVER_SNAPSHOT = "[]";
const getHistoryServerSnapshot = (): string => HISTORY_SERVER_SNAPSHOT;

/** Reactive login history ([] during SSR / before hydration). */
export function useLoginHistory(): LoginHistoryEntry[] {
  const raw = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );
  return JSON.parse(raw) as LoginHistoryEntry[];
}

/** Get the current user identity for the shell (session > demo > null). */
export function getCurrentIdentity(): AuthUser | null {
  const session = readSession();
  if (!session) return null;
  return {
    id: session.accountId,
    tenantId: "tenant-terra",
    email: session.email,
    name: session.displayName,
    initials: session.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    application: "trader",
    roles: ["trader"],
    permissions: ["trader.self"],
    traderId: `trader-${session.accountId}`,
    lastActiveAt: session.loginAt,
  };
}

/** Get the default KYC identity, preferring session data over demo fallback. */
export function getDefaultKycIdentity(): {
  fullName: string;
  dob: string;
  country: string;
  phone: string;
  address: string;
  postalCode: string;
} {
  const session = readSession();
  if (session && !session.isDemo) {
    return {
      fullName: session.displayName,
      dob: "",
      country: "",
      phone: "",
      address: "",
      postalCode: "",
    };
  }
  // Demo fallback
  return {
    fullName: "Tom Allen",
    dob: "1990-04-12",
    country: "United States",
    phone: "+1 (415) 555-0142",
    address: "123 Market St, San Francisco",
    postalCode: "94103",
  };
}