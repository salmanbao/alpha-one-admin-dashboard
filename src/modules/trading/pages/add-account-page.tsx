"use client";

/**
 * Add Account Page (spec §14, §15, §23)
 *
 * Guided 5-step workflow to create a new trader account:
 *
 *   1. User info        — email, full name (required)
 *   2. Challenge/Phase  — challenge type + phase dropdowns (smart-linked)
 *   3. Account config   — profit split, payout frequency, initial balance, broker
 *   4. KYC status       — initial KYC state + document type
 *   5. Review           — summary + Create Account
 *
 * Each step has a clear primary action (Next / Create). Required fields
 * carry a red asterisk (spec §25). After Create, we navigate to the
 * accounts list (trading-accounts view).
 *
 * Smart linkage: changing the challenge type filters the phase dropdown
 * to the phases of that type (getChallengePhaseConfigs).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getChallengeTypes,
  getChallengePhaseConfigs,
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
  User,
  Target,
  Settings2,
  FileCheck,
  ScrollText,
  Check,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "user", label: "User", icon: User },
  { id: "challenge", label: "Challenge", icon: Target },
  { id: "account", label: "Account", icon: Settings2 },
  { id: "kyc", label: "KYC", icon: FileCheck },
  { id: "review", label: "Review", icon: ScrollText },
];

const PAYOUT_FREQUENCIES = [
  { id: "weekly", label: "Weekly" },
  { id: "bi-weekly", label: "Bi-weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

const BROKER_TYPES = [
  { id: "mt5", label: "MetaTrader 5" },
  { id: "dxtrade", label: "DXTrade" },
] as const;

const KYC_STATUSES = [
  { id: "pending", label: "Pending verification" },
  { id: "skip", label: "Skip KYC (collect later)" },
] as const;

const DOCUMENT_TYPES = [
  { id: "passport", label: "Passport" },
  { id: "drivers-license", label: "Driver's License" },
  { id: "national-id", label: "National ID" },
  { id: "residence-permit", label: "Residence Permit" },
] as const;

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

interface AddAccountState {
  email: string;
  fullName: string;
  challengeTypeId: string;
  phaseConfigId: string;
  profitSplitPct: string;
  payoutFrequency: (typeof PAYOUT_FREQUENCIES)[number]["id"];
  initialBalance: string;
  brokerType: (typeof BROKER_TYPES)[number]["id"];
  kycStatus: (typeof KYC_STATUSES)[number]["id"];
  documentType: string;
}

const INITIAL_STATE: AddAccountState = {
  email: "",
  fullName: "",
  challengeTypeId: "",
  phaseConfigId: "",
  profitSplitPct: "80",
  payoutFrequency: "bi-weekly",
  initialBalance: "",
  brokerType: "mt5",
  kycStatus: "pending",
  documentType: "passport",
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function AddAccountPage() {
  const { navigate } = usePlatform();
  const [state, setState] = useState<AddAccountState>(INITIAL_STATE);
  const [step, setStep] = useState(0);

  const challengeTypes = getChallengeTypes();
  const phases = useMemo(
    () => (state.challengeTypeId ? getChallengePhaseConfigs(state.challengeTypeId) : []),
    [state.challengeTypeId],
  );

  const update = <K extends keyof AddAccountState>(field: K, value: AddAccountState[K]) =>
    setState((s) => ({ ...s, [field]: value }));

  /* ---- Validation per step ---- */
  const stepValid = (i: number): boolean => {
    switch (i) {
      case 0:
        return (
          state.email.trim().length > 0 &&
          state.email.includes("@") &&
          state.fullName.trim().length > 0
        );
      case 1:
        return state.challengeTypeId !== "" && state.phaseConfigId !== "";
      case 2:
        return (
          Number(state.profitSplitPct) >= 0 &&
          Number(state.profitSplitPct) <= 100 &&
          Number(state.initialBalance) > 0
        );
      case 3:
        return state.kycStatus === "skip" || state.documentType !== "";
      case 4:
        return true;
      default:
        return false;
    }
  };

  const canNext = stepValid(step) && step < STEPS.length - 1;
  const canBack = step > 0;
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const createAccount = () => {
    toast({
      title: "Account created successfully",
      description: `${state.fullName}’s ${challengeTypes.find((t) => t.id === state.challengeTypeId)?.name ?? "challenge"} account is ready.`,
    });
    setState(INITIAL_STATE);
    setStep(0);
    navigate("trading-accounts");
  };

  /* ---- Step content ---- */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <UserInfoStep state={state} update={update} />
        );
      case 1:
        return (
          <ChallengePhaseStep
            state={state}
            update={update}
            challengeTypes={challengeTypes}
            phases={phases}
          />
        );
      case 2:
        return <AccountConfigStep state={state} update={update} />;
      case 3:
        return <KycStep state={state} update={update} />;
      case 4:
        return (
          <ReviewStep
            state={state}
            challengeTypes={challengeTypes}
            phases={phases}
            onCreate={createAccount}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      <PageHeader
        title="Add Account"
        description="Create a new trader account with associated challenge and KYC."
        icon={UserPlus}
      />
      <PageContent>
        {/* Step indicator */}
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
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-lg border bg-card p-4 md:p-6">
          <div className="min-h-[280px]">{renderStep()}</div>

          <Separator className="my-4" />

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
              <Button size="sm" onClick={createAccount} className="gap-1.5">
                <Check className="h-4 w-4" /> Create Account
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

const REQUIRED_ASTERISK = <span className="text-rose-500" aria-hidden>*</span>;

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground">
      {children} {REQUIRED_ASTERISK}
    </Label>
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

function NativeSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-[box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — User info                                                 */
/* ------------------------------------------------------------------ */

function UserInfoStep({
  state,
  update,
}: {
  state: AddAccountState;
  update: <K extends keyof AddAccountState>(field: K, value: AddAccountState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">User Information</h3>
        <p className="text-xs text-muted-foreground">
          Identify the trader who will own this account.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Email</RequiredLabel>
          <Input
            type="email"
            value={state.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="trader@example.com"
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Full name</RequiredLabel>
          <Input
            type="text"
            value={state.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A welcome email will be sent automatically once the account is created.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Challenge / Phase                                         */
/* ------------------------------------------------------------------ */

function ChallengePhaseStep({
  state,
  update,
  challengeTypes,
  phases,
}: {
  state: AddAccountState;
  update: <K extends keyof AddAccountState>(field: K, value: AddAccountState[K]) => void;
  challengeTypes: ReturnType<typeof getChallengeTypes>;
  phases: ReturnType<typeof getChallengePhaseConfigs>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Challenge &amp; Phase</h3>
        <p className="text-xs text-muted-foreground">
          Pick the challenge type and the specific phase this account starts at.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Challenge type</RequiredLabel>
          <NativeSelect
            value={state.challengeTypeId}
            onChange={(v) => {
              update("challengeTypeId", v);
              update("phaseConfigId", "");
            }}
            placeholder="Select challenge type…"
            options={challengeTypes.map((t) => ({ id: t.id, label: `${t.name} (${t.phases} phase${t.phases !== 1 ? "s" : ""})` }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Phase</RequiredLabel>
          <NativeSelect
            value={state.phaseConfigId}
            onChange={(v) => update("phaseConfigId", v)}
            placeholder={state.challengeTypeId ? "Select phase…" : "Pick a challenge type first"}
            disabled={!state.challengeTypeId}
            options={phases.map((p) => ({
              id: p.id,
              label: `${p.phaseName}${p.isFunded ? " (Funded)" : ""} — ${p.accountSize.toLocaleString()} USD`,
            }))}
          />
        </div>
      </div>
      {state.phaseConfigId ? (
        <PhaseSummaryCard
          phase={phases.find((p) => p.id === state.phaseConfigId) ?? null}
        />
      ) : null}
    </div>
  );
}

function PhaseSummaryCard({ phase }: { phase: ReturnType<typeof getChallengePhaseConfigs>[number] | null }) {
  if (!phase) return null;
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Phase defaults
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] text-muted-foreground">Account size</dt>
          <dd className="text-xs font-medium text-foreground">${phase.accountSize.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Profit target</dt>
          <dd className="text-xs font-medium text-foreground">{phase.profitTargetPct}%</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Max drawdown</dt>
          <dd className="text-xs font-medium text-foreground">{phase.maxDrawdownPct}%</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Daily drawdown</dt>
          <dd className="text-xs font-medium text-foreground">{phase.dailyDrawdownPct}%</dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Account config                                           */
/* ------------------------------------------------------------------ */

function AccountConfigStep({
  state,
  update,
}: {
  state: AddAccountState;
  update: <K extends keyof AddAccountState>(field: K, value: AddAccountState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Account Configuration</h3>
        <p className="text-xs text-muted-foreground">
          Financial and broker setup for this account.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Profit split (trader share %)</RequiredLabel>
          <Input
            type="number"
            value={state.profitSplitPct}
            onChange={(e) => update("profitSplitPct", e.target.value)}
            placeholder="80"
            min={0}
            max={100}
          />
          <p className="text-[10px] text-muted-foreground/80">
            Trader keeps {state.profitSplitPct || 0}%; firm receives {100 - (Number(state.profitSplitPct) || 0)}%.
          </p>
        </div>
        <FieldRow label="Payout frequency">
          <NativeSelect
            value={state.payoutFrequency}
            onChange={(v) => update("payoutFrequency", v as AddAccountState["payoutFrequency"])}
            options={[...PAYOUT_FREQUENCIES]}
          />
        </FieldRow>
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Initial balance (USD)</RequiredLabel>
          <Input
            type="number"
            value={state.initialBalance}
            onChange={(e) => update("initialBalance", e.target.value)}
            placeholder="10000"
            min={0}
          />
        </div>
        <FieldRow label="Broker type">
          <NativeSelect
            value={state.brokerType}
            onChange={(v) => update("brokerType", v as AddAccountState["brokerType"])}
            options={[...BROKER_TYPES]}
          />
        </FieldRow>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — KYC status                                               */
/* ------------------------------------------------------------------ */

function KycStep({
  state,
  update,
}: {
  state: AddAccountState;
  update: <K extends keyof AddAccountState>(field: K, value: AddAccountState[K]) => void;
}) {
  const skip = state.kycStatus === "skip";
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">KYC Status</h3>
        <p className="text-xs text-muted-foreground">
          Initial KYC state for this account. You can collect documents later.
        </p>
      </div>
      <FieldRow label="Initial KYC status">
        <NativeSelect
          value={state.kycStatus}
          onChange={(v) => update("kycStatus", v as AddAccountState["kycStatus"])}
          options={[...KYC_STATUSES]}
        />
      </FieldRow>
      {!skip ? (
        <div className="flex flex-col gap-1.5">
          <RequiredLabel>Document type</RequiredLabel>
          <NativeSelect
            value={state.documentType}
            onChange={(v) => update("documentType", v)}
            options={[...DOCUMENT_TYPES]}
          />
          <p className="text-[10px] text-muted-foreground/80">
            Trader must submit a valid {DOCUMENT_TYPES.find((d) => d.id === state.documentType)?.label ?? "document"}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-center">
          <p className="text-xs font-medium text-foreground">KYC skipped</p>
          <p className="text-[11px] text-muted-foreground">
            The trader will be prompted to complete KYC before their first payout.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Review                                                    */
/* ------------------------------------------------------------------ */

function ReviewStep({
  state,
  challengeTypes,
  phases,
  onCreate,
}: {
  state: AddAccountState;
  challengeTypes: ReturnType<typeof getChallengeTypes>;
  phases: ReturnType<typeof getChallengePhaseConfigs>;
  onCreate: () => void;
}) {
  const challenge = challengeTypes.find((t) => t.id === state.challengeTypeId);
  const phase = phases.find((p) => p.id === state.phaseConfigId);
  const brokerLabel = BROKER_TYPES.find((b) => b.id === state.brokerType)?.label ?? "—";
  const freqLabel = PAYOUT_FREQUENCIES.find((f) => f.id === state.payoutFrequency)?.label ?? "—";
  const docLabel = DOCUMENT_TYPES.find((d) => d.id === state.documentType)?.label ?? "—";

  const summary: { label: string; value: string }[] = [
    { label: "Email", value: state.email || "—" },
    { label: "Full name", value: state.fullName || "—" },
    { label: "Challenge type", value: challenge?.name ?? "—" },
    { label: "Phase", value: phase?.phaseName ?? "—" },
    { label: "Account size", value: phase ? `$${phase.accountSize.toLocaleString()}` : state.initialBalance ? `$${Number(state.initialBalance).toLocaleString()}` : "—" },
    { label: "Profit split (trader)", value: `${state.profitSplitPct || 0}%` },
    { label: "Payout frequency", value: freqLabel },
    { label: "Initial balance", value: state.initialBalance ? `$${Number(state.initialBalance).toLocaleString()}` : "—" },
    { label: "Broker type", value: brokerLabel },
    { label: "KYC status", value: state.kycStatus === "skip" ? "Skipped" : "Pending" },
    { label: "Document type", value: state.kycStatus === "skip" ? "—" : docLabel },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Review &amp; Create</h3>
        <p className="text-xs text-muted-foreground">
          Confirm the configuration below, then create the account.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account summary
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {summary.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="truncate text-xs font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {challenge ? `${challenge.name}` : "Custom"}
          </Badge>
          <p className="text-xs text-foreground">
            After creation, the account will be available in the Accounts list.
          </p>
        </div>
        <Button size="sm" onClick={onCreate} className="gap-1.5">
          <Check className="h-4 w-4" /> Create Account
        </Button>
      </div>
    </div>
  );
}
