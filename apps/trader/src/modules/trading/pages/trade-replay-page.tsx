"use client";

/**
 * Trade Replay — converted from stitch_screens/trade_replay
 * Replay of a closed trade with step timeline and price path.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

const timeline = [
  { step: "Open", time: "08:12", note: "Entry filled at 1.08500", tone: "primary" as const },
  { step: "Add", time: "09:04", note: "Added 0.5 lots on pullback to H1 EMA", tone: "primary" as const },
  { step: "SL adjust", time: "10:22", note: "Stop moved to breakeven", tone: "secondary" as const },
  { step: "Partial close", time: "11:37", note: "Closed 50% at TP1 (+14 pips)", tone: "primary" as const },
  { step: "Close", time: "13:15", note: "Remainder closed at structure target", tone: "primary" as const },
];

export function TradeReplayPage() {
  const params = useSearchParams();
  const trade = terraTrades.find((t) => t.id === params.get("id")) ?? terraTrades[1];
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (currentStep >= timeline.length - 1) {
        setIsPlaying(false);
      } else {
        setCurrentStep((s) => s + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentStep >= timeline.length - 1) setCurrentStep(0);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStep((s) => Math.min(timeline.length - 1, s + 1));
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Trade Replay — #${trade.ticket}`}
        description={`${trade.symbol} • ${trade.side === "long" ? "Long" : "Short"} • ${trade.lots.toFixed(2)} lots`}
        actions={
          <TerraBadge tone={trade.pnl >= 0 ? "success" : "error"}>
            {formatSignedMoney(trade.pnl)}
          </TerraBadge>
        }
      />

      <TerraCard>
        <TerraSectionTitle
          title="Price path"
          description={`${trade.entry} → ${trade.exit} • ${trade.pips >= 0 ? "+" : ""}${trade.pips} pips`}
          actions={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary"
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentStep >= timeline.length - 1}
                className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                ⏭
              </button>
              <span className="flex items-center px-2 text-xs font-medium text-on-surface-variant">
                {currentStep + 1} / {timeline.length}
              </span>
            </div>
          }
        />
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 text-sm text-on-surface-variant">
          <div className="text-center">
            <p className="mb-2">Session replay chart — {trade.symbol} ({trade.entry} → {trade.exit})</p>
            <p className="text-xs font-semibold text-on-surface">
              Step {currentStep + 1}: {timeline[currentStep].step} at {timeline[currentStep].time}
            </p>
            <p className="text-xs text-on-surface-variant">{timeline[currentStep].note}</p>
          </div>
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Execution timeline" />
        <TerraTable
          head={["Step", "Time", "Note"]}
          rows={timeline.map((t, i) => [
            <TerraBadge key="s" tone={i <= currentStep ? t.tone : "neutral"}>
              {t.step}
            </TerraBadge>,
            <span key="t" className={i <= currentStep ? "font-mono text-xs" : "font-mono text-xs opacity-40"}>
              {t.time}
            </span>,
            <span key="n" className={i <= currentStep ? "text-on-surface-variant" : "text-on-surface-variant opacity-40"}>
              {t.note}
            </span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
