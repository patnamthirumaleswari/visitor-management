import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { setOwnPin } from "@/lib/services/account";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

// The logged-in employee changes their reception PIN (FR-EMP-01). Stored hashed, like passwords.
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to an employee record." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = await setOwnPin(staff.hostId, typeof body.pin === "string" ? body.pin : "");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await audit(req, staff, "Changed own reception PIN");
  return NextResponse.json({ ok: true });
}
