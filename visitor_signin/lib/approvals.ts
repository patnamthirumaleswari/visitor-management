import crypto from "node:crypto";
import { FIRST_VISIT_NO, LOCATION } from "./config";
import { getSettings } from "./settings";
import { read, write, type Data, type Visit, type VisitorType } from "./db";
import type { Staff } from "./auth";

// Host approval (Visitor Connect): a walk-in waits at reception until their host approves entry.
// Admins and reception can also decide, and step in when a host doesn't answer in time.

/** On site: approved and inside, including while checking out or at the gate. */
export const ON_SITE: Visit["status"][] = ["signed_in", "checkout", "gate", "hold"];
export const isOnSite = (v: Visit) => ON_SITE.includes(v.status);

/** Visits that are still going on: waiting for approval, or on site. */
export const isOpen = (v: Visit) => v.status === "pending" || v.status === "review" || isOnSite(v);

/** Whether this type makes visitors wait for the host. Types saved before the setting existed do. */
export const needsApproval = (type: Pick<VisitorType, "approvalRequired">) => type.approvalRequired !== false;

export function addEvent(visit: Visit, event: string, by: string, at = new Date().toISOString()) {
  (visit.timeline ??= []).push({ at, event, by });
}

/** The next visitor number, and a 4-digit code no other open visit is using. Runs inside write(). */
export function newNumberAndCode(d: Data): { no: number; code: string } {
  const no = Math.max(d.counters?.visitNo ?? FIRST_VISIT_NO - 1, FIRST_VISIT_NO - 1) + 1;
  d.counters = { ...d.counters, visitNo: no };
  const used = new Set(d.visits.filter(isOpen).map((v) => v.code));
  let code: string;
  do code = String(crypto.randomInt(1000, 10000));
  while (used.has(code));
  return { no, code };
}

/** Hosts decide for their own visitors (entry and checkout); admins and reception for anyone. */
export function canDecide(staff: Staff, visit: Visit): boolean {
  if (visit.status === "review") return staff.role === "admin"; // watchlist match: admins only
  if (visit.status !== "pending" && visit.status !== "checkout") return false;
  if (staff.role === "admin" || staff.role === "receptionist") return true;
  return staff.role === "host" && !!staff.hostId && staff.hostId === visit.hostId;
}

export type Decision = "approve" | "deny";

/**
 * Answers whatever the visit is waiting for: entry (approve / deny) or checkout (approve = cleared
 * for the gate, deny = "not yet", the visitor stays). Returns an error message if it was already
 * answered. Runs inside write().
 */
export function decide(visit: Visit, decision: Decision, by: string, note = ""): string | null {
  if (visit.status === "checkout") return decideCheckout(visit, decision, by, note);
  if (visit.status !== "pending" && visit.status !== "review") {
    const last = visit.decidedBy ? ` by ${visit.decidedBy}` : "";
    return visit.status === "signed_in"
      ? `Already approved${last}.`
      : visit.status === "denied"
        ? `Already not approved${last}.`
        : "This visit has ended.";
  }
  const now = new Date().toISOString();
  visit.decidedAt = now;
  visit.decidedBy = by;
  if (decision === "approve") {
    visit.status = "signed_in";
    visit.signedInAt = now;
    addEvent(visit, "Entry approved", by, now);
  } else {
    visit.status = "denied";
    if (note) visit.decisionNote = note.slice(0, 200);
    addEvent(visit, "Entry not approved", by, now);
  }
  return null;
}

// ───────── Changing your mind: approve a denied visitor after all ─────────

const dayAtLocation = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso));

/**
 * Whether a denied visit can still be approved: denied today (they may still be at reception), and the
 * visitor hasn't checked in again since (then the newer request is the one to answer).
 */
export function reapproveProblem(d: Data, visit: Visit): string | null {
  if (visit.status !== "denied") return "Only a visit that wasn't approved can be approved after all.";
  if (!visit.decidedAt || dayAtLocation(visit.decidedAt) !== dayAtLocation(new Date().toISOString())) {
    return "This was not approved on an earlier day. Ask them to check in again.";
  }
  if (d.visits.some((v) => v.id !== visit.id && v.visitorId === visit.visitorId && isOpen(v))) {
    return "They have checked in again. Answer their newer request instead.";
  }
  return null;
}

/** The visitor's host, reception or an admin may change the answer. */
export const canReapprove = (staff: Staff, visit: Visit) =>
  visit.status === "denied" && (staff.role === "admin" || staff.role === "receptionist" || (staff.role === "host" && staff.hostId === visit.hostId));

/** Lets a denied visitor in after all. Runs inside write(). */
export function reapprove(d: Data, visit: Visit, by: string): string | null {
  const problem = reapproveProblem(d, visit);
  if (problem) return problem;
  const now = new Date().toISOString();
  visit.status = "signed_in";
  visit.signedInAt = now;
  visit.decidedAt = now;
  visit.decidedBy = by;
  delete visit.decisionNote;
  addEvent(visit, "Entry approved after all (changed from not approved)", by, now);
  return null;
}

// ───────── Checkout and the gate (Visitor Connect) ─────────

/**
 * The visitor taps Check out (on their phone or at reception). The host confirms the visit is
 * finished, unless the type needs no approval: then they're cleared for the gate straight away.
 */
export function requestCheckout(visit: Visit, type: Pick<VisitorType, "approvalRequired">, by: string): string | null {
  if (visit.status === "checkout") return null; // already asked; nothing to do
  if (visit.status !== "signed_in") return visit.status === "gate" || visit.status === "hold" ? "Go to the exit gate." : "This visit isn't on site.";
  const now = new Date().toISOString();
  delete visit.checkoutNote;
  visit.checkoutRequestedAt = now;
  visit.checkoutEscalated = false;
  addEvent(visit, "Checkout requested", by, now);
  if (needsApproval(type)) {
    visit.status = "checkout";
  } else {
    visit.status = "gate";
    addEvent(visit, "Cleared for exit (no approval needed)", "System", now);
  }
  return null;
}

function decideCheckout(visit: Visit, decision: Decision, by: string, note: string): string | null {
  const now = new Date().toISOString();
  if (decision === "approve") {
    visit.status = "gate";
    addEvent(visit, "Checkout approved", by, now);
  } else {
    visit.status = "signed_in";
    if (note) visit.checkoutNote = note.slice(0, 200);
    addEvent(visit, "Checkout declined: visitor stays on site", by, now);
  }
  return null;
}

/** Who may act at the gate: security, reception and admins release or hold. */
export const canWorkGate = (staff: Staff) => staff.role === "security" || staff.role === "receptionist" || staff.role === "admin";

/** Who may clear a hold: the visitor's host, reception or an admin (not security, who set it). */
export const canClearHold = (staff: Staff, visit: Visit) =>
  visit.status === "hold" && (staff.role === "admin" || staff.role === "receptionist" || (staff.role === "host" && staff.hostId === visit.hostId));

export function gateRelease(visit: Visit, by: string): string | null {
  if (visit.status !== "gate") return visit.status === "hold" ? "This visitor is on hold. The host or an admin must clear it first." : "This visitor isn't cleared to leave.";
  const now = new Date().toISOString();
  visit.status = "signed_out";
  visit.signedOutAt = now;
  visit.signedOutBy = "gate";
  delete visit.hold;
  addEvent(visit, "Released at the gate", by, now);
  return null;
}

export function gateHold(visit: Visit, by: string, reason: string): string | null {
  if (visit.status !== "gate") return "Only a visitor waiting at the gate can be held.";
  if (reason.trim().length < 3) return "Say why you're holding them.";
  const now = new Date().toISOString();
  visit.status = "hold";
  visit.hold = { reason: reason.trim().slice(0, 200), by, at: now };
  addEvent(visit, `Held at the gate: ${visit.hold.reason}`, by, now);
  return null;
}

export function clearHold(visit: Visit, by: string, note = ""): string | null {
  if (visit.status !== "hold") return "This visitor is no longer on hold.";
  visit.status = "gate";
  delete visit.hold;
  addEvent(visit, `Hold cleared${note ? `: ${note.slice(0, 200)}` : ""}: security may release`, by);
  return null;
}

/**
 * Requests nobody answered within the escalation time (Settings) get marked escalated, so they stand out on the
 * staff screens. Returns the newly escalated visits, so the caller can tell reception.
 * There's no scheduler in this prototype: it runs when staff screens or the reception screen load data.
 */
export function sweepEscalations(): Visit[] {
  const escalateMinutes = getSettings().escalateMinutes;
  const late = (iso: string | undefined, now: number) => !!iso && now - new Date(iso).getTime() >= escalateMinutes * 60_000;
  const due = (v: Visit, now: number) =>
    (v.status === "pending" && !v.escalated && late(v.checkedInAt, now)) ||
    (v.status === "checkout" && !v.checkoutEscalated && late(v.checkoutRequestedAt, now));
  const now = Date.now();
  if (!read((d) => d.visits.some((v) => due(v, now)))) return [];
  return write((d) => {
    const hit = d.visits.filter((v) => due(v, now));
    for (const v of hit) {
      if (v.status === "checkout") {
        v.checkoutEscalated = true;
        addEvent(v, `Checkout not answered in ${escalateMinutes} min: reception told`, "System");
      } else {
        v.escalated = true;
        addEvent(v, `No reply from host in ${escalateMinutes} min: reception told`, "System");
      }
    }
    return hit.map((v) => ({ ...v }));
  });
}

/** Minutes since a time, for "waiting 3 min". */
export const minutesSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)) : 0);
