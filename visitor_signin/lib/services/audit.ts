import { ROLE_LABELS, type Staff } from "../auth";
import { insertAudit, listAudit, visitLabelOf } from "../repos/audit";

// Audit log (FR-ROLE-02): who did what, when, from which network address, newest first.
// Staff actions, sign-ins and visitor check-ins are recorded; admins read it on /admin/audit.

export type AuditEntry = {
  id: string;
  at: string; // ISO time
  action: string; // e.g. "Entry approved"
  by: string; // person's name, or "Visitor (own phone)", "System"
  role: string; // "Admin", "Host", "Visitor", …
  detail: string; // e.g. "Ravi Kumar (No. 105)" or what changed
  ip: string;
};

// The log page shows this many newest entries (older ones stay in the database).
const SHOWN = 5000;

/** The visitor's network address as the server sees it (first hop when behind a proxy). */
export function ipOf(req: Request | null): string {
  if (!req) return "";
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

type Actor = Staff | { name: string; role: string };

/**
 * Records one action. Call it after the change itself has been saved. A failure to write the log is
 * reported in the server output but never undoes or fails the action.
 */
export async function audit(req: Request | null, actor: Actor, action: string, detail = "") {
  const role = "username" in actor ? ROLE_LABELS[actor.role] : actor.role;
  try {
    await insertAudit({ action, by: actor.name, role, detail: detail.slice(0, 300), ip: ipOf(req) });
  } catch (e) {
    console.error("[audit] could not record", action, e);
  }
}

/** Records an action about a visit, with the visitor's name and number. */
export async function auditVisit(req: Request | null, actor: Actor, action: string, visitId: string, extra = "") {
  const label = (await visitLabelOf(visitId).catch(() => null)) ?? "Visitor";
  await audit(req, actor, action, extra ? `${label} · ${extra}` : label);
}

export async function getAudit(): Promise<AuditEntry[]> {
  return (await listAudit(SHOWN)).map((e) => ({ ...e, at: e.at.toISOString() }));
}
