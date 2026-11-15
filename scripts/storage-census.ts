/**
 * Storage census — R6-4 (persistence hygiene).
 *
 * Enumerates storage-key declarations per app (`STORAGE_KEY` / `SLOT` /
 * `*_STORE` constants plus the session-store key constants — see scan
 * scope below) and asserts:
 *   (a) each is prefixed once by that app's house scheme, or is a
 *       registered global key (GLOBAL_KEYS) whose lifecycle is documented,
 *   (b) each is covered by the app's wipe/reset path:
 *         trader         — `deleteCurrentAccount()` prefix-wipes
 *                          `pfaas:trader:*` and explicitly clears
 *                          ACCOUNT_DATA_TERRA_KEYS + the shared lifecycle
 *                          log + error reports. All three are parsed from
 *                          session-store.ts, so a new key rides along and
 *                          the census cannot drift from the wipe code.
 *         prop-admin     — `resetDemoState()` clears `pfaas:demo:` +
 *                          every DEMO_STORES id plus explicit
 *                          removeItem()s, parsed from
 *                          demo-persistence.ts. Bare SLOT ids passed to
 *                          loadDemoState/saveDemoState are prefixed by
 *                          that layer and checked as their runtime key.
 *         platform-admin — no localStorage wipe exists: console state is
 *                          app-scoped and shared across demo sign-outs by
 *                          design. Keys must carry the
 *                          `pfaas:platform-admin:` prefix or be a
 *                          registered global.
 *   (c) no key is double-prefixed — including a demo-store id that
 *       already carries the `pfaas:demo:` prefix loadDemoState()
 *       prepends, and no wired loadDemoState/saveDemoState store is
 *       missing from DEMO_STORES (or resetDemoSession would leave it
 *       behind).
 *
 * Scan scope: `const X = "..."` declarations only. Inline
 * `localStorage.getItem("...")` literals and `*_KEY` UI preferences are
 * not yet scanned — known follow-up, documented here so a passing run is
 * never read as more coverage than it is.
 *
 * Modes:
 *   bun scripts/storage-census.ts            report only (exit 0)
 *   bun scripts/storage-census.ts --check    enforce gates (exit 1 on breach)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHECK = process.argv.includes("--check");
let failures = 0;

function fail(where: string, msg: string): void {
  console.log(`  [${where}] ${msg}`);
  failures += 1;
}

/* ------------------------------------------------------------------ */
/* House prefix rules                                                 */
/* ------------------------------------------------------------------ */

const APP_PREFIXES: Record<string, string[]> = {
  // terra-* / terra.* / terra: slots are trader's device prefs and
  // account data — no other app may declare them.
  trader: ["pfaas:trader:", "terra-", "terra.", "terra:"],
  "prop-admin": ["pfaas:demo:"],
  "platform-admin": ["pfaas:platform-admin:", "pfaas:demo:"],
};
const SHARED_PREFIX = "pfaas:demo:";

const isBare = (key: string) => !/^(pfaas:|terra[-.:])/.test(key);
const isTerra = (key: string) => /^terra[-.:]/.test(key);

/* ------------------------------------------------------------------ */
/* Global keys — shared/device keys that are not app-prefixed         */
/* ------------------------------------------------------------------ */

interface GlobalKeySpec {
  /** Which storage the key lives in — session keys die with the tab and
   *  are exempt from localStorage wipe expectations. */
  storage: "local" | "session";
  /** Apps that declare this key as a scanned constant. */
  apps: string[];
  /** Where the key is cleared, or why it intentionally persists. */
  lifecycle: string;
  /** When set, the key must also appear in the named parsed clear-set —
   *  the lifecycle claim is verified against the code, not trusted. */
  verifiedBy?: "prop-admin-reset" | "platform-admin-signout";
}

const GLOBAL_KEYS: Record<string, GlobalKeySpec> = {
  "pfaas:priceAlerts": {
    storage: "local",
    apps: ["prop-admin"],
    lifecycle:
      "price-alert preferences from the shared packages/ui PriceAlertManager — user prefs, not demo state; survives Reset demo session",
  },
  "pfaas:lastSeenVersion": {
    storage: "local",
    apps: ["prop-admin", "platform-admin"],
    lifecycle:
      "whats-new changelog read marker — UI state, not demo/account data; survives resets by design",
  },
  "pfaas:auditSession": {
    storage: "local",
    apps: ["prop-admin"],
    lifecycle: "session audit trail — cleared by resetDemoState()",
    verifiedBy: "prop-admin-reset",
  },
  "pfaas:session": {
    storage: "session",
    apps: ["prop-admin", "platform-admin"],
    lifecycle: "sessionStorage sign-in flag — cleared by sign-out",
    verifiedBy: "platform-admin-signout",
  },
};

/** Device preferences that are intentionally NOT account-wiped (see the
 *  comment above ACCOUNT_DATA_TERRA_KEYS in session-store.ts). */
const DEVICE_PREF_KEYS = ["terra-theme"];

/* ------------------------------------------------------------------ */
/* Parsed wipe/reset sets — read from the apps themselves so the       */
/* census cannot drift from the code it gates                         */
/* ------------------------------------------------------------------ */

function readSrc(app: string, rel: string): string {
  try {
    return readFileSync(join(ROOT, "apps", app, rel), "utf8");
  } catch {
    return "";
  }
}

function extractConst(src: string, name: string): string | null {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

function extractStringArray(src: string, name: string): string[] {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function extractLiterals(src: string, re: RegExp): string[] {
  return [...src.matchAll(re)].map((m) => m[1]);
}

// trader — deleteCurrentAccount()
const traderSession = readSrc("trader", "src/lib/session-store.ts");
const TRADER_PREFIX_WIPE = traderSession.includes('startsWith("pfaas:trader:")');
const TRADER_TERRA_WIPE = extractStringArray(traderSession, "ACCOUNT_DATA_TERRA_KEYS");
const TRADER_EXPLICIT_WIPE = [
  extractConst(traderSession, "LIFECYCLE_LOG_KEY"),
  extractConst(traderSession, "ERROR_REPORTS_KEY"),
].filter((k): k is string => k !== null);

// prop-admin — resetDemoState()
const demoPersist = readSrc("prop-admin", "src/lib/platform/demo-persistence.ts");
const DEMO_PREFIX = extractConst(demoPersist, "PREFIX") ?? SHARED_PREFIX;
const DEMO_STORES = extractStringArray(demoPersist, "DEMO_STORES");
const PROP_ADMIN_RESET = new Set([
  ...DEMO_STORES.map((s) => DEMO_PREFIX + s),
  ...extractLiterals(demoPersist, /removeItem\("([^"]+)"\)/g),
]);
const DEMO_IMPORT = "@/lib/platform/demo-persistence";

// platform-admin — topbar sign-out
const platformTopbar = readSrc("platform-admin", "src/components/shell/topbar.tsx");
const PLATFORM_SIGNOUT = new Set(
  extractLiterals(platformTopbar, /sessionStorage\.removeItem\("([^"]+)"\)/g),
);

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

function checkPrefix(app: string, key: string, importsDemo: boolean): string | null {
  // Static double-prefix detection
  const doublePrefixed =
    key.includes("pfaas:demo:pfaas:") ||
    key.includes("pfaas:trader:pfaas:") ||
    key.includes("pfaas:demo:pfaas:trader:") ||
    key.includes("pfaas:trader:pfaas:demo:");
  if (doublePrefixed) return `DOUBLE-PREFIXED: ${key}`;

  // Runtime double-prefix: loadDemoState/saveDemoState prepend DEMO_PREFIX,
  // so a prop-admin demo-store id must be declared bare.
  if (app === "prop-admin" && importsDemo && key.startsWith(DEMO_PREFIX)) {
    return `DOUBLE-PREFIXED: ${key} (loadDemoState/saveDemoState already prepend "${DEMO_PREFIX}" — declare the bare store id)`;
  }

  const global = GLOBAL_KEYS[key];
  if (global) {
    if (!global.apps.includes(app)) {
      return `GLOBAL-KEY-APP: ${key} is registered for ${global.apps.join(", ")} but declared in ${app}`;
    }
    return null;
  }

  const appPrefixes = APP_PREFIXES[app] ?? [];
  if (
    appPrefixes.some((p) => key.startsWith(p)) ||
    key.startsWith(SHARED_PREFIX)
  ) {
    return null;
  }

  // prop-admin demo-store ids are bare — the demo persistence layer
  // prefixes them at load/save time.
  if (app === "prop-admin" && importsDemo && isBare(key)) return null;

  const expected = [...new Set([...appPrefixes, SHARED_PREFIX])];
  const hint =
    app === "prop-admin" && isBare(key)
      ? " (bare demo-store ids are only valid in files that import demo-persistence)"
      : "";
  return `NO-HOUSE-PREFIX: ${key} (expected one of ${expected.join(", ")})${hint}`;
}

function checkWipe(app: string, key: string, importsDemo: boolean): string | null {
  const global = GLOBAL_KEYS[key];
  if (global) {
    if (global.verifiedBy === "prop-admin-reset" && !PROP_ADMIN_RESET.has(key)) {
      return `NOT-CLEARED: ${key} — registered as cleared by resetDemoState() but the parse found no such removeItem()`;
    }
    if (global.verifiedBy === "platform-admin-signout" && !PLATFORM_SIGNOUT.has(key)) {
      return `NOT-CLEARED: ${key} — registered as cleared by sign-out but topbar.tsx no longer removes it`;
    }
    return null;
  }

  if (app === "trader") {
    if (key.startsWith("pfaas:trader:")) {
      return TRADER_PREFIX_WIPE
        ? null
        : "PREFIX-WIPE-MISSING: session-store.ts deleteCurrentAccount() no longer prefix-wipes pfaas:trader:*";
    }
    if (DEVICE_PREF_KEYS.includes(key)) return null;
    if (TRADER_TERRA_WIPE.includes(key) || TRADER_EXPLICIT_WIPE.includes(key)) return null;
    return `NOT-IN-WIPE-SET: ${key} (deleteCurrentAccount clears pfaas:trader:* + ACCOUNT_DATA_TERRA_KEYS + lifecycle log + error reports)`;
  }

  if (app === "prop-admin") {
    const runtimeKey = importsDemo && isBare(key) ? DEMO_PREFIX + key : key;
    if (PROP_ADMIN_RESET.has(runtimeKey)) return null;
    return `NOT-IN-WIPE-SET: ${runtimeKey} (resetDemoState clears DEMO_STORES + explicit removeItem()s, parsed from demo-persistence.ts)`;
  }

  // platform-admin — no wipe surface by design (see header).
  if (key.startsWith("pfaas:platform-admin:")) return null;
  return `NOT-IN-WIPE-SET: ${key} (platform-admin has no localStorage wipe — use the pfaas:platform-admin: prefix or register the key)`;
}

/** Every wired loadDemoState/saveDemoState store id must be resettable. */
function checkDemoStoreSync(rel: string, content: string): void {
  const wired = new Set([
    ...extractLiterals(content, /loadDemoState\(\s*"([^"]+)"/g),
    ...extractLiterals(content, /saveDemoState\(\s*"([^"]+)"/g),
  ]);
  for (const store of wired) {
    if (!DEMO_STORES.includes(store)) {
      fail(
        rel,
        `DEMO-STORE-NOT-RESETTABLE: "${store}" — missing from DEMO_STORES, so resetDemoState() never clears it`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Scan each app for storage-key constants                            */
/* ------------------------------------------------------------------ */

const globalSeen = new Set<string>();

function scanApp(app: string): void {
  const srcDir = join(ROOT, "apps", app, "src");
  const files: string[] = [];
  collectRecursive(srcDir, files);

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const rel = file.replace(ROOT + "/", "");
    const importsDemo = content.includes(DEMO_IMPORT);

    // Match STORAGE_KEY = "..." / SLOT = "..." / *_STORE = "..." declarations
    const keyRegex =
      /(?:STORAGE_KEY|SLOT|RESET_TICKET_KEY|LOGIN_HISTORY_KEY|ACCOUNTS_KEY|SESSION_KEY|[A-Z][A-Z0-9_]*_STORE)\s*=\s*"([^"]+)"/g;
    let match;
    while ((match = keyRegex.exec(content)) !== null) {
      const key = match[1];
      if (GLOBAL_KEYS[key]) globalSeen.add(key);

      const prefixErr = checkPrefix(app, key, importsDemo);
      if (prefixErr) fail(rel, prefixErr);

      // Wipe coverage — skip when the prefix phase already flagged a
      // double-prefix (its runtime key would only add noise).
      const wipeWanted =
        key.startsWith("pfaas:") ||
        (app === "trader" && isTerra(key)) ||
        (app === "prop-admin" && importsDemo && isBare(key));
      if (wipeWanted && !prefixErr?.startsWith("DOUBLE-PREFIXED")) {
        const wipeErr = checkWipe(app, key, importsDemo);
        if (wipeErr) fail(rel, wipeErr);
      }
    }

    if (app === "prop-admin") checkDemoStoreSync(rel, content);
  }
}

function collectRecursive(dir: string, result: string[]): void {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
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

function printWipeModel(app: string): void {
  if (app === "trader") {
    console.log(
      `  wipe model: deleteCurrentAccount() prefix-wipes pfaas:trader:* + ${TRADER_TERRA_WIPE.length} explicit keys (parsed from session-store.ts)`,
    );
  } else if (app === "prop-admin") {
    console.log(
      `  wipe model: resetDemoState() clears ${PROP_ADMIN_RESET.size} keys (DEMO_STORES + removeItem literals, parsed from demo-persistence.ts)`,
    );
  } else {
    console.log(
      "  wipe model: none — pfaas:platform-admin:* is app-scoped console state, shared across demo sign-outs by design",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

console.log("Storage census — R6-4\n");

if (DEMO_PREFIX !== SHARED_PREFIX) {
  fail(
    "apps/prop-admin/src/lib/platform/demo-persistence.ts",
    `PREFIX-DIVERGED: demo persistence prefixes with "${DEMO_PREFIX}" but the house shared prefix is "${SHARED_PREFIX}"`,
  );
}

for (const app of ["trader", "prop-admin", "platform-admin"]) {
  console.log(`=== ${app} ===`);
  printWipeModel(app);
  scanApp(app);
  console.log("");
}

console.log("=== global-key registry ===");
let stale = 0;
for (const [key, spec] of Object.entries(GLOBAL_KEYS)) {
  if (!globalSeen.has(key)) {
    console.log(
      `  STALE-GLOBAL-KEY: ${key} — registered for ${spec.apps.join(", ")} but no longer declared anywhere`,
    );
    failures += 1;
    stale += 1;
  }
}
if (stale === 0) console.log("  every registered global key is declared as expected");
console.log("");

if (failures > 0) {
  console.log(`${failures} storage-census failure(s).`);
  if (CHECK) process.exit(1);
} else {
  console.log("Storage census: all keys prefixed once and covered by wipe/reset sets.");
  if (CHECK) process.exit(0);
}
