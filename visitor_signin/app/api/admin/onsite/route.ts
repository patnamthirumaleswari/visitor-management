import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

// Live on-site list (FR-ADM-01) — also the evacuation list (FR-EVA-01).
// Admin, reception and security only (NFR-SEC-03).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.onsiteList);
  if (staff instanceof NextResponse) return staff;
  sweepAutoSignOut(); // so nobody past the end-of-day cut-off shows as on site

  const onsite = read((d) =>
    d.visits
      .filter((v) => v.status === "signed_in")
      .sort((a, b) => (b.signedInAt ?? "").localeCompare(a.signedInAt ?? ""))
      .map((v) => {
        const visitor = d.visitors.find((p) => p.id === v.visitorId);
        const host = d.hosts.find((h) => h.id === v.hostId);
        return {
          id: v.id,
          name: visitor?.name ?? "",
          company: visitor?.company ?? "",
          phone: visitor?.phone ?? "",
          photo: visitor?.photo ?? null,
          host: host?.name ?? "",
          visitorType: v.visitorType,
          source: v.source,
          signedInAt: v.signedInAt,
          // How the host was told (FR-NOT-01); records from before invitations count as arrivals.
          notified: d.notifications
            .filter((n) => n.visitId === v.id && (n.kind ?? "arrival") === "arrival")
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

  return NextResponse.json({ onsite, employees });
}
