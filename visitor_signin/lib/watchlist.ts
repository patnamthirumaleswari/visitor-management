import { normalizePhone, type Data, type WatchEntry } from "./db";

// Watchlist (FR-SEC-01..03): people to review before they're let in. A match at check-in holds the
// visitor as "Watchlist review": only admins decide, and the host isn't asked or told.

/** The active entry matching this person by mobile number, or by exact name (ignoring case and spaces). */
export function findWatchMatch(d: Data, name: string, phone: string): WatchEntry | null {
  const p = normalizePhone(phone);
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    (d.watchlist ?? []).find(
      (w) => w.active && ((!!w.phone && normalizePhone(w.phone) === p) || (!!w.name && w.name.trim().toLowerCase().replace(/\s+/g, " ") === n)),
    ) ?? null
  );
}
