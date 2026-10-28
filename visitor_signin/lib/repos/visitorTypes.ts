import type { Prisma, VisitorType as TypeRow } from "@prisma/client";
import type { Question, StandardField, FieldMode, VisitorType } from "../db";
import { prisma } from "../prisma";

// Visitor types (table VisitorType), kept in the order admins added them.

const toType = (t: TypeRow): VisitorType => ({
  id: t.id,
  label: t.label,
  description: t.description,
  color: t.color,
  fields: t.fields as Partial<Record<StandardField, FieldMode>>,
  photoRequired: t.photoRequired,
  agreementRequired: t.agreementRequired,
  approvalRequired: t.approvalRequired,
  questions: t.questions as Question[],
  active: t.active,
});

const toData = (t: VisitorType) => ({
  label: t.label,
  description: t.description,
  color: t.color,
  fields: (t.fields ?? {}) as Prisma.InputJsonValue,
  photoRequired: t.photoRequired,
  agreementRequired: t.agreementRequired,
  approvalRequired: t.approvalRequired !== false,
  questions: t.questions as unknown as Prisma.InputJsonValue,
  active: t.active,
});

export async function listVisitorTypes(): Promise<VisitorType[]> {
  return (await prisma.visitorType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })).map(toType);
}

export async function findVisitorTypeById(id: string): Promise<VisitorType | null> {
  const t = await prisma.visitorType.findUnique({ where: { id } });
  return t && toType(t);
}

export async function typeIdTaken(id: string): Promise<boolean> {
  return (await prisma.visitorType.count({ where: { id } })) > 0;
}

export async function createVisitorType(t: VisitorType): Promise<VisitorType> {
  const last = await prisma.visitorType.aggregate({ _max: { sortOrder: true } });
  return toType(await prisma.visitorType.create({ data: { id: t.id, ...toData(t), sortOrder: (last._max.sortOrder ?? -1) + 1 } }));
}

export async function updateVisitorType(t: VisitorType): Promise<VisitorType> {
  return toType(await prisma.visitorType.update({ where: { id: t.id }, data: toData(t) }));
}

export async function deleteVisitorType(id: string) {
  await prisma.visitorType.delete({ where: { id } });
}

/** How many visits used each type (a used type can't be deleted). */
export async function visitCountsByType(): Promise<Record<string, number>> {
  const rows = await prisma.visit.groupBy({ by: ["visitorTypeId"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.visitorTypeId, r._count._all]));
}
