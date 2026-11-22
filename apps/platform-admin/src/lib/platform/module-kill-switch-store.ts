"use client";

/**
 * Module Kill Switch Store — P0-5.
 *
 * Persisted fleet-wide module disable state under
 * pfaas:platform-admin:module-kill-switches. Real persisted state with
 * audit trail through console-store.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:module-kill-switches";

export interface ModuleKillSwitch {
  moduleId: string;
  moduleName: string;
  disabled: boolean;
  disabledAt?: string;
  disabledBy?: string;
  enabledAt?: string;
  enabledBy?: string;
}

/** Seed fixtures — empty by default (no modules disabled). */
const SEED_KILL_SWITCHES: ModuleKillSwitch[] = [];

function readSeedList(list: unknown): ModuleKillSwitch[] {
  if (!Array.isArray(list)) return SEED_KILL_SWITCHES;
  return list.filter(
    (k): k is ModuleKillSwitch =>
      !!k &&
      typeof k === "object" &&
      typeof (k as ModuleKillSwitch).moduleId === "string" &&
      typeof (k as ModuleKillSwitch).moduleName === "string" &&
      typeof (k as ModuleKillSwitch).disabled === "boolean",
  );
}

function readRaw(): ModuleKillSwitch[] {
  if (typeof window === "undefined") return SEED_KILL_SWITCHES;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY ?? "null") ?? "[]",
    );
    return readSeedList(stored);
  } catch {
    return SEED_KILL_SWITCHES;
  }
}

function writeRaw(next: ModuleKillSwitch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(SEED_KILL_SWITCHES);
}

export function readKillSwitches(): ModuleKillSwitch[] {
  return readRaw();
}

export function useKillSwitches(): ModuleKillSwitch[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as ModuleKillSwitch[];
}

export function getKillSwitch(moduleId: string): ModuleKillSwitch | undefined {
  return readRaw().find((k) => k.moduleId === moduleId);
}

/** Toggle the fleet-wide kill switch for a module. */
export function toggleKillSwitch(
  moduleId: string,
  moduleName: string,
  disabled: boolean,
  operator: { id: string; name: string },
): { title: string; description: string } {
  const killSwitches = readRaw();
  const idx = killSwitches.findIndex((k) => k.moduleId === moduleId);
  const now = new Date().toISOString();

  if (disabled) {
    // Disable the module
    const next: ModuleKillSwitch[] = idx >= 0
      ? killSwitches.map((k, i) => i === idx ? { ...k, disabled: true, disabledAt: now, disabledBy: operator.name } : k)
      : [...killSwitches, { moduleId, moduleName, disabled: true, disabledAt: now, disabledBy: operator.name }];
    writeRaw(next);
    recordAudit({
      actor: operator.name,
      action: "module.kill_switch_engaged",
      target: moduleId,
      severity: "critical",
      detail: `Fleet-wide kill switch engaged for ${moduleName} (${moduleId}) by ${operator.name}.`,
    });
    return {
      title: "Kill switch engaged",
      description: `${moduleName} is now disabled fleet-wide.`,
    };
  } else {
    // Re-enable the module
    const next: ModuleKillSwitch[] = killSwitches.map((k) =>
      k.moduleId === moduleId ? { ...k, disabled: false, enabledAt: now, enabledBy: operator.name } : k
    );
    writeRaw(next);
    recordAudit({
      actor: operator.name,
      action: "module.kill_switch_released",
      target: moduleId,
      severity: "warning",
      detail: `Fleet-wide kill switch released for ${moduleName} (${moduleId}) by ${operator.name}.`,
    });
    return {
      title: "Kill switch released",
      description: `${moduleName} is no longer fleet-disabled.`,
    };
  }
}

/** Get the disabled state for a module. */
export function isModuleDisabled(moduleId: string): boolean {
  const ks = getKillSwitch(moduleId);
  return ks?.disabled ?? false;
}