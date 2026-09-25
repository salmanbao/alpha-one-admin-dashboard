"use client";

/**
 * Phase Management page (UX Constitution §25-27).
 *
 * Tabular overview of every phase configuration across challenge
 * types. Rows expand inline to reveal full per-phase configuration
 * plus a Save action — avoids forcing users to a separate page for
 * a quick edit (§27 — Drawer vs Page: choose based on task complexity).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getChallengePhaseConfigs,
  getChallengeTypes,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { LabelWithHelp, HELP_TEXTS } from "@/components/platform/contextual-help";
import {
  Layers,
  Plus,
  ChevronDown,
  ChevronRight,
  Save,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Inline expansion panel                                              */
/* ------------------------------------------------------------------ */

function PhaseDetailPanel({ phase, challengeName }: { phase: ChallengePhaseConfig; challengeName: string }) {
  const [draft, setDraft] = useState<ChallengePhaseConfig>(phase);

  const setField = (key: keyof ChallengePhaseConfig, raw: string) => {
    const num = Number(raw);
    setDraft((d) => ({ ...d, [key]: Number.isFinite(num) ? num : 0 }));
  };

  const fields: Array<{ key: keyof ChallengePhaseConfig; label: string; suffix?: string; help: React.ReactNode }> = [
    { key: "accountSize", label: "Account Size", help: "Notional account balance allocated when the phase begins." },
    { key: "profitTargetPct", label: "Profit Target", suffix: "%", help: HELP_TEXTS.profitTarget },
    { key: "maxDrawdownPct", label: "Max Drawdown", suffix: "%", help: HELP_TEXTS.maxDrawdown },
    { key: "dailyDrawdownPct", label: "Daily Drawdown", suffix: "%", help: HELP_TEXTS.dailyLoss },
    { key: "minTradingDays", label: "Min Trading Days", help: "Minimum distinct trading days required before the phase can be passed." },
    { key: "maxDays", label: "Max Days", help: "Maximum calendar days allotted for the phase. Zero means no expiry." },
    { key: "profitSplit", label: "Profit Split", suffix: "%", help: HELP_TEXTS.profitSplit },
  ];

  return (
    <div className="border-t bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{challengeName}</span>
        <span>·</span>
        <span>Phase {phase.phaseOrder}</span>
        <span>·</span>
        <span>{phase.phaseName}</span>
        {phase.isFunded ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] dark:text-emerald-400">
            Funded
          </Badge>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              <LabelWithHelp help={f.help}>{f.label}</LabelWithHelp>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={String(draft[f.key])}
                onChange={(e) => setField(f.key, e.target.value)}
                className="h-8 text-sm tabular-nums"
              />
              {f.suffix ? <span className="text-xs text-muted-foreground">{f.suffix}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Phase saved",
              description: `${challengeName} · ${phase.phaseName} configuration saved. (demo)`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PhaseManagementPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const types = getChallengeTypes();
  const allPhases = getChallengePhaseConfigs();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const typeLookup = useMemo(
    () => Object.fromEntries(types.map((t) => [t.id, t.name])),
    [types],
  );

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? allPhases
        : allPhases.filter((p) => p.challengeTypeId === typeFilter),
    [allPhases, typeFilter],
  );

  const columns: Column<ChallengePhaseConfig>[] = [
    {
      key: "challengeType",
      header: "Challenge Type",
      cell: (p) => (
        <span className="font-medium text-foreground">{typeLookup[p.challengeTypeId] ?? "—"}</span>
      ),
      sortValue: (p) => typeLookup[p.challengeTypeId] ?? "",
    },
    {
      key: "phaseName",
      header: "Phase",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] tabular-nums">{p.phaseOrder}</Badge>
          <span>{p.phaseName}</span>
        </div>
      ),
      sortValue: (p) => `${p.phaseOrder}-${p.phaseName}`,
    },
    {
      key: "accountSize",
      header: "Account Size",
      cell: (p) => formatCurrency(p.accountSize, currency),
      sortValue: (p) => p.accountSize,
      numeric: true,
    },
    {
      key: "profitTargetPct",
      header: "Profit Target",
      cell: (p) => (p.profitTargetPct === 0 ? "—" : `${p.profitTargetPct}%`),
      sortValue: (p) => p.profitTargetPct,
      numeric: true,
    },
    {
      key: "maxDrawdownPct",
      header: "Max DD",
      cell: (p) => `${p.maxDrawdownPct}%`,
      sortValue: (p) => p.maxDrawdownPct,
      numeric: true,
    },
    {
      key: "dailyDrawdownPct",
      header: "Daily DD",
      cell: (p) => `${p.dailyDrawdownPct}%`,
      sortValue: (p) => p.dailyDrawdownPct,
      numeric: true,
    },
    {
      key: "profitSplit",
      header: "Profit Split",
      cell: (p) => (p.profitSplit === 0 ? "—" : `${p.profitSplit}%`),
      sortValue: (p) => p.profitSplit,
      numeric: true,
    },
    {
      key: "funded",
      header: "Funded",
      cell: (p) =>
        p.isFunded ? (
          <StatusBadge tone="success">Funded</StatusBadge>
        ) : (
          <StatusBadge tone="muted">Evaluation</StatusBadge>
        ),
      sortValue: (p) => (p.isFunded ? 1 : 0),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Phase Management"
        description="Configure evaluation phases for challenge types"
        icon={Layers}
        actions={
          <Button
            size="sm"
            onClick={() => toast({ title: "Add phase", description: "Add phase form would open here. (demo)" })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Phase
          </Button>
        }
      />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            All Phase Configurations
            <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(p) => p.id}
            searchableText={(p) => `${typeLookup[p.challengeTypeId] ?? ""} ${p.phaseName}`}
            searchPlaceholder="Search phases…"
            pageSize={10}
            onRowClick={(p) => setExpandedId((id) => (id === p.id ? null : p.id))}
            toolbar={
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger size="sm" className="h-8 w-48 text-xs">
                    <SelectValue placeholder="All challenge types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All challenge types</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
            emptyTitle="No phases"
            emptyDescription="No phase configurations match the current filter."
          />

          {/* Inline expansion below the table for the selected phase */}
          {expandedId ? (
            <div className="mt-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                <ChevronDown className="h-4 w-4" />
                Phase detail
              </div>
              {(() => {
                const p = filtered.find((x) => x.id === expandedId);
                if (!p) return null;
                return (
                  <PhaseDetailPanel
                    key={p.id}
                    phase={p}
                    challengeName={typeLookup[p.challengeTypeId] ?? "—"}
                  />
                );
              })()}
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              Click any row to edit that phase configuration inline.
            </p>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
