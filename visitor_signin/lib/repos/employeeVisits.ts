import type { EmployeeVisit as EmployeeVisitRow } from "@prisma/client";
import type { EmployeeVisit, Host } from "../types";
import { prisma } from "../prisma";
import { toHost } from "./hosts";
import type { Tx } from "./visits";

// Employees signing in and out at reception (table EmployeeVisit, FR-EMP-01).

const toEmployeeVisit = (e: EmployeeVisitRow): EmployeeVisit => ({
  id: e.id,
  hostId: e.hostId,
  locationId: e.locationId,
  method: e.method as EmployeeVisit["method"],
  signedInAt: e.signedInAt.toISOString(),
  ...(e.signedOutAt ? { signedOutAt: e.signedOutAt.toISOString() } : {}),
  ...(e.signedOutBy ? { signedOutBy: e.signedOutBy as NonNullable<EmployeeVisit["signedOutBy"]> } : {}),
});

/** The employee's open sign-in (signed in, not out yet), if any. */
export async function findOpenEmployeeVisit(hostId: string, db: Tx | typeof prisma = prisma): Promise<EmployeeVisit | null> {
  const e = await db.employeeVisit.findFirst({ where: { hostId, signedOutAt: null }, orderBy: { signedInAt: "desc" } });
  return e && toEmployeeVisit(e);
}

/** Everyone signed in now, newest first, with their employee record (the evacuation list). */
export async function listOpenEmployeeVisits(): Promise<{ visit: EmployeeVisit; host: Host }[]> {
  const rows = await prisma.employeeVisit.findMany({ where: { signedOutAt: null }, orderBy: { signedInAt: "desc" }, include: { host: true } });
  return rows.map((r) => ({ visit: toEmployeeVisit(r), host: toHost(r.host) }));
}

export async function insertEmployeeVisit(tx: Tx, e: EmployeeVisit) {
  await tx.employeeVisit.create({ data: { id: e.id, hostId: e.hostId, locationId: e.locationId, method: e.method, signedInAt: new Date(e.signedInAt) } });
}

/** Returns false if it was already signed out. */
export async function signOutEmployeeVisit(id: string, at: Date, by: NonNullable<EmployeeVisit["signedOutBy"]>, db: Tx | typeof prisma = prisma): Promise<boolean> {
  const { count } = await db.employeeVisit.updateMany({ where: { id, signedOutAt: null }, data: { signedOutAt: at, signedOutBy: by } });
  return count === 1;
}

export async function employeeVisitExists(id: string): Promise<boolean> {
  return (await prisma.employeeVisit.count({ where: { id } })) > 0;
}

export async function deleteEmployeeVisitsSignedOutBefore(cutoff: Date): Promise<number> {
  return (await prisma.employeeVisit.deleteMany({ where: { signedOutAt: { lt: cutoff } } })).count;
}
