import { NextResponse } from "next/server";
import type { Decision } from "@/lib/approvals";
import { auditVisit } from "@/lib/services/audit";
import { decideFromLink } from "@/lib/services/visitActions";
import { readToken } from "@/lib/token";

export const dynamic = "force-dynamic";

// Approve or deny from the link in the host's email or SMS (Visitor Connect). The signed link
// names the visit and the host, so it works without signing in, for one day.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = readToken(token, "decision");
  if (!payload) return NextResponse.json({ error: "This link has expired. Sign in to answer." }, { status: 401 });
  const [visitId, hostId] = payload.d.split(":");

  const body = (await req.json().catch(() => ({}))) as { decision?: unknown; note?: unknown };
  const decision: Decision | null = body.decision === "approve" || body.decision === "deny" ? body.decision : null;
  if (!decision) return NextResponse.json({ error: "Choose approve or deny." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const result = await decideFromLink(visitId, hostId, decision, note);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const action = decision === "approve"
    ? (result.visitStatus === "gate" ? "Checkout approved" : "Entry approved")
    : (result.visitStatus === "denied" ? "Entry not approved" : "Checkout declined");
  await auditVisit(req, { name: `${result.hostName} (from email)`, role: "Host" }, action, visitId, note ? `Note: ${note}` : "");
  return NextResponse.json({ status: result.visitStatus });
}
