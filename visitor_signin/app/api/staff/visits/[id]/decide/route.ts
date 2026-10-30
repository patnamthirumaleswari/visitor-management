import { NextResponse } from "next/server";
import type { Decision } from "@/lib/approvals";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { auditVisit } from "@/lib/services/audit";
import { decideAsStaff } from "@/lib/services/visitActions";

export const dynamic = "force-dynamic";

// Answer a waiting visitor from the staff screens (Visitor Connect): entry (approve / deny), or a
// checkout request (approve = cleared for the gate, deny = "not yet").
// Hosts can answer for their own visitors; admins and reception for anyone.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { decision?: unknown; note?: unknown };
  const decision: Decision | null = body.decision === "approve" || body.decision === "deny" ? body.decision : null;
  if (!decision) return NextResponse.json({ error: "Choose approve or deny." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const result = await decideAsStaff(id, staff, decision, note);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const action = decision === "approve"
    ? (result.visitStatus === "gate" ? "Checkout approved" : "Entry approved")
    : (result.visitStatus === "denied" ? "Entry not approved" : "Checkout declined");
  await auditVisit(req, staff, action, id, note ? `Note: ${note}` : "");
  return NextResponse.json({ status: result.visitStatus });
}
