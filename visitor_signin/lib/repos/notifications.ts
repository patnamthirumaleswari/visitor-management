import type { Prisma } from "@prisma/client";
import type { Notification, NotificationChannel } from "../types";
import { prisma } from "../prisma";

// Notifications sent (table Notification) and who has read them in their inbox (NotificationRead).

export async function insertNotification(n: Omit<Notification, "id" | "readBy">) {
  await prisma.notification.create({
    data: { kind: n.kind ?? "arrival", visitId: n.visitId, hostId: n.hostId ?? null, to: n.to, channel: n.channel, status: n.status, error: n.error ?? null, sentAt: new Date(n.sentAt) },
  });
}

export type NotificationWithVisit = Notification & { visitorName: string; company: string; visitNo?: number; hostName: string };

/** Notifications matching `where`, newest first, with who has read them and the visit's names. */
export async function findNotifications(where: Prisma.NotificationWhereInput, take = 500): Promise<NotificationWithVisit[]> {
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { sentAt: "desc" },
    take,
    include: { reads: { select: { staffUserId: true } }, visit: { select: { no: true, visitor: { select: { name: true, company: true } }, host: { select: { name: true } } } } },
  });
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    visitId: n.visitId,
    ...(n.hostId ? { hostId: n.hostId } : {}),
    to: n.to,
    channel: n.channel as NotificationChannel,
    status: n.status,
    ...(n.error ? { error: n.error } : {}),
    sentAt: n.sentAt.toISOString(),
    readBy: n.reads.map((r) => r.staffUserId),
    visitorName: n.visit.visitor.name,
    company: n.visit.visitor.company,
    ...(n.visit.no ? { visitNo: n.visit.no } : {}),
    hostName: n.visit.host.name,
  }));
}

/** How the host was told about these visits (shown on the on-site list). */
export async function channelsForVisits(visitIds: string[], kinds: Notification["kind"][]) {
  const rows = await prisma.notification.findMany({ where: { visitId: { in: visitIds }, kind: { in: kinds as NonNullable<Notification["kind"]>[] } }, select: { visitId: true, channel: true, status: true } });
  const out: Record<string, { channel: NotificationChannel; status: Notification["status"] }[]> = {};
  for (const r of rows) (out[r.visitId] ??= []).push({ channel: r.channel as NotificationChannel, status: r.status });
  return out;
}

export async function markRead(notificationIds: string[], staffUserId: string) {
  if (notificationIds.length) {
    await prisma.notificationRead.createMany({ data: notificationIds.map((notificationId) => ({ notificationId, staffUserId })), skipDuplicates: true });
  }
}
