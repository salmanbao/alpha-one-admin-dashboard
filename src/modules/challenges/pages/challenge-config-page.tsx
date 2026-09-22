"use client";

/**
 * Challenge Configuration page (UX Constitution §12-13 progressive
 * disclosure, §33 contextual help).
 *
 * Split-view: list of challenge types on the left, a configuration
 * editor on the right. Basic phase parameters are shown by default;
 * advanced trading/news/weekend rules are revealed via an "Advanced"
 * disclosure.
 */

import { useEffect, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getChallengeTypes,
  getChallengePhaseConfigs,
  type ChallengeType,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import {
  LabelWithHelp,
  HELP_TEXTS,
} from "@/components/platform/contextual-help";
import {
  Settings2,
  Plus,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  PencilLine,
  Newspaper,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Phase config editor                                                 */
/* ------------------------------------------------------------------ */

interface FieldDef {
  key: keyof ChallengePhaseConfig;
  label: string;
  suffix?: string;
  help: React.ReactNode;
}

const BASIC_FIELDS: FieldDef[] = [
  { key: "profitTargetPct", label: "Profit Target", suffix: "%", help: HELP_TEXTS.profitTarget },
  { key: "maxDrawdownPct", label: "Max Drawdown", suffix: "%", help: HELP_TEXTS.maxDrawdown },
  { key: "dailyDrawdownPct", label: "Daily Drawdown", suffix: "%", help: HELP_TEXTS.dailyLoss },
  { key: "minTradingDays", label: "Min Trading Days", help: "Minimum number of distinct trading days required before the phase can be marked as passed." },
  { key: "maxDays", label: "Max Days", help: "Maximum calendar days allotted for this phase. Exceeding this auto-fails the phase." },
  { key: "profitSplit", label: "Profit Split", suffix: "%", help: HELP_TEXTS.profitSplit },
];

function PhaseConfigCard({
  phase,
  challengeType,
}: {
  phase: ChallengePhaseConfig;
  challengeType?: ChallengeType;
}) {
  const [draft, setDraft] = useState<ChallengePhaseConfig>(phase);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Re-seed the draft whenever the source phase changes (switching selection)
  useEffect(() => {
    setDraft(phase);
  }, [phase]);

  const isFunded = phase.isFunded;
  const accent = isFunded ? "#059669" : "#d97706";

  const updateField = (key: keyof ChallengePhaseConfig, raw: string) => {
    const num = Number(raw);
    setDraft((d) => ({ ...d, [key]: Number.isFinite(num) ? num : 0 }));
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: accent }}>
            Phase {phase.phaseOrder}
          </span>
          <h4 className="text-sm font-semibold text-foreground">{phase.phaseName}</h4>
          {isFunded ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
              Funded
            </Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          Account {challengeType ? `${challengeType.name} · ` : ""}size ${"$"}{phase.accountSize.toLocaleString()}
        </span>
      </div>

      {/* Basic config — shown by default */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {BASIC_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={`${phase.id}-${f.key}`} className="text-xs text-muted-foreground">
              <LabelWithHelp help={f.help}>{f.label}</LabelWithHelp>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id={`${phase.id}-${f.key}`}
                type="number"
                value={String(draft[f.key])}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="h-8 text-sm tabular-nums"
              />
              {f.suffix ? <span className="text-xs text-muted-foreground">{f.suffix}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Progressive disclosure — advanced trading rules (§12) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-3 border-t pt-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {advancedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Advanced trading rules
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AdvancedSection
              title="Trading Rules"
              icon={ShieldCheck}
              rows={[
                { label: "News Trading", type: "toggle", help: "Allow trading during high-impact news events. Default is to block new positions during news windows." },
                { label: "Hold Over Weekend", type: "toggle", help: "Permit holding positions over the weekend. Default disabled for evaluation phases." },
                { label: "Allow EA Trading", type: "toggle", help: "Permit expert advisor (automated) trading on this phase." },
              ]}
            />
            <AdvancedSection
              title="News Trading"
              icon={Newspaper}
              rows={[
                { label: "Block NFP", type: "toggle", help: "Block new trades during Non-Farm Payrolls releases." },
                { label: "Block FOMC", type: "toggle", help: "Block new trades during Federal Open Market Committee statements." },
                { label: "News Window (min)", type: "input", help: "Minutes before and after a news release during which trading is restricted.", value: "30" },
              ]}
            />
            <AdvancedSection
              title="Weekend Rules"
              icon={CalendarDays}
              rows={[
                { label: "Close on Friday", type: "toggle", help: "Automatically close open positions at end of trading week (Friday 17:00 server time)." },
                { label: "Friday Cutoff (HH:MM)", type: "input", help: "Server time at which new positions cannot be opened on Fridays.", value: "17:00" },
              ]}
            />
            <AdvancedSection
              title="Other Limits"
              icon={Settings2}
              rows={[
                { label: "Max Daily Trades", type: "input", help: "Maximum number of new positions permitted per trading day (0 = unlimited).", value: "0" },
                { label: "Max Lot Size", type: "input", help: "Maximum aggregate lot size per position.", value: "5" },
                { label: "Require Stop-Loss", type: "toggle", help: "Require a stop-loss order on every opened position." },
              ]}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function AdvancedSection({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Array<
    | { label: string; type: "toggle"; help: React.ReactNode }
    | { label: string; type: "input"; help: React.ReactNode; value: string }
  >;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </div>
      <div className="mt-2 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <LabelWithHelp help={r.help}>
              <span className="text-xs text-muted-foreground">{r.label}</span>
            </LabelWithHelp>
            {r.type === "toggle" ? (
              <Switch defaultChecked={r.label === "Require Stop-Loss" ? false : Math.random() > 0.4} />
            ) : (
              <Input defaultValue={r.value} className="h-7 w-24 text-xs tabular-nums" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right-side config editor panel                                      */
/* ------------------------------------------------------------------ */

function ConfigEditor({ type }: { type: ChallengeType }) {
  const phases = useMemo(() => getChallengePhaseConfigs(type.id), [type.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{type.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {phases.length} phase{phases.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {phases.length === 0 ? (
        <EmptyState
          title="No phase configurations"
          description={`This challenge type has no phase configurations yet. Add one to define profit targets, drawdown limits, and trading rules.`}
          icon={Settings2}
          hint="Click Add Phase to begin configuration."
        />
      ) : (
        phases.map((p) => <PhaseConfigCard key={p.id} phase={p} challengeType={type} />)
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        <Button
          size="sm"
          onClick={() => toast({ title: "Configuration saved", description: `${type.name} phase configuration has been saved.` })}
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save Changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast({ title: "Reset to defaults", description: `${type.name} restored to platform defaults.` })}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ChallengeConfigPage() {
  const { router, navigate } = usePlatform();
  const types = getChallengeTypes();

  // Pre-select from router params (when navigated from challenge-types page)
  const paramTypeId = router.params?.typeId;
  const [selectedId, setSelectedId] = useState<string | null>(
    paramTypeId && types.some((t) => t.id === paramTypeId) ? paramTypeId : null,
  );

  // If the param arrives later (e.g. user re-navigates), adjust selection
  // synchronously during render (React docs — "adjusting state when a prop changes").
  const [lastParamTypeId, setLastParamTypeId] = useState<string | undefined>(paramTypeId);
  if (paramTypeId !== lastParamTypeId) {
    setLastParamTypeId(paramTypeId);
    if (paramTypeId && types.some((t) => t.id === paramTypeId)) {
      setSelectedId(paramTypeId);
    }
  }

  const selected = types.find((t) => t.id === selectedId) ?? null;

  // Local active map (Switch toggles update this; saving would persist)
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(
    Object.fromEntries(types.map((t) => [t.id, t.active])),
  );

  const columns: Column<ChallengeType>[] = [
    {
      key: "name",
      header: "Challenge Type",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{t.name}</span>
          {t.hasFreeTrial ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] dark:text-emerald-400">
              Free Trial
            </Badge>
          ) : null}
          {t.isCompetition ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 text-[10px] dark:text-amber-400">
              Competition
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "phases",
      header: "Phases",
      cell: (t) => <span className="text-xs">{t.phases}</span>,
      sortValue: (t) => t.phases,
      numeric: true,
    },
    {
      key: "active",
      header: "Active",
      cell: (t) => (
        <Switch
          checked={activeMap[t.id] ?? t.active}
          onCheckedChange={(checked) => {
            setActiveMap((m) => ({ ...m, [t.id]: checked }));
            toast({
              title: checked ? "Challenge type enabled" : "Challenge type disabled",
              description: `${t.name} is now ${checked ? "available for purchase" : "hidden from the catalog"}.`,
            });
          }}
          aria-label={`Toggle active state for ${t.name}`}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <Button
          size="sm"
          variant={selectedId === t.id ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(t.id);
          }}
        >
          <PencilLine className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Challenge Configuration"
        description="Edit phase parameters, risk limits, and trading rules for each challenge type."
        icon={Settings2}
        actions={
          <Button size="sm" onClick={() => toast({ title: "Add Challenge Type", description: "The new challenge type form would open here." })}>
            <Plus className="mr-1 h-4 w-4" /> Add Challenge Type
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left — list of challenge types */}
          <div className="lg:col-span-5">
            <div className="rounded-lg border bg-card p-3">
              <p className="mb-3 text-sm font-medium text-foreground">Challenge Types</p>
              <DataTable
                columns={columns}
                data={types}
                rowKey={(t) => t.id}
                searchableText={(t) => `${t.name} ${t.description}`}
                searchPlaceholder="Search types…"
                pageSize={6}
                onRowClick={(t) => setSelectedId(t.id)}
                emptyTitle="No challenge types"
                emptyDescription="Add a challenge type to start configuring phases."
              />
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full justify-start text-xs text-muted-foreground"
                onClick={() => navigate("challenge-types")}
              >
                Need an overview? Open the Challenge Types catalog →
              </Button>
            </div>
          </div>

          {/* Right — config editor */}
          <div className={cn("lg:col-span-7")}>
            {selected ? (
              <ConfigEditor type={selected} />
            ) : (
              <EmptyState
                title="Select a challenge type to configure"
                description="Pick a type from the list on the left to edit its phase parameters, drawdown limits, and trading rules."
                icon={Settings2}
                hint="Tip: click any row, or use the Edit button."
              />
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
