/**
 * Storage census — R6-4 (persistence hygiene).
 *
 * Enumerates every `STORAGE_KEY`/`SLOT` constant per app and asserts:
 *   (a) each is prefixed once by the house scheme (`pfaas:<app>:` or
 *       `pfaas:demo:` for shared, `terra-*` for device prefs),
 *   (b) each is registered in its app's reset/wipe set so "Reset demo
 *       session" and "Delete account" actually clear it,
 *   (c) no key is double-prefixed (e.g. `pfaas:demo:pfaas:demo:...`).
 *
 * Modes:
 *   bun scripts/storage-census.ts            report only (exit 0)
 *   bun scripts/storage-census.ts --check    enforce gates (exit 1 on breach)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHECK = process.argv.includes("--check");
let failures = 0;

/* ------------------------------------------------------------------ */
/* House prefix rules                                                 */
/* ------------------------------------------------------------------ */

const APP_PREFIXES: Record<string, string[]> = {
  trader: ["pfaas:trader:"],
  "prop-admin": ["pfaas:demo:"],
  "platform-admin": ["pfaas:demo:"],
};
const SHARED_PREFIX = "pfaas:demo:";
const TERRA_PREFIX = "terra-";

function checkPrefix(app: string, key: string): string | null {
  const appPrefixes = APP_PREFIXES[app] ?? [];
  const hasAppPrefix = appPrefixes.some((p) => key.startsWith(p));
  const hasSharedPrefix = key.startsWith(SHARED_PREFIX);
  const hasTerraPrefix = key.startsWith(TERRA_PREFIX);

  // Double-prefix detection
  const doublePrefixed =
    key.includes("pfaas:demo:pfaas:") ||
    key.includes("pfaas:trader:pfaas:") ||
    key.includes("pfaas:demo:pfaas:trader:") ||
    key.includes("pfaas:trader:pfaas:demo:");

  if (doublePrefixed) return `DOUBLE-PREFIXED: ${key}`;
  if (!hasAppPrefix && !hasSharedPrefix && !hasTerraPrefix)
    return `NO-HOUSE-PREFIX: ${key} (expected one of ${[
    ...appPrefixes,
    SHARED_PREFIX,
    TERRA_PREFIX,
  ].join(", ")})`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Known wipe/reset sets (from session-store + demo-persistence)      */
/* ------------------------------------------------------------------ */

// trader delete-wipe keys (session-store.ts)
const TRADER_WIPE_KEYS = [
  "pfaas:trader:sessionAccounts",
  "pfaas:trader:session",
  "pfaas:trader:resetTicket",
  "pfaas:trader:loginHistory",
  "pfaas:demo:lifecycle-log",
  "pfaas:error-reports",
  "terra-inbox-state",
  "terra-notification-prefs",
  "terra-sim",
  "terra-support-tickets-v1",
  "terra.active-account",
  "terra:personalGoals",
  "terra.journal-entries",
  "terra.learning-progress",
  "terra.getting-started.v1",
];

// prop-admin reset set (demo-persistence.ts DEMO_STORES)
const PROP_ADMIN_RESET_STORES = [
  "pfaas:demo:purchase-ops",
  "pfaas:demo:provisioning-ops",
];

// Platform admin reset set (if any)
const PLATFORM_ADMIN_RESET_STORES: string[] = [];

function checkWipeCoverage(app: string, key: string): string | null {
  const wipeSet =
    app === "trader"
      ? TRADER_WIPE_KEYS
      : app === "prop-admin"
        ? PROP_ADMIN_RESET_STORES
        : PLATFORM_ADMIN_RESET_STORES;
  if (!wipeSet.includes(key)) return `NOT-IN-WIPE-SET: ${key}`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Scan each app for storage-key constants                            */
/* ------------------------------------------------------------------ */

function scanApp(app: string): void {
  const srcDir = join(ROOT, "apps", app, "src");
  const files = collectTsFiles(srcDir);

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const rel = file.replace(ROOT + "/", "");

    // Match STORAGE_KEY = "..." and SLOT = "..." declarations
    const keyRegex = /(?:STORAGE_KEY|SLOT|RESET_TICKET_KEY|LOGIN_HISTORY_KEY|ACCOUNTS_KEY|SESSION_KEY)\s*=\s*"([^"]+)"/g;
    let match;
    while ((match = keyRegex.exec(content)) !== null) {
      const key = match[1];

      // Prefix check
      const prefixErr = checkPrefix(app, key);
      if (prefixErr) {
        console.log(`  [${rel}] ${prefixErr}`);
        failures += 1;
      }

      // Wipe coverage check (only for pfaas: keys that are account-scoped)
      if (key.startsWith("pfaas:")) {
        const wipeErr = checkWipeCoverage(app, key);
        if (wipeErr) {
          console.log(`  [${rel}] ${wipeErr}`);
          failures += 1;
        }
      }
    }
  }
}

function collectTsFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = (() => {
    try {
      return readFileSync(dir, "utf8") && require("node:fs").readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  })();
  // Use a simpler recursive approach
  collectRecursive(dir, result);
  return result;
}

function collectRecursive(dir: string, result: string[]): void {
  let entries: any[];
  try {
    entries = require("node:fs").readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        collectRecursive(full, result);
      }
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      result.push(full);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

console.log("Storage census — R6-4\n");

for (const app of ["trader", "prop-admin", "platform-admin"]) {
  console.log(`=== ${app} ===`);
  scanApp(app);
  console.log("");
}

if (failures > 0) {
  console.log(`\n${failures} storage-census failure(s).`);
  if (CHECK) process.exit(1);
} else {
  console.log("Storage census: all keys prefixed once and covered by wipe/reset sets.");
  if (CHECK) process.exit(0);
}