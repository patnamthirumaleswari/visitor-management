import { after, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { notifyHostHold } from "@/lib/notify";
import { auditVisit } from "@/lib/services/audit";
import { gateAction, type GateAction } from "@/lib/services/visitActions";

export const dynamic = "force-dynamic";

// At the gate (Visitor Connect): security releases a cleared visitor, or holds them with a reason;
// the visitor's host, reception or an admin clears a hold.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(["admin", "receptionist", "security", "host"]);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  const action: GateAction | null = body.action === "release" || body.action === "hold" || body.action === "clear" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Choose release, hold or clear." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const result = await gateAction(id, staff, action, reason);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const held = result.held;
  if (held) after(() => notifyHostHold(held.host, held.visitor, held.visit));
  await auditVisit(req, staff, { release: "Released at gate", hold: "Held at gate", clear: "Hold cleared" }[action], id, reason ? `Reason: ${reason}` : "");
  return NextResponse.json({ status: result.visitStatus });
}
