import { newId, read, write, type Data } from "./db";
import { ROLE_LABELS, type Staff } from "./auth";

// Audit log (FR-ROLE-02): who did what, when, from which network address, newest first.
// Staff actions, sign-ins and visitor check-ins are recorded; admins read it on /admin/audit.

export type AuditEntry = {
  id: string;
  at: string;
  action: string; // e.g. "Entry approved"
  by: string; // person's name, or "Visitor (own phone)", "System"
  role: string; // "Admin", "Host", "Visitor", …
  detail: string; // e.g. "Ravi Kumar (No. 105)" or what changed
  ip: string;
};

const MAX_ENTRIES = 5000;

/** The visitor's network address as the server sees it (first hop when behind a proxy). */
export function ipOf(req: Request | null): string {
  if (!req) return "";
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** "Ravi Kumar (No. 105)" for a visit, used in audit details. */
export function visitLabel(d: Data, visitId: string): string {
  const v = d.visits.find((x) => x.id === visitId);
  const name = v ? d.visitors.find((p) => p.id === v.visitorId)?.name ?? "Visitor" : "Unknown visit";
  return v?.no ? `${name} (No. ${v.no})` : name;
}

type Actor = Staff | { name: string; role: string };

/** Records one action. Use after the change itself has been saved. */
export function audit(req: Request | null, actor: Actor, action: string, detail = "") {
  const role = "username" in actor ? ROLE_LABELS[actor.role] : actor.role;
  write((d) => {
    (d.audit ??= []).unshift({ id: newId(), at: new Date().toISOString(), action, by: actor.name, role, detail: detail.slice(0, 300), ip: ipOf(req) });
    if (d.audit.length > MAX_ENTRIES) d.audit.length = MAX_ENTRIES;
  });
}

/** Records an action about a visit, with the visitor's name and number. */
export function auditVisit(req: Request | null, actor: Actor, action: string, visitId: string, extra = "") {
  const label = read((d) => visitLabel(d, visitId));
  audit(req, actor, action, extra ? `${label} · ${extra}` : label);
}

export function getAudit(): AuditEntry[] {
  return read((d) => d.audit ?? []);
}
