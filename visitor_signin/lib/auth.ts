import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { StaffRole, StaffUser } from "./db";
import { findStaffById } from "./repos/staff";
import { readToken } from "./token";

// Staff login (NFR-SEC-02/03). The cookie holds a signed token with the staff user's id;
// every page and API looks the user up again, so a removed account stops working at once.

export const STAFF_COOKIE = "vms_staff";
export const STAFF_SESSION_SECONDS = 8 * 60 * 60; // one working day
export const CHANGE_PASSWORD_PATH = "/account/password";

export type Staff = Omit<StaffUser, "passwordHash">;

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  receptionist: "Receptionist",
  host: "Host",
  security: "Security",
};

// Who can open what. Each page and API checks this on every request.
export const ACCESS = {
  admin: ["admin", "receptionist"], // /admin: on-site + expected lists, manual sign-out
  onsiteList: ["admin", "receptionist", "security"], // live on-site list (also the evacuation list)
  preRegister: ["admin", "receptionist", "host"], // /pre-register and creating invitations
  security: ["admin", "receptionist", "security"], // /security
  account: ["admin", "receptionist", "host", "security"], // /account: own notification settings, password
  inbox: ["admin", "receptionist", "host"], // /inbox: approval requests and alerts sent to you
  people: ["admin"], // /admin/people: add staff and employees, reset passwords and PINs, switch off
  settings: ["admin"], // /admin/settings: escalation time, sign-out time, how long records are kept
  branding: ["admin"], // /admin/branding: logo, colour, company name, welcome text
  gate: ["admin", "receptionist", "security"], // /gate: release or hold visitors leaving
  decide: ["admin", "receptionist", "host"], // approve / deny entry: hosts for their own visitors only
  safety: ["admin"], // /admin/safety: the site safety briefing visitors accept
  visitorTypes: ["admin"], // /admin/visitor-types: types, their fields and questions, photo on/off
  watchlist: ["admin"], // /admin/watchlist: people held for an admin at check-in (FR-SEC-01..03)
  reports: ["admin"], // /admin/audit and /admin/analytics, CSV export (FR-ROLE-02, FR-REP-01/02)
} satisfies Record<string, StaffRole[]>;

/** Where each role lands after logging in. */
export function homeFor(role: StaffRole): string {
  if (role === "host") return "/requests";
  if (role === "security") return "/gate";
  return "/admin";
}

export async function getStaff(): Promise<Staff | null> {
  const token = readToken((await cookies()).get(STAFF_COOKIE)?.value, "staff");
  if (!token) return null;
  const user = await findStaffById(token.d);
  if (!user || user.active === false) return null; // switched off on /admin/people
  const { passwordHash: _, ...staff } = user;
  return staff;
}

/** For pages: sends logged-out users to /login and other roles to their own home page. */
export async function requireStaffPage(roles: readonly StaffRole[], path: string): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect(`/login?next=${encodeURIComponent(path)}`);
  // A temporary password from an admin: choose your own before anything else.
  if (staff.mustChangePassword && path !== CHANGE_PASSWORD_PATH) redirect(`${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(path)}`);
  if (!roles.includes(staff.role)) redirect(homeFor(staff.role));
  return staff;
}

/** For API routes: returns the staff user, or a 401/403 response to send back. */
export async function requireStaffApi(roles: readonly StaffRole[]): Promise<Staff | NextResponse> {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!roles.includes(staff.role)) return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  return staff;
}
