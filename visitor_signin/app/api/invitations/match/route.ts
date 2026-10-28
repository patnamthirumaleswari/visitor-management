import { NextResponse, type NextRequest } from "next/server";
import { isMobile } from "@/lib/phone";
import { normalizePhone, read } from "@/lib/db";
import { findOpenInvitation } from "@/lib/invitations";
import { getSignInSession } from "@/lib/session";
import { findVisitorType } from "@/lib/services/visitorTypes";

export const dynamic = "force-dynamic";

// Called from the phone sign-in flow: "is this visitor expected today?"
// Needs a live session, so it only works for someone who just scanned the reception QR.
export async function GET(req: NextRequest) {
  const session = await getSignInSession();
  if (!session) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
  if (!token && !isMobile(phone)) return NextResponse.json({ invitation: null });

  const found = read((d) => findOpenInvitation(d, token ? { token } : { phone }, session.d));
  // The full type, with its questions, even if an admin has hidden it since the invite was sent.
  const match = found && { ...found, type: await findVisitorType(found.visit.visitorType) };
  return NextResponse.json({
    invitation: match && {
      token: match.invitation.qrToken,
      visitorName: match.visitor.name,
      hostName: match.host.name,
      visitorType: match.visit.visitorType,
      type: match.type,
    },
  });
}
