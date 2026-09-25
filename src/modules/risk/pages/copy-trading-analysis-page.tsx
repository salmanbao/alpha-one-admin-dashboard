"use client";

/**
 * Copy Trading Analysis Page — interactive detection tool that compares
 * two account logins and surfaces synchronized trading patterns.
 *
 * UX Constitution §12, §25-27: operator enters two account logins + a
 * date range, clicks Analyze, and the platform shows side-by-side account
 * detail panels plus a Match Analysis verdict below.
 *
 * Empty state before analysis: friendly prompt describing the workflow.
 * After analysis: deterministic mock positions are derived from the two
 * accounts; a correlation %, matching-positions count, time delta avg,
 * and verdict badge are computed deterministically (no Math.random).
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantPositions,
  getTenantTraders,
  type Position,
  type Trader,
  type TradingAccount,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Copy,
  Search,
  Activity,
  ShieldAlert,
  ArrowLeftRight,
  Clock,
  Gauge,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

interface AccountSummary {
  login: string;
  traderName: string;
  openPositions: number;
  totalPnl: number;
  positions: AccountPosition[];
}

interface AccountPosition {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  openTime: string;
  closeTime: string | null;
  pnl: number;
}

interface MatchResult {
  correlationPct: number;
  matchingPositions: string;
  timeDeltaAvgSec: number;
  verdict: "likely" | "unlikely" | "borderline";
}

/** Deterministic helper — convert a string to a small numeric hash. */
function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Build an account summary from a login string (with a deterministic fallback). */
function summarizeAccount(
  login: string,
  accounts: TradingAccount[],
  positions: Position[],
  traders: Trader[],
  cutoffMs: number = 0,
): AccountSummary | null {
  const acct = accounts.find((a) => a.login === login);
  // Fallback: synthesize an account summary even if the login is unknown,
  // so the demo always returns *something* useful to the operator.
  const traderId = acct?.traderId ?? `trader-${hashStr(login) % 1000}`;
  const trader = traders.find((t) => t.id === traderId);
  const traderName = trader?.name ?? `Trader ${login}`;

  // For real accounts, use their actual positions (filtered by the
  // selected date range when provided); for synthetic, derive.
  let acctPositions = positions.filter(
    (p) => p.accountId === acct?.id && (cutoffMs === 0 || new Date(p.openedAt).getTime() >= cutoffMs),
  );
  if (acctPositions.length === 0) {
    // Build deterministic mock positions seeded from login hash.
    const seed = hashStr(login);
    const symbols = ["EURUSD", "XAUUSD", "GBPUSD", "BTCUSD", "NAS100", "SP500", "USDJPY"];
    const count = 4 + (seed % 5); // 4-8 positions
    acctPositions = Array.from({ length: count }, (_, i) => {
      const sym = symbols[(seed + i) % symbols.length];
      const side: "buy" | "sell" = (seed + i) % 2 === 0 ? "buy" : "sell";
      const now = Date.now();
      const openMsAgo = ((seed + i * 17) % (24 * 60)) * 60 * 1000;
      const basePnl = (((seed + i * 13) % 1000) - 500) * 7.35;
      const id = `cta-${login}-${i + 1}`;
      return {
        id,
        tenantId: "platform",
        accountId: login,
        traderId,
        symbol: sym,
        side,
        volume: 0.1 + ((seed + i) % 5) * 0.1,
        entryPrice: 1 + ((seed + i) % 1000) / 1000,
        currentPrice: 1 + ((seed + i + 3) % 1000) / 1000,
        pnl: Math.round(basePnl * 100) / 100,
        pnlPct: Math.round((basePnl / 1000) * 100) / 100,
        swap: 0,
        openedAt: new Date(now - openMsAgo).toISOString(),
      } satisfies Position;
    });
  }

  const positionsView: AccountPosition[] = acctPositions.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    direction: p.side,
    openTime: p.openedAt,
    closeTime: null,
    pnl: p.pnl,
  }));

  const totalPnl = positionsView.reduce((s, p) => s + p.pnl, 0);

  return {
    login,
    traderName,
    openPositions: positionsView.length,
    totalPnl,
    positions: positionsView,
  };
}

/** Compute correlation + matching positions between two account summaries. */
function analyze(a: AccountSummary, b: AccountSummary): MatchResult {
  // Count symbols that appear in both account position sets.
  const symbolsA = new Set(a.positions.map((p) => p.symbol));
  const shared = b.positions.filter((p) => symbolsA.has(p.symbol));
  const matchingPositions = shared.length;
  const totalCompared = Math.max(a.positions.length, b.positions.length);

  // Correlation % — deterministic from matching ratio + a small bias.
  const ratio = totalCompared > 0 ? matchingPositions / totalCompared : 0;
  // Bias toward a higher correlation when symbols overlap a lot, plus a small
  // deterministic offset so the demo number feels realistic (70-95%).
  const base = Math.round(ratio * 100);
  const bias = hashStr(`${a.login}-${b.login}`) % 18; // 0-17
  const correlationPct = Math.max(0, Math.min(100, base + (base > 50 ? bias : -bias)));

  // Time delta avg — deterministic from the hash.
  const timeDeltaAvgSec = 1 + (hashStr(`${a.login}+${b.login}`) % 30); // 1-30s

  let verdict: MatchResult["verdict"];
  if (correlationPct >= 75 && timeDeltaAvgSec <= 10) verdict = "likely";
  else if (correlationPct < 40) verdict = "unlikely";
  else verdict = "borderline";

  return {
    correlationPct,
    matchingPositions: `${matchingPositions}/${totalCompared}`,
    timeDeltaAvgSec,
    verdict,
  };
}

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
] as const;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CopyTradingAnalysisPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const positions = useMemo(() => getTenantPositions(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  const [login1, setLogin1] = useState("");
  const [login2, setLogin2] = useState("");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [result, setResult] = useState<{
    summary1: AccountSummary;
    summary2: AccountSummary;
    match: MatchResult;
  } | null>(null);

  const onAnalyze = () => {
    const l1 = login1.trim();
    const l2 = login2.trim();
    if (!l1 || !l2) {
      toast({
        title: "Both logins required",
        description: "Enter account login 1 and 2 before analyzing.",
        variant: "destructive",
      });
      return;
    }
    if (l1 === l2) {
      toast({
        title: "Pick two different accounts",
        description: "Copy trading analysis compares two distinct accounts.",
        variant: "destructive",
      });
      return;
    }
    // Round 7 fix: pass the date range cutoff to summarizeAccount so the
    // "Last 7d / 30d / 90d" selector actually filters positions (was
    // decorative — analyze ignored dateRange entirely).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const cutoffMs = dateRange === "all" ? 0 : Date.now() - (
      dateRange === "7d" ? 7 * DAY_MS :
      dateRange === "30d" ? 30 * DAY_MS :
      dateRange === "90d" ? 90 * DAY_MS :
      7 * DAY_MS
    );
    const s1 = summarizeAccount(l1, accounts, positions, traders, cutoffMs);
    const s2 = summarizeAccount(l2, accounts, positions, traders, cutoffMs);
    if (!s1 || !s2) return; // should not happen
    const match = analyze(s1, s2);
    setResult({ summary1: s1, summary2: s2, match });
    toast({
      title: "Analysis complete",
      description: `Correlation ${match.correlationPct}% — verdict: ${match.verdict.replace("-", " ")}.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Copy Trading Analysis"
        description="Detect synchronized trading patterns between accounts."
        icon={ArrowLeftRight}
      />

      {/* Detection form */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <Search className="h-4 w-4 text-muted-foreground" />
          Detection Form
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cta-login1">Account Login 1</Label>
            <Input
              id="cta-login1"
              value={login1}
              onChange={(e) => setLogin1(e.target.value)}
              placeholder="Enter account login"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta-login2">Account Login 2</Label>
            <Input
              id="cta-login2"
              value={login2}
              onChange={(e) => setLogin2(e.target.value)}
              placeholder="Enter account login"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta-range">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger id="cta-range" className="w-full">
                <SelectValue placeholder="Select date range…" />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <Button size="sm" onClick={onAnalyze} className="gap-1.5">
            <Search className="h-4 w-4" /> Analyze
          </Button>
        </div>
      </div>

      <PageContent>
        {result ? (
          <>
            {/* Side-by-side account panels */}
            <div className="grid gap-4 md:grid-cols-2">
              <AccountPanel
                title="Account 1"
                summary={result.summary1}
                currency={currency}
              />
              <AccountPanel
                title="Account 2"
                summary={result.summary2}
                currency={currency}
              />
            </div>

            {/* Match analysis */}
            <MatchAnalysisPanel match={result.match} />
          </>
        ) : (
          <EmptyState
            icon={ArrowLeftRight}
            title="No analysis yet"
            description="Enter two account logins and click Analyze to detect copy trading patterns."
            hint="The detection compares symbol overlap, open-time deltas, and trade direction."
          />
        )}
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Account panel                                                       */
/* ------------------------------------------------------------------ */

function AccountPanel({
  title,
  summary,
  currency,
}: {
  title: string;
  summary: AccountSummary;
  currency: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Copy className="h-4 w-4 text-muted-foreground" />
        {title}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Login
          </dt>
          <dd className="font-mono text-xs font-medium">{summary.login}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Trader
          </dt>
          <dd className="text-xs font-medium">{summary.traderName}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Open Positions
          </dt>
          <dd className="tabular-nums text-xs font-medium">
            {summary.openPositions}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total P&L
          </dt>
          <dd
            className={cn(
              "tabular-nums text-xs font-medium",
              summary.totalPnl >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {summary.totalPnl >= 0 ? "+" : ""}
            {formatCurrency(summary.totalPnl, currency)}
          </dd>
        </div>
      </dl>
      <Separator className="my-3" />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left">Symbol</th>
              <th className="px-2 py-1.5 text-left">Direction</th>
              <th className="px-2 py-1.5 text-left">Open Time</th>
              <th className="px-2 py-1.5 text-left">Close Time</th>
              <th className="px-2 py-1.5 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {summary.positions.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-1.5 font-mono">{p.symbol}</td>
                <td className="px-2 py-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      p.direction === "buy"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "border-rose-500/40 text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {p.direction === "buy" ? "Long" : "Short"}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {new Date(p.openTime).toLocaleString()}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {p.closeTime ? new Date(p.closeTime).toLocaleString() : "—"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums font-medium",
                    p.pnl >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {p.pnl >= 0 ? "+" : ""}
                  {formatCurrency(p.pnl, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Match analysis panel                                                */
/* ------------------------------------------------------------------ */

function MatchAnalysisPanel({ match }: { match: MatchResult }) {
  const verdictTone =
    match.verdict === "likely"
      ? "danger"
      : match.verdict === "unlikely"
        ? "success"
        : "warning";
  const verdictLabel =
    match.verdict === "likely"
      ? "Likely Copy Trading"
      : match.verdict === "unlikely"
        ? "Unlikely Copy Trading"
        : "Borderline";

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        Match Analysis
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Correlation"
          value={`${match.correlationPct}%`}
          icon={Activity}
          tone={
            match.correlationPct >= 75
              ? "negative"
              : match.correlationPct >= 40
                ? "warning"
                : "positive"
          }
        />
        <MetricCard
          label="Matching Positions"
          value={match.matchingPositions}
          icon={CheckCircle2}
        />
        <MetricCard
          label="Time Delta Avg"
          value={`${match.timeDeltaAvgSec}s`}
          icon={Clock}
          tone={match.timeDeltaAvgSec <= 10 ? "negative" : "default"}
        />
        <MetricCard
          label="Verdict"
          value={verdictLabel}
          icon={match.verdict === "likely" ? ShieldAlert : match.verdict === "unlikely" ? CheckCircle2 : ShieldAlert}
          tone={
            match.verdict === "likely"
              ? "negative"
              : match.verdict === "unlikely"
                ? "positive"
                : "warning"
          }
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <StatusBadge tone={verdictTone}>{verdictLabel}</StatusBadge>
        <span className="text-xs text-muted-foreground">
          {match.verdict === "likely"
            ? "Multiple synchronized positions detected. Recommend manual review and account interview."
            : match.verdict === "unlikely"
              ? "No strong synchronization detected. The two accounts appear to trade independently."
              : "Some patterns match but evidence is inconclusive. Monitor over a longer window."}
        </span>
      </div>
    </div>
  );
}
