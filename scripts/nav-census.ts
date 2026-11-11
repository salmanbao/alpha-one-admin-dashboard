/**
 * prop-admin nav census + poster guard (R2-W3-03).
 *
 * What a new admin actually sees: every navigation child in every
 * registered module, classified by what clicking it resolves to.
 *
 *   store-backed   view-router entry imports a product module page
 *   poster         view-router entry imports `modules/stitch/pages/*`
 *                  (a machine-generated reference render wearing a
 *                  product label)
 *   dead           no view-router entry at all (nothing resolves)
 *
 * `?query=` suffixes (e.g. `settings?tab=branding`) are stripped to the
 * base view id before classifying — the sidebar parses them the same way
 * (components/shell/sidebar.tsx parseHref).
 *
 * Poster links are judged by the milestone's rule: every nav item must
 * resolve to a store-backed surface or a clearly-labeled demo.
 *
 *   unguarded      product nav item -> stitch view without a "(demo)"
 *                  label: an operator sees a fake screen as fact
 *   labeled demo   product nav item labeled "(demo)" — allowed, capped,
 *                  and it must own a product RouteDefinition so the
 *                  module/permission guards still apply (no PA-025)
 *   gated          no product route claim -> resolveView() blocks it
 *                  when SHOW_STITCH=0 (view-router derives this from
 *                  the manifests; there is no hand-maintained list)
 *
 * The script is the actuator for the W3-03 gates (rule R2): it both
 * prints the census and fails when a threshold or guard is violated, so
 * the numbers in the commit message are reproducible with one command.
 * CI runs it with --check (.github/workflows/ci.yml).
 *
 * Modes:
 *   bun scripts/nav-census.ts            report only (exit 0)
 *   bun scripts/nav-census.ts --check    enforce gates (exit 1 on breach)
 *
 * Gates (MILESTONES-R2 R2-W3-03):
 *   NAV_CHILDREN_MAX          <= 150 product nav children
 *   UNGUARDED_POSTERS_MAX      =   0 product nav links to unlabeled stitch
 *   LABELED_DEMO_POSTERS_MAX  <=  15 remaining, each tagged "(demo)" in nav
 *   product RouteDefinition may claim a stitch view only for a "(demo)"-labeled
 *   nav item — otherwise CI fails ("a product-claimed id resolves to a stitch
 *   component").
 *   R9 registry↔route parity (all three apps): every declared view id has a
 *   viewRegistry entry (the R5-H1 truncation class) and every registry entry
 *   is declared or referenced somewhere.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "apps/prop-admin/src");

/* ------------------------------------------------------------------ */
/* Thresholds                                                          */
/* ------------------------------------------------------------------ */

const NAV_CHILDREN_MAX = 150;
const UNGUARDED_POSTERS_MAX = 0;
const LABELED_DEMO_POSTERS_MAX = 15;

/* ------------------------------------------------------------------ */
/* 1. Load the real module registry (same code path as the sidebar)    */
/* ------------------------------------------------------------------ */

process.env.NEXT_PUBLIC_SHOW_STITCH ??= "1"; // register stitch too, so its own nav is measured
const { bootstrapModules } = await import("../apps/prop-admin/src/lib/platform/module-bootstrap");
const { moduleRegistry } = await import("../apps/prop-admin/src/lib/platform/module-registry");
bootstrapModules();

interface NavLeaf {
  module: string;
  section: string;
  id: string;
  label: string;
  href: string;
}

function walk(items: any[], module: string, section: string, out: NavLeaf[]): void {
  for (const item of items ?? []) {
    if (item.children?.length) {
      walk(item.children, module, item.label ?? section, out);
    } else if (item.href) {
      out.push({ module, section, id: item.id, label: item.label, href: item.href });
    }
  }
}

const leaves: NavLeaf[] = [];
for (const mod of moduleRegistry.getAll()) {
  walk((mod as any).navigation ?? [], mod.manifest.id, "", leaves);
}

const stitchLeaves = leaves.filter((l) => l.module === "stitch");
const productLeaves = leaves.filter((l) => l.module !== "stitch");

/* ------------------------------------------------------------------ */
/* 2. Parse view-router.tsx: viewId -> import path                     */
/* ------------------------------------------------------------------ */

const routerSrc = readFileSync(join(APP, "lib/platform/view-router.tsx"), "utf8");

const viewImport = new Map<string, string>();
const entryRe = /^\s*"?([\w.-]+)"?:\s*dynamic\(\(\)\s*=>\s*import\("([^"]+)"\)/gm;
let m: RegExpExecArray | null;
while ((m = entryRe.exec(routerSrc))) viewImport.set(m[1], m[2]);

const isStitchView = (viewId: string) => (viewImport.get(viewId) ?? "").includes("/stitch/pages/");

/** Strip `?query` the way the sidebar does before matching a view id. */
const baseView = (href: string) => href.split("?")[0];

/* ------------------------------------------------------------------ */
/* 3. Product claims on stitch views (routes = the guard allow-list)   */
/* ------------------------------------------------------------------ */

/** viewId -> non-stitch modules claiming it via a RouteDefinition. */
const routeClaims = new Map<string, string[]>();
for (const mod of moduleRegistry.getAll()) {
  if (mod.manifest.id === "stitch") continue;
  for (const r of (mod as any).routes ?? []) {
    if (isStitchView(r.viewId)) {
      if (!routeClaims.has(r.viewId)) routeClaims.set(r.viewId, []);
      routeClaims.get(r.viewId)!.push(mod.manifest.id);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. Classify every product nav leaf                                  */
/* ------------------------------------------------------------------ */

type Kind = "store-backed" | "poster" | "dead";

function classify(href: string): { kind: Kind; via: string } {
  if (!viewImport.has(href)) {
    return { kind: "dead", via: "no view-router entry" };
  }
  if (!isStitchView(href)) return { kind: "store-backed", via: viewImport.get(href)! };
  return { kind: "poster", via: viewImport.get(href)! };
}

const rows = productLeaves.map((l) => {
  const view = baseView(l.href);
  const c = classify(view);
  const isDemo = /\(demo\)/i.test(l.label);
  const routeClaimed = routeClaims.has(view);
  return {
    ...l,
    view,
    ...c,
    isDemo,
    routeClaimed,
    // A product nav item that reaches a stitch screen without the demo
    // label is exactly what the milestone calls an unguarded poster.
    unguarded: c.kind === "poster" && !isDemo,
  };
});

const count = (k: Kind) => rows.filter((r) => r.kind === k).length;
const posters = rows.filter((r) => r.kind === "poster");
const labeledDemo = posters.filter((r) => r.isDemo);
const unguarded = rows.filter((r) => r.unguarded);

/* ------------------------------------------------------------------ */
/* 5. Report                                                           */
/* ------------------------------------------------------------------ */

const byModule = new Map<string, NavLeaf[]>();
for (const l of productLeaves) {
  if (!byModule.has(l.module)) byModule.set(l.module, []);
  byModule.get(l.module)!.push(l);
}

console.log("prop-admin nav census (R2-W3-03)");
console.log("=".repeat(72));
console.log(`product nav children : ${productLeaves.length}   (limit ${NAV_CHILDREN_MAX})`);
console.log(`stitch-section children (flag-gated module): ${stitchLeaves.length}`);
console.log(
  `classification       : store-backed ${count("store-backed")} · ` +
    `posters ${posters.length} (unguarded ${unguarded.length}, labeled (demo) ${labeledDemo.length}) · ` +
    `dead ${count("dead")}`,
);
console.log(`stitch views         : ${[...viewImport].filter(([, p]) => p.includes("/stitch/pages/")).length} wired in view-router`);
console.log(`product RouteDefinition claims on stitch views: ${routeClaims.size}`);
console.log("");
console.log("per module:");
for (const [mod, ls] of [...byModule].sort((a, b) => b[1].length - a[1].length)) {
  const p = ls.filter((l) => classify(baseView(l.href)).kind === "poster").length;
  console.log(`  ${mod.padEnd(14)} ${String(ls.length).padStart(3)} children, ${p} poster(s)`);
}

if (posters.length) {
  console.log("\nnav-linked posters:");
  for (const r of posters.sort((a, b) => a.module.localeCompare(b.module))) {
    console.log(
      `  [${r.unguarded ? "UNGUARDED" : r.routeClaimed ? "demo     " : "gated    "}] ` +
        `${r.module}/${r.section} -> ${r.view}  "${r.label}"`,
    );
  }
}
if (count("dead")) {
  console.log("\nnav links with no view-router entry:");
  for (const r of rows.filter((r) => r.kind === "dead")) {
    console.log(`  ${r.module}/${r.section} -> ${r.href}  "${r.label}"`);
  }
}
if (routeClaims.size) {
  console.log("\nproduct RouteDefinition claims on stitch views:");
  for (const [view, mods] of routeClaims) {
    const demoNav = posters.some((p) => p.view === view && p.isDemo);
    console.log(`  ${demoNav ? "(demo-labeled)" : "VIOLATION "} ${view} -> ${mods.join(",")}`);
  }
}

/* ------------------------------------------------------------------ */
/* 6. R9 — registry ↔ route parity (all three apps)                   */
/* ------------------------------------------------------------------ */

/*
 * R5-H1 lesson: a rewrite of platform-admin's view-router dropped 73 of
 * 83 views while tsc stayed green and this census passed — it only
 * audited prop-admin. R9 closes that class mechanically:
 *
 *   forward   every declared route id (manifest path/viewId, nav href,
 *             traderRoutes) must have a viewRegistry/viewMap entry.
 *             This is the truncation direction — it fails on 83→10.
 *   reverse   every registry entry must be declared OR referenced
 *             somewhere else in the app's source (panel/detail views
 *             like risk-case-detail are reachable without a route).
 */

function readAppSrc(app: string, rel: string): string {
  return readFileSync(join(ROOT, "apps", app, "src", rel), "utf8");
}

function registryKeysOf(src: string): Set<string> {
  const keys = new Set<string>();
  const re = /^\s*"?([\w.-]+)"?:\s*dynamic\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) keys.add(m[1]);
  return keys;
}

function addViewId(ids: Set<string>, raw: string): void {
  // Nav hrefs may carry `?query` or a leading `/`; view ids are bare.
  const base = raw.split("?")[0].replace(/^\//, "");
  if (/^[a-z][a-z0-9-]*$/.test(base)) ids.add(base);
}

function declaredIdsOf(app: string): Set<string> {
  const ids = new Set<string>();
  if (app === "prop-admin") {
    // Authoritative source: the same moduleRegistry the sidebar walks.
    for (const mod of moduleRegistry.getAll()) {
      for (const r of (mod as any).routes ?? []) if (r.viewId) addViewId(ids, r.viewId);
    }
    for (const l of leaves) addViewId(ids, l.href);
  } else if (app === "platform-admin") {
    const manifest = readAppSrc(app, "modules/super-admin/super-admin-module.ts");
    for (const m of manifest.matchAll(/viewId:\s*"([\w.-]+)"/g)) addViewId(ids, m[1]);
    for (const m of manifest.matchAll(/href:\s*"([^"]+)"/g)) addViewId(ids, m[1]);
  } else {
    // trader: viewMap ↔ traderRoutes. Trader nav hrefs are file-system
    // routes (app/**/page.tsx), not view ids — they are not part of
    // registry parity.
    const router = readAppSrc(app, "lib/platform/view-router.tsx");
    const start = router.indexOf("traderRoutes: RouteDefinition[]");
    const end = router.indexOf("];", start);
    if (start !== -1 && end !== -1) {
      for (const m of router.slice(start, end).matchAll(/viewId:\s*"([\w.-]+)"/g)) {
        addViewId(ids, m[1]);
      }
    }
  }
  return ids;
}

/** Every .ts/.tsx file of an app except its view-router, concatenated. */
function appSourceExceptRouter(app: string): string {
  const srcRoot = join(ROOT, "apps", app, "src");
  const parts: string[] = [];
  const walkDir = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walkDir(p);
      else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== "view-router.tsx") {
        parts.push(readFileSync(p, "utf8"));
      }
    }
  };
  walkDir(srcRoot);
  return parts.join("\n");
}

interface ParityResult {
  app: string;
  registry: number;
  declared: number;
  missing: string[]; // declared but not registered — the R5-H1 class
  orphan: string[]; // registered, undeclared and unreferenced — dead weight
}

function parityOf(app: string): ParityResult {
  const registry = registryKeysOf(readAppSrc(app, "lib/platform/view-router.tsx"));
  const declared = declaredIdsOf(app);
  const missing = [...declared].filter((d) => !registry.has(d)).sort();

  const rest = appSourceExceptRouter(app);
  const orphan = [...registry].filter(
    (k) => !declared.has(k) && !rest.includes(k),
  ).sort();
  return { app, registry: registry.size, declared: declared.size, missing, orphan };
}

const parityApps = ["platform-admin", "prop-admin", "trader"];
const parityResults = parityApps.map(parityOf);

console.log("registry ↔ route parity (R9)");
console.log("=".repeat(72));
for (const r of parityResults) {
  console.log(
    `  ${r.app.padEnd(15)} registry ${String(r.registry).padStart(3)} · ` +
      `declared ${String(r.declared).padStart(3)} · missing ${r.missing.length} · orphan ${r.orphan.length}`,
  );
  if (r.missing.length) {
    console.log(`    MISSING (declared, no registry entry): ${r.missing.join(", ")}`);
  }
  if (r.orphan.length) {
    console.log(`    ORPHAN (registered, referenced nowhere): ${r.orphan.join(", ")}`);
  }
}
console.log("");

/* ------------------------------------------------------------------ */
/* 7. Optional gate                                                    */
/* ------------------------------------------------------------------ */

if (process.argv.includes("--check")) {
  const failures: string[] = [];
  for (const r of parityResults) {
    for (const v of r.missing) {
      failures.push(`R9 ${r.app}: declared view "${v}" has no viewRegistry entry`);
    }
    for (const v of r.orphan) {
      failures.push(`R9 ${r.app}: viewRegistry entry "${v}" is declared nowhere and referenced nowhere`);
    }
  }
  if (productLeaves.length > NAV_CHILDREN_MAX) {
    failures.push(`nav children ${productLeaves.length} > ${NAV_CHILDREN_MAX}`);
  }
  // "zero unguarded poster links": a product nav item may only reach a
  // stitch screen when its label says "(demo)".
  for (const r of unguarded) {
    failures.push(`unguarded poster link: ${r.module} -> ${r.view} "${r.label}" (no "(demo)" label)`);
  }
  if (unguarded.length > UNGUARDED_POSTERS_MAX) {
    failures.push(`unguarded poster links ${unguarded.length} > ${UNGUARDED_POSTERS_MAX}`);
  }
  if (labeledDemo.length > LABELED_DEMO_POSTERS_MAX) {
    failures.push(`labeled (demo) posters ${labeledDemo.length} > ${LABELED_DEMO_POSTERS_MAX}`);
  }
  // A product-claimed id may only resolve to a stitch component for a
  // demo-labeled nav item; otherwise the claim itself is the bug (PA-023).
  for (const [view, mods] of routeClaims) {
    const demoNav = posters.some((p) => p.view === view && p.isDemo);
    if (!demoNav) {
      failures.push(`product-claimed id resolves to a stitch component: ${view} (claimed by ${mods.join(",")})`);
    }
  }
  if (failures.length) {
    console.error("\nFAIL:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n--check: PASS");
}
