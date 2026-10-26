"use client";

/**
 * Ticket Detail — converted from stitch_screens/ticket_detail
 * Message thread with reply composer.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { supportTickets } from "@/lib/fixtures/terra-fixtures";

export function TicketDetailPage() {
  const params = useSearchParams();
  const ticket =
    supportTickets.find((t) => t.id === params.get("id")) ?? supportTickets[0];
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);

  const handleSendReply = () => {
    if (!reply.trim()) return;
    setSent(true);
    setReply("");
    setTimeout(() => setSent(false), 3000);
  };

  const handleAttachFile = () => {
    setAttachment("screenshot.png");
    setTimeout(() => setAttachment(null), 2000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={ticket.subject}
        description={`Ticket #${ticket.id.replace("tk-", "")} • ${ticket.category}`}
        actions={
          <TerraBadge
            tone={ticket.status === "open" ? "primary" : ticket.status === "answered" ? "tertiary" : "neutral"}
            dot={ticket.status === "open"}
          >
            {ticket.status}
          </TerraBadge>
        }
      />

      <div className="space-y-4">
        {ticket.messages.map((m, i) => {
          const isSupport = m.author !== "Tom Allen";
          return (
            <TerraCard
              key={i}
              className={cn(isSupport && "bg-primary-fixed/30")}
            >
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                      isSupport ? "bg-primary text-on-primary" : "bg-secondary-container text-on-secondary-container",
                    )}
                  >
                    {m.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{m.author}</span>
                  {isSupport && <TerraBadge tone="primary">Terra team</TerraBadge>}
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  {new Date(m.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">{m.body}</p>
            </TerraCard>
          );
        })}
      </div>

      <TerraCard>
        <div className="flex flex-col gap-3">
          {sent && (
            <div className="rounded-lg bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant">
              ✓ Reply sent successfully!
            </div>
          )}
          {attachment && (
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              <span className="text-primary">📎</span> Attached: {attachment}
              <span className="text-xs">(will be included with reply)</span>
            </div>
          )}
          <textarea
            placeholder="Type your reply…"
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleAttachFile}
              className="rounded-xl bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Attach file
            </button>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!reply.trim()}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send reply
            </button>
          </div>
        </div>
      </TerraCard>
    </div>
  );
}
