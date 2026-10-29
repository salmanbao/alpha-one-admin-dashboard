/**
 * PFaaS Platform — Build-time feature flags (NEXT_PUBLIC_*)
 *
 * `process.env.NEXT_PUBLIC_*` is inlined by Next at build time, so these
 * are static booleans in the client bundle — no runtime lookup, and the
 * dead branches can be dropped by the bundler.
 */

/**
 * Show the Stitch reference-screens module (nav section + its views).
 *
 * The stitch module is a large set of screens converted from the
 * stitch_screens reference renders — useful for design review and demo
 * deployments, but not part of the product surface. Disabled by default:
 * production builds ship without the nav section, and deep links
 * (?view=<stitch view>) resolve to the standard "view not found" state.
 * Enable for a demo build with NEXT_PUBLIC_SHOW_STITCH=1.
 */
export const SHOW_STITCH = process.env.NEXT_PUBLIC_SHOW_STITCH === "1";
