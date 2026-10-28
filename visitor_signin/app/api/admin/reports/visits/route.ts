import { NextResponse } from "next/server";
import { audit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { RANGES, visitsCsv, type Range } from "@/lib/analytics";
import { todayAtLocation } from "@/lib/dates";

export const dynamic = "force-dynamic";

// CSV export of visits (FR-REP-02): ?days=7|14|30. Admins only, and logged.
export async function GET(req: Request) {
  const staff = await requireStaffApi(ACCESS.reports);
  if (staff instanceof NextResponse) return staff;

  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days: Range = RANGES.includes(asked as Range) ? (asked as Range) : 30;
  await audit(req, staff, "Visit report downloaded", `Last ${days} days (CSV)`);

  return new NextResponse(visitsCsv(days), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visits-last-${days}-days-${todayAtLocation()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
