"use client";

/**
 * Live Rule Changes — finding #7d: rule configuration existed only in the
 * standalone risk-rules editor; CRM operators had no direct control over
 * account rules. This page gives per-account control of the four rules
 * traders feel most — daily loss %, max drawdown %, profit target % and
 * minimum trading days — with an apply step, validation, and a change log
 * so every live adjustment is attributable.
 *
 * Defaults come from the account's linked challenge phase config
 * (challengePhaseConfigs); applying stores a per-account override on top.
 * Tenant-wide thresholds stay in the Risk Rules Editor (linked from the
 * header) — this screen never silently changes other accounts.
 *
 * Deterministic: fixed fixtures, no Math.random.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import {
  getTenantAccounts,
  challengePhaseConfigs,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  SlidersHorizontal,
  ShieldCheck,
  History,
  ArrowRight,
  Save,
  RotateCcw,
  Undo2,
  AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

interface RuleValues {
  dailyLoss: string;
  maxDd: string;
  profitTarget: string;
  minDays: string;
}

interface LogEntry {
  at: string;
  actor: string;
  account: string;
  changes: string[];
}

const FIELD_LABELS: Record<keyof RuleValues, string> = {
  dailyLoss: "Daily loss",
  maxDd: "Max drawdown",
  profitTarget: "Profit target",
  minDays: "Min trading days",
};

const FIELD_UNITS: Record<keyof RuleValues, string> = {
  dailyLoss: "%",
  maxDd: "%",
  profitTarget: "%",
  minDays: "d",
};

/** Baseline rules for an account — its linked phase config, or the
 *  tenant standard when the seed predates phase linking. */
function baselineFor(account: TradingAccount): RuleValues {
  const pc = account.phaseConfigId
    ? challengePhaseConfigs.find((c) => c.id === account.phaseConfigId)
    : undefined;
  return {
    dailyLoss: String(pc?.dailyDrawdownPct ?? 5),
    maxDd: String(pc?.maxDrawdownPct ?? 10),
    profitTarget: String(pc?.profitTargetPct ?? 8),
    minDays: String(pc?.minTradingDays ?? 3),
  };
}

/** Per-field bounds — applied before anything is committed. */
function validate(next: RuleValues): string | null {
  const daily = Number(next.dailyLoss);
  const dd = Number(next.maxDd);
  const target = Number(next.profitTarget);
  const days = Number(next.minDays);
  if (!Number.isFinite(daily) || daily < 0.1 || daily > 20)
    return "Daily loss must be between 0.1% and 20%.";
  if (!Number.isFinite(dd) || dd < 1 || dd > 50)
    return "Max drawdown must be between 1% and 50%.";
  if (!Number.isFinite(target) || target < 0 || target > 100)
    return "Profit target must be between 0% and 100%.";
  if (!Number.isFinite(days) || days < 0 || days > 60 || !Number.isInteger(days))
    return "Minimum trading days must be a whole number from 0 to 60.";
  return null;
}

function stamp(): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CrmLiveRulesPage() {
  const { runtime, tenant, user, navigate } = usePlatform();
  const makeTerm = makeTermResolver(tenant);
  const accounts = useMemo(() => getTenantAccounts(tenant.id), [tenant.id]);

  // Per-account overrides applied on top of the phase-config baseline.
  const [applied, setApplied] = useState<Record<string, RuleValues>>({});
  // Unsaved edits (full merged draft per account, only while dirty).
  const [drafts, setDrafts] = useState<Record<string, RuleValues>>({});
  // Change log — two seeded entries derived from the fixture roster plus
  // everything applied in this session.
  const [log, setLog] = useState<LogEntry[]>(() => {
    const [a, b] = accounts;
    const seed: LogEntry[] = [];
    if (a) {
      seed.push({
        at: "Nov 05, 2026 16:12",
        actor: "Dana Whitfield",
        account: `${a.login} · ${a.traderName}`,
        changes: ["Daily loss 6% → 5%"],
      });
    }
    if (b) {
      seed.push({
        at: "Nov 04, 2026 10:41",
        actor: "Marcus Reed",
        account: `${b.login} · ${b.traderName}`,
        changes: ["Min days 2 → 3", "Max DD 12% → 10%"],
      });
    }
    return seed;
  });

  const effective = (acc: TradingAccount): RuleValues =>
    drafts[acc.id] ?? applied[acc.id] ?? baselineFor(acc);

  const isDirty = (acc: TradingAccount): boolean => {
    const draft = drafts[acc.id];
    if (!draft) return false;
    const base = applied[acc.id] ?? baselineFor(acc);
    return (Object.keys(base) as (keyof RuleValues)[]).some(
      (k) => draft[k] !== base[k],
    );
  };

  const edit = (acc: TradingAccount, key: keyof RuleValues, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [acc.id]: { ...(prev[acc.id] ?? applied[acc.id] ?? baselineFor(acc)), [key]: value },
    }));
  };

  const discard = (acc: TradingAccount) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[acc.id];
      return next;
    });
  };

  const revert = (acc: TradingAccount) => {
    discard(acc);
    setApplied((prev) => {
      const next = { ...prev };
      delete next[acc.id];
      return next;
    });
    toast({
      title: "Reverted to baseline (demo)",
      description: `${acc.traderName} is back on the ${acc.phaseConfigId ? "phase-config" : "tenant standard"} rules.`,
    });
  };

  const apply = (acc: TradingAccount) => {
    const draft = drafts[acc.id];
    if (!draft) return;
    const problem = validate(draft);
    if (problem) {
      toast({ variant: "destructive", title: "Invalid rule values", description: problem });
      return;
    }
    const base = applied[acc.id] ?? baselineFor(acc);
    const changes = (Object.keys(base) as (keyof RuleValues)[])
      .filter((k) => draft[k] !== base[k])
      .map(
        (k) =>
          `${FIELD_LABELS[k]} ${base[k]}${FIELD_UNITS[k]} → ${draft[k]}${FIELD_UNITS[k]}`,
      );
    if (changes.length === 0) {
      discard(acc);
      return;
    }
    setApplied((prev) => ({ ...prev, [acc.id]: draft }));
    discard(acc);
    setLog((prev) => [
      {
        at: stamp(),
        actor: user?.name ?? "You",
        account: `${acc.login} · ${acc.traderName}`,
        changes,
      },
      ...prev,
    ]);
    toast({
      title: "Rule changes applied (demo)",
      description: `${acc.traderName}: ${changes.join(" · ")}`,
    });
  };

  const overrideCount = Object.keys(applied).length;
  const dirtyCount = accounts.filter(isDirty).length;

  const columns: Column<TradingAccount>[] = [
    {
      key: "account",
      header: "Account",
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{a.traderName}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {a.login} · {a.platform} · {a.phase.replace("-", " ")}
          </p>
        </div>
      ),
      sortValue: (a) => a.traderName,
    },
    ...(["dailyLoss", "maxDd", "profitTarget", "minDays"] as const).map(
      (key): Column<TradingAccount> => ({
        key,
        header:
          key === "maxDd"
            ? "Max DD"
            : key === "minDays"
              ? "Min days"
              : FIELD_LABELS[key],
        numeric: true,
        width: key === "minDays" ? "96px" : "104px",
        cell: (a) => (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              inputMode="decimal"
              step={key === "minDays" ? 1 : 0.5}
              min={0}
              value={effective(a)[key]}
              onChange={(e) => edit(a, key, e.target.value)}
              aria-label={`${FIELD_LABELS[key]} for ${a.traderName}`}
              className="h-8 w-16 px-2 text-right text-sm tabular-nums"
            />
            <span className="w-3 text-xs text-muted-foreground">
              {FIELD_UNITS[key]}
            </span>
          </div>
        ),
        sortValue: (a) => Number(effective(a)[key]) || 0,
      }),
    ),
    {
      key: "state",
      header: "State",
      cell: (a) =>
        isDirty(a) ? (
          <Badge variant="outline" className="border-amber-500/60 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="mr-1 h-3 w-3" /> Unsaved
          </Badge>
        ) : applied[a.id] ? (
          <StatusBadge tone="info">Override</StatusBadge>
        ) : (
          <StatusBadge tone="muted">Baseline</StatusBadge>
        ),
      width: "120px",
    },
    {
      key: "actions",
      header: "",
      width: "150px",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          {applied[a.id] && !isDirty(a) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => revert(a)}
              title="Revert this account to its baseline rules"
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Revert
            </Button>
          )}
          {isDirty(a) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => discard(a)}
                aria-label={`Discard unsaved rule edits for ${a.traderName}`}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" className="h-8 px-2.5 text-xs" onClick={() => apply(a)}>
                <Save className="mr-1 h-3.5 w-3.5" /> Apply
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Live Rule Changes"
        description={`Per-${makeTerm("account").toLowerCase()} rule control from the CRM — daily loss, drawdown, profit target and minimum days, applied live with a full change log.`}
        icon={SlidersHorizontal}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("risk-rules-editor")}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Tenant-wide Rules Editor
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Accounts Monitored" value={String(accounts.length)} icon={SlidersHorizontal} />
          <MetricCard
            label="Active Overrides"
            value={String(overrideCount)}
            delta={overrideCount}
            icon={ShieldCheck}
            tone={overrideCount > 0 ? "positive" : undefined}
          />
          <MetricCard
            label="Unsaved Edits"
            value={String(dirtyCount)}
            icon={AlertTriangle}
            tone={dirtyCount > 0 ? "negative" : undefined}
          />
          <MetricCard label="Changes Logged" value={String(log.length)} icon={History} />
        </div>

        {/* Rule editor */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">Account Rules</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit a value, review the Unsaved badge, then Apply — only that account
                changes. Bounds: daily loss 0.1–20% · max DD 1–50% · target 0–100% ·
                days 0–60.
              </p>
            </div>
            {dirtyCount > 0 && (
              <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
                {dirtyCount} row{dirtyCount === 1 ? "" : "s"} pending apply
              </Badge>
            )}
          </div>
          <DataTable
            columns={columns}
            data={accounts}
            rowKey={(a) => a.id}
            searchableText={(a) => `${a.traderName} ${a.login} ${a.platform} ${a.phase} ${a.type}`}
            searchPlaceholder="Search traders or logins…"
            pageSize={8}
            emptyTitle="No accounts in this tenant"
            emptyDescription="Accounts appear here once traders are enrolled in a challenge or funded program."
          />
        </div>

        {/* Change log */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-medium text-foreground">Change Log</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every applied change, who applied it, and the exact before → after values.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {log.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{entry.account}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {entry.changes.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                      >
                        {c}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{entry.actor}</p>
                  <p className="font-mono">{entry.at}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}
