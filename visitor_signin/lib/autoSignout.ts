import { AUTO_SIGNOUT_TIME, LOCATION } from "./config";
import { read, write, type EmployeeVisit, type Visit } from "./db";

// Automatic end-of-day sign-out (FR-KIO-10). Anyone still signed in when AUTO_SIGNOUT_TIME passes,
// visitor or employee (FR-EMP-01), is signed out, with the sign-out time set to that cut-off
// rather than to when we noticed.
//
// There is no scheduler in this prototype, so the check runs whenever the reception screen or a staff
// page asks for data (the reception screen does that every 30 s). In production run sweepAutoSignOut()
// from a cron job instead.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first cut-off time after the visitor signed in, in the location's time zone. */
export function autoSignOutTime(signedInAt: string): Date | null {
  if (!AUTO_SIGNOUT_TIME) return null;
  const [hours, minutes] = AUTO_SIGNOUT_TIME.split(":").map(Number);
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

function isPastCutoff(signedInAt: string, now: number) {
  const cutoff = autoSignOutTime(signedInAt);
  return !!cutoff && cutoff.getTime() <= now;
}

/** When the visit started counting: entry time, or check-in time for a request nobody answered. */
const startOf = (visit: Visit) => (visit.status === "pending" ? visit.checkedInAt : visit.signedInAt);

function isDue(visit: Visit, now: number) {
  const start = startOf(visit);
  const open = ["signed_in", "pending", "checkout", "gate", "hold"].includes(visit.status);
  return open && !!start && isPastCutoff(start, now);
}

function isEmployeeDue(visit: EmployeeVisit, now: number) {
  return !visit.signedOutAt && isPastCutoff(visit.signedInAt, now);
}

/** Signs out everyone whose cut-off has passed. Returns how many were signed out. */
export function sweepAutoSignOut(): number {
  const now = Date.now();
  // Look first without writing, so the frequent calls don't rewrite the file every time.
  if (!read((d) => d.visits.some((v) => isDue(v, now)) || d.employeeVisits.some((v) => isEmployeeDue(v, now)))) return 0;

  return write((d) => {
    let count = 0;
    for (const visit of d.visits) {
      if (!isDue(visit, now)) continue;
      const start = startOf(visit)!; // read before the status changes: it decides which time is used
      visit.status = "signed_out";
      visit.signedOutAt = autoSignOutTime(start)!.toISOString();
      visit.signedOutBy = "auto";
      count++;
    }
    for (const visit of d.employeeVisits) {
      if (!isEmployeeDue(visit, now)) continue;
      visit.signedOutAt = autoSignOutTime(visit.signedInAt)!.toISOString();
      visit.signedOutBy = "auto";
      count++;
    }
    return count;
  });
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
