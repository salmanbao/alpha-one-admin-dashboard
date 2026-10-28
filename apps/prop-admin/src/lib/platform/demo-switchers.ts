/**
 * PFaaS Platform — demo switcher availability
 *
 * The tenant switcher and role/user switcher in the topbar (and their
 * command-menu twins) are DEMO affordances: they swap the in-memory
 * identity so reviewers can walk through different roles. A production
 * deployment must not offer "Switch user (demo)" — identity comes from
 * real auth there.
 *
 * Gating rule:
 * - development / test (`NODE_ENV !== "production"`) → enabled,
 * - production → disabled unless explicitly re-enabled at BUILD time with
 *   `NEXT_PUBLIC_DEMO_SWITCHERS=1` (e.g. for a public demo deployment).
 *
 * `process.env.NEXT_PUBLIC_*` is inlined by Next at build time, so this
 * constant is a compile-time flag — zero runtime cost.
 */
export const demoSwitchersEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEMO_SWITCHERS === "1";
