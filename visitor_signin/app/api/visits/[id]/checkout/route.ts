import crypto from "node:crypto";
import { audit, auditVisit } from "@/lib/services/audit";
import { after, NextResponse } from "next/server";
import { requestCheckout } from "@/lib/approvals";
import { write } from "@/lib/db";
import { notifyHostCheckout } from "@/lib/notify";
import { findVisitorType } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

// The visitor taps Check out on their phone (Visitor Connect). The badge token proves it's their visit.
// The host is asked to confirm the visit is finished; then the visitor goes to the gate.
// Replaces the old direct "Sign out" so visitors can't skip the gate.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  const result = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit || !token || !safeEqual(visit.badgeToken, token)) return { error: "Visit not found.", status: 404 };
    const type = findVisitorType(d, visit.visitorType) ?? {};
    const already = visit.status === "checkout";
    const problem = requestCheckout(visit, type, "Visitor (own phone)");
    if (problem) return { error: problem, status: 409 };
    const host = d.hosts.find((h) => h.id === visit.hostId);
    const visitor = d.visitors.find((p) => p.id === visit.visitorId);
    return { visitStatus: visit.status, notify: !already && visit.status === "checkout" && host && visitor ? { host, visitor, visit: { ...visit } } : null };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const n = result.notify;
  if (n) after(() => notifyHostCheckout(n.host, n.visitor, n.visit));
  await auditVisit(req, { name: "Visitor (own phone)", role: "Visitor" }, "Checkout requested", id);
  return NextResponse.json({ status: result.visitStatus });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
