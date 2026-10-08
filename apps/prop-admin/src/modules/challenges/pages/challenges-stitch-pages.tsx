"use client";

/**
 * Challenges module — Stitch conversion (Batches 5-8)
 *
 * Base screens: challenges overview, active/passed/failed, create wizard,
 * challenge types, configuration, phase management, edit challenge, phase detail
 * + NEW: marketplace preview, challenge comparison, challenge analytics,
 *   phase migration tool, bulk phase editor.
 *
 * State screens wired:
 *  - challenges_overview_extend_time_modal_state / _force_fail_confirmation_alertdialog_state / _issue_payout_sheet_state
 *  - active_challenges_add_note_sheet_state / _bulk_extend_sheet_state
 *  - passed_challenges_bulk_issue_payouts_sheet_state / _mark_as_funded_modal_state
 *  - failed_challenges_add_to_re_engagement_campaign_sheet_state / _bulk_offer_retry_sheet_state
 *  - create_challenge_wizard_marketplace_trader_preview_sheet_state / _step_7_review_launch
 *  - challenge_types_add_challenge_type_sheet_state / _disable_challenge_type_confirmation_alertdialog_state
 *  - challenge_configuration_add_challenge_type_sheet_state / _test_configuration_dry_run_simulation_sheet_state
 *  - phase_management_add_phase_sheet_state / _delete_phase_migrate_confirmation_alertdialog_state
 *  - edit_challenge_publish_confirmation_live_impact_alertdialog_state / _version_history_audit_diff_sheet_state
 *  - phase_detail_add_platform_id_sheet_state / _platform_connection_test_diagnostics_modal_state
 *  - challenge_comparison_pick_challenge_type_sheet_state / _schedule_report_sheet_state
 *  - challenge_analytics_save_view_sheet_state / _empty_no_data_state
 *  - challenge_configuration_test_configuration_dry_run_simulation_sheet_state
 *  - phase_migration_tool_execute_migration_alertdialog_state / _migration_history_sheet_state
 *  - bulk_phase_editor_apply_confirmation_alertdialog_state / _edit_history_sheet_state
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantChallenges, type Challenge } from "@/lib/platform/mock-data";
import {
  StitchCard,
  StitchCardHeader,
  StitchPageHeader,
  StitchPill,
  StitchTable,
  StitchSheet,
  StitchConfirm,
  StitchButton,
  StitchStateBadge,
  StitchKpi,
  StitchDetailRow,
  StitchStepper,
  StitchEmpty,
  StitchInfoHint,
  StitchProgress,
  StitchTimeline,
  StitchMonoChip,
} from "@/components/stitch/stitch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function MsIconSafe({ name = "more_vert" }: { name?: string }) {
  return <span aria-hidden className="ms-icon text-[18px] leading-none">{name}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink">{label}</Label>
      {children}
    </div>
  );
}
function money(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
function chTone(s: Challenge["status"]): "positive" | "negative" | "warning" | "info" | "muted" {
  switch (s) {
    case "passed": case "funded": return "positive";
    case "failed": return "negative";
    case "in-progress": return "info";
    default: return "muted";
  }
}
function Select_({ children }: { children: React.ReactNode }) {
  return <select className="h-9 w-full rounded-lg bg-sfc-lowest px-3 text-xs text-ink shadow-sm outline-none focus:ring-1 focus:ring-tp">{children}</select>;
}

function RowMenu({ items }: { items: { label: string; icon: string; action: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Row actions" onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink"><MsIconSafe /></button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-xl bg-sfc-lowest py-1 shadow-xl ring-1 ring-sfc-high">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.action(); }} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-sfc", it.danger ? "text-terr" : "text-ink-variant hover:text-ink")}>
              <MsIconSafe name={it.icon} />{it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════ Challenges Overview (view-id: challenges) ═══════════════ */

export function ChallengesOverviewStitchPage() {
  const { navigate } = usePlatform();
  const tid = "tenant-alpha";
  const challenges = getTenantChallenges(tid);
  const [extendTarget, setExtendTarget] = React.useState<Challenge | null>(null);
  const [failTarget, setFailTarget] = React.useState<Challenge | null>(null);
  const [payoutTarget, setPayoutTarget] = React.useState<Challenge | null>(null);

  const active = challenges.filter((c) => c.status === "in-progress");
  const passed = challenges.filter((c) => c.status === "passed" || c.status === "funded");

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="military_tech"
        title="Challenges Overview"
        subtitle="Lifecycle health of every evaluation running in this tenant."
        actions={<StitchButton variant="primary" icon="add" onClick={() => navigate("challenge-wizard")}>New Challenge</StitchButton>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Active" value={active.length} delta="+4 this week" icon="trending_up" hint="Click to open the active queue" onClick={() => navigate("challenges-active")} />
        <StitchKpi label="Passed" value={passed.length} tone="positive" icon="workspace_premium" hint="Eligible for funding or payout" onClick={() => navigate("challenges-passed")} />
        <StitchKpi label="Failed" value={challenges.filter((c) => c.status === "failed").length} tone="negative" icon="trending_down" hint="Review re-engagement options" onClick={() => navigate("challenges-failed")} />
        <StitchKpi label="Avg Progress" value={`${Math.round(challenges.reduce((s, c) => s + c.progressPct, 0) / Math.max(1, challenges.length))}%`} icon="speed" hint="Across active challenges" />
      </section>

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(c) => c.id}
          onRowClick={(c) => navigate("challenge-edit")}
          rows={challenges.slice(0, 12)}
          columns={[
            { header: "Trader", cell: (c) => <span className="font-semibold text-ink">{c.traderName}</span> },
            { header: "Challenge", cell: (c) => c.name },
            { header: "Phase", cell: (c) => <StitchPill tone="muted">{c.phase}</StitchPill> },
            { header: "Progress", cell: (c) => <div className="flex items-center gap-2"><StitchProgress value={c.progressPct} tone={c.progressPct >= 70 ? "positive" : "warning"} className="w-20" /><span className="text-[11px] font-semibold text-ink">{c.progressPct}%</span></div> },
            { header: "Days Left", cell: (c) => <span className={cn(c.daysLeft <= 3 && "font-bold text-terr")}>{c.daysLeft}</span>, numeric: true },
            { header: "Status", cell: (c) => <StitchStateBadge state={c.status} tone={chTone(c.status)} meaning={`Challenge is ${c.status}`} /> },
            {
              header: "",
              cell: (c) => (
                <RowMenu items={[
                  { label: "Extend time", icon: "schedule", action: () => setExtendTarget(c) },
                  { label: "Issue payout", icon: "payments", action: () => setPayoutTarget(c) },
                  { label: "Force fail", icon: "gpp_bad", action: () => setFailTarget(c), danger: true },
                ]} />
              ),
              className: "w-12",
            },
          ]}
          emptyState={<StitchEmpty icon="military_tech" title="No challenges yet" body="Create your first challenge template to start evaluations." action={<StitchButton variant="primary" onClick={() => navigate("challenge-wizard")}>New Challenge</StitchButton>} />}
        />
      </StitchCard>

      {/* Extend time modal */}
      <StitchConfirm
        open={!!extendTarget} onOpenChange={(o) => !o && setExtendTarget(null)} icon="schedule"
        title={`Extend time for ${extendTarget?.traderName ?? ""}?`}
        body="Adds 7 calendar days to the challenge deadline. The trader is notified by email."
        confirmLabel="Extend 7 Days"
        destructive={false}
        onConfirm={() => toast({ title: "Challenge extended" })}
      />
      {/* Force fail confirm */}
      <StitchConfirm
        open={!!failTarget} onOpenChange={(o) => !o && setFailTarget(null)} icon="gpp_bad"
        title={`Force fail ${failTarget?.traderName ?? ""}?`}
        body="The challenge ends immediately as failed. Open positions are closed and the trader is notified. This cannot be undone."
        confirmLabel="Force Fail"
        onConfirm={() => toast({ title: "Challenge marked failed" })}
      >
        <Field label="Reason (required)"><Textarea className="stitch-input" /></Field>
      </StitchConfirm>
      {/* Issue payout sheet */}
      <StitchSheet
        open={!!payoutTarget} onOpenChange={(o) => !o && setPayoutTarget(null)} icon="payments"
        title={`Issue payout — ${payoutTarget?.traderName ?? ""}`}
        footer={<>
          <StitchButton variant="surface" onClick={() => setPayoutTarget(null)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setPayoutTarget(null); toast({ title: "Payout queued" }); }}>Issue Payout</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Amount"><Input className="stitch-input" type="number" defaultValue={4800} /></Field>
          <Field label="Method"><Select_><option>Bank Transfer</option><option>USDT TRC-20</option><option>PayPal</option></Select_></Field>
          <Field label="Note"><Textarea className="stitch-input" /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ Active Challenges (challenges-active) ═══════════════ */

export function ActiveChallengesStitchPage() {
  const challenges = getTenantChallenges("tenant-alpha").filter((c) => c.status === "in-progress");
  const [noteTarget, setNoteTarget] = React.useState<Challenge | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const { navigate } = usePlatform();

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="play_circle"
        title="Active Challenges"
        subtitle={`${challenges.length} evaluations currently running.`}
        actions={<StitchButton variant="surface" icon="schedule" onClick={() => setBulkOpen(true)}>Bulk Extend</StitchButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {challenges.slice(0, 6).map((c) => (
          <StitchCard key={c.id} interactive onClick={() => navigate("challenge-edit")}>
            <div className="flex items-start justify-between pb-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-bold text-ink">{c.traderName}</p>
                <p className="truncate text-[11px] text-ink-variant">{c.name} · {c.phase}</p>
              </div>
              <StitchPill tone={c.daysLeft <= 3 ? "negative" : "info"}>{c.daysLeft}d left</StitchPill>
            </div>
            <StitchProgress value={c.progressPct} tone={c.progressPct >= 70 ? "positive" : "warning"} />
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-variant">
              <span>{money(c.currentProfit)} of {money(c.profitTarget)}</span>
              <button className="font-bold text-tp" onClick={(e) => { e.stopPropagation(); setNoteTarget(c); }}>+ Note</button>
            </div>
          </StitchCard>
        ))}
      </div>

      {challenges.length === 0 ? (
        <StitchCard><StitchEmpty icon="play_circle" title="No active challenges" body="New evaluations appear here the moment a trader starts Phase 1." /></StitchCard>
      ) : null}

      {/* Add note sheet */}
      <StitchSheet
        open={!!noteTarget} onOpenChange={(o) => !o && setNoteTarget(null)} icon="sticky_note_2"
        title={`Note — ${noteTarget?.traderName ?? ""}`}
        footer={<>
          <StitchButton variant="surface" onClick={() => setNoteTarget(null)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setNoteTarget(null); toast({ title: "Note saved" }); }}>Save Note</StitchButton>
        </>}
      >
        <Field label="Note"><Textarea className="stitch-input min-h-24" /></Field>
        <div className="mt-2"><label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Pin to top<Switch defaultChecked={false} /></label></div>
      </StitchSheet>

      {/* Bulk extend sheet */}
      <StitchConfirm
        open={bulkOpen} onOpenChange={setBulkOpen} icon="schedule"
        title="Bulk extend deadlines?"
        body="All currently running challenges will be extended by 7 days and each trader notified."
        confirmLabel="Extend All"
        destructive={false}
        onConfirm={() => toast({ title: "Bulk extension applied" })}
      />
    </div>
  );
}

/* ═══════════════ Passed Challenges (challenges-passed) ═══════════════ */

export function PassedChallengesStitchPage() {
  const passed = getTenantChallenges("tenant-alpha").filter((c) => c.status === "passed" || c.status === "funded");
  const [fundTarget, setFundTarget] = React.useState<Challenge | null>(null);
  const [bulkPayoutOpen, setBulkPayoutOpen] = React.useState(false);
  const { navigate } = usePlatform();

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="workspace_premium"
        title="Passed Challenges"
        subtitle="Evaluations that met every objective — awaiting funding or payout."
        actions={<StitchButton variant="primary" icon="payments" onClick={() => setBulkPayoutOpen(true)}>Bulk Issue Payouts</StitchButton>}
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(c) => c.id}
          onRowClick={() => navigate("challenge-edit")}
          rows={passed}
          columns={[
            { header: "Trader", cell: (c) => <span className="font-semibold text-ink">{c.traderName}</span> },
            { header: "Challenge", cell: (c) => c.name },
            { header: "Account Size", cell: (c) => money(c.accountSize), numeric: true },
            { header: "Profit", cell: (c) => <span className="text-tp">{money(c.currentProfit)}</span>, numeric: true },
            { header: "Status", cell: (c) => <StitchStateBadge state={c.status} tone="positive" /> },
            {
              header: "",
              cell: (c) => <StitchButton variant="primary" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setFundTarget(c); }}>Mark as Funded</StitchButton>,
            },
          ]}
          emptyState={<StitchEmpty icon="workspace_premium" title="No passed challenges" body="When traders meet every objective, they appear here for funding." />}
        />
      </StitchCard>

      {/* Mark as funded modal */}
      <StitchConfirm
        open={!!fundTarget} onOpenChange={(o) => !o && setFundTarget(null)} icon="workspace_premium"
        title={`Fund ${fundTarget?.traderName ?? ""}?`}
        body="A funded account will be provisioned with the challenge's account size. The trader receives credentials by email."
        confirmLabel="Mark as Funded"
        destructive={false}
        onConfirm={() => toast({ title: "Trader funded" })}
      />
      {/* Bulk payouts sheet */}
      <StitchConfirm
        open={bulkPayoutOpen} onOpenChange={setBulkPayoutOpen} icon="payments"
        title="Issue payouts for all passed challenges?"
        body="Every passed challenge will receive its profit-split payout based on current profit. Finance is notified."
        confirmLabel="Issue All Payouts"
        destructive={false}
        onConfirm={() => toast({ title: "Payouts queued" })}
      />
    </div>
  );
}

/* ═══════════════ Failed Challenges (challenges-failed) ═══════════════ */

export function FailedChallengesStitchPage() {
  const failed = getTenantChallenges("tenant-alpha").filter((c) => c.status === "failed");
  const [reengageTarget, setReengageTarget] = React.useState<Challenge | null>(null);
  const [bulkRetryOpen, setBulkRetryOpen] = React.useState(false);
  const { navigate } = usePlatform();

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="trending_down"
        title="Failed Challenges"
        subtitle="Evaluations that breached a rule — with re-engagement options."
        actions={<StitchButton variant="surface" icon="send" onClick={() => setBulkRetryOpen(true)}>Bulk Offer Retry</StitchButton>}
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(c) => c.id}
          onRowClick={() => navigate("challenge-edit")}
          rows={failed}
          columns={[
            { header: "Trader", cell: (c) => <span className="font-semibold text-ink">{c.traderName}</span> },
            { header: "Challenge", cell: (c) => c.name },
            { header: "Phase", cell: (c) => <StitchPill tone="muted">{c.phase}</StitchPill> },
            { header: "Progress", cell: (c) => `${c.progressPct}%`, numeric: true },
            { header: "Status", cell: (c) => <StitchStateBadge state="failed" tone="negative" meaning="Challenge breached a rule" /> },
            {
              header: "",
              cell: () => <StitchButton variant="surface" className="h-7 px-2" icon="campaign" onClick={(e) => { e.stopPropagation(); setReengageTarget(failed[0]); }}>Re-engage</StitchButton>,
            },
          ]}
          emptyState={<StitchEmpty icon="sentiment_satisfied" title="No failed challenges" body="Nobody has breached a rule yet — a good problem to have." />}
        />
      </StitchCard>

      <StitchSheet
        open={!!reengageTarget} onOpenChange={(o) => !o && setReengageTarget(null)} icon="campaign"
        title={`Re-engage ${reengageTarget?.traderName ?? ""}`}
        description="Adds the trader to a win-back campaign with a retry offer"
        footer={<>
          <StitchButton variant="surface" onClick={() => setReengageTarget(null)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setReengageTarget(null); toast({ title: "Added to re-engagement campaign" }); }}>Add to Campaign</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Campaign"><Select_><option>Win-back 20% off</option><option>Free retry (7-day)</option><option>Upgrade to larger account</option></Select_></Field>
          <Field label="Personal note"><Textarea className="stitch-input" /></Field>
        </div>
      </StitchSheet>

      <StitchConfirm
        open={bulkRetryOpen} onOpenChange={setBulkRetryOpen} icon="send"
        title="Send retry offer to all failed traders?"
        body="Each trader receives a personalized retry offer email. Marketing is attributed automatically."
        confirmLabel="Send Offers"
        destructive={false}
        onConfirm={() => toast({ title: "Retry offers sent" })}
      />
    </div>
  );
}

/* ═══════════════ Create Wizard (challenge-wizard) ═══════════════ */

export function ChallengeWizardStitchPage() {
  const { navigate } = usePlatform();
  const STEPS = ["Basics", "Trading Rules", "Risk Rules", "Payout Rules", "Review"];
  const [step, setStep] = React.useState(0);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="design_services"
        title="Create Challenge"
        subtitle="Define a reusable challenge template in five guided steps."
        actions={<StitchButton variant="ghost" icon="visibility" onClick={() => setPreviewOpen(true)}>Trader Preview</StitchButton>}
      />

      <div className="flex items-center gap-2 rounded-xl bg-sfc-low p-4 shadow-sm">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", i < step ? "bg-tp text-on-primary" : i === step ? "border-2 border-tp bg-sfc-lowest text-tp" : "bg-sfc text-ink-muted")}>{i < step ? <MsIconSafe name="check" /> : i + 1}</span>
              <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-ink-variant")}>{s}</span>
            </div>
            {i < STEPS.length - 1 ? <div className={cn("h-0.5 flex-1", i < step ? "bg-tp" : "bg-sfc-high")} /> : null}
          </React.Fragment>
        ))}
      </div>

      <StitchCard className="min-h-72 p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <Field label="Challenge Name"><Input className="stitch-input" defaultValue="2-Phase Standard" /></Field>
            <Field label="Description"><Textarea className="stitch-input" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Account Sizes (USD, comma separated)"><Input className="stitch-input" defaultValue="10000, 25000, 50000, 100000" /></Field>
              <Field label="Price (USD)"><Input className="stitch-input" type="number" defaultValue={549} /></Field>
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profit Target %"><Input className="stitch-input" type="number" defaultValue={10} /></Field>
            <Field label="Min Trading Days"><Input className="stitch-input" type="number" defaultValue={5} /></Field>
            <Field label="Time Limit (days)"><Input className="stitch-input" type="number" defaultValue={30} /></Field>
            <Field label="Leverage"><Select_><option>1:100</option><option>1:50</option><option>1:30</option></Select_></Field>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Daily Drawdown %"><Input className="stitch-input" type="number" defaultValue={5} /></Field>
            <Field label="Max Drawdown %"><Input className="stitch-input" type="number" defaultValue={10} /></Field>
            <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Allow weekend holding<Switch defaultChecked /></label>
            <label className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink">Allow news trading<Switch defaultChecked={false} /></label>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profit Split (trader %)"><Input className="stitch-input" type="number" defaultValue={80} /></Field>
            <Field label="Payout Frequency"><Select_><option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option></Select_></Field>
            <Field label="First Withdrawal Delay"><Input className="stitch-input" defaultValue="14 days" /></Field>
            <Field label="Min Payout Amount"><Input className="stitch-input" type="number" defaultValue={100} /></Field>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <StitchDetailRow label="Name" value="2-Phase Standard" />
              <StitchDetailRow label="Profit Target" value="10%" />
              <StitchDetailRow label="Daily / Max DD" value="5% / 10%" />
              <StitchDetailRow label="Profit Split" value="80 / 20" />
            </div>
            <div className="rounded-xl border-l-4 border-tp bg-tp-fixed/40 p-4">
              <p className="text-xs font-bold text-tp-fixed-variant">Ready to publish</p>
              <p className="mt-1 text-xs text-ink-variant">The template becomes selectable in the marketplace preview immediately.</p>
            </div>
          </div>
        ) : null}
      </StitchCard>

      <div className="flex items-center justify-between rounded-xl bg-sfc-low px-4 py-3 shadow-sm">
        <StitchButton variant="ghost" icon="arrow_back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</StitchButton>
        <span className="text-xs font-semibold text-ink-variant">Step {step + 1} of 5</span>
        {step < 4 ? <StitchButton variant="primary" onClick={() => setStep((s) => Math.min(4, s + 1))}>Next</StitchButton>
          : <StitchButton variant="primary" icon="publish" onClick={() => { toast({ title: "Challenge published" }); navigate("challenge-types"); }}>Publish</StitchButton>}
      </div>

      {/* Trader preview sheet */}
      <StitchSheet
        open={previewOpen} onOpenChange={setPreviewOpen} icon="visibility" wide
        title="Trader preview" description="What the trader sees in the marketplace"
        footer={<StitchButton variant="primary" onClick={() => setPreviewOpen(false)}>Close</StitchButton>}
      >
        <div className="rounded-xl bg-sfc-low p-5">
          <p className="font-serif text-lg font-bold text-ink">2-Phase Standard</p>
          <p className="mt-1 text-xs text-ink-variant">The industry-standard two-step evaluation. Reach 10% in Phase 1, 5% in Phase 2.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StitchDetailRow label="Profit Target" value="10%" />
            <StitchDetailRow label="Daily Loss" value="5%" />
            <StitchDetailRow label="Max DD" value="10%" />
            <StitchDetailRow label="Split" value="80%" />
          </div>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ Challenge Types (challenge-types) ═══════════════ */

export function ChallengeTypesStitchPage() {
  const [addOpen, setAddOpen] = React.useState(false);
  const [disableTarget, setDisableTarget] = React.useState<string | null>(null);
  const { navigate } = usePlatform();
  const TYPES = [
    { name: "2-Phase Standard", phases: 2, sizes: "10K–100K", split: "80%", active: true, sold30d: 412 },
    { name: "1-Phase Turbo", phases: 1, sizes: "25K–50K", split: "75%", active: true, sold30d: 168 },
    { name: "Instant Funded", phases: 0, sizes: "25K–100K", split: "70%", active: false, sold30d: 54 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="military_tech"
        title="Challenge Types"
        subtitle="Reusable templates that define every evaluation you sell."
        actions={<StitchButton variant="primary" icon="add" onClick={() => setAddOpen(true)}>Add Challenge Type</StitchButton>}
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(t) => t.name}
          onRowClick={() => navigate("challenge-edit")}
          rows={TYPES}
          columns={[
            { header: "Name", cell: (t) => <span className="font-semibold text-ink">{t.name}</span> },
            { header: "Phases", cell: (t) => t.phases, numeric: true },
            { header: "Account Sizes", cell: (t) => t.sizes },
            { header: "Trader Split", cell: (t) => t.split },
            { header: "Sold (30d)", cell: (t) => t.sold30d, numeric: true },
            { header: "Status", cell: (t) => <StitchStateBadge state={t.active ? "active" : "disabled"} tone={t.active ? "positive" : "muted"} /> },
            {
              header: "",
              cell: (t) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <StitchButton variant="surface" className="h-7 px-2" onClick={() => setDisableTarget(t.name)}>{t.active ? "Disable" : "Enable"}</StitchButton>
                </div>
              ),
            },
          ]}
        />
      </StitchCard>

      <StitchSheet
        open={addOpen} onOpenChange={setAddOpen} icon="add" title="Add challenge type"
        footer={<>
          <StitchButton variant="surface" onClick={() => setAddOpen(false)}>Cancel</StitchButton>
          <StitchButton variant="primary" onClick={() => { setAddOpen(false); toast({ title: "Challenge type created" }); }}>Create</StitchButton>
        </>}
      >
        <div className="space-y-3">
          <Field label="Name"><Input className="stitch-input" placeholder="3-Phase Extended" /></Field>
          <Field label="Phases"><Input className="stitch-input" type="number" defaultValue={3} /></Field>
          <Field label="Base Profit Target %"><Input className="stitch-input" type="number" defaultValue={8} /></Field>
        </div>
      </StitchSheet>

      <StitchConfirm
        open={!!disableTarget} onOpenChange={(o) => !o && setDisableTarget(null)} icon="do_not_disturb_on"
        title={`Disable ${disableTarget ?? ""}?`}
        body="New purchases will be blocked immediately. Existing challenges continue unchanged."
        confirmLabel="Disable Type"
        onConfirm={() => toast({ title: "Type disabled" })}
      />
    </div>
  );
}

/* ═══════════════ Challenge Configuration (challenge-config) ═══════════════ */

export function ChallengeConfigStitchPage() {
  const [testOpen, setTestOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="tune"
        title="Challenge Configuration"
        subtitle="Global parameters that apply to every challenge type."
        actions={
          <>
            <StitchButton variant="surface" icon="science" onClick={() => setTestOpen(true)}>Dry-Run Test</StitchButton>
            <StitchButton variant="surface" icon="add" onClick={() => setAddOpen(true)}>Add Type</StitchButton>
            <StitchButton variant="primary" icon="save" onClick={() => toast({ title: "Configuration saved" })}>Save</StitchButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader icon="toll" title="Pricing" description="Add-on prices and currency defaults" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default Currency"><Select_><option>USD</option><option>EUR</option><option>GBP</option></Select_></Field>
            <Field label="Retry Discount %"><Input className="stitch-input" type="number" defaultValue={20} /></Field>
          </div>
        </StitchCard>
        <StitchCard>
          <StitchCardHeader icon="schedule" title="Timing" description="Deadlines and reset windows" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default Time Limit (days)"><Input className="stitch-input" type="number" defaultValue={30} /></Field>
            <Field label="Daily Reset (UTC)"><Input className="stitch-input" defaultValue="23:00" /></Field>
          </div>
        </StitchCard>
      </div>

      <StitchSheet
        open={testOpen} onOpenChange={setTestOpen} icon="science" wide
        title="Dry-run simulation" description="Applies the current configuration to a simulated trader"
        footer={<StitchButton variant="primary" onClick={() => setTestOpen(false)}>Close</StitchButton>}
      >
        <StitchStepper
          steps={[
            { label: "Simulated purchase", time: "T+0s", state: "done", body: "2-Phase $100K purchased at $549." },
            { label: "Phase 1 objectives applied", time: "T+1s", state: "done", body: "10% target, 5% daily DD, 10% max DD, 5 min days." },
            { label: "Breach simulation", time: "T+2s", state: "done", body: "Simulated -$5,200 day → daily DD alert fired at 80%." },
            { label: "Result", time: "T+3s", state: "done", body: "All rules behaved as configured. No conflicts found." },
          ]}
        />
      </StitchSheet>

      <StitchSheet
        open={addOpen} onOpenChange={setAddOpen} icon="add" title="Add challenge type"
        footer={<><StitchButton variant="surface" onClick={() => setAddOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setAddOpen(false); toast({ title: "Type added" }); }}>Create</StitchButton></>}
      >
        <div className="space-y-3">
          <Field label="Name"><Input className="stitch-input" placeholder="2-Phase Swing" /></Field>
          <Field label="Phases"><Input className="stitch-input" type="number" defaultValue={2} /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ Phase Management (phase-management) ═══════════════ */

export function PhaseManagementStitchPage() {
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { navigate } = usePlatform();
  const PHASES = [
    { id: "ph-1", name: "Phase 1 — Evaluation", target: "10%", daily: "5%", max: "10%", active: 1240 },
    { id: "ph-2", name: "Phase 2 — Verification", target: "5%", daily: "5%", max: "10%", active: 512 },
    { id: "ph-3", name: "Funded", target: "—", daily: "5%", max: "10%", active: 318 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="alt_route"
        title="Phase Management"
        subtitle="The objective ladder every challenge climbs."
        actions={<StitchButton variant="primary" icon="add" onClick={() => setAddOpen(true)}>Add Phase</StitchButton>}
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(p) => p.id}
          onRowClick={() => navigate("phase-detail")}
          rows={PHASES}
          columns={[
            { header: "Phase", cell: (p) => <span className="font-semibold text-ink">{p.name}</span> },
            { header: "Profit Target", cell: (p) => p.target },
            { header: "Daily DD", cell: (p) => p.daily },
            { header: "Max DD", cell: (p) => p.max },
            { header: "Active Traders", cell: (p) => p.active, numeric: true },
            {
              header: "",
              cell: (p) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <StitchButton variant="ghost" className="h-7 px-2 text-terr" onClick={() => setDeleteOpen(true)}>Delete</StitchButton>
                </div>
              ),
            },
          ]}
        />
      </StitchCard>

      <StitchSheet
        open={addOpen} onOpenChange={setAddOpen} icon="add" title="Add phase"
        footer={<><StitchButton variant="surface" onClick={() => setAddOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setAddOpen(false); toast({ title: "Phase created" }); }}>Create Phase</StitchButton></>}
      >
        <div className="space-y-3">
          <Field label="Phase Name"><Input className="stitch-input" placeholder="Phase 3 — Consistency" /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Target %"><Input className="stitch-input" type="number" /></Field>
            <Field label="Daily DD %"><Input className="stitch-input" type="number" /></Field>
            <Field label="Max DD %"><Input className="stitch-input" type="number" /></Field>
          </div>
        </div>
      </StitchSheet>

      <StitchConfirm
        open={deleteOpen} onOpenChange={setDeleteOpen} icon="delete_forever"
        title="Delete phase and migrate traders?"
        body="Active traders on this phase will be migrated to the previous phase's objectives. This cannot be undone."
        confirmLabel="Delete & Migrate"
        onConfirm={() => toast({ title: "Phase deleted — traders migrated" })}
      />
    </div>
  );
}

/* ═══════════════ Edit Challenge (challenge-edit) ═══════════════ */

export function ChallengeEditStitchPage() {
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const { navigate } = usePlatform();

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="edit_note"
        title="Edit Challenge — 2-Phase Standard"
        subtitle="Changes take effect for new purchases; running challenges keep their original rules."
        actions={
          <>
            <StitchButton variant="surface" icon="history" onClick={() => setHistoryOpen(true)}>Version History</StitchButton>
            <StitchButton variant="primary" icon="publish" onClick={() => setPublishOpen(true)}>Publish Changes</StitchButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader icon="military_tech" title="Challenge Rules" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profit Target %"><Input className="stitch-input" type="number" defaultValue={10} /></Field>
            <Field label="Min Trading Days"><Input className="stitch-input" type="number" defaultValue={5} /></Field>
            <Field label="Time Limit (days)"><Input className="stitch-input" type="number" defaultValue={30} /></Field>
            <Field label="Leverage"><Select_><option>1:100</option></Select_></Field>
          </div>
        </StitchCard>
        <StitchCard>
          <StitchCardHeader icon="shield" title="Risk Rules" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Daily Drawdown %"><Input className="stitch-input" type="number" defaultValue={5} /></Field>
            <Field label="Max Drawdown %"><Input className="stitch-input" type="number" defaultValue={10} /></Field>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-variant"><StitchInfoHint text="Changing risk rules on a published type only affects new purchases." />Rule changes never apply retroactively to running challenges.</p>
        </StitchCard>
      </div>

      <StitchConfirm
        open={publishOpen} onOpenChange={setPublishOpen} icon="publish"
        title="Publish changes live?"
        body="142 traders will purchase this type going forward with the new rules. Running challenges are unaffected."
        confirmLabel="Publish"
        onConfirm={() => toast({ title: "Changes published" })}
      />

      {/* Version history audit diff sheet */}
      <StitchSheet
        open={historyOpen} onOpenChange={setHistoryOpen} icon="history" wide
        title="Version history & audit diff" description="Every publish creates a snapshot"
        footer={<StitchButton variant="primary" onClick={() => { setHistoryOpen(false); navigate("challenge-types"); }}>Close</StitchButton>}
      >
        <div className="space-y-2">
          {[
            { v: "v-8", at: "May 28 09:12", by: "Sarah Chen", diff: "Profit Target: 8% → 10%" },
            { v: "v-7", at: "May 20 14:40", by: "Aiden Lloyd", diff: "Daily DD: 6% → 5%" },
            { v: "v-6", at: "May 12 11:02", by: "Sarah Chen", diff: "Min Days: 4 → 5" },
          ].map((h) => (
            <div key={h.v} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs">
              <span className="flex items-center gap-2"><StitchPill tone="muted">{h.v}</StitchPill><span className="font-medium text-ink">{h.by}</span></span>
              <span className="flex items-center gap-3"><span className="font-mono text-[10px] text-ink-variant">{h.diff}</span><span className="text-ink-variant">{h.at}</span></span>
            </div>
          ))}
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ Phase Detail (phase-detail) ═══════════════ */

export function PhaseDetailStitchPage() {
  const [platformOpen, setPlatformOpen] = React.useState(false);
  const [diagOpen, setDiagOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="flag"
        title="Phase 1 — Evaluation (Alpha)"
        subtitle="The first objective set applied to every new evaluation."
        actions={
          <>
            <StitchButton variant="surface" icon="add_link" onClick={() => setPlatformOpen(true)}>Add Platform ID</StitchButton>
            <StitchButton variant="surface" icon="speed" onClick={() => setDiagOpen(true)}>Connection Test</StitchButton>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StitchKpi label="Profit Target" value="10%" icon="flag" />
        <StitchKpi label="Daily DD" value="5%" icon="waterfall_chart" />
        <StitchKpi label="Max DD" value="10%" icon="stacked_line_chart" />
        <StitchKpi label="Active Traders" value={1240} icon="group" />
      </section>

      <StitchCard>
        <StitchCardHeader icon="link" title="Platform Bindings" description="Server groups this phase provisions onto" />
        <div className="space-y-2">
          {[["Terra-LD4-01", "MT4 · London", "connected"], ["DX-Cloud-EU", "DXTrade · Frankfurt", "degraded"]].map(([n, r, s]) => (
            <div key={n} className="flex items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5">
              <span className="flex items-center gap-2.5 text-xs"><span className="font-mono font-bold text-ink">{n}</span><span className="text-ink-variant">{r}</span></span>
              <StitchStateBadge state={s} tone={s === "connected" ? "positive" : "warning"} />
            </div>
          ))}
        </div>
      </StitchCard>

      <StitchSheet
        open={platformOpen} onOpenChange={setPlatformOpen} icon="add_link" title="Add platform ID"
        footer={<><StitchButton variant="surface" onClick={() => setPlatformOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setPlatformOpen(false); toast({ title: "Platform ID bound" }); }}>Add</StitchButton></>}
      >
        <div className="space-y-3">
          <Field label="Platform"><Select_><option>MT4</option><option>DXTrade</option></Select_></Field>
          <Field label="Server / Group ID"><Input className="stitch-input font-mono" placeholder="Terra-FRA-03" /></Field>
        </div>
      </StitchSheet>

      <StitchSheet
        open={diagOpen} onOpenChange={setDiagOpen} icon="speed" title="Platform connection test"
        footer={<StitchButton variant="primary" onClick={() => setDiagOpen(false)}>Done</StitchButton>}
      >
        <StitchTimeline
          items={[
            { dotClass: "bg-tp", title: "Terra-LD4-01 reachable", time: "6ms" },
            { dotClass: "bg-tp", title: "MT4 manager API auth OK", time: "18ms" },
            { dotClass: "bg-tt", title: "DX-Cloud-EU latency elevated", time: "87ms", body: "Above the 50ms target — degradation flag set." },
          ]}
        />
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ NEW — Marketplace Preview (challenge-marketplace-preview) ═══════════════ */

export function ChallengeMarketplacePreviewStitchPage() {
  const [tier, setTier] = React.useState<"10k" | "25k" | "50k" | "100k">("100k");
  const [faqOpen, setFaqOpen] = React.useState(false);
  const tiers = { "10k": 89, "25k": 189, "50k": 289, "100k": 549 };

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="storefront"
        title="Marketplace Preview"
        subtitle="Exactly what a buyer sees before purchasing this challenge."
        chip={<StitchPill tone="info">Live preview</StitchPill>}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <StitchCard className="p-6 lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-2xl font-bold text-ink">2-Phase Standard</p>
              <p className="mt-1 text-xs text-ink-variant">The industry-standard two-step evaluation with the firm's best payout split.</p>
            </div>
            <StitchPill tone="positive" icon="star">Most Popular</StitchPill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StitchDetailRow label="Profit Target" value="10% / 5%" />
            <StitchDetailRow label="Daily Loss" value="5%" />
            <StitchDetailRow label="Max DD" value="10%" />
            <StitchDetailRow label="Min Days" value="5" />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-tsc">What's included</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {["Two-phase evaluation", "80% profit split", "Weekly payouts", "1:100 leverage", "News trading allowed", "Weekend holding"].map((f) => (
                <span key={f} className="flex items-center gap-2 text-xs text-ink"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-tp text-[9px] text-on-primary">✓</span>{f}</span>
              ))}
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink" onClick={() => setFaqOpen(!faqOpen)}>
            Expanded FAQ (tier switch state)
            <Switch checked={faqOpen} onCheckedChange={setFaqOpen} />
          </label>
          {faqOpen ? (
            <div className="mt-2 space-y-2">
              {["What happens after I pass both phases?", "Can I merge accounts?", "How fast are payouts processed?"].map((q) => (
                <div key={q} className="rounded-lg bg-sfc-low px-3 py-2.5 text-xs"><p className="font-semibold text-ink">{q}</p><p className="mt-0.5 text-ink-variant">Funded traders receive credentials within 24 hours and can request payouts weekly.</p></div>
              ))}
            </div>
          ) : null}
        </StitchCard>

        <StitchCard className="p-6 lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">Account size</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(tiers) as (keyof typeof tiers)[]).map((t) => (
              <button key={t} onClick={() => setTier(t)} className={cn("rounded-xl px-3 py-3 text-center text-xs font-bold transition-all", tier === t ? "bg-tp text-on-primary shadow-sm" : "bg-sfc-low text-ink hover:bg-sfc-high")}>
                ${t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t border-sfc-high pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-tsc">Price</p>
            <p className="mt-1 font-serif text-4xl font-bold text-ink">${tiers[tier]}</p>
            <StitchButton variant="primary" className="mt-4 w-full justify-center" icon="shopping_cart" onClick={() => toast({ title: "Preview mode — no purchase", description: "This is the admin-side buyer preview." })}>Start Challenge</StitchButton>
            <p className="mt-2 text-center text-[10px] text-ink-variant">Buyers check out through the configured PSPs.</p>
          </div>
        </StitchCard>
      </div>
    </div>
  );
}

/* ═══════════════ NEW — Challenge Comparison (challenge-comparison) ═══════════════ */

export function ChallengeComparisonStitchPage() {
  const [pickOpen, setPickOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const rows = [
    { m: "Profit Target", a: "10% / 5%", b: "10%", c: "Instant" },
    { m: "Daily DD", a: "5%", b: "4%", c: "5%" },
    { m: "Max DD", a: "10%", b: "8%", c: "6%" },
    { m: "Min Days", a: "5", b: "3", c: "0" },
    { m: "Trader Split", a: "80%", b: "75%", c: "70%" },
    { m: "Sold (30d)", a: "412", b: "168", c: "54" },
    { m: "Pass Rate", a: "9.4%", b: "14.2%", c: "21.8%" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="balance"
        title="Challenge Comparison"
        subtitle="Compare commercial and pass-rate performance across challenge types."
        actions={
          <>
            <StitchButton variant="surface" icon="schedule_send" onClick={() => setScheduleOpen(true)}>Schedule Report</StitchButton>
            <StitchButton variant="primary" icon="playlist_add_check" onClick={() => setPickOpen(true)}>Pick Challenge Types</StitchButton>
          </>
        }
      />

      <StitchCard className="p-0">
        <StitchTable
          keyOf={(r) => r.m}
          rows={rows}
          columns={[
            { header: "Metric", cell: (r) => <span className="font-bold text-ink">{r.m}</span> },
            { header: "2-Phase Standard", cell: (r) => r.a },
            { header: "1-Phase Turbo", cell: (r) => r.b },
            { header: "Instant Funded", cell: (r) => r.c },
          ]}
          emptyState={<StitchEmpty icon="balance" title="Nothing to compare" body="Pick at least two challenge types." />}
        />
      </StitchCard>

      <StitchSheet
        open={pickOpen} onOpenChange={setPickOpen} icon="playlist_add_check" title="Pick challenge types"
        footer={<><StitchButton variant="surface" onClick={() => setPickOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setPickOpen(false); toast({ title: "Comparison updated" }); }}>Compare</StitchButton></>}
      >
        <div className="space-y-2">
          {["2-Phase Standard", "1-Phase Turbo", "Instant Funded"].map((t, i) => (
            <label key={t} className="flex items-center gap-2.5 rounded-lg bg-sfc-low px-3 py-2.5 text-xs font-medium text-ink"><Checkbox defaultChecked className="border-ink-variant/40" />{t}</label>
          ))}
        </div>
      </StitchSheet>

      <StitchSheet
        open={scheduleOpen} onOpenChange={setScheduleOpen} icon="schedule_send" title="Schedule comparison report"
        footer={<><StitchButton variant="surface" onClick={() => setScheduleOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setScheduleOpen(false); toast({ title: "Report scheduled" }); }}>Schedule</StitchButton></>}
      >
        <div className="space-y-3">
          <Field label="Cadence"><Select_><option>Weekly (Monday 08:00)</option><option>Monthly</option></Select_></Field>
          <Field label="Recipients"><Input className="stitch-input" placeholder="ops@firm.com" /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ NEW — Challenge Analytics (challenge-analytics) ═══════════════ */

export function ChallengeAnalyticsStitchPage() {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [hasData] = React.useState(true);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="monitoring"
        title="Challenge Analytics"
        subtitle="Funnel, pass rate and revenue performance per challenge type."
        actions={<StitchButton variant="surface" icon="bookmark" onClick={() => setSaveOpen(true)}>Save View</StitchButton>}
      />

      {hasData ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StitchKpi label="Purchases (30d)" value={634} delta="+12%" icon="shopping_cart" />
            <StitchKpi label="Phase-1 Pass Rate" value="9.4%" delta="+0.8%" tone="positive" icon="military_tech" />
            <StitchKpi label="Funded Conversion" value="4.1%" delta="+0.3%" tone="positive" icon="workspace_premium" />
            <StitchKpi label="Revenue (30d)" value="$348k" delta="+18%" icon="payments" />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <StitchCard>
              <StitchCardHeader icon="filter_alt" title="Purchase → Pass Funnel" description="Last 30 days across all types" />
              <div className="space-y-3">
                {[
                  { l: "Purchases", v: 634, pct: 100 },
                  { l: "Started trading", v: 561, pct: 88 },
                  { l: "Passed Phase 1", v: 60, pct: 9.5 },
                  { l: "Passed Phase 2", v: 38, pct: 6 },
                  { l: "Funded", v: 26, pct: 4.1 },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-ink">{s.l}</span><span className="font-mono text-ink-variant">{s.v}</span></div>
                    <StitchProgress value={s.pct} tone={s.pct > 50 ? "info" : s.pct > 8 ? "warning" : "positive"} />
                  </div>
                ))}
              </div>
            </StitchCard>
            <StitchCard>
              <StitchCardHeader icon="leaderboard" title="Pass Rate by Type" />
              <div className="space-y-3">
                {[
                  { l: "2-Phase Standard", v: 9.4 },
                  { l: "1-Phase Turbo", v: 14.2 },
                  { l: "Instant Funded", v: 21.8 },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-ink">{s.l}</span><span className="font-mono font-bold text-tp">{s.v}%</span></div>
                    <StitchProgress value={s.v * 4} tone="positive" />
                  </div>
                ))}
              </div>
            </StitchCard>
          </div>
        </>
      ) : (
        <StitchCard><StitchEmpty icon="monitoring" title="No analytics data yet" body="Charts populate once the first challenge is purchased and traded." /></StitchCard>
      )}

      <StitchSheet
        open={saveOpen} onOpenChange={setSaveOpen} icon="bookmark" title="Save view"
        footer={<><StitchButton variant="surface" onClick={() => setSaveOpen(false)}>Cancel</StitchButton><StitchButton variant="primary" onClick={() => { setSaveOpen(false); toast({ title: "View saved" }); }}>Save</StitchButton></>}
      >
        <div className="space-y-3">
          <Field label="View Name"><Input className="stitch-input" placeholder="Monthly ops review" /></Field>
          <Field label="Make default"><Switch defaultChecked={false} /></Field>
        </div>
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ NEW — Phase Migration Tool (phase-migration-tool) ═══════════════ */

export function PhaseMigrationToolStitchPage() {
  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="move_up"
        title="Phase Migration Tool"
        subtitle="Move cohorts of traders between phases after objective or policy changes."
        actions={<StitchButton variant="surface" icon="history" onClick={() => setHistoryOpen(true)}>Migration History</StitchButton>}
      />

      <StitchCard>
        <StitchCardHeader icon="move_up" title="New migration" description="Preview the affected cohort before executing" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From Phase"><Select_><option>Phase 1 — Evaluation (old rules)</option></Select_></Field>
          <Field label="To Phase"><Select_><option>Phase 1 — Evaluation (new rules)</option></Select_></Field>
          <Field label="Cohort Filter"><Select_><option>All active traders (1,240)</option><option>Only traders above 50% progress (318)</option></Select_></Field>
          <Field label="Notify traders"><Select_><option>Yes — email + portal</option><option>No</option></Select_></Field>
        </div>
        <div className="mt-4 rounded-xl bg-tp-fixed/40 p-4">
          <p className="text-xs font-bold text-tp-fixed-variant">Impact preview</p>
          <p className="mt-1 text-xs text-ink-variant">1,240 accounts will switch objective sets. Drawdown baselines are recalculated on next daily reset. Estimated duration: 6 minutes.</p>
        </div>
        <div className="mt-3"><StitchButton variant="primary" icon="rocket_launch" onClick={() => setExecuteOpen(true)}>Execute Migration</StitchButton></div>
      </StitchCard>

      <StitchConfirm
        open={executeOpen} onOpenChange={setExecuteOpen} icon="rocket_launch"
        title="Execute migration for 1,240 accounts?"
        body="Objective sets switch at the next daily reset. Traders keep their equity and progress. This is logged as a single audited migration."
        confirmLabel="Execute"
        onConfirm={() => toast({ title: "Migration started" })}
      />

      <StitchSheet
        open={historyOpen} onOpenChange={setHistoryOpen} icon="history" wide
        title="Migration history"
        footer={<StitchButton variant="primary" onClick={() => setHistoryOpen(false)}>Close</StitchButton>}
      >
        <StitchTable
          keyOf={(r) => r.id}
          rows={[
            { id: "mig-31", from: "P1 old", to: "P1 new", count: 988, by: "Sarah Chen", at: "May 12 08:00", status: "completed" },
            { id: "mig-30", from: "P2 old", to: "P2 new", count: 402, by: "Sarah Chen", at: "May 12 08:06", status: "completed" },
            { id: "mig-29", from: "P1 old", to: "P1 new", count: 51, by: "Aiden Lloyd", at: "Apr 30 15:22", status: "partial" },
          ]}
          columns={[
            { header: "Run", cell: (r) => <StitchMonoChip>{r.id}</StitchMonoChip> },
            { header: "From → To", cell: (r) => `${r.from} → ${r.to}` },
            { header: "Accounts", cell: (r) => r.count, numeric: true },
            { header: "By", cell: (r) => r.by },
            { header: "When", cell: (r) => r.at },
            { header: "Status", cell: (r) => <StitchStateBadge state={r.status} tone={r.status === "completed" ? "positive" : "warning"} /> },
          ]}
        />
      </StitchSheet>
    </div>
  );
}

/* ═══════════════ NEW — Bulk Phase Editor (bulk-phase-editor) ═══════════════ */

export function BulkPhaseEditorStitchPage() {
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(new Set(["2-Phase Standard"]));
  const [target, setTarget] = React.useState("5%");

  return (
    <div className="flex flex-col gap-6">
      <StitchPageHeader
        icon="edit_attributes"
        title="Bulk Phase Editor"
        subtitle="Apply one objective change across many challenge types at once."
        actions={<StitchButton variant="surface" icon="history" onClick={() => setHistoryOpen(true)}>Edit History</StitchButton>}
      />

      <StitchCard>
        <StitchCardHeader icon="checklist" title="1 · Select challenge types" />
        <div className="grid gap-2 sm:grid-cols-3">
          {["2-Phase Standard", "1-Phase Turbo", "Instant Funded"].map((t) => (
            <label key={t} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold", selectedTypes.has(t) ? "bg-tp-fixed/50 text-tp-fixed-variant ring-1 ring-tp" : "bg-sfc-low text-ink")}>
              <Checkbox checked={selectedTypes.has(t)} onCheckedChange={() => setSelectedTypes((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; })} className="border-ink-variant/40" />
              {t}
            </label>
          ))}
        </div>
      </StitchCard>

      <StitchCard>
        <StitchCardHeader icon="tune" title="2 · Choose the objective change" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Field"><Select_><option>Daily Drawdown %</option><option>Max Drawdown %</option><option>Profit Target %</option><option>Min Trading Days</option></Select_></Field>
          <Field label="New Value"><Input className="stitch-input" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        </div>
        <div className="mt-4 rounded-xl bg-tt-fixed/40 p-4">
          <p className="text-xs font-bold text-tt-fixed-variant">Live preview</p>
          <p className="mt-1 text-xs text-ink-variant">Daily Drawdown will change to <strong className="text-ink">{target}</strong> for {selectedTypes.size} challenge type(s), affecting all future purchases.</p>
        </div>
        <div className="mt-3"><StitchButton variant="primary" icon="apply" onClick={() => setApplyOpen(true)}>Apply Change</StitchButton></div>
      </StitchCard>

      <StitchConfirm
        open={applyOpen} onOpenChange={setApplyOpen} icon="publish"
        title={`Apply to ${selectedTypes.size} challenge types?`}
        body="The objective change goes live for new purchases immediately and is logged with your admin ID."
        confirmLabel="Apply"
        onConfirm={() => { setApplyOpen(false); toast({ title: "Bulk edit applied" }); }}
      />

      <StitchSheet
        open={historyOpen} onOpenChange={setHistoryOpen} icon="history" wide
        title="Bulk edit history"
        footer={<StitchButton variant="primary" onClick={() => setHistoryOpen(false)}>Close</StitchButton>}
      >
        <StitchTable
          keyOf={(r) => r.id}
          rows={[
            { id: "be-19", field: "Daily DD", from: "6%", to: "5%", types: 2, by: "Sarah Chen", at: "May 27 11:04" },
            { id: "be-18", field: "Min Days", from: "4", to: "5", types: 1, by: "Aiden Lloyd", at: "May 19 09:40" },
          ]}
          columns={[
            { header: "Edit", cell: (r) => <StitchMonoChip>{r.id}</StitchMonoChip> },
            { header: "Field", cell: (r) => r.field },
            { header: "From → To", cell: (r) => <span className="font-mono text-[10px]">{r.from} → <strong className="text-tp">{r.to}</strong></span> },
            { header: "Types", cell: (r) => r.types, numeric: true },
            { header: "By", cell: (r) => r.by },
            { header: "When", cell: (r) => r.at },
          ]}
        />
      </StitchSheet>
    </div>
  );
}
