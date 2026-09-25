"use client";

/**
 * Phase Detail page (UX Constitution §12-13, §25-27, §28 audit trail).
 *
 * 3-tab editor for a single phase configuration:
 *   1. General               — phase metadata + risk rules; Save / Reset
 *   2. Trading Platform IDs  — broker group mappings (MT5 / MT4 / DXTrade);
 *                              bridge status; sync action; per-phase summary
 *   3. Change History        — per-object audit trail DataTable with strikethrough
 *                              old values (red) and new values (green), search,
 *                              filter by field, CSV export
 *
 * Pre-fills from `getChallengePhaseConfigs()` using `router.params.id` as an
 * index (the demo convention — IDs are unstable mock strings, indices are
 * stable for navigation). Falls back to actual mock id or index 0.
 *
 * Terra palette — forest green primary, warm cream surface, emerald/amber/
 * rose accents. No blue/indigo.
 */

import { useEffect, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import {
  getChallengePhaseConfigs,
  getChallengeTypes,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Settings2,
  Save,
  ChevronLeft,
  RotateCcw,
  GitBranch,
  Plug,
  RefreshCw,
  History,
  Download,
  Search,
  ArrowLeft,
  Server,
  Clock,
  ShieldCheck,
  Radio,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PhaseDraft {
  title: string;
  step: number;
  leverage: string;
  isLive: boolean;
  scalingPlan: boolean;
  profitTargetPct: number;
  dailyDrawdownPct: number;
  maxDrawdownPct: number;
  minTradingDays: number;
  maxDays: number;
  tradingDayThreshold: number;
  autoPass: boolean;
}

interface PlatformIdsDraft {
  mt5Group: string;
  mt4Group: string;
  dxTradeGroup: string;
}

interface PhaseChangeEntry {
  id: string;
  timestamp: string;
  user: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* ID resolution — use index as mock ID, fallback to actual id         */
/* ------------------------------------------------------------------ */

function resolvePhase(id: string | undefined): {
  phase: ChallengePhaseConfig;
  index: number;
} {
  const all = getChallengePhaseConfigs();
  if (!id) return { phase: all[0], index: 0 };
  const numeric = Number(id);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < all.length) {
    return { phase: all[numeric], index: numeric };
  }
  const byId = all.findIndex((p) => p.id === id);
  if (byId >= 0) return { phase: all[byId], index: byId };
  return { phase: all[0], index: 0 };
}

/* ------------------------------------------------------------------ */
/* Deterministic per-phase mock generators                             */
/* ------------------------------------------------------------------ */

const ACTORS = [
  "Sarah Chen",
  "Marcus Webb",
  "Priya Nair",
  "System",
  "AI Engine",
] as const;

const REASONS = [
  "Policy update",
  "Configuration change",
  "Manual adjustment",
  "Risk committee decision",
  "Quarterly review",
] as const;

const FIELD_TEMPLATES: Array<{
  field: string;
  oldV: string;
  newV: string;
}> = [
  { field: "Profit Target", oldV: "8%", newV: "10%" },
  { field: "Maximum Drawdown", oldV: "10%", newV: "8%" },
  { field: "Daily Drawdown", oldV: "5%", newV: "4%" },
  { field: "Min Trading Days", oldV: "0", newV: "3" },
  { field: "Max Days", oldV: "30", newV: "45" },
  { field: "Leverage", oldV: "1:30", newV: "1:100" },
  { field: "Profit Split", oldV: "75%", newV: "80%" },
  { field: "MT5 Group", oldV: "funderblu\\phase1", newV: "funderblu\\phase1-v2" },
  { field: "Auto Pass", oldV: "Disabled", newV: "Enabled" },
  { field: "Trading-day Threshold", oldV: "0 lots", newV: "0.5 lots" },
];

function generateChangeHistory(phaseId: string, index: number): PhaseChangeEntry[] {
  // Deterministic per phase — use index as seed, no Math.random
  const count = 8 + (index % 3); // 8, 9, or 10 entries
  const out: PhaseChangeEntry[] = [];
  const baseTs = new Date("2026-01-15T10:30:00.000Z").getTime();
  for (let i = 0; i < count; i++) {
    // Per-phase offset to keep entries distinct across phases
    const t = new Date(baseTs - i * 36 * 3600 * 1000 - index * 3600 * 1000);
    const tpl = FIELD_TEMPLATES[(i + index) % FIELD_TEMPLATES.length];
    out.push({
      id: `${phaseId}-ch-${i}`,
      timestamp: t.toISOString(),
      user: ACTORS[(i + index) % ACTORS.length],
      field: tpl.field,
      oldValue: tpl.oldV,
      newValue: tpl.newV,
      reason: REASONS[(i + index) % REASONS.length],
    });
  }
  return out;
}

function generatePlatformIds(phase: ChallengePhaseConfig, index: number) {
  // Deterministic mock per phase index
  const slug =
    phase.phaseName.toLowerCase().replace(/\s+/g, "") ?? `phase${index}`;
  return {
    mt5Group: `funderblu\\${slug}`,
    mt4Group: index % 2 === 0 ? "" : `funderblu\\${slug}-mt4`,
    dxTradeGroup: index % 3 === 0 ? `dx\\${slug}` : "",
    bridgeStatus: (index % 4 === 0 ? "disconnected" : "connected") as
      | "connected"
      | "disconnected",
    lastSync: new Date(Date.now() - (index + 1) * 1800 * 1000).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Section card primitive                                              */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="mb-4 flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {help ? <LabelWithHelp help={help}>{label}</LabelWithHelp> : label}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 1 — General                                                     */
/* ------------------------------------------------------------------ */

function GeneralTab({
  phase,
  draft,
  setDraft,
  challengeName,
}: {
  phase: ChallengePhaseConfig;
  draft: PhaseDraft;
  setDraft: (next: PhaseDraft) => void;
  challengeName: string;
}) {
  const setField = <K extends keyof PhaseDraft>(
    key: K,
    value: PhaseDraft[K],
  ) => setDraft({ ...draft, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Phase Metadata"
        description={`Part of ${challengeName}. ${phase.isFunded ? "This is the funded phase — profit target is informational." : "Evaluation phase — risk rules apply throughout."}`}
        icon={GitBranch}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Title" htmlFor="pd-title">
            <Input
              id="pd-title"
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Phase 1"
            />
          </FieldRow>
          <FieldRow
            label="Step Number"
            htmlFor="pd-step"
            help="The order of this phase in the challenge flow. Step 1 is the entry phase; the highest step is the funded phase."
          >
            <Input
              id="pd-step"
              type="number"
              min={1}
              value={String(draft.step)}
              onChange={(e) => setField("step", Number(e.target.value) || 0)}
              className="tabular-nums"
            />
          </FieldRow>
          <FieldRow
            label="Leverage"
            htmlFor="pd-leverage"
            help="Maximum leverage offered to traders on this phase. Format is broker notation, e.g. 1:100 means 100× the account balance."
          >
            <Input
              id="pd-leverage"
              value={draft.leverage}
              onChange={(e) => setField("leverage", e.target.value)}
              placeholder="e.g. 1:100"
              className="tabular-nums"
            />
          </FieldRow>
          <div className="grid gap-3 md:grid-cols-1">
            <ToggleRow
              label="Live Status"
              description="Mark this phase as a live / funded account phase. Live phases don't have a profit target."
              checked={draft.isLive}
              onChange={(v) => setField("isLive", v)}
            />
            <ToggleRow
              label="Scaling Plan"
              description="Enable account-size scaling on this phase (size grows as the trader meets performance milestones)."
              checked={draft.scalingPlan}
              onChange={(v) => setField("scalingPlan", v)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Risk Rules"
        description="Limits applied to every trader account in this phase."
        icon={ShieldCheck}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FieldRow
            label="Target Profit"
            htmlFor="pd-profit"
            help="Profit percentage required to pass this phase. Set to 0 for funded phases."
          >
            <div className="flex items-center gap-1">
              <Input
                id="pd-profit"
                type="number"
                min={0}
                max={100}
                value={String(draft.profitTargetPct)}
                onChange={(e) =>
                  setField("profitTargetPct", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Daily Drawdown"
            htmlFor="pd-daily-dd"
            help="Maximum loss permitted in a single trading day, measured from the day's opening equity. Resets at 00:00 server time."
          >
            <div className="flex items-center gap-1">
              <Input
                id="pd-daily-dd"
                type="number"
                min={0}
                max={100}
                value={String(draft.dailyDrawdownPct)}
                onChange={(e) =>
                  setField("dailyDrawdownPct", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Maximum Drawdown"
            htmlFor="pd-max-dd"
            help="Maximum cumulative loss from the highest equity peak. Does not reset. Exceeding this breaches the phase."
          >
            <div className="flex items-center gap-1">
              <Input
                id="pd-max-dd"
                type="number"
                min={0}
                max={100}
                value={String(draft.maxDrawdownPct)}
                onChange={(e) =>
                  setField("maxDrawdownPct", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Minimum Trading Days"
            htmlFor="pd-min-days"
            help="Distinct trading days required before the phase can be marked as passed. Traders cannot pass early."
          >
            <Input
              id="pd-min-days"
              type="number"
              min={0}
              value={String(draft.minTradingDays)}
              onChange={(e) =>
                setField("minTradingDays", Number(e.target.value) || 0)
              }
              className="tabular-nums"
            />
          </FieldRow>
          <FieldRow
            label="Maximum Days / Time Limit"
            htmlFor="pd-max-days"
            help="Calendar days allotted for this phase. 0 means no expiry. Exceeding the limit auto-fails the phase."
          >
            <Input
              id="pd-max-days"
              type="number"
              min={0}
              value={String(draft.maxDays)}
              onChange={(e) =>
                setField("maxDays", Number(e.target.value) || 0)
              }
              className="tabular-nums"
            />
          </FieldRow>
          <FieldRow
            label="Trading-day Threshold"
            htmlFor="pd-threshold"
            help="Minimum trading volume (in lots) per trading day for the day to count toward the minimum trading days requirement."
          >
            <div className="flex items-center gap-1">
              <Input
                id="pd-threshold"
                type="number"
                min={0}
                step="0.01"
                value={String(draft.tradingDayThreshold)}
                onChange={(e) =>
                  setField("tradingDayThreshold", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">lots</span>
            </div>
          </FieldRow>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">Auto Pass</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Automatically advance the trader to the next phase as soon as the
              profit target and minimum trading days are both met.
            </p>
          </div>
          <Checkbox
            checked={draft.autoPass}
            onCheckedChange={(v) => setField("autoPass", v === true)}
            aria-label="Auto pass"
          />
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft({
              title: phase.phaseName,
              step: phase.phaseOrder,
              leverage: "1:100",
              isLive: phase.isFunded,
              scalingPlan: false,
              profitTargetPct: phase.profitTargetPct,
              dailyDrawdownPct: phase.dailyDrawdownPct,
              maxDrawdownPct: phase.maxDrawdownPct,
              minTradingDays: phase.minTradingDays,
              maxDays: phase.maxDays,
              tradingDayThreshold: 0,
              autoPass: false,
            });
            toast({
              title: "Reverted",
              description: "Phase form reverted to default values.",
            });
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to Defaults
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Phase configuration saved",
              description: `${draft.title || phase.phaseName} for ${challengeName} has been saved. (demo)`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save Changes
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 2 — Trading Platform IDs                                        */
/* ------------------------------------------------------------------ */

function PlatformIdsTab({
  phase,
  index,
  challengeName,
}: {
  phase: ChallengePhaseConfig;
  index: number;
  challengeName: string;
}) {
  const mock = useMemo(() => generatePlatformIds(phase, index), [phase, index]);
  const [draft, setDraft] = useState<PlatformIdsDraft>({
    mt5Group: mock.mt5Group,
    mt4Group: mock.mt4Group,
    dxTradeGroup: mock.dxTradeGroup,
  });

  // Re-seed if the underlying phase changes
  const [lastPhaseId, setLastPhaseId] = useState<string>(phase.id);
  if (phase.id !== lastPhaseId) {
    setLastPhaseId(phase.id);
    setDraft({
      mt5Group: mock.mt5Group,
      mt4Group: mock.mt4Group,
      dxTradeGroup: mock.dxTradeGroup,
    });
  }

  const setField = <K extends keyof PlatformIdsDraft>(
    key: K,
    value: PlatformIdsDraft[K],
  ) => setDraft({ ...draft, [key]: value });

  // All phases summary table for comparison
  const allPhases = getChallengePhaseConfigs();
  const types = getChallengeTypes();
  const typeLookup = useMemo(
    () => Object.fromEntries(types.map((t) => [t.id, t.name])),
    [types],
  );

  const summaryColumns: Column<ChallengePhaseConfig>[] = [
    {
      key: "challenge",
      header: "Challenge",
      cell: (p) => typeLookup[p.challengeTypeId] ?? "—",
      sortValue: (p) => typeLookup[p.challengeTypeId] ?? "",
    },
    {
      key: "phase",
      header: "Phase",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {p.phaseOrder}
          </Badge>
          <span>{p.phaseName}</span>
        </div>
      ),
      sortValue: (p) => p.phaseOrder,
    },
    {
      key: "mt5",
      header: "MT5 Group",
      cell: (p) => {
        const m = generatePlatformIds(p, allPhases.indexOf(p));
        return (
          <span className="font-mono text-xs">{m.mt5Group || "—"}</span>
        );
      },
    },
    {
      key: "mt4",
      header: "MT4 Group",
      cell: (p) => {
        const m = generatePlatformIds(p, allPhases.indexOf(p));
        return m.mt4Group ? (
          <span className="font-mono text-xs">{m.mt4Group}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "dx",
      header: "DXTrade",
      cell: (p) => {
        const m = generatePlatformIds(p, allPhases.indexOf(p));
        return m.dxTradeGroup ? (
          <span className="font-mono text-xs">{m.dxTradeGroup}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Bridge",
      cell: (p) => {
        const m = generatePlatformIds(p, allPhases.indexOf(p));
        return m.bridgeStatus === "connected" ? (
          <StatusBadge tone="success">Connected</StatusBadge>
        ) : (
          <StatusBadge tone="muted">Disconnected</StatusBadge>
        );
      },
      sortValue: (p) =>
        generatePlatformIds(p, allPhases.indexOf(p)).bridgeStatus === "connected"
          ? 1
          : 0,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
        <Server className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Configure the mapping between this phase and your broker&apos;s
          trading platform groups. When a trader enters this phase, the system
          will create a trading account in the specified group.
        </p>
      </div>

      <SectionCard
        title="Platform Group Mapping"
        description={`Broker group IDs for ${phase.phaseName} (Step ${phase.phaseOrder} of ${challengeName}).`}
        icon={Plug}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow
            label="MT5 Group ID"
            htmlFor="pd-mt5"
            help="MetaTrader 5 server group. Format is broker-specific, e.g. funderblu\\phase1. Required — every phase must have an MT5 group."
          >
            <Input
              id="pd-mt5"
              value={draft.mt5Group}
              onChange={(e) => setField("mt5Group", e.target.value)}
              placeholder="e.g. funderblu\\phase1"
              className="font-mono text-sm"
            />
          </FieldRow>
          <FieldRow
            label="MT4 Group ID (Optional)"
            htmlFor="pd-mt4"
            help="Legacy MetaTrader 4 server group. Leave blank if your broker no longer offers MT4 accounts."
          >
            <Input
              id="pd-mt4"
              value={draft.mt4Group}
              onChange={(e) => setField("mt4Group", e.target.value)}
              placeholder="Legacy platform — optional"
              className="font-mono text-sm"
            />
          </FieldRow>
          <FieldRow
            label="DXTrade Group ID (Optional)"
            htmlFor="pd-dx"
            help="DXTrade server group for brokers that offer the DXTrade platform alongside MT5/MT4."
          >
            <Input
              id="pd-dx"
              value={draft.dxTradeGroup}
              onChange={(e) => setField("dxTradeGroup", e.target.value)}
              placeholder="Optional — DXTrade brokers only"
              className="font-mono text-sm"
            />
          </FieldRow>
          <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Radio className="h-3.5 w-3.5" />
                Bridge Status
              </span>
              {mock.bridgeStatus === "connected" ? (
                <StatusBadge tone="success">Connected</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Disconnected</StatusBadge>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Last sync
              </span>
              <span className="font-mono text-foreground">
                {new Date(mock.lastSync).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast({
              title: "Syncing with broker platform",
              description: "Bridge sync initiated — this may take up to 30 seconds. (demo)",
            })
          }
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Sync Now
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Platform IDs saved",
              description: `MT5 group ${draft.mt5Group || "(none)"} mapped to ${phase.phaseName}. (demo)`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save Platform IDs
        </Button>
      </div>

      <SectionCard
        title="Phases Summary"
        description="Compare group IDs across all phases for consistency."
        icon={GitBranch}
      >
        <DataTable
          columns={summaryColumns}
          data={allPhases}
          rowKey={(p) => p.id}
          pageSize={6}
          searchPlaceholder="Search phases…"
          searchableText={(p) =>
            `${typeLookup[p.challengeTypeId] ?? ""} ${p.phaseName} ${
              generatePlatformIds(p, allPhases.indexOf(p)).mt5Group
            }`
          }
          emptyTitle="No phases"
          emptyDescription="No phases have been configured yet."
        />
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 3 — Change History                                              */
/* ------------------------------------------------------------------ */

function ChangeHistoryTab({
  phase,
  index,
  navigate,
}: {
  phase: ChallengePhaseConfig;
  index: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}) {
  const history = useMemo(
    () => generateChangeHistory(phase.id, index),
    [phase.id, index],
  );

  // Local filter state
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  const fieldOptions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => set.add(h.field));
    return Array.from(set).sort();
  }, [history]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((h) => {
      if (fieldFilter !== "all" && h.field !== fieldFilter) return false;
      if (!q) return true;
      return (
        h.user.toLowerCase().includes(q) ||
        h.field.toLowerCase().includes(q) ||
        h.oldValue.toLowerCase().includes(q) ||
        h.newValue.toLowerCase().includes(q) ||
        h.reason.toLowerCase().includes(q)
      );
    });
  }, [history, search, fieldFilter]);

  const exportCsv = () => {
    const header = ["Date/Time", "User", "Field Changed", "Old Value", "New Value", "Reason"];
    const rows = filtered.map((h) => [
      new Date(h.timestamp).toISOString(),
      h.user,
      h.field,
      h.oldValue,
      h.newValue,
      h.reason,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${phase.id}-change-history.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "CSV exported",
      description: `${filtered.length} change record${filtered.length === 1 ? "" : "s"} exported.`,
    });
  };

  const columns: Column<PhaseChangeEntry>[] = [
    {
      key: "timestamp",
      header: "Date / Time",
      cell: (h) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(h.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (h) => h.timestamp,
    },
    {
      key: "user",
      header: "User",
      cell: (h) => (
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{h.user}</span>
          {h.user === "System" || h.user === "AI Engine" ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Automated
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (h) => h.user,
    },
    {
      key: "field",
      header: "Field Changed",
      cell: (h) => <span className="font-medium text-foreground">{h.field}</span>,
      sortValue: (h) => h.field,
    },
    {
      key: "oldValue",
      header: "Old Value",
      cell: (h) => (
        <span className="text-rose-700 line-through dark:text-rose-400">
          {h.oldValue}
        </span>
      ),
    },
    {
      key: "newValue",
      header: "New Value",
      cell: (h) => (
        <span className="font-medium text-emerald-700 dark:text-emerald-400">
          {h.newValue}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (h) => <span className="text-xs text-muted-foreground">{h.reason}</span>,
      sortValue: (h) => h.reason,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Change History for {phase.phaseName}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Per-object audit trail (§28) — every change made to this phase
            configuration. Strikethrough red shows the prior value, green shows
            the value it was changed to.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("challenge-edit", { id: phase.challengeTypeId })}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Challenge
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, field, value…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by field</span>
          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger size="sm" className="h-8 w-56 text-xs">
              <SelectValue placeholder="All fields" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              {fieldOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(h) => h.id}
        pageSize={10}
        emptyTitle="No change records"
        emptyDescription="No changes match the current search or filter."
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function PhaseDetailPage() {
  const { router, navigate, tenant } = usePlatform();

  const { phase, index } = useMemo(
    () => resolvePhase(router.params.id),
    [router.params.id],
  );

  const types = getChallengeTypes();
  const challengeName =
    resolveTermsInString(types.find((t) => t.id === phase.challengeTypeId)?.name ?? "Challenge", tenant);

  const [draft, setDraft] = useState<PhaseDraft>(() => ({
    title: phase.phaseName,
    step: phase.phaseOrder,
    leverage: "1:100",
    isLive: phase.isFunded,
    scalingPlan: false,
    profitTargetPct: phase.profitTargetPct,
    dailyDrawdownPct: phase.dailyDrawdownPct,
    maxDrawdownPct: phase.maxDrawdownPct,
    minTradingDays: phase.minTradingDays,
    maxDays: phase.maxDays,
    tradingDayThreshold: 0,
    autoPass: false,
  }));
  const [tab, setTab] = useState<string>("general");

  // Re-seed when the underlying phase changes
  const [lastPhaseId, setLastPhaseId] = useState<string>(phase.id);
  if (phase.id !== lastPhaseId) {
    setLastPhaseId(phase.id);
    setDraft({
      title: phase.phaseName,
      step: phase.phaseOrder,
      leverage: "1:100",
      isLive: phase.isFunded,
      scalingPlan: false,
      profitTargetPct: phase.profitTargetPct,
      dailyDrawdownPct: phase.dailyDrawdownPct,
      maxDrawdownPct: phase.maxDrawdownPct,
      minTradingDays: phase.minTradingDays,
      maxDays: phase.maxDays,
      tradingDayThreshold: 0,
      autoPass: false,
    });
  }

  return (
    <Page>
      <PageHeader
        title={`Phase Detail — ${phase.phaseName}`}
        description={`Step ${phase.phaseOrder} of ${challengeName}. ${phase.isFunded ? "Funded (live) phase." : "Evaluation phase."} Configure risk rules, broker mappings, and review change history.`}
        icon={GitBranch}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("phase-management")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Phase Management
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">{challengeName}</span>
        <span>·</span>
        <span>Phase {phase.phaseOrder}</span>
        {phase.isFunded ? (
          <>
            <span>·</span>
            <StatusBadge tone="success">Funded</StatusBadge>
          </>
        ) : null}
        <span>·</span>
        <span>Profit target {phase.profitTargetPct === 0 ? "none" : `${phase.profitTargetPct}%`}</span>
        <span>·</span>
        <span>Max DD {phase.maxDrawdownPct}%</span>
        <span>·</span>
        <span>Daily DD {phase.dailyDrawdownPct}%</span>
      </div>

      <PageContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-fit">
            <TabsTrigger value="general" className="text-xs">
              <Settings2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="platform-ids" className="text-xs">
              <Plug className="h-3.5 w-3.5" /> Trading Platform IDs
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3.5 w-3.5" /> Change History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4">
            <GeneralTab
              phase={phase}
              draft={draft}
              setDraft={setDraft}
              challengeName={challengeName}
            />
          </TabsContent>
          <TabsContent value="platform-ids" className="mt-4">
            <PlatformIdsTab
              phase={phase}
              index={index}
              challengeName={challengeName}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <ChangeHistoryTab
              phase={phase}
              index={index}
              navigate={navigate}
            />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
