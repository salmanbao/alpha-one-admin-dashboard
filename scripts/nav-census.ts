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
 */

import { readFileSync } from "node:fs";
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
/* 6. Optional gate                                                    */
/* ------------------------------------------------------------------ */

if (process.argv.includes("--check")) {
  const failures: string[] = [];
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
