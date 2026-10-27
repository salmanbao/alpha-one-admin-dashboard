"use client";

/**
 * Support — converted from stitch_screens/support
 * Ticket list with status badges and new-ticket CTA,
 * plus the M20 "Live Chat Widget" (mocked, frontend-only).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { supportTickets } from "@/lib/fixtures/terra-fixtures";

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

export function SupportPage() {
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
            <Link
              href="/ticket-detail"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + New ticket
            </Link>
          </>
        }
      />

      <div className="space-y-3">
        {supportTickets.map((t) => (
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
