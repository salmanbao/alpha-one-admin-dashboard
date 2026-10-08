"use client";

/**
 * Accounting — Profit & Loss Statement page.
 *
 * Spec sections §9 KPIs, §17-§19 state-first + explainability, §33 help,
 * §54-§55 terminology.
 *
 * Vertical income statement: Revenue → COGS → Gross Profit → OpEx →
 * Operating Profit → Other (Interest + Tax) → Net Profit. Each row
 * shows amount + % of revenue so finance managers can scan the
 * statement like a real P&L.
 *
 * Mock data is deterministic (Math.sin / Math.cos patterns, constants)
 * — no Math.random.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Percent, Download, FileDown } from "lucide-react";

/* ---------------------------------------------------------------- */
/* Mock data (deterministic — no Math.random)                       */
/* ---------------------------------------------------------------- */

const PL_DATA = {
  revenue: {
    challengeSales: 284_000,
    addonSales: 18_200,
    subscriptionRevenue: 24_500,
    otherIncome: 3_200,
  },
  cogs: {
    payoutsToTraders: 142_000,
    affiliateCommissions: 18_400,
    paymentFees: 4_200,
  },
  opex: {
    marketing: 12_400,
    personnel: 38_600,
    software: 4_200,
    kycServices: 2_100,
    officeAdmin: 1_800,
  },
  other: {
    interestExpense: 800,
    taxProvision: 8_400,
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TREND_12M = Array.from({ length: 12 }, (_, i) => ({
  label: MONTHS[i],
  revenue: Math.round(38_000 + Math.sin(i / 3) * 6_000 + i * 800),
  expenses: Math.round(22_000 + Math.cos(i / 3) * 3_500 + i * 400),
}));

const PERIODS = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

const EMERALD = "#059669";
const ROSE = "#e11d48";
const SLATE = "#475569";

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

interface PnLRow {
  label: string;
  amount: number;
  /** Optional help tooltip text (§33) */
  help?: string;
}

interface PnLSection {
  title: string;
  rows: PnLRow[];
  totalLabel: string;
  total: number;
  totalTone?: "emerald" | "rose" | "slate";
}

function pct(amount: number, base: number): string {
  if (!base) return "0.0%";
  return `${((amount / base) * 100).toFixed(1)}%`;
}

function fmtNum(v: number, currency: string): string {
  return formatCurrency(v, currency);
}

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */

export function AccountingPlPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";
  // The period selector drives a simple pro-rata scaling of the annual
  // P&L figures — previously it was purely decorative (changing the
  // dropdown changed nothing in the displayed numbers). Round 4 fix.
  const [period, setPeriod] = useState("this-year");
  const periodScale = period === "this-year" ? 1 : period === "this-quarter" ? 0.25 : period === "this-month" ? 1 / 12 : 1;

  // ----- Compute totals (deterministic — pure arithmetic) -----
  const totals = useMemo(() => {
    const revenue =
      (PL_DATA.revenue.challengeSales +
        PL_DATA.revenue.addonSales +
        PL_DATA.revenue.subscriptionRevenue +
        PL_DATA.revenue.otherIncome) * periodScale;
    const cogs =
      (PL_DATA.cogs.payoutsToTraders +
        PL_DATA.cogs.affiliateCommissions +
        PL_DATA.cogs.paymentFees) * periodScale;
    const grossProfit = revenue - cogs;
    const opex =
      (PL_DATA.opex.marketing +
        PL_DATA.opex.personnel +
        PL_DATA.opex.software +
        PL_DATA.opex.kycServices +
        PL_DATA.opex.officeAdmin) * periodScale;
    const operatingProfit = grossProfit - opex;
    const other = (PL_DATA.other.interestExpense + PL_DATA.other.taxProvision) * periodScale;
    const netProfit = operatingProfit - other;
    const margin = revenue ? (netProfit / revenue) * 100 : 0;
    return { revenue, cogs, grossProfit, opex, operatingProfit, other, netProfit, margin };
  }, [periodScale]);

  // ----- P&L sections (each is a list of rows + a total) -----
  // Row amounts are scaled by the same factor as the totals so the
  // displayed numbers stay internally consistent across periods.
  const sections: PnLSection[] = [
    {
      title: "Revenue",
      rows: [
        { label: `${term("challenge")} Sales`, amount: PL_DATA.revenue.challengeSales * periodScale, help: "One-time registration fees collected when traders buy a challenge." },
        { label: "Addon Sales", amount: PL_DATA.revenue.addonSales * periodScale, help: "Reset tokens, account resets, and other in-cart add-ons purchased with a challenge." },
        { label: "Subscription Revenue", amount: PL_DATA.revenue.subscriptionRevenue * periodScale, help: "Recurring monthly platform fees charged to funded traders." },
        { label: "Other Income", amount: PL_DATA.revenue.otherIncome * periodScale, help: "Interest on held balances, recovery of disputed charges, and miscellaneous income." },
      ],
      totalLabel: "Total Revenue",
      total: totals.revenue,
      totalTone: "slate",
    },
    {
      title: "Cost of Goods Sold (COGS)",
      rows: [
        { label: `${plural(term("payout"))} to ${plural(term("account"))}`, amount: PL_DATA.cogs.payoutsToTraders * periodScale, help: `Profit splits paid to ${term("account").toLowerCase()}s who passed their challenges and traded funded accounts.` },
        { label: "Affiliate Commissions", amount: PL_DATA.cogs.affiliateCommissions * periodScale, help: "Referral payouts to affiliates based on their attributed trader conversions." },
        { label: "Payment Processing Fees", amount: PL_DATA.cogs.paymentFees * periodScale, help: "Gateway + card network fees on inbound challenge purchases and outbound payouts." },
      ],
      totalLabel: "Total COGS",
      total: totals.cogs,
      totalTone: "rose",
    },
    {
      title: "Operating Expenses",
      rows: [
        { label: "Marketing & Ads", amount: PL_DATA.opex.marketing * periodScale, help: "Paid acquisition, retargeting, sponsorships, and creative production." },
        { label: "Personnel", amount: PL_DATA.opex.personnel * periodScale, help: "Salaries, benefits, and contractor fees for ops, risk, support, and engineering." },
        { label: "Software & Tools", amount: PL_DATA.opex.software * periodScale, help: "SaaS, hosting, data feeds, and licensing for internal tooling." },
        { label: "KYC / AML Services", amount: PL_DATA.opex.kycServices * periodScale, help: "Identity verification vendor costs and sanctions screening per trader." },
        { label: "Office & Admin", amount: PL_DATA.opex.officeAdmin * periodScale, help: "Office, legal, accounting, and other administrative overhead." },
      ],
      totalLabel: "Total OpEx",
      total: totals.opex,
      totalTone: "rose",
    },
    {
      title: "Other (Interest + Tax)",
      rows: [
        { label: "Interest Expense", amount: PL_DATA.other.interestExpense * periodScale, help: "Interest on credit facilities and short-term financing." },
        { label: "Tax Provision", amount: PL_DATA.other.taxProvision * periodScale, help: "Estimated corporate income tax for the period." },
      ],
      totalLabel: "Total Other",
      total: totals.other,
      totalTone: "rose",
    },
  ];

  // ----- Export P&L as CSV (real exportToCsv call) -----
  function exportPl() {
    const rows: { section: string; label: string; amount: number; pctOfRevenue: string }[] = [];
    for (const s of sections) {
      for (const r of s.rows) {
        rows.push({ section: s.title, label: r.label, amount: r.amount, pctOfRevenue: pct(r.amount, totals.revenue) });
      }
      rows.push({ section: s.title, label: s.totalLabel, amount: s.total, pctOfRevenue: pct(s.total, totals.revenue) });
    }
    rows.push({ section: "Gross Profit", label: "Gross Profit", amount: totals.grossProfit, pctOfRevenue: pct(totals.grossProfit, totals.revenue) });
    rows.push({ section: "Operating Profit", label: "Operating Profit (EBIT)", amount: totals.operatingProfit, pctOfRevenue: pct(totals.operatingProfit, totals.revenue) });
    rows.push({ section: "Net Profit", label: "NET PROFIT", amount: totals.netProfit, pctOfRevenue: pct(totals.netProfit, totals.revenue) });
    exportToCsv(
      rows,
      [
        { key: "section", header: "Section", value: (r) => r.section },
        { key: "label", header: "Line Item", value: (r) => r.label },
        { key: "amount", header: `Amount (${currency})`, value: (r) => r.amount },
        { key: "pctOfRevenue", header: "% of Revenue", value: (r) => r.pctOfRevenue },
      ],
      `profit-and-loss-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  function downloadPdfToast() {
    toast({
      title: "Generating P&L PDF",
      description: "A formatted statement PDF will download shortly (demo).",
    });
  }

  // ----- Margin trend series (12-month margin %) -----
  const marginTrend = useMemo(
    () =>
      TREND_12M.map((p) => ({
        label: p.label,
        margin: Math.round(((p.revenue - p.expenses) / p.revenue) * 1000) / 10,
      })),
    [],
  );

  return (
    <Page>
      <PageHeader
        title="P&L Statement"
        description={`Profit & loss for the selected period — revenue, COGS, OpEx, and net profit.`}
        icon={TrendingUp}
        term={`${plural(term("account"))} · ${term("challenge")} sales + addons + subscriptions`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Select period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={downloadPdfToast}>
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={exportPl}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* KPI row — §9 every metric carries a deltaLabel for context */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Revenue"
            value={fmtNum(totals.revenue, currency)}
            icon={DollarSign}
            tone="positive"
            deltaLabel={`${pct(totals.revenue, totals.revenue)} of revenue`}
          />
          <MetricCard
            label="Total Expenses"
            value={fmtNum(totals.cogs + totals.opex + totals.other, currency)}
            icon={TrendingDown}
            tone="negative"
            deltaLabel={`COGS + OpEx + Other`}
          />
          <MetricCard
            label="Net Profit"
            value={fmtNum(totals.netProfit, currency)}
            icon={TrendingUp}
            tone="positive"
            deltaLabel={`margin ${totals.margin.toFixed(1)}%`}
          />
          <MetricCard
            label="Profit Margin"
            value={`${totals.margin.toFixed(1)}%`}
            icon={Percent}
            tone="positive"
            deltaLabel="industry benchmark: 18-25%"
          />
        </div>

        {/* P&L Statement — vertical income statement layout */}
        <div className="rounded-lg border bg-card p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Profit &amp; Loss Statement
            </h2>
            <span className="text-xs text-muted-foreground">
              Period: {PERIODS.find((p) => p.value === period)?.label ?? period}
            </span>
          </div>

          <div className="space-y-5">
            {sections.map((s) => (
              <section key={s.title}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.title}
                </p>
                <div className="mt-2 space-y-1">
                  {s.rows.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {r.help ? (
                          <LabelWithHelp help={r.help}>{r.label}</LabelWithHelp>
                        ) : (
                          r.label
                        )}
                      </span>
                      <div className="flex items-baseline gap-3 tabular-nums">
                        <span className="text-foreground">{fmtNum(r.amount, currency)}</span>
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          {pct(r.amount, totals.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
                    <span className="text-foreground">{s.totalLabel}</span>
                    <div className="flex items-baseline gap-3 tabular-nums">
                      <span
                        style={{
                          color:
                            s.totalTone === "rose" ? ROSE : s.totalTone === "emerald" ? EMERALD : "var(--foreground)",
                        }}
                      >
                        {fmtNum(s.total, currency)}
                      </span>
                      <span className="w-12 text-right text-xs text-muted-foreground">
                        {pct(s.total, totals.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            ))}

            {/* Gross Profit (between COGS section and OpEx section — surfaced inline for readability) */}
            <section>
              <div className="flex items-center justify-between py-2 text-sm font-semibold">
                <span className="text-foreground">Gross Profit</span>
                <div className="flex items-baseline gap-3 tabular-nums">
                  <span style={{ color: EMERALD }}>{fmtNum(totals.grossProfit, currency)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {pct(totals.grossProfit, totals.revenue)}
                  </span>
                </div>
              </div>
              <Separator />
            </section>

            {/* Operating Profit (EBIT) */}
            <section>
              <div className="flex items-center justify-between py-2 text-sm font-semibold">
                <span className="text-foreground">
                  <LabelWithHelp help="Earnings Before Interest and Tax. Gross Profit minus Operating Expenses.">
                    Operating Profit (EBIT)
                  </LabelWithHelp>
                </span>
                <div className="flex items-baseline gap-3 tabular-nums">
                  <span style={{ color: EMERALD }}>{fmtNum(totals.operatingProfit, currency)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {pct(totals.operatingProfit, totals.revenue)}
                  </span>
                </div>
              </div>
              <Separator />
            </section>

            {/* NET PROFIT — large emphasis §10 attention center */}
            <section className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Net Profit
                  </span>
                  <span className="text-xs text-muted-foreground">after interest + tax</span>
                </div>
                <div className="flex items-baseline gap-3 tabular-nums">
                  <span
                    className="text-2xl font-bold"
                    style={{ color: totals.netProfit >= 0 ? EMERALD : ROSE }}
                  >
                    {fmtNum(totals.netProfit, currency)}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: totals.netProfit >= 0 ? EMERALD : ROSE }}
                  >
                    {pct(totals.netProfit, totals.revenue)}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue vs Expenses — grouped bars (recharts directly — BarSeries is single-color) */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Revenue vs Expenses</p>
              <span className="text-xs text-muted-foreground">12-month trend</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: EMERALD }} /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: ROSE }} /> Expenses
              </span>
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TREND_12M} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tickFormatter={(v) => `$${Number(v) / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(v: number) => fmtNum(Number(v), currency)}
                    cursor={{ fill: "var(--muted)" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => (
                      <span style={{ color: "var(--muted-foreground)" }}>{value}</span>
                    )}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill={EMERALD} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={ROSE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Margin Trend — AreaSeries (platform component, single color) */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Profit Margin Trend</p>
              <span className="text-xs text-muted-foreground">12-month %</span>
            </div>
            <AreaSeries
              data={marginTrend}
              xKey="label"
              yKey="margin"
              color={EMERALD}
              height={240}
              formatValue={(v) => `${Number(v).toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Footnote — §19 explainability */}
        <p className="text-xs text-muted-foreground">
          All figures are illustrative. {term("payout")}: profit splits paid to funded {term("account").toLowerCase()}s.
          Margin trend = (revenue − expenses) ÷ revenue, per month.{" "}
          <span style={{ color: SLATE }}>Slate</span> = neutral ·{" "}
          <span style={{ color: EMERALD }}>emerald</span> = profit ·{" "}
          <span style={{ color: ROSE }}>rose</span> = loss.
        </p>
      </PageContent>
    </Page>
  );
}
