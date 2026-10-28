import type { Staff } from "./auth";
import { read } from "./db";
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
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return read((d) => {
    const items: ActivityItem[] = [];
    for (const v of d.visits) {
      if (staff.role === "host" && v.hostId !== staff.hostId) continue;
      const visitor = d.visitors.find((p) => p.id === v.visitorId);
      const host = d.hosts.find((h) => h.id === v.hostId);
      for (const t of v.timeline ?? []) {
        if (new Date(t.at).getTime() < since) continue;
        items.push({
          at: t.at,
          event: t.event,
          by: t.by,
          visitId: v.id,
          visitorName: visitor?.name ?? "",
          company: visitor?.company ?? "",
          photo: visitor?.photo ?? null,
          no: v.no,
          host: host?.name ?? "",
          typeLabel: typeDisplay(types, v.visitorType).label,
          status: v.status,
        });
      }
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS);
  });
}
