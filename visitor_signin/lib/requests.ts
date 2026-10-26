import { minutesSince, reapproveProblem, sweepEscalations } from "./approvals";
import type { Staff } from "./auth";
import { todayAtLocation } from "./dates";
import { LOCATION } from "./config";
import { read, type Data, type Visit } from "./db";
import { notifyReceptionEscalated } from "./notify";
import { typeDisplay } from "./visitorTypes";

// What staff see about waiting visitors: the "Needs your answer" lists (Visitor Connect).

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

export function toRow(d: Data, v: Visit): RequestRow {
  const visitor = d.visitors.find((p) => p.id === v.visitorId);
  const { label, color } = typeDisplay(d, v.visitorType);
  return {
    id: v.id,
    no: v.no,
    code: v.code,
    status: v.status,
    name: visitor?.name ?? "",
    company: visitor?.company ?? "",
    phone: visitor?.phone ?? "",
    photo: visitor?.photo ?? null,
    host: d.hosts.find((h) => h.id === v.hostId)?.name ?? "",
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
    reapprovable: v.status === "denied" && reapproveProblem(d, v) === null,
    // while checking out, "waiting" counts from the checkout request
    ...(v.status === "checkout" ? { waitingMinutes: minutesSince(v.checkoutRequestedAt), escalated: !!v.checkoutEscalated } : {}),
  };
}

const NEEDS_ANSWER: Visit["status"][] = ["pending", "review", "checkout", "hold"];

/**
 * Everything this person can answer: entry requests, checkout requests and gate holds.
 * A host sees their own visitors; admins and reception see everyone's. Oldest first.
 */
export function pendingFor(staff: Staff): RequestRow[] {
  const since = (v: Visit) => (v.status === "pending" || v.status === "review" ? v.checkedInAt : v.status === "hold" ? v.hold?.at : v.checkoutRequestedAt) ?? "";
  return read((d) =>
    d.visits
      .filter((v) => NEEDS_ANSWER.includes(v.status) && (staff.role !== "host" || v.hostId === staff.hostId))
      // watchlist reviews go to admins only (FR-SEC-02); hosts and reception aren't shown them
      .filter((v) => v.status !== "review" || staff.role === "admin")
      .sort((a, b) => since(a).localeCompare(since(b)))
      .map((v) => toRow(d, v)),
  );
}

/** A host's visitors who checked in today (any status), newest first. */
export function todayForHost(hostId: string): RequestRow[] {
  const today = todayAtLocation();
  const dayOf = (iso?: string) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso)) : "");
  return read((d) =>
    d.visits
      .filter((v) => v.hostId === hostId && !NEEDS_ANSWER.includes(v.status) && dayOf(v.checkedInAt ?? v.signedInAt) === today)
      .sort((a, b) => (b.checkedInAt ?? b.signedInAt ?? "").localeCompare(a.checkedInAt ?? a.signedInAt ?? ""))
      .map((v) => toRow(d, v)),
  );
}

/** Marks requests nobody answered in time and tells reception about each. Call it from routes that poll. */
export function checkEscalations() {
  for (const v of sweepEscalations()) {
    const names = read((d) => ({
      visitor: d.visitors.find((p) => p.id === v.visitorId)?.name ?? "A visitor",
      host: d.hosts.find((h) => h.id === v.hostId)?.name ?? "their host",
    }));
    notifyReceptionEscalated(v, names.visitor, names.host).catch((e) => console.error("[notify] escalation failed", e));
  }
}
