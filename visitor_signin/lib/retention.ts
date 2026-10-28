import { audit } from "./services/audit";
import { read, write, type Data, type Visit } from "./db";
import { getSettings } from "./services/settings";

// Keeping records only as long as needed (privacy; NFR-SEC-01). Finished visits older than the
// retention time in Settings are deleted, with their invitations and notification records, and
// visitors with no visits left are deleted too (including their photo). Open visits are never touched.
//
// Like the automatic sign-out there's no scheduler: it runs at most once an hour when the reception
// screen or admin home asks for data. In production run it from a nightly job.

const EVERY_MS = 60 * 60 * 1000;
let lastRun = 0;

/** When the visit finished, or null if it's still open. */
function endedAt(v: Visit): string | null {
  if (v.status === "signed_out") return v.signedOutAt ?? v.signedInAt ?? v.checkedInAt ?? null;
  if (v.status === "denied") return v.decidedAt ?? v.checkedInAt ?? null;
  if (v.status === "expected") return v.expectedDate ? `${v.expectedDate}T23:59:59Z` : null; // invited, never came
  return null;
}

/** What would be deleted now (also used for the count on /admin/settings). */
export function oldRecords(d: Data, days: number) {
  if (days <= 0) return { visitIds: new Set<string>(), visitorIds: new Set<string>(), employeeVisitIds: new Set<string>() };
  const cutoff = new Date(Date.now() - days * 864e5).toISOString();
  const visitIds = new Set(d.visits.filter((v) => { const end = endedAt(v); return !!end && end < cutoff; }).map((v) => v.id));
  const kept = d.visits.filter((v) => !visitIds.has(v.id));
  const visitorIds = new Set(d.visitors.filter((p) => !kept.some((v) => v.visitorId === p.id)).map((p) => p.id));
  const employeeVisitIds = new Set(d.employeeVisits.filter((e) => !!e.signedOutAt && e.signedOutAt < cutoff).map((e) => e.id));
  return { visitIds, visitorIds, employeeVisitIds };
}

/** Deletes old records if an hour has passed since the last run (or `force`). Returns how many visits went. */
export async function sweepOldRecords(force = false): Promise<number> {
  if (!force && Date.now() - lastRun < EVERY_MS) return 0;
  lastRun = Date.now();
  const days = (await getSettings()).retentionDays;
  if (days <= 0) return 0;
  if (!read((d) => { const o = oldRecords(d, days); return o.visitIds.size + o.visitorIds.size + o.employeeVisitIds.size > 0; })) return 0;

  const counts = write((d) => {
    const { visitIds, visitorIds, employeeVisitIds } = oldRecords(d, days);
    d.visits = d.visits.filter((v) => !visitIds.has(v.id));
    d.invitations = d.invitations.filter((i) => !visitIds.has(i.visitId));
    d.notifications = d.notifications.filter((n) => !visitIds.has(n.visitId));
    d.visitors = d.visitors.filter((p) => !visitorIds.has(p.id));
    d.employeeVisits = d.employeeVisits.filter((e) => !employeeVisitIds.has(e.id));
    return { visits: visitIds.size, visitors: visitorIds.size, employees: employeeVisitIds.size };
  });
  await audit(null, { name: "System", role: "System" }, "Old records deleted",
    `Older than ${days} days: ${counts.visits} visits, ${counts.visitors} visitors, ${counts.employees} staff sign-ins`);
  return counts.visits;
}
