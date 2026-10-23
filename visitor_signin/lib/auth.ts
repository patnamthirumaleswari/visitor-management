import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { read, type StaffRole, type StaffUser } from "./db";
import { readToken } from "./token";

// Staff login (NFR-SEC-02/03). The cookie holds a signed token with the staff user's id;
// every page and API looks the user up again, so a removed account stops working at once.

export const STAFF_COOKIE = "vms_staff";
export const STAFF_SESSION_SECONDS = 8 * 60 * 60; // one working day

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
  account: ["admin", "receptionist", "host", "security"], // /account: own notification settings
  branding: ["admin"], // /admin/branding: logo, colour, company name, welcome text
  decide: ["admin", "receptionist", "host"], // approve / deny entry: hosts for their own visitors only
  visitorTypes: ["admin"], // /admin/visitor-types: types, their fields and questions, photo on/off
} satisfies Record<string, StaffRole[]>;

/** Where each role lands after logging in. */
export function homeFor(role: StaffRole): string {
  if (role === "host") return "/requests";
  if (role === "security") return "/security";
  return "/admin";
}

export async function getStaff(): Promise<Staff | null> {
  const token = readToken((await cookies()).get(STAFF_COOKIE)?.value, "staff");
  if (!token) return null;
  const user = read((d) => d.staff.find((s) => s.id === token.d));
  if (!user) return null;
  const { passwordHash: _, ...staff } = user;
  return staff;
}

/** For pages: sends logged-out users to /login and other roles to their own home page. */
export async function requireStaffPage(roles: readonly StaffRole[], path: string): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect(`/login?next=${encodeURIComponent(path)}`);
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
