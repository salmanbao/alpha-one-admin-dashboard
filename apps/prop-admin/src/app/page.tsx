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

export default function Home() {
  return (
    <Providers>
      <AppShell>
        <DashboardRouter />
      </AppShell>
    </Providers>
  );
}
