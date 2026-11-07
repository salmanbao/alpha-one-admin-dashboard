"use client";
/**
 * R3-02 — Sanctions & PEP Screening Manager store (dummy, store-backed).
 *
 * Manages the screening *inputs*: list sources, versions, match thresholds,
 * rescan schedules and a match-review queue whose dispositions write back
 * into the R2-07 case screening rows with list-version provenance.
 *
 * AC-1  a list version bump appears in case screening rows created after the sync.
 * AC-2  a threshold change triggers a documented rescan job (counts before/after).
 * AC-3  queue dispositions update the linked case screening result.
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { listAmlAlerts, getAmlCase, updateAmlCase } from "./aml-store";

export type ScreeningListKind = "sanctions" | "PEP" | "RCA" | "adverse-media";
export type RescanSchedule = "on-sync" | "on-case-open" | "nightly-batch";
export type MatchDisposition = "pending" | "true-match" | "false-positive";
export type RescanTrigger = "nightly-batch" | "version-bump" | "threshold-change" | "manual";

export interface ScreeningVersion {
  version: string;
  at: string;
  diff: string;
  matches: number;
}

export interface RescanJob {
  at: string;
  trigger: RescanTrigger;
  listVersion: string;
  casesScanned: number;
  matchesBefore: number;
  matchesAfter: number;
  by: string;
}

export interface ScreeningSource {
  id: string;
  provider: string;
  lists: ScreeningListKind[];
  currentVersion: string;
  lastSync: string;
  nextSync: string;
  /** Match count delta delivered by the current version. */
  matchDelta: number;
  thresholdExact: number;
  thresholdFuzzy: number;
  rescan: RescanSchedule;
  versions: ScreeningVersion[];
  jobs: RescanJob[];
}

export interface ScreeningMatch {
  id: string;
  caseId: string;
  provider: string;
  subject: string;
  listKind: ScreeningListKind;
  result: "potential" | "hit";
  score: number;
  detail: string;
  at: string;
  /** Provenance — which list version produced this row (R3-02). */
  listVersion: string;
  disposition: MatchDisposition;
  dispositionBy?: string;
  dispositionAt?: string;
}

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const NEXT_SYNC: Record<RescanSchedule, string> = {
  "nightly-batch": "tonight 00:00 UTC",
  "on-sync": "on provider sync",
  "on-case-open": "on case open",
};

let SOURCES: ScreeningSource[] = [
  {
    id: "src-comply", provider: "ComplyAdvantage", lists: ["sanctions", "PEP", "adverse-media"],
    currentVersion: "2026.10.28", lastSync: daysAgo(1), nextSync: NEXT_SYNC["nightly-batch"],
    matchDelta: 12, thresholdExact: 100, thresholdFuzzy: 85, rescan: "nightly-batch",
    versions: [
      { version: "2026.10.28", at: daysAgo(1), diff: "+12 PEP entries, -2 delisted", matches: 431 },
      { version: "2026.10.14", at: daysAgo(15), diff: "+8 sanctions entries, 1 RCA re-classification", matches: 421 },
    ],
    jobs: [
      { at: daysAgo(1), trigger: "nightly-batch", listVersion: "2026.10.28", casesScanned: 4, matchesBefore: 4, matchesAfter: 4, by: "scheduler" },
    ],
  },
  {
    id: "src-worldcheck", provider: "World-Check", lists: ["sanctions", "PEP", "RCA"],
    currentVersion: "2026.10.30", lastSync: daysAgo(3), nextSync: NEXT_SYNC["on-case-open"],
    matchDelta: -4, thresholdExact: 100, thresholdFuzzy: 88, rescan: "on-case-open",
    versions: [
      { version: "2026.10.30", at: daysAgo(3), diff: "-4 PEP entries (expired), +1 RCA", matches: 289 },
    ],
    jobs: [],
  },
  {
    id: "src-opensanctions", provider: "OpenSanctions (self-hosted)", lists: ["sanctions", "RCA", "adverse-media"],
    currentVersion: "2026.11.01", lastSync: daysAgo(1), nextSync: NEXT_SYNC["on-sync"],
    matchDelta: 7, thresholdExact: 100, thresholdFuzzy: 82, rescan: "on-sync",
    versions: [
      { version: "2026.11.01", at: daysAgo(1), diff: "+7 consolidated sanctions entries", matches: 912 },
      { version: "2026.10.18", at: daysAgo(20), diff: "+41 entries (weekly import)", matches: 905 },
    ],
    jobs: [
      { at: daysAgo(1), trigger: "nightly-batch", listVersion: "2026.11.01", casesScanned: 4, matchesBefore: 2, matchesAfter: 2, by: "scheduler" },
    ],
  },
];

function providerOf(source: ScreeningSource): string {
  return source.provider.replace(" (self-hosted)", "");
}

function versionForProvider(provider: string): string {
  const s = SOURCES.find((x) => providerOf(x) === provider);
  return s?.currentVersion ?? "unknown";
}

function sourceForProvider(provider: string): ScreeningSource | undefined {
  return SOURCES.find((x) => providerOf(x) === provider);
}

function seedMatch(
  id: string, caseId: string, provider: string, listKind: ScreeningListKind,
  result: "potential" | "hit", score: number, detail: string, at: string,
  disposition: MatchDisposition = "pending", dispositionBy?: string,
): ScreeningMatch {
  const c = getAmlCase(caseId);
  return {
    id, caseId, provider, subject: c?.traderName ?? caseId, listKind, result, score, detail, at,
    listVersion: versionForProvider(provider),
    disposition,
    dispositionBy,
    dispositionAt: dispositionBy ? at : undefined,
  };
}

let MATCHES: ScreeningMatch[] = [
  seedMatch("MTCH-001", "aml1", "ComplyAdvantage", "sanctions", "potential", 84, "Name similarity (low confidence)", daysAgo(5)),
  seedMatch("MTCH-002", "aml2", "World-Check", "PEP", "hit", 97, "PEP: senior political exposure (relative)", daysAgo(5)),
  seedMatch("MTCH-003", "aml1", "World-Check", "RCA", "potential", 86, "Shared address with a delisted entity (RCA)", daysAgo(4)),
  seedMatch("MTCH-004", "aml3", "OpenSanctions (self-hosted)", "RCA", "potential", 83, "RCA: cousin of a sanctioned individual", daysAgo(3)),
  seedMatch("MTCH-005", "aml4", "ComplyAdvantage", "adverse-media", "potential", 79, "Local news mention (unverified)", daysAgo(9), "false-positive", "analyst"),
  seedMatch("MTCH-006", "aml2", "OpenSanctions (self-hosted)", "sanctions", "potential", 90, "Sanctions entity partial match (transliteration)", daysAgo(2)),
];

/* Store subscription (mirrors payout/AML store patterns). */
const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function listScreeningSources(): ScreeningSource[] {
  return SOURCES;
}

export function getScreeningSource(id: string): ScreeningSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function listScreeningMatches(): ScreeningMatch[] {
  return MATCHES;
}

/** Queue stats for the register strip. */
export function screeningMetrics() {
  const pending = MATCHES.filter((m) => m.disposition === "pending").length;
  const trueMatches = MATCHES.filter((m) => m.disposition === "true-match").length;
  const falsePositives = MATCHES.filter((m) => m.disposition === "false-positive").length;
  const jobs = SOURCES.reduce((n, s) => n + s.jobs.length, 0);
  return { sources: SOURCES.length, pending, trueMatches, falsePositives, jobs };
}

/** Matches a source currently surfaces (score at/above its fuzzy threshold). */
export function surfacedMatches(source: ScreeningSource): number {
  const provider = providerOf(source);
  return MATCHES.filter((m) => m.provider === provider && m.score >= source.thresholdFuzzy).length;
}

function nextVersion(current: string): string {
  const d = new Date();
  const today = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const re = new RegExp(`^${today.replace(/\./g, "\\.")}\\.(\\d+)$`);
  const m = current.match(re);
  if (m) return `${today}.${Number(m[1]) + 1}`;
  return current === today ? `${today}.1` : today;
}

function logJob(s: ScreeningSource, job: Omit<RescanJob, "listVersion">): ScreeningSource {
  return { ...s, jobs: [{ ...job, listVersion: s.currentVersion }, ...s.jobs] };
}

/**
 * AC-1 — version bump: the new version becomes current, and every open case
 * screening row for this provider is re-stamped (or created) with it, so
 * rows created after the sync carry the new provenance. Newly surfaced
 * candidates are added to the review queue. A rescan job is logged.
 */
export function bumpListVersion(sourceId: string, actor: string): { ok: boolean; version?: string } {
  const s = getScreeningSource(sourceId);
  if (!s) return { ok: false };
  const version = nextVersion(s.currentVersion);
  const provider = providerOf(s);
  const openCases = listAmlAlerts().filter((c) => c.status === "open" || c.status === "investigating" || c.status === "escalated");

  let matchesBefore = 0;
  let matchesAfter = 0;
  const newMatches: ScreeningMatch[] = [];

  for (const c of openCases) {
    matchesBefore += c.screening.filter((r) => r.provider === provider && r.result !== "clear").length;
    const rows = [...c.screening];
    const idx = rows.findIndex((r) => r.provider === provider);
    if (idx >= 0) {
      const row = { ...rows[idx], listVersion: version, at: now(), detail: `${rows[idx].detail} · rescanned against ${version}` };
      rows[idx] = row;
    } else {
      // A candidate created by this sync — new row, new provenance (AC-1).
      rows.push({ provider, result: "potential", detail: `Rescan ${version}: new candidate match`, at: now(), listVersion: version });
      newMatches.push({
        id: `MTCH-${String(MATCHES.length + newMatches.length + 1).padStart(3, "0")}`,
        caseId: c.id, provider, subject: c.traderName, listKind: s.lists[0],
        result: "potential", score: s.thresholdFuzzy + 3,
        detail: `Rescan ${version}: new candidate match`, at: now(),
        listVersion: version, disposition: "pending",
      });
    }
    matchesAfter += rows.filter((r) => r.provider === provider && r.result !== "clear").length;
    updateAmlCase(c.id, { screening: rows }, {
      action: "screening.rescan",
      summary: `Screening rows re-stamped with list version ${version} (${provider})`,
    });
  }

  MATCHES = [...newMatches, ...MATCHES];

  const updated: ScreeningSource = {
    ...s,
    currentVersion: version,
    lastSync: now(),
    nextSync: NEXT_SYNC[s.rescan],
    versions: [
      { version, at: now(), diff: `${newMatches.length > 0 ? `+${newMatches.length} candidate(s) in open cases, ` : ""}${s.matchDelta >= 0 ? `+${s.matchDelta}` : s.matchDelta} list entries vs prior version`, matches: (s.versions[0]?.matches ?? 400) + s.matchDelta },
      ...s.versions,
    ],
  };
  SOURCES = SOURCES.map((x) => (x.id === sourceId ? logJob(updated, { at: now(), trigger: "version-bump", casesScanned: openCases.length, matchesBefore, matchesAfter, by: actor }) : x));

  recordAudit({
    action: "Screening list version bumped",
    entity: "screening-source",
    entityId: sourceId,
    summary: `${provider} → ${version}; rescan of ${openCases.length} open case(s), matches ${matchesBefore} → ${matchesAfter} (by ${actor})`,
    module: "risk",
    severity: "info",
  });
  emit();
  return { ok: true, version };
}

/**
 * AC-2 — threshold change triggers a documented rescan job with counts
 * before/after (which matches were surfaced under the old vs new fuzzy cut).
 */
export function setMatchThreshold(sourceId: string, fuzzy: number, exact: number, actor: string): boolean {
  const s = getScreeningSource(sourceId);
  if (!s) return false;
  const provider = providerOf(s);
  const before = MATCHES.filter((m) => m.provider === provider && m.score >= s.thresholdFuzzy).length;
  const clampedFuzzy = Math.max(0, Math.min(100, Math.round(fuzzy)));
  const clampedExact = Math.max(0, Math.min(100, Math.round(exact)));
  const after = MATCHES.filter((m) => m.provider === provider && m.score >= clampedFuzzy).length;
  const openCases = listAmlAlerts().filter((c) => c.status === "open" || c.status === "investigating" || c.status === "escalated");

  SOURCES = SOURCES.map((x) =>
    x.id === sourceId
      ? logJob(
          { ...x, thresholdFuzzy: clampedFuzzy, thresholdExact: clampedExact },
          { at: now(), trigger: "threshold-change", casesScanned: openCases.length, matchesBefore: before, matchesAfter: after, by: actor },
        )
      : x,
  );
  recordAudit({
    action: "Screening match threshold changed",
    entity: "screening-source",
    entityId: sourceId,
    summary: `${provider} fuzzy ${s.thresholdFuzzy} → ${clampedFuzzy}, exact ${s.thresholdExact} → ${clampedExact}; rescan ${before} → ${after} surfaced matches (by ${actor})`,
    module: "risk",
    severity: "info",
  });
  emit();
  return true;
}

export function setRescanSchedule(sourceId: string, schedule: RescanSchedule, actor: string): boolean {
  const s = getScreeningSource(sourceId);
  if (!s) return false;
  SOURCES = SOURCES.map((x) => (x.id === sourceId ? { ...x, rescan: schedule, nextSync: NEXT_SYNC[schedule] } : x));
  recordAudit({
    action: "Screening rescan schedule changed",
    entity: "screening-source",
    entityId: sourceId,
    summary: `${providerOf(s)} rescan schedule → ${schedule} (by ${actor})`,
    module: "risk",
    severity: "info",
  });
  emit();
  return true;
}

/** Manual rescan — documented job with counts before/after (no version change). */
export function runRescan(sourceId: string, actor: string): boolean {
  const s = getScreeningSource(sourceId);
  if (!s) return false;
  const provider = providerOf(s);
  const before = MATCHES.filter((m) => m.provider === provider && m.score >= s.thresholdFuzzy).length;
  const openCases = listAmlAlerts().filter((c) => c.status === "open" || c.status === "investigating" || c.status === "escalated");
  for (const c of openCases) {
    const rows = c.screening.map((r) => (r.provider === provider ? { ...r, at: now(), detail: `${r.detail} · manual rescan ${s.currentVersion}` } : r));
    updateAmlCase(c.id, { screening: rows }, { action: "screening.rescan", summary: `Manual rescan of open cases against ${provider} ${s.currentVersion}` });
  }
  SOURCES = SOURCES.map((x) => (x.id === sourceId ? logJob({ ...x, lastSync: now() }, { at: now(), trigger: "manual", casesScanned: openCases.length, matchesBefore: before, matchesAfter: before, by: actor }) : x));
  recordAudit({
    action: "Screening rescan run",
    entity: "screening-source",
    entityId: sourceId,
    summary: `${provider} ${s.currentVersion} manual rescan over ${openCases.length} open case(s): ${before} surfaced match(es) (by ${actor})`,
    module: "risk",
    severity: "info",
  });
  emit();
  return true;
}

/**
 * AC-3 — disposition in the review queue updates the linked case screening
 * result (true match → hit, false positive → clear, pending → potential),
 * stamping who decided and against which list version.
 */
export function dispositionMatch(matchId: string, disposition: MatchDisposition, actor: string): boolean {
  const m = MATCHES.find((x) => x.id === matchId);
  if (!m || m.disposition === disposition) return false;
  const c = getAmlCase(m.caseId);
  if (!c) return false;

  const result = disposition === "true-match" ? "hit" : disposition === "false-positive" ? "clear" : "potential";
  const rows = [...c.screening];
  const idx = rows.findIndex((r) => r.provider === m.provider);
  const row = {
    provider: m.provider,
    result: result as "clear" | "hit" | "potential",
    detail: `${m.detail} — disposition: ${disposition} by ${actor} (${m.listVersion})`,
    at: now(),
    listVersion: m.listVersion,
  };
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.push(row);

  updateAmlCase(m.caseId, { screening: rows }, {
    action: "screening.disposition",
    summary: `Match ${m.id} (${m.provider}) → ${disposition}; case screening result updated to ${result}`,
  });
  MATCHES = MATCHES.map((x) =>
    x.id === matchId ? { ...x, disposition, dispositionBy: actor, dispositionAt: now() } : x,
  );
  recordAudit({
    action: "Screening match disposition",
    entity: "screening-match",
    entityId: matchId,
    summary: `${m.subject} (${m.caseId}) ${m.provider} → ${disposition} by ${actor}; case row set to ${result} [${m.listVersion}]`,
    module: "risk",
    severity: disposition === "true-match" ? "warning" : "info",
  });
  emit();
  return true;
}

/**
 * R2-07 uplift — case-level rescan: re-stamp this case's screening rows
 * against each provider's *current* list version (the provenance R3-02
 * tracks), returning how many rows changed for the action toast.
 */
export function rescanCase(caseId: string, actor: string): { ok: boolean; updated: number; versions: string[] } {
  const c = getAmlCase(caseId);
  if (!c) return { ok: false, updated: 0, versions: [] };
  const versions: string[] = [];
  let updated = 0;
  const rows = c.screening.map((r) => {
    const s = sourceForProvider(r.provider);
    if (!s) return r;
    if (!versions.includes(s.currentVersion)) versions.push(s.currentVersion);
    if (r.listVersion === s.currentVersion) return r;
    updated += 1;
    const base = r.detail.split(" · ")[0];
    return { ...r, listVersion: s.currentVersion, at: now(), detail: `${base} · case rescan ${s.currentVersion}` };
  });
  if (updated === 0 && versions.length === 0) return { ok: false, updated: 0, versions: [] };
  updateAmlCase(caseId, { screening: rows }, {
    action: "screening.case-rescan",
    summary: `Case screening rescanned by ${actor} against list versions: ${versions.join(", ") || "no sources"} (${updated} row(s) updated)`,
  });
  recordAudit({
    action: "Case screening rescan",
    entity: "aml-case",
    entityId: caseId,
    summary: `${caseId} rescanned by ${actor} — ${updated} row(s) re-stamped against ${versions.join(", ") || "no sources"}`,
    module: "risk",
    severity: "info",
  });
  emit();
  return { ok: true, updated, versions };
}

/** Subscribe the calling component to screening mutations. */
export function useScreeningVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
