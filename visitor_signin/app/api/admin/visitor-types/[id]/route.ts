import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { audit } from "@/lib/services/audit";
import { changeVisitorType, removeVisitorType } from "@/lib/services/visitorTypes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Admin edits a visitor type: name, colour, which fields it asks (FR-KIO-05), photo on/off (FR-KIO-07),
// agreement, its questions, or hides it. Admins only (NFR-SEC-03).
export async function PUT(req: Request, { params }: Params) {
  const staff = await requireStaffApi(ACCESS.visitorTypes);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const result = await changeVisitorType(id, await req.json().catch(() => null));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await audit(req, staff, "Visitor type changed", `${result.type.label}${result.type.active ? "" : " (hidden)"}`);
  return NextResponse.json(result);
}

// Deleting is only allowed for a type no visit has used; otherwise hide it, so past visits
// keep their type's name and colour.
export async function DELETE(req: Request, { params }: Params) {
  const staff = await requireStaffApi(ACCESS.visitorTypes);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const result = await removeVisitorType(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await audit(req, staff, "Visitor type deleted", id);
  return NextResponse.json(result);
}
