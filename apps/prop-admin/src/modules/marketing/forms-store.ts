"use client";
/**
 * R2-02 — Form & Lead-Capture Builder store (round-3 depth uplift).
 *
 * The conditional-logic/routing toasts are replaced with a real rules
 * model (`FormRule` objects, evaluated client-side by `evaluateRules`) and
 * submissions that actually write through: a CRM contact (when routing says
 * so) and an immutable consent receipt (when the form captures consent).
 *
 * Service contract:
 *  • listForms/getForm/saveForm/createForm — editor persistence
 *  • addRule/removeRule — the rules builder behind the old "Rules" toast
 *  • evaluateRules — show/hide/require/redirect evaluation for given values
 *                    (drives the live test panel + embed validation)
 *  • submitForm — validation → rules → CRM contact + consent receipt +
 *                 submission record + audit (R3-F05: store-backed, no toast)
 */
import { recordAudit } from "@/lib/audit";
import { crmContacts } from "@/lib/platform/mock-data";
import { addConsent } from "./segments-store";

export interface FormDef {
  id: string; name: string; status: "draft" | "published"; embedTarget: string;
  submissions: number; lastSubmission?: string; conversion: number;
  fields: Array<{ id: string; type: string; label: string; required: boolean; condition?: string }>;
  routing: { createCrm: boolean; segment?: string; webhook?: string; flow?: string; consentCapture: boolean };
  /** R2-02 uplift — real conditional-logic rules (was narrated toasts). */
  rules: FormRule[];
}

export type RuleOp = "equals" | "not_equals" | "contains" | "is_filled" | "is_empty";
export type RuleAction = "show" | "hide" | "require" | "redirect";

export interface FormRule {
  id: string;
  /** Source field the condition watches. */
  fieldId: string;
  op: RuleOp;
  /** Compared value (ignored for is_filled/is_empty). */
  value?: string;
  action: RuleAction;
  /** Target: field id for show/hide/require, URL/path for redirect. */
  target: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  values: Record<string, string>;
  /** Fields hidden by the rules engine at submit time (excluded from required checks). */
  hiddenFields: string[];
  /** Redirect the rules engine selected, if any. */
  redirectTo?: string;
  crmContactId?: string;
  consentReceiptId?: string;
  at: string;
}

const now = () => new Date().toISOString();

let FORMS: FormDef[] = [
  {
    id: "f1", name: "Challenge Interest", status: "published", embedTarget: "Landing: 100K Promo (R2-01)",
    submissions: 842, lastSubmission: now(), conversion: 6.7,
    fields: [
      { id: "f1", type: "email", label: "Email", required: true },
      { id: "f2", type: "name", label: "Full name", required: true },
      { id: "f3", type: "select", label: "Experience level", required: false },
      { id: "f4", type: "consent", label: "Marketing consent", required: true },
    ],
    routing: { createCrm: true, segment: "KYC-verified, not deposited", flow: "Welcome & KYC nudge", consentCapture: true },
    rules: [
      { id: "r1", fieldId: "f3", op: "equals", value: "professional", action: "show", target: "f5" },
      { id: "r2", fieldId: "f4", op: "is_empty", action: "hide", target: "f5" },
    ],
  },
  {
    id: "f2", name: "Deposit Boost Lead", status: "draft", embedTarget: "Popup (R2-03)",
    submissions: 0, conversion: 0,
    fields: [
      { id: "f1", type: "email", label: "Email", required: true },
      { id: "f2", type: "consent", label: "Consent", required: true },
    ],
    routing: { createCrm: true, consentCapture: true },
    rules: [],
  },
];

export function listForms(): FormDef[] { return FORMS; }
export function getForm(id: string): FormDef | undefined { return FORMS.find(f => f.id === id); }
export function saveForm(f: Partial<FormDef> & { id: string }) {
  FORMS = FORMS.map(x => x.id === f.id ? { ...x, ...f } : x);
}
export function createForm(name: string): FormDef {
  const rec: FormDef = {
    id: `f-${Date.now()}`, name, status: "draft", embedTarget: "Direct link",
    submissions: 0, conversion: 0,
    fields: [
      { id: "f1", type: "email", label: "Email", required: true },
      { id: "f2", type: "consent", label: "Marketing consent", required: true },
    ],
    routing: { createCrm: true, consentCapture: true },
    rules: [],
  };
  FORMS = [rec, ...FORMS];
  return rec;
}

/* ------------------------------------------------------------------ */
/* Rules builder (replaces the conditional-logic / routing toasts)     */
/* ------------------------------------------------------------------ */

export function addRule(formId: string, rule: Omit<FormRule, "id">): FormRule | null {
  const form = getForm(formId);
  if (!form) return null;
  const rec: FormRule = { ...rule, id: `r-${Date.now()}` };
  FORMS = FORMS.map(f => f.id === formId ? { ...f, rules: [...f.rules, rec] } : f);
  recordAudit({
    action: "form.rule.add",
    entity: "form",
    entityId: formId,
    summary: `Rule added to ${form.name}: ${rule.action} ${rule.target} when ${rule.fieldId} ${rule.op} ${rule.value ?? ""}`.trim(),
    module: "marketing",
  });
  return rec;
}

export function removeRule(formId: string, ruleId: string): boolean {
  const form = getForm(formId);
  if (!form || !form.rules.some(r => r.id === ruleId)) return false;
  FORMS = FORMS.map(f => f.id === formId ? { ...f, rules: f.rules.filter(r => r.id !== ruleId) } : f);
  recordAudit({
    action: "form.rule.remove",
    entity: "form",
    entityId: formId,
    summary: `Rule ${ruleId} removed from ${form.name}`,
    module: "marketing",
  });
  return true;
}

export interface RuleEvaluation {
  /** Fields hidden by a show/hide rule for the given values. */
  hidden: string[];
  /** Fields force-required by a require rule (beyond their own required flag). */
  required: string[];
  /** Redirect selected by the first matching redirect rule. */
  redirect?: string;
  /** Per-rule trace for the live test panel. */
  fired: Array<{ ruleId: string; matched: boolean; describe: string }>;
}

function fieldValue(values: Record<string, string>, fieldId: string): string {
  return (values[fieldId] ?? "").trim();
}

function conditionMatches(rule: FormRule, values: Record<string, string>): boolean {
  const v = fieldValue(values, rule.fieldId);
  switch (rule.op) {
    case "equals": return v.toLowerCase() === (rule.value ?? "").toLowerCase();
    case "not_equals": return v.toLowerCase() !== (rule.value ?? "").toLowerCase();
    case "contains": return v.toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "is_filled": return v.length > 0;
    case "is_empty": return v.length === 0;
  }
}

/**
 * Evaluate a form's rules against submitted/displayed values. Rules apply
 * in order; the first matching redirect wins. The embed script and the
 * live test panel call the same function (one engine, no drift).
 */
export function evaluateRules(form: FormDef, values: Record<string, string>): RuleEvaluation {
  const hidden = new Set<string>();
  const required = new Set<string>();
  let redirect: string | undefined;
  const fired: RuleEvaluation["fired"] = [];

  for (const rule of form.rules) {
    const matched = conditionMatches(rule, values);
    const describe = `${rule.action} ${rule.target} when ${rule.fieldId} ${rule.op}${rule.value ? ` ${rule.value}` : ""}`;
    fired.push({ ruleId: rule.id, matched, describe });
    if (!matched) continue;
    if (rule.action === "show") { /* show implies not-hidden */ }
    else if (rule.action === "hide") hidden.add(rule.target);
    else if (rule.action === "require") required.add(rule.target);
    else if (rule.action === "redirect" && !redirect) redirect = rule.target;
  }
  return { hidden: [...hidden], required: [...required], redirect, fired };
}

/* ------------------------------------------------------------------ */
/* Submissions → CRM contact + consent receipt (R3-F05)                */
/* ------------------------------------------------------------------ */

export interface SubmitResult {
  ok: boolean;
  errors: string[];
  submission?: FormSubmission;
  /** "Created"/"updated" CRM contact id when routing.createCrm. */
  crmContactId?: string;
  /** Immutable consent receipt id when routing.consentCapture + consent given. */
  consentReceiptId?: string;
}

let SUBMISSIONS: FormSubmission[] = [];

export function listSubmissions(formId: string): FormSubmission[] {
  return SUBMISSIONS.filter(s => s.formId === formId);
}

let crmSeq = 0;

/**
 * Validate → run rules → write through the routing contract. Required
 * fields hidden by a rule are exempt (a conditional field the visitor
 * never saw cannot block them); a redirect rule short-circuits the writes.
 */
export function submitForm(
  formId: string,
  values: Record<string, string>,
  ctx: { tenantId: string; origin: string; actor: string },
): SubmitResult {
  const form = getForm(formId);
  if (!form) return { ok: false, errors: ["Unknown form"] };

  const evaln = evaluateRules(form, values);
  const errors: string[] = [];
  for (const f of form.fields) {
    const isRequired = f.required || evaln.required.includes(f.id);
    if (!isRequired || evaln.hidden.includes(f.id)) continue;
    if (!fieldValue(values, f.id)) errors.push(`${f.label} is required`);
    if (f.type === "email" && fieldValue(values, f.id) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fieldValue(values, f.id))) {
      errors.push(`${f.label} must be a valid email`);
    }
  }
  if (errors.length) return { ok: false, errors };

  // Rules-engine redirect short-circuits the routing writes.
  if (evaln.redirect) {
    return { ok: false, errors: [`Redirected to ${evaln.redirect} by rule engine`], submission: undefined };
  }

  const email = fieldValue(values, form.fields.find(f => f.type === "email")?.id ?? "");
  const name = fieldValue(values, form.fields.find(f => f.type === "name")?.id ?? "");
  const consentField = form.fields.find(f => f.type === "consent");
  const consentGiven = consentField ? fieldValue(values, consentField.id).toLowerCase() in { "true": 1, "yes": 1, "on": 1, "1": 1, "granted": 1 } : false;

  // 1. CRM contact (routing.createCrm) — create/update by email.
  let crmContactId: string | undefined;
  if (form.routing.createCrm && email) {
    crmContactId = upsertCrmContact({
      tenantId: ctx.tenantId,
      name: name || email.split("@")[0],
      email,
      source: `Form: ${form.name}`,
      notes: `Submitted via ${ctx.origin} (form ${form.id}). Segment: ${form.routing.segment ?? "—"} · Flow: ${form.routing.flow ?? "—"}`,
    });
  }

  // 2. Consent receipt (routing.consentCapture) — immutable, timestamped.
  let consentReceiptId: string | undefined;
  if (form.routing.consentCapture && consentField) {
    const rec = addConsent({
      contact: email || name || "unknown",
      channel: "email",
      status: consentGiven ? "granted" : "withdrawn",
      source: "form",
      origin: `${form.name} · ${ctx.origin}`,
      evidence: `ev_${Math.random().toString(36).slice(2, 8)}`,
    });
    consentReceiptId = rec.id;
  }

  const submission: FormSubmission = {
    id: `sub-${Date.now()}`,
    formId,
    values,
    hiddenFields: evaln.hidden,
    crmContactId,
    consentReceiptId,
    at: now(),
  };
  SUBMISSIONS = [submission, ...SUBMISSIONS];
  FORMS = FORMS.map(f =>
    f.id === formId ? { ...f, submissions: f.submissions + 1, lastSubmission: submission.at } : f,
  );
  recordAudit({
    action: "form.submission",
    entity: "form",
    entityId: formId,
    summary: `${form.name}: submission ${submission.id}${crmContactId ? ` → CRM ${crmContactId}` : ""}${consentReceiptId ? ` → consent ${consentReceiptId} (${consentGiven ? "granted" : "withdrawn"})` : ""}`,
    module: "marketing",
  });
  return { ok: true, errors: [], submission, crmContactId, consentReceiptId };
}

/** Create-or-update a CRM contact by email within the tenant (dummy). */
function upsertCrmContact(c: {
  tenantId: string; name: string; email: string; source: string; notes: string;
}): string {
  // mock-data's seed array is mutable — the CRM Contacts table reads the
  // same array via getTenantContacts, so submissions appear there live.
  const id = `crm-f-${++crmSeq}-${Date.now().toString(36)}`;
  const existing = crmContacts.find(x => x.tenantId === c.tenantId && x.email.toLowerCase() === c.email.toLowerCase());
  if (existing) {
    existing.notes = `${c.notes}\n${existing.notes}`.slice(0, 500);
    existing.lastInteraction = now();
    return existing.id;
  }
  crmContacts.push({
    id,
    tenantId: c.tenantId,
    name: c.name,
    email: c.email,
    source: c.source,
    stage: "lead",
    owner: "Inbound",
    value: 0,
    lastInteraction: now(),
    notes: c.notes,
  });
  return id;
}
