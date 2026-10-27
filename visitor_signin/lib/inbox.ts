import type { Staff } from "./auth";
import type { Data, Notification } from "./db";

// Inbox (Visitor Connect): the approval requests and alerts sent to you, inside the app, so nothing is
// missed when email or SMS isn't set up. Built from the notification records; one item per event
// even when it went out by email and SMS.

type Kind = NonNullable<Notification["kind"]>;
const FOR_HOST: Kind[] = ["arrival", "approval", "checkout", "hold"];
const FOR_ADMINS: Partial<Record<Kind, Staff["role"][]>> = { escalation: ["admin", "receptionist"], watchlist: ["admin"] };

export type InboxItem = {
  ids: string[]; // the notification records behind this item
  kind: Kind;
  at: string;
  subject: string;
  detail: string;
  visitId: string;
  read: boolean;
};

function isFor(n: Notification, staff: Staff): boolean {
  const kind = n.kind ?? "arrival";
  if (FOR_HOST.includes(kind)) return !!staff.hostId && n.hostId === staff.hostId;
  return !!FOR_ADMINS[kind]?.includes(staff.role);
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
export function inboxFor(d: Data, staff: Staff): InboxItem[] {
  const groups = new Map<string, Notification[]>();
  for (const n of d.notifications) {
    if (!isFor(n, staff)) continue;
    // Email and SMS for the same event go out within a second or two of each other.
    const key = `${n.visitId}|${n.kind ?? "arrival"}|${n.sentAt.slice(0, 16)}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const items: InboxItem[] = [];
  for (const ns of groups.values()) {
    const n = ns[0];
    const kind = n.kind ?? "arrival";
    const visit = d.visits.find((v) => v.id === n.visitId);
    const visitor = visit && d.visitors.find((p) => p.id === visit.visitorId);
    const host = visit && d.hosts.find((h) => h.id === visit.hostId);
    const channels = [...new Set(ns.map((x) => (x.channel === "sms" ? "SMS" : "email")))].join(" and ");
    items.push({
      ids: ns.map((x) => x.id),
      kind,
      at: n.sentAt,
      subject: subject(kind, visitor?.name ?? "A visitor", host?.name ?? ""),
      detail: [visitor?.company, visit?.no ? `No. ${visit.no}` : "", `sent by ${channels}`].filter(Boolean).join(" · "),
      visitId: n.visitId,
      read: ns.every((x) => x.readBy?.includes(staff.id)),
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export const unreadCount = (d: Data, staff: Staff) => inboxFor(d, staff).filter((i) => !i.read).length;
