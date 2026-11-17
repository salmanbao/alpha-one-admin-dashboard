"use client";

/**
 * R7 I4 — Payout Automation Rules (P3/P6).
 *
 * The operator-facing half of the payout rules engine
 * (`modules/payouts/payout-rules-store.ts`):
 *
 *   • CRUD for priority-ordered rules (conditions → action) with
 *     enable/disable toggles — every mutation persists to
 *     `pfaas:demo:payout-rules` (R10) and is `recordAudit`ed (§5 rule 2).
 *   • Evaluator run log — the last 20 decisions the engine made
 *     (request, rule matched, outcome), so automation is observable
 *     instead of a claim.
 *   • Pending-queue preview — what the engine *would* decide for each
 *     pending row right now (incl. disabled rules, labeled as such).
 *
 * Reachable from Pending Payouts → "Manage rules" (route `payout-rules`,
 * registered in view-router + the payouts manifest for R9).
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantPayouts, type Payout } from "@/lib/platform/mock-data";
import { effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import {
  buildPayoutRuleContext,
  deletePayoutRule,
  describeConditions,
  firstMatchingRule,
  savePayoutRule,
  setPayoutRuleEnabled,
  usePayoutRules,
  type PayoutRule,
  type PayoutRuleAction,
  type PayoutRuleRun,
} from "@/modules/payouts/payout-rules-store";
import { formatCurrency } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Plus, Zap } from "lucide-react";

const ACTION_TONE: Record<PayoutRuleAction | "manual", string> = {
  "auto-approve": "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "auto-reject": "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  escalate: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  manual: "border-muted-foreground/40 bg-muted/40 text-muted-foreground",
};

/* ------------------------------------------------------------------ */
/* Rule editor                                                         */
/* ------------------------------------------------------------------ */

interface RuleForm {
  name: string;
  priority: string;
  action: PayoutRuleAction;
  splitPct: string;
  enabled: boolean;
  minAccountAgeDays: string;
  minTradingDays: string;
  maxDrawdownUsagePct: string;
  amountBelowUsd: string;
  consistencyOk: boolean;
  amlCleared: boolean;
}

function toForm(rule: PayoutRule | null, nextPriority: number): RuleForm {
  const c = rule?.conditions;
  const num = (v: number | undefined) => (v === undefined ? "" : String(v));
  return {
    name: rule?.name ?? "",
    priority: String(rule?.priority ?? nextPriority),
    action: rule?.action ?? "auto-approve",
    splitPct: num(rule?.splitPct) || "80",
    enabled: rule?.enabled ?? true,
    minAccountAgeDays: num(c?.minAccountAgeDays),
    minTradingDays: num(c?.minTradingDays),
    maxDrawdownUsagePct: num(c?.maxDrawdownUsagePct),
    amountBelowUsd: num(c?.amountBelowUsd),
    consistencyOk: c?.consistencyOk ?? false,
    amlCleared: c?.amlCleared ?? true,
  };
}

function optionalNumber(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

function RuleEditor({
  rule,
  nextPriority,
  onClose,
}: {
  rule: PayoutRule | null;
  nextPriority: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RuleForm>(() => toForm(rule, nextPriority));
  const patch = (p: Partial<RuleForm>) => setForm((f) => ({ ...f, ...p }));

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Rule name required", description: "Give the rule a name operators will recognise.", variant: "destructive" });
      return;
    }
    const priority = Math.max(1, Math.round(Number(form.priority) || nextPriority));
    const splitPct = optionalNumber(form.splitPct);
    savePayoutRule({
      id: rule?.id,
      name,
      priority,
      enabled: form.enabled,
      action: form.action,
      ...(splitPct !== undefined ? { splitPct } : {}),
      conditions: {
        ...(optionalNumber(form.minAccountAgeDays) !== undefined
          ? { minAccountAgeDays: optionalNumber(form.minAccountAgeDays) }
          : {}),
        ...(optionalNumber(form.minTradingDays) !== undefined
          ? { minTradingDays: optionalNumber(form.minTradingDays) }
          : {}),
        ...(optionalNumber(form.maxDrawdownUsagePct) !== undefined
          ? { maxDrawdownUsagePct: optionalNumber(form.maxDrawdownUsagePct) }
          : {}),
        ...(optionalNumber(form.amountBelowUsd) !== undefined
          ? { amountBelowUsd: optionalNumber(form.amountBelowUsd) }
          : {}),
        ...(form.consistencyOk ? { consistencyOk: true as const } : {}),
        ...(form.amlCleared ? { amlCleared: true as const } : {}),
      },
    });
    toast({
      title: rule ? "Rule updated" : "Rule created",
      description: `${name} — ${form.action} (Demo). Persisted and audit-logged.`,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit rule — ${rule.name}` : "New payout rule"}</DialogTitle>
          <DialogDescription>
            First matching enabled rule (lowest priority number) decides incoming payout
            requests. Empty conditions match every request. (Demo)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="rule-name" className="text-xs font-medium">Name</label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Small payout fast-track"
              className="h-8"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label htmlFor="rule-priority" className="text-xs font-medium">Priority</label>
              <Input
                id="rule-priority"
                type="number"
                min={1}
                value={form.priority}
                onChange={(e) => patch({ priority: e.target.value })}
                className="h-8 w-20"
              />
              <p className="text-[11px] text-muted-foreground">1 = evaluated first</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="rule-action" className="text-xs font-medium">Action</label>
              <select
                id="rule-action"
                value={form.action}
                onChange={(e) => patch({ action: e.target.value as PayoutRuleAction })}
                className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="auto-approve">Auto-approve</option>
                <option value="auto-reject">Auto-reject</option>
                <option value="escalate">Escalate (second signature)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="rule-split" className="text-xs font-medium">Split %</label>
              <Input
                id="rule-split"
                type="number"
                min={0}
                max={100}
                value={form.splitPct}
                onChange={(e) => patch({ splitPct: e.target.value })}
                className="h-8 w-20"
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Conditions</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-xs">
                Amount &lt; $
                <Input
                  type="number"
                  min={0}
                  value={form.amountBelowUsd}
                  onChange={(e) => patch({ amountBelowUsd: e.target.value })}
                  placeholder="any"
                  className="h-7 w-24"
                  aria-label="Amount below USD"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                Account age ≥
                <Input
                  type="number"
                  min={0}
                  value={form.minAccountAgeDays}
                  onChange={(e) => patch({ minAccountAgeDays: e.target.value })}
                  placeholder="any"
                  className="h-7 w-20"
                  aria-label="Minimum account age in days"
                />
                d
              </label>
              <label className="flex items-center gap-2 text-xs">
                Trading days ≥
                <Input
                  type="number"
                  min={0}
                  value={form.minTradingDays}
                  onChange={(e) => patch({ minTradingDays: e.target.value })}
                  placeholder="any"
                  className="h-7 w-20"
                  aria-label="Minimum trading days"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                Drawdown usage ≤
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.maxDrawdownUsagePct}
                  onChange={(e) => patch({ maxDrawdownUsagePct: e.target.value })}
                  placeholder="any"
                  className="h-7 w-20"
                  aria-label="Maximum drawdown usage percent"
                />%
              </label>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={form.consistencyOk}
                  onCheckedChange={(v) => patch({ consistencyOk: v })}
                  aria-label="Require consistency score at least 50"
                />
                Consistency ≥ 50
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={form.amlCleared}
                  onCheckedChange={(v) => patch({ amlCleared: v })}
                  aria-label="Require no AML hold"
                />
                AML clear
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => patch({ enabled: v })}
                  aria-label="Rule enabled"
                />
                Enabled
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}>{rule ? "Save rule" : "Create rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PayoutRulesPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  usePayoutVersion(); // preview rows react to decisions
  const { rules, runs, stamps } = usePayoutRules();

  const [editing, setEditing] = useState<{ rule: PayoutRule | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const enabledCount = rules.filter((r) => r.enabled).length;
  const autoDecided = Object.values(stamps).filter((s) => s.automated).length;
  const nextPriority = rules.reduce((m, r) => Math.max(m, r.priority), 0) + 1;

  /* Pending-queue preview — what the engine would decide right now. */
  const preview = useMemo(() => {
    const pending = getTenantPayouts(tid)
      .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
      .filter((p) => p.status === "pending");
    return pending.map((p: Payout) => {
      const ctx = buildPayoutRuleContext(tid, p);
      const enabled = firstMatchingRule(rules, ctx);
      const any = firstMatchingRule(rules, ctx, { enabledOnly: false });
      return { p, enabled, any, aml: ctx.amlCleared };
    });
  }, [rules, tid]);

  const runColumns: Column<PayoutRuleRun>[] = [
    { key: "at", header: "Time", cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString("en-US")}</span>, sortValue: (r) => r.at },
    { key: "request", header: "Request", cell: (r) => <span className="text-xs font-mono">{r.reference}</span> },
    { key: "trader", header: "Trader", cell: (r) => <span className="text-xs">{r.traderName}</span> },
    { key: "amount", header: "Amount", cell: (r) => <span className="text-xs">{formatCurrency(r.amount, r.currency)}</span>, sortValue: (r) => r.amount },
    {
      key: "rule",
      header: "Rule matched",
      cell: (r) =>
        r.ruleName ? (
          <span className="text-xs">{r.ruleName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "outcome",
      header: "Outcome",
      cell: (r) => <Badge variant="outline" className={`text-[10px] ${ACTION_TONE[r.action]}`}>{r.action}</Badge>,
    },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-xs text-muted-foreground">{r.reason}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Payout Automation Rules"
        description="Priority-ordered rules that decide incoming payout requests automatically."
        icon={Zap}
      />
      <PageContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => navigate("payouts-pending")}>
            <ArrowLeft className="mr-1 h-3 w-3" /> Back to queue
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setEditing({ rule: null })}>
            <Plus className="mr-1 h-3 w-3" /> New rule
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Enabled rules" value={`${enabledCount} of ${rules.length}`} icon={Zap} />
          <MetricCard label="Auto-decisions (session)" value={autoDecided} icon={Zap} tone="positive" />
          <MetricCard label="Evaluator runs logged" value={`${runs.length} / 20`} icon={Zap} />
        </div>

        {/* ── Rules ─────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Rules — first matching enabled rule by priority decides
          </p>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules — every incoming payout request falls to the manual queue.
            </p>
          ) : (
            [...rules]
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <div key={rule.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">P{rule.priority}</Badge>
                      <span className="truncate text-sm font-medium">{rule.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${ACTION_TONE[rule.action]}`}>
                        {rule.action}
                      </Badge>
                      {rule.splitPct !== undefined && (
                        <span className="text-[11px] text-muted-foreground">{rule.splitPct}% split</span>
                      )}
                      {!rule.enabled && (
                        <Badge variant="secondary" className="text-[10px]">disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => setPayoutRuleEnabled(rule.id, v)}
                        aria-label={`Enable rule ${rule.name}`}
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing({ rule })}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      {confirmDelete === rule.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => {
                              deletePayoutRule(rule.id);
                              setConfirmDelete(null);
                              toast({ title: "Rule deleted", description: `${rule.name} no longer evaluates requests (Demo).` });
                            }}
                          >
                            Confirm delete
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(rule.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describeConditions(rule.conditions).join(" · ") || "Matches every request"}
                    {" → "}
                    {rule.action}
                  </p>
                </div>
              ))
          )}
        </div>

        {/* ── Pending-queue preview ─────────────────────────────────── */}
        <div className="mb-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Preview — what the engine would decide for the pending queue
          </p>
          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending payouts to evaluate.</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {preview.map(({ p, enabled, any, aml }) => (
                <div
                  key={p.reference}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-xs ${
                    enabled?.action === "auto-approve"
                      ? "border-emerald-500/40 bg-emerald-50/40"
                      : "border-muted bg-muted/20"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.traderName}</span>{" "}
                    <span className="text-muted-foreground">
                      · {p.reference} · {formatCurrency(p.amount, p.currency)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={
                        enabled?.action === "auto-approve"
                          ? "font-bold text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {enabled ? enabled.action.toUpperCase() : "MANUAL"}
                    </span>
                    <span className="text-muted-foreground">
                      {!aml
                        ? "AML hold"
                        : enabled
                          ? `"${enabled.name}"`
                          : any
                            ? `no enabled match — disabled rule "${any.name}" would ${any.action}`
                            : "no rule matches"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Evaluator runs ────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Evaluator runs — last {Math.min(runs.length, 20)}
          </p>
          <DataTable
            columns={runColumns}
            data={runs}
            rowKey={(r) => r.id}
            searchableText={(r) => `${r.reference} ${r.traderName} ${r.ruleName ?? ""} ${r.action} ${r.reason}`}
            searchPlaceholder="Search runs…"
            emptyTitle="No evaluator runs yet"
            emptyDescription="Runs appear here when an incoming payout request is evaluated against the rules."
          />
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          (Demo) — rules evaluate simulated payout requests against fixture data in this
          browser. Rule changes, stamps and runs persist locally and are cleared by
          Reset demo session.
        </p>

        {editing ? (
          <RuleEditor
            rule={editing.rule}
            nextPriority={nextPriority}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </PageContent>
    </Page>
  );
}
