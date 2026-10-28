import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { isOnSite } from "@/lib/approvals";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { sweepOldRecords } from "@/lib/retention";
import { read, type Data } from "@/lib/db";
import { typeDisplay } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

// Live on-site list (FR-ADM-01) — also the evacuation list (FR-EVA-01).
// Admin, reception and security only (NFR-SEC-03).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.onsiteList);
  if (staff instanceof NextResponse) return staff;
  await sweepAutoSignOut(); // so nobody past the end-of-day cut-off shows as on site
  await sweepOldRecords(); // at most once an hour: delete records past the retention time

  const onsite = read((d) =>
    d.visits
      .filter(isOnSite) // inside: on site, checking out, or at the gate
      .sort((a, b) => (b.signedInAt ?? "").localeCompare(a.signedInAt ?? ""))
      .map((v) => {
        const visitor = d.visitors.find((p) => p.id === v.visitorId);
        const host = d.hosts.find((h) => h.id === v.hostId);
        return {
          id: v.id,
          no: v.no,
          status: v.status,
          name: visitor?.name ?? "",
          company: visitor?.company ?? "",
          phone: visitor?.phone ?? "",
          photo: visitor?.photo ?? null,
          host: host?.name ?? "",
          visitorType: v.visitorType,
          ...typeDisplayFields(d, v.visitorType),
          answers: v.answers ?? [], // the visitor type's questions (FR-KIO-05)
          source: v.source,
          signedInAt: v.signedInAt,
          // How the host was told (FR-NOT-01); records from before invitations count as arrivals.
          notified: d.notifications
            .filter((n) => n.visitId === v.id && ["arrival", "approval"].includes(n.kind ?? "arrival"))
            .map(({ channel, status }) => ({ channel, status })),
        };
      }),
  );

  // Employees who signed in at reception and haven't signed out (FR-EMP-01). They are on
  // the evacuation list too.
  const employees = read((d) =>
    d.employeeVisits
      .filter((v) => !v.signedOutAt)
      .sort((a, b) => b.signedInAt.localeCompare(a.signedInAt))
      .map((v) => {
        const employee = d.hosts.find((h) => h.id === v.hostId);
        return {
          id: v.id,
          name: employee?.name ?? "",
          department: employee?.department ?? "",
          phone: employee?.phone ?? "",
          method: v.method,
          signedInAt: v.signedInAt,
        };
      }),
  );

  // Visitors waiting at reception for approval are inside the building too (evacuation list).
  const waiting = read((d) =>
    d.visits
      .filter((v) => v.status === "pending" || v.status === "review")
      .map((v) => {
        const visitor = d.visitors.find((p) => p.id === v.visitorId);
        return {
          id: v.id,
          name: visitor?.name ?? "",
          company: visitor?.company ?? "",
          phone: visitor?.phone ?? "",
          host: d.hosts.find((h) => h.id === v.hostId)?.name ?? "",
          checkedInAt: v.checkedInAt,
        };
      }),
  );

  return NextResponse.json({ onsite, employees, waiting });
}

/** Label and colour of the visit's type, so the page doesn't need its own copy of the types. */
function typeDisplayFields(d: Data, typeId: string) {
  const { label, color } = typeDisplay(d, typeId);
  return { typeLabel: label, typeColor: color };
}
