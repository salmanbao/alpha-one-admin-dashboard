"use client";

/**
 * Ticket Detail — converted from stitch_screens/ticket_detail
 * Message thread with reply composer. Looks up locally created tickets
 * first (localStorage), then fixtures; supports close/reopen
 * (PRD §3.11 PATCH /support/tickets/:id — local-state demo).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { supportTickets } from "@/lib/fixtures/terra-fixtures";
import {
  appendLocalReply,
  closeTicket,
  loadClosedIds,
  loadLocalTickets,
  reopenTicket,
  type SupportTicket,
} from "@/lib/support-store";

export function TicketDetailPage() {
  const params = useSearchParams();
  const [localTickets, setLocalTickets] = useState<SupportTicket[]>([]);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Hydrate after mount — localStorage is unavailable during SSG.
  useEffect(() => {
    setLocalTickets(loadLocalTickets());
    setClosedIds(loadClosedIds());
  }, []);

  const requestedId = params.get("id");
  const found =
    [...localTickets, ...supportTickets].find((t) => t.id === requestedId) ??
    supportTickets[0];
  const isClosed = closedIds.includes(found.id);
  const ticket: SupportTicket = isClosed ? { ...found, status: "closed" } : found;
  const ticketNo = ticket.id.replace("tk-", "");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleClose = () => {
    closeTicket(ticket.id);
    setClosedIds((prev) => (prev.includes(ticket.id) ? prev : [...prev, ticket.id]));
    flash(`Ticket #${ticketNo} closed — you can reopen it any time. (Demo)`);
  };

  const handleReopen = () => {
    reopenTicket(ticket.id);
    setClosedIds((prev) => prev.filter((id) => id !== ticket.id));
    flash(`Ticket #${ticketNo} reopened — the team will pick it up again. (Demo)`);
  };

  const handleSendReply = () => {
    const body = reply.trim();
    if (!body || isClosed) return;
    // Persist replies on locally created tickets; fixture threads stay static.
    const updated = appendLocalReply(ticket.id, body);
    if (updated) setLocalTickets(loadLocalTickets());
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
        description={`Ticket #${ticketNo} • ${ticket.category}`}
        actions={
          <>
            <TerraBadge
              tone={ticket.status === "open" ? "primary" : ticket.status === "answered" ? "tertiary" : "neutral"}
              dot={ticket.status === "open"}
            >
              {ticket.status}
            </TerraBadge>
            {isClosed ? (
              <button
                type="button"
                onClick={handleReopen}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Reopen ticket
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-error-container px-4 py-2 text-sm font-bold text-on-error-container hover:bg-error-container/80"
              >
                Close ticket
              </button>
            )}
          </>
        }
      />

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          {notice}
        </div>
      )}

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

      {isClosed ? (
        <TerraCard>
          <div className="space-y-3 text-center">
            <p className="text-sm font-bold text-on-surface">
              This ticket is closed.
            </p>
            <p className="text-xs text-on-surface-variant">
              The thread stays readable above. Reopen it to continue the
              conversation, or create a new ticket from the Support page.
            </p>
            <button
              type="button"
              onClick={handleReopen}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Reopen ticket
            </button>
          </div>
        </TerraCard>
      ) : (
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
      )}
    </div>
  );
}
