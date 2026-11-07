"use client";

/**
 * R3-04 — Trader Communication History (R3-F06).
 *
 * Trader-side mirror of the message archive: a timeline of everything the
 * firm dispatched — channel icon, campaign/flow attribution, subject, date,
 * status — with a "Why did I get this?" evidence sheet that resolves the
 * segment rule and consent state captured at send time (AC-2, R2-F04
 * snapshot) and offers a per-message unsubscribe mirroring the tokenized
 * /unsubscribe route (AC-3 writes the N17 preference matrix).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TerraBadge, TerraCard, TerraEmpty, TerraPageHeader, TerraSectionTitle, TerraStat } from "@/components/terra/terra-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  Bell, ExternalLink, Info, Mail, MessageSquare, Smartphone, Undo2, Inbox,
} from "lucide-react";
import {
  listComms, commsStats, getComm, markOpened, optOutFromMessage, prefsNow,
  type CommChannel, type CommMessage, type CommStatus,
} from "@/lib/comms-history";
import { TOPIC_LABEL, type MarketingChannel } from "@/lib/marketing-preferences";

const CH_ICON = { email: Mail, sms: Smartphone, whatsapp: MessageSquare, push: Bell } as const;
const STATUS_TONE: Record<CommStatus, "success" | "primary" | "neutral" | "error"> = {
  opened: "success", delivered: "primary", sent: "neutral", bounced: "error",
};

export function CommsHistoryPage() {
  const [channel, setChannel] = useState<"all" | CommChannel>("all");
  const [status, setStatus] = useState<"all" | CommStatus>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(prefsNow());
  const stats = commsStats();

  useEffect(() => { setPrefs(prefsNow()); }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listComms().filter(m =>
      (channel === "all" || m.channel === channel) &&
      (status === "all" || m.status === status) &&
      (!needle || `${m.subject} ${m.campaign ?? ""} ${m.flow ?? ""} ${m.preview} ${m.body}`.toLowerCase().includes(needle)),
    );
  }, [channel, status, q]);

  const open = openId ? getComm(openId) : undefined;
  useEffect(() => {
    if (open && open.status === "delivered") {
      const updated = markOpened(open.id);
      if (updated) setOpenId(updated.id); // AC-1: timeline reflects the read
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title="Communication History"
        description="Everything the firm sent you — campaign attribution, delivery status and the evidence for why you received it."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/marketing-preferences">Marketing preferences</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/notification-preferences">Notification settings</Link>
            </Button>
          </>
        }
      />

      {/* Stats */}
      <TerraCard className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TerraStat label="Received" value={stats.total} sub={`${stats.byChannel.email} email · ${stats.byChannel.sms} sms · ${stats.byChannel.whatsapp} wa · ${stats.byChannel.push} push`} />
          <TerraStat label="Opened" value={stats.opened} sub={`${stats.total ? Math.round((stats.opened / stats.total) * 100) : 0}% of messages`} tone="positive" />
          <TerraStat label="Transactional" value={stats.transactional} sub="Not affected by opt-out" />
          <TerraStat label="Bounced" value={stats.bounced} tone={stats.bounced ? "negative" : "neutral"} sub="Delivery failures" />
        </div>
      </TerraCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={channel} onValueChange={v => setChannel(v as "all" | CommChannel)}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {(["email", "sms", "whatsapp", "push"] as CommChannel[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => setStatus(v as "all" | CommStatus)}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {(["delivered", "opened", "sent", "bounced"] as CommStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject, campaign, body…" className="h-9 max-w-sm text-xs" />
      </div>

      {/* Timeline */}
      <section>
        <TerraSectionTitle
          title="Received communications"
          description={`${rows.length} of ${stats.total} messages · newest first`}
        />
        {rows.length === 0 ? (
          <TerraEmpty
            icon={<Inbox className="h-6 w-6" />}
            title="No messages match"
            description="Clear the search or widen the channel/status filters."
          />
        ) : (
          <div className="space-y-2">
            {rows.map(m => {
              const Icon = CH_ICON[m.channel];
              return (
                <TerraCard key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                      <Icon className="h-4 w-4 text-on-surface-variant" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-on-surface">{m.subject}</span>
                        <TerraBadge tone={STATUS_TONE[m.status]} dot>{m.status}</TerraBadge>
                        {m.transactional && <Badge variant="secondary" className="text-[9px]">transactional</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                        {m.campaign ? `Campaign: ${m.campaign}` : `${m.flow}${m.step ? ` · ${m.step}` : ""}`}
                        {" · "}{new Date(m.sentAt).toLocaleString()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-on-surface-variant opacity-80">{m.preview}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpenId(m.id)}>
                      <Info className="mr-1 h-3.5 w-3.5" /> Why did I get this?
                    </Button>
                  </div>
                </TerraCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Evidence sheet: attribution + send-time snapshot + opt-out (AC-2/AC-3) */}
      <Sheet open={!!open} onOpenChange={o => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Why did I get this?</SheetTitle>
            <SheetDescription>Resolved from the content snapshot captured at send time (R2-F04).</SheetDescription>
          </SheetHeader>
          {open && (
            <WhySheet
              m={open}
              prefs={prefs}
              onPrefsChanged={() => setPrefs(prefsNow())}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Why-sheet                                                           */
/* ------------------------------------------------------------------ */

function WhySheet({
  m, prefs, onPrefsChanged,
}: {
  m: CommMessage;
  prefs: ReturnType<typeof prefsNow>;
  onPrefsChanged: () => void;
}) {
  const Icon = CH_ICON[m.channel];
  const current = m.transactional ? null : prefs[m.topic][m.channel as MarketingChannel];

  function optOut() {
    const res = optOutFromMessage(m.id);
    if (!res.ok) {
      toast({ title: "Not applicable", description: res.reason, variant: "destructive" });
      return;
    }
    onPrefsChanged();
    toast({
      title: "Opted out",
      description: res.detail + " Preference Center updated (receipt " + res.receipt.id + ").",
    });
  }

  return (
    <div className="space-y-4 px-4 pb-4 text-sm">
      {/* Attribution (AC-1) */}
      <TerraCard className="space-y-1.5 p-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <Icon className="h-3.5 w-3.5" /> Attribution
        </p>
        <p className="text-sm font-semibold">{m.subject}</p>
        <p className="text-xs text-on-surface-variant">
          {m.campaign ? `Campaign: ${m.campaign}` : `Flow: ${m.flow}${m.step ? ` · ${m.step}` : ""}`}
          {" · "}{m.channel} · {new Date(m.sentAt).toLocaleString()}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <TerraBadge tone={STATUS_TONE[m.status]}>{m.status}</TerraBadge>
          <TerraBadge tone="neutral">{TOPIC_LABEL[m.topic]}</TerraBadge>
          {m.transactional && <TerraBadge tone="tertiary">transactional</TerraBadge>}
        </div>
        <p className="text-xs text-on-surface-variant">{m.body}</p>
      </TerraCard>

      {/* Send-time snapshot (AC-2) */}
      <TerraCard className="space-y-1.5 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Resolved at send time</p>
        <dl className="space-y-1 text-xs">
          <Row label="Segment" value={m.why.segment} />
          <Row label="Segment rule" value={m.why.segmentRule} mono />
          <Row label="Consent at send" value={m.why.consentAtSend} />
          <Row label="Triggered by" value={m.why.trigger} />
          <Row label="Content snapshot" value={m.why.snapshotId} mono />
          <Row label="Captured" value={new Date(m.why.capturedAt).toLocaleString()} />
        </dl>
        <p className="text-[11px] text-on-surface-variant opacity-80">
          Snapshots freeze the rule and consent state as they were when the send resolved — the
          current preference state can differ (see below).
        </p>
      </TerraCard>

      {/* Now vs then + opt-out (AC-3) */}
      <TerraCard className="space-y-2 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Your preferences now</p>
        {m.transactional ? (
          <p className="text-xs text-on-surface-variant">
            Transactional messages are security/service traffic — marketing opt-out does not apply.
          </p>
        ) : (
          <p className="text-xs text-on-surface-variant">
            {TOPIC_LABEL[m.topic]} on <strong>{m.channel}</strong> is currently{" "}
            <strong className={current ? "text-primary" : "text-error"}>{current ? "ON" : "OFF"}</strong>{" "}
            <span className="opacity-80">(at send: {m.why.consentAtSend})</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={m.transactional} onClick={optOut}>
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Opt out of this topic/channel
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
            <a href={`/unsubscribe?token=${m.unsubToken}`}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Link as delivered
            </a>
          </Button>
        </div>
        <p className="text-[11px] text-on-surface-variant opacity-80">
          The link above is the tokenized unsubscribe URL this message carried — the same route the
          firm&rsquo;s campaigns use. Opt-out writes the Preference Center matrix and issues a receipt.
        </p>
      </TerraCard>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="sm:w-32 shrink-0 text-on-surface-variant">{label}:</dt>
      <dd className={mono ? "font-mono break-all" : "text-on-surface"}>{value}</dd>
    </div>
  );
}
