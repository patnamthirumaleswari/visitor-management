import QRCode from "qrcode";
import { audit, auditVisit } from "@/lib/services/audit";
import { after, NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { publicBaseUrl } from "@/lib/baseUrl";
import { LOCATION } from "@/lib/config";
import { todayAtLocation } from "@/lib/dates";
import { isActiveHost } from "@/lib/services/people";
import { isMobile, MOBILE_ERROR } from "@/lib/phone";
import { newId, normalizePhone, write, type Invitation, type Visit, type Visitor } from "@/lib/db";
import { notifyVisitorInvited } from "@/lib/notify";
import { randomToken } from "@/lib/token";
import { getActiveVisitorTypes } from "@/lib/services/visitorTypes";

export const dynamic = "force-dynamic";

type Body = {
  visitorName?: string;
  phone?: string;
  email?: string;
  company?: string;
  visitorType?: string;
  visitDate?: string;
  hostId?: string;
};

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Host pre-registers a visitor (FR-PRE-01). Creates an "expected" visit plus an invitation
// whose link/QR the visitor opens on their phone.
// Only logged-in hosts, reception and admins (NFR-SEC-03). A host can only invite for themselves.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.preRegister);
  if (staff instanceof NextResponse) return staff;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const name = clean(body.visitorName);
  const phone = normalizePhone(clean(body.phone, 20));
  const email = clean(body.email);
  const company = clean(body.company);
  const visitDate = clean(body.visitDate, 10);
  const type = (await getActiveVisitorTypes()).find((t) => t.id === body.visitorType);
  const hostId = staff.role === "host" ? staff.hostId : body.hostId;

  if (name.length < 2) return bad("Enter the visitor's full name.");
  if (!isMobile(phone)) return bad(MOBILE_ERROR);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email or leave it empty.");
  if (!type) return bad("Choose a visitor type.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) return bad("Choose a visit date.");
  if (visitDate < todayAtLocation()) return bad("The visit date can't be in the past.");

  const result = write((d) => {
    const host = d.hosts.find((h) => h.id === hostId && isActiveHost(h));
    if (!host) return null;

    let visitor = d.visitors.find((v) => v.phone === phone);
    if (visitor) {
      Object.assign(visitor, { name, email: email || visitor.email, company: company || visitor.company });
    } else {
      visitor = { id: newId(), name, phone, email, company } satisfies Visitor;
      d.visitors.push(visitor);
    }

    const visit: Visit = {
      id: newId(),
      visitorId: visitor.id,
      hostId: host.id,
      locationId: LOCATION.id,
      visitorType: type.id,
      purpose: "",
      status: "expected",
      source: "portal",
      expectedDate: visitDate,
      badgeToken: randomToken(),
    };
    const invitation: Invitation = {
      id: newId(),
      visitId: visit.id,
      qrToken: randomToken(),
      validFrom: visitDate,
      validTo: visitDate,
      createdAt: new Date().toISOString(),
    };
    d.visits.push(visit);
    d.invitations.push(invitation);
    return { visitor, host, visit, invitation };
  });

  if (!result) return bad("Choose the host.");

  const inviteUrl = `${publicBaseUrl()}/invite/${result.invitation.qrToken}`;
  const qr = await QRCode.toDataURL(inviteUrl, { margin: 1, width: 400, errorCorrectionLevel: "M" });
  after(() => notifyVisitorInvited(result.visitor, result.host, result.visit, inviteUrl));

  await audit(req, staff, "Visitor pre-registered", `${result.visitor.name} for ${visitDate}, host ${result.host.name}`);
  return NextResponse.json({ inviteUrl, qr }, { status: 201 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
