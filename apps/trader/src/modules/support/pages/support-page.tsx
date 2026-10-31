"use client";

/**
 * Support — converted from stitch_screens/support
 * Ticket list with status badges and new-ticket CTA,
 * plus the M20 "Live Chat Widget" (mocked, frontend-only).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { supportTickets } from "@/lib/fixtures/terra-fixtures";
import {
  createTicket,
  loadClosedIds,
  loadLocalTickets,
  type SupportTicket,
} from "@/lib/support-store";

const statusTone = {
  open: "primary",
  answered: "tertiary",
  closed: "neutral",
} as const;

const priorityTone = {
  high: "error",
  normal: "secondary",
  low: "neutral",
} as const;

interface ChatMessage {
  id: number;
  from: "agent" | "you";
  body: string;
}

const cannedReplies = [
  "Thanks Tom — I'm checking account #100030 now. One moment while I pull the latest sync.",
  "Good news: everything is in order. Is there anything else I can help you with?",
  "I've noted that on your account. You'll also get an email summary of this chat shortly.",
];

function LiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      from: "agent",
      body: "Hi Tom 👋 — you're chatting with Terra Support. How can we help today?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const nextId = useRef(2);
  const replyIdx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setMessages((m) => [...m, { id: nextId.current++, from: "you", body }]);
    setDraft("");
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextId.current++, from: "agent", body: cannedReplies[replyIdx.current++ % cannedReplies.length] },
      ]);
    }, 1100);
  };

  return (
    <TerraCard>
      <TerraSectionTitle
        title="Live chat"
        description="Fastest way to reach us — average first reply under 2 minutes."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed-variant">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Online
          </span>
        }
      />
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-surface-container-low p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.from === "you" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.from === "you"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-on-primary"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface shadow-sm"
              }
            >
              {m.body}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-surface-container-lowest px-4 py-3 text-sm shadow-sm">
              <span className="inline-flex gap-1" aria-label="Agent is typing">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant" />
              </span>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          aria-label="Live chat message"
          className="flex-1 rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Send
        </button>
      </form>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Demo chat — replies are canned and nothing is sent to a server.
      </p>
    </TerraCard>
  );
}

/**
 * Optional prefill — when the trader arrives from a failure surface
 * (e.g. checkout payment failure, finding #2) the composer opens with
 * the context already attached instead of a blank form.
 */
interface ComposerPrefill {
  subject: string;
  category: string;
  priority: "high" | "normal" | "low";
  message: string;
}

function NewTicketComposer({
  onCreated,
  prefill,
}: {
  onCreated: (t: SupportTicket) => void;
  prefill?: ComposerPrefill;
}) {
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [category, setCategory] = useState(prefill?.category ?? "Accounts");
  const [priority, setPriority] = useState<"high" | "normal" | "low">(
    prefill?.priority ?? "normal",
  );
  const [message, setMessage] = useState(prefill?.message ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 5) {
      setError("Subject must be at least 5 characters.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }
    // Frontend-only demo: persisted to localStorage, no API call.
    onCreated(
      createTicket({
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
      }),
    );
  };

  const inputClass =
    "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <TerraCard>
      <TerraSectionTitle
        title="New ticket"
        description="Tell us what's going on — we usually reply within 4 hours."
      />
      <form onSubmit={handleSubmit} className="space-y-3">
        {prefill && (
          <p className="rounded-lg bg-primary-fixed/40 px-3 py-2 text-xs font-semibold text-on-primary-fixed-variant">
            ✓ Context from your failed payment is pre-filled below — review and
            edit it before sending.
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Credentials not arriving for #92841"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {["Accounts", "Payouts", "Rules", "Platform", "KYC", "Billing"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className={inputClass}
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Message
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Describe the issue — include account/login numbers where relevant."
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs font-bold text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Create ticket
          </button>
        </div>
        <p className="text-right text-[11px] text-on-surface-variant">
          Demo — tickets are stored in this browser only.
        </p>
      </form>
    </TerraCard>
  );
}

export function SupportPage() {
  // Failure context carried from other surfaces (finding #2): when the
  // checkout's "Contact support" link arrives with ?topic=payment-failed
  // the composer opens pre-filled with the reason/method/amount/order.
  const search = useSearchParams();
  const paymentContext = (() => {
    if (search.get("topic") !== "payment-failed") return null;
    const challenge = search.get("challenge") ?? "Checkout";
    const amount = search.get("amount") ?? "—";
    const method = search.get("method") ?? "—";
    const reasonTitle = search.get("reasonTitle") ?? "Payment failure";
    const reasonCode = search.get("reason") ?? "unknown";
    return {
      subject: `Payment failed — ${challenge}`,
      category: "Billing",
      priority: "high" as const,
      message: [
        `Payment failed during checkout and I'd like help completing the purchase.`,
        ``,
        `Order: ${challenge}`,
        `Amount: ${amount}`,
        `Payment method: ${method}`,
        `Failure reason: ${reasonTitle} (code: ${reasonCode})`,
      ].join("\n"),
      summary: `${reasonTitle} · ${method} · ${amount} · ${challenge}`,
    };
  })();

  const [localTickets, setLocalTickets] = useState<SupportTicket[]>([]);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(paymentContext !== null);
  const [created, setCreated] = useState<SupportTicket | null>(null);

  // Hydrate after mount — localStorage is unavailable during SSG.
  useEffect(() => {
    setLocalTickets(loadLocalTickets());
    setClosedIds(loadClosedIds());
  }, []);

  const allTickets = [...localTickets, ...supportTickets].map((t) =>
    closedIds.includes(t.id) ? { ...t, status: "closed" as const } : t,
  );

  const handleCreated = (t: SupportTicket) => {
    setLocalTickets((prev) => [t, ...prev]);
    setComposerOpen(false);
    setCreated(t);
    setTimeout(() => setCreated(null), 6000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Support"
        description="We typically respond within 4 hours"
        actions={
          <>
            <Link
              href="/help-center"
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Help Center
            </Link>
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              {composerOpen ? "Cancel" : "+ New ticket"}
            </button>
          </>
        }
      />

      {created && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          ✓ Ticket #{created.id.replace("tk-", "")} created — you can track
          replies right here. (Demo — stored in this browser.)
        </div>
      )}

      {paymentContext && (
        <div
          role="status"
          className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm"
        >
          <p className="font-bold text-on-error-container">
            Payment failure context attached
          </p>
          <p className="mt-0.5 text-xs text-on-error-container/80">
            {paymentContext.summary} — the ticket form below is pre-filled with
            these details.
          </p>
        </div>
      )}

      {composerOpen && (
        <NewTicketComposer onCreated={handleCreated} prefill={paymentContext ?? undefined} />
      )}

      <div className="space-y-3">
        {allTickets.map((t) => (
          <Link key={t.id} href={`/ticket-detail?id=${t.id}`}>
            <TerraCard className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-on-surface-variant">
                    #{t.id.replace("tk-", "")}
                  </span>
                  <p className="text-sm font-bold text-on-surface">{t.subject}</p>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {t.category} • Updated{" "}
                  {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TerraBadge tone={priorityTone[t.priority]}>{t.priority}</TerraBadge>
                <TerraBadge tone={statusTone[t.status]} dot={t.status === "open"}>
                  {t.status}
                </TerraBadge>
              </div>
            </TerraCard>
          </Link>
        ))}
      </div>

      <LiveChat />
    </div>
  );
}
