import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AGREEMENT, VISITOR_TYPES, type VisitorTypeConfig } from "@/lib/config";
import { newId, normalizePhone, write, type Host, type Visit, type Visitor } from "@/lib/db";
import { findOpenInvitation } from "@/lib/invitations";
import { notifyHost } from "@/lib/notify";
import { getSignInSession, SESSION_COOKIE } from "@/lib/session";
import { randomToken, type TokenPayload } from "@/lib/token";

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

    const type = VISITOR_TYPES.find((t) => t.id === match.visit.visitorType) ?? VISITOR_TYPES[0];
    const problem = checkPhotoAndAgreement(type, body);
    if (problem) return { error: problem, status: 400 };

    const now = new Date().toISOString();
    if (isImageDataUrl(body.photo)) match.visitor.photo = body.photo;
    Object.assign(match.visit, {
      status: "signed_in",
      source: "qr",
      signedInAt: now,
      ...agreementFields(type, body),
    } satisfies Partial<Visit>);
    match.invitation.usedAt = now;
    d.usedSessions.push(session.n);
    return { host: match.host, visitor: match.visitor, visit: match.visit };
  });

  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : finish(result);
}

async function signInWalkIn(session: TokenPayload, body: Body) {
  const type = VISITOR_TYPES.find((t) => t.id === body.visitorType);
  const name = clean(body.name);
  const phone = normalizePhone(clean(body.phone, 20));
  const email = clean(body.email);
  const company = clean(body.company);
  const purpose = clean(body.purpose, 300);

  if (!type) return bad("Choose a visitor type.");
  if (name.length < 2) return bad("Enter your full name.");
  if (phone.replace(/\D/g, "").length < 8) return bad("Enter a valid mobile number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email or leave it empty.");
  const problem = checkPhotoAndAgreement(type, body);
  if (problem) return bad(problem);

  const result = write((d) => {
    // Re-check inside the write so two rapid submits can't both use the same session.
    if (d.usedSessions.includes(session.n)) return { error: SESSION_USED, status: 409 };
    const host = d.hosts.find((h) => h.id === body.hostId);
    if (!host) return { error: "Choose who you are visiting.", status: 400 };

    let visitor = d.visitors.find((v) => v.phone === phone);
    if (visitor) {
      Object.assign(visitor, { name, email: email || visitor.email, company: company || visitor.company });
    } else {
      visitor = { id: newId(), name, phone, email, company } satisfies Visitor;
      d.visitors.push(visitor);
    }
    if (isImageDataUrl(body.photo)) visitor.photo = body.photo;

    const visit: Visit = {
      id: newId(),
      visitorId: visitor.id,
      hostId: host.id,
      locationId: session.d,
      visitorType: type.id,
      purpose,
      status: "signed_in",
      source: "qr",
      signedInAt: new Date().toISOString(),
      badgeToken: randomToken(),
      ...agreementFields(type, body),
    };
    d.visits.push(visit);
    d.usedSessions.push(session.n);
    return { host, visitor, visit };
  });

  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : finish(result);
}

function checkPhotoAndAgreement(type: VisitorTypeConfig, body: Body): string | null {
  if (type.photoRequired && !isImageDataUrl(body.photo)) return "A photo is required.";
  if (type.agreementRequired && (!body.agreed || !isImageDataUrl(body.signature))) return "Please accept and sign the agreement.";
  return null;
}

function agreementFields(type: VisitorTypeConfig, body: Body) {
  return type.agreementRequired ? { agreementVersion: AGREEMENT.version, signature: body.signature as string } : {};
}

async function finish({ host, visitor, visit }: { host: Host; visitor: Visitor; visit: Visit }) {
  (await cookies()).delete(SESSION_COOKIE);

  // Runs after the response is sent, so the visitor never waits on email/SMS delivery.
  after(() => notifyHost(host, visitor, visit));

  return NextResponse.json({ id: visit.id, badgeToken: visit.badgeToken }, { status: 201 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
