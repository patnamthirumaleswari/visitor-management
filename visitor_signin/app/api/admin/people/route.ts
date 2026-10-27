import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { newId, normalizePhone, read, write, type Host, type StaffRole, type StaffUser } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { peopleRows, temporaryPassword, temporaryPin } from "@/lib/people";
import { isMobile, MOBILE_ERROR } from "@/lib/phone";

export const dynamic = "force-dynamic";

const ROLES: StaffRole[] = ["host", "receptionist", "security", "admin"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// People (FR-ADM-04): list everyone, and add a person. Admins only.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json({ people: read(peopleRows) });
}

/**
 * Adds a person. A host is an employee visitors can choose; with signIn they also get an account to
 * approve their visitors. Reception, security and admins always get an account. New accounts get a
 * temporary password, shown once, which they replace at first sign-in.
 */
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const role = ROLES.find((r) => r === body?.role);
  const name = str(body?.name, 80);
  const username = str(body?.username, 40).toLowerCase();
  const department = str(body?.department, 60);
  const email = str(body?.email, 120);
  const phone = normalizePhone(str(body?.phone, 20));
  const signIn = role !== "host" || body?.signIn !== false;

  if (!role) return bad("Choose a role.");
  if (name.length < 2) return bad("Enter their full name.");
  if (signIn && !/^[a-z0-9._@-]{3,40}$/.test(username)) return bad("Choose a username: 3 to 40 letters, numbers, dots or dashes.");
  if (role === "host") {
    if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Enter their email: approval requests go there.");
    if (phone && !isMobile(phone)) return bad(MOBILE_ERROR);
  }

  const password = signIn ? temporaryPassword() : null;
  const pin = role === "host" ? temporaryPin() : null;
  const result = write((d) => {
    if (signIn && d.staff.some((s) => s.username.toLowerCase() === username)) return { error: "That username is taken." };
    let host: Host | undefined;
    if (role === "host") {
      host = { id: newId(), name, email, phone, department, pinHash: hashPassword(pin!), qrToken: crypto.randomBytes(18).toString("base64url") };
      d.hosts.push(host);
    }
    if (signIn) {
      const user: StaffUser = { id: newId(), username, name, role, ...(host ? { hostId: host.id } : {}), passwordHash: hashPassword(password!), mustChangePassword: true };
      d.staff.push(user);
    }
    return { ok: true };
  });
  if ("error" in result) return bad(result.error!);

  audit(req, staff, "Person added", `${name} (${ROLE_LABELS[role]}${signIn ? `, username ${username}` : ", no sign-in"})`);
  // The secrets are shown to the admin once and never stored in plain text.
  return NextResponse.json({ people: read(peopleRows), secret: { name, username: signIn ? username : null, password, pin } }, { status: 201 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
