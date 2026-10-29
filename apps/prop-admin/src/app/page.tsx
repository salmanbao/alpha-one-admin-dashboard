"use client";

/**
 * PFaaS Platform — Main Page (route `/`)
 *
 * The single user-visible route. Renders the AppShell + DashboardRouter.
 * All module "pages" are client-side views resolved by the router.
 */

import { Providers } from "@/components/platform/providers";
import { AppShell } from "@/components/shell/app-shell";
import { DashboardRouter } from "@/components/platform/dashboard-router";
import { DetailOverlayHost } from "@/components/platform/detail-overlay";

export default function Home() {
  return (
    <Providers>
      <AppShell>
        <DashboardRouter />
        {/* Sub-screen overlays (?panel=…) — enterprise pattern: inspect
            a row without leaving the list behind it. */}
        <DetailOverlayHost />
      </AppShell>
    </Providers>
  );
}
