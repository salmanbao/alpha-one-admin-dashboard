"use client";

/**
 * M4.1 — Campaign Composer (spec §8.1).
 *
 * Four-step guided composer: 1 Channel & Template → 2 Audience →
 * 3 Schedule → 4 Review, with a 15 s autosave chip, live template
 * preview (desktop/mobile), consent-aware audience step (reads the M3
 * segments store) and a blocking pre-launch checklist.
 *
 * Deep links: `?view=campaign-new&segment=<id>` preselects an audience
 * (used by the M3 segment builder’s "Save & Create Campaign").
 *
 * Dummy data only — launching writes a campaign into the studio store.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Monitor,
  Phone,
  Rocket,
  Save,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { getSegment, listSegments } from "../segments-store";
import { relativeTime } from "@/modules/integrations/format";
import {
  CHANNEL_LABEL,
  EMPTY_DRAFT,
  createCampaign,
  excludedCount,
  getCampaign,
  getStudioTemplate,
  listStudioTemplates,
  runChecklist,
  type Channel,
  type CheckResult,
  type ComposerDraft,
} from "../campaign-studio-store";

const STEPS = ["Channel & Template", "Audience", "Schedule", "Review"] as const;

const CHANNELS: Array<{ value: Channel; icon: typeof Mail; available: boolean; note?: string }> = [
  { value: "email", icon: Mail, available: true },
  { value: "sms", icon: MessageSquare, available: true },
  { value: "whatsapp", icon: Phone, available: true, note: "Template approval pending for promo category" },
  { value: "push", icon: Bell, available: true },
];

const SAMPLE_DATA: Record<string, string> = {
  firm_name: "ApexFunded",
  currency: "USD",
  first_name: "Alex",
  month: "November",
  verify_link: "https://app.example.com/verify",
  payout_amount: "$1,240.00",
  referral_link: "https://apex.example.com/r/alex82",
  plan_name: "Scaling Plan",
  tier_rate: "15%",
  winback_offer: "50% off your next challenge",
  last_login_days: "34",
  discount_code: "SCALE50",
  recovery_offer: "Free reset token",
  terms_version: "v4.2",
  payout: "",
};

function resolve(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE_DATA[key] ?? `{{${key}}}`);
}

const DEFAULT_SUBJECT = "Your next move, {{first_name}}";
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nBig things are cooking at {{firm_name}} this week — log in to see what’s waiting for you.\n\n— The {{firm_name}} team";

export function CampaignComposerPage() {
  const { router, navigate } = usePlatform();

  /* Deep link preselection (?view=campaign-new&segment=…, &campaign=…, &date=…, &step=…) */
  const [step, setStep] = useState(() => {
    const s = router.params.step;
    return s === "3" ? 2 : Number(s) >= 1 && Number(s) <= 4 ? Number(s) - 1 : 0;
  });
  const [draft, setDraft] = useState<ComposerDraft>(() => {
    const seg = router.params.segment ?? "";
    const existing = router.params.campaign ? getCampaign(router.params.campaign) : undefined;
    const date = router.params.date ?? "";
    if (existing) {
      return {
        ...EMPTY_DRAFT,
        name: existing.name,
        channel: existing.channel,
        templateId: existing.templateId ?? "",
        segmentId: existing.segmentId,
        subject: existing.subject,
        body: existing.body,
        abEnabled: existing.abEnabled,
        mode: date || existing.scheduledAt ? "scheduled" : "now",
        scheduledAt: date ? `${date}T10:00` : existing.scheduledAt ? existing.scheduledAt.slice(0, 16) : "",
      };
    }
    if (date) {
      return { ...EMPTY_DRAFT, segmentId: seg, channel: "email", mode: "scheduled", scheduledAt: `${date}T10:00` };
    }
    return { ...EMPTY_DRAFT, segmentId: seg, channel: "email" };
  });
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [quotaOk, setQuotaOk] = useState(true);
  const [providerHealthy, setProviderHealthy] = useState(false); // starts degraded → blocks launch, retry fixes it
  const [probing, setProbing] = useState(false);
  const [checkHighlight, setCheckHighlight] = useState<string | null>(null);
  const checklistRef = useRef<HTMLDivElement>(null);

  const patch = (p: Partial<ComposerDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  /* Autosave every 15 s when dirty */
  useEffect(() => {
    const iv = setInterval(() => {
      setDirty((d) => {
        if (d) {
          setSavedAt(new Date());
          return false;
        }
        return d;
      });
    }, 15_000);
    return () => clearInterval(iv);
  }, []);

  /* Abandoning with unsaved changes prompts */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const segment = draft.segmentId ? getSegment(draft.segmentId) : undefined;
  const template = draft.templateId ? getStudioTemplate(draft.templateId) : undefined;

  const checklist = useMemo(
    () =>
      runChecklist({
        subject: draft.subject || DEFAULT_SUBJECT,
        body: draft.body || DEFAULT_BODY,
        channel: draft.channel,
        segment,
        autoExclude: draft.autoExclude,
        providerHealthy,
        quotaOk,
      }),
    [draft, segment, providerHealthy, quotaOk],
  );
  const blocking = checklist.filter((c) => c.blocking && c.status === "fail");

  const canNext =
    step === 0 ? (draft.channel === "email" ? draft.subject.trim().length > 0 : true) : true;

  function goNext() {
    if (!canNext) {
      toast({ title: "Subject required", description: "Email campaigns need a subject line before review." });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function retryProbe(key: "quota" | "provider") {
    setProbing(true);
    setTimeout(() => {
      if (key === "provider") setProviderHealthy(true);
      else setQuotaOk(true);
      setProbing(false);
      toast({ title: "Health probe passed", description: `${key === "provider" ? "Provider" : "Channel quota"} is nominal again.` });
    }, 800);
  }

  function launch() {
    if (blocking.length > 0) {
      setCheckHighlight(blocking[0].key);
      checklistRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast({
        title: "Launch blocked",
        description: `${blocking.length} blocking check${blocking.length > 1 ? "s" : ""} must pass — see the checklist.`,
      });
      return;
    }
    if (!segment) {
      toast({ title: "Audience required", description: "Pick a segment in step 2 first." });
      setStep(1);
      return;
    }
    const scheduled = draft.mode === "scheduled" && draft.scheduledAt;
    const when = scheduled ? new Date(draft.scheduledAt) : new Date();
    const campaign = createCampaign({
      name: draft.name.trim() || draft.subject.slice(0, 40) || "Untitled campaign",
      channel: draft.channel,
      segmentId: segment.id,
      segmentName: segment.name,
      status: scheduled ? "scheduled" : "sent",
      scheduledAt: when.toISOString(),
      day: scheduled ? draft.scheduledAt.slice(0, 10) : undefined,
      sentAt: scheduled ? undefined : new Date().toISOString(),
      audienceSize: draft.autoExclude ? segment.size - excludedCount(segment) : segment.size,
      templateId: draft.templateId || undefined,
      subject: draft.subject || DEFAULT_SUBJECT,
      body: draft.body || DEFAULT_BODY,
      abEnabled: draft.abEnabled,
    });
    toast({
      title: scheduled ? "Campaign scheduled" : "Campaign launched",
      description: `${campaign.name} → ${campaign.audienceSize.toLocaleString()} recipients on ${CHANNEL_LABEL[campaign.channel]}.`,
    });
    setDirty(false);
    navigate("marketing-campaigns");
  }

  function saveDraft() {
    const campaign = createCampaign({
      name: draft.name.trim() || "Untitled draft",
      channel: draft.channel,
      segmentId: draft.segmentId,
      segmentName: segment?.name ?? "",
      status: "draft",
      audienceSize: segment?.size ?? 0,
      templateId: draft.templateId || undefined,
      subject: draft.subject,
      body: draft.body,
      abEnabled: draft.abEnabled,
    });
    setDirty(false);
    setSavedAt(new Date());
    toast({ title: "Draft saved", description: `${campaign.name} is in your campaign list.` });
    navigate("marketing-campaigns");
  }

  function discard() {
    setDraft({ ...EMPTY_DRAFT });
    setDirty(false);
    setSavedAt(null);
    setStep(0);
    toast({ title: "Draft discarded", description: "All unsaved changes were cleared." });
  }

  return (
    <Page>
      <PageHeader
        title={draft.name.trim() || "New Campaign"}
        description="Channel, audience, schedule and preflight — four steps from blank to launched."
        icon={Rocket}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {dirty
                ? "Unsaved changes…"
                : savedAt
                  ? `Saved ${Math.max(1, Math.round((Date.now() - savedAt.getTime()) / 1000))}s ago`
                  : "No changes yet"}
            </span>
            <Button variant="outline" size="sm" onClick={saveDraft}>
              <Save className="mr-1 h-4 w-4" /> Save draft
            </Button>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={discard}>
                Discard
              </Button>
            )}
          </div>
        }
      />

      <PageContent>
        {/* Campaign name + stepper */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Campaign name (e.g. Win-back wave 3)"
              className="max-w-sm font-medium"
              aria-label="Campaign name"
            />
            <ol className="flex flex-wrap items-center gap-1" aria-label="Composer steps">
              {STEPS.map((s, i) => {
                const state = i === step ? "current" : i < step ? "done" : "todo";
                return (
                  <li key={s} className="flex items-center">
                    <button
                      type="button"
                      disabled={i > step}
                      onClick={() => i < step && setStep(i)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        state === "current"
                          ? "bg-primary text-primary-foreground"
                          : state === "done"
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-muted text-muted-foreground"
                      } ${i < step ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background/25 text-[10px]">
                        {state === "done" ? <Check className="h-2.5 w-2.5" /> : i + 1}
                      </span>
                      {s}
                    </button>
                    {i < STEPS.length - 1 && <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* ─────────── Step 1 — Channel & Template ─────────── */}
        {step === 0 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Channel</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      disabled={!c.available}
                      onClick={() => patch({ channel: c.value })}
                      className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                        draft.channel === c.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      } ${!c.available ? "opacity-50" : ""}`}
                    >
                      <c.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{CHANNEL_LABEL[c.value]}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.available ? (c.note ?? "Channel enabled (M2)") : "Unavailable"}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Template</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => navigate("marketing-templates")}>
                      Browse library
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {listStudioTemplates().length === 0 ? (
                    <EmptyState
                      title="No templates yet"
                      description="Create one in the template editor to get started."
                      action={<Button size="sm" onClick={() => navigate("marketing-templates")}>Open library</Button>}
                    />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => patch({ templateId: "", subject: draft.subject, body: draft.body })}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          !draft.templateId ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                        }`}
                      >
                        <span className="text-sm font-medium">Blank</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">Write from scratch.</span>
                      </button>
                      {listStudioTemplates().map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            patch({
                              templateId: t.id,
                              subject: (t.subject ?? draft.subject) || DEFAULT_SUBJECT,
                              body: (t.body ?? draft.body) || DEFAULT_BODY,
                            })
                          }
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            draft.templateId === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="text-sm font-medium">{t.name}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">{t.outcome}</span>
                          <span className="mt-1.5 block text-[10px] text-muted-foreground">
                            {t.placeholders.length} placeholders · used {t.usage}×
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Content — dual pane when A/B enabled */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Content</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ab-toggle" className="text-xs text-muted-foreground">A/B test</Label>
                      <Switch
                        id="ab-toggle"
                        checked={draft.abEnabled}
                        onCheckedChange={(v) => patch({ abEnabled: v })}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Subject {draft.abEnabled && "— Variant A"}</Label>
                    <Input
                      value={draft.subject}
                      onChange={(e) => patch({ subject: e.target.value })}
                      placeholder={DEFAULT_SUBJECT}
                    />
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={draft.body}
                      onChange={(e) => patch({ body: e.target.value })}
                      placeholder={DEFAULT_BODY}
                      rows={7}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Placeholders resolve per-tenant via the terminology engine.
                    </p>
                  </div>
                  {draft.abEnabled && (
                    <div className="space-y-2 rounded-lg border border-dashed p-3">
                      <Label className="text-xs">Subject — Variant B</Label>
                      <Input
                        value={draft.variantBSubject}
                        onChange={(e) => patch({ variantBSubject: e.target.value })}
                        placeholder="A different hook, same offer…"
                      />
                      <Label className="text-xs">Body</Label>
                      <Textarea
                        value={draft.variantBBody}
                        onChange={(e) => patch({ variantBBody: e.target.value })}
                        placeholder="Variant B copy…"
                        rows={7}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Live preview */}
            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Preview</CardTitle>
                    <div className="flex rounded-md border p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("desktop")}
                        className={`rounded p-1.5 ${previewMode === "desktop" ? "bg-muted" : ""}`}
                        aria-label="Desktop preview"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("mobile")}
                        className={`rounded p-1.5 ${previewMode === "mobile" ? "bg-muted" : ""}`}
                        aria-label="Mobile preview"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={`mx-auto rounded-lg border bg-background p-4 shadow-sm ${
                      previewMode === "mobile" ? "max-w-[280px]" : "max-w-none"
                    }`}
                  >
                    <p className="truncate text-xs font-semibold">{resolve(draft.subject || DEFAULT_SUBJECT)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {resolve(draft.body || DEFAULT_BODY)}
                    </p>
                    {draft.abEnabled && (
                      <p className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
                        Variant B preview: {resolve(draft.variantBSubject || "—")}
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-center text-[10px] text-muted-foreground">
                    Sample data · {previewMode === "mobile" ? "Mobile" : "Desktop"} · {CHANNEL_LABEL[draft.channel]}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─────────── Step 2 — Audience ─────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Segment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={draft.segmentId} onValueChange={(v) => patch({ segmentId: v })}>
                  <SelectTrigger aria-label="Select segment">
                    <SelectValue placeholder="Choose a saved segment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {listSegments().map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.size.toLocaleString()} members
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {segment ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {segment.size.toLocaleString()} members
                      </Badge>
                      <Badge variant="outline">
                        Freshness {relativeTime(segment.computedAt)}
                      </Badge>
                      <Badge variant={segment.consentCoverage < 70 ? "outline" : "secondary"}>
                        Consent coverage {segment.consentCoverage}%
                      </Badge>
                      {segment.status === "stale" && <Badge variant="destructive">Stale — recompute</Badge>}
                    </div>

                    {segment.consentCoverage < 100 && (
                      <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="text-sm font-medium">
                                {segment.consentCoverage}% consent coverage
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {draft.autoExclude
                                  ? `${excludedCount(segment).toLocaleString()} non-consented members will be auto-excluded.`
                                  : "Auto-exclude is OFF — the send gateway will still drop non-consented members."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="auto-exclude" className="text-xs">Auto-exclude</Label>
                            <Switch
                              id="auto-exclude"
                              checked={draft.autoExclude}
                              onCheckedChange={(v) => patch({ autoExclude: v })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Segment size</p>
                        <p className="text-lg font-semibold">{segment.size.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Excluded (no consent)</p>
                        <p className="text-lg font-semibold">
                          {draft.autoExclude ? excludedCount(segment).toLocaleString() : "0"}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 bg-primary/5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Final recipients</p>
                        <p className="text-lg font-semibold">
                          {(draft.autoExclude ? segment.size - excludedCount(segment) : segment.size).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No segment selected"
                    description="Pick a saved segment above, or build a new one in the Segment Builder."
                    action={
                      <Button size="sm" onClick={() => navigate("segments")}>
                        Open Segments
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─────────── Step 3 — Schedule ─────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => patch({ mode: "now" })}
                    className={`flex-1 rounded-lg border p-3 text-left ${
                      draft.mode === "now" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-medium">Send now</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Dispatches as soon as checks pass.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ mode: "scheduled" })}
                    className={`flex-1 rounded-lg border p-3 text-left ${
                      draft.mode === "scheduled" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-medium">Scheduled</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Pick a date & time.</span>
                  </button>
                </div>

                {draft.mode === "scheduled" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="sched-at" className="text-xs">Send at</Label>
                      <Input
                        id="sched-at"
                        type="datetime-local"
                        value={draft.scheduledAt}
                        onChange={(e) => patch({ scheduledAt: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-muted-foreground pb-2">
                        Timezone: <span className="font-mono">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="send-window" className="text-sm">Send window per recipient timezone</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deliver only inside each recipient’s local 09:00–18:00 window.
                    </p>
                  </div>
                  <Switch
                    id="send-window"
                    checked={draft.sendWindow}
                    onCheckedChange={(v) => patch({ sendWindow: v })}
                  />
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Quiet hours (M2.4 policy) are respected: sends are held between 22:00 and 07:00 in each
                    recipient’s timezone. Marketing sends never override the policy.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─────────── Step 4 — Review ─────────── */}
        {step === 3 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div ref={checklistRef}>
                <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Preflight checklist</CardTitle>
                    <Badge variant={blocking.length ? "destructive" : "secondary"}>
                      {blocking.length ? `${blocking.length} blocking` : "All checks passed"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checklist.map((c) => (
                    <ChecklistRow
                      key={c.key}
                      check={c}
                      highlighted={checkHighlight === c.key}
                      probing={probing}
                      onRetry={() => retryProbe(c.key as "quota" | "provider")}
                    />
                  ))}
                </CardContent>
                </Card>
              </div>

              {draft.abEnabled && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">A/B test</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Variant A</span>
                        <span>{draft.split}% / {100 - draft.split}%</span>
                        <span>Variant B</span>
                      </div>
                      <Slider
                        value={[draft.split]}
                        min={10}
                        max={90}
                        step={5}
                        onValueChange={(v) => patch({ split: v[0] })}
                        aria-label="Traffic split"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Winning metric</Label>
                      <Select
                        value={draft.winningMetric}
                        onValueChange={(v) => patch({ winningMetric: v as ComposerDraft["winningMetric"] })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open rate</SelectItem>
                          <SelectItem value="ctr">Click-through rate</SelectItem>
                          <SelectItem value="conversion">Conversion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The winner is decided 48h after send; the losing variant stops at 10% sample exhaustion.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <SummaryRow label="Campaign" value={draft.name.trim() || "—"} />
                  <SummaryRow label="Channel" value={CHANNEL_LABEL[draft.channel]} />
                  <SummaryRow label="Audience" value={segment ? `${segment.name} (${segment.size.toLocaleString()})` : "—"} />
                  <SummaryRow
                    label="Recipients"
                    value={
                      segment
                        ? (draft.autoExclude ? segment.size - excludedCount(segment) : segment.size).toLocaleString()
                        : "—"
                    }
                  />
                  <SummaryRow label="Timing" value={draft.mode === "now" ? "Send now" : draft.scheduledAt || "Not set"} />
                  <SummaryRow label="A/B" value={draft.abEnabled ? `Enabled (${draft.split}% split)` : "Off"} />
                  <Separator />
                  <div>
                    <Label htmlFor="test-send" className="text-xs">Test send</Label>
                    <Input
                      id="test-send"
                      value={draft.testSendTo}
                      onChange={(e) => patch({ testSendTo: e.target.value })}
                      placeholder="you@yourfirm.com, ops@yourfirm.com"
                      className="mt-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={!draft.testSendTo.trim()}
                      onClick={() =>
                        toast({
                          title: "Test send delivered",
                          description: `Preview sent to ${draft.testSendTo} on ${CHANNEL_LABEL[draft.channel]}.`,
                        })
                      }
                    >
                      <Send className="mr-1 h-3.5 w-3.5" /> Send test
                    </Button>
                  </div>
                  <Button className="w-full" disabled={blocking.length > 0} onClick={launch}>
                    <Rocket className="mr-1 h-4 w-4" />
                    {draft.mode === "scheduled" ? "Schedule" : "Launch"}
                  </Button>
                  {blocking.length > 0 && (
                    <p className="text-xs text-destructive text-center">
                      Fix {blocking.length} blocking check{blocking.length > 1 ? "s" : ""} to enable launch.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={launch} disabled={blocking.length > 0}>
              {draft.mode === "scheduled" ? "Schedule campaign" : "Launch campaign"}
            </Button>
          )}
        </div>
      </PageContent>
    </Page>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Sub-components                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-xs font-medium truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function ChecklistRow({
  check,
  highlighted,
  probing,
  onRetry,
}: {
  check: CheckResult;
  highlighted: boolean;
  probing: boolean;
  onRetry: () => void;
}) {
  const icon =
    check.status === "pass" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : check.status === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-amber-600" />
    ) : check.status === "pending" ? (
      <Clock className="h-4 w-4 text-muted-foreground" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  return (
    <div
      data-check={check.key}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        highlighted ? "border-destructive ring-1 ring-destructive/40" : ""
      } ${check.status === "fail" && check.blocking ? "border-destructive/50 bg-destructive/5" : ""}`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{check.label}</p>
          {check.blocking && check.status === "fail" && <Badge variant="destructive">Blocking</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
        {check.status === "fail" && check.fix && check.key !== "spam" && (
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-[11px] text-muted-foreground">{check.fix}</p>
            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" disabled={probing} onClick={onRetry}>
              {probing ? "Retrying…" : "Retry"}
            </Button>
          </div>
        )}
        {check.status === "fail" && check.key === "spam" && check.fix && (
          <p className="mt-1 text-[11px] text-muted-foreground">{check.fix}</p>
        )}
      </div>
    </div>
  );
}
