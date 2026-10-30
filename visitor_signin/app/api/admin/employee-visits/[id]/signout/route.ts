import { NextResponse } from "next/server";
import { audit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { signOutEmployeeByStaff } from "@/lib/services/employees";

// Reception signs an employee out from the portal, e.g. someone who left without signing out.
// Admin and reception only (NFR-SEC-03).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.admin);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const found = await signOutEmployeeByStaff(id);
  if (found) await audit(req, staff, "Employee signed out by staff", id);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
