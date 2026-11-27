"use client";

/**
 * Support contract (support workspace, §4.1 contract ledger).
 *
 * One dataset per tenant for the whole platform: the console's
 * Support Assist screen, the global-search ticket hits, the platform
 * overview KPI and the cross-tenant queues column all read the same
 * `supportTickets` seed through this module, and the tenant realm's
 * own support panel binds to the same records — the console never
 * owns ticket lifecycle, it only mirrors it (read-only, audited).
 *
 * Kept as thin derived reads over `mock-data` so the three existing
 * consumers (`global-search`, `platform-overview`, `cross-tenant-queues`)
 * keep compiling while the prop-admin binding lands in a later commit.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { supportTickets, getTenantTickets, type SupportTicket } from "@/lib/platform/mock-data";

/**
 * Support ticket record as rendered by both realms. The console mirror
 * currently reads `messages` as a count; the contract keeps room for the
 * thread refs the tenant panel needs, so the shape never has to widen
 * under a consumer.
 */
export type SupportTicketRecord = SupportTicket;

/** Every seeded ticket — the single dataset. */
export function getAllSupportTickets(): SupportTicket[] {
  return supportTickets;
}

/** Tickets for one tenant (derived read; used by search + overview + queues). */
export function getSupportTickets(tenantId: string): SupportTicket[] {
  return getTenantTickets(tenantId);
}

/**
 * Tenant-scoped subscription for the console mirror: returns the tickets
 * of the platform context's current tenant, or every ticket when the
 * operator is in the all-tenants view (no tenant bound).
 */
export function useSupportTickets(tenantId?: string): SupportTicket[] {
  const { tenant } = usePlatform();
  const bound = tenantId ?? tenant?.id;
  const allTickets = supportTickets;

  return useMemo(() => {
    if (!bound) return allTickets;
    return allTickets.filter((t) => t.tenantId === bound);
  }, [bound, allTickets]);
}
