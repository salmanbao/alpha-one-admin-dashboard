"use client";

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
import {
  deleteRiskRule,
  saveRiskRule,
  setRiskRuleEnabled,
  useRiskAlerts,
  useRiskRules,
  type RiskAction,
  type RiskAlert,
  type RiskMetric,
  type RiskOperator,
  type RiskRule,
  type RiskSeverity,
} from "@/lib/risk-rules-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { RuleVersionsPanel } from "@/modules/risk/widgets/rule-versions-panel";

const METRICS: RiskMetric[] = ["daily-loss", "total-drawdown", "consistency", "weekend-hold", "news-trading"];
const SEVERITIES: RiskSeverity[] = ["warn", "soft-breach", "hard-breach"];
const ACTIONS: RiskAction[] = ["notify-trader", "flag-account", "recommend-breach"];
const OPS: RiskOperator[] = [">=", "<=", ">", "<"];

interface RuleForm {
  name: string;
  metric: RiskMetric;
  operator: RiskOperator;
  threshold: string;
  severity: RiskSeverity;
  action: RiskAction;
  enabled: boolean;
}

function toForm(r: RiskRule | null): RuleForm {
  return {
    name: r?.name ?? "",
    metric: r?.metric ?? "daily-loss",
    operator: r?.operator ?? ">=",
    threshold: r ? String(r.threshold) : "80",
    severity: r?.severity ?? "warn",
    action: r?.action ?? "notify-trader",
    enabled: r?.enabled ?? true,
  };
}

export function RiskRuleEnginePage() {
  const { runtime } = usePlatform();
  const rules = useRiskRules();
  const alerts = useRiskAlerts();
  const [editing, setEditing] = useState<RiskRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RuleForm>(() => toForm(null));

  const openCreate = () => {
    setEditing(null);
    setForm(toForm(null));
    setCreating(true);
  };
  const openEdit = (r: RiskRule) => {
    setEditing(r);
    setForm(toForm(r));
    setCreating(true);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = () => {
    const name = form.name.trim();
    const thr = Number(form.threshold);
    if (!name) {
      toast({ title: "Name required", description: "Give the rule a name operators will recognise.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(thr)) {
      toast({ title: "Threshold invalid", description: "Threshold must be a number.", variant: "destructive" });
      return;
    }
    const id = editing?.id ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    saveRiskRule({ id, name, metric: form.metric, operator: form.operator, threshold: thr, severity: form.severity, action: form.action, enabled: form.enabled });
    toast({ title: editing ? "Rule updated" : "Rule created", description: name });
    close();
  };

  const openAlerts = alerts.filter((a) => a.status === "open").length;

  const alertCols: Column<RiskAlert>[] = [
    { key: "at", header: "Raised", cell: (a) => new Date(a.at).toLocaleString() },
    { key: "account", header: "Account", cell: (a) => a.accountLogin ?? a.accountId },
    { key: "rule", header: "Rule", cell: (a) => a.ruleName },
    { key: "metric", header: "Metric", cell: (a) => `${a.metric} ${a.operator} ${a.threshold}` },
    { key: "value", header: "Value", cell: (a) => `${a.value} (${a.pct}%)` },
    { key: "severity", header: "Severity", cell: (a) => <Badge variant={a.severity === "hard-breach" ? "destructive" : a.severity === "soft-breach" ? "secondary" : "outline"}>{a.severity}</Badge> },
    { key: "detail", header: "Detail", cell: (a) => <span className="text-xs">{a.detail}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Risk Rule Engine"
        description="Predefined conditions that trigger alerts and automated actions when breached (R7 I5). (Demo)"
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Rules" value={String(rules.length)} />
          <MetricCard label="Enabled" value={String(rules.filter((r) => r.enabled).length)} />
          <MetricCard label="Open alerts" value={String(openAlerts)} />
          <MetricCard label="Total alerts" value={String(alerts.length)} />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rules</h2>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 h-4 w-4" /> New rule
          </Button>
        </div>
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.metric} {r.operator} {r.threshold} · {r.severity} · {r.action} {r.enabled ? "" : "· disabled"}
                </div>
                {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
              </div>
              <Switch checked={r.enabled} onCheckedChange={(v) => setRiskRuleEnabled(r.id, v)} />
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => { deleteRiskRule(r.id); toast({ title: "Rule deleted" }); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-semibold">Risk-signal queue (alerts)</h2>
        <DataTable<RiskAlert> columns={alertCols} data={alerts} rowKey={(a) => a.id} emptyTitle="No alerts raised yet." />

        {/* R9 W1 A1 — versioned publish + grandfathered accounts (UC-O2). */}
        <RuleVersionsPanel rules={rules} />

        <p className="text-xs text-muted-foreground">
          (Demo) Alerts are raised by the engine on each <code>trade.closed</code> intake. Hard-breach alerts open a RiskCase in the existing breach flow with the rule cited.
        </p>
      </PageContent>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rule" : "New risk rule"}</DialogTitle>
            <DialogDescription>Define a condition that raises an alert and triggers an automated action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Metric</label>
                <select className="w-full rounded border p-2 text-sm" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as RiskMetric })}>
                  {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Operator</label>
                <select className="w-full rounded border p-2 text-sm" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as RiskOperator })}>
                  {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Threshold</label>
                <Input value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Severity</label>
                <select className="w-full rounded border p-2 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as RiskSeverity })}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Action</label>
                <select className="w-full rounded border p-2 text-sm" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as RiskAction })}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <span className="text-sm">Enabled</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
