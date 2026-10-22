import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";

// Reception signs an employee out from the portal, e.g. someone who left without signing out.
// Admin and reception only (NFR-SEC-03).
// TODO: write to the audit log (FR-ROLE-02).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const found = write((d) => {
    const visit = d.employeeVisits.find((v) => v.id === id);
    if (!visit) return false;
    if (!visit.signedOutAt) {
      visit.signedOutAt = new Date().toISOString();
      visit.signedOutBy = "portal";
    }
    return true;
  });
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
