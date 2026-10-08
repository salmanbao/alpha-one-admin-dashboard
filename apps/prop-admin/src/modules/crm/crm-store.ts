"use client";

import { useEffect, useState } from "react";
import { getTenantContacts, type CrmContact } from "@/lib/platform/mock-data";

/**
 * Session-scoped CRM contact store.
 *
 * Contact mutations (stage moves on the Pipeline kanban, notes saved in
 * the drawer, convert, delete) mutate this store; Overview stats, the
 * Contacts table and the Pipeline kanban all read the same effective
 * list, so the previously desynced views stay consistent.
 */
const overrides = new Map<string, Partial<CrmContact>>(); // key: `${tenantId}:${contactId}`
const deletedIds = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

const key = (tenantId: string, contactId: string) => `${tenantId}:${contactId}`;

/** Patch a contact (stage, notes, ...) for this session. */
export function updateCrmContact(
  tenantId: string,
  contactId: string,
  patch: Partial<CrmContact>,
) {
  const k = key(tenantId, contactId);
  overrides.set(k, { ...overrides.get(k), ...patch });
  emit();
}

/** Remove a contact for this session. */
export function deleteCrmContact(tenantId: string, contactId: string) {
  deletedIds.add(key(tenantId, contactId));
  emit();
}

/** Subscribe + return the effective (tenant-scoped, mutated) contact list. */
export function useCrmContacts(tenantId: string): CrmContact[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((v) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return getTenantContacts(tenantId)
    .filter((c) => !deletedIds.has(key(tenantId, c.id)))
    .map((c) => ({ ...c, ...overrides.get(key(tenantId, c.id)) }));
}
