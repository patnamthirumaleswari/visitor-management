import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { checkEscalations, pendingFor, todayForHost } from "@/lib/requests";

export const dynamic = "force-dynamic";

// "Needs your answer": visitors waiting for approval that this person can decide on, plus
// (for hosts) their visitors from earlier today. Staff screens poll this every few seconds.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;

  await checkEscalations();
  return NextResponse.json({
    pending: await pendingFor(staff),
    today: staff.role === "host" && staff.hostId ? await todayForHost(staff.hostId) : [],
  });
}
