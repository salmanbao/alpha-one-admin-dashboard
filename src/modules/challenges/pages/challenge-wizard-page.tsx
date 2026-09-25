"use client";

/**
 * Challenge Wizard Page (spec §14, §15, §16, §12, §23)
 *
 * Guided 7-step workflow to create a new challenge template. Each step
 * represents a meaningful mental concept:
 *
 *   1. Select challenge type        — what kind of evaluation is this?
 *   2. Phase 1 config               — risk / target / time limits
 *   3. Phase 2 config (if applicable)— verification phase
 *   4. Trading rules                 — what's allowed?
 *   5. Payout rules                  — profit split / frequency / methods
 *   6. Risk rules                    — daily / overall / trailing
 *   7. Review                        — summary + Create Challenge
 *
 * Smart defaults (spec §15): selecting a challenge type auto-fills the
 * phase config forms from getChallengePhaseConfigs(typeId). Templates over
 * blank forms (spec §16).
 *
 * Step indicator pattern mirrors OnboardingWizard (done/active/inactive
 * circles + connecting progress bars).
 *
 * All form state is local useState. No persistence — on Create, we show
 * a toast and reset.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import {
  getChallengeTypes,
  getChallengePhaseConfigs,
  type ChallengeType,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Zap,
  Target,
  Layers,
  GitBranch,
  Gift,
  Trophy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_ICONS: Record<string, LucideIcon> = {
  Zap,
  Target,
  Layers,
  GitBranch,
  Gift,
  Trophy,
};

const STEPS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "type", label: "Type", icon: Target },
  { id: "phase-1", label: "Phase 1", icon: Layers },
  { id: "phase-2", label: "Phase 2", icon: Layers },
  { id: "trading", label: "Trading", icon: ShieldCheck },
  { id: "payout", label: "Payout", icon: DollarSign },
  { id: "risk", label: "Risk", icon: AlertTriangle },
  { id: "review", label: "Review", icon: ScrollText },
];

const PAYOUT_METHODS = ["Crypto (USDT)", "Card (Stripe)", "Fiat (Bank)"] as const;

const PAYOUT_FREQUENCIES = [
  { id: "weekly", label: "Weekly" },
  { id: "bi-weekly", label: "Bi-weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

const TRAILING_TYPES = [
  { id: "static", label: "Static", description: "Fixed limit from the initial balance." },
  { id: "trailing", label: "Trailing", description: "Limit follows the highest recorded equity." },
  { id: "relative", label: "Relative", description: "Limit based on a rolling window." },
] as const;

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

interface PhaseConfig {
  accountSize: string;
  profitTargetPct: string;
  maxDrawdownPct: string;
  dailyDrawdownPct: string;
  minTradingDays: string;
  maxDays: string;
}

const EMPTY_PHASE: PhaseConfig = {
  accountSize: "",
  profitTargetPct: "",
  maxDrawdownPct: "",
  dailyDrawdownPct: "",
  minTradingDays: "",
  maxDays: "",
};

interface WizardState {
  challengeTypeId: string | null;
  phase1: PhaseConfig;
  phase2: PhaseConfig;
  tradingRules: {
    newsTrading: "allow" | "block";
    copyTradingDetection: boolean;
    weekendTrading: "allow" | "block";
  };
  payoutRules: {
    profitSplitPct: string;
    payoutFrequency: (typeof PAYOUT_FREQUENCIES)[number]["id"];
    payoutMethods: string[];
  };
  riskRules: {
    maxDailyLossPct: string;
    maxOverallLossPct: string;
    trailingDrawdownType: (typeof TRAILING_TYPES)[number]["id"];
  };
}

const INITIAL_STATE: WizardState = {
  challengeTypeId: null,
  phase1: { ...EMPTY_PHASE },
  phase2: { ...EMPTY_PHASE },
  tradingRules: {
    newsTrading: "block",
    copyTradingDetection: true,
    weekendTrading: "block",
  },
  payoutRules: {
    profitSplitPct: "80",
    payoutFrequency: "bi-weekly",
    payoutMethods: ["Crypto (USDT)", "Card (Stripe)"],
  },
  riskRules: {
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    trailingDrawdownType: "trailing",
  },
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function ChallengeWizardPage() {
  const { tenant } = usePlatform();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [step, setStep] = useState(0);

  const challengeTypes = getChallengeTypes();
  const selectedType = useMemo(
    () => challengeTypes.find((t) => t.id === state.challengeTypeId) ?? null,
    [challengeTypes, state.challengeTypeId],
  );
  const hasPhase2 = (selectedType?.phases ?? 0) >= 2;

  /* ---- Smart defaults: select type → fill phases ---- */
  const selectChallengeType = (typeId: string) => {
    const configs = getChallengePhaseConfigs(typeId);
    // Find first non-funded phase as Phase 1, second non-funded as Phase 2
    const evaluationPhases = configs.filter((p) => !p.isFunded);
    const phase1Cfg = evaluationPhases[0] ?? configs[0];
    const phase2Cfg = evaluationPhases[1] ?? configs[1];
    setState((s) => ({
      ...s,
      challengeTypeId: typeId,
      phase1: phase1Cfg ? phaseConfigFromTemplate(phase1Cfg) : { ...EMPTY_PHASE },
      phase2: phase2Cfg ? phaseConfigFromTemplate(phase2Cfg) : { ...EMPTY_PHASE },
    }));
  };

  /* ---- Validation per step ---- */
  const stepValid = (i: number): boolean => {
    switch (i) {
      case 0:
        return state.challengeTypeId !== null;
      case 1:
        return phaseValid(state.phase1);
      case 2:
        return !hasPhase2 || phaseValid(state.phase2);
      case 3:
        return true;
      case 4:
        // Payout step — at least one payout method must be selected and
        // the profit-split % must be a number 0–100. Previously returned
        // `true` unconditionally, so the operator could click Next with
        // zero payout methods and an invalid split.
        return (
          state.payoutRules.payoutMethods.length > 0 &&
          Number(state.payoutRules.profitSplitPct) >= 0 &&
          Number(state.payoutRules.profitSplitPct) <= 100
        );
      case 5:
        return (
          Number(state.riskRules.maxDailyLossPct) > 0 &&
          Number(state.riskRules.maxOverallLossPct) > 0
        );
      case 6:
        return true;
      default:
        return false;
    }
  };

  const canNext = stepValid(step) && step < STEPS.length - 1;
  const canBack = step > 0;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const createChallenge = () => {
    toast({
      title: resolveTermsInString("Challenge created", tenant),
      description: resolveTermsInString(`${selectedType?.name ?? "Challenge"} template saved and ready to assign to traders.`, tenant) + " (demo)",
    });
    setState(INITIAL_STATE);
    setStep(0);
  };

  /* ---- Step content renderer ---- */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepType
            types={challengeTypes}
            selectedId={state.challengeTypeId}
            onSelect={selectChallengeType}
          />
        );
      case 1:
        return (
          <PhaseForm
            title="Phase 1 — Evaluation"
            description="Initial evaluation phase. Traders must reach the profit target while staying within risk limits."
            value={state.phase1}
            onChange={(next) => setState((s) => ({ ...s, phase1: next }))}
          />
        );
      case 2:
        if (!hasPhase2) {
          return (
            <NoticeCard
              title="Phase 2 not applicable"
              description={`"${selectedType?.name ?? "This challenge"}" only has one phase. You can skip this step and continue to Trading Rules.`}
            />
          );
        }
        return (
          <PhaseForm
            title="Phase 2 — Verification"
            description="Second evaluation phase. Typically a lower profit target with the same risk limits as Phase 1."
            value={state.phase2}
            onChange={(next) => setState((s) => ({ ...s, phase2: next }))}
          />
        );
      case 3:
        return (
          <TradingRulesForm
            value={state.tradingRules}
            onChange={(next) => setState((s) => ({ ...s, tradingRules: next }))}
          />
        );
      case 4:
        return (
          <PayoutRulesForm
            value={state.payoutRules}
            onChange={(next) => setState((s) => ({ ...s, payoutRules: next }))}
          />
        );
      case 5:
        return (
          <RiskRulesForm
            value={state.riskRules}
            onChange={(next) => setState((s) => ({ ...s, riskRules: next }))}
          />
        );
      case 6:
        return (
          <ReviewStep
            state={state}
            selectedType={selectedType}
            hasPhase2={hasPhase2}
            onCreate={createChallenge}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      <PageHeader
        title={resolveTermsInString("Create Challenge", tenant)}
        description={resolveTermsInString("Guided wizard to configure a new evaluation challenge template.", tenant)}
        icon={Sparkles}
      />
      <PageContent>
        {/* Step indicator — done / active / inactive + connecting bars (mirrors OnboardingWizard) */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-center">
                    {i > 0 ? (
                      <div className={cn("h-0.5 flex-1", i <= step ? "bg-primary" : "bg-muted")} />
                    ) : null}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary text-primary"
                            : "border-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    {i < STEPS.length - 1 ? (
                      <div className={cn("h-0.5 flex-1", i < step ? "bg-primary" : "bg-muted")} />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {resolveTermsInString(s.label, tenant)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-lg border bg-card p-4 md:p-6">
          <div className="min-h-[320px]">{renderStep()}</div>

          <Separator className="my-4" />

          {/* Footer nav — one primary action per step (spec §23) */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={!canBack} onClick={back} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button size="sm" disabled={!canNext} onClick={next} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={createChallenge} className="gap-1.5">
                <Check className="h-4 w-4" /> {resolveTermsInString("Create Challenge", tenant)}
              </Button>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function phaseConfigFromTemplate(cfg: {
  accountSize: number;
  profitTargetPct: number;
  maxDrawdownPct: number;
  dailyDrawdownPct: number;
  minTradingDays: number;
  maxDays: number;
}): PhaseConfig {
  return {
    accountSize: String(cfg.accountSize),
    profitTargetPct: String(cfg.profitTargetPct),
    maxDrawdownPct: String(cfg.maxDrawdownPct),
    dailyDrawdownPct: String(cfg.dailyDrawdownPct),
    minTradingDays: String(cfg.minTradingDays),
    maxDays: String(cfg.maxDays),
  };
}

function phaseValid(p: PhaseConfig): boolean {
  return (
    Number(p.accountSize) > 0 &&
    Number(p.profitTargetPct) >= 0 &&
    Number(p.maxDrawdownPct) > 0 &&
    Number(p.dailyDrawdownPct) > 0 &&
    Number(p.minTradingDays) >= 0 &&
    Number(p.maxDays) >= 0
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

const REQUIRED_ASTERISK = <span className="text-rose-500" aria-hidden>*</span>;

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground">
      {children} {REQUIRED_ASTERISK}
    </Label>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Select challenge type                                    */
/* ------------------------------------------------------------------ */

function StepType({
  types,
  selectedId,
  onSelect,
}: {
  types: ChallengeType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <RequiredLabel>Select challenge type</RequiredLabel>
        <p className="text-xs text-muted-foreground">
          Choose the evaluation structure. Smart defaults will auto-fill the next steps; you can edit
          them later.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const Icon = TYPE_ICONS[t.icon] ?? Target;
          const selected = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:shadow-sm",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/40",
              )}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">{t.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="outline" className="text-[9px]">{t.phases} phase{t.phases !== 1 ? "s" : ""}</Badge>
                {t.hasFreeTrial ? <Badge variant="secondary" className="text-[9px]">Free trial</Badge> : null}
                {t.isCompetition ? <Badge variant="secondary" className="text-[9px]">Competition</Badge> : null}
                {!t.active ? <Badge variant="outline" className="text-[9px] text-muted-foreground">Inactive</Badge> : null}
              </div>
              {selected ? (
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                  <Check className="h-3 w-3" /> Selected — defaults applied
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Steps 2 / 3 — Phase config forms                                   */
/* ------------------------------------------------------------------ */

function PhaseForm({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: PhaseConfig;
  onChange: (next: PhaseConfig) => void;
}) {
  const update = (field: keyof PhaseConfig, v: string) =>
    onChange({ ...value, [field]: v });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Account size (USD)</RequiredLabel>
          <Input
            type="number"
            value={value.accountSize}
            onChange={(e) => update("accountSize", e.target.value)}
            placeholder="10000"
            min={0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Profit target (%)</RequiredLabel>
          <Input
            type="number"
            value={value.profitTargetPct}
            onChange={(e) => update("profitTargetPct", e.target.value)}
            placeholder="8"
            min={0}
            step={0.1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Max drawdown (%)</RequiredLabel>
          <Input
            type="number"
            value={value.maxDrawdownPct}
            onChange={(e) => update("maxDrawdownPct", e.target.value)}
            placeholder="10"
            min={0}
            step={0.1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Daily drawdown (%)</RequiredLabel>
          <Input
            type="number"
            value={value.dailyDrawdownPct}
            onChange={(e) => update("dailyDrawdownPct", e.target.value)}
            placeholder="5"
            min={0}
            step={0.1}
          />
        </div>
        <FieldRow label="Min trading days" hint="Optional — set 0 to disable.">
          <Input
            type="number"
            value={value.minTradingDays}
            onChange={(e) => update("minTradingDays", e.target.value)}
            placeholder="0"
            min={0}
          />
        </FieldRow>
        <FieldRow label="Max days" hint="Optional — set 0 for unlimited.">
          <Input
            type="number"
            value={value.maxDays}
            onChange={(e) => update("maxDays", e.target.value)}
            placeholder="30"
            min={0}
          />
        </FieldRow>
      </div>
      <p className="text-xs text-muted-foreground">
        Smart defaults are pulled from the selected challenge type's phase templates.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Trading rules                                             */
/* ------------------------------------------------------------------ */

function TradingRulesForm({
  value,
  onChange,
}: {
  value: WizardState["tradingRules"];
  onChange: (next: WizardState["tradingRules"]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Trading Rules</h3>
        <p className="text-xs text-muted-foreground">
          What trading activities are allowed or blocked during the evaluation?
        </p>
      </div>
      <div className="space-y-3">
        <ToggleRow
          label="News trading"
          hint="Allow or block trades around high-impact news events (NFP, FOMC)."
          options={[
            { id: "allow", label: "Allow" },
            { id: "block", label: "Block" },
          ]}
          value={value.newsTrading}
          onChange={(v) => onChange({ ...value, newsTrading: v as "allow" | "block" })}
        />
        <ToggleRow
          label="Weekend trading"
          hint="Allow or block new positions opened on weekends for challenge accounts."
          options={[
            { id: "allow", label: "Allow" },
            { id: "block", label: "Block" },
          ]}
          value={value.weekendTrading}
          onChange={(v) => onChange({ ...value, weekendTrading: v as "allow" | "block" })}
        />
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Copy trading detection</p>
            <p className="text-xs text-muted-foreground">
              Detect synchronized trading across multiple accounts.
            </p>
          </div>
          <Switch
            checked={value.copyTradingDetection}
            onChange={(v) => onChange({ ...value, copyTradingDetection: v })}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Payout rules                                              */
/* ------------------------------------------------------------------ */

function PayoutRulesForm({
  value,
  onChange,
}: {
  value: WizardState["payoutRules"];
  onChange: (next: WizardState["payoutRules"]) => void;
}) {
  const toggleMethod = (m: string) => {
    const set = new Set(value.payoutMethods);
    if (set.has(m)) set.delete(m);
    else set.add(m);
    onChange({ ...value, payoutMethods: Array.from(set) });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Payout Rules</h3>
        <p className="text-xs text-muted-foreground">
          How are profits shared with the trader and how often are payouts processed?
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Profit split (%) — trader share</RequiredLabel>
          <Input
            type="number"
            value={value.profitSplitPct}
            onChange={(e) => onChange({ ...value, profitSplitPct: e.target.value })}
            placeholder="80"
            min={0}
            max={100}
          />
          <p className="text-[10px] text-muted-foreground/80">
            Trader keeps {value.profitSplitPct || 0}%, firm receives {100 - (Number(value.profitSplitPct) || 0)}%.
          </p>
        </div>
        <FieldRow label="Payout frequency">
          <select
            value={value.payoutFrequency}
            onChange={(e) =>
              onChange({
                ...value,
                payoutFrequency: e.target.value as WizardState["payoutRules"]["payoutFrequency"],
              })
            }
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {PAYOUT_FREQUENCIES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </FieldRow>
      </div>
      <div className="flex flex-col gap-1.5">
        <RequiredLabel>Payout methods</RequiredLabel>
        <div className="flex flex-wrap gap-2">
          {PAYOUT_METHODS.map((m) => {
            const selected = value.payoutMethods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={selected}
              >
                {selected ? <Check className="mr-1 inline h-3 w-3" /> : null}
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 — Risk rules                                                */
/* ------------------------------------------------------------------ */

function RiskRulesForm({
  value,
  onChange,
}: {
  value: WizardState["riskRules"];
  onChange: (next: WizardState["riskRules"]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Risk Rules</h3>
        <p className="text-xs text-muted-foreground">
          Define the firm-level risk envelope for this challenge.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Max daily loss (%)</RequiredLabel>
          <Input
            type="number"
            value={value.maxDailyLossPct}
            onChange={(e) => onChange({ ...value, maxDailyLossPct: e.target.value })}
            placeholder="5"
            min={0}
            step={0.1}
          />
          <p className="text-[10px] text-muted-foreground/80">
            Resets at 00:00 server time. Exceeding triggers a daily breach.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Max overall loss (%)</RequiredLabel>
          <Input
            type="number"
            value={value.maxOverallLossPct}
            onChange={(e) => onChange({ ...value, maxOverallLossPct: e.target.value })}
            placeholder="10"
            min={0}
            step={0.1}
          />
          <p className="text-[10px] text-muted-foreground/80">
            Cumulative drawdown from peak equity. Does not reset.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <RequiredLabel>Trailing drawdown type</RequiredLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TRAILING_TYPES.map((t) => {
            const selected = value.trailingDrawdownType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    trailingDrawdownType: t.id as WizardState["riskRules"]["trailingDrawdownType"],
                  })
                }
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/40",
                )}
                aria-pressed={selected}
              >
                <span className="text-sm font-medium text-foreground">{t.label}</span>
                <span className="text-[10px] text-muted-foreground">{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 7 — Review                                                    */
/* ------------------------------------------------------------------ */

function ReviewStep({
  state,
  selectedType,
  hasPhase2,
  onCreate,
}: {
  state: WizardState;
  selectedType: ChallengeType | null;
  hasPhase2: boolean;
  onCreate: () => void;
}) {
  const summary: { label: string; value: string }[] = [
    { label: "Challenge type", value: selectedType?.name ?? "—" },
    { label: "Phases", value: String(selectedType?.phases ?? 0) },
    {
      label: "Phase 1 — account size",
      value: state.phase1.accountSize ? `$${Number(state.phase1.accountSize).toLocaleString()}` : "—",
    },
    {
      label: "Phase 1 — profit target",
      value: `${state.phase1.profitTargetPct || 0}%`,
    },
    {
      label: "Phase 1 — max drawdown",
      value: `${state.phase1.maxDrawdownPct || 0}%`,
    },
    {
      label: "Phase 1 — daily drawdown",
      value: `${state.phase1.dailyDrawdownPct || 0}%`,
    },
  ];
  if (hasPhase2) {
    summary.push(
      {
        label: "Phase 2 — account size",
        value: state.phase2.accountSize ? `$${Number(state.phase2.accountSize).toLocaleString()}` : "—",
      },
      { label: "Phase 2 — profit target", value: `${state.phase2.profitTargetPct || 0}%` },
      { label: "Phase 2 — max drawdown", value: `${state.phase2.maxDrawdownPct || 0}%` },
    );
  }
  summary.push(
    { label: "News trading", value: state.tradingRules.newsTrading },
    { label: "Weekend trading", value: state.tradingRules.weekendTrading },
    {
      label: "Copy trading detection",
      value: state.tradingRules.copyTradingDetection ? "Enabled" : "Disabled",
    },
    { label: "Profit split (trader)", value: `${state.payoutRules.profitSplitPct || 0}%` },
    { label: "Payout frequency", value: state.payoutRules.payoutFrequency },
    { label: "Payout methods", value: state.payoutRules.payoutMethods.join(", ") || "—" },
    { label: "Max daily loss", value: `${state.riskRules.maxDailyLossPct || 0}%` },
    { label: "Max overall loss", value: `${state.riskRules.maxOverallLossPct || 0}%` },
    { label: "Trailing drawdown", value: state.riskRules.trailingDrawdownType },
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Review &amp; Create</h3>
        <p className="text-xs text-muted-foreground">
          Confirm the configuration below. You can edit any step using Back, or create the challenge
          template now.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Configuration summary
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {summary.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-xs font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-xs text-foreground">
            Challenge template will be available to assign to traders immediately after creation. Click <span className="font-medium">Create Challenge</span> in the footer to finalize.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared widgets                                               */
/* ------------------------------------------------------------------ */

function ToggleRow({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="inline-flex rounded-md border bg-card p-0.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
              value === opt.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  // Lightweight inline switch (avoids importing a radix switch wrapper just for one row)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function NoticeCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 p-8 text-center">
      <div className="rounded-full bg-muted p-2">
        <Check className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
