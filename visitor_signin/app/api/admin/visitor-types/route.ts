import { NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";
import { cleanVisitorType, newVisitorTypeId } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

// Admin adds a visitor type (FR-KIO-04). Admins only (NFR-SEC-03).
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.visitorTypes);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => null);
  const result = write((d) => {
    const label = typeof body?.label === "string" ? body.label : "";
    const cleaned = cleanVisitorType(body, newVisitorTypeId(d, label));
    if ("error" in cleaned) return cleaned;
    d.visitorTypes.push(cleaned.type);
    return cleaned;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  audit(req, staff, "Visitor type added", result.type.label);
  return NextResponse.json({ type: result.type }, { status: 201 });
}
