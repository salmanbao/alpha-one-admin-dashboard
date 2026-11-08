export type LifecycleStage = {
  label: string;
  tone: 'success' | 'warning' | 'primary' | 'tertiary' | 'error' | 'neutral';
  badgeLabel: string;
  dot?: boolean;
  pulse?: boolean;
  eta?: string;
};

/** Demo-viable pacing: minutes per provisioning stage (6 stages total). */
export const PROVISIONING_MINUTES_PER_STAGE = 10;
export const PROVISIONING_TOTAL_STAGES = 6;

export type ProvisioningProgress = {
  /** Completed stage count, 0..6 */
  done: number;
  total: number;
  complete: boolean;
  /** Current/representative stage info for badges */
  stage: LifecycleStage | null;
};

/**
 * Deterministic provisioning progress from a purchase timestamp.
 * Uses minutes-per-stage pacing (demo acceleration) so the flow is
 * exercisable without waiting real days. All 6 rows can complete.
 */
export function getProvisioningProgress(purchasedAt?: string): ProvisioningProgress {
  const total = PROVISIONING_TOTAL_STAGES;
  if (!purchasedAt) {
    return { done: 0, total, complete: false, stage: null };
  }
  const started = new Date(purchasedAt).getTime();
  if (!Number.isFinite(started)) {
    return { done: 0, total, complete: false, stage: null };
  }
  const elapsedMinutes = Math.max(0, (Date.now() - started) / 60000);
  const done = Math.min(total, Math.floor(elapsedMinutes / PROVISIONING_MINUTES_PER_STAGE) + 1);
  const complete = done >= total;
  const stageIndex = Math.min(5, Math.max(1, done));
  const labels: Record<number, string> = {
    1: "Payment confirmed",
    2: "KYC verified",
    3: "Risk profile assigned",
    4: "Server space reserved",
    5: "Platform account created",
    6: "Credentials delivered",
  };
  const stage: LifecycleStage = {
    label: labels[Math.min(6, Math.max(1, done))] ?? "Provisioning",
    tone: complete ? "success" : "primary",
    badgeLabel: complete ? "Active" : `${Math.min(done, 5)}/5`,
    dot: true,
    pulse: !complete,
  };
  return { done, total, complete, stage };
}

/** Back-compat helper; derives from getProvisioningProgress. */
export function getProvisioningStage(submittedAt?: string): LifecycleStage | null {
  return getProvisioningProgress(submittedAt).stage;
}


export function getPayoutStage(status: string, eta?: string): LifecycleStage {
  const stages: Record<string, LifecycleStage> = {
    'requested': {
      label: "Requested",
      tone: "primary",
      badgeLabel: "1/4",
      dot: true,
    },
    'under review': {
      label: "Under review",
      tone: "primary",
      badgeLabel: "2/4",
      dot: true,
    },
    processing: {
      label: "Processing",
      tone: "warning",
      badgeLabel: "3/4",
      dot: true,
      eta: eta || "Typically 1-3 business days",
    },
    paid: {
      label: "Paid",
      tone: "success",
      badgeLabel: "✓",
      dot: true,
    },
    rejected: {
      label: "Rejected",
      tone: "error",
      badgeLabel: "✗",
      dot: true,
    },
  };
  
  return stages[status] || stages['requested'];
}