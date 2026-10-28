import type { Host as HostRow } from "@prisma/client";
import type { Host, NotificationChannel } from "../db";
import { prisma } from "../prisma";

// Employees visitors can come to see (table Host). Returns the app's Host shape.

export const toHost = (h: HostRow): Host => ({
  id: h.id,
  name: h.name,
  email: h.email,
  phone: h.phone,
  department: h.department,
  notifyBy: h.notifyBy as NotificationChannel[],
  ...(h.pinHash ? { pinHash: h.pinHash } : {}),
  ...(h.pinFailures ? { pinFailures: h.pinFailures } : {}),
  ...(h.pinLockedUntil ? { pinLockedUntil: h.pinLockedUntil.toISOString() } : {}),
  ...(h.qrToken ? { qrToken: h.qrToken } : {}),
  ...(h.active ? {} : { active: false }),
});

export async function findHostById(id: string): Promise<Host | null> {
  const h = await prisma.host.findUnique({ where: { id } });
  return h && toHost(h);
}

export async function listHosts(): Promise<Host[]> {
  return (await prisma.host.findMany({ orderBy: { name: "asc" } })).map(toHost);
}

export async function createHost(data: { name: string; email: string; phone: string; department: string; pinHash: string; qrToken: string }) {
  return toHost(await prisma.host.create({ data }));
}

export type HostPatch = Partial<{
  name: string;
  active: boolean;
  notifyBy: NotificationChannel[];
  pinHash: string;
  pinFailures: number;
  pinLockedUntil: Date | null;
  qrToken: string;
}>;

/** Returns null if there's no such employee. */
export async function updateHost(id: string, patch: HostPatch): Promise<Host | null> {
  const found = await prisma.host.findUnique({ where: { id }, select: { id: true } });
  if (!found) return null;
  return toHost(await prisma.host.update({ where: { id }, data: patch }));
}
