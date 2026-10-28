import { NextResponse } from "next/server";
import { todayAtLocation } from "@/lib/dates";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { findVisitsWithPeople } from "@/lib/repos/visits";
import { typeDisplay } from "@/lib/visitorTypes";
import { listVisitorTypes } from "@/lib/services/visitorTypes";
import type { VisitorType } from "@/lib/types";

export const dynamic = "force-dynamic";

// Pre-registered visitors due today who haven't arrived yet.
// Admin and reception only (NFR-SEC-03).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;
  const types = await listVisitorTypes();

  const today = todayAtLocation();
  const due = await findVisitsWithPeople({ status: "expected", expectedDate: today }, { checkedInAt: "asc" });
  const expected = due.map(({ visit: v, visitor, host }) => ({
    id: v.id,
    name: visitor.name,
    company: visitor.company,
    phone: visitor.phone,
    host: host.name,
    visitorType: v.visitorType,
    ...typeDisplayFields(types, v.visitorType),
  }));
  return NextResponse.json({ expected });
}

/** Label and colour of the visit's type, so the page doesn't need its own copy of the types. */
function typeDisplayFields(types: VisitorType[], typeId: string) {
  const { label, color } = typeDisplay(types, typeId);
  return { typeLabel: label, typeColor: color };
}
