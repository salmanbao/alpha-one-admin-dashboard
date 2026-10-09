"use client";

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Shield, Search, Eye, Clock, AlertTriangle, CheckCircle2, KeyRound, RotateCcw, GitBranch, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ModelAuditEntry {
  id: string;
  model: string;
  action: "deploy" | "rollback" | "config_change" | "cert_rotate" | "inference_audit" | "training_completed" | "fine_tune_cancel" | "quota_exceeded";
  version: string;
  actor: string;
  timestamp: string;
  details: string;
  status: "success" | "warning" | "critical" | "info";
  hash?: string;
}

const initialEntries: ModelAuditEntry[] = [
  { id: "MAE-001", model: "ai-insights-v2", action: "deploy", version: "v2.4.1", actor: "deployment-agent", timestamp: "3h ago", details: "AI Insights model deployed to production with SHAP attribution enabled.", status: "success", hash: "0x9f4a...21c4" },
  { id: "MAE-002", model: "ai-cost-tracker", action: "config_change", version: "v1.2.0", actor: "platform-admin", timestamp: "1d ago", details: "Spend cap set to $500/day. Budget alert threshold adjusted.", status: "warning", hash: "0x7b3c...d91e" },
  { id: "MAE-003", model: "predictive-analytics-v1", action: "training_completed", version: "v1.8.3", actor: "training-job-3", timestamp: "2d ago", details: "Predictive model retrained on 90d cohort data. AUC improved from 0.84 to 0.89.", status: "success", hash: "0x3d8a...f5a2" },
  { id: "MAE-004", model: "fine-tune-job-2025-09", action: "fine_tune_cancel", version: "v0.3.0", actor: "platform-admin", timestamp: "3d ago", details: "Fine-tuning job cancelled by operator. Model did not converge within 5 epochs.", status: "info" },
  { id: "MAE-005", model: "ai-insights-v2", action: "quota_exceeded", version: "v2.4.1", actor: "system", timestamp: "4d ago", details: "Tenant Alpha Capital exceeded monthly inference quota. Rate limit applied.", status: "critical", hash: "0xe2b1...c7d8" },
  { id: "MAE-006", model: "prediction-engine-core", action: "rollback", version: "v3.1.0 → v3.0.9", actor: "platform-admin", timestamp: "5d ago", details: "Rolled back prediction engine after anomaly in cohort prediction accuracy.", status: "warning", hash: "0x5a1c...b3e9" },
  { id: "MAE-007", model: "ai-insights-v2", action: "cert_rotate", version: "v2.4.1", actor: "cron-certificate-rotation", timestamp: "1w ago", details: "Model inference certificate rotated. Fingerprint changed to 0xE9A1.", status: "success", hash: "0xf8c2...a1d4" },
  { id: "MAE-008", model: "risk-model-v3", action: "inference_audit", version: "v3.2.1", actor: "audit-job-daily", timestamp: "1w ago", details: "Daily inference audit: 99.97% prediction consistency across 8 tenant enclaves.", status: "success", hash: "0x2d7b...e4f1" },
];

export function ModelAuditLogPage() {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");

  const models = Array.from(new Set(entries.map((e) => e.model)));
  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.model.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()) || e.details.toLowerCase().includes(search.toLowerCase());
    const matchModel = modelFilter === "all" || e.model === modelFilter;
    return matchSearch && matchModel;
  });

  const critical = entries.filter((e) => e.status === "critical").length;
  const warnings = entries.filter((e) => e.status === "warning").length;
  const successes = entries.filter((e) => e.status === "success").length;

  const statusTone = (s: ModelAuditEntry["status"]) => s === "critical" ? "danger" : s === "warning" ? "warning" : s === "success" ? "success" : "info";

  const columns: Column<ModelAuditEntry>[] = [
    { key: "id", header: "ID", cell: (e) => <Badge variant="outline" className="text-[9px] font-mono">{e.id}</Badge>, sortValue: (e) => e.id },
    { key: "model", header: "Model", cell: (e) => <span className="font-medium">{e.model}</span>, sortValue: (e) => e.model },
    { key: "action", header: "Action", cell: (e) => <Badge variant="outline" className="text-[9px] capitalize">{e.action.replace(/_/g, " ")}</Badge>, sortValue: (e) => e.action },
    { key: "version", header: "Version", cell: (e) => <span className="font-mono text-xs">{e.version}</span>, sortValue: (e) => e.version },
    { key: "status", header: "Status", cell: (e) => <StatusBadge tone={statusTone(e.status)}>{e.status}</StatusBadge>, sortValue: (e) => e.status },
    { key: "details", header: "Details", cell: (e) => <span className="text-xs text-muted-foreground">{e.details}</span> },
    { key: "timestamp", header: "Time", cell: (e) => <span className="text-xs text-muted-foreground">{e.timestamp}</span>, sortValue: (e) => e.timestamp },
    { key: "actor", header: "Actor", cell: (e) => <span className="font-mono text-xs">{e.actor}</span>, sortValue: (e) => e.actor },
  ];

  return (
    <Page>
      <PageHeader
        title="Model Audit Log"
        description="AI model deployment, configuration, training, and inference audit trail with cryptographic proof hashes."
        icon={Shield}
        actions={<Button size="sm" variant="outline"><Eye className="mr-1 h-4 w-4" /> View Certificate</Button>}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Events" value={entries.length} icon={GitBranch} />
          <MetricCard label="Successes" value={successes} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Warnings" value={warnings} icon={AlertTriangle} tone="warning" />
          <MetricCard label="Critical" value={critical} icon={AlertCircle} tone="negative" />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <KeyRound className="h-4 w-4" /> Model Audit: Cryptographic Proof Engine — Synchronized
          </div>
          <p className="mt-1">All model actions are recorded with SHA-256 proof hashes. Certificates rotate on a 30-day cycle.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model, version, action…" className="flex-1" />
            <Select value={modelFilter} onValueChange={(v) => setModelFilter(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All models" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No audit entries found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              pageSize={10}
              searchableText={(e) => `${e.model} ${e.action} ${e.details}`}
              searchPlaceholder="Search audit log…"
              emptyTitle="No entries"
              emptyDescription="Model audit events will appear here."
            />
          )}
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Compliance</span></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Cryptographic proof</span>
              <span className="font-medium">Enabled (SHA-256)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-500" /> Certificate rotation</span>
              <span className="font-medium">30-day cycle</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Audit retention</span>
              <span className="font-medium">90 days (WORM store)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Compliance</span>
              <span className="font-medium">SOC 2 Type II · SEC 17a-4</span>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
