import crypto from "node:crypto";
import {
  addEvent,
  canClearHold,
  canDecide,
  canReapprove,
  canWorkGate,
  clearHold,
  decide,
  gateHold,
  gateRelease,
  isOnSite,
  reapprove,
  requestCheckout,
  type Decision,
} from "../approvals";
import { ROLE_LABELS, type Staff } from "../auth";
import type { Visit } from "../types";
import { findHostById } from "../repos/hosts";
import { changeVisit, countVisits, findVisitWithPeople, OPEN_STATUSES, type VisitWithPeople } from "../repos/visits";
import { listVisitorTypes } from "./visitorTypes";

// What staff and visitors do to a visit after check-in: approve or deny, request checkout, the gate,
// approve after all, staff sign-out. Each locks the visit, applies the rule from lib/approvals.ts and
// saves it in one transaction. Results that need a notification carry the visit with its people.

type Fail = { error: string; status: number };
const NOT_FOUND: Fail = { error: "Visit not found.", status: 404 };

/** How a staff member is named in a visit's history: hosts by name, others with their role. */
export const actorName = (staff: Staff) => (staff.role === "host" ? staff.name : `${staff.name} (${ROLE_LABELS[staff.role]})`);

const withPeople = async (id: string) => (await findVisitWithPeople(id))!;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** A staff member answers entry or checkout. */
export async function decideAsStaff(id: string, staff: Staff, decision: Decision, note: string): Promise<Fail | { visitStatus: Visit["status"] }> {
  const r = await changeVisit(id, (visit): Fail | { visitStatus: Visit["status"] } => {
    if (visit.status === "review" && !canDecide(staff, visit)) return { error: "Only an admin can answer this one.", status: 403 }; // watchlist match
    if ((visit.status === "pending" || visit.status === "checkout") && !canDecide(staff, visit)) {
      return { error: "Only this visitor's host, reception or an admin can answer.", status: 403 };
    }
    const problem = decide(visit, decision, actorName(staff), note);
    return problem ? { error: problem, status: 409 } : { visitStatus: visit.status };
  });
  return r ?? NOT_FOUND;
}

/** The host answers from the Approve / Deny link in their email or SMS. */
export async function decideFromLink(id: string, hostId: string, decision: Decision, note: string): Promise<Fail | { visitStatus: Visit["status"]; hostName: string }> {
  const host = await findHostById(hostId);
  if (!host) return NOT_FOUND;
  const r = await changeVisit(id, (visit): Fail | { visitStatus: Visit["status"]; hostName: string } => {
    if (visit.hostId !== hostId) return NOT_FOUND;
    if (visit.status === "review") return { error: "An admin needs to answer this visit.", status: 403 }; // watchlist match
    const problem = decide(visit, decision, `${host.name} (from email)`, note);
    return problem ? { error: problem, status: 409 } : { visitStatus: visit.status, hostName: host.name };
  });
  return r ?? NOT_FOUND;
}

/** A denied visitor let in after all (changing your mind). */
export async function reapproveVisit(id: string, staff: Staff): Promise<Fail | { visitStatus: Visit["status"] }> {
  const r = await changeVisit(id, async (visit, tx): Promise<Fail | { visitStatus: Visit["status"] }> => {
    if (visit.status === "denied" && !canReapprove(staff, visit)) {
      return { error: "Only this visitor's host, reception or an admin can change the answer.", status: 403 };
    }
    const again = (await tx.visit.count({ where: { visitorId: visit.visitorId, id: { not: visit.id }, status: { in: OPEN_STATUSES } } })) > 0;
    const problem = reapprove(visit, actorName(staff), again);
    return problem ? { error: problem, status: 409 } : { visitStatus: visit.status };
  });
  return r ?? NOT_FOUND;
}

export type GateAction = "release" | "hold" | "clear";

/** Security releases or holds a visitor at the gate; the host, reception or an admin clears a hold. */
export async function gateAction(id: string, staff: Staff, action: GateAction, reason: string): Promise<Fail | { visitStatus: Visit["status"]; held: VisitWithPeople | null }> {
  const by = actorName(staff);
  const r = await changeVisit(id, (visit): Fail | { visitStatus: Visit["status"] } => {
    if (action === "clear") {
      if (!canClearHold(staff, visit)) {
        return visit.status === "hold"
          ? { error: "Only this visitor's host, reception or an admin can clear the hold.", status: 403 }
          : { error: "This visitor is no longer on hold.", status: 409 };
      }
      const problem = clearHold(visit, by, reason);
      return problem ? { error: problem, status: 409 } : { visitStatus: visit.status };
    }
    if (!canWorkGate(staff)) return { error: "Only security, reception or an admin can do this.", status: 403 };
    const problem = action === "release" ? gateRelease(visit, by) : gateHold(visit, by, reason);
    if (problem) return { error: problem, status: action === "hold" && reason.length < 3 ? 400 : 409 };
    return { visitStatus: visit.status };
  });
  if (!r) return NOT_FOUND;
  if ("error" in r) return r;
  return { ...r, held: action === "hold" ? await withPeople(id) : null };
}

/**
 * The visitor taps Check out, on their phone (badge token) or at reception. Returns the visit with its
 * people when the host now has to confirm, so the route can tell them.
 */
export async function requestCheckoutByBadge(id: string, token: string | undefined, by: string, opts: { onlyIfOnSite?: boolean } = {}): Promise<Fail | { visitStatus: Visit["status"]; already: boolean; firstName: string; notify: VisitWithPeople | null }> {
  const types = await listVisitorTypes();
  const r = await changeVisit(id, (visit): Fail | { visitStatus: Visit["status"]; already: boolean; askHost: boolean } => {
    if (token !== undefined && !safeEqual(visit.badgeToken, token)) return NOT_FOUND;
    // At reception: anything but "on site" is just reported back (already leaving, or gone).
    if (opts.onlyIfOnSite && visit.status !== "signed_in") return { visitStatus: visit.status, already: true, askHost: false };
    const already = visit.status === "checkout";
    const problem = requestCheckout(visit, types.find((t) => t.id === visit.visitorType) ?? {}, by);
    if (problem) return { error: problem, status: 409 };
    return { visitStatus: visit.status, already, askHost: !already && visit.status === "checkout" };
  });
  if (!r) return NOT_FOUND;
  if ("error" in r) return r;
  const people = await withPeople(id);
  return { visitStatus: r.visitStatus, already: r.already, firstName: people.visitor.name.split(" ")[0] ?? "", notify: r.askHost ? people : null };
}

/** Staff end a visit at any stage (a staff override of the checkout and gate steps). */
export async function signOutByStaff(id: string, staff: Staff): Promise<boolean> {
  const r = await changeVisit(id, (visit) => {
    if (isOnSite(visit) || visit.status === "pending" || visit.status === "review") {
      visit.status = "signed_out";
      visit.signedOutAt = new Date().toISOString();
      visit.signedOutBy = "portal";
      delete visit.hold;
      addEvent(visit, "Signed out by staff", staff.name);
    }
    return true;
  });
  return r === true;
}

/** Whether this visitor has an open visit other than `visit` (then a denial can't be reversed). */
export async function checkedInAgainSince(visit: Visit): Promise<boolean> {
  return (await countVisits({ visitorId: visit.visitorId, id: { not: visit.id }, status: { in: OPEN_STATUSES } })) > 0;
}
