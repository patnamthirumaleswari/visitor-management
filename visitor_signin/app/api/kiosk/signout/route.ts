import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { requestCheckout } from "@/lib/approvals";
import { notifyHostCheckout } from "@/lib/notify";
import { findVisitorType } from "@/lib/visitorTypes";
import { write, type Visit } from "@/lib/db";

export const dynamic = "force-dynamic";

type Body = { visitId?: unknown; badge?: unknown };

// Visitor signs out at reception (FR-KIO-10), either by picking their name from the search,
// or by showing the QR code on their badge to the reception camera.
// TODO: only paired reception tablets should call this (FR-KIO-02).
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // The badge QR holds the badge link: <site>/badge/<visit id>?t=<badge token>.
  let visitId: string | undefined;
  let token: string | undefined;
  if (typeof body.badge === "string") {
    const parsed = parseBadgeQr(body.badge);
    if (!parsed) return NextResponse.json({ error: "That isn't a visitor badge QR code." }, { status: 400 });
    ({ visitId, token } = parsed);
  } else if (typeof body.visitId === "string") {
    visitId = body.visitId;
  } else {
    return NextResponse.json({ error: "Choose your name or scan your badge." }, { status: 400 });
  }

  const result = write((d) => {
    const visit = d.visits.find((v) => v.id === visitId);
    if (!visit || (token !== undefined && !safeEqual(visit.badgeToken, token))) return { error: "We couldn't find that visit." } as const;
    const visitor = d.visitors.find((p) => p.id === visit.visitorId);
    const firstName = visitor?.name.split(" ")[0] ?? "";
    // Visitor Connect: leaving goes through the host's confirmation and security at the gate.
    if (visit.status !== "signed_in") return { firstName, already: true, next: visit.status } as const;
    requestCheckout(visit, findVisitorType(d, visit.visitorType) ?? {}, "Visitor (reception screen)");
    const next = visit.status as Visit["status"]; // changed by requestCheckout: "checkout", or "gate" if no approval is needed
    const host = d.hosts.find((h) => h.id === visit.hostId);
    return { firstName, already: false, next, notify: next === "checkout" && host && visitor ? { host, visitor, visit: { ...visit } } : null } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  const n = "notify" in result ? result.notify : null;
  if (n) after(() => notifyHostCheckout(n.host, n.visitor, n.visit));
  return NextResponse.json({ firstName: result.firstName, already: result.already, next: result.next });
}

function parseBadgeQr(text: string): { visitId: string; token: string } | null {
  try {
    const url = new URL(text.trim());
    const match = /^\/badge\/([^/]+)$/.exec(url.pathname);
    const token = url.searchParams.get("t");
    return match && token ? { visitId: decodeURIComponent(match[1]), token } : null;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
