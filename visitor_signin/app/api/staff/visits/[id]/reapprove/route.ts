import { NextResponse } from "next/server";
import { canReapprove, reapprove } from "@/lib/approvals";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";

export const dynamic = "force-dynamic";

// "Approve after all": the host (or reception / an admin) changes their mind about a visitor they
// didn't approve, the same day. The visitor's phone switches to "You are approved".
// TODO: write to the audit log (FR-ROLE-02).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.decide);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const result = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit) return { error: "Visit not found.", status: 404 };
    if (visit.status === "denied" && !canReapprove(staff, visit)) {
      return { error: "Only this visitor's host, reception or an admin can change the answer.", status: 403 };
    }
    const by = staff.role === "host" ? staff.name : `${staff.name} (${ROLE_LABELS[staff.role]})`;
    const problem = reapprove(d, visit, by);
    if (problem) return { error: problem, status: 409 };
    return { visitStatus: visit.status };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ status: result.visitStatus });
}
