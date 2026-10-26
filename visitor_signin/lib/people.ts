import crypto from "node:crypto";
import type { Data, Host, StaffRole } from "./db";

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

const ROLE_ORDER: Record<StaffRole, number> = { admin: 0, receptionist: 1, security: 2, host: 3 };

export function peopleRows(d: Data): PersonRow[] {
  const rows: PersonRow[] = d.staff.map((s) => {
    const host = s.hostId ? d.hosts.find((h) => h.id === s.hostId) : undefined;
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
  for (const h of d.hosts) {
    if (d.staff.some((s) => s.hostId === h.id)) continue;
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
