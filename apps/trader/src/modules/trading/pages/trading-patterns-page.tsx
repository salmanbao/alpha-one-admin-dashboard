"use client";

/**
 * Pattern Monitor — converted for audit B #1
 *
 * The prop-firm risk stack has always watched a trader's linked accounts
 * for three trading patterns; operators saw them, the trader never did,
 * so a rule was only ever explained *after* it was broken. This screen
 * surfaces the same detections against the trader's own closed-trade
 * history — and, more importantly, explains what is watched, why the
 * rule exists, and how to adjust before anything triggers.
 *
 * Detections are derived (detectTerraPatterns) from the deterministic
 * fixtures: same data, same events, every render.
 *
 * Terra palette; detection details are transparent (windows are stated
 * on the page, not hidden behind the score).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
} from "@/components/terra/terra-ui";
import {
  detectTerraPatterns,
  terraAccounts,
  type TerraPatternEvent,
  type TerraPatternKind,
} from "@/lib/fixtures/terra-fixtures";
import { ArrowLeftRight, CalendarClock, Copy, Info } from "lucide-react";

type Filter = "all" | TerraPatternKind;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All patterns" },
  { id: "copy", label: "Copy trading" },
  { id: "inverse", label: "Inverse / hedging" },
  { id: "weekend", label: "Weekend entries" },
];

const kindMeta: Record<
  TerraPatternKind,
  { label: string; tone: "primary" | "tertiary" | "error"; icon: typeof Copy }
> = {
  copy: { label: "Copy trading", tone: "primary", icon: Copy },
  inverse: { label: "Inverse / hedging", tone: "tertiary", icon: ArrowLeftRight },
  weekend: { label: "Weekend entry", tone: "error", icon: CalendarClock },
};

const loginOf = (accountId: string) =>
  terraAccounts.find((a) => a.id === accountId)?.login ?? accountId;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

/** One-line "what matched" text for a detection. */
function detailOf(event: TerraPatternEvent): string {
  const [a, b] = event.accounts.map(loginOf);
  if (event.kind === "weekend") {
    return `Entered ${fmtWhen(event.detectedAt)} — outside market hours`;
  }
  const legs =
    event.kind === "copy"
      ? `both ${event.side}`
      : `long on #${a}, short on #${b}`;
  return `${legs} • entries ${event.deltaMinutes}m apart on #${a} / #${b}`;
}

/**
 * Educational copy — the heart of the finding: what is watched, why the
 * rule exists, and the concrete change that keeps the trader clear of it.
 */
const patternGuides: {
  kind: TerraPatternKind;
  title: string;
  watch: string;
  why: string;
  adjust: string[];
}[] = [
  {
    kind: "copy",
    title: "Copy & synchronized trading",
    watch: "The same symbol entered in the same direction on two of your accounts within 4 hours of each other.",
    why: "Limits are set per account, but a mirrored entry doubles the firm's exposure to a single idea — so position caps, correlated-exposure rules and consistency scoring are all breached even though each account looks healthy on its own. Entries that track each other across linked accounts are also read as coordinated trading, which most program rules treat as one trader operating a single book.",
    adjust: [
      "If you intentionally run the same idea twice, size each leg as half a position — risk the pair like one book, not two.",
      "Keep one active idea per account; if the second entry was a top-up, close or stagger it instead.",
      "Tag the intention in your trading journal so a reviewer sees a plan rather than a mirror.",
    ],
  },
  {
    kind: "inverse",
    title: "Inverse / hedging pairs",
    watch: "The same symbol entered in opposite directions on two accounts within 4 hours of each other.",
    why: "Opening the opposite leg on a second account instead of closing the first keeps both positions alive, so neither account records the economic loss. That is how drawdown limits, daily-loss rules and news restrictions get bypassed without any single account appearing to breach — which is exactly why programs prohibit it.",
    adjust: [
      "Close the original position rather than neutralizing it somewhere else.",
      "If the strategy is genuinely two-legged, run both legs inside one account and keep the net risk inside your daily limit.",
      "Need a legitimate hedge (e.g. over a scheduled announcement)? Request an exception before the window instead of routing it through a second account.",
    ],
  },
  {
    kind: "weekend",
    title: "Weekend & market-closed entries",
    watch: "An entry placed between Saturday 00:00 UTC and Sunday 21:00 UTC, while the market is closed.",
    why: "There is no continuous market at the weekend, so a resting order can only fill at the reopen — against a gap you never saw. Losses from those fills are unpredictable, and several programs also forbid carrying risk while the desk is closed for exactly that reason.",
    adjust: [
      "Cancel or reduce resting weekend orders before Friday's close.",
      "Move planned entries to the Sunday reopen or the Monday session instead of a limit left over the break.",
      "Already filled? Walk the entry in Trade Replay to see the gap you absorbed, then note the outcome in your journal.",
    ],
  },
];

export function TradingPatternsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const events = useMemo(() => detectTerraPatterns(), []);
  const counts = useMemo(
    () => ({
      copy: events.filter((e) => e.kind === "copy").length,
      inverse: events.filter((e) => e.kind === "inverse").length,
      weekend: events.filter((e) => e.kind === "weekend").length,
    }),
    [events],
  );
  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.kind === filter)),
    [events, filter],
  );

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Pattern Monitor"
        description="Trading patterns watched across your linked accounts — with the reason behind each rule."
        actions={
          <TerraBadge tone={events.length > 0 ? "tertiary" : "success"} dot pulse={events.length > 0}>
            {events.length > 0 ? `${events.length} to review` : "No detections"}
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <TerraCard>
          <TerraStat
            label="Copy entries"
            value={String(counts.copy)}
            sub="mirrored across accounts"
            tone={counts.copy > 0 ? "negative" : undefined}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Inverse pairs"
            value={String(counts.inverse)}
            sub="opposing legs linked"
            tone={counts.inverse > 0 ? "negative" : undefined}
          />
        </TerraCard>
        <TerraCard>
          <TerraStat
            label="Weekend entries"
            value={String(counts.weekend)}
            sub="outside market hours"
            tone={counts.weekend > 0 ? "negative" : undefined}
          />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle
          title="Detections"
          description="Derived from your closed trades on every linked account — copy and inverse match entries within 4 hours; weekend matches entries while the market is closed."
        />
        <div className="flex flex-wrap gap-2 pb-4" role="group" aria-label="Filter detections by pattern">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === f.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-normal opacity-75">
                {f.id === "all" ? events.length : counts[f.id]}
              </span>
            </button>
          ))}
        </div>

        {visible.length > 0 ? (
          <TerraTable
            head={["Detected", "Pattern", "Symbol", "What matched", "Trades"]}
            rows={visible.map((e) => {
              const meta = kindMeta[e.kind];
              return [
                <span key="when" className="whitespace-nowrap tabular-nums text-on-surface-variant">
                  {fmtWhen(e.detectedAt)}
                </span>,
                <span key="kind" className="inline-flex items-center gap-1.5">
                  <TerraBadge tone={meta.tone}>{meta.label}</TerraBadge>
                </span>,
                <span key="sym" className="font-semibold">{e.symbol}</span>,
                <span key="detail" className="text-on-surface-variant">{detailOf(e)}</span>,
                <span key="tix" className="whitespace-nowrap tabular-nums text-xs text-on-surface-variant">
                  #{e.tickets.join(" / #")}
                </span>,
              ];
            })}
          />
        ) : (
          <TerraEmpty
            title="Nothing matched this filter"
            description="No detections of this type in your recent trade history. Switch filters to see the other patterns."
          />
        )}

        <p className="flex items-start gap-2 pt-4 text-xs text-on-surface-variant">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            A detection is a prompt to review, not an automatic violation — matched trades are
            shown so you can confirm the intent. See the{" "}
            <Link href="/rules" className="font-semibold text-primary underline-offset-2 hover:underline">
              program rules
            </Link>{" "}
            for the exact thresholds on your account.
          </span>
        </p>
      </TerraCard>

      <div className="space-y-4">
        <TerraSectionTitle
          title="Why these patterns are monitored"
          description="What each rule looks for, why the program has it, and the change that keeps you clear of it."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {patternGuides.map((guide) => {
            const meta = kindMeta[guide.kind];
            const Icon = meta.icon;
            return (
              <TerraCard key={guide.kind} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      guide.kind === "weekend"
                        ? "bg-error-container text-on-error-container"
                        : "bg-primary-fixed text-on-primary-fixed-variant"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-headline font-bold text-on-surface">{guide.title}</h3>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      What we watch for
                    </dt>
                    <dd className="mt-1 text-on-surface">{guide.watch}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Why the rule exists
                    </dt>
                    <dd className="mt-1 text-on-surface-variant">{guide.why}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      How to adjust
                    </dt>
                    <dd className="mt-1 space-y-1.5 text-on-surface-variant">
                      {guide.adjust.map((step) => (
                        <p key={step} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{step}</span>
                        </p>
                      ))}
                    </dd>
                  </div>
                </dl>
              </TerraCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
