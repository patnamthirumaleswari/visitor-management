import { minutesSince, sweepEscalations } from "./approvals";
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
  };
}

/** Waiting visitors this person can answer: a host's own, or everyone's for admin and reception. Oldest first. */
export function pendingFor(staff: Staff): RequestRow[] {
  return read((d) =>
    d.visits
      .filter((v) => v.status === "pending" && (staff.role !== "host" || v.hostId === staff.hostId))
      .sort((a, b) => (a.checkedInAt ?? "").localeCompare(b.checkedInAt ?? ""))
      .map((v) => toRow(d, v)),
  );
}

/** A host's visitors who checked in today (any status), newest first. */
export function todayForHost(hostId: string): RequestRow[] {
  const today = todayAtLocation();
  const dayOf = (iso?: string) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso)) : "");
  return read((d) =>
    d.visits
      .filter((v) => v.hostId === hostId && v.status !== "pending" && dayOf(v.checkedInAt ?? v.signedInAt) === today)
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
