import { NextResponse } from "next/server";
import { todayAtLocation } from "@/lib/dates";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { read, type Data } from "@/lib/db";
import { typeDisplay } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

// Pre-registered visitors due today who haven't arrived yet.
// Admin and reception only (NFR-SEC-03).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;

  const today = todayAtLocation();
  const expected = read((d) =>
    d.visits
      .filter((v) => v.status === "expected" && v.expectedDate === today)
      .map((v) => {
        const visitor = d.visitors.find((p) => p.id === v.visitorId);
        return {
          id: v.id,
          name: visitor?.name ?? "",
          company: visitor?.company ?? "",
          phone: visitor?.phone ?? "",
          host: d.hosts.find((h) => h.id === v.hostId)?.name ?? "",
          visitorType: v.visitorType,
          ...typeDisplayFields(d, v.visitorType),
        };
      }),
  );
  return NextResponse.json({ expected });
}

/** Label and colour of the visit's type, so the page doesn't need its own copy of the types. */
function typeDisplayFields(d: Data, typeId: string) {
  const { label, color } = typeDisplay(d, typeId);
  return { typeLabel: label, typeColor: color };
}
