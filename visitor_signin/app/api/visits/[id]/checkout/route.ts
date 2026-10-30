import { after, NextResponse } from "next/server";
import { notifyHostCheckout } from "@/lib/notify";
import { auditVisit } from "@/lib/services/audit";
import { requestCheckoutByBadge } from "@/lib/services/visitActions";

export const dynamic = "force-dynamic";

// The visitor taps Check out on their phone (Visitor Connect). The badge token proves it's their visit.
// The host is asked to confirm the visit is finished; then the visitor goes to the gate.
// Replaces the old direct "Sign out" so visitors can't skip the gate.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: "Visit not found." }, { status: 404 });

  const result = await requestCheckoutByBadge(id, token, "Visitor (own phone)");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const n = result.notify;
  if (n) after(() => notifyHostCheckout(n.host, n.visitor, n.visit));
  await auditVisit(req, { name: "Visitor (own phone)", role: "Visitor" }, "Checkout requested", id);
  return NextResponse.json({ status: result.visitStatus });
}
