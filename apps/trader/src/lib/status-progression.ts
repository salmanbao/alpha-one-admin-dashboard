export type LifecycleStage = {
  label: string;
  tone: 'success' | 'warning' | 'primary' | 'tertiary' | 'error' | 'neutral';
  badgeLabel: string;
  dot?: boolean;
  pulse?: boolean;
  eta?: string;
};

export function getProvisioningStage(submittedAt?: string): LifecycleStage | null {
  if (!submittedAt) return null;
  
  const submittedDate = new Date(submittedAt);
  const now = new Date();
  const elapsedDays = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const stage = Math.min(5, Math.max(1, elapsedDays));
  
  const stages: Record<number, LifecycleStage> = {
    1: {
      label: "Payment confirmed",
      tone: "primary",
      badgeLabel: "1/5",
      dot: true,
    },
    2: {
      label: "KYC verified",
      tone: "success",
      badgeLabel: "2/5",
      dot: true,
    },
    3: {
      label: "Risk profile assigned",
      tone: "primary",
      badgeLabel: "3/5",
      dot: true,
    },
    4: {
      label: "Server space reserved",
      tone: "warning",
      badgeLabel: "4/5",
      dot: true,
    },
    5: {
      label: "Platform account created",
      tone: "success",
      badgeLabel: "5/5",
      dot: true,
    },
  };
  
  return stages[stage] || null;
}

export function getKycStage(reviewStatus: string): LifecycleStage {
  const stages: Record<string, LifecycleStage> = {
    'not-started': {
      label: "Not started",
      tone: "tertiary",
      badgeLabel: "0/3",
      dot: true,
    },
    draft: {
      label: "In progress",
      tone: "primary",
      badgeLabel: "1/3",
      dot: true,
    },
    submitted: {
      label: "Submitted",
      tone: "tertiary",
      badgeLabel: "2/3",
      dot: true,
    },
    'in-review': {
      label: "In review",
      tone: "tertiary",
      badgeLabel: "3/3",
      dot: true,
      pulse: true,
    },
    approved: {
      label: "Approved",
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
  
  return stages[reviewStatus] || stages['not-started'];
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