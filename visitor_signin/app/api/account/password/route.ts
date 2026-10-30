import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { audit } from "@/lib/services/audit";
import { changePassword } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

// Change your own password (NFR-SEC-02), including replacing a temporary one from an admin.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  const problem = await changePassword(staff.id, current, next);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await audit(req, staff, "Password changed", staff.mustChangePassword ? "Replaced a temporary password" : "");
  return NextResponse.json({ ok: true });
}
