import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { audit } from "@/lib/services/audit";
import { addVisitorType } from "@/lib/services/visitorTypes";

export const dynamic = "force-dynamic";

// Admin adds a visitor type (FR-KIO-04). Admins only (NFR-SEC-03).
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.visitorTypes);
  if (staff instanceof NextResponse) return staff;

  const result = await addVisitorType(await req.json().catch(() => null));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  await audit(req, staff, "Visitor type added", result.type.label);
  return NextResponse.json({ type: result.type }, { status: 201 });
}
