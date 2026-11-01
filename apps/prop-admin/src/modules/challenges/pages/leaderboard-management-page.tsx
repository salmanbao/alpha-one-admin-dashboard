"use client";

/**
 * Leaderboard Management — audit finding #8 (MEDIUM).
 *
 * The trader leaderboard was display-only with no admin counterpart:
 * firms could not shape the competitive environment to their brand or
 * trading philosophy, and had no way to investigate anomalies. This
 * screen adds:
 *
 *  - Ranking criteria (primary metric, tie-breaker, minimum trades,
 *    eligibility exclusions for breached/inactive traders)
 *  - Period configuration (rolling window + refresh cadence)
 *  - Visibility settings (audience, country flags, anonymization)
 *  - Manual position adjustments (move traders up/down, hide entries)
 *  - Engagement analytics (views, ranked traders, retention lift)
 *
 * Everything is deterministic mock state — no backend writes; the
 * publish action toasts the resulting configuration.
 */

import { useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Medal,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trophy,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Configuration option models                                         */
/* ------------------------------------------------------------------ */

const metricOptions = [
  { id: "profit-pct", label: "Profit %" },
  { id: "profit-usd", label: "Profit $" },
  { id: "consistency", label: "Consistency score" },
] as const;
type MetricKey = (typeof metricOptions)[number]["id"];

const tieBreakerOptions = [
  { id: "trades", label: "More trades" },
  { id: "speed", label: "Faster to target" },
] as const;
type TieBreakerKey = (typeof tieBreakerOptions)[number]["id"];

const windowOptions = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "all-time", label: "All time" },
] as const;
type WindowKey = (typeof windowOptions)[number]["id"];

const cadenceOptions = [
  { id: "hourly", label: "Hourly" },
  { id: "daily", label: "Daily" },
  { id: "manual", label: "On demand" },
] as const;
type CadenceKey = (typeof cadenceOptions)[number]["id"];

const visibilityOptions = [
  { id: "public", label: "All traders" },
  { id: "funded", label: "Funded only" },
  { id: "hidden", label: "Hidden" },
] as const;
type VisibilityKey = (typeof visibilityOptions)[number]["id"];

/* ------------------------------------------------------------------ */
/* Seeded board + manual adjustments                                   */
/* ------------------------------------------------------------------ */

interface BoardTrader {
  id: string;
  name: string;
  gainPct: number;
  trades: number;
  breached: boolean;
  hidden: boolean;
}

const seedBoard: BoardTrader[] = [
  { id: "t-1", name: "Liam Smith", gainPct: 18.4, trades: 212, breached: false, hidden: false },
  { id: "t-2", name: "Emma Wilson", gainPct: 15.1, trades: 178, breached: false, hidden: false },
  { id: "t-3", name: "Noah Brown", gainPct: 12.6, trades: 64, breached: true, hidden: false },
  { id: "t-4", name: "Olivia Davis", gainPct: 11.9, trades: 96, breached: false, hidden: false },
  { id: "t-5", name: "James Taylor", gainPct: 9.7, trades: 142, breached: false, hidden: false },
];

/* ------------------------------------------------------------------ */
/* Small option-picker + toggle helpers                                */
/* ------------------------------------------------------------------ */

function OptionPicker<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={value === opt.id}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              value === opt.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md p-1">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary disabled:cursor-not-allowed"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LeaderboardManagementPage() {
  const { user } = usePlatform();
  const canManage = hasPermission(user, "challenge.update");

  // Ranking criteria
  const [metric, setMetric] = useState<MetricKey>("profit-pct");
  const [tieBreaker, setTieBreaker] = useState<TieBreakerKey>("trades");
  const [minTrades, setMinTrades] = useState(10);
  const [excludeBreached, setExcludeBreached] = useState(true);
  const [requireActive, setRequireActive] = useState(true);

  // Period & visibility
  const [window, setWindow] = useState<WindowKey>("this-month");
  const [cadence, setCadence] = useState<CadenceKey>("daily");
  const [visibility, setVisibility] = useState<VisibilityKey>("public");
  const [showCountry, setShowCountry] = useState(true);
  const [anonymize, setAnonymize] = useState(false);

  // Manual position adjustments (list order === published position)
  const [board, setBoard] = useState<BoardTrader[]>(seedBoard);

  const visibleBoard = board.filter((t) => !t.hidden && (!excludeBreached || !t.breached));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= board.length) return;
    const next = board.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBoard(next);
    toast({
      title: "Position adjusted",
      description: `${board[index].name} moved to #${target + 1} on the manual board.`,
    });
  };

  const toggleHidden = (trader: BoardTrader) => {
    setBoard((prev) =>
      prev.map((t) => (t.id === trader.id ? { ...t, hidden: !t.hidden } : t)),
    );
    toast({
      title: trader.hidden ? "Entry restored" : "Entry hidden",
      description: `${trader.name} is ${trader.hidden ? "visible" : "hidden"} on the leaderboard.`,
    });
  };

  const resetBoard = () => {
    setBoard(seedBoard);
    toast({ title: "Adjustments reset", description: "Manual positions restored to earned order." });
  };

  const publish = () => {
    const metricLabel = metricOptions.find((m) => m.id === metric)?.label ?? metric;
    const windowLabel = windowOptions.find((w) => w.id === window)?.label ?? window;
    const visibilityLabel = visibilityOptions.find((v) => v.id === visibility)?.label ?? visibility;
    toast({
      title: "Leaderboard settings published",
      description: `Ranked by ${metricLabel}, ${windowLabel.toLowerCase()} window, visible to: ${visibilityLabel.toLowerCase()} — refresh ${cadence === "manual" ? "on demand" : cadence}.`,
    });
  };

  const lockedTitle = canManage ? undefined : "Requires challenge.update";

  const columns: Column<BoardTrader>[] = [
    {
      key: "position",
      header: "Position",
      cell: (t) => (
        <span className="font-semibold tabular-nums">#{board.indexOf(t) + 1}</span>
      ),
      sortValue: (t) => board.indexOf(t),
    },
    {
      key: "trader",
      header: "Trader",
      cell: (t) => (
        <span className={t.hidden ? "text-muted-foreground line-through" : "font-medium"}>
          {t.name}
        </span>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "gain",
      header: "Gain",
      cell: (t) => <span className="tabular-nums">+{t.gainPct.toFixed(1)}%</span>,
      sortValue: (t) => t.gainPct,
      numeric: true,
    },
    {
      key: "trades",
      header: "Trades",
      cell: (t) => <span className="tabular-nums">{t.trades}</span>,
      sortValue: (t) => t.trades,
      numeric: true,
    },
    {
      key: "flags",
      header: "Flags",
      cell: (t) =>
        t.breached ? (
          <Badge variant="destructive">Rule breach</Badge>
        ) : (
          <Badge variant="outline">Clean</Badge>
        ),
      sortValue: (t) => (t.breached ? 0 : 1),
    },
    {
      key: "visibility",
      header: "Visibility",
      cell: (t) =>
        t.hidden ? (
          <Badge variant="secondary">Hidden</Badge>
        ) : (
          <Badge variant="default">Visible</Badge>
        ),
      sortValue: (t) => (t.hidden ? 1 : 0),
    },
    {
      key: "actions",
      header: "Adjust",
      cell: (t) => {
        const index = board.indexOf(t);
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Move up one position"
              aria-label={`Move ${t.name} up`}
              disabled={!canManage || index === 0}
              onClick={(e) => {
                e.stopPropagation();
                move(index, -1);
              }}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Move down one position"
              aria-label={`Move ${t.name} down`}
              disabled={!canManage || index === board.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                move(index, 1);
              }}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title={t.hidden ? "Restore to the board" : "Hide from the board"}
              aria-label={`${t.hidden ? "Restore" : "Hide"} ${t.name}`}
              disabled={!canManage}
              onClick={(e) => {
                e.stopPropagation();
                toggleHidden(t);
              }}
            >
              {t.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Leaderboard Management"
        description="Configure ranking criteria, periods, and visibility, investigate entries, and manually adjust positions — the controls behind the trader leaderboard."
        icon={Trophy}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={resetBoard} disabled={!canManage} title={lockedTitle}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset positions
            </Button>
            <Button size="sm" onClick={publish} disabled={!canManage} title={lockedTitle}>
              {canManage ? <Save className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}
              Publish settings
            </Button>
          </>
        }
      />
      <PageContent>
        {/* Engagement analytics — does the board drive retention? */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Board views (30d)"
            value="4,812"
            delta={12}
            deltaLabel="vs prior 30d"
            icon={BarChart3}
          />
          <MetricCard
            label="Ranked traders"
            value={visibleBoard.length}
            icon={Users}
            deltaLabel={excludeBreached ? "breached traders excluded" : "all traders included"}
          />
          <MetricCard
            label="Eligible traders"
            value={186}
            icon={Medal}
            deltaLabel={`${Math.round((visibleBoard.length / 186) * 100)}% currently on the board`}
          />
          <MetricCard
            label="Retention lift"
            value="+6.4%"
            delta={6.4}
            icon={Trophy}
            tone="positive"
            deltaLabel="board participants vs non-participants"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ranking criteria */}
          <Card>
            <CardHeader>
              <p className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> Ranking criteria
              </p>
              <p className="text-xs text-muted-foreground">
                What the board ranks on and who is eligible to appear.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <OptionPicker
                label="Primary metric"
                hint="The number traders are sorted by."
                options={metricOptions}
                value={metric}
                onChange={setMetric}
                disabled={!canManage}
              />
              <OptionPicker
                label="Tie-breaker"
                options={tieBreakerOptions}
                value={tieBreaker}
                onChange={setTieBreaker}
                disabled={!canManage}
              />
              <div>
                <label htmlFor="lb-min-trades" className="text-sm font-medium text-foreground">
                  Minimum trades to rank
                </label>
                <p className="text-xs text-muted-foreground">
                  Prevents one-lucky-trade entries from topping the board.
                </p>
                <input
                  id="lb-min-trades"
                  type="number"
                  min={0}
                  value={minTrades}
                  disabled={!canManage}
                  onChange={(e) => setMinTrades(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1.5 w-24 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <ToggleRow
                  label="Exclude traders with open rule breaches"
                  hint="Anomaly hygiene — breached accounts shouldn't appear until resolved."
                  checked={excludeBreached}
                  onChange={setExcludeBreached}
                  disabled={!canManage}
                />
                <ToggleRow
                  label="Require active funded/challenge accounts"
                  checked={requireActive}
                  onChange={setRequireActive}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>

          {/* Period & visibility */}
          <Card>
            <CardHeader>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4 text-primary" /> Period &amp; visibility
              </p>
              <p className="text-xs text-muted-foreground">
                The window traders compete in, how often it refreshes, and who can see it.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <OptionPicker
                label="Rolling window"
                options={windowOptions}
                value={window}
                onChange={setWindow}
                disabled={!canManage}
              />
              <OptionPicker
                label="Refresh cadence"
                options={cadenceOptions}
                value={cadence}
                onChange={setCadence}
                disabled={!canManage}
              />
              <OptionPicker
                label="Audience"
                hint="Who can view the leaderboard."
                options={visibilityOptions}
                value={visibility}
                onChange={setVisibility}
                disabled={!canManage}
              />
              <div className="space-y-1">
                <ToggleRow
                  label="Show country flags"
                  checked={showCountry}
                  onChange={setShowCountry}
                  disabled={!canManage}
                />
                <ToggleRow
                  label="Anonymize trader names"
                  hint="Show first name + last initial only (e.g. “Liam S.”)."
                  checked={anonymize}
                  onChange={setAnonymize}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manual adjustments */}
        <Card>
          <CardHeader>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" /> Manual position adjustments
            </p>
            <p className="text-xs text-muted-foreground">
              Overrides stick until reset — use for anomaly remediation (spoofing, copy rings),
              not routine ranking. Every change is toast-logged here and in the audit trail.
            </p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={board}
              rowKey={(t) => t.id}
              searchableText={(t) => `${t.name} ${t.breached ? "breached" : "clean"}`}
              searchPlaceholder="Search traders…"
              emptyTitle="No traders on the board"
              emptyDescription="Adjust the eligibility rules to widen the pool."
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
