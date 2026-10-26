import { NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write, type NotificationChannel } from "@/lib/db";

export const dynamic = "force-dynamic";

const CHANNELS: NotificationChannel[] = ["email", "sms"];

// A host chooses how they hear about arrivals: email, SMS or both (FR-NOT-06).
// Only changes the logged-in user's own host record.
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to a host." }, { status: 400 });

  let body: { notifyBy?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const notifyBy = Array.isArray(body.notifyBy)
    ? CHANNELS.filter((c) => (body.notifyBy as unknown[]).includes(c))
    : [];
  if (notifyBy.length === 0) return NextResponse.json({ error: "Choose email, SMS or both." }, { status: 400 });

  const saved = write((d) => {
    const host = d.hosts.find((h) => h.id === staff.hostId);
    if (!host) return false;
    host.notifyBy = notifyBy;
    return true;
  });
  if (!saved) return NextResponse.json({ error: "Host not found." }, { status: 404 });
  audit(req, staff, "Changed own notification settings", notifyBy.join(" + "));
  return NextResponse.json({ notifyBy });
}
