import { deleteEmployeeVisitsSignedOutBefore } from "./repos/employeeVisits";
import { deleteVisitorsWithoutVisits } from "./repos/visitors";
import { deleteVisits, findVisits } from "./repos/visits";
import { audit } from "./services/audit";
import { getSettings } from "./services/settings";
import type { Visit } from "./types";
import { dayAt } from "./dates";

// Keeping records only as long as needed (privacy; NFR-SEC-01). Finished visits older than the
// retention time in Settings are deleted, with their history, invitations and notification records,
// and visitors with no visits left are deleted too (including their photo). Open visits are never touched.
//
// Like the automatic sign-out there's no scheduler yet: it runs at most once an hour when the reception
// screen or admin home asks for data. On Cloudflare it moves to a nightly Cron Trigger.

const EVERY_MS = 60 * 60 * 1000;
let lastRun = 0;

/** When the visit finished, or null if it's still open. */
function endedAt(v: Visit): string | null {
  if (v.status === "signed_out") return v.signedOutAt ?? v.signedInAt ?? v.checkedInAt ?? null;
  if (v.status === "denied") return v.decidedAt ?? v.checkedInAt ?? null;
  if (v.status === "expected") return v.expectedDate ? `${v.expectedDate}T23:59:59Z` : null; // invited, never came
  return null;
}

/** Deletes old records if an hour has passed since the last run (or `force`). Returns how many visits went. */
export async function sweepOldRecords(force = false): Promise<number> {
  if (!force && Date.now() - lastRun < EVERY_MS) return 0;
  lastRun = Date.now();
  const days = (await getSettings()).retentionDays;
  if (days <= 0) return 0;

  const cutoff = new Date(Date.now() - days * 864e5);
  // Finished visits that may be old enough; endedAt() makes the exact call.
  const candidates = await findVisits({
    OR: [
      { status: "signed_out", OR: [{ signedOutAt: { lt: cutoff } }, { signedOutAt: null }] },
      { status: "denied", OR: [{ decidedAt: { lt: cutoff } }, { decidedAt: null }] },
      { status: "expected", expectedDate: { lt: dayAt(cutoff.toISOString()) } },
    ],
  });
  const visitIds = candidates.filter((v) => { const end = endedAt(v); return !!end && end < cutoff.toISOString(); }).map((v) => v.id);

  await deleteVisits(visitIds);
  const visitors = await deleteVisitorsWithoutVisits();
  const employees = await deleteEmployeeVisitsSignedOutBefore(cutoff);
  if (visitIds.length + visitors + employees === 0) return 0;

  await audit(null, { name: "System", role: "System" }, "Old records deleted",
    `Older than ${days} days: ${visitIds.length} visits, ${visitors} visitors, ${employees} staff sign-ins`);
  return visitIds.length;
}
