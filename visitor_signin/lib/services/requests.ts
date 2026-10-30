import { addEvent, minutesSince, reapproveProblem } from "../approvals";
import type { Staff } from "../auth";
import { LOCATION } from "../config";
import { todayAtLocation } from "../dates";
import type { Visit, VisitorType } from "../types";
import { notifyReceptionEscalated } from "../notify";
import { changeVisit, findVisits, findVisitsWithPeople, OPEN_STATUSES, type VisitWithPeople } from "../repos/visits";
import { typeDisplay } from "../visitorTypes";
import { getSettings } from "./settings";
import { listVisitorTypes } from "./visitorTypes";

// What staff see about waiting visitors: the "Needs your answer" lists (Visitor Connect), and the
// escalation check that tells reception when nobody answers in time.

export type RequestRow = {
  id: string;
  no?: number;
  code?: string;
  status: Visit["status"];
  name: string;
  company: string;
  phone: string;
  photo: string | null;
  host: string;
  typeLabel: string;
  typeColor: string;
  purpose: string;
  answers: Array<{ questionId: string; label: string; value: string }>;
  checkedInAt?: string;
  waitingMinutes: number;
  escalated: boolean;
  decidedBy?: string;
  decisionNote?: string;
  checkoutRequestedAt?: string;
  checkoutNote?: string;
  holdReason?: string;
  watchReason?: string; // why they're on the watchlist (shown to admins)
  reapprovable: boolean; // denied today and not checked in again: the host can approve after all
};

/** Visitors with an open visit right now (to tell whether a denied visitor has checked in again). */
export async function visitorsWithOpenVisits(): Promise<Map<string, string[]>> {
  const open = await findVisits({ status: { in: OPEN_STATUSES } });
  const byVisitor = new Map<string, string[]>();
  for (const v of open) byVisitor.set(v.visitorId, [...(byVisitor.get(v.visitorId) ?? []), v.id]);
  return byVisitor;
}

/** Whether this visitor has an open visit other than `visit`. */
export const checkedInAgain = (open: Map<string, string[]>, visit: Visit) => (open.get(visit.visitorId) ?? []).some((id) => id !== visit.id);

export function toRow({ visit: v, visitor, host }: VisitWithPeople, types: VisitorType[], open: Map<string, string[]>): RequestRow {
  const { label, color } = typeDisplay(types, v.visitorType);
  return {
    id: v.id,
    no: v.no,
    code: v.code,
    status: v.status,
    name: visitor.name,
    company: visitor.company,
    phone: visitor.phone,
    photo: visitor.photo ?? null,
    host: host.name,
    typeLabel: label,
    typeColor: color,
    purpose: v.purpose,
    answers: v.answers ?? [],
    checkedInAt: v.checkedInAt,
    waitingMinutes: minutesSince(v.checkedInAt),
    escalated: !!v.escalated,
    decidedBy: v.decidedBy,
    decisionNote: v.decisionNote,
    checkoutRequestedAt: v.checkoutRequestedAt,
    checkoutNote: v.checkoutNote,
    holdReason: v.hold?.reason,
    watchReason: v.watch?.reason,
    reapprovable: v.status === "denied" && reapproveProblem(v, checkedInAgain(open, v)) === null,
    // while checking out, "waiting" counts from the checkout request
    ...(v.status === "checkout" ? { waitingMinutes: minutesSince(v.checkoutRequestedAt), escalated: !!v.checkoutEscalated } : {}),
  };
}

/** Rows for a set of visits, with what toRow needs loaded once. */
export async function rowsFor(items: VisitWithPeople[]): Promise<RequestRow[]> {
  const [types, open] = await Promise.all([listVisitorTypes(), visitorsWithOpenVisits()]);
  return items.map((i) => toRow(i, types, open));
}

const NEEDS_ANSWER: Visit["status"][] = ["pending", "review", "checkout", "hold"];

/**
 * Everything this person can answer: entry requests, checkout requests and gate holds.
 * A host sees their own visitors; admins and reception see everyone's. Oldest first.
 * Watchlist reviews go to admins only (FR-SEC-02).
 */
export async function pendingFor(staff: Staff): Promise<RequestRow[]> {
  const statuses = NEEDS_ANSWER.filter((s) => s !== "review" || staff.role === "admin");
  const items = await findVisitsWithPeople({ status: { in: statuses }, ...(staff.role === "host" ? { hostId: staff.hostId ?? "-" } : {}) });
  const since = (v: Visit) => (v.status === "pending" || v.status === "review" ? v.checkedInAt : v.status === "hold" ? v.hold?.at : v.checkoutRequestedAt) ?? "";
  items.sort((a, b) => since(a.visit).localeCompare(since(b.visit)));
  return rowsFor(items);
}

const dayOf = (iso?: string) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso)) : "");

/** A host's visitors who checked in today (any status except waiting for an answer), newest first. */
export async function todayForHost(hostId: string): Promise<RequestRow[]> {
  const today = todayAtLocation();
  const recent = new Date(Date.now() - 36 * 3600_000); // covers "today" in any time zone
  const items = (await findVisitsWithPeople({
    hostId,
    status: { notIn: NEEDS_ANSWER },
    OR: [{ checkedInAt: { gte: recent } }, { checkedInAt: null, signedInAt: { gte: recent } }],
  })).filter((i) => dayOf(i.visit.checkedInAt ?? i.visit.signedInAt) === today);
  return rowsFor(items);
}

/**
 * Requests nobody answered within the escalation time (Settings) are marked escalated, so they stand
 * out on the staff screens, and reception is told. There's no scheduler yet: it runs when staff
 * screens or the reception screen load data.
 */
export async function checkEscalations() {
  const { escalateMinutes } = await getSettings();
  const cutoff = new Date(Date.now() - escalateMinutes * 60_000);
  const due = await findVisitsWithPeople({
    OR: [
      { status: "pending", escalated: false, checkedInAt: { lte: cutoff } },
      { status: "checkout", checkoutEscalated: false, checkoutRequestedAt: { lte: cutoff } },
    ],
  });
  for (const { visit, visitor, host } of due) {
    const changed = await changeVisit(visit.id, (v) => {
      if (v.status === "checkout" && !v.checkoutEscalated) {
        v.checkoutEscalated = true;
        addEvent(v, `Checkout not answered in ${escalateMinutes} min: reception told`, "System");
        return { ...v };
      }
      if (v.status === "pending" && !v.escalated) {
        v.escalated = true;
        addEvent(v, `No reply from host in ${escalateMinutes} min: reception told`, "System");
        return { ...v };
      }
      return null; // answered in the meantime
    });
    if (changed) notifyReceptionEscalated(changed, visitor.name, host.name).catch((e) => console.error("[notify] escalation failed", e));
  }
}
