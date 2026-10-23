import crypto from "node:crypto";
import { ESCALATE_MINUTES, FIRST_VISIT_NO } from "./config";
import { read, write, type Data, type Visit, type VisitorType } from "./db";
import type { Staff } from "./auth";

// Host approval (Visitor Connect): a walk-in waits at reception until their host approves entry.
// Admins and reception can also decide, and step in when a host doesn't answer in time.

/** Visits that are still going on: waiting for approval, or on site. */
export const isOpen = (v: Visit) => v.status === "pending" || v.status === "signed_in";

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

/** Hosts decide for their own visitors; admins and reception for anyone. */
export function canDecide(staff: Staff, visit: Visit): boolean {
  if (visit.status !== "pending") return false;
  if (staff.role === "admin" || staff.role === "receptionist") return true;
  return staff.role === "host" && !!staff.hostId && staff.hostId === visit.hostId;
}

export type Decision = "approve" | "deny";

/** Approves or denies a waiting visit. Returns an error message if it was already decided. Runs inside write(). */
export function decide(visit: Visit, decision: Decision, by: string, note = ""): string | null {
  if (visit.status !== "pending") {
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

/**
 * Requests nobody answered within ESCALATE_MINUTES get marked escalated, so they stand out on the
 * staff screens. Returns the newly escalated visits, so the caller can tell reception.
 * There's no scheduler in this prototype: it runs when staff screens or the reception screen load data.
 */
export function sweepEscalations(): Visit[] {
  const due = (v: Visit, now: number) =>
    v.status === "pending" && !v.escalated && !!v.checkedInAt && now - new Date(v.checkedInAt).getTime() >= ESCALATE_MINUTES * 60_000;
  const now = Date.now();
  if (!read((d) => d.visits.some((v) => due(v, now)))) return [];
  return write((d) => {
    const hit = d.visits.filter((v) => due(v, now));
    for (const v of hit) {
      v.escalated = true;
      addEvent(v, `No reply from host in ${ESCALATE_MINUTES} min: reception told`, "System");
    }
    return hit.map((v) => ({ ...v }));
  });
}

/** Minutes since a time, for "waiting 3 min". */
export const minutesSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)) : 0);
