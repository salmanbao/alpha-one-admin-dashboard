/**
 * PFaaS Platform — View link helpers (enterprise navigation patterns)
 *
 * Two navigation patterns operators expect from an enterprise console:
 *
 *   1. NEW TAB — open a sub-screen in a new browser tab so the parent
 *      list stays intact while the operator deep-dives (reference
 *      reading, cross-screen comparison). Helpers below build the same
 *      `?view=…&id=…` URL the router boots from
 *      (platform-context.tsx `routerStateFromUrl()`), so a fresh tab
 *      lands directly on the right screen with no extra plumbing.
 *
 *   2. OVERLAY — open the sub-screen as a sheet on top of its parent
 *      (inspect-and-act loops). See
 *      components/platform/detail-overlay.tsx for the host + hook.
 *
 * Convention: primary click opens the overlay, an explicit affordance
 * (icon button / row-menu item) opens the new tab. New tab is never the
 * default click — tab clutter is the failure mode of pattern 1.
 */

/** Build the in-app URL for a view (`/` + `?view=…&param=…`). */
export function buildViewUrl(view: string, params: Record<string, string> = {}): string {
  const usp = new URLSearchParams();
  if (view && view !== "overview") usp.set("view", view);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  });
  const qs = usp.toString();
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return `${path}${qs ? `?${qs}` : ""}`;
}

/**
 * Open a view in a NEW browser tab. `noopener,noreferrer` — the opened
 * tab must never get a handle on the console window (reverse tabnabbing).
 */
export function openViewInNewTab(view: string, params: Record<string, string> = {}): void {
  if (typeof window === "undefined") return;
  window.open(buildViewUrl(view, params), "_blank", "noopener,noreferrer");
}
