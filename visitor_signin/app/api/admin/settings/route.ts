import { NextResponse } from "next/server";
import { audit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { sweepOldRecords } from "@/lib/retention";
import { saveSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

// Site settings (/admin/settings): escalation time, automatic sign-out time, how long records are
// kept. Admins only.
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.settings);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const escalateMinutes = Number(body?.escalateMinutes);
  const autoSignoutTime = typeof body?.autoSignoutTime === "string" ? body.autoSignoutTime.trim() : "";
  const retentionDays = Number(body?.retentionDays);
  if (!Number.isInteger(escalateMinutes) || escalateMinutes < 1 || escalateMinutes > 60) return bad("Escalation time must be 1 to 60 minutes.");
  if (autoSignoutTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(autoSignoutTime)) return bad("Choose a sign-out time, or switch it off.");
  if (!Number.isInteger(retentionDays) || (retentionDays !== 0 && (retentionDays < 7 || retentionDays > 3650))) {
    return bad("Keep records for 7 to 3650 days, or choose Keep forever.");
  }

  const saved = await saveSettings({ escalateMinutes, autoSignoutTime, retentionDays });
  await audit(req, staff, "Settings saved",
    `Escalate after ${escalateMinutes} min · auto sign-out ${autoSignoutTime || "off"} · keep records ${retentionDays ? `${retentionDays} days` : "forever"}`);
  const deleted = await sweepOldRecords(true); // a shorter retention time applies straight away
  return NextResponse.json({ settings: saved, deleted });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
