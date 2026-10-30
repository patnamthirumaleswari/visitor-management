import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { ON_SITE } from "@/lib/approvals";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { sweepOldRecords } from "@/lib/retention";
import { listOpenEmployeeVisits } from "@/lib/repos/employeeVisits";
import { channelsForVisits } from "@/lib/repos/notifications";
import { findVisitsWithPeople } from "@/lib/repos/visits";
import { typeDisplay } from "@/lib/visitorTypes";
import { listVisitorTypes } from "@/lib/services/visitorTypes";
import type { VisitorType } from "@/lib/types";

export const dynamic = "force-dynamic";

// Live on-site list (FR-ADM-01) — also the evacuation list (FR-EVA-01).
// Admin, reception and security only (NFR-SEC-03).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.onsiteList);
  if (staff instanceof NextResponse) return staff;
  const types = await listVisitorTypes();
  await sweepAutoSignOut(); // so nobody past the end-of-day cut-off shows as on site
  await sweepOldRecords(); // at most once an hour: delete records past the retention time

  const inside = await findVisitsWithPeople({ status: { in: ON_SITE } }, { signedInAt: "desc" }); // on site, checking out, or at the gate
  // How the host was told (FR-NOT-01).
  const told = await channelsForVisits(inside.map((i) => i.visit.id), ["arrival", "approval"]);
  const onsite = inside.map(({ visit: v, visitor, host }) => ({
    id: v.id,
    no: v.no,
    status: v.status,
    name: visitor.name,
    company: visitor.company,
    phone: visitor.phone,
    photo: visitor.photo ?? null,
    host: host.name,
    visitorType: v.visitorType,
    ...typeDisplayFields(types, v.visitorType),
    answers: v.answers ?? [], // the visitor type's questions (FR-KIO-05)
    source: v.source,
    signedInAt: v.signedInAt,
    notified: told[v.id] ?? [],
  }));

  // Employees who signed in at reception and haven't signed out (FR-EMP-01). They are on
  // the evacuation list too.
  const employees = (await listOpenEmployeeVisits()).map(({ visit: v, host }) => ({
    id: v.id,
    name: host.name,
    department: host.department,
    phone: host.phone,
    method: v.method,
    signedInAt: v.signedInAt,
  }));

  // Visitors waiting at reception for approval are inside the building too (evacuation list).
  const waiting = (await findVisitsWithPeople({ status: { in: ["pending", "review"] } }, { checkedInAt: "asc" })).map(({ visit: v, visitor, host }) => ({
    id: v.id,
    name: visitor.name,
    company: visitor.company,
    phone: visitor.phone,
    host: host.name,
    checkedInAt: v.checkedInAt,
  }));

  return NextResponse.json({ onsite, employees, waiting });
}

/** Label and colour of the visit's type, so the page doesn't need its own copy of the types. */
function typeDisplayFields(types: VisitorType[], typeId: string) {
  const { label, color } = typeDisplay(types, typeId);
  return { typeLabel: label, typeColor: color };
}
