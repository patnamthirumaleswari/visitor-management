import { prisma } from "../prisma";

export type AuditRow = { id: string; at: Date; action: string; by: string; role: string; detail: string; ip: string };

export async function insertAudit(entry: Omit<AuditRow, "id" | "at">) {
  await prisma.auditEntry.create({ data: entry });
}

/** Newest first. */
export async function listAudit(limit: number): Promise<AuditRow[]> {
  return prisma.auditEntry.findMany({ orderBy: { at: "desc" }, take: limit });
}

/** "Ravi Kumar (No. 105)" for a visit, or null if it isn't in the database. */
export async function visitLabelOf(visitId: string): Promise<string | null> {
  const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { no: true, visitor: { select: { name: true } } } });
  if (!v) return null;
  return v.no ? `${v.visitor.name} (No. ${v.no})` : v.visitor.name;
}
