/**
 * R13 TM-10 — Scheduled plan transitions scheduler.
 *
 * Runs `applyDueScheduledPlans()` on a 60-second interval so scheduled
 * plan changes execute even when no operator has the plans page open.
 * Also raises due/overdue notifications through the existing push
 * notification channel.
 */
import { useEffect, useRef } from "react";
import { applyDueScheduledPlans, readTenants } from "./tenant-store";

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

type PushNotification = (opts: {
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
  module: string;
}) => void;

/**
 * Hook that runs the scheduled-plan sweep on an interval.
 * Mount once in the platform context or any long-lived component.
 */
export function useScheduledPlanScheduler(pushNotification: PushNotification) {
  const lastNotified = useRef<Set<string>>(new Set());

  function sweep() {
    // Capture tenants with due schedules before applying.
    const now = new Date();
    const dueTenants = readTenants().filter(
      (t) =>
        t.scheduledPlan &&
        new Date(t.scheduledPlan.scheduledFor) <= now &&
        !lastNotified.current.has(t.id),
    );

    // Apply due schedules.
    applyDueScheduledPlans();

    // Notify for newly-due transitions (once per tenant).
    for (const t of dueTenants) {
      lastNotified.current.add(t.id);
      pushNotification({
        title: "Scheduled plan transition applied",
        message: `${t.name} → ${t.scheduledPlan?.plan ?? "new plan"} (scheduled for ${new Date(t.scheduledPlan!.scheduledFor).toLocaleString()})`,
        severity: "info",
        module: "super-admin",
      });
    }
  }

  useEffect(() => {
    // Run immediately on mount.
    sweep();

    const interval = setInterval(sweep, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);

  }, []);
}
