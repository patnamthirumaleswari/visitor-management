import { NextResponse, type NextRequest } from "next/server";
import { activityFor } from "@/lib/activity";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { checkEscalations } from "@/lib/services/requests";

export const dynamic = "force-dynamic";

// Activity tracker: what happened with visits in the last day or week, newest first.
// Hosts see their own visitors; admins and reception see everyone's.
export async function GET(req: NextRequest) {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;

  await checkEscalations();
  const days = req.nextUrl.searchParams.get("days") === "7" ? 7 : 1;
  return NextResponse.json({ items: await activityFor(staff, days) });
}
