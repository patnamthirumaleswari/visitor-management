import { NextResponse } from "next/server";
import { auditVisit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { signOutByStaff } from "@/lib/services/visitActions";

// Manual sign-out from the portal (FR-ADM-02).
// Admin and reception only (NFR-SEC-03).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const found = await signOutByStaff(id, staff);
  if (found) await auditVisit(req, staff, "Visitor signed out by staff", id);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Visit not found" }, { status: 404 });
}
