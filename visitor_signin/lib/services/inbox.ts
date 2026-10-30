import type { Prisma } from "@prisma/client";
import type { Staff } from "../auth";
import type { Notification } from "../types";
import { findNotifications, markRead, type NotificationWithVisit } from "../repos/notifications";

// Inbox (Visitor Connect): the approval requests and alerts sent to you, inside the app, so nothing is
// missed when email or SMS isn't set up. Built from the notification records; one item per event
// even when it went out by email and SMS.

type Kind = NonNullable<Notification["kind"]>;
const FOR_HOST: Kind[] = ["arrival", "approval", "checkout", "hold"];
const FOR_ROLE: Partial<Record<Staff["role"], Kind[]>> = { admin: ["escalation", "watchlist"], receptionist: ["escalation"] };

export type InboxItem = {
  ids: string[]; // the notification records behind this item
  kind: Kind;
  at: string;
  subject: string;
  detail: string;
  visitId: string;
  read: boolean;
};

/** Which notifications belong in this person's inbox. */
function inboxFilter(staff: Staff): Prisma.NotificationWhereInput | null {
  const or: Prisma.NotificationWhereInput[] = [];
  if (staff.hostId) or.push({ hostId: staff.hostId, kind: { in: FOR_HOST } });
  const roleKinds = FOR_ROLE[staff.role];
  if (roleKinds) or.push({ kind: { in: roleKinds } });
  return or.length ? { OR: or } : null;
}

function subject(kind: Kind, name: string, host: string): string {
  switch (kind) {
    case "arrival": return `${name} has arrived to see you`;
    case "approval": return `${name} is waiting for your approval`;
    case "checkout": return `${name} wants to check out`;
    case "hold": return `${name} was held at the gate`;
    case "watchlist": return `Watchlist match: ${name} needs an admin`;
    case "escalation": return `${name} is still waiting for ${host || "their host"}`;
    default: return name;
  }
}

/** Your inbox, newest first. */
export async function inboxFor(staff: Staff): Promise<InboxItem[]> {
  const where = inboxFilter(staff);
  if (!where) return [];
  const groups = new Map<string, NotificationWithVisit[]>();
  for (const n of await findNotifications(where)) {
    // Email and SMS for the same event go out within a second or two of each other.
    const key = `${n.visitId}|${n.kind ?? "arrival"}|${n.sentAt.slice(0, 16)}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const items: InboxItem[] = [];
  for (const ns of groups.values()) {
    const n = ns[0];
    const kind = n.kind ?? "arrival";
    const channels = [...new Set(ns.map((x) => (x.channel === "sms" ? "SMS" : "email")))].join(" and ");
    items.push({
      ids: ns.map((x) => x.id),
      kind,
      at: n.sentAt,
      subject: subject(kind, n.visitorName || "A visitor", n.hostName),
      detail: [n.company, n.visitNo ? `No. ${n.visitNo}` : "", `sent by ${channels}`].filter(Boolean).join(" · "),
      visitId: n.visitId,
      read: ns.every((x) => x.readBy?.includes(staff.id)),
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export async function unreadCount(staff: Staff): Promise<number> {
  return (await inboxFor(staff)).filter((i) => !i.read).length;
}

/** Marks items read: some by id, or all. Only messages in this person's own inbox can be marked. */
export async function markInboxRead(staff: Staff, ids: Set<string> | "all"): Promise<InboxItem[]> {
  const mine = (await inboxFor(staff)).flatMap((i) => i.ids);
  await markRead(ids === "all" ? mine : mine.filter((id) => ids.has(id)), staff.id);
  return inboxFor(staff);
}
