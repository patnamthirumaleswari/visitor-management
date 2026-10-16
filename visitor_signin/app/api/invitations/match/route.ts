import { NextResponse, type NextRequest } from "next/server";
import { normalizePhone, read } from "@/lib/db";
import { findOpenInvitation } from "@/lib/invitations";
import { getSignInSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Called from the phone sign-in flow: "is this visitor expected today?"
// Needs a live session, so it only works for someone who just scanned the reception QR.
export async function GET(req: NextRequest) {
  const session = await getSignInSession();
  if (!session) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
  if (!token && phone.replace(/\D/g, "").length < 8) return NextResponse.json({ invitation: null });

  const match = read((d) => findOpenInvitation(d, token ? { token } : { phone }, session.d));
  return NextResponse.json({
    invitation: match && {
      token: match.invitation.qrToken,
      visitorName: match.visitor.name,
      hostName: match.host.name,
      visitorType: match.visit.visitorType,
    },
  });
}
