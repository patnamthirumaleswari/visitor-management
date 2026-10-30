import type { Visitor as VisitorRow } from "@prisma/client";
import type { Visitor } from "../types";
import { prisma } from "../prisma";
import type { Tx } from "./visits";

// Visitors (table Visitor). A returning visitor is recognised by their mobile number.

export const toVisitor = (p: VisitorRow): Visitor => ({
  id: p.id,
  name: p.name,
  phone: p.phone,
  email: p.email,
  company: p.company,
  ...(p.photo ? { photo: p.photo } : {}),
});

export async function findVisitorByPhone(phone: string, db: Tx | typeof prisma = prisma): Promise<Visitor | null> {
  const p = await db.visitor.findFirst({ where: { phone }, orderBy: { id: "asc" } });
  return p && toVisitor(p);
}

export async function insertVisitor(tx: Tx, v: Visitor) {
  await tx.visitor.create({ data: { id: v.id, name: v.name, phone: v.phone, email: v.email, company: v.company, photo: v.photo ?? null } });
}

export async function updateVisitor(tx: Tx, v: Visitor) {
  await tx.visitor.update({ where: { id: v.id }, data: { name: v.name, email: v.email, company: v.company, photo: v.photo ?? null } });
}

/** Visitors with no visits left (deleted with their photo when old records are cleared). */
export async function deleteVisitorsWithoutVisits(): Promise<number> {
  return (await prisma.visitor.deleteMany({ where: { visits: { none: {} } } })).count;
}
