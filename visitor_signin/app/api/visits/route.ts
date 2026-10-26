import { after, NextResponse } from "next/server";
import { audit, auditVisit } from "@/lib/audit";
import { cookies } from "next/headers";
import { AGREEMENT } from "@/lib/config";
import { newId, normalizePhone, write, type Host, type SafetyBriefing, type StandardField, type Visit, type Visitor, type VisitorType } from "@/lib/db";
import { findOpenInvitation } from "@/lib/invitations";
import { addEvent, isOpen, needsApproval, newNumberAndCode } from "@/lib/approvals";
import { briefingFrom, getBriefing } from "@/lib/safety";
import { findWatchMatch } from "@/lib/watchlist";
import { isActiveHost } from "@/lib/people";
import { isMobile, MOBILE_ERROR } from "@/lib/phone";
import { notifyHost, notifyHostApproval, notifyWatchlistMatch } from "@/lib/notify";
import { getSignInSession, SESSION_COOKIE } from "@/lib/session";
import { randomToken, type TokenPayload } from "@/lib/token";
import { checkAnswers, fieldMode, findVisitorType, getActiveVisitorTypes, STANDARD_FIELDS } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

type Body = {
  invitationToken?: string;
  visitorType?: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  purpose?: string;
  hostId?: string;
  photo?: string | null;
  signature?: string | null;
  agreed?: boolean;
  answers?: Record<string, string>; // question id -> answer (FR-KIO-05)
  safetyAck?: boolean; // read and will follow the safety briefing (Visitor Connect)
  ageConfirmed?: boolean; // 18 years or older
  consent?: boolean; // agrees to details and photo being recorded
};

const MAX_IMAGE_CHARS = 1_500_000; // ~1.1 MB once decoded; resized photos are ~50 KB

const isImageDataUrl = (v: unknown): v is string =>
  typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= MAX_IMAGE_CHARS;

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const SESSION_USED = "You're already signed in from this scan.";

// Creates the visit from the phone flow. The session is consumed, so one QR scan = one sign-in.
// Invited visitors send their invitation token instead of the form; walk-ins send the form.
export async function POST(req: Request) {
  const session = await getSignInSession();
  if (!session) {
    return NextResponse.json({ error: "Your sign-in session expired. Please scan the QR code at reception again." }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  return typeof body.invitationToken === "string" && body.invitationToken
    ? signInInvited(session, body, body.invitationToken)
    : signInWalkIn(session, body);
}

// Pre-registered visitor: name, phone, host and type come from the invitation (FR-KIO-09).
async function signInInvited(session: TokenPayload, body: Body, token: string) {
  const result = write((d) => {
    if (d.usedSessions.includes(session.n)) return { error: SESSION_USED, status: 409 };
    const match = findOpenInvitation(d, { token }, session.d);
    if (!match) return { error: "This invitation isn't valid today. Please sign in as a walk-in visitor.", status: 404 };

    // The type chosen when they were invited, even if an admin has hidden it since.
    const type = findVisitorType(d, match.visit.visitorType) ?? d.visitorTypes[0];
    const problem = checkPhotoAndAgreement(type, body);
    if (problem) return { error: problem, status: 400 };
    const checked = checkAnswers(type, body.answers);
    if ("error" in checked) return { error: checked.error, status: 400 };
    const safety = checkSafety(briefingFrom(d), body);
    if ("error" in safety) return { error: safety.error, status: 400 };

    const now = new Date().toISOString();
    if (isImageDataUrl(body.photo)) match.visitor.photo = body.photo;
    // The host invited them, so there's nothing to approve: they go straight in.
    Object.assign(match.visit, {
      status: "signed_in",
      source: "qr",
      ...newNumberAndCode(d),
      checkedInAt: now,
      signedInAt: now,
      ...agreementFields(type, body),
      ...(checked.answers.length ? { answers: checked.answers } : {}),
      ...safety.fields,
    } satisfies Partial<Visit>);
    match.invitation.usedAt = now;
    addEvent(match.visit, "Checked in with an invitation", "Visitor (own phone)", now);
    const hit = findWatchMatch(d, match.visitor.name, match.visitor.phone);
    if (hit) {
      // Even invited visitors are held for an admin when they match the watchlist.
      Object.assign(match.visit, { status: "review", watch: { name: hit.name, reason: hit.reason } });
      delete match.visit.signedInAt;
      addEvent(match.visit, "Watchlist match: sent to admins only", "System", now);
    } else {
      addEvent(match.visit, "Entry approved (invited by host)", match.host.name, now);
    }
    d.usedSessions.push(session.n);
    return { host: match.host, visitor: match.visitor, visit: match.visit };
  });

  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : finish(result);
}

async function signInWalkIn(session: TokenPayload, body: Body) {
  // Only types currently offered at sign-in (hidden ones can't be picked).
  const type = getActiveVisitorTypes().find((t) => t.id === body.visitorType);
  const name = clean(body.name);
  const phone = normalizePhone(clean(body.phone, 20));
  if (!type) return bad("Choose a visitor type.");

  // Company, email and purpose are hidden, optional or required depending on the type (FR-KIO-05).
  const field = (name: StandardField, max = 120) => (fieldMode(type, name) === "hidden" ? "" : clean(body[name], max));
  const email = field("email");
  const company = field("company");
  const purpose = field("purpose", 300);
  const missing = STANDARD_FIELDS.find((f) => fieldMode(type, f) === "required" && !{ email, company, purpose }[f]);
  if (missing) return bad({ company: "Enter your company.", email: "Enter your email.", purpose: "Enter the purpose of your visit." }[missing]);

  if (name.length < 2) return bad("Enter your full name.");
  if (!isMobile(phone)) return bad(MOBILE_ERROR);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email or leave it empty.");
  const problem = checkPhotoAndAgreement(type, body);
  if (problem) return bad(problem);
  const checked = checkAnswers(type, body.answers);
  if ("error" in checked) return bad(checked.error);
  const safety = checkSafety(getBriefing(), body);
  if ("error" in safety) return bad(safety.error);

  const result = write((d) => {
    // Re-check inside the write so two rapid submits can't both use the same session.
    if (d.usedSessions.includes(session.n)) return { error: SESSION_USED, status: 409 };
    const host = d.hosts.find((h) => h.id === body.hostId && isActiveHost(h));
    if (!host) return { error: "Choose who you are visiting.", status: 400 };

    let visitor = d.visitors.find((v) => v.phone === phone);
    // One open visit per phone, so a second scan doesn't create a duplicate request.
    if (visitor && d.visits.some((v) => v.visitorId === visitor!.id && isOpen(v))) {
      return { error: "This mobile number already has an open visit. Use \"Find my visit\" with your visit code.", status: 409 };
    }
    if (visitor) {
      Object.assign(visitor, { name, email: email || visitor.email, company: company || visitor.company });
    } else {
      visitor = { id: newId(), name, phone, email, company } satisfies Visitor;
      d.visitors.push(visitor);
    }
    if (isImageDataUrl(body.photo)) visitor.photo = body.photo;

    // Walk-ins wait at reception until the host approves, unless their type doesn't need approval.
    const now = new Date().toISOString();
    const approval = needsApproval(type);
    const visit: Visit = {
      id: newId(),
      visitorId: visitor.id,
      hostId: host.id,
      locationId: session.d,
      visitorType: type.id,
      purpose,
      status: approval ? "pending" : "signed_in",
      source: "qr",
      ...newNumberAndCode(d),
      checkedInAt: now,
      ...(approval ? {} : { signedInAt: now }),
      badgeToken: randomToken(),
      ...agreementFields(type, body),
      ...(checked.answers.length ? { answers: checked.answers } : {}),
      ...safety.fields,
    };
    addEvent(visit, "Checked in by QR code", "Visitor (own phone)", now);
    const hit = findWatchMatch(d, name, phone);
    if (hit) {
      // Watchlist match (FR-SEC-02): hold for an admin, whatever the type; the host isn't asked.
      visit.status = "review";
      visit.watch = { name: hit.name, reason: hit.reason };
      delete visit.signedInAt;
      addEvent(visit, "Watchlist match: sent to admins only", "System", now);
    } else if (!approval) {
      addEvent(visit, `Entry started (${type.label}: no approval needed)`, "System", now);
    }
    d.visits.push(visit);
    d.usedSessions.push(session.n);
    return { host, visitor, visit };
  });

  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : finish(result);
}

/** With the safety briefing on, the visitor must tick all three boxes; the version they accepted is kept. */
function checkSafety(briefing: SafetyBriefing, body: Body): { fields: Partial<Visit> } | { error: string } {
  if (!briefing.enabled) return { fields: {} };
  if (body.safetyAck !== true) return { error: "Please confirm you have read the site safety briefing." };
  if (body.ageConfirmed !== true) return { error: "Please confirm you are 18 years of age or older." };
  if (body.consent !== true) return { error: "Please agree to your details and photo being recorded for this visit." };
  return { fields: { safetyVersion: briefing.version, ageConfirmed: true, consentAt: new Date().toISOString() } };
}

function checkPhotoAndAgreement(type: VisitorType, body: Body): string | null {
  if (type.photoRequired && !isImageDataUrl(body.photo)) return "A photo is required.";
  if (type.agreementRequired && (!body.agreed || !isImageDataUrl(body.signature))) return "Please accept and sign the agreement.";
  return null;
}

function agreementFields(type: VisitorType, body: Body) {
  return type.agreementRequired ? { agreementVersion: AGREEMENT.version, signature: body.signature as string } : {};
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

  auditVisit(null, { name: "Visitor (own phone)", role: "Visitor" }, visit.status === "review" ? "Visitor checked in (watchlist match)" : "Visitor checked in", visit.id, `Host ${host.name}`);
  return NextResponse.json({ id: visit.id, badgeToken: visit.badgeToken }, { status: 201 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
