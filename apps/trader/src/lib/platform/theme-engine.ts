/**
 * Trader App — Theme Engine (parity with prop-admin / platform-admin)
 * Spec §29, §57 — consistent dark-mode application across all 3 dashboards.
 */

export function applyThemeMode(mode: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
