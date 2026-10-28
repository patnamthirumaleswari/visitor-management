import type { Invitation } from "../types";
import { prisma } from "../prisma";
import { toHost } from "./hosts";
import { toVisit, type Tx, type VisitWithPeople } from "./visits";
import { toVisitor } from "./visitors";

// Invitations (table Invitation): the link or QR a host sends before the visit (FR-PRE-02).

const toInvitation = (i: { id: string; visitId: string; qrToken: string; validFrom: string; validTo: string; createdAt: Date; usedAt: Date | null }): Invitation => ({
  id: i.id,
  visitId: i.visitId,
  qrToken: i.qrToken,
  validFrom: i.validFrom,
  validTo: i.validTo,
  createdAt: i.createdAt.toISOString(),
  ...(i.usedAt ? { usedAt: i.usedAt.toISOString() } : {}),
});

export type InvitationMatch = VisitWithPeople & { invitation: Invitation };

/**
 * Unused invitations valid on `day` (YYYY-MM-DD) whose visit is still expected at this location,
 * matched by the invite's token or by the visitor's mobile number.
 */
export async function findInvitations(by: { token?: string; phone?: string }, day: string, locationId: string, db: Tx | typeof prisma = prisma): Promise<InvitationMatch[]> {
  if (!by.token && !by.phone) return [];
  const rows = await db.invitation.findMany({
    where: {
      usedAt: null,
      validFrom: { lte: day },
      validTo: { gte: day },
      ...(by.token ? { qrToken: by.token } : {}),
      visit: { status: "expected", locationId, ...(by.phone && !by.token ? { visitor: { phone: by.phone } } : {}) },
    },
    include: { visit: { include: { timeline: { orderBy: { at: "asc" } }, visitor: true, host: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ invitation: toInvitation(r), visit: toVisit(r.visit), visitor: toVisitor(r.visit.visitor), host: toHost(r.visit.host) }));
}

export async function findInvitationByToken(token: string): Promise<InvitationMatch | null> {
  const r = await prisma.invitation.findUnique({ where: { qrToken: token }, include: { visit: { include: { timeline: { orderBy: { at: "asc" } }, visitor: true, host: true } } } });
  return r && { invitation: toInvitation(r), visit: toVisit(r.visit), visitor: toVisitor(r.visit.visitor), host: toHost(r.visit.host) };
}

export async function insertInvitation(tx: Tx, i: Invitation) {
  await tx.invitation.create({ data: { id: i.id, visitId: i.visitId, qrToken: i.qrToken, validFrom: i.validFrom, validTo: i.validTo } });
}

export async function markInvitationUsed(tx: Tx, id: string, at: Date) {
  await tx.invitation.update({ where: { id }, data: { usedAt: at } });
}
