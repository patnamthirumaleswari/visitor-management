import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { setOwnNotifyBy } from "@/lib/services/account";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

// A host chooses how they hear about arrivals: email, SMS or both (FR-NOT-06).
// Only changes the logged-in user's own host record.
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to a host." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { notifyBy?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = await setOwnNotifyBy(staff.hostId, body.notifyBy);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await audit(req, staff, "Changed own notification settings", result.notifyBy.join(" + "));
  return NextResponse.json({ notifyBy: result.notifyBy });
}
