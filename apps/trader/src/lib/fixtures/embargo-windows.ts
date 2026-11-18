/**
 * R9 W5 UC-T5 — Embargo windows (editorial schedule, Demo).
 *
 * A fixed demo editorial calendar: high-impact news blackouts and weekend
 * holds per symbol. The order ticket renders an amber notice while the
 * selected symbol is inside a window; market-watch badges each affected
 * symbol with its schedule.
 *
 * Honest labeling (§1 rule 3): this is an *editorial schedule (Demo)* —
 * a deterministic fixture, not a live news feed. Times are recurring
 * daily windows in UTC; `days` selects the weekdays they apply
 * (0=Sun … 6=Sat, default Mon–Fri).
 */

export type EmbargoKind = "news" | "weekend-hold";

export interface EmbargoWindow {
  symbol: string;
  kind: EmbargoKind;
  /** Recurring daily windows covered by the embargo (UTC, "HH:MM"–"HH:MM"). */
  windows: Array<{ start: string; end: string }>;
  /** Days of week the window applies (0=Sun … 6=Sat). Defaults to Mon–Fri. */
  days?: number[];
  note: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/**
 * The editorial schedule. One row per symbol × rule kind — a symbol may
 * carry both a news blackout and a weekend hold.
 */
export const embargoWindows: EmbargoWindow[] = [
  // News blackouts (UTC) — sized around recurring data releases.
  { symbol: "EURUSD", kind: "news", windows: [{ start: "12:30", end: "13:30" }], note: "US data releases (13:30 UTC) — editorial blackout around the print." },
  { symbol: "GBPUSD", kind: "news", windows: [{ start: "08:30", end: "09:00" }], note: "UK data releases (08:30 UTC) — desk hold during the print." },
  { symbol: "USDJPY", kind: "news", windows: [{ start: "06:00", end: "06:30" }], note: "Tokyo session open — editorial embargo on coverage." },
  { symbol: "XAUUSD", kind: "news", windows: [{ start: "13:30", end: "15:00" }], note: "US inflation / FOMC window (13:30 UTC) — extended hold." },
  { symbol: "GBPJPY", kind: "news", windows: [{ start: "05:00", end: "05:30" }], note: "Tokyo fix window — editorial embargo on coverage." },
  { symbol: "USDCAD", kind: "news", windows: [{ start: "14:00", end: "14:30" }], note: "US/Canada data releases (14:00 UTC) — desk hold." },
  { symbol: "NZDUSD", kind: "news", windows: [{ start: "21:30", end: "22:00" }], note: "New Zealand data releases (21:30 UTC) — desk hold." },
  { symbol: "AUDUSD", kind: "news", windows: [{ start: "22:30", end: "23:00" }], note: "Australian employment window (22:30 UTC) — desk hold." },
  // Weekend hold — the market genuinely closes; quotes freeze until the
  // Monday open (applies to every watched symbol).
  ...["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY", "USDCAD", "NZDUSD", "AUDUSD"].map(
    (symbol): EmbargoWindow => ({
      symbol,
      kind: "weekend-hold",
      days: WEEKEND,
      windows: [{ start: "00:00", end: "24:00" }],
      note: "Weekend hold — market closed, no editorial coverage until the Monday open.",
    }),
  ),
];

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Every embargo row defined for a symbol (news + weekend-hold). */
export function embargosFor(symbol: string): EmbargoWindow[] {
  return embargoWindows.filter((w) => w.symbol === symbol);
}

/**
 * The embargo in force for `symbol` at `now` (UTC), or null when the
 * symbol is outside every window — the order ticket renders nothing then.
 */
export function activeEmbargoFor(symbol: string, now: Date = new Date()): EmbargoWindow | null {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dow = now.getUTCDay();
  for (const w of embargosFor(symbol)) {
    const days = w.days ?? WEEKDAYS;
    if (!days.includes(dow)) continue;
    for (const win of w.windows) {
      if (minutes >= toMinutes(win.start) && minutes < toMinutes(win.end)) return w;
    }
  }
  return null;
}

/** Human schedule label for a window row — "12:30–13:30 UTC" / "weekend". */
export function embargoWindowLabel(w: EmbargoWindow): string {
  if (w.kind === "weekend-hold") return "Sat–Sun, all day (UTC)";
  return w.windows.map((win) => `${win.start}–${win.end} UTC`).join(", ");
}
