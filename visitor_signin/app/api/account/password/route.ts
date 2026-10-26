import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;

// Change your own password (NFR-SEC-02), including replacing a temporary one from an admin.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  if (next.length < MIN_PASSWORD) return bad(`Use at least ${MIN_PASSWORD} characters.`);
  if (next.length > 200) return bad("That password is too long.");

  const problem = write((d) => {
    const user = d.staff.find((s) => s.id === staff.id);
    if (!user) return "Account not found.";
    if (!verifyPassword(current, user.passwordHash)) return "Your current password isn't right.";
    if (verifyPassword(next, user.passwordHash)) return "Choose a different password from the current one.";
    user.passwordHash = hashPassword(next);
    delete user.mustChangePassword;
    return null;
  });
  if (problem) return bad(problem);

  audit(req, staff, "Password changed", staff.mustChangePassword ? "Replaced a temporary password" : "");
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
