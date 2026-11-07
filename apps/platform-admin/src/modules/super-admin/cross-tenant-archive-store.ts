"use client";
/**
 * R2-11 — Cross-Tenant Message Archive / e-Discovery store (round-3 uplift).
 *
 * Replaces the narrated "export bundle (dummy)" toasts (R3-F05) with sealed
 * export bundle generation: a bundle ID, a deterministic SHA-256 seal over
 * the case label + sorted message scope, and real downloadable content
 * (PDF evidence book or JSON manifest) carrying consent-receipt refs (N10),
 * campaign approval trails (N6) and hold state. Case folders persist their
 * last seal so a reviewer can see what was handed over and re-export to the
 * same seal.
 *
 * Service contract:
 *  • listMessages / getMessage — archive corpus (tenant + text filters)
 *  • createCase / listCases / getCase — case folders with seal history
 *  • exportSelection / exportCaseBundle — sealed bundles (pdf | manifest)
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { sha256Hex, buildPdf } from "./bundle-utils";

export interface ArchivedMsg {
  id: string; tenant: string; channel: string; to: string; campaign: string;
  status: string; snapshot: string; sentAt: string; legalHold: boolean;
  /** Consent receipt reference (N10) shipped inside every bundle. */
  consentRef: string;
  /** Campaign approval trail reference (N6) shipped inside every bundle. */
  approvalRef: string;
  /** Rendered snapshot text (the evidence body). */
  body: string;
}

const TENANTS = ["Alpha Funded", "Beta Prop", "Gamma"];

let MSGS: ArchivedMsg[] = Array.from({ length: 30 }, (_, i) => {
  const tenant = TENANTS[i % 3];
  const campaign = ["Q4 Scale", "Win-back"][i % 2];
  return {
    id: `xt-${100 + i}`,
    tenant,
    channel: ["email", "sms", "push"][i % 3],
    to: `u${i}@ex.com`,
    campaign,
    status: i % 5 === 0 ? "bounced" : "delivered",
    snapshot: `snp-${100 + i}`,
    sentAt: new Date(Date.now() - i * 7200000).toISOString(),
    legalHold: i === 4,
    consentRef: `rcpt-xt-${100 + i}`,
    approvalRef: `appr-${campaign.toLowerCase().replace(/\s+/g, "-")}-v${(i % 3) + 1}`,
    body: `Exact rendered content for ${tenant} — ${campaign} (${["email", "sms", "push"][i % 3]} to u${i}@ex.com), snapshot snp-${100 + i}.`,
  };
});

export function listMessages(filter: { tenant?: string; text?: string } = {}): ArchivedMsg[] {
  const t = (filter.text ?? "").toLowerCase();
  return MSGS.filter(m =>
    (!filter.tenant || m.tenant === filter.tenant) &&
    (!t || `${m.to} ${m.campaign} ${m.tenant} ${m.id}`.toLowerCase().includes(t)),
  );
}
export function getMessage(id: string): ArchivedMsg | undefined { return MSGS.find(m => m.id === id); }

/* ------------------------------------------------------------------ */
/* Case folders                                                        */
/* ------------------------------------------------------------------ */

export interface CaseSeal {
  bundleId: string;
  seal: string;
  format: BundleFormat;
  at: string;
  bytes: number;
}
export interface CaseFolder {
  id: string;
  name: string;
  ids: string[];
  createdAt: string;
  createdBy: string;
  /** Last export of this case — what was handed over, and its seal. */
  sealed?: CaseSeal;
}

let CASES: CaseFolder[] = [];

export function listCases(): CaseFolder[] { return CASES; }
export function getCase(id: string): CaseFolder | undefined { return CASES.find(c => c.id === id); }

export function createCase(name: string, ids: string[], actor = "operator"): CaseFolder {
  const rec: CaseFolder = {
    id: `case-${CASES.length + 1}-${Date.now().toString(36)}`,
    name, ids: [...ids].sort(), createdAt: new Date().toISOString(), createdBy: actor,
  };
  CASES = [...CASES, rec];
  recordAudit({
    actor, action: "archive.case.create", target: name,
    detail: `e-discovery case folder "${name}" created with ${ids.length} message(s)`,
    severity: "info",
  });
  emit();
  return rec;
}

/* ------------------------------------------------------------------ */
/* Sealed export bundles                                               */
/* ------------------------------------------------------------------ */

export type BundleFormat = "pdf" | "manifest";

export interface BundleResult {
  ok: boolean;
  bundleId: string;
  /** SHA-256 over the canonical scope (label + sorted ids) — deterministic. */
  seal: string;
  filename: string;
  mime: string;
  content: string;
  count: number;
  generatedAt: string;
}

/**
 * Deterministic scope digest: same label + same message set ⇒ same seal,
 * so a re-export can be compared byte-for-byte against what was handed
 * over (timestamps live outside the sealed scope).
 */
function sealScope(label: string, msgs: ArchivedMsg[]): string {
  const canonical = `${label}\n${[...msgs].sort((a, b) => a.id.localeCompare(b.id)).map(m => m.id).join("\n")}`;
  return sha256Hex(canonical);
}

function manifestJson(label: string, bundleId: string, seal: string, msgs: ArchivedMsg[], generatedAt: string): string {
  return JSON.stringify({
    bundleId,
    kind: "cross-tenant-e-discovery",
    label,
    generatedAt,
    sealAlgorithm: "sha256",
    seal,
    deterministic: "seal covers label + sorted message ids only — re-exporting the same scope reproduces it",
    messageCount: msgs.length,
    tenants: [...new Set(msgs.map(m => m.tenant))].sort(),
    messages: [...msgs].sort((a, b) => a.id.localeCompare(b.id)).map(m => ({
      id: m.id, tenant: m.tenant, channel: m.channel, recipient: m.to,
      campaign: m.campaign, status: m.status, sentAt: m.sentAt, snapshot: m.snapshot,
      consentReceipt: m.consentRef, approvalTrail: m.approvalRef, legalHold: m.legalHold,
    })),
    notice: "Access audit-logged; tenant-side purge is blocked while a message is under legal hold.",
  }, null, 2);
}

function bundlePdf(label: string, bundleId: string, seal: string, msgs: ArchivedMsg[], generatedAt: string): string {
  const lines: string[] = [
    `Bundle ID:   ${bundleId}`,
    `Scope:       ${label}`,
    `Messages:    ${msgs.length}`,
    `Tenants:     ${[...new Set(msgs.map(m => m.tenant))].sort().join(", ")}`,
    `Seal:        sha256:${seal}`,
    `Generated:   ${generatedAt}`,
    "",
    "Contents per message: rendered snapshot reference, consent receipt (N10),",
    "campaign approval trail (N6), delivery status and legal-hold state.",
    "",
  ];
  for (const m of [...msgs].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(
      "────────────────────────────────────────────",
      `${m.id} — ${m.tenant} · ${m.channel}`,
      `recipient:  ${m.to}   status: ${m.status}`,
      `campaign:   ${m.campaign}   sent: ${new Date(m.sentAt).toUTCString()}`,
      `snapshot:   ${m.snapshot}`,
      `consent:    ${m.consentRef}   approval: ${m.approvalRef}`,
      `hold:       ${m.legalHold ? "LEGAL HOLD — tenant purge blocked" : "no hold"}`,
      `body:       ${m.body}`,
      "",
    );
  }
  lines.push("Seal covers label + sorted message ids (deterministic re-export).");
  return buildPdf(`Cross-tenant e-discovery bundle — ${label}`, lines);
}

/**
 * Build a sealed bundle for an explicit message scope. Pure: no audit, no
 * case mutation — callers (selection export / case export) layer that on.
 */
export function buildBundle(scope: { ids: string[]; label: string }, format: BundleFormat): BundleResult {
  const msgs = scope.ids.map(getMessage).filter((m): m is ArchivedMsg => !!m)
    .sort((a, b) => a.id.localeCompare(b.id));
  const generatedAt = new Date().toISOString();
  const bundleId = `bnd-${Date.now().toString(36)}`;
  if (!msgs.length) return { ok: false, bundleId: "", seal: "", filename: "", mime: "", content: "", count: 0, generatedAt };

  const seal = sealScope(scope.label, msgs);
  const stamp = generatedAt.slice(0, 10);
  const slug = scope.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "scope";
  return format === "manifest"
    ? {
        ok: true, bundleId, seal, count: msgs.length, generatedAt,
        filename: `${slug}-${bundleId}.json`, mime: "application/json",
        content: manifestJson(scope.label, bundleId, seal, msgs, generatedAt),
      }
    : {
        ok: true, bundleId, seal, count: msgs.length, generatedAt,
        filename: `${slug}-${stamp}.pdf`, mime: "application/pdf",
        content: bundlePdf(scope.label, bundleId, seal, msgs, generatedAt),
      };
}

/** Header action: export the current search selection as a sealed bundle. */
export function exportSelection(ids: string[], label: string, format: BundleFormat, actor = "operator"): BundleResult {
  const res = buildBundle({ ids, label }, format);
  if (!res.ok) return res;
  recordAudit({
    actor, action: "archive.bundle.export", target: label,
    detail: `Sealed bundle ${res.bundleId} (${res.count} message(s), ${format}) — sha256:${res.seal.slice(0, 16)}…`,
    severity: "info",
  });
  return res;
}

/** Case-folder export: seals the case and stores the seal on the folder. */
export function exportCaseBundle(caseId: string, format: BundleFormat, actor = "operator"): BundleResult {
  const c = getCase(caseId);
  if (!c) return { ok: false, bundleId: "", seal: "", filename: "", mime: "", content: "", count: 0, generatedAt: new Date().toISOString() };
  const res = buildBundle({ ids: c.ids, label: c.name }, format);
  if (!res.ok) return res;
  CASES = CASES.map(x => x.id === caseId
    ? { ...x, sealed: { bundleId: res.bundleId, seal: res.seal, format, at: res.generatedAt, bytes: res.content.length } }
    : x);
  recordAudit({
    actor, action: "archive.case.export", target: c.name,
    detail: `Case bundle ${res.bundleId} (${res.count} message(s), ${format}) sealed sha256:${res.seal.slice(0, 16)}… — deterministic scope "${c.name}"`,
    severity: "info",
  });
  emit();
  return res;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach(l => l());
}

/** Subscribe the calling component to archive-store mutations (cases/seals). */
export function useArchiveStoreVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
