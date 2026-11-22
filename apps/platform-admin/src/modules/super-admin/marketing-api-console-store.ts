"use client";
/**
 * R2-12 — Marketing API Gateway Console store (depth uplift).
 *
 * Replaces the narrated "201 Created" / breach toasts with store-backed
 * behaviour: playground executions are persisted as a run log (sandbox
 * tenant, key, request, response, status) and rate-limit breaches are
 * recorded as first-class events the page surfaces and pushes to the
 * tenant alert subscription (AC-2).
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export interface PlaygroundRun {
  id: string;
  at: string;
  tenant: string;
  keyId: string;
  keyName: string;
  tier: "sandbox" | "standard" | "premium";
  request: string;
  status: 201 | 403 | 500;
  response: string;
  note: string;
}

export interface RateLimitBreach {
  id: string;
  at: string;
  keyId: string;
  keyName: string;
  tenant: string;
  count: number;
  severity: "warning" | "critical";
}

/* R13 P1-2 — run log and breaches persist across reloads. */
const STORAGE_KEY = "pfaas:platform-admin:marketing-api-console";

function loadState(): { runs: PlaygroundRun[]; breaches: RateLimitBreach[] } {
  if (typeof window === "undefined") return { runs: [], breaches: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runs: [], breaches: [] };
    const parsed = JSON.parse(raw);
    return {
      runs: Array.isArray(parsed?.runs) ? parsed.runs : [],
      breaches: Array.isArray(parsed?.breaches) ? parsed.breaches : [],
    };
  } catch {
    return { runs: [], breaches: [] };
  }
}

function saveState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ runs: RUNS, breaches: BREACHES }));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

const loaded = loadState();
let RUNS: PlaygroundRun[] = loaded.runs;
let BREACHES: RateLimitBreach[] = loaded.breaches;

export function listRuns(): PlaygroundRun[] { return [...RUNS].sort((a, b) => b.at.localeCompare(a.at)); }
export function listBreaches(): RateLimitBreach[] { return [...BREACHES].sort((a, b) => b.at.localeCompare(a.at)); }

export function recordRun(run: Omit<PlaygroundRun, "id" | "at">): PlaygroundRun {
  const rec: PlaygroundRun = { ...run, id: `run-${Date.now().toString(36)}`, at: new Date().toISOString() };
  RUNS = [rec, ...RUNS].slice(0, 50);
  saveState();
  recordAudit({ actor: "operator", action: "api.playground", target: run.keyId, detail: `Playground run on ${run.tenant} via ${run.keyName}: ${run.status} ${run.note}`, severity: "info" });
  emit();
  return rec;
}

export function recordBreach(b: Omit<RateLimitBreach, "id" | "at">): RateLimitBreach {
  const rec: RateLimitBreach = { ...b, id: `br-${Date.now().toString(36)}`, at: new Date().toISOString() };
  BREACHES = [rec, ...BREACHES].slice(0, 50);
  saveState();
  recordAudit({ actor: "system", action: "api.rate_limit_breach", target: b.keyId, detail: `${b.keyName} (${b.tenant}) breached rate limit — ${b.count} hit(s)`, severity: b.severity });
  emit();
  return rec;
}

const listeners = new Set<() => void>();
let version = 0;
function emit() { version += 1; listeners.forEach(l => l()); }

export function useApiConsoleVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
