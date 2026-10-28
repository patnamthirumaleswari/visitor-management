import crypto from "node:crypto";
import type { Host, StaffRole } from "../db";
import { hashPassword } from "../password";
import { isMobile, MOBILE_ERROR } from "../phone";
import { createHost, findHostById, listHosts, updateHost } from "../repos/hosts";
import { createStaff, findStaffById, listStaff, otherActiveAdminExists, updateStaff, usernameTaken } from "../repos/staff";

// People (FR-ADM-04): staff accounts and employees, managed by admins on /admin/people.
// An employee (a Host) is someone visitors can come to see; a staff account is a sign-in. A host's
// sign-in is linked to their employee record by hostId, and the two show as one person.

export const isActiveHost = (h: Host) => h.active !== false;

export type PersonRow = {
  id: string; // the staff account's id, or the employee's id if they have no sign-in
  hostId?: string;
  name: string;
  role: StaffRole | null; // null = employee without a sign-in
  username?: string;
  department: string;
  email: string;
  phone: string;
  active: boolean;
  temporaryPassword: boolean;
};

/** Shown to the admin once, never stored in plain text. */
export type Secret = { name: string; username: string | null; password: string | null; pin: string | null };

const ROLES: StaffRole[] = ["host", "receptionist", "security", "admin"];
const ROLE_ORDER: Record<StaffRole, number> = { admin: 0, receptionist: 1, security: 2, host: 3 };
const USERNAME = /^[a-z0-9._@-]{3,40}$/;
const USERNAME_ERROR = "Choose a username: 3 to 40 letters, numbers, dots or dashes.";

export async function listPeople(): Promise<PersonRow[]> {
  const [staff, hosts] = await Promise.all([listStaff(), listHosts()]);
  const rows: PersonRow[] = staff.map((s) => {
    const host = s.hostId ? hosts.find((h) => h.id === s.hostId) : undefined;
    return {
      id: s.id,
      hostId: host?.id,
      name: s.name,
      role: s.role,
      username: s.username,
      department: host?.department ?? "",
      email: host?.email ?? "",
      phone: host?.phone ?? "",
      active: s.active !== false && (!host || isActiveHost(host)),
      temporaryPassword: !!s.mustChangePassword,
    };
  });
  for (const h of hosts) {
    if (staff.some((s) => s.hostId === h.id)) continue;
    rows.push({ id: h.id, hostId: h.id, name: h.name, role: null, department: h.department, email: h.email, phone: h.phone, active: isActiveHost(h), temporaryPassword: false });
  }
  const order = (r: PersonRow) => (r.role ? ROLE_ORDER[r.role] : 4);
  return rows.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
}

/** A temporary password that is easy to read out: no 0/O or 1/l/I. */
export function temporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join("");
}

/** A random 6-digit PIN for signing in at reception. */
export const temporaryPin = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

export type NewPerson = { role: unknown; name: string; username: string; department: string; email: string; phone: string; signIn: boolean };

/**
 * Adds a person. A host is an employee visitors can choose; with signIn they also get an account to
 * approve their visitors. Reception, security and admins always get an account. New accounts get a
 * temporary password, which they replace at first sign-in.
 */
export async function addPerson(p: NewPerson): Promise<{ error: string } | { secret: Secret; role: StaffRole }> {
  const role = ROLES.find((r) => r === p.role);
  const signIn = role !== "host" || p.signIn;
  if (!role) return { error: "Choose a role." };
  if (p.name.length < 2) return { error: "Enter their full name." };
  if (signIn && !USERNAME.test(p.username)) return { error: USERNAME_ERROR };
  if (role === "host") {
    if (!/^\S+@\S+\.\S+$/.test(p.email)) return { error: "Enter their email: approval requests go there." };
    if (p.phone && !isMobile(p.phone)) return { error: MOBILE_ERROR };
  }
  if (signIn && (await usernameTaken(p.username))) return { error: "That username is taken." };

  const password = signIn ? temporaryPassword() : null;
  const pin = role === "host" ? temporaryPin() : null;
  const host = role === "host"
    ? await createHost({ name: p.name, email: p.email, phone: p.phone, department: p.department, pinHash: hashPassword(pin!), qrToken: crypto.randomBytes(18).toString("base64url") })
    : undefined;
  if (signIn) {
    await createStaff({ username: p.username, name: p.name, role, passwordHash: hashPassword(password!), mustChangePassword: true, ...(host ? { hostId: host.id } : {}) });
  }
  return { role, secret: { name: p.name, username: signIn ? p.username : null, password, pin } };
}

export type PersonAction = "switch-off" | "switch-on" | "reset-password" | "reset-pin" | "give-sign-in";
export const PERSON_ACTIONS: PersonAction[] = ["switch-off", "switch-on", "reset-password", "reset-pin", "give-sign-in"];

/**
 * One person's action on /admin/people. `id` is their staff account's id, or the employee's id if they
 * have no sign-in. `byId` is the admin doing it; they can't change their own sign-in here.
 */
export async function actOnPerson(id: string, action: PersonAction, byId: string, username = ""): Promise<{ error: string; status: number } | { name: string; secret?: Secret }> {
  if (id === byId) return { error: "Use My account to change your own sign-in.", status: 400 };
  const user = await findStaffById(id);
  const host = await findHostById(user ? user.hostId ?? "" : id);
  if (!user && !host) return { error: "Person not found.", status: 404 };
  const name = user?.name ?? host!.name;

  switch (action) {
    case "switch-off":
      if (user?.role === "admin" && !(await otherActiveAdminExists(user.id))) return { error: "Keep at least one admin switched on.", status: 400 };
      if (user) await updateStaff(user.id, { active: false });
      if (host) await updateHost(host.id, { active: false });
      return { name };
    case "switch-on":
      if (user) await updateStaff(user.id, { active: true });
      if (host) await updateHost(host.id, { active: true });
      return { name };
    case "reset-password": {
      if (!user) return { error: "They don't have a sign-in yet.", status: 400 };
      const password = temporaryPassword();
      await updateStaff(user.id, { passwordHash: hashPassword(password), mustChangePassword: true });
      return { name, secret: { name, username: null, password, pin: null } };
    }
    case "reset-pin": {
      if (!host) return { error: "Only employees have a reception PIN.", status: 400 };
      const pin = temporaryPin();
      await updateHost(host.id, { pinHash: hashPassword(pin), pinFailures: 0, pinLockedUntil: null });
      return { name, secret: { name, username: null, password: null, pin } };
    }
    case "give-sign-in": {
      if (user || !host) return { error: "They already have a sign-in.", status: 400 };
      if (!USERNAME.test(username)) return { error: USERNAME_ERROR, status: 400 };
      if (await usernameTaken(username)) return { error: "That username is taken.", status: 400 };
      const password = temporaryPassword();
      await createStaff({ username, name: host.name, role: "host", hostId: host.id, passwordHash: hashPassword(password), mustChangePassword: true });
      return { name, secret: { name, username, password, pin: null } };
    }
  }
}
