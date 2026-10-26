import { NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { addEvent, isOnSite } from "@/lib/approvals";
import { write } from "@/lib/db";

// Manual sign-out from the portal (FR-ADM-02).
// Admin and reception only (NFR-SEC-03).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const found = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit) return false;
    // Staff can end a visit at any stage (a staff override of the checkout and gate steps).
    if (isOnSite(visit) || visit.status === "pending" || visit.status === "review") {
      visit.status = "signed_out";
      visit.signedOutAt = new Date().toISOString();
      visit.signedOutBy = "portal";
      delete visit.hold;
      addEvent(visit, "Signed out by staff", staff.name);
    }
    return true;
  });
  if (found) auditVisit(req, staff, "Visitor signed out by staff", id);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Visit not found" }, { status: 404 });
}
