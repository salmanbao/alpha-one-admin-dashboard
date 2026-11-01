"use client";

import { DashboardRouter } from "@/components/platform/dashboard-router";

export default function Home() {
  return (
    <main role="main" aria-label="Platform Dashboard">
      <DashboardRouter />
    </main>
  );
}