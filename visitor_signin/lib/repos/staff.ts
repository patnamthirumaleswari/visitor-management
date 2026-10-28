import type { StaffUser as StaffRow } from "@prisma/client";
import type { StaffRole, StaffUser } from "../types";
import { prisma } from "../prisma";

// Staff sign-ins (table StaffUser). Returns the app's StaffUser shape, so callers don't depend on Prisma.

const toStaff = (s: StaffRow): StaffUser => ({
  id: s.id,
  username: s.username,
  name: s.name,
  role: s.role,
  passwordHash: s.passwordHash,
  ...(s.hostId ? { hostId: s.hostId } : {}),
  ...(s.active ? {} : { active: false }),
  ...(s.mustChangePassword ? { mustChangePassword: true } : {}),
});

export async function findStaffById(id: string): Promise<StaffUser | null> {
  const s = await prisma.staffUser.findUnique({ where: { id } });
  return s && toStaff(s);
}

/** Usernames are matched ignoring upper/lower case. */
export async function findStaffByUsername(username: string): Promise<StaffUser | null> {
  const s = await prisma.staffUser.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  return s && toStaff(s);
}

export async function findStaffByHostId(hostId: string): Promise<StaffUser | null> {
  const s = await prisma.staffUser.findUnique({ where: { hostId } });
  return s && toStaff(s);
}

export async function listStaff(): Promise<StaffUser[]> {
  return (await prisma.staffUser.findMany({ orderBy: { name: "asc" } })).map(toStaff);
}

export async function usernameTaken(username: string): Promise<boolean> {
  return (await prisma.staffUser.count({ where: { username: { equals: username, mode: "insensitive" } } })) > 0;
}

export async function createStaff(data: { username: string; name: string; role: StaffRole; passwordHash: string; hostId?: string; mustChangePassword?: boolean }) {
  return toStaff(await prisma.staffUser.create({ data }));
}

export async function updateStaff(id: string, patch: Partial<{ name: string; passwordHash: string; active: boolean; mustChangePassword: boolean }>) {
  return toStaff(await prisma.staffUser.update({ where: { id }, data: patch }));
}

/** Whether any other admin can still sign in (the last admin can't be switched off). */
export async function otherActiveAdminExists(exceptId: string): Promise<boolean> {
  return (await prisma.staffUser.count({ where: { role: "admin", active: true, id: { not: exceptId } } })) > 0;
}
