"use client";

/**
 * Provisioning handoff — R2-03.
 *
 * Records `purchasedAt` at checkout success so the provisioning page
 * can derive progress from a real timestamp instead of a hardcoded
 * constant. Persisted in localStorage (survives reload).
 */

const STORAGE_KEY = "pfaas:trader:provisioningHandoff";

export type ProvisioningHandoff = {
  purchasedAt: string;
  orderId?: string;
};

export function writeProvisioningHandoff(handoff: ProvisioningHandoff): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    /* storage unavailable */
  }
}

export function readProvisioningHandoff(): ProvisioningHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProvisioningHandoff>;
    if (!parsed?.purchasedAt) return null;
    return { purchasedAt: parsed.purchasedAt, orderId: parsed.orderId };
  } catch {
    return null;
  }
}
