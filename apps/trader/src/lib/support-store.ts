/**
 * Support ticket store — frontend-only persistence for tickets created
 * (or closed) in this browser. Fixture tickets stay static; this store
 * layers local-created tickets on top and tracks which ids the user has
 * closed, so the support list and ticket detail stay in sync across
 * pages via localStorage.
 *
 * No backend calls (PRD §3.11 POST /support/tickets is mocked).
 */

export interface SupportTicketMessage {
  author: string;
  at: string;
  body: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: "open" | "answered" | "closed";
  priority: "high" | "normal" | "low";
  updatedAt: string;
  messages: SupportTicketMessage[];
}

const TICKETS_KEY = "terra-support-tickets-v1";
const CLOSED_KEY = "terra-support-closed-v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

/** Locally created tickets (newest first). Empty during SSG. */
export function loadLocalTickets(): SupportTicket[] {
  if (!isBrowser()) return [];
  return safeParse<SupportTicket[]>(localStorage.getItem(TICKETS_KEY), []);
}

export function saveLocalTickets(tickets: SupportTicket[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
}

/** Ids the user has closed — applies to fixture AND local tickets. */
export function loadClosedIds(): string[] {
  if (!isBrowser()) return [];
  return safeParse<string[]>(localStorage.getItem(CLOSED_KEY), []);
}

export function saveClosedIds(ids: string[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(CLOSED_KEY, JSON.stringify(ids));
}

/** Create a ticket — id scheme avoids fixture ids (tk-1024/1019/1012). */
export function createTicket(input: {
  subject: string;
  category: string;
  priority: SupportTicket["priority"];
  message: string;
}): SupportTicket {
  const existing = loadLocalTickets();
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: `tk-${1200 + existing.length}`,
    subject: input.subject,
    category: input.category,
    status: "open",
    priority: input.priority,
    updatedAt: now,
    messages: [{ author: "Tom Allen", at: now, body: input.message }],
  };
  saveLocalTickets([ticket, ...existing]);
  return ticket;
}

export function closeTicket(id: string): void {
  const ids = loadClosedIds();
  if (!ids.includes(id)) saveClosedIds([...ids, id]);
}

export function reopenTicket(id: string): void {
  saveClosedIds(loadClosedIds().filter((x) => x !== id));
}

/** Append the user's reply to a locally created ticket's thread. */
export function appendLocalReply(id: string, body: string): boolean {
  const locals = loadLocalTickets();
  const idx = locals.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  const updated = [...locals];
  updated[idx] = {
    ...updated[idx],
    updatedAt: new Date().toISOString(),
    messages: [
      ...updated[idx].messages,
      { author: "Tom Allen", at: new Date().toISOString(), body },
    ],
  };
  saveLocalTickets(updated);
  return true;
}
