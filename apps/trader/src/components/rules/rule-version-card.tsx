"use client";

/**
 * Rule version section for /rules (R9 W1 Part A3, UC-T2).
 *
 * Answers the trader's question — "which rules am I actually on, and did
 * you change them after I signed up?" — with the projected version
 * history from `lib/rules/rules-store` (a projection of the prop-admin
 * `rules.version-published` events on the shared lifecycle log):
 *
 *   • pinned badge      — "Your account runs Rules v3 — unchanged since
 *                         signup"; the pin never moves when v4 ships, so
 *                         grandfathering is visible rather than promised
 *   • what changed      — the field-level diff (from → to) for every
 *                         version published after the pin
 *   • version history   — every published version with scope + notes
 *
 * Read-only: this card never writes. Every figure it shows came from the
 * operator's publish action, which is itself audited on the prop-admin
 * side. Labeled (Demo) throughout — this is simulated firm data.
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraSectionTitle,
  TerraTable,
} from "@/components/terra/terra-ui";
import {
  latestVersion,
  newerVersions,
  useRulesStore,
  type TraderRuleVersion,
} from "@/lib/rules/rules-store";

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** One published version: header + its from→to diff rows. */
function VersionRow({ version, isPinned }: { version: TraderRuleVersion; isPinned: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDiff = version.changes.length > 0;

  return (
    <div className="rounded-lg border border-outline-variant/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-headline text-sm font-bold text-on-surface">
            Rules v{version.version}
          </span>
          <TerraBadge tone={isPinned ? "success" : "neutral"}>
            {isPinned ? "Your account" : "Published"}
          </TerraBadge>
          {!hasDiff && <TerraBadge tone="neutral">No changes</TerraBadge>}
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span>Effective {formatDate(version.effectiveAt)}</span>
          <span>Scope: {version.programScope.join(", ")}</span>
          {hasDiff && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="rounded px-2 py-1 font-bold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {open ? "Hide changes" : `Show ${version.changes.length} change(s)`}
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-on-surface-variant">
        {version.notes} · published by {version.publishedBy} (Demo)
      </p>

      {open && hasDiff && (
        <div className="mt-3">
          <TerraTable
            head={["What changed", "Before", "After"]}
            rows={version.changes.map((c) => [c.field, c.from, c.to])}
          />
        </div>
      )}
    </div>
  );
}

export function RuleVersionCard() {
  const state = useRulesStore();
  const pinned = state.history.find((v) => v.id === state.pinnedVersionId) ?? latestVersion(state);
  const newer = newerVersions(state);

  return (
    <TerraCard>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div>
          <TerraSectionTitle
            title="Rule version"
            description="Which published rule set your account is measured against (Demo)"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TerraBadge tone="success">
            Your account runs Rules v{state.pinnedVersion}
          </TerraBadge>
          <TerraBadge tone="neutral">Unchanged since signup</TerraBadge>
        </div>
      </div>

      {pinned && (
        <div className="mb-4 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 text-sm text-on-surface">
          <span className="font-bold">Rules v{pinned.version}</span>{" "}
          <span className="text-on-surface-variant">
            — {pinned.rules.length} rule(s) in force since {formatDate(pinned.effectiveAt)}.
          </span>
        </div>
      )}

      {newer.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface">
            {newer.length} newer version(s) published after your signup — for information only.
            Your account keeps the rules it signed up under until an operator re-pins it.
          </p>
          {newer.map((v) => (
            <VersionRow key={v.id} version={v} isPinned={false} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">
          No newer rule versions have been published since you signed up.
        </p>
      )}

      <div className="mt-5">
        <h3 className="pb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Version history
        </h3>
        <TerraTable
          head={["Version", "Effective", "Scope", "Changes", "Notes"]}
          rows={state.history.map((v) => [
            `v${v.version}${v.id === state.pinnedVersionId ? " (yours)" : ""}`,
            formatDate(v.effectiveAt),
            v.programScope.join(", "),
            String(v.changes.length),
            v.notes,
          ])}
        />
      </div>

      <p className="mt-3 text-[11px] text-on-surface-variant">
        (Demo) — rule versions are published by the firm&apos;s risk team in the operator console
        and mirrored here; each publish is recorded in the operator&apos;s audit log.
      </p>
    </TerraCard>
  );
}
