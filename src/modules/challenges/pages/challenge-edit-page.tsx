"use client";

/**
 * Challenge Edit page (UX Constitution §12-13, §25-27).
 *
 * Comprehensive 5-tab editor for a single challenge type:
 *   1. General   — basic info, configuration toggles, drawdown settings,
 *                  phases summary table with Edit → phase-detail
 *   2. Phases    — full phase configuration table, Add Phase, row click → phase-detail
 *   3. Payout Rules — profit split, payout schedule, min/max with $/% toggle,
 *                  collapsible informational accordion
 *   4. Checkout  — WooCommerce mapping, activation fee, price, currency,
 *                  test-checkout action
 *   5. Review    — visual phase flow diagram + configuration summary +
 *                  Save All / Publish actions
 *
 * Pre-fills from `getChallengeTypes()` using `router.params.id` as an index
 * (the demo convention — IDs are unstable mock strings, indices are stable
 * for navigation). Falls back to actual mock id or index 0.
 *
 * Terra palette — forest green primary, warm cream surface, amber/teal/
 * violet/emerald accent borders. No blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getChallengeTypes,
  getChallengePhaseConfigs,
  type ChallengeType,
  type ChallengePhaseConfig,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Plus,
  PencilLine,
  FileText,
  Layers,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  ArrowRight,
  Info,
  RotateCcw,
  Send,
  Radio,
  ToggleLeft,
  Target,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SwapMode = "normal" | "swap_free";
type KycTiming = "before" | "after" | "both";
type DrawdownType = "static" | "trailing";
type PayoutFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";
type PayoutValueType = "absolute" | "percentage";

interface ChallengeDraft {
  title: string;
  description: string;
  challengeTypeId: string;
  stepsCount: number;
  swapMode: SwapMode;
  archived: boolean;
  newsTrading: boolean;
  isFreeTrial: boolean;
  isCompetition: boolean;
  autoUpgradeKyc: boolean;
  kycTiming: KycTiming;
  payLater: boolean;
  maxDrawdownType: DrawdownType;
}

interface PayoutDraft {
  profitSplit: number;
  partialPayout: boolean;
  payoutFrequency: PayoutFrequency;
  minPayoutType: PayoutValueType;
  minPayoutValue: number;
  maxPayoutType: PayoutValueType;
  maxPayoutValue: number;
}

interface CheckoutDraft {
  productId: string;
  activationFee: number;
  price: number;
  currency: string;
}

/* ------------------------------------------------------------------ */
/* Phase flow card accent colors (Terra-tinted, no blue/indigo)         */
/* ------------------------------------------------------------------ */

const PHASE_FLOW_COLORS = {
  amber: "#d97706",
  teal: "#0d9488", // substituted for "sky" to honor the no-blue/indigo rule
  violet: "#0d9488",
  emerald: "#059669",
} as const;

const PHASE_FLOW_LABEL: Record<keyof typeof PHASE_FLOW_COLORS, string> = {
  amber: "amber",
  teal: "teal",
  violet: "violet",
  emerald: "emerald",
};

/* ------------------------------------------------------------------ */
/* Static option pools                                                 */
/* ------------------------------------------------------------------ */

const PAYOUT_FREQUENCIES: { value: PayoutFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "AUD", "CAD"] as const;

/* ------------------------------------------------------------------ */
/* ID resolution — use index as mock ID, fallback to actual id        */
/* ------------------------------------------------------------------ */

function resolveChallengeType(id: string | undefined): {
  type: ChallengeType;
  index: number;
} {
  const types = getChallengeTypes();
  if (!id) return { type: types[0], index: 0 };
  const numeric = Number(id);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < types.length) {
    return { type: types[numeric], index: numeric };
  }
  const byId = types.findIndex((t) => t.id === id);
  if (byId >= 0) return { type: types[byId], index: byId };
  return { type: types[0], index: 0 };
}

/* ------------------------------------------------------------------ */
/* Section card primitive                                               */
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

/* ------------------------------------------------------------------ */
/* Field row                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Toggle row (label + Switch on the right)                            */
/* ------------------------------------------------------------------ */

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
/* TAB 1 — General                                                      */
/* ------------------------------------------------------------------ */

function GeneralTab({
  type,
  draft,
  setDraft,
  phases,
  navigate,
}: {
  type: ChallengeType;
  draft: ChallengeDraft;
  setDraft: (next: ChallengeDraft) => void;
  phases: ChallengePhaseConfig[];
  navigate: (view: string, params?: Record<string, string>) => void;
}) {
  const types = getChallengeTypes();

  const setField = <K extends keyof ChallengeDraft>(
    key: K,
    value: ChallengeDraft[K],
  ) => setDraft({ ...draft, [key]: value });

  const phaseColumns: Column<ChallengePhaseConfig>[] = [
    {
      key: "phaseName",
      header: "Phase Name",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {p.phaseOrder}
          </Badge>
          <span className="font-medium text-foreground">{p.phaseName}</span>
          {p.isFunded ? (
            <StatusBadge tone="success" className="text-[10px]">Funded</StatusBadge>
          ) : null}
        </div>
      ),
      sortValue: (p) => p.phaseOrder,
    },
    {
      key: "phaseOrder",
      header: "Step",
      cell: (p) => <span className="tabular-nums">{p.phaseOrder}</span>,
      sortValue: (p) => p.phaseOrder,
      numeric: true,
      width: "70px",
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
      header: "Max Drawdown",
      cell: (p) => `${p.maxDrawdownPct}%`,
      sortValue: (p) => p.maxDrawdownPct,
      numeric: true,
    },
    {
      key: "dailyDrawdownPct",
      header: "Daily Drawdown",
      cell: (p) => `${p.dailyDrawdownPct}%`,
      sortValue: (p) => p.dailyDrawdownPct,
      numeric: true,
    },
    {
      key: "minTradingDays",
      header: "Min Trading Days",
      cell: (p) => (p.minTradingDays === 0 ? "—" : String(p.minTradingDays)),
      sortValue: (p) => p.minTradingDays,
      numeric: true,
    },
    {
      key: "leverage",
      header: "Leverage",
      cell: () => <span className="tabular-nums">1:100</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) =>
        p.isFunded ? (
          <StatusBadge tone="success">Live</StatusBadge>
        ) : (
          <StatusBadge tone="info">Evaluation</StatusBadge>
        ),
      sortValue: (p) => (p.isFunded ? 1 : 0),
    },
    {
      key: "actions",
      header: "",
      cell: (p) => {
        const idx = getChallengePhaseConfigs().findIndex((x) => x.id === p.id);
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate("phase-detail", { id: String(idx) });
            }}
          >
            <PencilLine className="mr-1 h-3.5 w-3.5" /> Edit Phase
          </Button>
        );
      },
      width: "120px",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Basic Info"
        description="Core challenge identification shown to traders in the catalog."
        icon={FileText}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Title" htmlFor="ce-title">
            <Input
              id="ce-title"
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. 2-Step Evaluation"
            />
          </FieldRow>
          <FieldRow
            label="Challenge Type"
            help="Selects the underlying evaluation template. Changing this resets the phase configuration to the new type's defaults."
          >
            <Select
              value={draft.challengeTypeId}
              onValueChange={(v) => setField("challengeTypeId", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a challenge type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label="Description"
            htmlFor="ce-desc"
            help="Short marketing copy displayed under the title in the purchase catalog."
          >
            <Textarea
              id="ce-desc"
              rows={3}
              value={draft.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short marketing copy describing this challenge."
            />
          </FieldRow>
          <FieldRow
            label="Steps Count"
            htmlFor="ce-steps"
            help="Total number of evaluation steps before reaching a funded account. Includes the funded phase."
          >
            <Input
              id="ce-steps"
              type="number"
              min={1}
              max={5}
              value={String(draft.stepsCount)}
              onChange={(e) => setField("stepsCount", Number(e.target.value) || 0)}
            />
          </FieldRow>
        </div>
      </SectionCard>

      <SectionCard
        title="Configuration Toggles"
        description="Behavior switches that affect purchase flow, KYC, and challenge participation."
        icon={ToggleLeft}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldRow
            label="Swap Mode"
            help="Normal mode charges standard overnight swaps. Swap Free disables swaps on most symbols (Islamic-account compatible)."
          >
            <ToggleGroup
              type="single"
              value={draft.swapMode}
              onValueChange={(v: string) => {
                if (v) setField("swapMode", v as SwapMode);
              }}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="normal" className="flex-1 text-xs">
                Normal
              </ToggleGroupItem>
              <ToggleGroupItem value="swap_free" className="flex-1 text-xs">
                Swap Free
              </ToggleGroupItem>
            </ToggleGroup>
          </FieldRow>

          <FieldRow
            label="KYC Timing"
            help="Controls when KYC verification is required relative to the challenge purchase."
          >
            <Select
              value={draft.kycTiming}
              onValueChange={(v) => setField("kycTiming", v as KycTiming)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before purchase</SelectItem>
                <SelectItem value="after">After purchase</SelectItem>
                <SelectItem value="both">Before and after payout</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <ToggleRow
            label="Archived"
            description="Hidden from the public catalog. Existing traders keep access."
            checked={draft.archived}
            onChange={(v) => setField("archived", v)}
          />
          <ToggleRow
            label="News Trading Enabled"
            description="Allow opening new positions during high-impact news releases."
            checked={draft.newsTrading}
            onChange={(v) => setField("newsTrading", v)}
          />
          <ToggleRow
            label="Is Free Trial"
            description="No-cost evaluation intended for new-trader acquisition."
            checked={draft.isFreeTrial}
            onChange={(v) => setField("isFreeTrial", v)}
          />
          <ToggleRow
            label="Is Competition"
            description="Leaderboard-based challenge among multiple traders."
            checked={draft.isCompetition}
            onChange={(v) => setField("isCompetition", v)}
          />
          <ToggleRow
            label="Auto Upgrade on KYC"
            description="Automatically upgrade the trader's account tier once KYC is verified."
            checked={draft.autoUpgradeKyc}
            onChange={(v) => setField("autoUpgradeKyc", v)}
          />

          <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Pay-later</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Allow the trader to start the challenge before payment clears.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={draft.payLater}
                onCheckedChange={(v) => setField("payLater", v === true)}
                aria-label="Pay-later"
              />
              <span className="text-xs text-muted-foreground">Enabled</span>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Drawdown Configuration"
        description="How maximum drawdown is measured against the trader's equity."
        icon={AlertCircle}
      >
        <FieldRow
          label="Maximum Drawdown Type"
          help={
            <div className="space-y-1.5">
              <p>
                <strong>Static</strong> — drawdown is measured from the initial
                account balance. Simpler, but traders who build early profit have
                more headroom.
              </p>
              <p>
                <strong>Trailing</strong> — drawdown is measured from the highest
                recorded equity peak. Tighter risk control, common in funded
                phases to protect realized gains.
              </p>
            </div>
          }
        >
          <ToggleGroup
            type="single"
            value={draft.maxDrawdownType}
            onValueChange={(v: string) => {
              if (v) setField("maxDrawdownType", v as DrawdownType);
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="static" className="flex-1 text-xs">
              Static
            </ToggleGroupItem>
            <ToggleGroupItem value="trailing" className="flex-1 text-xs">
              Trailing
            </ToggleGroupItem>
          </ToggleGroup>
        </FieldRow>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            Drawdown type applies to all phases of this challenge. Per-phase
            overrides can be configured in the <span className="font-medium text-foreground">Phases</span> tab.
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Phases Summary"
        description="All phases for this challenge type. Edit any phase to open its detail page."
        icon={Layers}
      >
        <DataTable
          columns={phaseColumns}
          data={phases}
          rowKey={(p) => p.id}
          pageSize={6}
          emptyTitle="No phases configured"
          emptyDescription="Add phases in the Phases tab to define evaluation steps."
        />
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 2 — Phases                                                       */
/* ------------------------------------------------------------------ */

function PhasesTab({
  phases,
  navigate,
  currency,
}: {
  phases: ChallengePhaseConfig[];
  navigate: (view: string, params?: Record<string, string>) => void;
  currency: string;
}) {
  const allPhases = getChallengePhaseConfigs();

  const columns: Column<ChallengePhaseConfig>[] = [
    {
      key: "phaseName",
      header: "Phase Name",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {p.phaseOrder}
          </Badge>
          <span className="font-medium text-foreground">{p.phaseName}</span>
        </div>
      ),
      sortValue: (p) => p.phaseOrder,
    },
    {
      key: "phaseOrder",
      header: "Step",
      cell: (p) => <span className="tabular-nums">{p.phaseOrder}</span>,
      sortValue: (p) => p.phaseOrder,
      numeric: true,
      width: "70px",
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
      header: "Max Drawdown",
      cell: (p) => `${p.maxDrawdownPct}%`,
      sortValue: (p) => p.maxDrawdownPct,
      numeric: true,
    },
    {
      key: "dailyDrawdownPct",
      header: "Daily Drawdown",
      cell: (p) => `${p.dailyDrawdownPct}%`,
      sortValue: (p) => p.dailyDrawdownPct,
      numeric: true,
    },
    {
      key: "minTradingDays",
      header: "Min Days",
      cell: (p) => (p.minTradingDays === 0 ? "—" : String(p.minTradingDays)),
      sortValue: (p) => p.minTradingDays,
      numeric: true,
    },
    {
      key: "maxDays",
      header: "Max Days",
      cell: (p) => (p.maxDays === 0 ? "∞" : String(p.maxDays)),
      sortValue: (p) => p.maxDays,
      numeric: true,
    },
    {
      key: "leverage",
      header: "Leverage",
      cell: () => <span className="tabular-nums">1:100</span>,
    },
    {
      key: "threshold",
      header: "Trading-day Threshold",
      cell: () => <span className="tabular-nums">0 lots</span>,
    },
    {
      key: "autoPass",
      header: "Auto Pass",
      cell: (p) =>
        p.profitTargetPct === 0 ? (
          <StatusBadge tone="muted">N/A</StatusBadge>
        ) : (
          <StatusBadge tone="success">On</StatusBadge>
        ),
      sortValue: (p) => (p.profitTargetPct === 0 ? 0 : 1),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => {
        const idx = allPhases.findIndex((x) => x.id === p.id);
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate("phase-detail", { id: String(idx) });
            }}
          >
            <PencilLine className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        );
      },
      width: "110px",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Phase Configuration
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click any row to open the phase detail editor. Configure risk
            limits, trading-day thresholds, and broker group mappings per phase.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Add Phase",
              description: "The new phase form would open here.",
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add Phase
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={phases}
        rowKey={(p) => p.id}
        onRowClick={(p) => {
          const idx = allPhases.findIndex((x) => x.id === p.id);
          navigate("phase-detail", { id: String(idx) });
        }}
        pageSize={10}
        emptyTitle="No phases configured"
        emptyDescription="Add a phase to begin defining the evaluation flow."
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 3 — Payout Rules                                                 */
/* ------------------------------------------------------------------ */

function PayoutTab({
  payout,
  setPayout,
}: {
  payout: PayoutDraft;
  setPayout: (next: PayoutDraft) => void;
}) {
  const setField = <K extends keyof PayoutDraft>(
    key: K,
    value: PayoutDraft[K],
  ) => setPayout({ ...payout, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Profit Split"
        description="Percentage of profits the trader keeps. Remainder goes to the prop firm."
        icon={DollarSign}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow
            label="Profit Split"
            htmlFor="ce-profit-split"
            help="Default is 80/20 in the trader's favor. Higher splits attract experienced traders but reduce firm margin."
          >
            <div className="flex items-center gap-1">
              <Input
                id="ce-profit-split"
                type="number"
                min={0}
                max={100}
                value={String(payout.profitSplit)}
                onChange={(e) =>
                  setField("profitSplit", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Payout Frequency"
            help="How often traders may request a payout from their funded account."
          >
            <Select
              value={payout.payoutFrequency}
              onValueChange={(v) =>
                setField("payoutFrequency", v as PayoutFrequency)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
        <div className="mt-3">
          <ToggleRow
            label="Partial Payout"
            description="Allow traders to withdraw a portion of their available balance rather than the full amount."
            checked={payout.partialPayout}
            onChange={(v) => setField("partialPayout", v)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Payout Limits"
        description="Floor and ceiling applied to each withdrawal request."
        icon={DollarSign}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Minimum payout */}
          <div className="flex flex-col gap-3 rounded-md border bg-background p-3">
            <FieldRow
              label="Minimum Payout Type"
              help="Choose whether the minimum is a fixed dollar amount or a percentage of the available balance."
            >
              <ToggleGroup
                type="single"
                value={payout.minPayoutType}
                onValueChange={(v: string) => {
                  if (v) setField("minPayoutType", v as PayoutValueType);
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="absolute" className="flex-1 text-xs">
                  Absolute $
                </ToggleGroupItem>
                <ToggleGroupItem value="percentage" className="flex-1 text-xs">
                  Percentage %
                </ToggleGroupItem>
              </ToggleGroup>
            </FieldRow>
            <FieldRow
              label="Minimum Payout Value"
              htmlFor="ce-payout-min"
            >
              <div className="flex items-center gap-1">
                <Input
                  id="ce-payout-min"
                  type="number"
                  min={0}
                  value={String(payout.minPayoutValue)}
                  onChange={(e) =>
                    setField("minPayoutValue", Number(e.target.value) || 0)
                  }
                  className="tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  {payout.minPayoutType === "absolute" ? "USD" : "%"}
                </span>
              </div>
            </FieldRow>
          </div>

          {/* Maximum payout */}
          <div className="flex flex-col gap-3 rounded-md border bg-background p-3">
            <FieldRow
              label="Maximum Payout Type"
              help="Choose whether the maximum is a fixed dollar amount or a percentage of the available balance."
            >
              <ToggleGroup
                type="single"
                value={payout.maxPayoutType}
                onValueChange={(v: string) => {
                  if (v) setField("maxPayoutType", v as PayoutValueType);
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="absolute" className="flex-1 text-xs">
                  Absolute $
                </ToggleGroupItem>
                <ToggleGroupItem value="percentage" className="flex-1 text-xs">
                  Percentage %
                </ToggleGroupItem>
              </ToggleGroup>
            </FieldRow>
            <FieldRow
              label="Maximum Payout Value"
              htmlFor="ce-payout-max"
            >
              <div className="flex items-center gap-1">
                <Input
                  id="ce-payout-max"
                  type="number"
                  min={0}
                  value={String(payout.maxPayoutValue)}
                  onChange={(e) =>
                    setField("maxPayoutValue", Number(e.target.value) || 0)
                  }
                  className="tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  {payout.maxPayoutType === "absolute" ? "USD" : "%"}
                </span>
              </div>
            </FieldRow>
          </div>
        </div>
      </SectionCard>

      <Accordion type="single" collapsible>
        <AccordionItem
          value="payout-effect"
          className="rounded-md border bg-muted/20 px-4"
        >
          <AccordionTrigger className="text-sm font-medium text-foreground">
            When do payout changes take effect?
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <p>
              Changes to payout rules apply only to <strong>new</strong> payout
              requests submitted after the change is saved. Pending and in-flight
              requests continue under the rules in effect at the time of their
              submission.
            </p>
            <p className="mt-2">
              Profit-split changes do not retroactively affect already-earned
              trader balances. Min/max limits affect the validation gate at the
              moment a request is submitted.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast({
              title: "Reverted",
              description: "Payout rules reverted to last saved values.",
            })
          }
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Payout rules saved",
              description: `Profit split ${payout.profitSplit}% · ${PAYOUT_FREQUENCIES.find((f) => f.value === payout.payoutFrequency)?.label} payout frequency.`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save Payout Rules
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 4 — Checkout                                                     */
/* ------------------------------------------------------------------ */

function CheckoutTab({
  checkout,
  setCheckout,
}: {
  checkout: CheckoutDraft;
  setCheckout: (next: CheckoutDraft) => void;
}) {
  const setField = <K extends keyof CheckoutDraft>(
    key: K,
    value: CheckoutDraft[K],
  ) => setCheckout({ ...checkout, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-50/50 px-3 py-2.5 text-sm dark:bg-amber-950/20">
        <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div>
          <p className="font-medium text-foreground">
            This challenge is linked to an external checkout system (WooCommerce).
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configure the product mapping below. Price and currency are pushed
            to WooCommerce on save; activation fee is collected by the platform.
          </p>
        </div>
      </div>

      <SectionCard
        title="WooCommerce Product Mapping"
        description="Links this challenge to a single WooCommerce product for purchase."
        icon={ShoppingBag}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow
            label="Product ID"
            htmlFor="ce-product-id"
            help="The WooCommerce product post ID. Found in the WooCommerce admin under Products → All Products."
          >
            <Input
              id="ce-product-id"
              value={checkout.productId}
              onChange={(e) => setField("productId", e.target.value)}
              placeholder="e.g. wc-chl-29481"
            />
          </FieldRow>
          <FieldRow
            label="Currency"
            help="Currency used for both activation fee and price. Traders see prices in this currency."
          >
            <Select
              value={checkout.currency}
              onValueChange={(v) => setField("currency", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label="Activation Fee"
            htmlFor="ce-activation-fee"
            help="One-time fee charged by the platform when the challenge is purchased. Collected separately from the product price."
          >
            <div className="flex items-center gap-1">
              <Input
                id="ce-activation-fee"
                type="number"
                min={0}
                step="0.01"
                value={String(checkout.activationFee)}
                onChange={(e) =>
                  setField("activationFee", Number(e.target.value) || 0)
                }
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">
                {checkout.currency}
              </span>
            </div>
          </FieldRow>
          <FieldRow
            label="Price"
            htmlFor="ce-price"
            help="Challenge purchase price pushed to WooCommerce. Excludes the activation fee."
          >
            <div className="flex items-center gap-1">
              <Input
                id="ce-price"
                type="number"
                min={0}
                step="0.01"
                value={String(checkout.price)}
                onChange={(e) => setField("price", Number(e.target.value) || 0)}
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">
                {checkout.currency}
              </span>
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast({
              title: "Checkout test successful",
              description: `Product ${checkout.productId} linked and reachable.`,
            })
          }
        >
          <Radio className="mr-1 h-3.5 w-3.5" /> Test Checkout
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Checkout config saved",
              description: `WooCommerce product ${checkout.productId} · ${checkout.currency} ${checkout.price} + ${checkout.currency} ${checkout.activationFee} activation fee.`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save Checkout Config
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 5 — Review                                                       */
/* ------------------------------------------------------------------ */

function PhaseFlowCard({
  label,
  phaseName,
  profitTarget,
  maxDrawdown,
  leverage,
  accent,
  isLast,
}: {
  label: string;
  phaseName: string;
  profitTarget: string;
  maxDrawdown: string;
  leverage: string;
  accent: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex w-48 flex-col gap-1.5 rounded-md border-2 bg-card p-3"
        style={{ borderColor: accent }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: accent }}
          >
            {label}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground">{phaseName}</p>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>
            Profit Target:{" "}
            <span className="font-medium text-foreground">{profitTarget}</span>
          </span>
          <span>
            Max Drawdown:{" "}
            <span className="font-medium text-foreground">{maxDrawdown}</span>
          </span>
          <span>
            Leverage:{" "}
            <span className="font-medium text-foreground">{leverage}</span>
          </span>
        </div>
      </div>
      {!isLast ? (
        <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  );
}

function ReviewTab({
  type,
  draft,
  payout,
  checkout,
  phases,
  navigate,
}: {
  type: ChallengeType;
  draft: ChallengeDraft;
  payout: PayoutDraft;
  checkout: CheckoutDraft;
  phases: ChallengePhaseConfig[];
  navigate: (view: string, params?: Record<string, string>) => void;
}) {
  // Build the flow cards: each evaluation phase + a final funded card
  const flowCards: Array<{
    label: string;
    name: string;
    profitTarget: string;
    maxDrawdown: string;
    leverage: string;
    accent: string;
  }> = phases.map((p, i) => {
    const accents = Object.values(PHASE_FLOW_COLORS);
    return {
      label: p.isFunded ? "Funded" : `Phase ${i + 1}`,
      name: p.phaseName,
      profitTarget: p.profitTargetPct === 0 ? "—" : `${p.profitTargetPct}%`,
      maxDrawdown: `${p.maxDrawdownPct}%`,
      leverage: "1:100",
      accent: p.isFunded
        ? PHASE_FLOW_COLORS.emerald
        : accents[i % accents.length],
    };
  });
  // If there is no funded phase in the list, append a synthetic Funded card
  if (!phases.some((p) => p.isFunded)) {
    flowCards.push({
      label: "Funded",
      name: "Live Account",
      profitTarget: "—",
      maxDrawdown: "10%",
      leverage: "1:100",
      accent: PHASE_FLOW_COLORS.emerald,
    });
  }

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Title", value: draft.title || "—" },
    { label: "Challenge Type", value: type.name },
    { label: "Steps Count", value: String(draft.stepsCount) },
    { label: "Swap Mode", value: draft.swapMode === "swap_free" ? "Swap Free" : "Normal" },
    { label: "Archived", value: draft.archived ? "Yes" : "No" },
    { label: "News Trading", value: draft.newsTrading ? "Enabled" : "Disabled" },
    { label: "Free Trial", value: draft.isFreeTrial ? "Yes" : "No" },
    { label: "Competition", value: draft.isCompetition ? "Yes" : "No" },
    { label: "Auto Upgrade on KYC", value: draft.autoUpgradeKyc ? "Yes" : "No" },
    { label: "KYC Timing", value: draft.kycTiming === "before" ? "Before purchase" : draft.kycTiming === "after" ? "After purchase" : "Before and after payout" },
    { label: "Pay-later", value: draft.payLater ? "Enabled" : "Disabled" },
    { label: "Max Drawdown Type", value: draft.maxDrawdownType === "trailing" ? "Trailing" : "Static" },
    { label: "Profit Split", value: `${payout.profitSplit}%` },
    { label: "Payout Frequency", value: PAYOUT_FREQUENCIES.find((f) => f.value === payout.payoutFrequency)?.label ?? "—" },
    { label: "Partial Payout", value: payout.partialPayout ? "Allowed" : "Full only" },
    { label: "Min Payout", value: payout.minPayoutType === "absolute" ? `${checkout.currency} ${payout.minPayoutValue}` : `${payout.minPayoutValue}%` },
    { label: "Max Payout", value: payout.maxPayoutType === "absolute" ? `${checkout.currency} ${payout.maxPayoutValue}` : `${payout.maxPayoutValue}%` },
    { label: "WooCommerce Product", value: checkout.productId || "—" },
    { label: "Price", value: `${checkout.currency} ${checkout.price}` },
    { label: "Activation Fee", value: `${checkout.currency} ${checkout.activationFee}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Phase Flow Diagram"
        description="Visual sequence of phases the trader progresses through to reach a funded account."
        icon={Layers}
      >
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2">
          {flowCards.map((c, i) => (
            <PhaseFlowCard
              key={`${c.label}-${i}`}
              label={c.label}
              phaseName={c.name}
              profitTarget={c.profitTarget}
              maxDrawdown={c.maxDrawdown}
              leverage={c.leverage}
              accent={c.accent}
              isLast={i === flowCards.length - 1}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(PHASE_FLOW_COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: v }}
              />
              {PHASE_FLOW_LABEL[k as keyof typeof PHASE_FLOW_COLORS]}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Configuration Summary"
        description="All configured settings for this challenge, ready to publish."
        icon={CheckCircle2}
      >
        <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {summaryRows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 border-b border-dashed border-border py-1.5 last:border-0"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-sm font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-muted/20 p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("phase-management")}
        >
          <Layers className="mr-1 h-3.5 w-3.5" /> View All Phases
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "Challenge configuration saved",
              description: `${draft.title || type.name} configuration has been saved.`,
            })
          }
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save All Changes
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast({
              title: "Challenge published",
              description: `${draft.title || type.name} is now available for purchase.`,
            })
          }
        >
          <Send className="mr-1 h-3.5 w-3.5" /> Publish Challenge
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function ChallengeEditPage() {
  const { router, navigate, runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  const { type, index } = useMemo(
    () => resolveChallengeType(router.params.id),
    [router.params.id],
  );

  // Phase list for this challenge type
  const phases = useMemo(
    () => getChallengePhaseConfigs(type.id),
    [type.id],
  );

  /* ---------- Draft state (seeded from type) ---------- */
  const [draft, setDraft] = useState<ChallengeDraft>(() => ({
    title: type.name,
    description: type.description,
    challengeTypeId: type.id,
    stepsCount: type.phases,
    swapMode: "normal",
    archived: !type.active,
    newsTrading: false,
    isFreeTrial: type.hasFreeTrial,
    isCompetition: type.isCompetition,
    autoUpgradeKyc: false,
    kycTiming: "before",
    payLater: false,
    maxDrawdownType: "static",
  }));
  const [payout, setPayout] = useState<PayoutDraft>(() => ({
    profitSplit: phases.find((p) => p.isFunded)?.profitSplit ?? 80,
    partialPayout: true,
    payoutFrequency: "biweekly",
    minPayoutType: "absolute",
    minPayoutValue: 100,
    maxPayoutType: "percentage",
    maxPayoutValue: 90,
  }));
  const [checkout, setCheckout] = useState<CheckoutDraft>(() => ({
    // Deterministic mock per challenge id — no Math.random
    productId: `wc-chl-${(index + 1) * 29481}`,
    activationFee: 35,
    price: 89 + index * 10,
    currency,
  }));
  const [tab, setTab] = useState<string>("general");

  // Re-seed when the underlying type changes (user navigates to a different id)
  const [lastTypeId, setLastTypeId] = useState<string>(type.id);
  if (type.id !== lastTypeId) {
    setLastTypeId(type.id);
    setDraft({
      title: type.name,
      description: type.description,
      challengeTypeId: type.id,
      stepsCount: type.phases,
      swapMode: "normal",
      archived: !type.active,
      newsTrading: false,
      isFreeTrial: type.hasFreeTrial,
      isCompetition: type.isCompetition,
      autoUpgradeKyc: false,
      kycTiming: "before",
      payLater: false,
      maxDrawdownType: "static",
    });
    setPayout({
      profitSplit: phases.find((p) => p.isFunded)?.profitSplit ?? 80,
      partialPayout: true,
      payoutFrequency: "biweekly",
      minPayoutType: "absolute",
      minPayoutValue: 100,
      maxPayoutType: "percentage",
      maxPayoutValue: 90,
    });
    setCheckout({
      productId: `wc-chl-${(index + 1) * 29481}`,
      activationFee: 35,
      price: 89 + index * 10,
      currency,
    });
  }

  // Currency follows the tenant — adjust state during render (React docs
  // "you might not need an effect") to avoid setState-in-effect cascades.
  const [lastCurrency, setLastCurrency] = useState<string>(currency);
  if (currency !== lastCurrency) {
    setLastCurrency(currency);
    setCheckout((c) => (c.currency === currency ? c : { ...c, currency }));
  }

  return (
    <Page>
      <PageHeader
        title={`Edit Challenge — ${type.name}`}
        description={`Challenge type ${index + 1} of ${getChallengeTypes().length}. Configure phase parameters, payout rules, checkout integration, then review before publishing.`}
        icon={Settings2}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("challenge-config")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Configuration
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">{type.name}</span>
        <span>·</span>
        <span>{phases.length} phase{phases.length === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{type.phases} step{type.phases === 1 ? "" : "s"}</span>
        {type.hasFreeTrial ? (
          <>
            <span>·</span>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] dark:text-emerald-400">
              Free Trial
            </Badge>
          </>
        ) : null}
        {type.isCompetition ? (
          <>
            <span>·</span>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 text-[10px] dark:text-amber-400">
              Competition
            </Badge>
          </>
        ) : null}
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => navigate("phase-management")}
        >
          <Layers className="mr-1 h-3.5 w-3.5" /> Phase Management
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => navigate("challenge-types")}
        >
          <FileText className="mr-1 h-3.5 w-3.5" /> Challenge Types
        </Button>
      </div>

      <PageContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-fit">
            <TabsTrigger value="general" className="text-xs">
              <Settings2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="phases" className="text-xs">
              <Layers className="h-3.5 w-3.5" /> Phases
            </TabsTrigger>
            <TabsTrigger value="payout" className="text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Payout Rules
            </TabsTrigger>
            <TabsTrigger value="checkout" className="text-xs">
              <ShoppingBag className="h-3.5 w-3.5" /> Checkout
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Review
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4">
            <GeneralTab
              type={type}
              draft={draft}
              setDraft={setDraft}
              phases={phases}
              navigate={navigate}
            />
          </TabsContent>
          <TabsContent value="phases" className="mt-4">
            <PhasesTab
              phases={phases}
              navigate={navigate}
              currency={currency}
            />
          </TabsContent>
          <TabsContent value="payout" className="mt-4">
            <PayoutTab payout={payout} setPayout={setPayout} />
          </TabsContent>
          <TabsContent value="checkout" className="mt-4">
            <CheckoutTab checkout={checkout} setCheckout={setCheckout} />
          </TabsContent>
          <TabsContent value="review" className="mt-4">
            <ReviewTab
              type={type}
              draft={draft}
              payout={payout}
              checkout={checkout}
              phases={phases}
              navigate={navigate}
            />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
