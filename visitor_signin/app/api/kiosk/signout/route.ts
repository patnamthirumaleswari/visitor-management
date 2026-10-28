import { after, NextResponse } from "next/server";
import { notifyHostCheckout } from "@/lib/notify";
import { requestCheckoutByBadge } from "@/lib/services/visitActions";

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

  // Visitor Connect: leaving goes through the host's confirmation and security at the gate.
  const result = await requestCheckoutByBadge(visitId, token, "Visitor (reception screen)", { onlyIfOnSite: true });
  if ("error" in result) return NextResponse.json({ error: "We couldn't find that visit." }, { status: 404 });
  const n = result.notify;
  if (n) after(() => notifyHostCheckout(n.host, n.visitor, n.visit));
  return NextResponse.json({ firstName: result.firstName, already: result.already, next: result.visitStatus });
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
