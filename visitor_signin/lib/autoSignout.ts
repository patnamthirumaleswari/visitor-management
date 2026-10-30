import { LOCATION } from "./config";
import type { EmployeeVisit, Visit } from "./types";
import { listOpenEmployeeVisits, signOutEmployeeVisit } from "./repos/employeeVisits";
import { changeVisit, findVisits, OPEN_STATUSES } from "./repos/visits";
import { getSettings } from "./services/settings";

// Automatic end-of-day sign-out (FR-KIO-10). Anyone still signed in when the sign-out time (Settings) passes,
// visitor or employee (FR-EMP-01), is signed out, with the sign-out time set to that cut-off
// rather than to when we noticed.
//
// There is no scheduler in this prototype, so the check runs whenever the reception screen or a staff
// page asks for data (the reception screen does that every 30 s). In production run await sweepAutoSignOut()
// from a cron job instead.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first cut-off time after the visitor signed in, in the location's time zone. */
export function autoSignOutTime(signedInAt: string, time: string | null): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const signedIn = new Date(signedInAt);

  // The calendar date at the location when they signed in, e.g. "2026-10-22".
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCATION.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(signedIn)
    .split("-")
    .map(Number);

  let cutoff = Date.UTC(y, m - 1, d, hours, minutes) - offsetMinutes(signedIn) * 60_000;
  if (cutoff <= signedIn.getTime()) cutoff += DAY_MS; // signed in after today's cut-off: tomorrow's
  return new Date(cutoff);
}

function isPastCutoff(signedInAt: string, now: number, time: string | null) {
  const cutoff = autoSignOutTime(signedInAt, time);
  return !!cutoff && cutoff.getTime() <= now;
}

/** When the visit started counting: entry time, or check-in time for a request nobody answered. */
const startOf = (visit: Visit) => (visit.status === "pending" || visit.status === "review" ? visit.checkedInAt : visit.signedInAt);

function isDue(visit: Visit, now: number, time: string | null) {
  const start = startOf(visit);
  const open = ["signed_in", "pending", "review", "checkout", "gate", "hold"].includes(visit.status);
  return open && !!start && isPastCutoff(start, now, time);
}

function isEmployeeDue(visit: EmployeeVisit, now: number, time: string | null) {
  return !visit.signedOutAt && isPastCutoff(visit.signedInAt, now, time);
}

/** Signs out everyone whose cut-off has passed. Returns how many were signed out. */
export async function sweepAutoSignOut(): Promise<number> {
  const now = Date.now();
  const time = (await getSettings()).autoSignoutTime;
  if (!time) return 0;
  let count = 0;

  for (const visit of (await findVisits({ status: { in: OPEN_STATUSES } })).filter((v) => isDue(v, now, time))) {
    const done = await changeVisit(visit.id, (v) => {
      if (!isDue(v, now, time)) return false; // changed in the meantime
      const start = startOf(v)!; // read before the status changes: it decides which time is used
      v.status = "signed_out";
      v.signedOutAt = autoSignOutTime(start, time)!.toISOString();
      v.signedOutBy = "auto";
      return true;
    });
    if (done) count++;
  }
  for (const { visit } of (await listOpenEmployeeVisits()).filter(({ visit }) => isEmployeeDue(visit, now, time))) {
    if (await signOutEmployeeVisit(visit.id, autoSignOutTime(visit.signedInAt, time)!, "auto")) count++;
  }
  return count;
}

/** Minutes the location's time zone is ahead of UTC at that moment, e.g. 330 for India. */
function offsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: LOCATION.timezone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
  if (!match) return 0; // "GMT" on its own means UTC
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}
