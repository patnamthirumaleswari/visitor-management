import { after, NextResponse } from "next/server";
import { canClearHold, canWorkGate, clearHold, gateHold, gateRelease } from "@/lib/approvals";
import { ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { write } from "@/lib/db";
import { notifyHostHold } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Action = "release" | "hold" | "clear";

// At the gate (Visitor Connect): security releases a cleared visitor, or holds them with a reason;
// the visitor's host, reception or an admin clears a hold. TODO: write to the audit log (FR-ROLE-02).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(["admin", "receptionist", "security", "host"]);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  const action: Action | null = body.action === "release" || body.action === "hold" || body.action === "clear" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Choose release, hold or clear." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const by = staff.role === "host" ? staff.name : `${staff.name} (${ROLE_LABELS[staff.role]})`;

  const result = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit) return { error: "Visit not found.", status: 404 };
    if (action === "clear") {
      if (!canClearHold(staff, visit)) return { error: visit.status === "hold" ? "Only this visitor's host, reception or an admin can clear the hold." : "This visitor is no longer on hold.", status: visit.status === "hold" ? 403 : 409 };
      const problem = clearHold(visit, by, reason);
      return problem ? { error: problem, status: 409 } : { visitStatus: visit.status };
    }
    if (!canWorkGate(staff)) return { error: "Only security, reception or an admin can do this.", status: 403 };
    const problem = action === "release" ? gateRelease(visit, by) : gateHold(visit, by, reason);
    if (problem) return { error: problem, status: action === "hold" && reason.length < 3 ? 400 : 409 };
    const host = d.hosts.find((h) => h.id === visit.hostId);
    const visitor = d.visitors.find((p) => p.id === visit.visitorId);
    return { visitStatus: visit.status, held: action === "hold" && host && visitor ? { host, visitor, visit: { ...visit } } : null };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const held = "held" in result ? result.held : null;
  if (held) after(() => notifyHostHold(held.host, held.visitor, held.visit));
  return NextResponse.json({ status: result.visitStatus });
}
