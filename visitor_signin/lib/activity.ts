import type { Staff } from "./auth";
import { findRecentTimeline } from "./repos/visits";
import { typeDisplay } from "./visitorTypes";
import { listVisitorTypes } from "./services/visitorTypes";

// Activity tracker: everything that happened with visits, newest first, from each visit's timeline.
// A host sees their own visitors; admins and reception see everyone's.

export type ActivityItem = {
  at: string;
  event: string;
  by: string;
  visitId: string;
  visitorName: string;
  company: string;
  photo: string | null;
  no?: number;
  host: string;
  typeLabel: string;
  status: string; // the visit's status now
};

const MAX_ITEMS = 300;

export async function activityFor(staff: Staff, days: number): Promise<ActivityItem[]> {
  const types = await listVisitorTypes();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // A host sees only their own visitors.
  const events = await findRecentTimeline(since, MAX_ITEMS, staff.role === "host" ? staff.hostId ?? "-" : undefined);
  return events.map(({ at, event, by, visit: v, visitor, host }) => ({
    at,
    event,
    by,
    visitId: v.id,
    visitorName: visitor.name,
    company: visitor.company,
    photo: visitor.photo ?? null,
    no: v.no,
    host: host.name,
    typeLabel: typeDisplay(types, v.visitorType).label,
    status: v.status,
  }));
}
