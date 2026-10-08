/**
 * PFaaS Platform — Theme Engine
 *
 * Spec sections 29, 57. Applies tenant branding as CSS variables at runtime
 * via a style element on the root shell. No per-tenant code branches.
 */

import type { TenantBranding } from "./types";

export interface ThemeConfig {
  mode: "light" | "dark";
}

const ROOT_STYLE_ID = "pfaas-brand-theme";

/**
 * Inject (or replace) a <style> tag that sets brand CSS variables on
 * :root. Tokens are kept generic so components use var(--brand-*).
 */
export function applyTenantBranding(branding: TenantBranding): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(ROOT_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = ROOT_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
:root {
  --brand-primary: ${branding.primaryColor};
  --brand-accent: ${branding.accentColor};
  --brand-surface: ${branding.surfaceColor};
  --radius: ${branding.radius};
  /* shadcn/ui primary mapping — drive primary from brand */
  --primary: ${branding.primaryColor};
  --sidebar-primary: ${branding.primaryColor};
  --accent: ${branding.accentColor}33;
  /* subtle tint backgrounds */
  --brand-primary-soft: ${branding.primaryColor}1f;
  --brand-accent-soft: ${branding.accentColor}1f;
}
.brand-surface { background-color: var(--brand-surface); }
.brand-text { color: var(--brand-primary); }
`;
}

/** Toggle dark mode class on <html>. */
export function applyThemeMode(mode: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
