"use client";

/**
 * Read-only View-As gate (CON-07, gap S-24).
 *
 * While an impersonation session is active the routed view content is
 * inert: activation events (`click`, `submit`) are swallowed at capture
 * phase before any page handler sees them, so no mutating control inside
 * a view can fire. Navigation links (`a[href]`), controls explicitly
 * marked `data-readonly-allow`, and everything outside the view (sidebar,
 * topbar, the impersonation banner) stay live — the operator can browse
 * and read every surface, but cannot operate it.
 *
 * Previously ReadOnlyGuard/ReadOnlyButton were documented but never
 * imported anywhere, so the banner's "read-only" claim was advisory
 * only. The guard is now mounted once in AppShell around the routed
 * content; the impersonation banner above it offers Renew / End session
 * (the only controls an active session needs).
 */

import type { ReactNode, SyntheticEvent } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { ShieldAlert } from "lucide-react";

export function ReadOnlyGuard({ children }: { children: ReactNode }) {
  const { isImpersonating } = usePlatform();

  if (!isImpersonating) return <>{children}</>;

  /* Swallow activation at capture phase — before any page handler sees
   * it — so no mutating control inside the view can fire. */
  const blockActivation = (e: SyntheticEvent) => {
    const target = e.target as HTMLElement | null;
    // Navigation, tab switches (view-local) and explicitly-allowed
    // session controls stay live; everything else is inert. The selector
    // is wrapped defensively: Element.closest() throws SyntaxError on an
    // invalid selector, and a throw here would happen BEFORE
    // preventDefault — silently disabling the whole gate (F4). Never let
    // a bad selector open the gate.
    let allowed = false;
    try {
      allowed = !!target?.closest("a[href], [role='tab'], [data-readonly-allow]");
    } catch {
      allowed = false;
    }
    if (allowed) return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div data-readonly="true" onClickCapture={blockActivation} onSubmitCapture={blockActivation}>
      <div className="mb-3 flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-50/70 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Read-only View-As session — controls in this view are disabled.
        Use the banner above to renew or end the session.
      </div>
      {children}
    </div>
  );
}
