import { NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";
import { cleanVisitorType } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const NEED_ONE = "At least one visitor type must stay available, or visitors can't sign in.";

// Admin edits a visitor type: name, colour, which fields it asks (FR-KIO-05), photo on/off (FR-KIO-07),
// agreement, its questions, or hides it. Admins only (NFR-SEC-03).
export async function PUT(req: Request, { params }: Params) {
  const staff = await requireStaffApi(ACCESS.visitorTypes);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const result = write((d) => {
    const index = d.visitorTypes.findIndex((t) => t.id === id);
    if (index === -1) return { error: "That visitor type doesn't exist any more.", status: 404 };
    const cleaned = cleanVisitorType(body, id);
    if ("error" in cleaned) return { error: cleaned.error, status: 400 };
    if (!cleaned.type.active && !d.visitorTypes.some((t, i) => i !== index && t.active)) return { error: NEED_ONE, status: 400 };
    d.visitorTypes[index] = cleaned.type;
    return { type: cleaned.type };
  });

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

  const result = write((d) => {
    const type = d.visitorTypes.find((t) => t.id === id);
    if (!type) return { error: "That visitor type doesn't exist any more.", status: 404 };
    if (d.visits.some((v) => v.visitorType === id)) {
      return { error: `${type.label} has been used for visits, so it can't be deleted. Hide it instead.`, status: 409 };
    }
    if (type.active && !d.visitorTypes.some((t) => t.id !== id && t.active)) return { error: NEED_ONE, status: 400 };
    d.visitorTypes = d.visitorTypes.filter((t) => t.id !== id);
    return { ok: true };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await audit(req, staff, "Visitor type deleted", id);
  return NextResponse.json(result);
}
