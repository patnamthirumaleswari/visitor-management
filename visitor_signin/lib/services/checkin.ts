import { addEvent, needsApproval } from "../approvals";
import { AGREEMENT } from "../config";
import { todayAtLocation } from "../dates";
import { newId, normalizePhone, type Host, type SafetyBriefing, type StandardField, type Visit, type Visitor, type VisitorType } from "../types";
import { isMobile, MOBILE_ERROR } from "../phone";
import { findHostById } from "../repos/hosts";
import { findInvitations, markInvitationUsed } from "../repos/invitations";
import { useSession } from "../repos/sessions";
import { findVisitorByPhone, insertVisitor, updateVisitor } from "../repos/visitors";
import { insertVisit, nextNumberAndCode, OPEN_STATUSES, saveVisit, transaction } from "../repos/visits";
import { listWatchEntries } from "../repos/watchlist";
import type { TokenPayload } from "../token";
import { randomToken } from "../token";
import { checkAnswers, fieldMode, STANDARD_FIELDS } from "../visitorTypes";
import { findWatchMatch } from "../watchlist";
import { isActiveHost } from "./people";
import { getBriefing } from "./safety";
import { getActiveVisitorTypes, listVisitorTypes } from "./visitorTypes";

// Visitor check-in on their own phone (FR-KIO-05..09). One QR scan = one check-in: the scan's session
// is used up in the same transaction that creates the visit.

export type CheckInForm = {
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

export type CheckInResult = { error: string; status: number } | { host: Host; visitor: Visitor; visit: Visit };

const MAX_IMAGE_CHARS = 1_500_000; // ~1.1 MB once decoded; resized photos are ~50 KB
const SESSION_USED = "You're already signed in from this scan.";

const isImageDataUrl = (v: unknown): v is string =>
  typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= MAX_IMAGE_CHARS;

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** With the safety briefing on, the visitor must tick all three boxes; the version they accepted is kept. */
function checkSafety(briefing: SafetyBriefing, f: CheckInForm): { fields: Partial<Visit> } | { error: string } {
  if (!briefing.enabled) return { fields: {} };
  if (f.safetyAck !== true) return { error: "Please confirm you have read the site safety briefing." };
  if (f.ageConfirmed !== true) return { error: "Please confirm you are 18 years of age or older." };
  if (f.consent !== true) return { error: "Please agree to your details and photo being recorded for this visit." };
  return { fields: { safetyVersion: briefing.version, ageConfirmed: true, consentAt: new Date().toISOString() } };
}

function checkPhotoAndAgreement(type: VisitorType, f: CheckInForm): string | null {
  if (type.photoRequired && !isImageDataUrl(f.photo)) return "A photo is required.";
  if (type.agreementRequired && (!f.agreed || !isImageDataUrl(f.signature))) return "Please accept and sign the agreement.";
  return null;
}

function agreementFields(type: VisitorType, f: CheckInForm) {
  return type.agreementRequired ? { agreementVersion: AGREEMENT.version, signature: f.signature as string } : {};
}

/** Watchlist match (FR-SEC-02): hold for an admin, whatever the type; the host isn't asked. */
function holdForWatchlist(visit: Visit, hit: { name: string; reason: string }, at: string) {
  visit.status = "review";
  visit.watch = { name: hit.name, reason: hit.reason };
  delete visit.signedInAt;
  addEvent(visit, "Watchlist match: sent to admins only", "System", at);
}

/** Pre-registered visitor: name, phone, host and type come from the invitation (FR-KIO-09). */
export async function checkInInvited(session: TokenPayload, token: string, f: CheckInForm): Promise<CheckInResult> {
  const [types, briefing, watchlist] = await Promise.all([listVisitorTypes(), getBriefing(), listWatchEntries(true)]);

  return transaction(async (tx): Promise<CheckInResult> => {
    const match = (await findInvitations({ token }, todayAtLocation(), session.d, tx)).find((m) => isActiveHost(m.host));
    if (!match) return { error: "This invitation isn't valid today. Please sign in as a walk-in visitor.", status: 404 };

    // The type chosen when they were invited, even if an admin has hidden it since.
    const type = types.find((t) => t.id === match.visit.visitorType) ?? types[0];
    const problem = checkPhotoAndAgreement(type, f);
    if (problem) return { error: problem, status: 400 };
    const checked = checkAnswers(type, f.answers);
    if ("error" in checked) return { error: checked.error, status: 400 };
    const safety = checkSafety(briefing, f);
    if ("error" in safety) return { error: safety.error, status: 400 };
    if (!(await useSession(tx, session.n))) return { error: SESSION_USED, status: 409 };

    const now = new Date().toISOString();
    const visitor = { ...match.visitor, ...(isImageDataUrl(f.photo) ? { photo: f.photo } : {}) };
    const before = structuredClone(match.visit);
    const visit = match.visit;
    // The host invited them, so there's nothing to approve: they go straight in.
    Object.assign(visit, {
      status: "signed_in",
      source: "qr",
      ...(await nextNumberAndCode(tx)),
      checkedInAt: now,
      signedInAt: now,
      ...agreementFields(type, f),
      ...(checked.answers.length ? { answers: checked.answers } : {}),
      ...safety.fields,
    } satisfies Partial<Visit>);
    addEvent(visit, "Checked in with an invitation", "Visitor (own phone)", now);
    const hit = findWatchMatch(watchlist, visitor.name, visitor.phone);
    if (hit) holdForWatchlist(visit, hit, now); // even invited visitors are held for an admin
    else addEvent(visit, "Entry approved (invited by host)", match.host.name, now);

    await updateVisitor(tx, visitor);
    await saveVisit(tx, before, visit);
    await markInvitationUsed(tx, match.invitation.id, new Date(now));
    return { host: match.host, visitor, visit };
  });
}

/** Walk-in visitor: fills in the form on their phone. */
export async function checkInWalkIn(session: TokenPayload, f: CheckInForm): Promise<CheckInResult> {
  // Only types currently offered at sign-in (hidden ones can't be picked).
  const type = (await getActiveVisitorTypes()).find((t) => t.id === f.visitorType);
  const name = clean(f.name);
  const phone = normalizePhone(clean(f.phone, 20));
  if (!type) return { error: "Choose a visitor type.", status: 400 };

  // Company, email and purpose are hidden, optional or required depending on the type (FR-KIO-05).
  const field = (key: StandardField, max = 120) => (fieldMode(type, key) === "hidden" ? "" : clean(f[key], max));
  const email = field("email");
  const company = field("company");
  const purpose = field("purpose", 300);
  const missing = STANDARD_FIELDS.find((k) => fieldMode(type, k) === "required" && !{ email, company, purpose }[k]);
  if (missing) return { error: { company: "Enter your company.", email: "Enter your email.", purpose: "Enter the purpose of your visit." }[missing], status: 400 };

  if (name.length < 2) return { error: "Enter your full name.", status: 400 };
  if (!isMobile(phone)) return { error: MOBILE_ERROR, status: 400 };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email or leave it empty.", status: 400 };
  const problem = checkPhotoAndAgreement(type, f);
  if (problem) return { error: problem, status: 400 };
  const checked = checkAnswers(type, f.answers);
  if ("error" in checked) return { error: checked.error, status: 400 };
  const [briefing, watchlist, host] = await Promise.all([getBriefing(), listWatchEntries(true), f.hostId ? findHostById(f.hostId) : null]);
  const safety = checkSafety(briefing, f);
  if ("error" in safety) return { error: safety.error, status: 400 };
  if (!host || !isActiveHost(host)) return { error: "Choose who you are visiting.", status: 400 };

  return transaction(async (tx): Promise<CheckInResult> => {
    const existing = await findVisitorByPhone(phone, tx);
    // One open visit per phone, so a second scan doesn't create a duplicate request.
    if (existing && (await tx.visit.count({ where: { visitorId: existing.id, status: { in: OPEN_STATUSES } } }))) {
      return { error: "This mobile number already has an open visit. Use \"Find my visit\" with your visit code.", status: 409 };
    }
    if (!(await useSession(tx, session.n))) return { error: SESSION_USED, status: 409 };

    const visitor: Visitor = existing
      ? { ...existing, name, email: email || existing.email, company: company || existing.company }
      : { id: newId(), name, phone, email, company };
    if (isImageDataUrl(f.photo)) visitor.photo = f.photo;
    if (existing) await updateVisitor(tx, visitor);
    else await insertVisitor(tx, visitor);

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
      ...(await nextNumberAndCode(tx)),
      checkedInAt: now,
      ...(approval ? {} : { signedInAt: now }),
      badgeToken: randomToken(),
      ...agreementFields(type, f),
      ...(checked.answers.length ? { answers: checked.answers } : {}),
      ...safety.fields,
    };
    addEvent(visit, "Checked in by QR code", "Visitor (own phone)", now);
    const hit = findWatchMatch(watchlist, name, phone);
    if (hit) holdForWatchlist(visit, hit, now);
    else if (!approval) addEvent(visit, `Entry started (${type.label}: no approval needed)`, "System", now);

    await insertVisit(tx, visit);
    return { host, visitor, visit };
  });
}

