import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Host, Visit, Visitor } from "@/lib/types";
import { notifyHost, notifyHostApproval, notifyWatchlistMatch } from "@/lib/notify";
import { auditVisit } from "@/lib/services/audit";
import { checkInInvited, checkInWalkIn, type CheckInForm } from "@/lib/services/checkin";
import { getSignInSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

// Creates the visit from the phone flow (lib/services/checkin.ts). The session is used up, so one QR
// scan = one sign-in. Invited visitors send their invitation token instead of the form.
export async function POST(req: Request) {
  const session = await getSignInSession();
  if (!session) {
    return NextResponse.json({ error: "Your sign-in session expired. Please scan the QR code at reception again." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as (CheckInForm & { invitationToken?: string }) | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = typeof body.invitationToken === "string" && body.invitationToken
    ? await checkInInvited(session, body.invitationToken, body)
    : await checkInWalkIn(session, body);
  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : finish(result);
}

async function finish({ host, visitor, visit }: { host: Host; visitor: Visitor; visit: Visit }) {
  (await cookies()).delete(SESSION_COOKIE);

  // Runs after the response is sent, so the visitor never waits on email/SMS delivery.
  // A waiting visitor sends the host an Approve / Deny request; otherwise a plain "has arrived".
  // A watchlist match tells reception/admins only, never the host.
  after(() =>
    visit.status === "review"
      ? notifyWatchlistMatch(visitor, visit)
      : visit.status === "pending"
        ? notifyHostApproval(host, visitor, visit)
        : notifyHost(host, visitor, visit),
  );

  await auditVisit(null, { name: "Visitor (own phone)", role: "Visitor" }, visit.status === "review" ? "Visitor checked in (watchlist match)" : "Visitor checked in", visit.id, `Host ${host.name}`);
  return NextResponse.json({ id: visit.id, badgeToken: visit.badgeToken }, { status: 201 });
}
