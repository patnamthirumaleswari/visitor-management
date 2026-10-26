import { NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

// PINs everyone would try first.
const TOO_EASY = new Set(["1234", "12345", "123456", "0000", "1111", "4321", "1212", "0123"]);

// The logged-in employee changes their reception PIN (FR-EMP-01). Stored hashed, like passwords.
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to an employee record." }, { status: 400 });

  let body: { pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: "Your PIN must be 4 to 6 digits." }, { status: 400 });
  if (TOO_EASY.has(pin) || /^(\d)\1+$/.test(pin)) {
    return NextResponse.json({ error: "That PIN is too easy to guess. Choose another." }, { status: 400 });
  }

  const saved = write((d) => {
    const host = d.hosts.find((h) => h.id === staff.hostId);
    if (!host) return false;
    host.pinHash = hashPassword(pin);
    host.pinFailures = 0;
    delete host.pinLockedUntil;
    return true;
  });
  if (!saved) return NextResponse.json({ error: "Employee record not found." }, { status: 404 });
  audit(req, staff, "Changed own reception PIN");
  return NextResponse.json({ ok: true });
}
