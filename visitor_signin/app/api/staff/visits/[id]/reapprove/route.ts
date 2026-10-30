import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { auditVisit } from "@/lib/services/audit";
import { reapproveVisit } from "@/lib/services/visitActions";

export const dynamic = "force-dynamic";

// Approve after all: the host (or reception, or an admin) changes their mind about a visitor they
// didn't approve, as long as it was today and the visitor hasn't checked in again.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const result = await reapproveVisit(id, staff);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await auditVisit(req, staff, "Approved after all", id);
  return NextResponse.json({ status: result.visitStatus });
}
