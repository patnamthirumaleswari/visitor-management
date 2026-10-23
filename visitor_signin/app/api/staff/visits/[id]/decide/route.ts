import { NextResponse } from "next/server";
import { canDecide, decide, type Decision } from "@/lib/approvals";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";

export const dynamic = "force-dynamic";

// Approve or deny a waiting visitor from the staff screens (Visitor Connect).
// Hosts can answer for their own visitors; admins and reception for anyone.
// TODO: write to the audit log (FR-ROLE-02).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { decision?: unknown; note?: unknown };
  const decision: Decision | null = body.decision === "approve" || body.decision === "deny" ? body.decision : null;
  if (!decision) return NextResponse.json({ error: "Choose approve or deny." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const result = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit) return { error: "Visit not found.", status: 404 };
    if (visit.status === "pending" && !canDecide(staff, visit)) {
      return { error: "Only this visitor's host, reception or an admin can answer.", status: 403 };
    }
    const by = staff.role === "host" ? staff.name : `${staff.name} (${ROLE_LABELS[staff.role]})`;
    const problem = decide(visit, decision, by, note);
    if (problem) return { error: problem, status: 409 };
    return { visitStatus: visit.status };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ status: result.visitStatus });
}
