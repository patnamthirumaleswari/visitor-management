import type { Data } from "./db";
import { todayAtLocation } from "./dates";

/**
 * Finds an invitation that can be used to sign in right now: valid today, not used yet,
 * for this location, and its visit still "expected". Match by the invite link's token,
 * or by mobile number for visitors who never opened their invite.
 */
export function findOpenInvitation(d: Data, by: { token?: string; phone?: string }, locationId: string) {
  const today = todayAtLocation();

  for (const invitation of d.invitations) {
    if (invitation.usedAt || today < invitation.validFrom || today > invitation.validTo) continue;

    const visit = d.visits.find((v) => v.id === invitation.visitId);
    if (!visit || visit.status !== "expected" || visit.locationId !== locationId) continue;

    const visitor = d.visitors.find((p) => p.id === visit.visitorId);
    const host = d.hosts.find((h) => h.id === visit.hostId);
    if (!visitor || !host) continue;

    const matches = by.token ? invitation.qrToken === by.token : !!by.phone && visitor.phone === by.phone;
    if (matches) return { invitation, visit, visitor, host };
  }
  return null;
}
