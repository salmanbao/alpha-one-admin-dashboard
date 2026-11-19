"use client";

/**
 * API-key store — the persistent write-path behind API Keys (gap S-16's
 * create/rotate/revoke share in P0-2; those actions used to be toasts
 * on a page-local const).
 *
 * Create/rotate/revoke are maker-checker actions (S-09): the form or
 * row action stages the mutation on a two-operator approval request and
 * `applyApiKeyApproval` lands it with an audit row the moment operator
 * B approves. Scope/expiry/IP-binding depth (S-16) lands in P0-4.
 */

import { useMemo, useSyncExternalStore } from "react";
import { recordAudit, type ApprovalRequest } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:api-keys";

const DAY = 86_400_000;
/** Seed timestamps only — relative to now so no absolute dates hard-code (R10). */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

export type ApiKeyStatus = "active" | "revoked" | "expired";

export interface StoredApiKey {
  id: string;
  name: string;
  tenant: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsed: string;
  createdAt: string;
  prefix: string;
  rateLimitTier: string;
  /** Set when the secret was last rotated through the approval flow. */
  rotatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Seed (moved from api-keys-page — was a page-local const)            */
/* ------------------------------------------------------------------ */

const API_KEY_SEED: StoredApiKey[] = [
  { id: "key-001", name: "Alpha Capital — Production", tenant: "Alpha Capital", scopes: ["read:accounts", "write:trades", "read:balances"], status: "active", lastUsed: daysAgo(0), createdAt: daysAgo(308), prefix: "sk_live_a1b2…", rateLimitTier: "enterprise" },
  { id: "key-002", name: "Alpha Capital — Staging", tenant: "Alpha Capital", scopes: ["read:accounts", "read:trades"], status: "active", lastUsed: daysAgo(1), createdAt: daysAgo(308), prefix: "sk_test_c3d4…", rateLimitTier: "development" },
  { id: "key-003", name: "Beta Trading — Integration", tenant: "Beta Trading", scopes: ["read:accounts", "write:orders", "read:positions"], status: "active", lastUsed: daysAgo(1), createdAt: daysAgo(272), prefix: "sk_live_e5f6…", rateLimitTier: "standard" },
  { id: "key-004", name: "Gamma Futures — Webhook Receiver", tenant: "Gamma Futures", scopes: ["read:accounts"], status: "revoked", lastUsed: daysAgo(40), createdAt: daysAgo(349), prefix: "sk_live_g7h8…", rateLimitTier: "standard" },
  { id: "key-005", name: "Gamma Futures — Mobile App", tenant: "Gamma Futures", scopes: ["read:accounts", "read:trades", "write:trades"], status: "active", lastUsed: daysAgo(2), createdAt: daysAgo(254), prefix: "sk_live_i9j0…", rateLimitTier: "enterprise" },
  { id: "key-006", name: "Alpha Capital — Reporting", tenant: "Alpha Capital", scopes: ["read:accounts", "read:reports"], status: "active", lastUsed: daysAgo(3), createdAt: daysAgo(232), prefix: "sk_live_k1l2…", rateLimitTier: "standard" },
  { id: "key-007", name: "Beta Trading — Analytics Export", tenant: "Beta Trading", scopes: ["read:analytics", "read:reports"], status: "active", lastUsed: daysAgo(4), createdAt: daysAgo(191), prefix: "sk_live_m3n4…", rateLimitTier: "standard" },
  { id: "key-008", name: "Legacy — Old Integration", tenant: "Alpha Capital", scopes: ["read:accounts"], status: "revoked", lastUsed: daysAgo(95), createdAt: daysAgo(383), prefix: "sk_live_o5p6…", rateLimitTier: "development" },
];

/** Scope builder options for the create form (seed union). */
export const API_SCOPES: string[] = Array.from(
  new Set(API_KEY_SEED.flatMap((k) => k.scopes)),
).sort();

export const RATE_LIMIT_TIERS = ["development", "standard", "enterprise"] as const;

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): StoredApiKey[] {
  if (typeof window === "undefined") return API_KEY_SEED;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    // Whole-list snapshot so created/rotated/revoked state survives
    // reloads without the seed resurrecting old rows.
    if (Array.isArray(stored)) {
      const valid = stored.filter(
        (k): k is StoredApiKey =>
          !!k && typeof k === "object" && typeof (k as StoredApiKey).id === "string",
      );
      if (valid.length > 0) return valid;
    }
  } catch {
    /* fall through to seed */
  }
  return API_KEY_SEED;
}

function writeRaw(next: StoredApiKey[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function readApiKeys(): StoredApiKey[] {
  return readRaw().map((k) => ({ ...k }));
}

export function useApiKeys(): StoredApiKey[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(API_KEY_SEED),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as StoredApiKey[]).map((k) => ({ ...k }));
    } catch {
      return API_KEY_SEED.map((k) => ({ ...k }));
    }
  }, [snapshot]);
}

/* ------------------------------------------------------------------ */
/* Approval-bridge mutation (S-09)                                     */
/* ------------------------------------------------------------------ */

export type ApiKeyMutation =
  | { kind: "create"; name: string; tenant: string; scopes: string[]; rateLimitTier: string }
  | { kind: "rotate"; keyId: string }
  | { kind: "revoke"; keyId: string };

/** `sk_live_` + 4 random alphanumerics — the masked prefix we store. */
function generatePrefix(name: string): string {
  const test = name.toLowerCase().includes("stag") || name.toLowerCase().includes("test");
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `sk_${test ? "test" : "live"}_${tail}…`;
}

/**
 * Apply an approved `apikey.*` request — called exactly once by the
 * approval bridge (see approval-apply.ts).
 */
export function applyApiKeyApproval(
  request: ApprovalRequest,
): { title: string; description: string } | void {
  const mutation = request.payload as ApiKeyMutation | undefined;
  if (!mutation) return;
  const approver = request.approver?.name ?? "second operator";
  const keys = readRaw();

  if (mutation.kind === "create") {
    const nowIso = new Date().toISOString();
    const created: StoredApiKey = {
      id: `key-${Date.now().toString(36)}`,
      name: mutation.name,
      tenant: mutation.tenant,
      scopes: mutation.scopes,
      status: "active",
      lastUsed: nowIso,
      createdAt: nowIso,
      prefix: generatePrefix(mutation.name),
      rateLimitTier: mutation.rateLimitTier,
    };
    writeRaw([created, ...keys]);
    recordAudit({
      actor: approver,
      action: "apikey.created",
      target: created.id,
      severity: "warning",
      detail: `Created API key "${created.name}" for ${created.tenant} (${created.scopes.length} scopes, ${created.rateLimitTier} tier); initiated by ${request.initiator.name}`,
    });
    return {
      title: "API key created",
      description: `"${created.name}" (${created.tenant}) is active — approved by ${approver}.`,
    };
  }

  const key = keys.find((k) => k.id === mutation.keyId);
  if (!key) return { title: "Key not found", description: "The key no longer exists — change skipped." };

  if (mutation.kind === "rotate") {
    const rotated: StoredApiKey = {
      ...key,
      prefix: generatePrefix(key.name),
      rotatedAt: new Date().toISOString(),
    };
    writeRaw(keys.map((k) => (k.id === key.id ? rotated : k)));
    recordAudit({
      actor: approver,
      action: "apikey.rotated",
      target: key.id,
      severity: "warning",
      detail: `Rotated API key "${key.name}" — old secret invalidated immediately; initiated by ${request.initiator.name}`,
    });
    return {
      title: "API key rotated",
      description: `"${key.name}" has a new secret — approved by ${approver}.`,
    };
  }

  // revoke
  if (key.status === "revoked") {
    return { title: "Already revoked", description: `"${key.name}" was revoked earlier — no change.` };
  }
  writeRaw(keys.map((k) => (k.id === key.id ? { ...k, status: "revoked" as const } : k)));
  recordAudit({
    actor: approver,
    action: "apikey.revoked",
    target: key.id,
    severity: "critical",
    detail: `Revoked API key "${key.name}" (${key.tenant}) — all requests with it now fail; initiated by ${request.initiator.name}`,
  });
  return {
    title: "API key revoked",
    description: `"${key.name}" can no longer authenticate — approved by ${approver}.`,
  };
}
