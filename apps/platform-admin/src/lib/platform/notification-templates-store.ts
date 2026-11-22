"use client";

/**
 * R13 P1-1 — Notification Templates store.
 *
 * The template editor's Save / Test Send / Duplicate / New Template all
 * fired demo toasts over an inline array, so a template body edited in the
 * UI was never written anywhere — and Save's toast claimed "Audited" while
 * no audit record was written. Each operation now has a persisted write
 * path and a real audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type TemplateChannel = "email" | "push" | "sms" | "in-app" | "discord" | "telegram";
export type TemplateStatus = "active" | "draft" | "disabled";

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  language: string;
  status: TemplateStatus;
  subject: string;
  body: string;
  variables: string[];
  updatedAt: string;
  sentCount: number;
}

const STORAGE_KEY = "pfaas:platform-admin:notification-templates";

const SEED: NotificationTemplate[] = [
  { id: "tpl-001", name: "Welcome Email", channel: "email", language: "en", status: "active", subject: "Welcome to {{tenant_name}}, {{user_name}}!", body: "Hi {{user_name}},\n\nYour account on {{tenant_name}} is ready. Your login: {{login_url}}\n\n- The {{tenant_name}} Team", variables: ["tenant_name", "user_name", "login_url"], updatedAt: "2026-10-05T10:00:00Z", sentCount: 12480 },
  { id: "tpl-002", name: "Welcome Email (ES)", channel: "email", language: "es", status: "active", subject: "Bienvenido a {{tenant_name}}, {{user_name}}", body: "Hola {{user_name}},\n\nTu cuenta en {{tenant_name}} está lista. Tu acceso: {{login_url}}", variables: ["tenant_name", "user_name", "login_url"], updatedAt: "2026-10-05T10:05:00Z", sentCount: 3420 },
  { id: "tpl-003", name: "Password Reset", channel: "email", language: "en", status: "active", subject: "Reset your password", body: "Hi {{user_name}},\n\nReset link (valid 30 min): {{reset_url}}\n\nIf you didn't request this, ignore this email.", variables: ["user_name", "reset_url"], updatedAt: "2026-09-28T14:00:00Z", sentCount: 8750 },
  { id: "tpl-004", name: "Payout Processed", channel: "push", language: "en", status: "active", subject: "", body: "Payout of {{amount}} {{currency}} processed to {{method}}.", variables: ["amount", "currency", "method"], updatedAt: "2026-10-02T09:30:00Z", sentCount: 2140 },
  { id: "tpl-005", name: "Risk Breach Alert", channel: "sms", language: "en", status: "active", subject: "", body: "{{tenant_name}}: risk breach on {{account_id}}. Level {{risk_level}}. Action required.", variables: ["tenant_name", "account_id", "risk_level"], updatedAt: "2026-09-20T16:45:00Z", sentCount: 890 },
  { id: "tpl-006", name: "KYC Approved", channel: "in-app", language: "en", status: "active", subject: "", body: "Your verification ({{kyc_level}}) is approved. You can now trade.", variables: ["kyc_level"], updatedAt: "2026-10-01T11:00:00Z", sentCount: 5610 },
  { id: "tpl-007", name: "Billing Failed (Dunning)", channel: "email", language: "en", status: "draft", subject: "Payment failed — action needed", body: "Hi {{user_name}},\n\nYour payment of {{amount}} failed ({{error_reason}}). Retry: {{retry_url}}", variables: ["user_name", "amount", "error_reason", "retry_url"], updatedAt: "2026-10-07T18:20:00Z", sentCount: 0 },
  { id: "tpl-008", name: "Discord Ops Alert", channel: "discord", language: "en", status: "disabled", subject: "", body: "[{{severity}}] {{service}}: {{message}}", variables: ["severity", "service", "message"], updatedAt: "2026-08-15T08:00:00Z", sentCount: 430 },
];

function load(): NotificationTemplate[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NotificationTemplate[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: NotificationTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let templates: NotificationTemplate[] = load();

export function listTemplates(): NotificationTemplate[] {
  return templates;
}

function commit(next: NotificationTemplate[]) {
  templates = next;
  persist(templates);
  emit();
}

/** Save an edited template body (persists + audits — the old toast claimed "Audited" without writing a record). */
export function saveTemplate(id: string, patch: { body?: string; subject?: string }, actor = "operator"): NotificationTemplate | undefined {
  const target = templates.find((t) => t.id === id);
  if (!target) return undefined;
  const next: NotificationTemplate = {
    ...target,
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
    updatedAt: new Date().toISOString(),
  };
  commit(templates.map((t) => (t.id === id ? next : t)));
  recordAudit({
    actor,
    action: "template.save",
    target: id,
    detail: `Saved "${target.name}" (${target.channel}/${target.language}) — body ${patch.body !== undefined ? "updated" : "unchanged"}`,
    severity: "info",
  });
  return next;
}

/** Dispatch a test message (persists an audit row; no network call in the frontend build). */
export function sendTestTemplate(id: string, actor = "operator"): NotificationTemplate | undefined {
  const target = templates.find((t) => t.id === id);
  if (!target) return undefined;
  recordAudit({
    actor,
    action: "template.test_send",
    target: id,
    detail: `Test ${target.channel} message dispatched for "${target.name}"`,
    severity: "info",
  });
  return target;
}

/** Duplicate a template as a draft (persists + audits). */
export function duplicateTemplate(id: string, actor = "operator"): NotificationTemplate | undefined {
  const source = templates.find((t) => t.id === id);
  if (!source) return undefined;
  const copy: NotificationTemplate = {
    ...source,
    id: `tpl-${Date.now().toString(36)}`,
    name: `${source.name} (copy)`,
    status: "draft",
    sentCount: 0,
    updatedAt: new Date().toISOString(),
  };
  commit([copy, ...templates]);
  recordAudit({
    actor,
    action: "template.duplicate",
    target: copy.id,
    detail: `Duplicated "${source.name}" → "${copy.name}" as draft`,
    severity: "info",
  });
  return copy;
}

/** Create a new template (persists + audits). */
export function createTemplate(
  input: { name: string; channel: TemplateChannel; language?: string; subject?: string; body?: string },
  actor = "operator",
): NotificationTemplate {
  const tpl: NotificationTemplate = {
    id: `tpl-${Date.now().toString(36)}`,
    name: input.name,
    channel: input.channel,
    language: input.language ?? "en",
    status: "draft",
    subject: input.subject ?? "",
    body: input.body ?? "",
    variables: [],
    updatedAt: new Date().toISOString(),
    sentCount: 0,
  };
  commit([tpl, ...templates]);
  recordAudit({
    actor,
    action: "template.create",
    target: tpl.id,
    detail: `Created ${tpl.channel} template "${tpl.name}" (${tpl.language}) as draft`,
    severity: "info",
  });
  return tpl;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to template mutations. */
export function useTemplatesVersion(): number {
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
