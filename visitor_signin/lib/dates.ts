import { LOCATION } from "./config";

/** Today's date at the location, as YYYY-MM-DD (the format of <input type="date">). */
export function todayAtLocation(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCATION.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-10-15" → "15 Oct 2026" */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The date at the location when this happened, as YYYY-MM-DD. */
export const dayAt = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso));

/** The hour (0-23) at the location when this happened. */
export const hourAt = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: LOCATION.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
