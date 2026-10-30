import { LOCATION } from "../config";
import { todayAtLocation } from "../dates";
import { newId, type Host, type Invitation, type Visit, type Visitor } from "../types";
import { findHostById } from "../repos/hosts";
import { findInvitations, insertInvitation, type InvitationMatch } from "../repos/invitations";
import { findVisitorByPhone, insertVisitor, updateVisitor } from "../repos/visitors";
import { insertVisit, transaction } from "../repos/visits";
import { randomToken } from "../token";
import { isActiveHost } from "./people";

// Pre-registration (FR-PRE-01/02, FR-KIO-09): a host invites a visitor for a day; on that day the
// visitor signs in with the invite instead of filling in the form.

/**
 * An invitation that can be used to sign in right now: valid today, not used yet, for this location,
 * its visit still expected, and its host still switched on. Matched by the invite link's token, or
 * by mobile number for visitors who never opened their invite.
 */
export async function findOpenInvitation(by: { token?: string; phone?: string }, locationId: string): Promise<InvitationMatch | null> {
  return (await findInvitations(by, todayAtLocation(), locationId)).find((m) => isActiveHost(m.host)) ?? null;
}

export type NewInvitation = { name: string; phone: string; email: string; company: string; visitDate: string; visitorTypeId: string; hostId: string };

/** Creates the expected visit and its invitation. Returns null if the host isn't available. */
export async function createInvitation(n: NewInvitation): Promise<{ visitor: Visitor; host: Host; visit: Visit; invitation: Invitation } | null> {
  const host = await findHostById(n.hostId);
  if (!host || !isActiveHost(host)) return null;

  return transaction(async (tx) => {
    const existing = await findVisitorByPhone(n.phone, tx);
    const visitor: Visitor = existing
      ? { ...existing, name: n.name, email: n.email || existing.email, company: n.company || existing.company }
      : { id: newId(), name: n.name, phone: n.phone, email: n.email, company: n.company };
    if (existing) await updateVisitor(tx, visitor);
    else await insertVisitor(tx, visitor);

    const visit: Visit = {
      id: newId(),
      visitorId: visitor.id,
      hostId: host.id,
      locationId: LOCATION.id,
      visitorType: n.visitorTypeId,
      purpose: "",
      status: "expected",
      source: "portal",
      expectedDate: n.visitDate,
      badgeToken: randomToken(),
    };
    const invitation: Invitation = {
      id: newId(),
      visitId: visit.id,
      qrToken: randomToken(),
      validFrom: n.visitDate,
      validTo: n.visitDate,
      createdAt: new Date().toISOString(),
    };
    await insertVisit(tx, visit);
    await insertInvitation(tx, invitation);
    return { visitor, host, visit, invitation };
  });
}
