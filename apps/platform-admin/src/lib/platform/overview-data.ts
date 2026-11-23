"use client";

/**
 * Overview data seam – consolidates all operational metrics into a single, testable hook.
 * Uses the existing stores and async-mock pattern to provide loading/error/retry states.
 * All data is derived from existing stores; no new backend needed.
 *
 * NOTE: Hooks are called unconditionally at the top level of useOverviewData().
 * Rules of Hooks are satisfied – no hooks inside conditionals, loops, or nested functions.
 */

import { useSyncExternalStore } from "react";
import { useIncidentCenter, readIncidents, correlationsFor, effectiveSeverity } from "./incident-center-store";
import { listOpenTasks } from "./pending-tasks-store";
import { listAnnouncements } from "./announcements-store";
import { readJobOverrides, useJobOverrides } from "./jobs-store";
import { useTenants } from "./tenant-store";
import { usePlans } from "./plan-catalog-store";
import { useAsyncMock } from "@/lib/platform/async-mock";
import { useState, useCallback, useEffect } from "react";

/* ------------------------------------------------------------------ */
/* Types ------------------------------------------------------------- */
export interface OverviewData {
  tenants: any[]; // TenantContext[]
  incidents: any[]; // Incident[]
  pendingTasks: any[]; // PendingTask[]
  jobs: any; // JobOverride[] (OverrideMap shape from store)
  announcements: any[]; // Announcement[]
  incidentState: any; // IncidentCenterState
  plans: any[]; // Plan[]
  mrrValue: number;
  activeTenantCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
  fetchedAt: Date | null;
  data: any; // Full dataset for components
}

/* ------------------------------------------------------------------ */
/* Main hook – all hooks called unconditionally at top level ---------- */
export function useOverviewData(): OverviewData {
  // 1. Tenants – use the tenant store hook (sync via useSyncExternalStore internally)
  const tenants = useTenants();

  // 2. Incidents – use incident-center-store hook + readIncidents for seed data
  const incidentState = useIncidentCenter();
  const incidents = readIncidents();

  // 3. Pending tasks – synchronous function (no hook needed; localStorage-backed)
  const pendingTasks = listOpenTasks();

  // 4. Jobs – use the jobs-store hook for overrides
  const jobs: any = useJobOverrides();

  // 5. Announcements – synchronous function (no hook needed; localStorage-backed)
  const announcements = listAnnouncements();

  // 6. Plans – use plan-catalog-store hook
  const plans = usePlans();

  // 7. Derive MRR from plans and tenant plans
  let mrrValue = 0;
  let activeTenantCount = 0;
  if (tenants.length > 0 && plans.length > 0) {
    mrrValue = tenants.reduce((sum, t: any) => {
      const plan = plans.find((p: any) => p.id === t.plan);
      return sum + (plan ? plan.priceMonthly : 0);
    }, 0);
    activeTenantCount = tenants.filter((t: any) => t.status === "active").length;
  }

  // 8. Loading/error/retry/fetchedAt – async-mock pattern (D06)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { loading, retry: mockRetry } = useAsyncMock(
    async () => {
      // Simulate fetching from all stores
      // In production this would be real API calls
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        tenants,
        incidents,
        pendingTasks,
        jobs,
        announcements,
        incidentState,
        plans,
        mrrValue,
        activeTenantCount,
      };
    },
    [tenants, incidents, pendingTasks, jobs, announcements, incidentState, plans, mrrValue, activeTenantCount],
    { keepPreviousData: true }
  );

  // Wrap retry to also clear error and update fetchedAt
  const retry = useCallback(() => {
    setError(null);
    mockRetry();
  }, [mockRetry]);

  // Update fetchedAt on successful data load
  useEffect(() => {
    if (!loading && !error) {
      setFetchedAt(new Date());
    }
  }, [loading, error]);

  // 9. Aggregate dataset
  const data = {
    tenants,
    incidents,
    pendingTasks,
    jobs,
    announcements,
    incidentState,
    plans,
    mrrValue,
    activeTenantCount,
  };

  return {
    tenants,
    incidents,
    pendingTasks,
    jobs,
    announcements,
    incidentState,
    plans,
    mrrValue,
    activeTenantCount,
    loading,
    error,
    retry,
    fetchedAt,
    data,
  };
}

/* ------------------------------------------------------------------ */
/* Export ------------------------------------------------------------ */
export default useOverviewData;